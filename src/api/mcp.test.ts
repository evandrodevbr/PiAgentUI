import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMcpStatus } from './mcp'
import { piClient } from './piClient'

vi.mock('./piClient', () => ({
  piClient: {
    get: vi.fn(),
  },
}))

describe('getMcpStatus', () => {
  beforeEach(() => {
    vi.mocked(piClient.get).mockReset()
  })

  it('loads real MCP status from the backend and preserves metadata', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      servers: {
        context7: {
          status: 'configured',
          transport: 'http',
          source: 'global',
          url: 'https://mcp.context7.com/mcp',
          directTools: true,
        },
      },
      configPaths: ['C:/Users/Evandro/.pi/agent/mcp.json'],
    })

    const status = await getMcpStatus('D:/repo')

    expect(piClient.get).toHaveBeenCalledWith('/api/mcp/status')
    expect(status.servers.context7).toMatchObject({
      status: 'configured',
      transport: 'http',
      source: 'global',
      directTools: true,
    })
  })
})
