export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | string

export interface ServerConfig {
  host?: string
  port?: number
}

export interface PermissionActionConfig {
  approve?: string[]
  ask?: string[]
  reject?: string[]
}

export interface PermissionObjectConfig {
  [key: string]: PermissionActionConfig
}

export interface PermissionRuleConfig {
  rules?: PermissionObjectConfig
}

export interface PermissionConfig {
  global?: PermissionRuleConfig
}

export interface AgentConfig {
  active?: boolean
}

export interface ProviderConfig {
  apiKey?: string
}

export interface LayoutConfig {
  [key: string]: any
}

export interface Config {
  logLevel?: LogLevel
  server?: ServerConfig
  permission?: PermissionConfig
  agents?: Record<string, AgentConfig>
  providers?: Record<string, ProviderConfig>
  layout?: LayoutConfig
  models?: Record<string, any>
}

export type { McpLocalConfig, McpOAuthConfig, McpRemoteConfig } from './mcp'
