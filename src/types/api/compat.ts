// ============================================
// Owned Compatibility Types (DTOs)
// mimic the structures of @opencode-ai/sdk/v2/client
// ============================================

export type SessionStatus =
  | { type: 'idle' }
  | { type: 'running'; attempt?: number; message?: string; next?: string }
  | { type: 'busy' }
  | { type: 'error'; error?: string }
  | { type: 'retry'; attempt: number; message: string; next: number }

export interface SessionSummary {
  title?: string
  category?: string
  difficulty?: string
  tokens?: number
  cost?: number
  deletions: number
  files: number
  additions: number
}

export interface SessionShare {
  active?: boolean
  url?: string
  expiresAt?: string
}

export interface SessionRevert {
  canRevert?: boolean
  lastCommit?: string
  messageID?: string
  diffs?: string
  partID?: string
  snapshot?: string
  diff?: string
}

export interface Session {
  id: string
  title: string
  directory: string
  time: {
    created: number
    updated: number
  }
  status?: SessionStatus
  summary?: SessionSummary
  share?: SessionShare
  revert?: SessionRevert
  parentID?: string
}

export interface MessageSummary {
  title?: string
  difficulty?: string
  additions?: number
  deletions?: number
  files?: number
  diffs?: any[]
}

export interface UserMessage {
  id: string
  sessionID: string
  role: 'user'
  time: {
    created: number
    completed?: number
  }
  text?: string
  summary?: MessageSummary | boolean
  agent?: string
  model?: { providerID: string; modelID: string } | string
  path?: string
  cost?: number
  tokens?: any
}

export interface AssistantMessage {
  id: string
  sessionID: string
  role: 'assistant'
  time: {
    created: number
    completed?: number
  }
  text?: string
  summary?: MessageSummary | boolean
  modelID?: string
  providerID?: string
  parentID?: string
  mode?: string
  agent?: string
  model?: { providerID: string; modelID: string } | string
  path?: { cwd: string; root: string } | string
  cost?: number
  tokens?: any
}

export type Message = UserMessage | AssistantMessage

export interface TextPart {
  id: string
  sessionID: string
  messageID: string
  type: 'text'
  text: string
  synthetic?: boolean
}

export interface ReasoningPart {
  id: string
  sessionID: string
  messageID: string
  type: 'reasoning'
  text: string
}

export interface ToolState {
  status: 'pending' | 'running' | 'completed' | 'error'
  input?: unknown
  output?: unknown
  error?: string
}

export interface ToolPart {
  id: string
  sessionID: string
  messageID: string
  type: 'tool'
  tool: string
  state: ToolState
}

export interface FileSource {
  type?: string
  path?: string
  text?: {
    value: string
    start?: number
    end?: number
  }
}

export interface FilePart {
  id: string
  sessionID: string
  messageID: string
  type: 'file'
  filename?: string
  mime?: string
  url?: string
  source?: FileSource
}

export interface AgentPart {
  id?: string
  sessionID?: string
  messageID?: string
  type: 'agent'
  name: string
  source?: {
    value: string
    start?: number
    end?: number
  }
}

export interface StepStartPart {
  id: string
  sessionID: string
  messageID: string
  type: 'step-start'
}

export interface StepFinishPart {
  id: string
  sessionID: string
  messageID: string
  type: 'step-finish'
}

export interface SnapshotPart {
  id: string
  sessionID: string
  messageID: string
  type: 'snapshot'
  snapshotID?: string
}

export interface PatchPart {
  id: string
  sessionID: string
  messageID: string
  type: 'patch'
  patch?: string
}

export interface SubtaskPart {
  id: string
  sessionID: string
  messageID: string
  type: 'subtask'
  subtaskID?: string
}

export interface RetryPart {
  id: string
  sessionID: string
  messageID: string
  type: 'retry'
  retryCount?: number
}

export interface CompactionPart {
  id: string
  sessionID: string
  messageID: string
  type: 'compaction'
  text?: string
}

export type Part =
  | TextPart
  | ReasoningPart
  | ToolPart
  | FilePart
  | AgentPart
  | StepStartPart
  | StepFinishPart
  | SnapshotPart
  | PatchPart
  | SubtaskPart
  | RetryPart
  | CompactionPart

export interface MessageWithParts {
  info: Message
  parts: Part[]
}

export interface Model {
  id: string
  name: string
  provider: string
  contextWindow?: number
  maxOutputTokens?: number
}

export interface Project {
  id: string
  name: string
  directory?: string
  path?: string
  icon?: {
    url?: string
    override?: string
    color?: string
  }
  commands?: string[]
  vcs?: any
  worktree?: any
}

export interface Path {
  home: string
  cwd?: string
  path?: string
  directory?: string
}
