import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getActiveModels } from './client'
import { piClient } from './piClient'

vi.mock('./piClient', () => ({
  piClient: {
    get: vi.fn(),
  },
}))

describe('getActiveModels', () => {
  beforeEach(() => {
    vi.mocked(piClient.get).mockReset()
  })

  it('preserves real context and output limits returned by the backend', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      models: [
        {
          id: 'anthropic/claude-opus-4.8',
          name: 'Claude Opus 4.8',
          provider: 'anthropic',
          contextLimit: 1_000_000,
          outputLimit: 128_000,
          supportsReasoning: true,
          supportsImages: true,
        },
      ],
    })

    const models = await getActiveModels()

    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      id: 'anthropic/claude-opus-4.8',
      name: 'Claude Opus 4.8',
      providerId: 'anthropic',
      providerName: 'anthropic',
      contextLimit: 1_000_000,
      outputLimit: 128_000,
      supportsReasoning: true,
      supportsImages: true,
    })
  })

  it('uses Pi model metadata aliases before generic fallbacks', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      models: [
        {
          id: 'custom-model',
          providerId: 'custom-provider',
          providerName: 'Custom Provider',
          contextWindow: 200_000,
          maxOutputTokens: 64_000,
          reasoning: true,
          input: ['text', 'image'],
        },
      ],
    })

    const models = await getActiveModels()

    expect(models[0]).toMatchObject({
      id: 'custom-model',
      providerId: 'custom-provider',
      providerName: 'Custom Provider',
      contextLimit: 200_000,
      outputLimit: 64_000,
      supportsReasoning: true,
      supportsImages: true,
    })
  })
})
