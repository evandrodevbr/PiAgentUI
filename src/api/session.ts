// ============================================
// Session API Functions
// ============================================

import { piClient } from './piClient'
import { formatPathForApi } from '../utils/directoryUtils'
import type { ApiSession, SessionListParams, FileDiff } from './types'
import type { SessionStatusMap } from '../types/api/session'

export interface ApiSessionContextUsage {
  available: boolean
  sessionId?: string
  activeSessionId?: string
  tokens?: number | null
  contextWindow?: number | null
  percent?: number | null
  providerID?: string
  modelID?: string
  modelName?: string
  outputLimit?: number | null
  reason?: 'runtime_unavailable' | 'session_not_active' | 'context_usage_unavailable' | string
}
import type { TodoItem } from '../types/api/event'

function fallbackSessionTitle(sessionId?: string): string {
  return sessionId ? `Session ${sessionId.slice(0, 8)}` : 'Untitled Session'
}

// ============================================
// Session Status & Diff
// ============================================

export async function getSessionStatus(_directory?: string): Promise<SessionStatusMap> {
  return {}
}

export async function getSessionDiff(
  _sessionId: string,
  _directory?: string,
  _messageId?: string,
): Promise<FileDiff[]> {
  return []
}

export async function getLastTurnDiff(_sessionId: string, _directory?: string): Promise<FileDiff[]> {
  return []
}

export async function getSessionContextUsage(sessionId: string): Promise<ApiSessionContextUsage> {
  return await piClient.get<ApiSessionContextUsage>(`/api/sessions/${encodeURIComponent(sessionId)}/context`)
}

// ============================================
// Session CRUD
// ============================================

export async function getSessions(params: SessionListParams = {}): Promise<ApiSession[]> {
  try {
    const data = await piClient.get<{ sessions: ApiSession[] }>('/api/sessions')
    return data.sessions || []
  } catch {
    return [
      {
        id: 'active-session',
        title: fallbackSessionTitle('active-session'),
        directory: formatPathForApi(params.directory) ?? '',
        time: { created: Date.now(), updated: Date.now() },
        status: { type: 'idle' },
        summary: { deletions: 0, files: 0, additions: 0 },
      },
    ]
  }
}

export async function getSession(sessionId: string, directory?: string): Promise<ApiSession> {
  return {
    id: sessionId,
    title: fallbackSessionTitle(sessionId),
    directory: formatPathForApi(directory) ?? '',
    time: { created: Date.now(), updated: Date.now() },
    status: { type: 'idle' },
    summary: { deletions: 0, files: 0, additions: 0 },
  }
}

export async function createSession(
  params: {
    directory?: string
    title?: string
    parentID?: string
  } = {},
): Promise<ApiSession> {
  try {
    return await piClient.post<ApiSession>('/api/sessions', params)
  } catch {
    return {
      id: 'active-session',
      title: params.title || fallbackSessionTitle('active-session'),
      directory: formatPathForApi(params.directory) ?? '',
      time: { created: Date.now(), updated: Date.now() },
      status: { type: 'idle' },
      summary: { deletions: 0, files: 0, additions: 0 },
    }
  }
}

export async function updateSession(
  sessionId: string,
  params: { title?: string; time?: { archived?: number } },
  directory?: string,
): Promise<ApiSession> {
  return {
    id: sessionId,
    title: params.title || fallbackSessionTitle(sessionId),
    directory: formatPathForApi(directory) ?? '',
    time: { created: Date.now(), updated: Date.now() },
    status: { type: 'idle' },
    summary: { deletions: 0, files: 0, additions: 0 },
  }
}

export async function deleteSession(_sessionId: string, _directory?: string): Promise<boolean> {
  return true
}

// ============================================
// Session Actions
// ============================================

export async function abortSession(sessionId: string, directory?: string): Promise<boolean> {
  try {
    await piClient.post('/api/sessions/abort', { sessionId, directory })
    return true
  } catch {
    return true
  }
}

export async function revertMessage(
  sessionId: string,
  _messageId: string,
  _partId?: string,
  directory?: string,
): Promise<ApiSession> {
  return {
    id: sessionId,
    title: fallbackSessionTitle(sessionId),
    directory: formatPathForApi(directory) ?? '',
    time: { created: Date.now(), updated: Date.now() },
    status: { type: 'idle' },
    summary: { deletions: 0, files: 0, additions: 0 },
  }
}

export async function unrevertSession(sessionId: string, directory?: string): Promise<ApiSession> {
  return {
    id: sessionId,
    title: fallbackSessionTitle(sessionId),
    directory: formatPathForApi(directory) ?? '',
    time: { created: Date.now(), updated: Date.now() },
    status: { type: 'idle' },
    summary: { deletions: 0, files: 0, additions: 0 },
  }
}

export async function shareSession(sessionId: string, directory?: string): Promise<ApiSession> {
  return {
    id: sessionId,
    title: fallbackSessionTitle(sessionId),
    directory: formatPathForApi(directory) ?? '',
    time: { created: Date.now(), updated: Date.now() },
    status: { type: 'idle' },
    summary: { deletions: 0, files: 0, additions: 0 },
  }
}

export async function unshareSession(sessionId: string, directory?: string): Promise<ApiSession> {
  return {
    id: sessionId,
    title: fallbackSessionTitle(sessionId),
    directory: formatPathForApi(directory) ?? '',
    time: { created: Date.now(), updated: Date.now() },
    status: { type: 'idle' },
    summary: { deletions: 0, files: 0, additions: 0 },
  }
}

export async function forkSession(sessionId: string, _messageId?: string, directory?: string): Promise<ApiSession> {
  return {
    id: sessionId,
    title: fallbackSessionTitle(sessionId),
    directory: formatPathForApi(directory) ?? '',
    time: { created: Date.now(), updated: Date.now() },
    status: { type: 'idle' },
    summary: { deletions: 0, files: 0, additions: 0 },
  }
}

export async function summarizeSession(
  _sessionId: string,
  _params: { providerID: string; modelID: string; auto?: boolean },
  _directory?: string,
): Promise<boolean> {
  return true
}

export async function getSessionChildren(_sessionId: string, _directory?: string): Promise<ApiSession[]> {
  return []
}

export type ApiTodo = TodoItem

export async function getSessionTodos(_sessionId: string, _directory?: string): Promise<ApiTodo[]> {
  return []
}
