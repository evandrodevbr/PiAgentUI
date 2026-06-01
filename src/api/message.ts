// ============================================
// Message API Functions
// ============================================

import { piClient } from './piClient'
import { formatPathForApi } from '../utils/directoryUtils'
import type {
  ApiMessageWithParts,
  ApiAgentPart,
  ApiTextPart,
  ApiFilePart,
  Attachment,
  RevertedMessage,
  SendMessageParams,
  SendMessageResponse,
} from './types'

type UserContentSource = {
  parts: Array<
    | ApiTextPart
    | ApiFilePart
    | ApiAgentPart
    | {
        type: string
      }
  >
}

function isTextUserContentPart(part: UserContentSource['parts'][number]): part is ApiTextPart {
  return part.type === 'text' && 'text' in part
}

function isFileUserContentPart(part: UserContentSource['parts'][number]): part is ApiFilePart {
  return part.type === 'file' && 'mime' in part && 'url' in part
}

function isAgentUserContentPart(part: UserContentSource['parts'][number]): part is ApiAgentPart {
  return part.type === 'agent' && 'name' in part
}

// ============================================
// Message Query
// ============================================

/**
 * 获取 session 的消息列表
 */
export async function getSessionMessages(
  sessionId: string,
  limit?: number,
  directory?: string,
): Promise<ApiMessageWithParts[]> {
  try {
    const data = await piClient.get<{ messages: ApiMessageWithParts[] }>(
      `/api/sessions/${sessionId}/messages?directory=${formatPathForApi(directory)}&limit=${limit || ''}`
    )
    return data.messages || []
  } catch {
    return []
  }
}

/**
 * 获取 session 的消息数量
 */
export async function getSessionMessageCount(sessionId: string): Promise<number> {
  const messages = await getSessionMessages(sessionId)
  return messages.length
}

// ============================================
// Message Content Extraction
// ============================================

/**
 * 从 API 消息中提取用户消息内容（文本+附件）
 */
export function extractUserMessageContent(message: UserContentSource): RevertedMessage {
  const { parts } = message

  const textParts = parts.filter((part): part is ApiTextPart => isTextUserContentPart(part) && !part.synthetic)
  const text = textParts.map(p => p.text).join('\n')

  const attachments: Attachment[] = []

  const getSourcePath = (source: ApiFilePart['source']): string | undefined => {
    if (!source || !('path' in source)) return undefined
    return source.path
  }

  for (const part of parts) {
    if (isFileUserContentPart(part)) {
      const isFolder = part.mime === 'application/x-directory'
      const sourcePath = getSourcePath(part.source)
      attachments.push({
        id: part.id || crypto.randomUUID(),
        type: isFolder ? 'folder' : 'file',
        displayName: part.filename || sourcePath || 'file',
        url: part.url,
        mime: part.mime,
        relativePath: sourcePath,
        textRange: part.source?.text
          ? {
              value: part.source.text.value,
              start: part.source.text.start ?? 0,
              end: part.source.text.end ?? 0,
            }
          : undefined,
      })
    } else if (isAgentUserContentPart(part)) {
      attachments.push({
        id: part.id || crypto.randomUUID(),
        type: 'agent',
        displayName: part.name,
        agentName: part.name,
        textRange: part.source
          ? {
              value: part.source.value,
              start: part.source.start ?? 0,
              end: part.source.end ?? 0,
            }
          : undefined,
      })
    }
  }

  return { text, attachments }
}

// ============================================
// Send Message
// ============================================

/**
 * 同步发送消息（等待完成）
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
  return await piClient.post<SendMessageResponse>('/api/messages/send', {
    sessionId: params.sessionId,
    text: params.text,
    model: params.model,
    directory: params.directory,
  })
}

/**
 * 异步发送消息 — 立即返回, AI 响应通过 SSE/WS 推送
 */
export async function sendMessageAsync(params: SendMessageParams): Promise<void> {
  await piClient.post('/api/messages/send', {
    sessionId: params.sessionId,
    text: params.text,
    model: params.model,
    directory: params.directory,
  })
}
