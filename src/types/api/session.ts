import type {
  Session as CompatSession,
  SessionStatus as CompatSessionStatus,
  SessionSummary as CompatSessionSummary,
  SessionShare as CompatSessionShare,
  SessionRevert as CompatSessionRevert,
} from './compat'

export type SessionStatus = CompatSessionStatus

export type SessionStatusMap = Record<string, SessionStatus>

export type SessionSummary = CompatSessionSummary

export type SessionShare = CompatSessionShare

export type SessionRevert = CompatSessionRevert

export type Session = CompatSession

export interface SessionListParams {
  directory?: string
  roots?: boolean
  start?: number
  search?: string
  limit?: number
}

export interface SessionCreateParams {
  title?: string
  directory?: string
}

export interface SessionUpdateParams {
  title?: string
  summary?: SessionSummary
}

export interface SessionForkParams {
  messageID?: string
  directory?: string
}
