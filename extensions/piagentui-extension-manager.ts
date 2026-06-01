import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

export type ExtensionPackageScope = 'user' | 'project'
export type ExtensionPackageStatus = 'active' | 'inactive' | 'missing' | 'error'
export type ExtensionResourceType = 'extensions' | 'skills' | 'prompts' | 'themes'

export interface ExtensionResource {
  name: string
  path: string
  enabled: boolean
}

export interface ExtensionPackageResources {
  extensions: ExtensionResource[]
  skills: ExtensionResource[]
  prompts: ExtensionResource[]
  themes: ExtensionResource[]
}

export interface ExtensionPackageInfo {
  source: string
  scope: ExtensionPackageScope
  filtered: boolean
  installedPath?: string
  packageName?: string
  version?: string
  description?: string
  image?: string
  keywords?: string[]
  status: ExtensionPackageStatus
  error?: string
  resources: ExtensionPackageResources
}

export interface ExtensionCatalogSummary {
  total: number
  active: number
  inactive: number
  missing: number
  error: number
}

export interface ExtensionCatalog {
  packages: ExtensionPackageInfo[]
  summary: ExtensionCatalogSummary
}

export interface BuildExtensionCatalogOptions {
  cwd: string
  homeDir?: string
}

interface PiSettings {
  packages?: PackageSourceEntry[]
}

interface PackageSourceObject {
  source: string
  extensions?: string[]
  skills?: string[]
  prompts?: string[]
  themes?: string[]
}

type PackageSourceEntry = string | PackageSourceObject

interface NormalizedPackageSource {
  source: string
  scope: ExtensionPackageScope
  filtered: boolean
  filters: Partial<Record<ExtensionResourceType, string[]>>
}

interface PackageJsonMetadata {
  name?: string
  version?: string
  description?: string
  keywords?: string[]
  pi?: Partial<Record<ExtensionResourceType, string[]>> & { image?: string }
}

export interface ParsedPiInstallCommand {
  source: string
  local: boolean
}

export type PiCommandRunner = (args: string[], options: { cwd: string }) => Promise<{ stdout: string; stderr: string }>

const RESOURCE_TYPES: ExtensionResourceType[] = ['extensions', 'skills', 'prompts', 'themes']

const RESOURCE_FILE_PATTERNS: Record<ExtensionResourceType, RegExp> = {
  extensions: /\.(?:ts|js)$/,
  skills: /\.md$/,
  prompts: /\.md$/,
  themes: /\.json$/,
}

function getHomeDir(homeDir?: string): string {
  return homeDir || process.env.USERPROFILE || process.env.HOME || os.homedir()
}

function getAgentDir(homeDir?: string): string {
  return path.join(getHomeDir(homeDir), '.pi', 'agent')
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

function readSettings(filePath: string): PiSettings {
  return readJsonFile<PiSettings>(filePath) ?? {}
}

function normalizePackageEntry(
  entry: PackageSourceEntry,
  scope: ExtensionPackageScope,
): NormalizedPackageSource | null {
  if (typeof entry === 'string') {
    const source = entry.trim()
    return source ? { source, scope, filtered: false, filters: {} } : null
  }

  if (!entry || typeof entry.source !== 'string') return null
  const source = entry.source.trim()
  if (!source) return null

  return {
    source,
    scope,
    filtered: true,
    filters: {
      extensions: entry.extensions,
      skills: entry.skills,
      prompts: entry.prompts,
      themes: entry.themes,
    },
  }
}

function parseNpmPackageName(source: string): string | null {
  if (!source.startsWith('npm:')) return null
  const spec = source.slice('npm:'.length).trim()
  const match = spec.match(/^(@?[^@]+(?:\/[^@]+)?)(?:@.+)?$/)
  return (match?.[1] ?? spec) || null
}

function isProbablyLocalSource(source: string): boolean {
  return (
    source.startsWith('.') ||
    source.startsWith('~') ||
    path.isAbsolute(source) ||
    /^[a-zA-Z]:[\\/]/.test(source) ||
    source.includes('\\')
  )
}

function resolveLocalSource(source: string, scope: ExtensionPackageScope, cwd: string, homeDir?: string): string {
  const baseDir = scope === 'project' ? path.join(cwd, '.pi') : getAgentDir(homeDir)
  if (source.startsWith('~')) return path.resolve(path.join(getHomeDir(homeDir), source.slice(1)))
  if (path.isAbsolute(source) || /^[a-zA-Z]:[\\/]/.test(source)) return path.resolve(source)
  return path.resolve(baseDir, source)
}

function parseGitInstallPathParts(source: string): { host: string; repoPath: string } | null {
  const normalized = source.replace(/^git:/, '')
  const githubShorthand = normalized.match(/^github\.com[/:]([^\s]+)$/)
  if (githubShorthand) return { host: 'github.com', repoPath: githubShorthand[1].replace(/\.git$/, '') }

  const sshMatch = normalized.match(/^git@([^:]+):(.+)$/)
  if (sshMatch) return { host: sshMatch[1], repoPath: sshMatch[2].replace(/\.git$/, '') }

  try {
    const url = new URL(normalized)
    if (!url.hostname || !url.pathname) return null
    return { host: url.hostname, repoPath: url.pathname.replace(/^\//, '').replace(/\.git$/, '') }
  } catch {
    return null
  }
}

function resolveInstalledPath(
  source: string,
  scope: ExtensionPackageScope,
  cwd: string,
  homeDir?: string,
): string | undefined {
  const agentDir = getAgentDir(homeDir)
  if (source.startsWith('npm:')) {
    const packageName = parseNpmPackageName(source)
    if (!packageName) return undefined
    const installRoot = scope === 'project' ? path.join(cwd, '.pi', 'npm') : path.join(agentDir, 'npm')
    const packagePath = path.join(installRoot, 'node_modules', ...packageName.split('/'))
    return fs.existsSync(packagePath) ? packagePath : undefined
  }

  if (isProbablyLocalSource(source)) {
    const packagePath = resolveLocalSource(source, scope, cwd, homeDir)
    return fs.existsSync(packagePath) ? packagePath : undefined
  }

  const gitParts = parseGitInstallPathParts(source)
  if (gitParts) {
    const installRoot = scope === 'project' ? path.join(cwd, '.pi', 'git') : path.join(agentDir, 'git')
    const packagePath = path.join(installRoot, gitParts.host, ...gitParts.repoPath.split(/[\\/]+/))
    return fs.existsSync(packagePath) ? packagePath : undefined
  }

  return undefined
}

function collectFiles(root: string, resourceType: ExtensionResourceType): string[] {
  if (!fs.existsSync(root)) return []
  const stat = fs.statSync(root)
  if (stat.isFile()) return RESOURCE_FILE_PATTERNS[resourceType].test(root) ? [root] : []
  if (!stat.isDirectory()) return []

  const files: string[] = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath, resourceType))
    } else if (entry.isFile() && RESOURCE_FILE_PATTERNS[resourceType].test(entryPath)) {
      files.push(entryPath)
    }
  }
  return files.sort((a, b) => a.localeCompare(b))
}

