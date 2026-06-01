import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getNetworkAccess, updateNetworkAccess } from './network'
import { piClient } from './piClient'

vi.mock('./piClient', () => ({
  piClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('network api', () => {
  beforeEach(() => {
    vi.mocked(piClient.get).mockReset()
    vi.mocked(piClient.post).mockReset()
  })

  it('loads LAN access info', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      lanAccessEnabled: false,
      port: 58785,
      localUrl: 'http://127.0.0.1:58785',
      lanUrls: ['http://192.168.1.25:58785'],
      primaryLanUrl: 'http://192.168.1.25:58785',
    })

    const info = await getNetworkAccess()

    expect(piClient.get).toHaveBeenCalledWith('/api/network/access')
    expect(info.primaryLanUrl).toBe('http://192.168.1.25:58785')
  })

  it('updates LAN access info', async () => {
    vi.mocked(piClient.post).mockResolvedValue({
      lanAccessEnabled: true,
      port: 58785,
      localUrl: 'http://127.0.0.1:58785',
      lanUrls: ['http://192.168.1.25:58785'],
      primaryLanUrl: 'http://192.168.1.25:58785',
    })

    const info = await updateNetworkAccess(true)

    expect(piClient.post).toHaveBeenCalledWith('/api/network/access', { lanAccessEnabled: true })
    expect(info.lanAccessEnabled).toBe(true)
  })
})
