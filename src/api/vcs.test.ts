import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkoutGitBranch,
  commitGitChanges,
  createGitBranch,
  getVcsBranches,
  getVcsStatus,
  pullGitBranch,
  pushGitBranch,
  stageGitPaths,
  unstageGitPaths,
} from './vcs'
import { piClient } from './piClient'

vi.mock('./piClient', () => ({
  piClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('vcs api', () => {
  beforeEach(() => {
    vi.mocked(piClient.get).mockReset()
    vi.mocked(piClient.post).mockReset()
  })

  it('loads Git status and branches for a directory', async () => {
    vi.mocked(piClient.get)
      .mockResolvedValueOnce({ branch: 'main', dirty: true, ahead: 1, behind: 0, files: [] })
      .mockResolvedValueOnce({ current: 'main', branches: [] })

    await getVcsStatus('/repo')
    await getVcsBranches('/repo')

    expect(piClient.get).toHaveBeenNthCalledWith(1, '/api/vcs/status?directory=%2Frepo')
    expect(piClient.get).toHaveBeenNthCalledWith(2, '/api/vcs/branches?directory=%2Frepo')
  })

  it('posts safe Git action bodies', async () => {
    vi.mocked(piClient.post).mockResolvedValue({ ok: true })

    await checkoutGitBranch({ branch: 'feature/ui' }, '/repo')
    await createGitBranch({ name: 'feature/new' }, '/repo')
    await stageGitPaths({ paths: ['src/app.tsx'] }, '/repo')
    await unstageGitPaths({ paths: ['src/app.tsx'] }, '/repo')
    await commitGitChanges({ message: 'feat: add git ui' }, '/repo')
    await pullGitBranch('/repo')
    await pushGitBranch('/repo')

    expect(piClient.post).toHaveBeenNthCalledWith(1, '/api/vcs/checkout?directory=%2Frepo', { branch: 'feature/ui' })
    expect(piClient.post).toHaveBeenNthCalledWith(2, '/api/vcs/branch?directory=%2Frepo', { name: 'feature/new' })
    expect(piClient.post).toHaveBeenNthCalledWith(3, '/api/vcs/stage?directory=%2Frepo', { paths: ['src/app.tsx'] })
    expect(piClient.post).toHaveBeenNthCalledWith(4, '/api/vcs/unstage?directory=%2Frepo', { paths: ['src/app.tsx'] })
    expect(piClient.post).toHaveBeenNthCalledWith(5, '/api/vcs/commit?directory=%2Frepo', {
      message: 'feat: add git ui',
    })
    expect(piClient.post).toHaveBeenNthCalledWith(6, '/api/vcs/pull?directory=%2Frepo', undefined)
    expect(piClient.post).toHaveBeenNthCalledWith(7, '/api/vcs/push?directory=%2Frepo', undefined)
  })
})
