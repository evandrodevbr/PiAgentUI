import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VoiceInputButton } from './VoiceInputButton'
import { useVoiceTranscription } from '../../../hooks/useVoiceTranscription'

vi.mock('../../../hooks/useVoiceTranscription', () => ({
  useVoiceTranscription: vi.fn(),
}))

describe('VoiceInputButton', () => {
  it('starts recording when available', () => {
    const startRecording = vi.fn()
    vi.mocked(useVoiceTranscription).mockReturnValue({
      state: 'idle',
      settings: null,
      error: null,
      isAvailable: true,
      startRecording,
      stopRecording: vi.fn(),
      resetError: vi.fn(),
    })

    render(<VoiceInputButton onTranscription={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start voice recording' }))

    expect(startRecording).toHaveBeenCalled()
  })

  it('retries recording when the previous click left an error', () => {
    const startRecording = vi.fn()
    const resetError = vi.fn()
    vi.mocked(useVoiceTranscription).mockReturnValue({
      state: 'error',
      settings: null,
      error: 'Voice transcription settings unavailable',
      isAvailable: true,
      startRecording,
      stopRecording: vi.fn(),
      resetError,
    })

    render(<VoiceInputButton onTranscription={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Voice transcription settings unavailable' }))

    expect(startRecording).toHaveBeenCalled()
    expect(resetError).not.toHaveBeenCalled()
  })

  it('stops recording when active', () => {
    const stopRecording = vi.fn()
    vi.mocked(useVoiceTranscription).mockReturnValue({
      state: 'recording',
      settings: null,
      error: null,
      isAvailable: true,
      startRecording: vi.fn(),
      stopRecording,
      resetError: vi.fn(),
    })

    render(<VoiceInputButton onTranscription={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop voice recording' }))

    expect(stopRecording).toHaveBeenCalled()
  })
})
