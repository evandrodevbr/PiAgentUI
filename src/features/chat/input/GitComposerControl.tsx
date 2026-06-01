import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  DiffIcon,
  DownloadIcon,
  FileDiffIcon,
  FileIcon,
  GitBranchIcon,
  GitCommitIcon,
  PlusIcon,
  SyncIcon,
  UploadIcon,
} from '@primer/octicons-react'
import { DropdownMenu } from '../../../components/ui'
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
} from '../../../api/vcs'
import type { GitBranchInfo, GitStatusFile, GitStatusResponse } from '../../../types/api/vcs'

interface GitComposerControlProps {
  directory?: string
  inputContainerRef?: React.RefObject<HTMLElement | null>
}

const octiconClass = 'h-3.5 w-3.5 shrink-0'
const actionButtonClass =
  'min-h-[44px] rounded-lg border border-border-200/40 bg-bg-200/35 px-2.5 py-2 text-left text-[length:var(--fs-xs)] text-text-300 transition-colors hover:bg-bg-200/70 hover:text-text-100 disabled:cursor-not-allowed disabled:opacity-50'
const inputClass =
  'h-8 min-w-0 rounded-md border border-border-200/50 bg-bg-000 px-2.5 text-[length:var(--fs-sm)] text-text-100 placeholder:text-text-400 outline-none transition-colors focus:border-accent-main-100/60 focus:ring-1 focus:ring-accent-main-100/20'

function fileStatusLabel(file: GitStatusFile): string {
  if (file.untracked) return 'Untracked'
  if (file.staged && file.unstaged) return 'Staged + modified'
  if (file.staged) return 'Staged'
  return 'Modified'
}

function compactBranchName(branch: string): string {
  return branch.length > 28 ? `…${branch.slice(-27)}` : branch
}

function countStaged(files: GitStatusFile[]): number {
  return files.filter(file => file.staged).length
}

function countUnstaged(files: GitStatusFile[]): number {
  return files.filter(file => file.unstaged || file.untracked).length
}

