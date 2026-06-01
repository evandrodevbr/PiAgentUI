import type { Model as CompatModel } from './compat'

export type ModelIOCapabilities = {
  text?: boolean
  image?: boolean
  audio?: boolean
  video?: boolean
}

export type ModelCapabilities = {
  input?: ModelIOCapabilities
  output?: ModelIOCapabilities
  thinking?: boolean
  web?: boolean
}

export type ModelLimit = {
  contextWindow?: number
  maxOutputTokens?: number
}

export type ModelStatus = {
  active: boolean
  configured: boolean
  error?: string
}

export type Model = CompatModel

export interface Provider {
  id: string
  name: string
  models: Model[]
  auth?: {
    method?: 'apikey' | 'oauth'
    authorization?: {
      configured: boolean
      error?: string
    }
  }
}

export interface ProvidersResponse {
  providers: Provider[]
  default?: Record<string, string>
}

export type ProviderAuthMethod = 'apikey' | 'oauth'

export interface ProviderAuthAuthorization {
  configured: boolean
  error?: string
}
