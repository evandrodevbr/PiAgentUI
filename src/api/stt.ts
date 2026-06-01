import { piClient } from './piClient'
import { serverStore } from '../store/serverStore'
import type { SttSettings, SttTranscriptionResponse, UpdateSttSettingsRequest } from '../types/api/stt'

export async function getSttSettings(): Promise<SttSettings> {
  return await piClient.get<SttSettings>('/api/settings/stt')
}

export async function updateSttSettings(settings: UpdateSttSettingsRequest): Promise<SttSettings> {
  return await piClient.post<SttSettings>('/api/settings/stt', settings)
}

function buildUploadHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const token = serverStore.getActiveToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
    return headers
  }

  const auth = serverStore.getActiveAuth?.()
  if (auth?.password) {
    headers.Authorization = 'Basic ' + btoa(`${auth.username}:${auth.password}`)
  }
  return headers
}

export async function transcribeAudio(file: Blob, filename = 'voice.webm'): Promise<SttTranscriptionResponse> {
  const baseUrl = serverStore.getActiveBaseUrl()
  const form = new FormData()
  form.set('file', file, filename)

  const response = await fetch(`${baseUrl}/api/stt/transcriptions`, {
    method: 'POST',
    headers: buildUploadHeaders(),
    body: form,
  })

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`)
  }

  return (await response.json()) as SttTranscriptionResponse
}