export function GitComposerControl({ directory, inputContainerRef }: GitComposerControlProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [status, setStatus] = useState<GitStatusResponse | null>(null)
  const [branches, setBranches] = useState<GitBranchInfo[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const stagedCount = useMemo(() => countStaged(status?.files ?? []), [status?.files])
  const unstagedCount = useMemo(() => countUnstaged(status?.files ?? []), [status?.files])
  const changedCount = status?.files.length ?? 0
  const branch = status?.branch || branches.find(item => item.current)?.name

  const refresh = useCallback(async () => {
    if (!directory) {
      setStatus(null)
      setBranches([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [nextStatus, nextBranches] = await Promise.all([getVcsStatus(directory), getVcsBranches(directory)])
      setStatus(nextStatus)
      setBranches(nextBranches.branches)
    } catch (err) {
      setStatus(null)
      setBranches([])
      setError(err instanceof Error ? err.message : 'Unable to load Git status')
    } finally {
      setLoading(false)
    }
  }, [directory])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const runAction = useCallback(
    async (key: string, action: () => Promise<unknown>, options: { close?: boolean; clearCommit?: boolean } = {}) => {
      setActionLoading(key)
      setError(null)
      try {
        await action()
        if (options.clearCommit) setCommitMessage('')
        await refresh()
        if (options.close) setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Git operation failed')
      } finally {
        setActionLoading(null)
      }
    },
    [refresh],
  )

  const handleCreateBranch = useCallback(() => {
    const name = newBranchName.trim()
    if (!name) return
    void runAction('branch', async () => createGitBranch({ name }, directory), { close: true })
    setNewBranchName('')
  }, [directory, newBranchName, runAction])

  const allPaths = useMemo(() => status?.files.map(file => file.path) ?? [], [status?.files])
  const stagedPaths = useMemo(
    () => status?.files.filter(file => file.staged).map(file => file.path) ?? [],
    [status?.files],
  )

  if (!directory) return null

  const chipTone = error
    ? 'border border-danger-100/25 bg-danger-100/10 text-danger-100 hover:bg-danger-100/15'
    : status?.dirty
      ? 'border border-warning-100/25 bg-warning-100/10 text-warning-100 hover:bg-warning-100/15'
      : 'border border-accent-main-100/20 bg-accent-main-100/10 text-accent-main-100 hover:bg-accent-main-100/15'

  return (
    <div className="relative shrink min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen(value => !value)
          if (!open) void refresh()
        }}
        aria-label={branch ? `Git branch ${branch}` : 'Git branch status'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex h-[30px] max-w-[240px] items-center gap-1.5 rounded-lg px-2 text-[length:var(--fs-sm)] transition-all duration-150 active:scale-95 ${chipTone}`}
        title={error || branch || 'Git'}
      >
        <GitBranchIcon size={14} className={octiconClass} />
        <span className="min-w-0 truncate font-mono text-[length:var(--fs-sm)]">
          {branch ? compactBranchName(branch) : 'Git'}
        </span>
        {error ? (
          <AlertIcon size={12} className="h-3 w-3 shrink-0" />
        ) : status?.dirty ? (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning-100" aria-hidden="true" />
        ) : null}
        <ChevronDownIcon size={12} className="h-3 w-3 shrink-0 opacity-70" />
      </button>

      <DropdownMenu
        triggerRef={triggerRef}
        isOpen={open}
        position="top"
        align="left"
        width="min(640px, calc(100vw - 32px))"
        maxWidth="min(640px, calc(100vw - 32px))"
        constrainToRef={inputContainerRef}
      >
        <div ref={menuRef} role="dialog" aria-label="Git repository controls" className="w-full overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-border-200/30 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[length:var(--fs-xs)] font-medium uppercase tracking-[0.08em] text-text-400">
                <DiffIcon size={12} className={octiconClass} />
                Repository status
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[length:var(--fs-sm)] text-text-100">
                <GitBranchIcon size={14} className="h-3.5 w-3.5 shrink-0 text-accent-main-100" />
                <span className="truncate font-mono">{branch || 'No branch'}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <StatusBadge
                icon={<FileDiffIcon size={12} />}
                label={`${changedCount} changed`}
                tone={changedCount > 0 ? 'accent' : 'muted'}
              />
              <StatusBadge icon={<UploadIcon size={12} />} label={`${status?.ahead ?? 0} ahead`} />
              <StatusBadge
                icon={<DownloadIcon size={12} />}
                label={`${status?.behind ?? 0} behind`}
                tone={(status?.behind ?? 0) > 0 ? 'warning' : 'muted'}
              />
            </div>
          </div>

          <div className="grid max-h-[min(460px,70vh)] grid-cols-[198px_minmax(0,1fr)] overflow-hidden max-[640px]:grid-cols-1">
            <div className="border-r border-border-200/30 p-1.5 max-[640px]:hidden">
              <div className="px-2 py-1 text-[length:var(--fs-xs)] font-medium text-text-400">Branches</div>
              <div className="max-h-[235px] overflow-auto custom-scrollbar">
                {branches.map(item => (
                  <button
                    key={`${item.remote ? 'remote' : 'local'}:${item.name}`}
                    type="button"
                    onClick={() =>
                      runAction(`checkout:${item.name}`, () => checkoutGitBranch({ branch: item.name }, directory), {
                        close: true,
                      })
                    }
                    disabled={item.current || !!actionLoading}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left font-mono text-[length:var(--fs-xs)] transition-colors hover:bg-bg-200/60 disabled:opacity-70 ${
                      item.current ? 'bg-accent-main-100/10 text-text-100' : 'text-text-300'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {item.remote ? (
                        <DownloadIcon size={12} className={octiconClass} />
                      ) : (
                        <GitBranchIcon size={12} className={octiconClass} />
                      )}
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="font-sans text-[10px] text-text-500">{item.remote ? 'remote' : 'local'}</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5 px-1">
                <input
                  className={inputClass}
                  value={newBranchName}
                  onChange={event => setNewBranchName(event.target.value)}
                  placeholder="new branch"
                  aria-label="New branch name"
                />
                <button
                  type="button"
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim() || !!actionLoading}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-200/60 text-text-300 transition-colors hover:bg-bg-200 hover:text-text-100 disabled:opacity-50"
                  aria-label="Create branch"
                >
                  <PlusIcon size={14} />
                </button>
              </div>
            </div>

            <div className="min-w-0 p-2.5">
              <div className="grid grid-cols-4 gap-1.5 max-[640px]:grid-cols-2">
                <GitActionButton
                  icon={<GitCommitIcon size={14} />}
                  label="Commit"
                  hint={`${stagedCount} staged`}
                  primary
                  disabled={!commitMessage.trim() || stagedCount === 0 || !!actionLoading}
                  onClick={() =>
                    runAction('commit', () => commitGitChanges({ message: commitMessage }, directory), {
                      clearCommit: true,
                    })
                  }
                />
                <GitActionButton
                  icon={<DownloadIcon size={14} />}
                  label="Pull"
                  hint="ff-only"
                  disabled={!!actionLoading}
                  onClick={() => {
                    if (window.confirm('Pull latest changes with --ff-only?'))
                      void runAction('pull', () => pullGitBranch(directory))
                  }}
                />
                <GitActionButton
                  icon={<UploadIcon size={14} />}
                  label="Push"
                  hint="origin"
                  disabled={!!actionLoading}
                  onClick={() => {
                    if (window.confirm('Push current branch to its upstream?'))
                      void runAction('push', () => pushGitBranch(directory))
                  }}
                />
                <GitActionButton
                  icon={<SyncIcon size={14} />}
                  label="Refresh"
                  hint={loading ? 'loading' : 'status'}
                  disabled={loading || !!actionLoading}
                  onClick={() => void refresh()}
                />
              </div>

              <div className="mt-2 rounded-xl border border-border-200/40 bg-bg-000/45">
                <div className="flex items-center justify-between gap-2 border-b border-border-200/30 px-2.5 py-2">
                  <label
                    htmlFor="git-commit-message"
                    className="flex items-center gap-1.5 text-[length:var(--fs-xs)] font-medium text-text-300"
                  >
                    <GitCommitIcon size={13} className="text-accent-main-100" />
                    Commit message
                  </label>
                  <span className="flex items-center gap-1 font-mono text-[length:var(--fs-xs)] text-text-500">
                    <FileIcon size={12} />
                    {stagedCount} staged · {unstagedCount} unstaged
                  </span>
                </div>
                <textarea
                  id="git-commit-message"
                  aria-label="Commit message"
                  value={commitMessage}
                  onChange={event => setCommitMessage(event.target.value)}
                  placeholder="feat: add Git control to composer"
                  className="block min-h-[72px] w-full resize-none bg-transparent px-2.5 py-2 text-[length:var(--fs-sm)] text-text-100 outline-none placeholder:text-text-500"
                />
                <div className="flex items-center justify-between gap-2 px-2.5 pb-2">
                  <div className="flex items-center gap-1.5 text-[length:var(--fs-xs)] text-text-500">
                    <AlertIcon size={12} className="text-warning-100" />
                    Commit uses staged files only. Push is separate.
                  </div>
                  <button
                    type="button"
                    disabled={!commitMessage.trim() || stagedCount === 0 || !!actionLoading}
                    onClick={() =>
                      runAction('commit', () => commitGitChanges({ message: commitMessage }, directory), {
                        clearCommit: true,
                      })
                    }
                    className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent-main-000 px-2.5 text-[length:var(--fs-xs)] font-medium text-oncolor-100 transition-colors hover:bg-accent-main-200 disabled:opacity-50"
                  >
                    <CheckIcon size={13} />
                    Commit
                  </button>
                </div>
              </div>

              <div className="mt-2 rounded-xl border border-border-200/35 bg-bg-000/25">
                <div className="flex items-center justify-between gap-2 border-b border-border-200/25 px-2.5 py-1.5">
                  <span className="flex items-center gap-1.5 text-[length:var(--fs-xs)] font-medium text-text-300">
                    <FileDiffIcon size={13} className="text-accent-main-100" />
                    Changed files
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={allPaths.length === 0 || !!actionLoading}
                      onClick={() => runAction('stage-all', () => stageGitPaths({ paths: allPaths }, directory))}
                      className="rounded px-1.5 py-1 text-[length:var(--fs-xs)] text-text-400 hover:bg-bg-200 hover:text-text-100 disabled:opacity-50"
                    >
                      Stage all
                    </button>
                    <button
                      type="button"
                      disabled={stagedPaths.length === 0 || !!actionLoading}
                      onClick={() => runAction('unstage-all', () => unstageGitPaths({ paths: stagedPaths }, directory))}
                      className="rounded px-1.5 py-1 text-[length:var(--fs-xs)] text-text-400 hover:bg-bg-200 hover:text-text-100 disabled:opacity-50"
                    >
                      Unstage all
                    </button>
                  </div>
                </div>
                <div className="max-h-28 overflow-auto p-1 custom-scrollbar">
                  {(status?.files ?? []).length === 0 ? (
                    <div className="px-2 py-3 text-center text-[length:var(--fs-xs)] text-text-500">
                      Working tree clean
                    </div>
                  ) : (
                    status?.files
                      .slice(0, 8)
                      .map(file => (
                        <ChangedFileRow
                          key={file.path}
                          file={file}
                          actionLoading={!!actionLoading}
                          onStage={() =>
                            runAction(`stage:${file.path}`, () => stageGitPaths({ paths: [file.path] }, directory))
                          }
                          onUnstage={() =>
                            runAction(`unstage:${file.path}`, () => unstageGitPaths({ paths: [file.path] }, directory))
                          }
                        />
                      ))
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-danger-100/20 bg-danger-100/10 px-2.5 py-2 text-[length:var(--fs-xs)] text-danger-100">
                  <AlertIcon size={13} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words">{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DropdownMenu>
    </div>
  )
}

function StatusBadge({
  icon,
  label,
  tone = 'muted',
}: {
  icon: React.ReactNode
  label: string
  tone?: 'accent' | 'warning' | 'muted'
}) {
  const toneClass =
    tone === 'accent'
      ? 'border-accent-main-100/25 bg-accent-main-100/10 text-accent-main-100'
      : tone === 'warning'
        ? 'border-warning-100/25 bg-warning-100/10 text-warning-100'
        : 'border-border-200/40 bg-bg-200/45 text-text-400'

  return (
    <span
      className={`inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[length:var(--fs-xs)] ${toneClass}`}
    >
      {icon}
      {label}
    </span>
  )
}

function GitActionButton({
  icon,
  label,
  hint,
  primary = false,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  primary?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${actionButtonClass} ${primary ? 'border-accent-main-100/25 bg-accent-main-100/10' : ''}`}
    >
      <span className="flex items-center gap-1.5 font-medium text-text-100">
        <span className={primary ? 'text-accent-main-100' : 'text-text-400'}>{icon}</span>
        {label}
      </span>
      <span className="mt-0.5 block text-[10px] text-text-500">{hint}</span>
    </button>
  )
}

function ChangedFileRow({
  file,
  actionLoading,
  onStage,
  onUnstage,
}: {
  file: GitStatusFile
  actionLoading: boolean
  onStage: () => void
  onUnstage: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[length:var(--fs-xs)] text-text-300 hover:bg-bg-200/45">
      <span className="flex min-w-0 items-center gap-1.5">
        <FileDiffIcon
          size={12}
          className={file.staged ? 'text-accent-main-100' : file.untracked ? 'text-warning-100' : 'text-text-400'}
        />
        <span className="truncate font-mono">{file.path}</span>
        <span className="shrink-0 rounded bg-bg-200/70 px-1.5 py-0.5 text-[10px] text-text-500">
          {fileStatusLabel(file)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {(file.unstaged || file.untracked) && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={onStage}
            className="rounded px-1.5 py-0.5 text-text-400 hover:bg-bg-200 hover:text-text-100 disabled:opacity-50"
          >
            Stage
          </button>
        )}
        {file.staged && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={onUnstage}
            className="rounded px-1.5 py-0.5 text-text-400 hover:bg-bg-200 hover:text-text-100 disabled:opacity-50"
          >
            Unstage
          </button>
        )}
      </span>
    </div>
  )
}
