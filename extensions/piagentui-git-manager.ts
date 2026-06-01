import { spawn } from 'node:child_process'

export interface GitCommandResult {
  stdout: string
  stderr: string
}

export type GitCommandRunner = (args: string[], options: { cwd: string }) => Promise<GitCommandResult>

export interface GitBranchInfo {
  name: string
  current: boolean
  remote: boolean
  upstream?: string
  commit?: string
}

export interface GitBranchesResult {
  current?: string
  branches: GitBranchInfo[]
}

export interface GitStatusFile {
  path: string
  index: string
  workingTree: string
  staged: boolean
  unstaged: boolean
  untracked: boolean
}

export interface GitStatusResult {
  branch?: string
  upstream?: string
  ahead: number
  behind: number
  dirty: boolean
  files: GitStatusFile[]
}

export interface GitActionResult {
  ok: true
  stdout?: string
  stderr?: string
}

export interface CheckoutGitBranchRequest {
  branch: string
}

export interface CreateGitBranchRequest {
  name: string
}

export interface GitPathsRequest {
  paths: string[]
}

export interface CommitGitChangesRequest {
  message: string
}

export const runGit: GitCommandRunner = (args, options) => {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: options.cwd, shell: false })
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error((stderr || stdout || `git ${args.join(' ')} failed with exit code ${code}`).trim()))
    })
  })
}

function assertSafeRefName(value: string, label: string): string {
  const name = value.trim()
  if (!name) throw new Error(`${label} is required`)
  if (name.startsWith('-')) throw new Error(`Invalid ${label}`)
  if (/\s/.test(name) || /[\0~^:?*[\]\\]/.test(name) || name.includes('..') || name.includes('@{')) {
    throw new Error(`Invalid ${label}`)
  }
  return name
}

function assertSafePath(value: string): string {
  const filePath = value.trim()
  if (!filePath) throw new Error('Git path is required')
  if (filePath.includes('\0')) throw new Error('Invalid Git path')
  return filePath
}

function normalizeRemoteName(name: string): string {
  return name.replace(/^remotes\//, '')
}

export async function listGitBranches(cwd: string, runner: GitCommandRunner = runGit): Promise<GitBranchesResult> {
  const { stdout } = await runner(
    ['branch', '--format=%(refname:short)|%(upstream:short)|%(objectname:short)|%(HEAD)', '--all'],
    {
      cwd,
    },
  )

  const branches = stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [rawName, upstream, commit, head] = line.split('|')
      const name = normalizeRemoteName(rawName)
      return {
        name,
        current: head === '*',
        remote: rawName.startsWith('remotes/') || name.startsWith('origin/'),
        upstream: upstream || undefined,
        commit: commit || undefined,
      }
    })
    .filter(branch => branch.name !== 'origin/HEAD')

  return { current: branches.find(branch => branch.current)?.name, branches }
}

function parseStatusPath(line: string): string {
  if (line.includes('\t')) return line.split('\t').pop() || ''
  const parts = line.split(' ')
  return parts[parts.length - 1] || ''
}

export async function getGitStatus(cwd: string, runner: GitCommandRunner = runGit): Promise<GitStatusResult> {
  const { stdout } = await runner(['status', '--porcelain=v2', '--branch'], { cwd })
  const status: GitStatusResult = { ahead: 0, behind: 0, dirty: false, files: [] }

  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue
    if (line.startsWith('# branch.head ')) {
      const branch = line.slice('# branch.head '.length).trim()
      if (branch && branch !== '(detached)') status.branch = branch
      continue
    }
    if (line.startsWith('# branch.upstream ')) {
      status.upstream = line.slice('# branch.upstream '.length).trim()
      continue
    }
    if (line.startsWith('# branch.ab ')) {
      const match = line.match(/\+(\d+)\s+-(\d+)/)
      if (match) {
        status.ahead = Number(match[1])
        status.behind = Number(match[2])
      }
      continue
    }
    if (line.startsWith('1 ') || line.startsWith('2 ')) {
      const xy = line.slice(2, 4)
      const file = {
        path: parseStatusPath(line),
        index: xy[0],
        workingTree: xy[1],
        staged: xy[0] !== '.',
        unstaged: xy[1] !== '.',
        untracked: false,
      }
      status.files.push(file)
      continue
    }
    if (line.startsWith('? ')) {
      status.files.push({
        path: line.slice(2).trim(),
        index: '?',
        workingTree: '?',
        staged: false,
        unstaged: false,
        untracked: true,
      })
    }
  }

  status.dirty = status.files.length > 0
  return status
}

export async function checkoutGitBranch(
  cwd: string,
  request: CheckoutGitBranchRequest,
  runner: GitCommandRunner = runGit,
): Promise<GitActionResult> {
  const branch = assertSafeRefName(request.branch, 'Branch')
  const result = await runner(['checkout', branch], { cwd })
  return { ok: true, ...result }
}

export async function createGitBranch(
  cwd: string,
  request: CreateGitBranchRequest,
  runner: GitCommandRunner = runGit,
): Promise<GitActionResult> {
  const name = assertSafeRefName(request.name, 'Branch name')
  const result = await runner(['checkout', '-b', name], { cwd })
  return { ok: true, ...result }
}

function normalizePaths(request: GitPathsRequest): string[] {
  if (!Array.isArray(request.paths) || request.paths.length === 0) throw new Error('At least one path is required')
  return request.paths.map(assertSafePath)
}

export async function stageGitPaths(
  cwd: string,
  request: GitPathsRequest,
  runner: GitCommandRunner = runGit,
): Promise<GitActionResult> {
  const paths = normalizePaths(request)
  const result = await runner(['add', '--', ...paths], { cwd })
  return { ok: true, ...result }
}

export async function unstageGitPaths(
  cwd: string,
  request: GitPathsRequest,
  runner: GitCommandRunner = runGit,
): Promise<GitActionResult> {
  const paths = normalizePaths(request)
  const result = await runner(['restore', '--staged', '--', ...paths], { cwd })
  return { ok: true, ...result }
}

export async function commitGitChanges(
  cwd: string,
  request: CommitGitChangesRequest,
  runner: GitCommandRunner = runGit,
): Promise<GitActionResult> {
  const message = request.message.trim()
  if (!message) throw new Error('Commit message is required')
  const result = await runner(['commit', '-m', message], { cwd })
  return { ok: true, ...result }
}

export async function pullGitBranch(cwd: string, runner: GitCommandRunner = runGit): Promise<GitActionResult> {
  const result = await runner(['pull', '--ff-only'], { cwd })
  return { ok: true, ...result }
}

export async function pushGitBranch(cwd: string, runner: GitCommandRunner = runGit): Promise<GitActionResult> {
  const result = await runner(['push'], { cwd })
  return { ok: true, ...result }
}