function stripOverridePatterns(entries: string[]): string[] {
  return entries.filter(entry => !entry.trim().startsWith('!'))
}

function resolveManifestEntry(packageRoot: string, entry: string, resourceType: ExtensionResourceType): string[] {
  const normalized = entry.trim()
  if (!normalized || normalized.startsWith('!')) return []

  if (normalized.includes('*')) {
    const conventionRoot = path.join(packageRoot, resourceType)
    return collectFiles(conventionRoot, resourceType)
  }

  const entryPath = path.resolve(packageRoot, normalized)
  return collectFiles(entryPath, resourceType)
}

function discoverResourcePaths(
  packageRoot: string,
  metadata: PackageJsonMetadata | null,
  resourceType: ExtensionResourceType,
): string[] {
  const manifestEntries = metadata?.pi?.[resourceType]
  if (manifestEntries && manifestEntries.length > 0) {
    const files = stripOverridePatterns(manifestEntries).flatMap(entry =>
      resolveManifestEntry(packageRoot, entry, resourceType),
    )
    return Array.from(new Set(files)).sort((a, b) => a.localeCompare(b))
  }

  return collectFiles(path.join(packageRoot, resourceType), resourceType)
}

function toRelativePosix(packageRoot: string, filePath: string): string {
  return path.relative(packageRoot, filePath).replace(/\\/g, '/')
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}

function matchesFilter(packageRoot: string, filePath: string, patterns: string[]): boolean {
  const relativePath = toRelativePosix(packageRoot, filePath)
  const normalizedPatterns = patterns.map(pattern => pattern.trim()).filter(Boolean)
  if (normalizedPatterns.length === 0) return false

  return normalizedPatterns.some(pattern => {
    const positivePattern = pattern.startsWith('!') ? pattern.slice(1) : pattern
    if (!positivePattern) return false
    const normalizedPattern = positivePattern.replace(/\\/g, '/')
    return (
      relativePath === normalizedPattern ||
      relativePath.endsWith(`/${normalizedPattern}`) ||
      wildcardToRegExp(normalizedPattern).test(relativePath)
    )
  })
}

function resourceName(filePath: string): string {
  if (path.basename(filePath).toLowerCase() === 'skill.md') return path.basename(path.dirname(filePath))
  return path.basename(filePath)
}

function buildResources(
  packageRoot: string,
  metadata: PackageJsonMetadata | null,
  filters: Partial<Record<ExtensionResourceType, string[]>>,
): ExtensionPackageResources {
  const resources = {} as ExtensionPackageResources

  for (const resourceType of RESOURCE_TYPES) {
    const files = discoverResourcePaths(packageRoot, metadata, resourceType)
    const patterns = filters[resourceType]
    resources[resourceType] = files.map(filePath => ({
      name: resourceName(filePath),
      path: filePath,
      enabled: patterns === undefined ? true : matchesFilter(packageRoot, filePath, patterns),
    }))
  }

  return resources
}

function hasEnabledResource(resources: ExtensionPackageResources): boolean {
  return RESOURCE_TYPES.some(resourceType => resources[resourceType].some(resource => resource.enabled))
}

