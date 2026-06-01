import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TtsSettings } from './TtsSettings'
import { getTtsSettings, updateTtsSettings } from '../../../api/tts'

vi.mock('../../../api/tts', () => ({
  getTtsSettings: vi.fn(),
  updateTtsSettings: vi.fn(),
}))

const SETTINGS = {
  enabled: true,
  providerKind: 'openai-compatible' as const,
  baseUrl: 'http://127.0.0.1:8022/v1',
  apiKeyConfigured: false,
  apiKeyRequired: false,
  speechEndpoint: '/audio/speech',
  model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
  voice: 'pf_dora',
  responseFormat: 'wav' as const,
  speed: 1,
}

describe('TtsSettings', () => {
  beforeEach(() => {
    vi.mocked(getTtsSettings).mockReset()
    vi.mocked(updateTtsSettings).mockReset()
    vi.mocked(getTtsSettings).mockResolvedValue(SETTINGS)
    vi.mocked(updateTtsSettings).mockImplementation(async payload => ({ ...SETTINGS, ...payload }))
  })

  it('lets the user choose a Speaches/Kokoro voice and persist it', async () => {
    render(<TtsSettings />)

    const voiceSelect = await screen.findByLabelText('Voice')
    expect(voiceSelect).toHaveValue('pf_dora')
    expect(screen.getByRole('option', { name: 'pf_dora — Portuguese BR female' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'pm_alex — Portuguese BR male' })).toBeInTheDocument()

    fireEvent.change(voiceSelect, { target: { value: 'pm_alex' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save text-to-speech settings' }))

    await waitFor(() => expect(updateTtsSettings).toHaveBeenCalledWith(expect.objectContaining({ voice: 'pm_alex' })))
  })
})
