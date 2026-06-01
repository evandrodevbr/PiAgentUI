// ============================================
// ExtensionPanel - Pi Agent extension package manager
// Lists installed package resources and supports package install/uninstall.
// It does not activate/deactivate individual extension resources.
// ============================================

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircleIcon,
  CheckIcon,
  DownloadIcon,
  PlugIcon,
  RetryIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
} from './Icons'
import { getExtensions, installExtension, removeExtensionPackage } from '../api/extension'
import type {
  ExtensionCatalog,
  ExtensionPackageInfo,
  ExtensionPackageScope,
  ExtensionPackageStatus,
} from '../types/api'
import { useDirectory } from '../hooks'
import { apiErrorHandler } from '../utils'

interface ExtensionPanelProps {
  isResizing?: boolean
}

const EMPTY_CATALOG: ExtensionCatalog = {
  packages: [],
  summary: { total: 0, active: 0, inactive: 0, missing: 0, error: 0 },
}

const STATUS_ORDER: ExtensionPackageStatus[] = ['active', 'inactive', 'missing', 'error']
type FormSubmitEvent = { preventDefault: () => void }

export const ExtensionPanel = memo(function ExtensionPanel({ isResizing: _isResizing }: ExtensionPanelProps) {
  const { t } = useTranslation(['components', 'common'])
  const { currentDirectory } = useDirectory()
  const [catalog, setCatalog] = useState<ExtensionCatalog>(EMPTY_CATALOG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [installCommand, setInstallCommand] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [reloadRequired, setReloadRequired] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadExtensions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getExtensions(currentDirectory)
      setCatalog(data)
    } catch (err) {
      apiErrorHandler('load extensions', err)
      setError(t('extensionPanel.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [currentDirectory, t])

  useEffect(() => {
    loadExtensions()
  }, [loadExtensions])

  const filteredPackages = useMemo(() => {
    const normalized = filter.trim().toLowerCase()
    if (!normalized) return catalog.packages
    return catalog.packages.filter(pkg =>
      [pkg.packageName, pkg.source, pkg.description, pkg.installedPath]
        .filter((value): value is string => typeof value === 'string')
        .some(value => value.toLowerCase().includes(normalized)),
    )
  }, [catalog.packages, filter])

  const groupedPackages = useMemo(() => {
    const scopes: ExtensionPackageScope[] = ['project', 'user']
    return scopes
      .map(scope => ({
        scope,
        label: t(`extensionPanel.scopes.${scope}`),
        packages: filteredPackages.filter(pkg => pkg.scope === scope),
      }))
      .filter(group => group.packages.length > 0)
  }, [filteredPackages, t])

  const handleRefresh = useCallback(() => {
    loadExtensions()
  }, [loadExtensions])

  const handleInstall = useCallback(
    async (event: FormSubmitEvent) => {
      event.preventDefault()
      const command = installCommand.trim()
      if (!command) return

      setActionLoading('__install__')
      setActionError(null)
      try {
        const result = await installExtension(command, currentDirectory)
        setInstallCommand('')
        setReloadRequired(result.reloadRequired)
        await loadExtensions()
      } catch (err) {
        apiErrorHandler('install extension', err)
        setActionError(err instanceof Error ? err.message : t('extensionPanel.failedToInstall'))
      } finally {
        setActionLoading(null)
      }
    },
    [currentDirectory, installCommand, loadExtensions, t],
  )

  const handleUninstall = useCallback(
    async (pkg: ExtensionPackageInfo) => {
      const name = pkg.packageName || pkg.source
      if (!window.confirm(t('extensionPanel.uninstallConfirm', { name }))) return

      setActionLoading(pkg.source)
      setActionError(null)
      try {
        const result = await removeExtensionPackage(pkg.source, pkg.scope, currentDirectory)
        setReloadRequired(result.reloadRequired)
        await loadExtensions()
      } catch (err) {
        apiErrorHandler('remove extension', err)
        setActionError(err instanceof Error ? err.message : t('extensionPanel.failedToUninstall'))
      } finally {
        setActionLoading(null)
      }
    },
    [currentDirectory, loadExtensions, t],
  )

  return (
    <div className="flex h-full flex-col bg-bg-100">
      <div className="relative flex h-10 items-center justify-between px-3">
        <div className="flex h-6 min-w-0 items-center gap-1.5 text-text-100 text-[length:var(--fs-xs)] font-medium">
          <span>{t('extensionPanel.title')}</span>
          {!loading && (
            <span className="inline-flex h-4 items-center text-[length:var(--fs-xs)] leading-none text-text-400">
              ({catalog.summary.total})
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          aria-label={t('common:refresh')}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-300 transition-colors hover:bg-bg-200/50 hover:text-text-100 disabled:opacity-50"
          title={t('common:refresh')}
        >
          <RetryIcon size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-border-200/30" />
      </div>

      <div className="relative px-3 py-2">
        <div className="relative group">
          <input
            type="text"
            name="extension-filter"
            value={filter}
            onChange={event => setFilter(event.target.value)}
            placeholder={t('extensionPanel.filterPlaceholder')}
            aria-label={t('extensionPanel.filterPlaceholder')}
            autoComplete="off"
            className="w-full rounded-md border border-transparent bg-bg-200/40 py-1.5 pl-[30px] pr-2 text-[length:var(--fs-sm)] text-text-100 placeholder:text-text-400/70 transition-all hover:bg-bg-200/60 focus:border-border-200 focus:bg-bg-000 focus-visible:ring-1 focus-visible:ring-border-200 focus-visible:ring-inset"
          />
          <SearchIcon
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-400 transition-colors group-focus-within:text-accent-main-100"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-border-200/30" />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-2 p-2">
          <InstallCommandCard
            command={installCommand}
            onCommandChange={setInstallCommand}
            onSubmit={handleInstall}
            loading={actionLoading === '__install__'}
          />

          {reloadRequired && (
            <div className="rounded-md border border-accent-main-100/25 bg-accent-main-000/10 px-3 py-2 text-[length:var(--fs-sm)] text-text-200">
              {t('extensionPanel.reloadRequired')}
            </div>
          )}

          {actionError && (
            <div className="rounded-md border border-danger-100/25 bg-danger-100/10 px-3 py-2 text-[length:var(--fs-sm)] text-danger-100">
              {actionError}
            </div>
          )}

          <SummaryBar summary={catalog.summary} />
        </div>

        {loading && catalog.packages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[length:var(--fs-base)] text-text-400">
            <SpinnerIcon size={20} className="animate-spin opacity-50" />
            <span>{t('extensionPanel.loadingExtensions')}</span>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[length:var(--fs-base)] text-text-400">
            <AlertCircleIcon size={20} className="text-danger-100" />
            <span>{error}</span>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-md bg-bg-200/50 px-3 py-1.5 text-[length:var(--fs-sm)] text-text-200 transition-colors hover:bg-bg-200"
            >
              {t('common:retry')}
            </button>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[length:var(--fs-base)] text-text-400">
            <PlugIcon size={24} className="opacity-30" />
            <span>{t('extensionPanel.noExtensions')}</span>
          </div>
        ) : (
          <div className="p-1 pt-0">
            {groupedPackages.map(group => (
              <section key={group.scope} className="mb-2 last:mb-0" aria-label={group.label}>
                <div className="flex items-center justify-between px-2 py-1 text-[length:var(--fs-xs)] text-text-400">
                  <span className="font-medium uppercase tracking-[0.08em]">{group.label}</span>
                  <span className="rounded-full bg-bg-200/60 px-1.5 py-0.5 font-mono text-[length:var(--fs-xxs)] text-text-500">
                    {group.packages.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {group.packages.map(pkg => (
                    <ExtensionPackageCard
                      key={`${pkg.scope}:${pkg.source}`}
                      pkg={pkg}
                      actionLoading={actionLoading === pkg.source}
                      onUninstall={handleUninstall}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

function InstallCommandCard({
  command,
  onCommandChange,
  onSubmit,
  loading,
}: {
  command: string
  onCommandChange: (command: string) => void
  onSubmit: (event: FormSubmitEvent) => void
  loading: boolean
}) {
  const { t } = useTranslation(['components'])

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border-200/45 bg-bg-050/60 p-2.5">
      <div className="mb-2 flex items-start gap-2">
        <DownloadIcon size={14} className="mt-0.5 shrink-0 text-text-400" />
        <div className="min-w-0">
          <div className="text-[length:var(--fs-sm)] font-medium text-text-100">{t('extensionPanel.installTitle')}</div>
          <div className="text-[length:var(--fs-xs)] leading-relaxed text-text-400">
            {t('extensionPanel.installDescription')}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          name="extension-install-command"
          value={command}
          onChange={event => onCommandChange(event.target.value)}
          placeholder="pi install npm:pi-hud"
          aria-label={t('extensionPanel.installCommandLabel')}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-border-200/50 bg-bg-000 px-2 py-1.5 font-mono text-[length:var(--fs-xs)] text-text-100 placeholder:text-text-500 focus:border-accent-main-100/60 focus:outline-none focus:ring-1 focus:ring-accent-main-100/20"
        />
        <button
          type="submit"
          disabled={loading || command.trim().length === 0}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-accent-main-100 px-2.5 text-[length:var(--fs-xs)] font-medium text-white transition-colors hover:bg-accent-main-200 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('extensionPanel.installAction')}
        >
          {loading ? <SpinnerIcon size={12} className="animate-spin" /> : <DownloadIcon size={12} />}
          <span>{t('extensionPanel.install')}</span>
        </button>
      </div>
    </form>
  )
}

function SummaryBar({ summary }: { summary: ExtensionCatalog['summary'] }) {
  const { t } = useTranslation(['components'])
  return (
    <div className="grid grid-cols-4 gap-1.5 text-[length:var(--fs-xxs)]">
      {STATUS_ORDER.map(status => (
        <div key={status} className="rounded-md border border-border-200/35 bg-bg-050/35 px-2 py-1.5">
          <div className="font-mono text-text-100">{summary[status]}</div>
          <div className="truncate text-text-500">{t(`extensionPanel.status.${status}`)}</div>
        </div>
      ))}
    </div>
  )
}

function ExtensionPackageCard({
  pkg,
  actionLoading,
  onUninstall,
}: {
  pkg: ExtensionPackageInfo
  actionLoading: boolean
  onUninstall: (pkg: ExtensionPackageInfo) => void
}) {
  const { t } = useTranslation(['components'])
  const name = pkg.packageName || pkg.source
  const resourceCounts = countResources(pkg)
  const extensionResources = pkg.resources.extensions
  const detailRows = [
    pkg.source,
    pkg.version ? `v${pkg.version}` : null,
    pkg.scope,
    pkg.filtered ? t('extensionPanel.filtered') : null,
  ].filter((value): value is string => Boolean(value))

  return (
    <article className="rounded-lg border border-border-200/45 bg-bg-050/50 px-2.5 py-2 transition-colors hover:bg-bg-050/80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[length:var(--fs-base)] font-medium text-text-100">{name}</span>
            <StatusBadge status={pkg.status} />
          </div>
          {pkg.description && (
            <p className="mt-0.5 truncate text-[length:var(--fs-sm)] text-text-400">{pkg.description}</p>
          )}
          <p className="mt-1 truncate font-mono text-[length:var(--fs-xxs)] text-text-500">{detailRows.join(' · ')}</p>
        </div>
        <button
          type="button"
          onClick={() => onUninstall(pkg)}
          disabled={actionLoading}
          aria-label={t('extensionPanel.uninstallLabel', { name })}
          title={t('extensionPanel.uninstall')}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-400 transition-colors hover:bg-danger-100/10 hover:text-danger-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionLoading ? <SpinnerIcon size={13} className="animate-spin" /> : <TrashIcon size={13} />}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {resourceCounts.map(item => (
          <span
            key={item.type}
            className="rounded-full bg-bg-200/55 px-2 py-0.5 text-[length:var(--fs-xxs)] text-text-300"
          >
            {t(`extensionPanel.resourceTypes.${item.type}`)} {item.count}
          </span>
        ))}
      </div>

      {extensionResources.length > 0 && (
        <div className="mt-2 rounded-md border border-border-200/30 bg-bg-100/45 p-1.5">
          {extensionResources.map(resource => (
            <div key={resource.path} className="flex items-center justify-between gap-2 py-0.5">
              <span className="min-w-0 truncate font-mono text-[length:var(--fs-xxs)] text-text-400">
                {resource.name}
              </span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[length:var(--fs-xxs)] ${
                  resource.enabled ? 'bg-success-100/10 text-success-100' : 'bg-bg-200/60 text-text-500'
                }`}
              >
                {resource.enabled ? t('extensionPanel.resourceActive') : t('extensionPanel.resourceInactive')}
              </span>
            </div>
          ))}
        </div>
      )}

      {pkg.error && <div className="mt-2 text-[length:var(--fs-xs)] text-danger-100">{pkg.error}</div>}
    </article>
  )
}

function StatusBadge({ status }: { status: ExtensionPackageStatus }) {
  const { t } = useTranslation(['components'])
  const className = {
    active: 'bg-success-100/10 text-success-100 border-success-100/20',
    inactive: 'bg-bg-200/60 text-text-400 border-border-200/50',
    missing: 'bg-warning-100/10 text-warning-100 border-warning-100/20',
    error: 'bg-danger-100/10 text-danger-100 border-danger-100/20',
  }[status]

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[length:var(--fs-xxs)] ${className}`}
    >
      {status === 'active' ? <CheckIcon size={9} /> : null}
      {t(`extensionPanel.status.${status}`)}
    </span>
  )
}

function countResources(
  pkg: ExtensionPackageInfo,
): Array<{ type: keyof ExtensionPackageInfo['resources']; count: number }> {
  return (['extensions', 'skills', 'prompts', 'themes'] as const)
    .map(type => ({ type, count: pkg.resources[type].length }))
    .filter(item => item.count > 0)
}