function countByStatus(packages: ExtensionPackageInfo[]): ExtensionCatalogSummary {
  return packages.reduce<ExtensionCatalogSummary>(
    (summary, pkg) => {
      summary.total += 1
      summary[pkg.status] += 1
      return summary
    },
    { total: 0, active: 0, inactive: 0, missing: 0, error: 0 },
  )
}

function readPackageMetadata(packageRoot: string): { metadata: PackageJsonMetadata | null; error?: string } {
  const packageJsonPath = path.join(packageRoot, 'package.json')
  if (!fs.existsSync(packageJsonPath)) return { metadata: null }

  try {
    return { metadata: JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJsonMetadata }
  } catch (error) {
    return { metadata: null, error: error instanceof Error ? error.message : String(error) }
  }
}

export function buildExtensionCatalog(options: BuildExtensionCatalogOptions): ExtensionCatalog {
  const homeDir = getHomeDir(options.homeDir)
  const agentDir = getAgentDir(homeDir)
  const userSettings = readSettings(path.join(agentDir, 'settings.json'))
  const projectSettings = readSettings(path.join(options.cwd, '.pi', 'settings.json'))
  const configuredPackages = [
    ...(userSettings.packages ?? []).map(entry => normalizePackageEntry(entry, 'user')),
    ...(projectSettings.packages ?? []).map(entry => normalizePackageEntry(entry, 'project')),
  ].filter((entry): entry is NormalizedPackageSource => entry !== null)

  const packages = configuredPackages.map<ExtensionPackageInfo>(entry => {
    const installedPath = resolveInstalledPath(entry.source, entry.scope, options.cwd, homeDir)
    if (!installedPath) {
      return {
        source: entry.source,
        scope: entry.scope,
        filtered: entry.filtered,
        status: 'missing',
        resources: { extensions: [], skills: [], prompts: [], themes: [] },
      }
    }

    const { metadata, error } = readPackageMetadata(installedPath)
    const resources = buildResources(installedPath, metadata, entry.filters)
    const status: ExtensionPackageStatus = error ? 'error' : hasEnabledResource(resources) ? 'active' : 'inactive'

    return {
      source: entry.source,
      scope: entry.scope,
      filtered: entry.filtered,
      installedPath,
      packageName: metadata?.name,
      version: metadata?.version,
      description: metadata?.description,
      image: metadata?.pi?.image,
      keywords: metadata?.keywords,
      status,
      error,
      resources,
    }
  })

  packages.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'project' ? -1 : 1
    return (a.packageName || a.source).localeCompare(b.packageName || b.source)
  })

  return { packages, summary: countByStatus(packages) }
}

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]
    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (quote) throw new Error('Unterminated quote in install command')
  if (current) tokens.push(current)
  return tokens
}

export function parsePiInstallCommand(command: string): ParsedPiInstallCommand {
  const tokens = tokenizeCommand(command.trim())
  if (
    tokens.length < 2 ||
    path
      .basename(tokens[0])
      .replace(/\.(cmd|exe)$/i, '')
      .toLowerCase() !== 'pi'
  ) {
    throw new Error('Paste a pi install command, for example: pi install npm:pi-hud')
  }
  if (tokens[1] !== 'install') {
    throw new Error('Only pi install commands are supported')
  }

  let local = false
  let source: string | null = null
  for (const token of tokens.slice(2)) {
    if (token === '-l' || token === '--local') {
      local = true
      continue
    }
    if (token.startsWith('-')) throw new Error(`Unsupported install option: ${token}`)
    if (source) throw new Error(`Unsupported extra argument: ${token}`)
    if (/[;&|<>`]/.test(token)) throw new Error(`Unsupported shell syntax in install command: ${token}`)
    source = token
  }

  if (!source) throw new Error('Missing extension source in pi install command')
  return { source, local }
}

function getPiExecutable(): string {
  return process.platform === 'win32' ? 'pi.cmd' : 'pi'
}

export function defaultPiCommandRunner(
  args: string[],
  options: { cwd: string },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(getPiExecutable(), args, { cwd: options.cwd, shell: false })
    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', chunk => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(stderr.trim() || `pi ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
    })
  })
}

export async function executeExtensionInstallCommand(
  command: string,
  options: { cwd: string; runner?: PiCommandRunner },
): Promise<{ stdout: string; stderr: string; source: string; scope: ExtensionPackageScope }> {
  const parsed = parsePiInstallCommand(command)
  const runner = options.runner ?? defaultPiCommandRunner
  const args = ['install', parsed.source, ...(parsed.local ? ['-l'] : [])]
  const result = await runner(args, { cwd: options.cwd })
  return { ...result, source: parsed.source, scope: parsed.local ? 'project' : 'user' }
}

export async function executeExtensionPackageRemoval(
  target: { source: string; scope: ExtensionPackageScope },
  options: { cwd: string; runner?: PiCommandRunner },
): Promise<{ stdout: string; stderr: string }> {
  const runner = options.runner ?? defaultPiCommandRunner
  return runner(['remove', target.source, ...(target.scope === 'project' ? ['-l'] : [])], { cwd: options.cwd })
}
