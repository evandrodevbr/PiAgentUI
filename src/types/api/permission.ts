export interface PermissionToolInfo {
  name: string
  args?: unknown
  callID?: string
}

export interface PermissionRequest {
  id: string
  sessionID: string
  permission: string
  patterns?: string[]
  description?: string
  tool?: PermissionToolInfo
  metadata?: any
  always?: boolean
}

export type PermissionReply = 'once' | 'always' | 'reject'

export interface QuestionOption {
  label: string
  value?: string
  description?: string
}

export interface QuestionInfo {
  question: string
  header?: string
  options?: QuestionOption[]
  multiSelect?: boolean
  multiple?: boolean
  custom?: boolean
}

export interface QuestionRequest {
  id: string
  sessionID: string
  questions: QuestionInfo[]
  tool?: PermissionToolInfo
}

export type QuestionAnswer = string[]
