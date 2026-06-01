import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  checkoutGitBranch,
  commitGitChanges,
  createGitBranch,
  getGitStatus,
  listGitBranches,
  stageGitPaths,
  unstageGitPaths,
  type GitCommandRunner,
} from './piagentui-git-manager.js'

const repoDir = path.join(os.tmpdir(), 'piagentui-git-manager-test')

function createRunner(outputs: Record<string, { stdout?: string; stderr?: string }>): GitCommandRunner {
  return vi.fn(async args => {
    const key = args.join(' ')
    const output = outputs[key]
    if (!output) throw new Error(`Unexpected git args: ${key}`)
    return { stdout: output.stdout ?? '', stderr: output.stderr ?? '' }
  })
}

describe('piagentui git manager', () => {
  it('parses branch output into current local and remote branches', async () => {
    const runner = createRunner({
      'branch --format=%(refname:short)|%(upstream:short)|%(objectname:short)|%(HEAD) --all': {
        stdout: [
          'main|origin/main|1111111| ',
          'feature/git-ui|origin/feature/git-ui|2222222|*',
          'origin/main||3333333| ',
        ].join('\n'),
      },
    })

    const result = await listGitBranches(repoDir, runner)

    expect(result.current).toBe('feature/git-ui')
    expect(result.branches).toEqual([
      { name: 'main', current: false, remote: false, upstream: 'origin/main', commit: '1111111' },
      { name: 'feature/git-ui', current: true, remote: false, upstream: 'origin/feature/git-ui', commit: '2222222' },
      { name: 'origin/main', current: false, remote: true, commit: '3333333' },
    ])
  })

  it('parses porcelain v2 status and ahead behind data', async () => {
    const runner = createRunner({
      'status --porcelain=v2 --branch': {
        stdout: [
          '# branch.oid abcdef1',
          '# branch.head feature/git-ui',
          '# branch.upstream origin/feature/git-ui',
          '# branch.ab +2 -1',
          '1 M. N... 100644 100644 100644 a b src/app.tsx',
          '1 .M N... 100644 100644 100644 a b src/input.tsx',
          '? src/new-file.ts',
        ].join('\n'),
      },
    })

    const status = await getGitStatus(repoDir, runner)

    expect(status.branch).toBe('feature/git-ui')
    expect(status.upstream).toBe('origin/feature/git-ui')
    expect(status.ahead).toBe(2)
    expect(status.behind).toBe(1)
    expect(status.dirty).toBe(true)
    expect(status.files).toEqual([
      { path: 'src/app.tsx', index: 'M', workingTree: '.', staged: true, unstaged: false, untracked: false },
      { path: 'src/input.tsx', index: '.', workingTree: 'M', staged: false, unstaged: true, untracked: false },
      { path: 'src/new-file.ts', index: '?', workingTree: '?', staged: false, unstaged: false, untracked: true },
    ])
  })

  it('runs safe fixed argv for branch and stage operations', async () => {
    const runner = createRunner({
      'checkout main': {},
      'checkout -b feature/new-branch': {},
      'add -- src/app.tsx src/input.tsx': {},
      'restore --staged -- src/app.tsx': {},
    })

    await checkoutGitBranch(repoDir, { branch: 'main' }, runner)
    await createGitBranch(repoDir, { name: 'feature/new-branch' }, runner)
    await stageGitPaths(repoDir, { paths: ['src/app.tsx', 'src/input.tsx'] }, runner)
    await unstageGitPaths(repoDir, { paths: ['src/app.tsx'] }, runner)

    expect(runner).toHaveBeenCalledWith(['checkout', 'main'], { cwd: repoDir })
    expect(runner).toHaveBeenCalledWith(['checkout', '-b', 'feature/new-branch'], { cwd: repoDir })
    expect(runner).toHaveBeenCalledWith(['add', '--', 'src/app.tsx', 'src/input.tsx'], { cwd: repoDir })
    expect(runner).toHaveBeenCalledWith(['restore', '--staged', '--', 'src/app.tsx'], { cwd: repoDir })
  })

  it('rejects empty commit messages before running git', async () => {
    const runner = vi.fn()

    await expect(commitGitChanges(repoDir, { message: '   ' }, runner)).rejects.toThrow('Commit message is required')

    expect(runner).not.toHaveBeenCalled()
  })
})
