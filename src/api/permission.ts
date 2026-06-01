// ============================================
// Permission & Question API Functions - Decoupled
// ============================================

import { piClient } from './piClient'
import { formatPathForApi } from '../utils/directoryUtils'
import type { ApiPermissionRequest, PermissionReply, ApiQuestionRequest, QuestionAnswer } from './types'

// ============================================
// Permission API
// ============================================

/**
 * 获取待处理的权限请求列表
 */
export async function getPendingPermissions(sessionId?: string, directory?: string): Promise<ApiPermissionRequest[]> {
  try {
    const q = `?directory=${encodeURIComponent(directory || '')}`
    const data = await piClient.get<{ permissions: ApiPermissionRequest[] }>(`/api/permissions/list${q}`)
    const permissions = data.permissions || []
    return sessionId ? permissions.filter(p => p.sessionID === sessionId) : permissions
  } catch {
    return []
  }
}

/**
 * 回复权限请求
 */
export async function replyPermission(
  requestId: string,
  reply: PermissionReply,
  message?: string,
  directory?: string,
  sessionId?: string,
): Promise<boolean> {
  try {
    if (sessionId) {
      await piClient.post('/api/permissions/respond', {
        sessionID: sessionId,
        permissionID: requestId,
        directory: formatPathForApi(directory),
        response: reply,
      })
      return true
    }

    await piClient.post('/api/permissions/reply', {
      requestID: requestId,
      directory: formatPathForApi(directory),
      reply,
      message,
    })
    return true
  } catch {
    return true
  }
}

// ============================================
// Question API
// ============================================

/**
 * 获取待处理的问题请求列表
 */
export async function getPendingQuestions(sessionId?: string, directory?: string): Promise<ApiQuestionRequest[]> {
  try {
    const q = `?directory=${encodeURIComponent(directory || '')}`
    const data = await piClient.get<{ questions: ApiQuestionRequest[] }>(`/api/questions/list${q}`)
    const questions = data.questions || []
    return sessionId ? questions.filter(q => q.sessionID === sessionId) : questions
  } catch {
    return []
  }
}

/**
 * 回复问题请求
 */
export async function replyQuestion(
  requestId: string,
  answers: QuestionAnswer[],
  directory?: string,
): Promise<boolean> {
  try {
    await piClient.post('/api/questions/reply', {
      requestID: requestId,
      directory: formatPathForApi(directory),
      answers,
    })
    return true
  } catch {
    return true
  }
}

/**
 * 拒绝问题请求
 */
export async function rejectQuestion(requestId: string, directory?: string): Promise<boolean> {
  try {
    await piClient.post('/api/questions/reject', {
      requestID: requestId,
      directory: formatPathForApi(directory),
    })
    return true
  } catch {
    return true
  }
}
