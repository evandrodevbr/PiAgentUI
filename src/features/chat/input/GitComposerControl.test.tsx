import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GitComposerControl } from './GitComposerControl'
import { commitGitChanges, getVcsBranches, getVcsStatus, stageGitPaths } from '../../../api/vcs'

vi.mock('../../../api/vcs', () => ({
  getVcsStatus: vi.fn(),
  getVcsBranches: vi.fn(),
  checkoutGitBranch: vi.fn(),
  createGitBranch: vi.fn(),
  stageGitPaths: vi.fn(),
  unstageGitPaths: vi.fn(),
  commitGitChanges: vi.fn(),
  pullGitBranch: vi.fn(),
  pushGitBranch: vi.fn(),
}))

vi.mock('../../../components/ui', async () => {
  const actual = await vi.importActual<typeof import('../../../components/ui')>('../../../components/ui')
  return {
    ...actual,
    DropdownMenu: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
      isOpen ? <div>{children}</div> : null,
  }
})

describe('GitComposerControl', () => {
  beforeEach(() => {
    vi.mocked(getVcsStatus).mockReset()
    vi.mocked(getVcsBranches).mockReset()
    vi.mocked(stageGitPaths).mockReset()
    vi.mocked(commitGitChanges).mockReset()
    vi.mocked(getVcsStatus).mockResolvedValue({
      branch: 'feature/git-ui',
      upstream: 'origin/feature/git-ui',
      ahead: 1,
      behind: 2,
      dirty: true,
      files: [
        { path: 'src/app.tsx', index: '.', workingTree: 'M', staged: false, unstaged: true, untracked: false },
        { path: 'src/ready.ts', index: 'M', workingTree: '.', staged: true, unstaged: false, untracked: false },
      ],
    })
    vi.mocked(getVcsBranches).mockResolvedValue({
      current: 'feature/git-ui',
      branches: [
        { name: 'feature/git-ui', current: true, remote: false, upstream: 'origin/feature/git-ui' },
        { name: 'main', current: false, remote: false },
      ],
    })
  })

  it('shows the current branch chip and opens the Git popover', async () => {
    render(<GitComposerControl directory="/repo" />)

    const trigger = await screen.findByRole('button', { name: /Git branch feature\/git-ui/i })
    expect(trigger).toBeInTheDocument()

    fireEvent.click(trigger)

    expect(await screen.findByRole('dialog', { name: /Git repository controls/i })).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('1 ahead')).toBeInTheDocument()
    expect(screen.getByText('2 behind')).toBeInTheDocument()
  })

  it('keeps the Git chip visible when status loading fails', async () => {
    vi.mocked(getVcsStatus).mockRejectedValue(new Error('fatal: not a git repository'))
    vi.mocked(getVcsBranches).mockRejectedValue(new Error('fatal: not a git repository'))

    render(<GitComposerControl directory="/repo" />)

    const trigger = await screen.findByRole('button', { name: /Git branch status/i })
    expect(trigger).toBeInTheDocument()

    fireEvent.click(trigger)

    expect(await screen.findByText('fatal: not a git repository')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Git branch status/i })).toBeInTheDocument()
  })

  it('stages all files and commits with a dedicated message', async () => {
    vi.mocked(stageGitPaths).mockResolvedValue({ ok: true })
    vi.mocked(commitGitChanges).mockResolvedValue({ ok: true })

    render(<GitComposerControl directory="/repo" />)
    fireEvent.click(await screen.findByRole('button', { name: /Git branch feature\/git-ui/i }))

    fireEvent.click(await screen.findByRole('button', { name: /^Stage all$/i }))
    await waitFor(() => {
      expect(stageGitPaths).toHaveBeenCalledWith({ paths: ['src/app.tsx', 'src/ready.ts'] }, '/repo')
    })

    fireEvent.change(screen.getByLabelText('Commit message'), {
      target: { value: 'feat: add git composer control' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Commit$/i }))

    await waitFor(() => {
      expect(commitGitChanges).toHaveBeenCalledWith({ message: 'feat: add git composer control' }, '/repo')
    })
  })
})
