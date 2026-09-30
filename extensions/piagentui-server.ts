import type { ExtensionAPI, ExtensionContext } from '@mariozechner/pi-coding-agent'
import { WebSocketServer, WebSocket } from 'ws'
import * as http from 'node:http'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  validateBearerToken,
  preventPathTraversal,
  validateHostAndOriginForAccess,
  isLoopbackHost,
  isRequestBodySizeAllowed,
  getLocalNetworkUrls,
  validateSttBaseUrl,
  sendInternalServerError,
} from './piagentui-server-core.js'
import {
  createPiAgentUiSettingsStore,
  resolvePiAgentUiSettingsPaths,
  type PiAgentUiLocalSettings,
  type StoredSttSettings,
  type StoredTtsSettings,
} from './piagentui-settings-store.js'
import {
  buildExtensionCatalog,
  executeExtensionInstallCommand,
  executeExtensionPackageRemoval,
  type ExtensionPackageScope,
} from './piagentui-extension-manager.js'
import {
  checkoutGitBranch,
  commitGitChanges,
  createGitBranch,
  getGitStatus,
  listGitBranches,
  pullGitBranch,
  pushGitBranch,
  stageGitPaths,
  unstageGitPaths,
} from './piagentui-git-manager.js'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

type SwitchableExtensionContext = ExtensionContext & {
  switchSession?: (
    sessionPath: string,
    options?: { withSession?: (ctx: any) => Promise<void> },
  ) => Promise<{ cancelled: boolean }>
  setModel?: (model: any) => Promise<void> | void
  sendUserMessage?: (content: string) => Promise<void> | void
}

const messageIds = new Map<string, string>()

function getMessageId(message: any): string {
  if (!message) return ''
  if (message.id) return message.id
  // Use a stable key (responseId or timestamp) instead of object reference.
  // The agent loop passes spread copies of the same logical message across
  // message_start, message_update, and message_end events, so WeakMap
  // (keyed by object identity) would generate different IDs each time —
  // causing part/delta SSE events to reference a non-existent message ID.
  const stableKey = message.responseId || message.timestamp || message.response_id
  if (!stableKey) {
    return 'msg-' + Math.random().toString(36).substring(2) + '-' + Date.now()
  }
  const key = String(stableKey)
  let id = messageIds.get(key)
  if (!id) {
    id = 'msg-' + Math.random().toString(36).substring(2) + '-' + key
    messageIds.set(key, id)
  }
  return id
}

function isVisibleChatRole(role: unknown): role is 'user' | 'assistant' {
  return role === 'user' || role === 'assistant'
}

function getMessageText(message: any): string {
  if (!message) return ''
  if (typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any) => c && c.type === 'text')
      .map((c: any) => c.text)
      .join('')
  }
  if (message.text) {
    return message.text
  }
  return ''
}

type SkillSource = 'global' | 'project' | 'package' | 'other'
type McpTransport = 'stdio' | 'http' | 'sse' | 'unknown'
type McpSource = 'global' | 'project' | 'other'
type CommandApiSource = 'builtin' | 'extension' | 'prompt' | 'skill' | 'unknown'

interface ApiSkill {
  name: string
  description: string
  location: string
  content: string
  source: SkillSource
}

interface ApiMcpStatus {
  status: 'configured' | 'disabled' | 'failed'
  transport: McpTransport
  source: McpSource
  description?: string
  command?: string
  args?: string[]
  url?: string
  directTools?: boolean
  lifecycle?: string
  error?: string
}

type SanitizedSttSettings = Omit<Required<StoredSttSettings>, 'apiKey' | 'language'> & {
  language?: string
  apiKeyConfigured: boolean
}

type SanitizedTtsSettings = Omit<Required<StoredTtsSettings>, 'apiKey'> & {
  apiKeyConfigured: boolean
}

interface ApiCommand {
  name: string
  description?: string
  keybind?: string
  apiSource: CommandApiSource
  category: string
  sourceInfo?: unknown
  requiresArgs?: boolean
  dangerous?: boolean
}

const BUILTIN_SLASH_COMMANDS: ApiCommand[] = [
  { name: 'settings', description: 'Open settings menu', apiSource: 'builtin', category: 'general' },
  { name: 'model', description: 'Select model (opens selector UI)', apiSource: 'builtin', category: 'model' },
  {
    name: 'scoped-models',
    description: 'Enable/disable models for Ctrl+P cycling',
    apiSource: 'builtin',
    category: 'model',
  },
  {
    name: 'export',
    description: 'Export session (HTML default, or specify path: .html/.jsonl)',
    apiSource: 'builtin',
    category: 'session',
  },
  {
    name: 'import',
    description: 'Import and resume a session from a JSONL file',
    apiSource: 'builtin',
    category: 'session',
    requiresArgs: true,
  },
  { name: 'share', description: 'Share session as a secret GitHub gist', apiSource: 'builtin', category: 'session' },
  { name: 'copy', description: 'Copy last agent message to clipboard', apiSource: 'builtin', category: 'message' },
  { name: 'name', description: 'Set session display name', apiSource: 'builtin', category: 'session' },
  { name: 'session', description: 'Show session info and stats', apiSource: 'builtin', category: 'session' },
  { name: 'changelog', description: 'Show changelog entries', apiSource: 'builtin', category: 'help' },
  { name: 'hotkeys', description: 'Show all keyboard shortcuts', apiSource: 'builtin', category: 'help' },
  {
    name: 'fork',
    description: 'Create a new fork from a previous user message',
    apiSource: 'builtin',
    category: 'session',
  },
  {
    name: 'clone',
    description: 'Duplicate the current session at the current position',
    apiSource: 'builtin',
    category: 'session',
  },
  { name: 'tree', description: 'Navigate session tree (switch branches)', apiSource: 'builtin', category: 'session' },
  { name: 'login', description: 'Configure provider authentication', apiSource: 'builtin', category: 'auth' },
  { name: 'logout', description: 'Remove provider authentication', apiSource: 'builtin', category: 'auth' },
  { name: 'new', description: 'Start a new session', apiSource: 'builtin', category: 'session' },
  { name: 'compact', description: 'Manually compact the session context', apiSource: 'builtin', category: 'context' },
  { name: 'resume', description: 'Resume a different session', apiSource: 'builtin', category: 'session' },
  {
    name: 'reload',
    description: 'Reload keybindings, extensions, skills, prompts, and themes',
    apiSource: 'builtin',
    category: 'developer',
  },
  { name: 'quit', description: 'Quit Pi', apiSource: 'builtin', category: 'app', dangerous: true },
]

function normalizeCommandApiSource(source: unknown): CommandApiSource {
  return source === 'extension' || source === 'prompt' || source === 'skill' || source === 'builtin'
    ? source
    : 'unknown'
}

function categoryForCommandSource(source: CommandApiSource): string {
  if (source === 'extension' || source === 'prompt' || source === 'skill') return source
  return 'other'
}

