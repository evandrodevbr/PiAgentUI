import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useVoiceTranscription } from './useVoiceTranscription'
import { getSttSettings, transcribeAudio } from '../api/stt'

vi.mock('../api/stt', () => ({
  getSttSettings: vi.fn(),
  transcribeAudio: vi.fn(),
}))

class MockMediaRecorder extends EventTarget {
  static isTypeSupported = vi.fn(() => true)
  state = 'inactive'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onstop: (() => void) | null = null

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) } as BlobEvent)
    void Promise.resolve().then(() => this.onstop?.())
  }
}

describe('useVoiceTranscription', () => {
  beforeEach(() => {
    vi.mocked(getSttSettings).mockReset()
    vi.mocked(transcribeAudio).mockReset()
    vi.mocked(getSttSettings).mockResolvedValue({
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
    vi.mocked(transcribeAudio).mockResolvedValue({
      text: 'hello voice',
      durationMs: 10,
      provider: 'openai-compatible',
      model: 'gpt-4o-mini-transcribe',
    })
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    })
    Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: MockMediaRecorder })
  })

  it('records audio, transcribes it, and calls the callback', async () => {
    const onTranscription = vi.fn()
    const { result } = renderHook(() => useVoiceTranscription({ onTranscription }))

    await waitFor(() => expect(result.current.settings?.enabled).toBe(true))
    await act(async () => {
      await result.current.startRecording()
    })
    expect(result.current.state).toBe('recording')

    await act(async () => {
      result.current.stopRecording()
    })

    await waitFor(() => expect(onTranscription).toHaveBeenCalledWith('hello voice', 'append'))
    expect(result.current.state).toBe('idle')
  })

  it('keeps the voice button available even when STT is not configured', async () => {
    vi.mocked(getSttSettings).mockResolvedValue({
      enabled: false,
      providerKind: 'openai-compatible',
      mode: 'file',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyConfigured: false,
      apiKeyRequired: true,
      transcriptionEndpoint: '/audio/transcriptions',
      transcriptionModel: 'gpt-4o-mini-transcribe',
      insertMode: 'append',
    })
    const { result } = renderHook(() => useVoiceTranscription({ onTranscription: vi.fn() }))

    await waitFor(() => expect(result.current.settings?.enabled).toBe(false))
    expect(result.current.isAvailable).toBe(true)

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toBe('Voice transcription is not configured')
  })

  it('starts recording for local OpenAI-compatible STT when no API key is required', async () => {
    vi.mocked(getSttSettings).mockResolvedValueOnce({
      enabled: true,
      providerKind: 'openai-compatible',
      mode: 'file',
      baseUrl: 'http://127.0.0.1:8022/v1',
      apiKeyConfigured: false,
      apiKeyRequired: false,
      transcriptionEndpoint: '/audio/transcriptions',
      transcriptionModel: 'deepdml/faster-whisper-large-v3-turbo-ct2',
      insertMode: 'append',
    })
    const { result } = renderHook(() => useVoiceTranscription({ onTranscription: vi.fn() }))

    await waitFor(() => expect(result.current.settings?.apiKeyRequired).toBe(false))
    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.state).toBe('recording')
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true })
  })

  it('reloads STT settings on record click after the initial settings request fails', async () => {
    vi.mocked(getSttSettings).mockRejectedValueOnce(new Error('server not ready')).mockResolvedValueOnce({
      enabled: true,
      providerKind: 'openai-compatible',
      mode: 'file',
      baseUrl: 'http://127.0.0.1:8022/v1',
      apiKeyConfigured: false,
      apiKeyRequired: false,
      transcriptionEndpoint: '/audio/transcriptions',
      transcriptionModel: 'deepdml/faster-whisper-large-v3-turbo-ct2',
      insertMode: 'append',
    })
    const { result } = renderHook(() => useVoiceTranscription({ onTranscription: vi.fn() }))

    await waitFor(() => expect(result.current.error).toBe('Voice transcription settings unavailable'))
    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.state).toBe('recording')
    expect(result.current.error).toBeNull()
    expect(getSttSettings).toHaveBeenCalledTimes(2)
  })

  it('enters error state when microphone permission fails', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new Error('denied'))
    const { result } = renderHook(() => useVoiceTranscription({ onTranscription: vi.fn() }))

    await waitFor(() => expect(result.current.settings?.enabled).toBe(true))
    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.state).toBe('error')
    expect(result.current.error).toBe('Microphone permission denied')
  })
})
