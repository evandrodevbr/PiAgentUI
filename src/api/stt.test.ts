import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSttSettings, transcribeAudio, updateSttSettings } from './stt'
import { piClient } from './piClient'
import { serverStore } from '../store/serverStore'

vi.mock('./piClient', () => ({
  piClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('../store/serverStore', () => ({
  serverStore: {
    getActiveBaseUrl: vi.fn(() => 'http://127.0.0.1:58785'),
    getActiveToken: vi.fn(() => 'token-123'),
  },
}))

describe('stt api', () => {
  beforeEach(() => {
    vi.mocked(piClient.get).mockReset()
    vi.mocked(piClient.post).mockReset()
    vi.mocked(serverStore.getActiveBaseUrl).mockReturnValue('http://127.0.0.1:58785')
    vi.mocked(serverStore.getActiveToken).mockReturnValue('token-123')
  })

  it('loads and updates redacted STT settings', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      enabled: true,
      providerKind: 'openai-compatible',
      mode: 'file',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyConfigured: true,
      apiKeyRequired: true,
      transcriptionEndpoint: '/audio/transcriptions',
      transcriptionModel: 'gpt-4o-mini-transcribe',
      insertMode: 'append',
    })
    vi.mocked(piClient.post).mockResolvedValue({
      enabled: true,
      providerKind: 'openai-compatible',
      mode: 'file',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyConfigured: true,
      apiKeyRequired: true,
      transcriptionEndpoint: '/audio/transcriptions',
      transcriptionModel: 'gpt-4o-mini-transcribe',
      language: 'pt',
      insertMode: 'append',
    })

    expect((await getSttSettings()).apiKeyConfigured).toBe(true)
    const updated = await updateSttSettings({ language: 'pt' })

    expect(piClient.get).toHaveBeenCalledWith('/api/settings/stt')
    expect(piClient.post).toHaveBeenCalledWith('/api/settings/stt', { language: 'pt' })
    expect(updated.language).toBe('pt')
  })

  it('uploads audio as multipart form data with bearer auth', async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            text: 'hello voice',
            durationMs: 123,
            provider: 'openai-compatible',
            model: 'gpt-4o-mini-transcribe',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    globalThis.fetch = fetchMock as typeof fetch
    try {
      const file = new File(['audio'], 'voice.webm', { type: 'audio/webm' })
      const result = await transcribeAudio(file)

      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:58785/api/stt/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer token-123' },
          body: expect.any(FormData),
        }),
      )
      expect(result.text).toBe('hello voice')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