function getAvailableCommands(pi: ExtensionAPI): ApiCommand[] {
  const dynamicCommands = typeof pi.getCommands === 'function' ? pi.getCommands() : []
  const commands = new Map<string, ApiCommand>()

  for (const command of BUILTIN_SLASH_COMMANDS) {
    commands.set(command.name, command)
  }

  for (const command of dynamicCommands) {
    if (!command?.name || commands.has(command.name)) continue
    const apiSource = normalizeCommandApiSource(command.source)
    commands.set(command.name, {
      name: command.name,
      description: command.description,
      apiSource,
      category: categoryForCommandSource(apiSource),
      sourceInfo: command.sourceInfo,
    })
  }

  return [...commands.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function countCommandsBySource(commands: ApiCommand[]): Record<CommandApiSource, number> {
  return commands.reduce<Record<CommandApiSource, number>>(
    (acc, command) => {
      acc[command.apiSource] += 1
      return acc
    },
    { builtin: 0, extension: 0, prompt: 0, skill: 0, unknown: 0 },
  )
}

function decodeXml(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

function normalizeComparablePath(value: string | undefined): string {
  return path
    .resolve(value || '')
    .replace(/\\/g, '/')
    .toLowerCase()
}

function classifySkillSource(location: string, cwd: string | undefined): SkillSource {
  const normalizedLocation = normalizeComparablePath(location)
  const normalizedCwd = normalizeComparablePath(cwd)
  const projectSkillsRoot = `${normalizedCwd}/.pi/skills/`

  if (normalizedLocation.includes('/node_modules/') || normalizedLocation.includes('/.pi/agent/npm/')) return 'package'
  if (normalizedCwd && normalizedLocation.startsWith(projectSkillsRoot)) return 'project'
  if (normalizedLocation.includes('/.agents/skills/') || normalizedLocation.includes('/.pi/agent/skills/'))
    return 'global'
  return 'other'
}

function parseSkillsFromSystemPrompt(prompt: string, cwd: string | undefined): ApiSkill[] {
  const skills: ApiSkill[] = []
  const skillRegex =
    /<skill>\s*<name>([\s\S]*?)<\/name>\s*<description>([\s\S]*?)<\/description>\s*<location>([\s\S]*?)<\/location>\s*<\/skill>/g

  for (const match of prompt.matchAll(skillRegex)) {
    const location = decodeXml(match[3]?.trim() ?? '')
    let content = ''
    if (location && fs.existsSync(location)) {
      try {
        content = fs.readFileSync(location, 'utf-8')
      } catch {
        content = ''
      }
    }

    skills.push({
      name: decodeXml(match[1]?.trim() ?? ''),
      description: decodeXml(match[2]?.trim() ?? ''),
      location,
      content,
      source: classifySkillSource(location, cwd),
    })
  }

  return skills
}

function countSkillsBySource(skills: ApiSkill[]): Record<SkillSource, number> {
  return skills.reduce<Record<SkillSource, number>>(
    (acc, skill) => {
      acc[skill.source] += 1
      return acc
    },
    { global: 0, project: 0, package: 0, other: 0 },
  )
}

function getHomeDir(): string {
  return process.env.USERPROFILE || process.env.HOME || ''
}

function readJsonFile(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function getMcpConfigCandidates(cwd: string | undefined) {
  const homeDir = getHomeDir()
  return [
    { source: 'project' as const, filePath: cwd ? path.join(cwd, '.pi', 'agent', 'mcp.json') : '' },
    { source: 'project' as const, filePath: cwd ? path.join(cwd, '.pi', 'mcp.json') : '' },
    { source: 'global' as const, filePath: homeDir ? path.join(homeDir, '.pi', 'agent', 'mcp.json') : '' },
  ].filter(candidate => Boolean(candidate.filePath))
}

function normalizeMcpTransport(config: any): McpTransport {
  if (config?.command) return 'stdio'
  if (config?.type === 'http' || config?.url) return 'http'
  if (config?.type === 'sse') return 'sse'
  return 'unknown'
}

function normalizeMcpServer(config: any, source: McpSource): ApiMcpStatus {
  const disabled = config?.enabled === false || config?.disabled === true
  const args = Array.isArray(config?.args)
    ? config.args.map(String)
    : typeof config?.args === 'string'
      ? [config.args]
      : undefined
  return {
    status: disabled ? 'disabled' : 'configured',
    transport: normalizeMcpTransport(config),
    source,
    description: typeof config?.description === 'string' ? config.description : undefined,
    command: typeof config?.command === 'string' ? config.command : undefined,
    args,
    url: typeof config?.url === 'string' ? config.url : undefined,
    directTools: typeof config?.directTools === 'boolean' ? config.directTools : undefined,
    lifecycle: typeof config?.lifecycle === 'string' ? config.lifecycle : undefined,
  }
}

function loadMcpStatus(cwd: string | undefined): { servers: Record<string, ApiMcpStatus>; configPaths: string[] } {
  const servers: Record<string, ApiMcpStatus> = {}
  const configPaths: string[] = []

  for (const candidate of getMcpConfigCandidates(cwd)) {
    const config = readJsonFile(candidate.filePath)
    if (!config?.mcpServers || typeof config.mcpServers !== 'object') continue
    configPaths.push(candidate.filePath)
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      servers[name] = normalizeMcpServer(serverConfig, candidate.source)
    }
  }

  return { servers, configPaths }
}

export default function (pi: ExtensionAPI) {
  let server: http.Server | null = null
  let wss: WebSocketServer | null = null
  let localPort = 0
  let localToken = ''
  let latestCtx: SwitchableExtensionContext | null = null
  const clients = new Set<WebSocket>()
  const sseClients = new Set<http.ServerResponse>()
  const createdParts = new Set<string>()
  let lastAssistantMessageId = ''
  let preserveServerForSessionSwitch = false
  let sendQueue: Promise<void> = Promise.resolve()

  function enqueueSessionSend<T>(fn: () => Promise<T>): Promise<T> {
    const run = sendQueue.catch(() => undefined).then(fn)
    sendQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  function getCurrentSessionId(): string {
    return latestCtx?.sessionManager?.getSessionId() || 'active-session'
  }

  function getSessionFileForId(sessionId: string): string | null {
    const sessionDir = latestCtx?.sessionManager?.getSessionDir()
    if (!sessionDir || !fs.existsSync(sessionDir)) return null

    const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.jsonl'))
    const matchedFile = files.find(f => f.endsWith(`_${sessionId}.jsonl`))
    return matchedFile ? path.join(sessionDir, matchedFile) : null
  }

  function getFallbackSessionTitle(sessionId: string): string {
    return `Session ${sessionId.slice(0, 8)}`
  }

  function createSessionId(): string {
    return randomUUID()
  }

  function createSessionEntryId(): string {
    return randomUUID().slice(0, 8)
  }

  function createRealSessionFile(params: { directory?: string; title?: string; parentID?: string }): string {
    const sessionDir = latestCtx?.sessionManager?.getSessionDir()
    if (!sessionDir) {
      throw new Error('Session directory is unavailable')
    }

    fs.mkdirSync(sessionDir, { recursive: true })
    const sessionId = createSessionId()
    const timestamp = new Date().toISOString()
    const fileTimestamp = timestamp.replace(/[:.]/g, '-')
    const sessionFile = path.join(sessionDir, `${fileTimestamp}_${sessionId}.jsonl`)
    const header: Record<string, unknown> = {
      type: 'session',
      version: 3,
      id: sessionId,
      timestamp,
      cwd: params.directory || latestCtx?.cwd || process.cwd(),
    }
    if (params.parentID) {
      header.parentSession = params.parentID
    }

    const entries = [JSON.stringify(header)]
    const title = normalizeSessionTitle(params.title || '')
    if (title) {
      entries.push(
        JSON.stringify({
          type: 'session_info',
          id: createSessionEntryId(),
          parentId: null,
          timestamp,
          name: title,
        }),
      )
    }

    fs.writeFileSync(sessionFile, `${entries.join('\n')}\n`, { flag: 'wx' })
    return sessionFile
  }

  async function createAndSwitchToRealSession(params: { directory?: string; title?: string; parentID?: string }) {
    if (!latestCtx?.switchSession) {
      return { status: 501, body: { error: 'Pi session switching is not available in this runtime' } }
    }

    const sessionFile = createRealSessionFile(params)
    preserveServerForSessionSwitch = true
    try {
      const result = await latestCtx.switchSession(sessionFile, {
        withSession: async replacedCtx => {
          latestCtx = replacedCtx as SwitchableExtensionContext
        },
      })

      if (result.cancelled) {
        return { status: 409, body: { error: 'Session switch cancelled' } }
      }

      const metadata = readSessionMetadata(sessionFile)
      return {
        status: 200,
        body:
          metadata ||
          getSessionInfo(
            path
              .basename(sessionFile)
              .replace(/\.jsonl$/, '')
              .split('_')
              .pop() || '',
          ),
      }
    } finally {
      preserveServerForSessionSwitch = false
    }
  }

  function normalizeSessionTitle(title: string): string {
    return title
      .split('')
      .map(char => {
        const code = char.charCodeAt(0)
        return code < 32 || code === 127 ? ' ' : char
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)
  }

  function readSessionMetadata(filePath: string): any | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.trim().split('\n').filter(Boolean)
      if (lines.length === 0) return null

      const header = JSON.parse(lines[0])
      if (header.type !== 'session' || !header.id) return null

      let sessionInfoTitle = ''
      let firstUserMessage = ''
      let messageCount = 0

      for (const line of lines.slice(1)) {
        try {
          const entry = JSON.parse(line)
          if (entry.type === 'session_info') {
            sessionInfoTitle = normalizeSessionTitle(entry.name || '')
          } else if (entry.type === 'message') {
            messageCount++
            if (!firstUserMessage && entry.message?.role === 'user') {
              firstUserMessage = normalizeSessionTitle(getMessageText(entry.message))
            }
          }
        } catch {
          // ignore malformed entries
        }
      }

      const stats = fs.statSync(filePath)
      const createdTime = header.timestamp ? new Date(header.timestamp).getTime() : stats.birthtimeMs
      const title = sessionInfoTitle || firstUserMessage || getFallbackSessionTitle(header.id)

      return {
        id: header.id,
        title,
        directory: header.cwd || latestCtx?.cwd || process.cwd(),
        time: {
          created: Number.isNaN(createdTime) ? stats.birthtimeMs : createdTime,
          updated: stats.mtimeMs,
        },
        summary: { deletions: 0, files: 0, additions: messageCount },
      }
    } catch {
      return null
    }
  }

  async function setRequestedModel(ctx: SwitchableExtensionContext, model: any) {
    if (!model?.providerID || !model?.modelID) return

    try {
      const targetModel = ctx.modelRegistry?.find(model.providerID, model.modelID)
      if (!targetModel) return

      const currentModel = ctx.model
      if (!currentModel || currentModel.id !== targetModel.id || currentModel.provider !== targetModel.provider) {
        console.log(`[PiAgentUi] Switching session model to ${targetModel.provider}:${targetModel.id}`)
        if (ctx.setModel) {
          await ctx.setModel(targetModel)
        } else {
          await pi.setModel(targetModel)
        }
      }
    } catch (err) {
      console.error('[PiAgentUi] Failed to set model:', err)
    }
  }

  async function sendUserMessageToRequestedSession(parsed: any): Promise<{ status: number; body: any }> {
    const requestedSessionId = parsed.sessionId
    const activeSessionId = getCurrentSessionId()

    if (!parsed.text) {
      return { status: 400, body: { error: 'Missing message text' } }
    }

    if (!requestedSessionId || requestedSessionId === activeSessionId) {
      if (latestCtx) {
        await setRequestedModel(latestCtx, parsed.model)
      }
      const p = pi.sendUserMessage(parsed.text) as any
      if (p && typeof p.catch === 'function') {
        p.catch((err: any) => {
          console.error('[PiAgentUi] Failed to send user message:', err)
        })
      }
      return { status: 202, body: { sessionID: activeSessionId } }
    }

    const sessionFile = getSessionFileForId(requestedSessionId)
    if (!sessionFile) {
      return { status: 404, body: { error: `Session not found: ${requestedSessionId}` } }
    }

    if (!latestCtx?.switchSession) {
      return { status: 501, body: { error: 'Pi session switching is not available in this runtime' } }
    }

    preserveServerForSessionSwitch = true
    let didSend = false
    try {
      const result = await latestCtx.switchSession(sessionFile, {
        withSession: async replacedCtx => {
          latestCtx = replacedCtx as SwitchableExtensionContext
          await setRequestedModel(latestCtx, parsed.model)
          if (typeof replacedCtx.sendUserMessage === 'function') {
            await replacedCtx.sendUserMessage(parsed.text)
            didSend = true
          }
        },
      })

      if (result.cancelled) {
        return { status: 409, body: { error: 'Session switch cancelled' } }
      }

      if (!didSend) {
        return { status: 501, body: { error: 'Pi session switching is not available in this runtime' } }
      }

      return { status: 202, body: { sessionID: requestedSessionId } }
    } finally {
      preserveServerForSessionSwitch = false
    }
  }

  function getSessionInfo(sessionId: string): any {
    const sessionFile = getSessionFileForId(sessionId)
    const metadata = sessionFile ? readSessionMetadata(sessionFile) : null

    return {
      id: sessionId,
      title: metadata?.title || getFallbackSessionTitle(sessionId),
      directory: metadata?.directory || latestCtx?.cwd || process.cwd(),
      time: metadata?.time || {
        created: Date.now(),
        updated: Date.now(),
      },
      status: { type: latestCtx && !latestCtx.isIdle() ? 'busy' : 'idle' },
      summary: metadata?.summary || { deletions: 0, files: 0, additions: 0 },
    }
  }

  function broadcastSessionUpdated(sessionId: string) {
    try {
      const sessionInfo = getSessionInfo(sessionId)
      broadcastSSE('session.updated', { info: sessionInfo })
    } catch (err) {
      console.error('[PiAgentUi] Failed to broadcast session.updated:', err)
    }
  }

  function broadcastSSE(type: string, properties: any) {
    const rawEvent = JSON.stringify({
      id: Math.random().toString(36).substring(2),
      time: Date.now(),
      directory: latestCtx?.cwd || 'global',
      payload: {
        type,
        properties,
      },
    })
    const payload = `data: ${rawEvent}\n\n`
    for (const res of sseClients) {
      try {
        res.write(payload)
      } catch {
        // ignore
      }
    }
  }

  function generateBearerToken(): string {
    return Array.from({ length: 4 }, () => Math.random().toString(36).substring(2)).join('-')
  }

  const settingsStore = createPiAgentUiSettingsStore(resolvePiAgentUiSettingsPaths())

  function getLocalSettings(): PiAgentUiLocalSettings {
    return settingsStore.getSettings()
  }

  function saveLocalSettings(settings: PiAgentUiLocalSettings) {
    settingsStore.saveSettings(settings)
  }

  function buildBrowserUrl(baseUrl: string | null): string | null {
    return baseUrl
  }

  function getNetworkAccessInfo() {
    const lanAccessEnabled = getLocalSettings().network?.lanAccessEnabled === true
    const port = localPort || 0
    const localUrl = port ? `http://127.0.0.1:${port}` : ''
    const lanUrls = port ? getLocalNetworkUrls(port) : []
    const primaryLanUrl = lanUrls[0] || null
    return {
      lanAccessEnabled,
      port,
      localUrl,
      lanUrls,
      primaryLanUrl,
      browserLanUrl: buildBrowserUrl(primaryLanUrl),
    }
  }

  function getEffectiveSttSettings(): StoredSttSettings {
    return {
      enabled: false,
      providerKind: 'openai-compatible',
      mode: 'file',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyRequired: false,
      transcriptionEndpoint: '/audio/transcriptions',
      transcriptionModel: 'gpt-4o-mini-transcribe',
      insertMode: 'append',
      ...getLocalSettings().stt,
    }
  }

  function sanitizeSttSettings(settings: StoredSttSettings = getEffectiveSttSettings()): SanitizedSttSettings {
    const effective = { ...getEffectiveSttSettings(), ...settings }
    const sanitized: SanitizedSttSettings = {
      enabled: effective.enabled === true,
      providerKind: effective.providerKind === 'openai' ? 'openai' : 'openai-compatible',
      mode: effective.mode === 'realtime' ? 'realtime' : 'file',
      baseUrl: effective.baseUrl || 'https://api.openai.com/v1',
      transcriptionEndpoint: effective.transcriptionEndpoint || '/audio/transcriptions',
      transcriptionModel: effective.transcriptionModel || 'gpt-4o-mini-transcribe',
      insertMode: effective.insertMode === 'replace' ? 'replace' : 'append',
      apiKeyRequired: effective.apiKeyRequired === true,
      apiKeyConfigured: typeof effective.apiKey === 'string' && effective.apiKey.length > 0,
    }
    if (effective.language) sanitized.language = effective.language
    return sanitized
  }

  async function readJsonBody(req: http.IncomingMessage): Promise<any> {
    return await new Promise((resolve, reject) => {
      let body = ''
      req.on('data', chunk => {
        body += chunk
      })
      req.on('end', () => {
        try {
          resolve(body.trim() ? JSON.parse(body) : {})
        } catch (error) {
          reject(error)
        }
      })
      req.on('error', reject)
    })
  }

  function updateSttSettings(update: any): { ok: true; settings: SanitizedSttSettings } | { ok: false; error: string } {
    const current = getLocalSettings()
    const existing = current.stt || {}
    const next: StoredSttSettings = { ...existing }

    if (update.enabled !== undefined) next.enabled = update.enabled === true
    if (update.providerKind !== undefined) {
      if (update.providerKind !== 'openai' && update.providerKind !== 'openai-compatible') {
        return { ok: false, error: 'Invalid providerKind' }
      }
      next.providerKind = update.providerKind
    }
    if (update.mode !== undefined) {
      if (update.mode !== 'file' && update.mode !== 'realtime') return { ok: false, error: 'Invalid mode' }
      next.mode = update.mode
    }
    if (update.baseUrl !== undefined) {
      if (typeof update.baseUrl !== 'string' || !validateSttBaseUrl(update.baseUrl)) {
        return { ok: false, error: 'Invalid baseUrl' }
      }
      next.baseUrl = update.baseUrl.replace(/\/+$/, '')
    }
    if (update.apiKeyRequired !== undefined) next.apiKeyRequired = update.apiKeyRequired === true
    if (update.transcriptionEndpoint !== undefined) {
      if (typeof update.transcriptionEndpoint !== 'string' || !update.transcriptionEndpoint.startsWith('/')) {
        return { ok: false, error: 'Invalid transcriptionEndpoint' }
      }
      next.transcriptionEndpoint = update.transcriptionEndpoint
    }
    if (update.transcriptionModel !== undefined) {
      if (typeof update.transcriptionModel !== 'string' || !update.transcriptionModel.trim()) {
        return { ok: false, error: 'Invalid transcriptionModel' }
      }
      next.transcriptionModel = update.transcriptionModel.trim()
    }
    if (update.language !== undefined) {
      if (update.language === null || update.language === '') delete next.language
      else if (typeof update.language === 'string') next.language = update.language.trim()
      else return { ok: false, error: 'Invalid language' }
    }
    if (update.insertMode !== undefined) {
      if (update.insertMode !== 'append' && update.insertMode !== 'replace')
        return { ok: false, error: 'Invalid insertMode' }
      next.insertMode = update.insertMode
    }
    if (Object.prototype.hasOwnProperty.call(update, 'apiKey')) {
      if (update.apiKey === null) delete next.apiKey
      else if (typeof update.apiKey === 'string' && update.apiKey.trim()) next.apiKey = update.apiKey.trim()
    }

    saveLocalSettings({ ...current, stt: next })
    return { ok: true, settings: sanitizeSttSettings(next) }
  }

  function getEffectiveTtsSettings(): StoredTtsSettings {
    return {
      enabled: false,
      providerKind: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyRequired: false,
      speechEndpoint: '/audio/speech',
      model: 'tts-1',
      voice: 'alloy',
      responseFormat: 'mp3',
      speed: 1,
      ...getLocalSettings().tts,
    }
  }

  function sanitizeTtsSettings(settings: StoredTtsSettings = getEffectiveTtsSettings()): SanitizedTtsSettings {
    const effective = { ...getEffectiveTtsSettings(), ...settings }
    return {
      enabled: effective.enabled === true,
      providerKind: effective.providerKind === 'openai' ? 'openai' : 'openai-compatible',
      baseUrl: effective.baseUrl || 'https://api.openai.com/v1',
      apiKeyRequired: effective.apiKeyRequired === true,
      speechEndpoint: effective.speechEndpoint || '/audio/speech',
      model: effective.model || 'tts-1',
      voice: effective.voice || 'alloy',
      responseFormat: isTtsResponseFormat(effective.responseFormat) ? effective.responseFormat : 'mp3',
      speed: typeof effective.speed === 'number' ? effective.speed : 1,
      apiKeyConfigured: typeof effective.apiKey === 'string' && effective.apiKey.length > 0,
    }
  }

  function isTtsResponseFormat(value: unknown): value is NonNullable<StoredTtsSettings['responseFormat']> {
    return (
      value === 'mp3' || value === 'opus' || value === 'aac' || value === 'flac' || value === 'wav' || value === 'pcm'
    )
  }

  function updateTtsSettings(update: any): { ok: true; settings: SanitizedTtsSettings } | { ok: false; error: string } {
    const current = getLocalSettings()
    const existing = current.tts || {}
    const next: StoredTtsSettings = { ...existing }

    if (update.enabled !== undefined) next.enabled = update.enabled === true
    if (update.providerKind !== undefined) {
      if (update.providerKind !== 'openai' && update.providerKind !== 'openai-compatible') {
        return { ok: false, error: 'Invalid providerKind' }
      }
      next.providerKind = update.providerKind
    }
    if (update.baseUrl !== undefined) {
      if (typeof update.baseUrl !== 'string' || !validateSttBaseUrl(update.baseUrl)) {
        return { ok: false, error: 'Invalid baseUrl' }
      }
      next.baseUrl = update.baseUrl.replace(/\/+$/, '')
    }
    if (update.apiKeyRequired !== undefined) next.apiKeyRequired = update.apiKeyRequired === true
    if (update.speechEndpoint !== undefined) {
      if (typeof update.speechEndpoint !== 'string' || !update.speechEndpoint.startsWith('/')) {
        return { ok: false, error: 'Invalid speechEndpoint' }
      }
      next.speechEndpoint = update.speechEndpoint
    }
    if (update.model !== undefined) {
      if (typeof update.model !== 'string' || !update.model.trim()) return { ok: false, error: 'Invalid model' }
      next.model = update.model.trim()
    }
    if (update.voice !== undefined) {
      if (typeof update.voice !== 'string' || !update.voice.trim()) return { ok: false, error: 'Invalid voice' }
      next.voice = update.voice.trim()
    }
    if (update.responseFormat !== undefined) {
      if (!isTtsResponseFormat(update.responseFormat)) return { ok: false, error: 'Invalid responseFormat' }
      next.responseFormat = update.responseFormat
    }
    if (update.speed !== undefined) {
      if (typeof update.speed !== 'number' || update.speed < 0.25 || update.speed > 4) {
        return { ok: false, error: 'Invalid speed' }
      }
      next.speed = update.speed
    }
    if (Object.prototype.hasOwnProperty.call(update, 'apiKey')) {
      if (update.apiKey === null) delete next.apiKey
      else if (typeof update.apiKey === 'string' && update.apiKey.trim()) next.apiKey = update.apiKey.trim()
    }

    saveLocalSettings({ ...current, tts: next })
    return { ok: true, settings: sanitizeTtsSettings(next) }
  }

  async function readRequestBuffer(req: http.IncomingMessage): Promise<Buffer> {
    return await new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  function readMultipartFormData(contentType: string | undefined, body: Buffer): FormData {
    const boundaryMatch = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/)
    const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
    if (!boundary) throw new Error('Missing multipart boundary')

    const form = new FormData()
    const rawBody = body.toString('latin1')
    for (const rawPart of rawBody.split(`--${boundary}`)) {
      const part = rawPart.replace(/^\r\n/, '')
      if (!part || part === '--\r\n' || part === '--') continue
      const headerEnd = part.indexOf('\r\n\r\n')
      if (headerEnd === -1) continue
      const rawHeaders = part.slice(0, headerEnd)
      const rawContent = part
        .slice(headerEnd + 4)
        .replace(/\r\n--$/, '')
        .replace(/\r\n$/, '')
      const disposition = rawHeaders.match(/content-disposition:([^\r\n]+)/i)?.[1] || ''
      const name = disposition.match(/name="([^"]+)"/)?.[1]
      if (!name) continue
      const filename = disposition.match(/filename="([^"]*)"/)?.[1]
      const mime = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream'
      if (filename !== undefined) {
        form.set(name, new File([Buffer.from(rawContent, 'latin1')], filename || 'audio.webm', { type: mime }))
      } else {
        form.set(name, rawContent)
      }
    }
    return form
  }

  async function transcribeAudio(req: http.IncomingMessage) {
    if (!isRequestBodySizeAllowed(req.headers['content-length'], 25 * 1024 * 1024)) {
      return { status: 413, body: { error: 'Audio upload too large' } }
    }

    const settings = getEffectiveSttSettings()
    if (!settings.enabled) return { status: 400, body: { error: 'STT is disabled' } }
    if (settings.apiKeyRequired && !settings.apiKey) {
      return { status: 400, body: { error: 'STT API key is not configured' } }
    }
    if (!validateSttBaseUrl(settings.baseUrl)) return { status: 400, body: { error: 'Invalid STT baseUrl' } }

    const startedAt = Date.now()
    const requestBody = await readRequestBuffer(req)
    const inputForm = readMultipartFormData(req.headers['content-type'], requestBody)
    const file = inputForm.get('file')
    if (!(file instanceof File)) return { status: 400, body: { error: 'Missing audio file' } }

    const providerForm = new FormData()
    providerForm.set('file', file)
    providerForm.set('model', settings.transcriptionModel || 'gpt-4o-mini-transcribe')
    if (settings.language) providerForm.set('language', settings.language)

    const baseUrl = (settings.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
    const endpoint = settings.transcriptionEndpoint || '/audio/transcriptions'
    const headers: Record<string, string> = {}
    if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`
    const providerRes = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: providerForm,
    })
    const providerText = await providerRes.text()
    let providerJson: any = {}
    try {
      providerJson = providerText ? JSON.parse(providerText) : {}
    } catch {
      providerJson = {}
    }
    if (!providerRes.ok) {
      return { status: 502, body: { error: providerJson.error?.message || 'STT provider request failed' } }
    }

    return {
      status: 200,
      body: {
        text: String(providerJson.text || ''),
        durationMs: Date.now() - startedAt,
        provider: settings.providerKind || 'openai-compatible',
        model: settings.transcriptionModel || 'gpt-4o-mini-transcribe',
      },
    }
  }

  async function synthesizeSpeech(req: http.IncomingMessage) {
    if (!isRequestBodySizeAllowed(req.headers['content-length'], 1024 * 1024)) {
      return {
        status: 413,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ error: 'TTS request too large' })),
      }
    }

    const settings = getEffectiveTtsSettings()
    if (!settings.enabled) {
      return {
        status: 400,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ error: 'TTS is disabled' })),
      }
    }
    if (settings.apiKeyRequired && !settings.apiKey) {
      return {
        status: 400,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ error: 'TTS API key is not configured' })),
      }
    }
    if (!validateSttBaseUrl(settings.baseUrl)) {
      return {
        status: 400,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ error: 'Invalid TTS baseUrl' })),
      }
    }

    const requestBody = await readJsonBody(req)
    const input = typeof requestBody.input === 'string' ? requestBody.input.trim() : ''
    if (!input) {
      return {
        status: 400,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ error: 'Missing input' })),
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`
    const baseUrl = (settings.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
    const endpoint = settings.speechEndpoint || '/audio/speech'
    const responseFormat = isTtsResponseFormat(settings.responseFormat) ? settings.responseFormat : 'mp3'
    const providerRes = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model || 'tts-1',
        input,
        voice: settings.voice || 'alloy',
        response_format: responseFormat,
        speed: typeof settings.speed === 'number' ? settings.speed : 1,
      }),
    })

    const body = Buffer.from(await providerRes.arrayBuffer())
    const contentType = providerRes.headers.get('Content-Type') || `audio/${responseFormat}`
    return { status: providerRes.status, contentType, body }
  }

  function handleStaticFile(req: http.IncomingMessage, res: http.ServerResponse, relativePath: string) {
    const staticDir = path.resolve(path.join(__dirname, '..', 'dist'))
    const targetFile = relativePath === '/' || relativePath === '' ? 'index.html' : relativePath

    if (!preventPathTraversal(staticDir, targetFile)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('403 Forbidden')
      return
    }

    const filePath = path.join(staticDir, targetFile)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // For static assets (e.g. .js, .css, .png), do NOT fallback to index.html
      const ext = path.extname(targetFile).toLowerCase()
      if (ext && ext !== '.html') {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('404 Not Found')
        return
      }

      // Fallback to index.html for React Router SPA behavior
      const indexPath = path.join(staticDir, 'index.html')
      if (fs.existsSync(indexPath)) {
        serveIndexHtml(indexPath, req, res)
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('404 Not Found')
      }
      return
    }

    if (targetFile === 'index.html') {
      serveIndexHtml(filePath, req, res)
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const mime = MIME_TYPES[ext] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': mime })
    fs.createReadStream(filePath).pipe(res)
  }

  function serveIndexHtml(filePath: string, req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      let content = fs.readFileSync(filePath, 'utf8')
      const host = req.headers.host || `127.0.0.1:${localPort}`
      const token = isLoopbackHost(host) ? JSON.stringify(localToken) : 'null'
      const bootDataScript = `
<script id="pi-boot-data">
  window.PI_BOOT_DATA = {
    baseUrl: "http://${host}",
    token: ${token}
  };
</script>
`
      // Inject boot script before closing head tag or at the beginning of head
      if (content.includes('</head>')) {
        content = content.replace('</head>', `${bootDataScript}</head>`)
      } else {
        content = bootDataScript + content
      }

      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      })
      res.end(content)
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('500 Internal Server Error')
    }
  }

  function checkAuth(req: http.IncomingMessage): boolean {
    const authHeader = req.headers.authorization
    if (validateBearerToken(authHeader, localToken)) return true

    const host = req.headers.host
    const origin = req.headers.origin as string | undefined
    const lanAccessEnabled = getLocalSettings().network?.lanAccessEnabled === true
    if (!lanAccessEnabled || isLoopbackHost(host)) return false

    return validateHostAndOriginForAccess(host, origin, true)
  }

  async function handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || ''

    if (url === '/global/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', pi: 'ready' }))
      return
    }

    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    if (url === '/global/event') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      const rawEvent = JSON.stringify({
        id: Math.random().toString(36).substring(2),
        time: Date.now(),
        directory: latestCtx?.cwd || 'global',
        payload: {
          type: 'server.connected',
          properties: {
            timestamp: Date.now(),
          },
        },
      })
      res.write(`data: ${rawEvent}\n\n`)

      const heartbeat = setInterval(() => {
        try {
          res.write(`: heartbeat ${Date.now()}\n\n`)
        } catch {
          clearInterval(heartbeat)
          sseClients.delete(res)
        }
      }, 25000)

      sseClients.add(res)
      req.on('close', () => {
        clearInterval(heartbeat)
        sseClients.delete(res)
      })
      return
    }

    const parsedUrl = new URL(url, 'http://localhost')
    const pathname = parsedUrl.pathname
    const method = req.method || 'GET'
    const pathParts = pathname.split('/').filter(Boolean)

    if (pathParts[0] === 'api') {
      if (pathParts[1] === 'network' && pathParts[2] === 'access') {
        if (method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(getNetworkAccessInfo()))
          return
        }

        if (method === 'POST') {
          let body = ''
          req.on('data', chunk => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const parsed = body.trim() ? JSON.parse(body) : {}
              const current = getLocalSettings()
              const next: PiAgentUiLocalSettings = {
                ...current,
                network: {
                  ...current.network,
                  lanAccessEnabled: parsed.lanAccessEnabled === true,
                },
              }
              saveLocalSettings(next)
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(getNetworkAccessInfo()))
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Bad Request' }))
            }
          })
          return
        }
      }

      if (pathParts[1] === 'settings' && pathParts[2] === 'stt') {
        if (method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(sanitizeSttSettings()))
          return
        }

        if (method === 'POST') {
          try {
            const update = await readJsonBody(req)
            const result = updateSttSettings(update)
            if (!result.ok) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: result.error }))
              return
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(result.settings))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Bad Request' }))
          }
          return
        }
      }

      if (pathParts[1] === 'settings' && pathParts[2] === 'tts') {
        if (method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(sanitizeTtsSettings()))
          return
        }

        if (method === 'POST') {
          try {
            const update = await readJsonBody(req)
            const result = updateTtsSettings(update)
            if (!result.ok) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: result.error }))
              return
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(result.settings))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Bad Request' }))
          }
          return
        }
      }

      if (pathParts[1] === 'extensions') {
        const targetDir = parsedUrl.searchParams.get('directory') || latestCtx?.cwd || process.cwd()

        if (method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(buildExtensionCatalog({ cwd: targetDir })))
          return
        }

        if (method === 'POST' && pathParts[2] === 'install') {
          try {
            const body = await readJsonBody(req)
            if (!body || typeof body.command !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Missing install command' }))
              return
            }
            const result = await executeExtensionInstallCommand(body.command, {
              cwd: typeof body.directory === 'string' ? body.directory : targetDir,
            })
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                source: result.source,
                scope: result.scope,
                reloadRequired: true,
                stdout: result.stdout,
                stderr: result.stderr,
              }),
            )
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to install extension' }))
          }
          return
        }

        if (method === 'DELETE' && pathParts[2] === 'package') {
          try {
            const body = await readJsonBody(req)
            if (!body || typeof body.source !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Missing extension source' }))
              return
            }
            const scope: ExtensionPackageScope = body.scope === 'project' ? 'project' : 'user'
            const result = await executeExtensionPackageRemoval(
              { source: body.source, scope },
              { cwd: typeof body.directory === 'string' ? body.directory : targetDir },
            )
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ source: body.source, scope, reloadRequired: true, ...result }))
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to remove extension' }))
          }
          return
        }
      }

      if (pathParts[1] === 'stt' && pathParts[2] === 'transcriptions' && method === 'POST') {
        try {
          const result = await transcribeAudio(req)
          res.writeHead(result.status, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result.body))
        } catch {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Failed to transcribe audio' }))
        }
        return
      }

      if (pathParts[1] === 'tts' && pathParts[2] === 'speech' && method === 'POST') {
        try {
          const result = await synthesizeSpeech(req)
          res.writeHead(result.status, { 'Content-Type': result.contentType })
          res.end(result.body)
        } catch {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Failed to synthesize speech' }))
        }
        return
      }

      if (pathParts[1] === 'skills' && method === 'GET') {
        const skills = parseSkillsFromSystemPrompt(latestCtx?.getSystemPrompt?.() ?? '', latestCtx?.cwd)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ skills, groups: countSkillsBySource(skills) }))
        return
      }

      if (pathParts[1] === 'mcp' && pathParts[2] === 'status' && method === 'GET') {
        const status = loadMcpStatus(latestCtx?.cwd)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(status))
        return
      }

      if (pathParts[1] === 'models' && method === 'GET') {
        const activeModel = latestCtx?.model as any
        const registryModels: any[] =
          latestCtx?.modelRegistry?.getAvailable() || latestCtx?.modelRegistry?.getAll() || []

        const mapModel = (m: any) => ({
          id: m.id,
          name: m.name || m.id,
          provider: m.provider,
          family: m.family ?? '',
          contextLimit: m.contextLimit ?? m.contextWindow ?? 128000,
          outputLimit: m.outputLimit ?? m.maxOutputTokens ?? m.maxTokens ?? 4096,
          supportsReasoning: m.supportsReasoning ?? m.reasoning ?? false,
          supportsImages: m.supportsImages ?? m.input?.includes('image') ?? false,
          supportsPdf: m.supportsPdf ?? false,
          supportsAudio: m.supportsAudio ?? false,
          supportsVideo: m.supportsVideo ?? false,
          supportsToolcall: m.supportsToolcall ?? true,
          variants: m.variants ?? [],
        })

        let models = registryModels.map(mapModel)

        if (activeModel) {
          const registryActiveModel = registryModels.find(
            (m: any) => m.id === activeModel.id && m.provider === activeModel.provider,
          )
          const activeMapped = mapModel({
            ...registryActiveModel,
            ...activeModel,
            contextLimit: activeModel.contextLimit ?? registryActiveModel?.contextLimit,
            contextWindow: activeModel.contextWindow ?? registryActiveModel?.contextWindow,
            outputLimit: activeModel.outputLimit ?? registryActiveModel?.outputLimit,
            maxOutputTokens: activeModel.maxOutputTokens ?? registryActiveModel?.maxOutputTokens,
            maxTokens: activeModel.maxTokens ?? registryActiveModel?.maxTokens,
            supportsReasoning: activeModel.supportsReasoning ?? registryActiveModel?.supportsReasoning,
            reasoning: activeModel.reasoning ?? registryActiveModel?.reasoning,
            supportsImages: activeModel.supportsImages ?? registryActiveModel?.supportsImages,
            input: activeModel.input ?? registryActiveModel?.input,
          })

          models = models.filter((m: any) => !(m.id === activeModel.id && m.provider === activeModel.provider))
          models.unshift(activeMapped)
        } else {
          if (models.length === 0) {
            models = [
              {
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                provider: 'google',
                family: '',
                contextLimit: 128000,
                outputLimit: 4096,
                supportsReasoning: true,
                supportsImages: true,
                supportsPdf: false,
                supportsAudio: false,
                supportsVideo: false,
                supportsToolcall: true,
                variants: [],
              },
            ]
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ models }))
        return
      }

      if (pathParts[1] === 'sessions') {
        // POST /api/sessions/abort
        if (pathParts.length === 3 && pathParts[2] === 'abort' && method === 'POST') {
          try {
            if (latestCtx) {
              latestCtx.abort()
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ status: 'aborted' }))
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Failed to abort session' }))
          }
          return
        }

        // POST /api/sessions
        if (pathParts.length === 2 && method === 'POST') {
          let body = ''
          req.on('data', chunk => {
            body += chunk
          })
          req.on('end', async () => {
            try {
              const parsed = body.trim() ? JSON.parse(body) : {}
              const result = await createAndSwitchToRealSession({
                directory: typeof parsed.directory === 'string' ? parsed.directory : undefined,
                title: typeof parsed.title === 'string' ? parsed.title : undefined,
                parentID: typeof parsed.parentID === 'string' ? parsed.parentID : undefined,
              })
              res.writeHead(result.status, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(result.body))
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Failed to create session' }))
            }
          })
          return
        }

        // GET /api/sessions/:sessionId/context
        if (pathParts.length === 4 && pathParts[3] === 'context' && method === 'GET') {
          const sessionId = pathParts[2]
          const activeSessionId = getCurrentSessionId()

          if (!latestCtx) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ available: false, sessionId, reason: 'runtime_unavailable' }))
            return
          }

          if (sessionId !== 'active-session' && activeSessionId && sessionId !== activeSessionId) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                available: false,
                sessionId,
                activeSessionId,
                reason: 'session_not_active',
              }),
            )
            return
          }

          const currentModel = latestCtx.model as
            | {
                id?: string
                modelID?: string
                name?: string
                provider?: string
                providerID?: string
                contextWindow?: number
                maxOutputTokens?: number
                maxTokens?: number
              }
            | undefined
          const modelContext = {
            providerID: currentModel?.providerID ?? currentModel?.provider,
            modelID: currentModel?.modelID ?? currentModel?.id,
            modelName: currentModel?.name,
            contextWindow: currentModel?.contextWindow ?? null,
            outputLimit: currentModel?.maxOutputTokens ?? currentModel?.maxTokens ?? null,
          }

          const usage = latestCtx.getContextUsage?.()
          if (!usage) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                available: false,
                sessionId: activeSessionId || sessionId,
                activeSessionId,
                ...modelContext,
                reason: 'context_usage_unavailable',
              }),
            )
            return
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              available: true,
              sessionId: activeSessionId || sessionId,
              activeSessionId,
              ...modelContext,
              tokens: usage.tokens,
              contextWindow: usage.contextWindow,
              percent: usage.percent,
            }),
          )
          return
        }

        const sessionDir = latestCtx?.sessionManager?.getSessionDir()
        if (!sessionDir || !fs.existsSync(sessionDir)) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify(pathParts.length === 4 && pathParts[3] === 'messages' ? { messages: [] } : { sessions: [] }),
          )
          return
        }

        // GET /api/sessions/:sessionId/messages
        if (pathParts.length === 4 && pathParts[3] === 'messages' && method === 'GET') {
          const sessionId = pathParts[2]
          try {
            const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.jsonl'))
            let matchedFile = files.find(f => f.endsWith(`_${sessionId}.jsonl`))

            if (!matchedFile && sessionId === 'active-session') {
              const activeSessionId = getCurrentSessionId()
              if (activeSessionId) {
                matchedFile = files.find(f => f.endsWith(`_${activeSessionId}.jsonl`))
              }
              if (!matchedFile && files.length > 0) {
                const filesWithTime = files.map(f => {
                  const p = path.join(sessionDir, f)
                  return { name: f, mtime: fs.statSync(p).mtimeMs }
                })
                filesWithTime.sort((a, b) => b.mtime - a.mtime)
                matchedFile = filesWithTime[0].name
              }
            }

            if (!matchedFile) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ messages: [] }))
              return
            }

            const filePath = path.join(sessionDir, matchedFile)
            const content = fs.readFileSync(filePath, 'utf8')
            const lines = content.trim().split('\n')

            const messageMap = new Map<string, any>()
            const toolCallMessageIds = new Map<string, string>()
            const orderedMessageIds: string[] = []
            let currentModel: { providerID: string; modelID: string } | undefined = undefined

            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const entry = JSON.parse(line)
                if (entry.type === 'model_change') {
                  currentModel = {
                    providerID: entry.provider,
                    modelID: entry.modelId,
                  }
                } else if (entry.type === 'message' && entry.message) {
                  const msgId = entry.id
                  const role = entry.message.role

                  if (isVisibleChatRole(role)) {
                    if (!messageMap.has(msgId)) {
                      const timestamp =
                        entry.message.timestamp || (entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now())
                      const msgObj = {
                        info: {
                          id: msgId,
                          sessionID: sessionId,
                          role: role,
                          time: {
                            created: timestamp,
                            completed: entry.timestamp ? new Date(entry.timestamp).getTime() : timestamp,
                          },
                          text: '',
                          model: currentModel,
                        },
                        parts: [] as any[],
                      }
                      messageMap.set(msgId, msgObj)
                      orderedMessageIds.push(msgId)
                    }

                    const msgObj = messageMap.get(msgId)!

                    if (Array.isArray(entry.message.content)) {
                      for (const block of entry.message.content) {
                        if (block.type === 'text') {
                          msgObj.parts.push({
                            id: msgId + '-text-' + msgObj.parts.length,
                            sessionID: sessionId,
                            messageID: msgId,
                            type: 'text',
                            text: block.text || '',
                          })
                        } else if (block.type === 'thinking') {
                          msgObj.parts.push({
                            id: msgId + '-reasoning-' + msgObj.parts.length,
                            sessionID: sessionId,
                            messageID: msgId,
                            type: 'reasoning',
                            text: block.thinking || '',
                          })
                        } else if (block.type === 'toolCall') {
                          if (block.id) toolCallMessageIds.set(block.id, msgId)
                          msgObj.parts.push({
                            id: block.id,
                            callID: block.id,
                            sessionID: sessionId,
                            messageID: msgId,
                            type: 'tool',
                            tool: block.name,
                            state: {
                              status: 'running',
                              input: block.arguments,
                            },
                          })
                        }
                      }
                    }
                  } else if (role === 'toolResult') {
                    const toolCallId = entry.message.toolCallId
                    const parentMsgId =
                      (toolCallId && toolCallMessageIds.get(toolCallId)) ||
                      (entry.parentId && messageMap.has(entry.parentId) ? entry.parentId : undefined)
                    if (parentMsgId && messageMap.has(parentMsgId)) {
                      const parentMsg = messageMap.get(parentMsgId)!
                      const toolPart = parentMsg.parts.find(
                        (p: any) => p.type === 'tool' && p.id === entry.message.toolCallId,
                      )

                      let outputText = ''
                      if (Array.isArray(entry.message.content)) {
                        outputText = entry.message.content
                          .filter((c: any) => c && c.type === 'text')
                          .map((c: any) => c.text)
                          .join('')
                      } else if (typeof entry.message.content === 'string') {
                        outputText = entry.message.content
                      }

                      if (toolPart) {
                        toolPart.state.status = entry.message.isError ? 'error' : 'completed'
                        toolPart.state.output = outputText
                        if (entry.message.isError) {
                          toolPart.state.error = outputText || 'Tool execution failed'
                        }
                      } else {
                        const callId = entry.message.toolCallId || 'tool-' + Math.random().toString(36).substring(2)
                        parentMsg.parts.push({
                          id: callId,
                          callID: callId,
                          sessionID: sessionId,
                          messageID: parentMsgId,
                          type: 'tool',
                          tool: entry.message.toolName || 'tool',
                          state: {
                            status: entry.message.isError ? 'error' : 'completed',
                            output: outputText,
                            error: entry.message.isError ? outputText || 'Tool execution failed' : undefined,
                          },
                        })
                      }
                    }
                  }
                }
              } catch {
                // ignore malformed line
              }
            }

            const messages = orderedMessageIds.map(msgId => {
              const msgObj = messageMap.get(msgId)!
              msgObj.info.text = msgObj.parts
                .filter((p: any) => p.type === 'text')
                .map((p: any) => p.text)
                .join('')
              return msgObj
            })

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ messages }))
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Failed to parse session messages' }))
          }
          return
        }

        // GET /api/sessions
        if (pathParts.length === 2 && method === 'GET') {
          try {
            const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.jsonl'))
            const sessions = []
            for (const file of files) {
              const metadata = readSessionMetadata(path.join(sessionDir, file))
              if (metadata) {
                sessions.push({
                  ...metadata,
                  status: { type: 'idle' },
                })
              }
            }

            sessions.sort((a, b) => b.time.updated - a.time.updated)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ sessions }))
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Failed to list sessions' }))
          }
          return
        }
      }

      if (pathParts[1] === 'messages' && pathParts[2] === 'send' && method === 'POST') {
        let body = ''
        req.on('data', chunk => {
          body += chunk
        })
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body)
            const result = await enqueueSessionSend(() => sendUserMessageToRequestedSession(parsed))
            res.writeHead(result.status, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                messageID: 'msg-' + Math.random().toString(36).substring(2) + '-' + Date.now(),
                ...result.body,
              }),
            )
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Bad Request' }))
          }
        })
        return
      }

      // GET /api/agents
      if (pathParts[1] === 'agents' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            agents: [
              { id: 'build', name: 'Build', description: 'Main coder agent', hidden: false, mode: 'chat' },
              { id: 'research', name: 'Research', description: 'Code researcher', hidden: false, mode: 'chat' },
            ],
          }),
        )
        return
      }

      // GET /api/permissions/list
      if (pathParts[1] === 'permissions' && pathParts[2] === 'list' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ permissions: [] }))
        return
      }

      // GET /api/questions/list
      if (pathParts[1] === 'questions' && pathParts[2] === 'list' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ questions: [] }))
        return
      }

      // GET /api/commands/list
      if (pathParts[1] === 'commands' && pathParts[2] === 'list' && method === 'GET') {
        const commands = getAvailableCommands(pi)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ commands, groups: countCommandsBySource(commands) }))
        return
      }

      if (pathParts[1] === 'vcs') {
        const targetDir = parsedUrl.searchParams.get('directory') || latestCtx?.cwd || process.cwd()

        async function sendGitAction(action: () => Promise<unknown>) {
          try {
            const body = await action()
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(body))
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Git operation failed' }))
          }
        }

        // GET /api/vcs/info
        if (pathParts[2] === 'info' && method === 'GET') {
          await sendGitAction(async () => {
            const status = await getGitStatus(targetDir)
            return {
              branch: status.branch || 'main',
              dirty: status.dirty,
              default_branch: 'main',
            }
          })
          return
        }

        // GET /api/vcs/status
        if (pathParts[2] === 'status' && method === 'GET') {
          await sendGitAction(() => getGitStatus(targetDir))
          return
        }

        // GET /api/vcs/branches
        if (pathParts[2] === 'branches' && method === 'GET') {
          await sendGitAction(() => listGitBranches(targetDir))
          return
        }

        if (pathParts[2] === 'checkout' && method === 'POST') {
          await sendGitAction(async () => checkoutGitBranch(targetDir, await readJsonBody(req)))
          return
        }

        if (pathParts[2] === 'branch' && method === 'POST') {
          await sendGitAction(async () => createGitBranch(targetDir, await readJsonBody(req)))
          return
        }

        if (pathParts[2] === 'stage' && method === 'POST') {
          await sendGitAction(async () => stageGitPaths(targetDir, await readJsonBody(req)))
          return
        }

        if (pathParts[2] === 'unstage' && method === 'POST') {
          await sendGitAction(async () => unstageGitPaths(targetDir, await readJsonBody(req)))
          return
        }

        if (pathParts[2] === 'commit' && method === 'POST') {
          await sendGitAction(async () => commitGitChanges(targetDir, await readJsonBody(req)))
          return
        }

        if (pathParts[2] === 'pull' && method === 'POST') {
          await sendGitAction(() => pullGitBranch(targetDir))
          return
        }

        if (pathParts[2] === 'push' && method === 'POST') {
          await sendGitAction(() => pushGitBranch(targetDir))
          return
        }
      }

      // GET /api/files/list
      if (pathParts[1] === 'files' && pathParts[2] === 'list' && method === 'GET') {
        try {
          const targetDir = parsedUrl.searchParams.get('directory') || latestCtx?.cwd || process.cwd()
          const subPath = parsedUrl.searchParams.get('path') || '.'

          if (!preventPathTraversal(targetDir, subPath)) {
            res.writeHead(403, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Forbidden' }))
            return
          }

          const resolvedPath = path.resolve(path.join(targetDir, subPath))
          if (!fs.existsSync(resolvedPath)) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ files: [] }))
            return
          }

          const entries = fs.readdirSync(resolvedPath, { withFileTypes: true })
          const files = entries.map(entry => {
            const fullEntryPath = path.join(resolvedPath, entry.name)
            const relPath = path.relative(targetDir, fullEntryPath).replace(/\\/g, '/')
            let size: number | undefined
            try {
              if (entry.isFile()) {
                size = fs.statSync(fullEntryPath).size
              }
            } catch {
              // ignore
            }
            return {
              name: entry.name,
              path: relPath,
              type: entry.isDirectory() ? 'directory' : 'file',
              size,
            }
          })

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ files }))
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Failed to list files' }))
        }
        return
      }
    }

    // Default error/unsupported response for other endpoints
    res.writeHead(501, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Feature Not Implemented in Pi MVP' }))
  }

  function listenOnAvailablePort(srv: http.Server, basePort: number, host: string): Promise<number> {
    function canReserveLoopbackPort(port: number): Promise<boolean> {
      return new Promise(resolve => {
        const probe = http.createServer()
        probe.once('error', () => resolve(false))
        probe.once('listening', () => {
          probe.close(() => resolve(true))
        })
        probe.listen(port, '127.0.0.1')
      })
    }

    return new Promise((resolve, reject) => {
      let currentPort = basePort

      async function tryListen() {
        if (host === '0.0.0.0' && !(await canReserveLoopbackPort(currentPort))) {
          currentPort++
          tryListen()
          return
        }

        const onError = (err: any) => {
          srv.removeListener('listening', onListening)
          if (err.code === 'EADDRINUSE') {
            currentPort++
            tryListen()
          } else {
            reject(err)
          }
        }

        const onListening = () => {
          srv.removeListener('error', onError)
          resolve(currentPort)
        }

        srv.once('error', onError)
        srv.once('listening', onListening)
        srv.listen(currentPort, host)
      }

      tryListen()
    })
  }

  function setWebLinkWidget(ctx: ExtensionContext) {
    if (!localPort) return

    try {
      ctx.ui.setWidget(
        'piagentui-link',
        ['\x1b[1;36mPiAgentUI Web:\x1b[0m \x1b[4;36mhttp://127.0.0.1:' + localPort + '\x1b[0m'],
        { placement: 'belowEditor' },
      )
    } catch (e) {
      console.error('[PiAgentUi] Failed to set widget:', e)
    }
  }

  function startServer(ctx: ExtensionContext) {
    latestCtx = ctx
    if (server) {
      setWebLinkWidget(ctx)
      return
    }

    localToken = generateBearerToken()

    server = http.createServer((req, res) => {
      const host = req.headers.host
      const origin = req.headers.origin as string | undefined

      if (!validateHostAndOriginForAccess(host, origin, getLocalSettings().network?.lanAccessEnabled === true)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' })
        res.end('403 Forbidden - Loopback Access Only')
        return
      }

      if (!isRequestBodySizeAllowed(req.headers['content-length'])) {
        res.writeHead(413, { 'Content-Type': 'text/plain' })
        res.end('413 Payload Too Large')
        return
      }

      const urlPath = req.url || ''
      if (urlPath.startsWith('/api/') || urlPath.startsWith('/global/')) {
        handleApiRequest(req, res).catch(() => {
          sendInternalServerError(res)
        })
      } else {
        handleStaticFile(req, res, urlPath)
      }
    })

    wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (request, socket, head) => {
      const host = request.headers.host
      if (!validateHostAndOriginForAccess(host, undefined, getLocalSettings().network?.lanAccessEnabled === true)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }

      // Upgrade WS safely
      wss!.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss!.emit('connection', ws, request)
      })
    })

    wss.on('connection', (ws: WebSocket) => {
      clients.add(ws)
      ws.send(JSON.stringify({ type: 'server.connected', properties: {} }))

      ws.on('close', () => {
        clients.delete(ws)
      })
      ws.on('error', () => {
        clients.delete(ws)
      })
    })

    // Listen on all interfaces so LAN access can be enabled dynamically; request validation remains closed by default.
    const DEFAULT_PORT = 58785
    listenOnAvailablePort(server, DEFAULT_PORT, '0.0.0.0')
      .then(port => {
        localPort = port
        console.log(`[PiAgentUi] Server listening at http://127.0.0.1:${localPort}`)

        // Expose dynamic web access URL below the editor/chat input in Pi Agent TUI
        setWebLinkWidget(ctx)

        // Write connection details to discovery file
        const homeDir = process.env.USERPROFILE || process.env.HOME || ''
        const piAgentDir = path.join(homeDir, '.pi', 'agent')
        const discoveryPath = path.join(piAgentDir, 'piagentui-port.json')
        try {
          if (!fs.existsSync(piAgentDir)) {
            fs.mkdirSync(piAgentDir, { recursive: true })
          }
          fs.writeFileSync(discoveryPath, JSON.stringify({ port: localPort, token: localToken }, null, 2), 'utf8')
          console.log(`[PiAgentUi] Wrote connection info to: ${discoveryPath}`)
        } catch (err) {
          console.error('[PiAgentUi] Failed to write discovery file:', err)
        }
      })
      .catch(err => {
        console.error('[PiAgentUi] Failed to listen on available port:', err)
      })
  }

  function stopServer() {
    if (latestCtx) {
      try {
        latestCtx.ui.setWidget('piagentui-link', undefined)
      } catch (e) {
        // ignore
      }
    }
    // Delete discovery file
    const homeDir = process.env.USERPROFILE || process.env.HOME || ''
    const discoveryPath = path.join(homeDir, '.pi', 'agent', 'piagentui-port.json')
    try {
      if (fs.existsSync(discoveryPath)) {
        fs.unlinkSync(discoveryPath)
      }
    } catch {
      // ignore
    }

    // End all SSE clients
    for (const res of sseClients) {
      try {
        res.end()
      } catch {
        /* ignore */
      }
    }
    sseClients.clear()
    createdParts.clear()

    if (wss) {
      for (const client of clients) {
        try {
          client.close()
        } catch {
          /* ignore */
        }
      }
      clients.clear()
      wss.close()
      wss = null
    }
    if (server) {
      server.close()
      server = null
    }
  }

  pi.on('session_start', async (_event, ctx) => {
    latestCtx = ctx
    startServer(ctx)

    const sessionId = ctx.sessionManager?.getSessionId()
    if (sessionId) {
      const sessionInfo = getSessionInfo(sessionId)
      broadcastSSE('session.created', { info: sessionInfo })
    }
  })

  pi.on('session_shutdown', async event => {
    if (preserveServerForSessionSwitch && event?.reason === 'resume') {
      return
    }
    stopServer()
  })

  // Event translation for global SSE subscription
  pi.on('agent_start', () => {
    const sessionID = getCurrentSessionId()
    broadcastSSE('session.status', { sessionID, status: { type: 'working' } })
    broadcastSessionUpdated(sessionID)
  })

  pi.on('agent_end', () => {
    const sessionID = getCurrentSessionId()
    broadcastSSE('session.status', { sessionID, status: { type: 'idle' } })
    broadcastSessionUpdated(sessionID)
  })

  pi.on('turn_end', () => {
    const sessionID = getCurrentSessionId()
    broadcastSSE('session.idle', { sessionID })
    broadcastSessionUpdated(sessionID)
  })

  pi.on('message_start', event => {
    const sessionID = getCurrentSessionId()
    const { message } = event
    const messageID = getMessageId(message)
    if (message.role === 'assistant') {
      lastAssistantMessageId = messageID
    }
    createdParts.clear()

    broadcastSSE('message.updated', {
      id: messageID,
      sessionID,
      role: message.role,
      time: {
        created: Date.now(),
      },
      text: '',
    })
  })

  pi.on('message_update', event => {
    const sessionID = getCurrentSessionId()
    const { assistantMessageEvent, message } = event
    const messageID = getMessageId(message)

    if (assistantMessageEvent.type === 'text_delta') {
      const partID = messageID + '-text'
      if (!createdParts.has(partID)) {
        broadcastSSE('message.part.updated', {
          id: partID,
          sessionID,
          messageID: messageID,
          type: 'text',
          text: '',
        })
        createdParts.add(partID)
      }
      broadcastSSE('message.part.delta', {
        sessionID,
        messageID: messageID,
        partID,
        field: 'text',
        delta: assistantMessageEvent.delta,
      })
    } else if (assistantMessageEvent.type === 'thinking_delta') {
      const partID = messageID + '-reasoning'
      if (!createdParts.has(partID)) {
        broadcastSSE('message.part.updated', {
          id: partID,
          sessionID,
          messageID: messageID,
          type: 'reasoning',
          text: '',
        })
        createdParts.add(partID)
      }
      broadcastSSE('message.part.delta', {
        sessionID,
        messageID: messageID,
        partID,
        field: 'reasoning',
        delta: assistantMessageEvent.delta,
      })
    }
  })

  pi.on('message_end', event => {
    const sessionID = getCurrentSessionId()
    const { message } = event
    if (!isVisibleChatRole(message?.role)) return
    broadcastSSE('message.updated', {
      id: getMessageId(message),
      sessionID,
      role: message.role,
      time: {
        created: (message as any).timestamp || Date.now(),
        completed: Date.now(),
      },
      text: getMessageText(message),
    })
    broadcastSessionUpdated(sessionID)
  })

  pi.on('tool_execution_start', event => {
    const sessionID = getCurrentSessionId()
    const messageID = lastAssistantMessageId || 'assistant-msg-id'
    broadcastSSE('message.part.updated', {
      id: event.toolCallId,
      callID: event.toolCallId,
      sessionID,
      messageID,
      type: 'tool',
      tool: event.toolName,
      state: {
        status: 'running',
        input: event.args,
      },
    })
  })

  pi.on('tool_execution_end', event => {
    const sessionID = getCurrentSessionId()
    const messageID = lastAssistantMessageId || 'assistant-msg-id'
    broadcastSSE('message.part.updated', {
      id: event.toolCallId,
      callID: event.toolCallId,
      sessionID,
      messageID,
      type: 'tool',
      tool: event.toolName,
      state: {
        status: event.isError ? 'error' : 'completed',
        output: event.result,
        error: event.isError ? String(event.result) : undefined,
      },
    })
  })
}
