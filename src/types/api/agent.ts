export type AgentMode = 'chat' | 'code' | 'command' | string

export type AgentPermission = string

export interface Agent {
  id?: string
  name: string
  description?: string
  hidden?: boolean
  mode?: AgentMode
  permission?: AgentPermission[]
  color?: string
  options?: any
  model?: string
}
