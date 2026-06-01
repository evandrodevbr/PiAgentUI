import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getExtensions, installExtension, removeExtensionPackage } from './extension'
import { piClient } from './piClient'

vi.mock('./piClient', () => ({
  piClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('extension api', () => {
  beforeEach(() => {
    vi.mocked(piClient.get).mockReset()
    vi.mocked(piClient.post).mockReset()
    vi.mocked(piClient.delete).mockReset()
  })

  it('loads extension catalog and sends safe package operations to backend', async () => {
    vi.mocked(piClient.get).mockResolvedValue({
      packages: [],
      summary: { total: 0, active: 0, inactive: 0, missing: 0, error: 0 },
    })
    vi.mocked(piClient.post).mockResolvedValue({ source: 'npm:pi-hud', scope: 'user', reloadRequired: true })
    vi.mocked(piClient.delete).mockResolvedValue({ source: 'npm:pi-hud', scope: 'user', reloadRequired: true })

    await expect(getExtensions('/repo')).resolves.toMatchObject({ summary: { total: 0 } })
    await expect(installExtension('pi install npm:pi-hud', '/repo')).resolves.toMatchObject({ reloadRequired: true })
    await expect(removeExtensionPackage('npm:pi-hud', 'user', '/repo')).resolves.toMatchObject({ reloadRequired: true })

    expect(piClient.get).toHaveBeenCalledWith('/api/extensions?directory=%2Frepo')
    expect(piClient.post).toHaveBeenCalledWith('/api/extensions/install', {
      command: 'pi install npm:pi-hud',
      directory: '/repo',
    })
    expect(piClient.delete).toHaveBeenCalledWith('/api/extensions/package', {
      source: 'npm:pi-hud',
      scope: 'user',
      directory: '/repo',
    })
  })
})
