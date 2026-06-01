import { piClient } from './piClient'
import { serverStore, makeBasicAuthHeader } from '../store/serverStore'
import type { TtsSettings, UpdateTtsSettingsRequest } from '../types/api/tts'

export async function getTtsSettings(): Promise<TtsSettings> {
  return await piClient.get<TtsSettings>('/api/settings/tts')
}

export async function updateTtsSettings(settings: UpdateTtsSettingsRequest): Promise<TtsSettings> {
  return await piClient.post<TtsSettings>('/api/settings/tts', settings)
}

function buildSpeechHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = serverStore.getActiveToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
    return headers
  }

  const auth = serverStore.getActiveAuth?.()
  if (auth?.password) headers.Authorization = makeBasicAuthHeader(auth)
  return headers
}

export async function synthesizeSpeech(input: string): Promise<Blob> {
  const response = await fetch(`${serverStore.getActiveBaseUrl()}/api/tts/speech`, {
    method: 'POST',
    headers: buildSpeechHeaders(),
    body: JSON.stringify({ input }),
  })

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`)
  }

  return await response.blob()
}
