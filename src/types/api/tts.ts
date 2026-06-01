export type TtsProviderKind = 'openai' | 'openai-compatible'
export type TtsResponseFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'

export interface TtsSettings {
  enabled: boolean
  providerKind: TtsProviderKind
  baseUrl: string
  apiKeyConfigured: boolean
  apiKeyRequired: boolean
  speechEndpoint: string
  model: string
  voice: string
  responseFormat: TtsResponseFormat
  speed: number
}

export interface UpdateTtsSettingsRequest {
  enabled?: boolean
  providerKind?: TtsProviderKind
  baseUrl?: string
  apiKey?: string | null
  apiKeyRequired?: boolean
  speechEndpoint?: string
  model?: string
  voice?: string
  responseFormat?: TtsResponseFormat
  speed?: number
}
