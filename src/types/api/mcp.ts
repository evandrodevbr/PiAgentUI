export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPStatus {
  status: 'connected' | 'configured' | 'disabled' | 'failed' | 'needs_auth' | 'needs_client_registration' | string
  transport?: 'stdio' | 'http' | 'sse' | 'unknown'
  source?: 'global' | 'project' | 'other'
  description?: string
  command?: string
  args?: string[]
  url?: string
  directTools?: boolean
  lifecycle?: string
  resources?: MCPResource[]
  error?: string
  authorizationUrl?: string
}

export interface MCPStatusResponse {
  servers: Record<string, MCPStatus>
  configPaths?: string[]
}

export interface McpLocalConfig {
  type: 'local'
  command: string
  args?: string[] | string
  env?: Record<string, string>
}

export interface McpOAuthConfig {
  clientId: string
  clientSecret: string
  authorizeUrl: string
  tokenUrl: string
  scopes?: string[]
}

export interface McpRemoteConfig {
  type: 'remote'
  url: string
}

export type McpServerConfig = McpLocalConfig | McpRemoteConfig

export interface MCPStatusConnected extends MCPStatus {
  status: 'connected'
}
export interface MCPStatusDisabled extends MCPStatus {
  status: 'disabled'
}
export interface MCPStatusFailed extends MCPStatus {
  status: 'failed'
  error: string
}
export interface MCPStatusNeedsAuth extends MCPStatus {
  status: 'needs_auth'
  authorizationUrl: string
}
export interface MCPStatusNeedsClientRegistration extends MCPStatus {
  status: 'needs_client_registration'
  error: string
}
