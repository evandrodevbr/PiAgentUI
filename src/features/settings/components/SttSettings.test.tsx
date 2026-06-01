import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SttSettings } from './SttSettings'
import { getSttSettings, updateSttSettings } from '../../../api/stt'

vi.mock('../../../api/stt', () => ({
  getSttSettings: vi.fn(),
  updateSttSettings: vi.fn(),
}))

const SETTINGS = {
  enabled: true,
  providerKind: 'openai-compatible' as const,
  mode: 'file' as const,
  baseUrl: 'https://api.openai.com/v1',
  apiKeyConfigured: true,
  apiKeyRequired: true,
  transcriptionEndpoint: '/audio/transcriptions',
  transcriptionModel: 'gpt-4o-mini-transcribe',
  language: 'pt',
  insertMode: 'append' as const,
}

describe('SttSettings', () => {
  beforeEach(() => {
    vi.mocked(getSttSettings).mockReset()
    vi.mocked(updateSttSettings).mockReset()
    vi.mocked(getSttSettings).mockResolvedValue(SETTINGS)
    vi.mocked(updateSttSettings).mockImplementation(async payload => ({
      ...SETTINGS,
      ...payload,
      apiKeyConfigured: true,
      language: payload.language ?? SETTINGS.language,
    }))
  })

  it('uses the shared switch pattern for enabling voice transcription', async () => {
    render(<SttSettings />)

    const enableSwitch = await screen.findByRole('switch', { name: 'Enable voice transcription' })

    expect(enableSwitch).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.click(enableSwitch)
    expect(enableSwitch).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Save transcription settings' }))

    await waitFor(() => expect(updateSttSettings).toHaveBeenCalledWith(expect.objectContaining({ enabled: false })))
  })

  it('persists whether the STT provider requires an API key', async () => {
    render(<SttSettings />)

    const requireKeySwitch = await screen.findByRole('switch', { name: 'Require voice transcription API key' })
    expect(requireKeySwitch).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(requireKeySwitch)
    fireEvent.click(screen.getByRole('button', { name: 'Save transcription settings' }))

    await waitFor(() =>
      expect(updateSttSettings).toHaveBeenCalledWith(expect.objectContaining({ apiKeyRequired: false })),
    )
  })

  it('shows one complete transcription configuration instead of split transcription cards', async () => {
    render(<SttSettings />)

    expect(await screen.findByText('Speech-to-text transcription')).toBeInTheDocument()
    expect(screen.queryByText('Transcription provider')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Provider')).toHaveValue('openai-compatible')
    expect(screen.getByLabelText('Base URL')).toHaveValue('https://api.openai.com/v1')
    expect(screen.getByLabelText('Endpoint')).toHaveValue('/audio/transcriptions')
    expect(screen.getByLabelText('Model')).toHaveValue('gpt-4o-mini-transcribe')
  })

  it('styles dropdown lists with the app select treatment', async () => {
    render(<SttSettings />)

    const insertMode = await screen.findByLabelText('Insert mode')

    expect(insertMode).toHaveClass('appearance-none')
    expect(insertMode.closest('[data-settings-select]')).toBeInTheDocument()
  })
})
