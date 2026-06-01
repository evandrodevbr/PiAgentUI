export type SttMode = 'file' | 'realtime'
export type SttProviderKind = 'openai' | 'openai-compatible'
export type SttInsertMode = 'append' | 'replace'

export interface SttSettings {
  enabled: boolean
  providerKind: SttProviderKind
  mode: SttMode
  baseUrl: string
  apiKeyConfigured: boolean
  apiKeyRequired: boolean
  transcriptionEndpoint: string
  transcriptionModel: string
  language?: string
  insertMode: SttInsertMode
}

export interface UpdateSttSettingsRequest {
  enabled?: boolean
  providerKind?: SttProviderKind
  mode?: SttMode
  baseUrl?: string
  apiKey?: string | null
  apiKeyRequired?: boolean
  transcriptionEndpoint?: string
  transcriptionModel?: string
  language?: string | null
  insertMode?: SttInsertMode
}

export interface SttTranscriptionResponse {
  text: string
  durationMs: number
  provider: SttProviderKind
  model: string
}
