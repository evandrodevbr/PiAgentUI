import type { Session, Model } from '../types/api/compat'

export interface SessionListResponse {
  sessions: Session[]
}

export interface SessionCreateRequest {
  title?: string
  directory?: string
}

export interface SessionUpdateRequest {
  title?: string
}

export interface SessionForkRequest {
  messageID?: string
  directory?: string
}

export interface SendMessageRequest {
  sessionId: string
  text: string
  model?: { providerID: string; modelID: string }
  directory?: string
}

export interface SendMessageResponse {
  messageID: string
  sessionID: string
}

export interface ModelsResponse {
  models: Model[]
}

export interface PartDeltaPayload {
  sessionID: string
  messageID: string
  partID: string
  field: 'text' | 'reasoning' | 'tool'
  delta: string
}

export interface PiGlobalEvent {
  directory?: string
  payload: {
    type: string
    properties: unknown
  }
}
