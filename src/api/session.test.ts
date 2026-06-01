import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSessionContextUsage } from './session'
import { piClient } from './piClient'

vi.mock('./piClient', () => ({
  piClient: {
    get: vi.fn(),
  },
}))

describe('getSessionContextUsage', () => {
  beforeEach(() => {
    vi.mocked(piClient.get).mockReset()
  })

  it('fetches runtime context usage for the requested session', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      available: true,
      sessionId: 'session-1',
      activeSessionId: 'session-1',
      tokens: 42000,
      contextWindow: 1000000,
      percent: 4.2,
      providerID: 'opencode-go',
      modelID: 'deepseek-v4-flash',
      modelName: 'DeepSeek V4 Flash',
      outputLimit: 384000,
    })

    const usage = await getSessionContextUsage('session-1')

    expect(piClient.get).toHaveBeenCalledWith('/api/sessions/session-1/context')
    expect(usage).toMatchObject({
      available: true,
      tokens: 42000,
      contextWindow: 1000000,
      percent: 4.2,
      providerID: 'opencode-go',
      modelID: 'deepseek-v4-flash',
      modelName: 'DeepSeek V4 Flash',
      outputLimit: 384000,
    })
  })
})
