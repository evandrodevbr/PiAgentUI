import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '../../../components/ui'
import { CodeBlock } from '../../../components/CodeBlock'
import { ChevronDownIcon, ChevronUpIcon, CpuIcon, DollarSignIcon } from '../../../components/Icons'
import { useMessageStore } from '../../../store'
import { formatTokens, formatCost } from '../../../hooks'
import modelsCatalogUrl from '../../../assets/models.json?url'
import {
  formatOpenRouterPricePerMillion,
  getModelProviderLabel,
  selectOpenRouterModel,
  type OpenRouterModelEntry,
} from '../../../utils/openRouterModelMetadata'
import type { SessionStats } from '../../../hooks'
import type { Message, TokenUsage } from '../../../types/message'

interface ContextDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  stats: SessionStats
}

function tokenTotal(tokens?: TokenUsage): number {
  if (!tokens) return 0
  return (
    (tokens.input || 0) +
    (tokens.output || 0) +
    (tokens.reasoning || 0) +
    (tokens.cache?.read || 0) +
    (tokens.cache?.write || 0)
  )
}

function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[length:var(--fs-xs)] font-medium text-text-400">{label}</div>
      <div className="text-[length:var(--fs-base)] text-text-200 font-mono truncate" title={value}>
        {value}
      </div>
    </div>
  )
}

function StatCard({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border-200/50 bg-bg-100/60 p-3 min-w-0">
      <div className="text-[length:var(--fs-xxs)] uppercase tracking-[0.08em] text-text-500 mb-1">{label}</div>
      <div className="text-[length:var(--fs-sm)] text-text-200 font-mono truncate" title={title ?? value}>
        {value}
      </div>
    </div>
  )
}

function joinList(values: string[] | null | undefined): string {
  return values?.length ? values.join(', ') : '—'
}

function modelLabel(name: string | undefined, id: string | undefined): string {
  if (!name) return id ?? '—'
  if (!id || name.toLowerCase().includes(id.toLowerCase())) return name
  return `${name} · ${id}`
}

function useOpenRouterMetadata(
  isOpen: boolean,
  modelID: string | undefined,
  providerID: string | undefined,
  modelName: string | undefined,
  contextWindow: number,
) {
  const [catalog, setCatalog] = useState<OpenRouterModelEntry[] | null>(null)

  useEffect(() => {
    if (!isOpen || catalog) return
    let cancelled = false

    void fetch(modelsCatalogUrl)
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((json: { data?: OpenRouterModelEntry[] }) => {
        if (!cancelled) setCatalog(Array.isArray(json.data) ? json.data : [])
      })
      .catch(() => {
        if (!cancelled) setCatalog([])
      })

    return () => {
      cancelled = true
    }
  }, [catalog, isOpen])

  return useMemo(() => {
    if (!catalog) return undefined
    return selectOpenRouterModel(catalog, { modelID, providerID, modelName, contextWindow })
  }, [catalog, modelID, providerID, modelName, contextWindow])
}

export function ContextDetailsDialog({ isOpen, onClose, stats }: ContextDetailsDialogProps) {
  const { t } = useTranslation(['chat', 'common'])
  const { sessionId, messages } = useMessageStore()
  const contextLimit = stats.contextLimit

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const lastAssistantWithTokens = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.info.role !== 'assistant') continue
      const total = tokenTotal(msg.info.tokens)
      if (total <= 0) continue
      return { msg, total }
    }
    return undefined
  }, [messages])

  const counts = useMemo(() => {
    let user = 0
    let assistant = 0
    for (const m of messages) {
      if (m.info.role === 'user') user++
      else assistant++
    }
    return { all: messages.length, user, assistant }
  }, [messages])

  const contextUsagePercent = useMemo(() => {
    if (!stats.contextKnown || stats.contextUsed <= 0 || contextLimit <= 0) return null
    return Math.round(stats.contextPercent)
  }, [stats.contextKnown, stats.contextUsed, stats.contextPercent, contextLimit])

  const contextMsg = lastAssistantWithTokens?.msg
  const contextTokens = contextMsg?.info.role === 'assistant' ? contextMsg.info.tokens : undefined
  const modelID = stats.modelID ?? (contextMsg?.info.role === 'assistant' ? contextMsg.info.modelID : undefined)
  const providerID =
    stats.providerID ?? (contextMsg?.info.role === 'assistant' ? contextMsg.info.providerID : undefined)
  const openRouterModel = useOpenRouterMetadata(isOpen, modelID, providerID, stats.modelName, contextLimit)
  const providerValue = providerID ?? getModelProviderLabel(openRouterModel) ?? '—'
  const modelValue = modelLabel(stats.modelName ?? openRouterModel?.name, modelID ?? openRouterModel?.id)
  const outputLimit = stats.outputLimit ?? openRouterModel?.top_provider?.max_completion_tokens ?? null
  const supportedParameters = openRouterModel?.supported_parameters ?? []
  const featuredParameters = supportedParameters.filter(parameter =>
    ['tools', 'reasoning', 'response_format', 'structured_outputs'].includes(parameter),
  )
  const contextSourceLabel = t(`contextDetails.sources.${stats.contextSource}`)
  const contextNoticeText =
    stats.contextNotice === 'compacted'
      ? t('contextDetails.notices.compacted')
      : stats.contextNotice === 'danger'
        ? t('contextDetails.notices.danger')
        : stats.contextNotice === 'warning'
          ? t('contextDetails.notices.warning')
          : null

  const handleToggleMessage = useCallback((msg: Message) => {
    const id = msg.info.id
    setExpandedId(prev => (prev === id ? null : id))
  }, [])

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('contextDetails.context')} width={900} className="w-full">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Stat label={t('contextDetails.session')} value={sessionId || '—'} />
          <Stat
            label={t('contextDetails.messages')}
            value={`${counts.all} (user ${counts.user}, assistant ${counts.assistant})`}
          />
          <Stat label={t('contextDetails.provider')} value={providerValue} />
          <Stat label={t('contextDetails.model')} value={modelValue} />
          <Stat label={t('contextDetails.contextLimit')} value={formatTokens(contextLimit)} />
          <Stat
            label={t('contextDetails.totalTokens')}
            value={stats.contextKnown ? formatTokens(stats.contextUsed) : '—'}
          />
          <Stat
            label={t('contextDetails.usage')}
            value={
              contextUsagePercent === null
                ? '—'
                : stats.contextEstimated
                  ? `${contextUsagePercent}% (estimated)`
                  : `${contextUsagePercent}%`
            }
          />
          <Stat label={t('contextDetails.source')} value={contextSourceLabel} />
          <Stat label={t('contextDetails.totalCost')} value={formatCost(stats.totalCost)} />
        </div>

        {contextNoticeText && (
          <div
            className={`rounded-lg border px-3 py-2 text-[length:var(--fs-sm)] ${
              stats.contextNotice === 'danger'
                ? 'border-danger-100/40 bg-danger-100/10 text-danger-100'
                : stats.contextNotice === 'warning'
                  ? 'border-warning-100/40 bg-warning-100/10 text-warning-100'
                  : 'border-border-200/50 bg-bg-200/30 text-text-300'
            }`}
          >
            {contextNoticeText}
          </div>
        )}

        <div className="rounded-xl border border-border-200/50 bg-bg-200/20 p-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[length:var(--fs-sm)] font-medium text-text-200">
                {t('contextDetails.modelMetadata')}
              </div>
              <div className="text-[length:var(--fs-xxs)] text-text-500 mt-0.5">
                {t('contextDetails.openRouterMetadataSource')}
              </div>
            </div>
            <div
              className="text-[length:var(--fs-xxs)] text-text-500 font-mono truncate max-w-[45%]"
              title={openRouterModel?.id ?? '—'}
            >
              {openRouterModel?.id ?? '—'}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label={t('contextDetails.catalogContext')}
              value={openRouterModel?.context_length ? formatTokens(openRouterModel.context_length) : '—'}
            />
            <StatCard label={t('contextDetails.maxOutput')} value={outputLimit ? formatTokens(outputLimit) : '—'} />
            <StatCard
              label={t('contextDetails.modalities')}
              value={`${joinList(openRouterModel?.architecture?.input_modalities)} → ${joinList(openRouterModel?.architecture?.output_modalities)}`}
            />
            <StatCard
              label={t('contextDetails.pricing')}
              value={`${formatOpenRouterPricePerMillion(openRouterModel?.pricing?.prompt)} / ${formatOpenRouterPricePerMillion(openRouterModel?.pricing?.completion)}`}
              title="input / output per million tokens"
            />
            <StatCard
              label={t('contextDetails.cacheRead')}
              value={formatOpenRouterPricePerMillion(openRouterModel?.pricing?.input_cache_read)}
            />
            <StatCard label={t('contextDetails.tokenizer')} value={openRouterModel?.architecture?.tokenizer ?? '—'} />
            <StatCard
              label={t('contextDetails.moderated')}
              value={
                openRouterModel?.top_provider?.is_moderated === undefined
                  ? '—'
                  : openRouterModel.top_provider.is_moderated
                    ? 'yes'
                    : 'no'
              }
            />
            <StatCard
              label={t('contextDetails.features')}
              value={featuredParameters.length ? featuredParameters.join(', ') : '—'}
              title={supportedParameters.join(', ')}
            />
          </div>
        </div>

        {contextTokens && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-border-200/50 bg-bg-200/20">
            <Stat label={t('contextDetails.inputTokens')} value={formatTokens(contextTokens.input || 0)} />
            <Stat label={t('contextDetails.outputTokens')} value={formatTokens(contextTokens.output || 0)} />
            <Stat label={t('contextDetails.reasoning')} value={formatTokens(contextTokens.reasoning || 0)} />
            <Stat
              label={t('contextDetails.cacheRW')}
              value={`${formatTokens(contextTokens.cache?.read || 0)} / ${formatTokens(contextTokens.cache?.write || 0)}`}
            />
          </div>
        )}

        {contextMsg && (
          <div className="flex items-center justify-between text-[length:var(--fs-xs)] text-text-400">
            <div className="flex items-center gap-2">
              <CpuIcon size={14} className="opacity-60" />
              <span className="font-mono">last: {contextMsg.info.id}</span>
            </div>
            <span className="tabular-nums">{formatTimestamp(contextMsg.info.time?.created)}</span>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="text-[length:var(--fs-xs)] font-medium text-text-400 mb-2">
          {t('contextDetails.rawMessages')}
        </div>
        <div className="space-y-1">
          {messages.map(msg => {
            const isExpanded = expandedId === msg.info.id

            const headerLabel = `${msg.info.role} • ${msg.info.id}`
            const time = formatTimestamp(msg.info.time?.created)

            const assistantTokens = msg.info.role === 'assistant' ? tokenTotal(msg.info.tokens) : null
            const assistantCost = msg.info.role === 'assistant' ? msg.info.cost : null

            return (
              <div key={msg.info.id} className="rounded-lg border border-border-200/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleToggleMessage(msg)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left bg-bg-100 hover:bg-bg-200/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[length:var(--fs-sm)] text-text-200 font-mono truncate" title={headerLabel}>
                      {headerLabel}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[length:var(--fs-xxs)] text-text-500 font-mono">
                      <span className="tabular-nums">{time}</span>
                      {assistantTokens !== null && (
                        <>
                          <span className="opacity-30">·</span>
                          <span className="flex items-center gap-1">
                            <CpuIcon size={10} className="opacity-60" />
                            {formatTokens(assistantTokens)}
                          </span>
                        </>
                      )}
                      {assistantCost !== null && assistantCost > 0 && (
                        <>
                          <span className="opacity-30">·</span>
                          <span className="flex items-center gap-1">
                            <DollarSignIcon size={10} className="opacity-60" />
                            {formatCost(assistantCost)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 text-text-400">
                    {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-3 bg-bg-000 border-t border-border-200/50">
                    <CodeBlock
                      code={JSON.stringify({ message: msg.info, parts: msg.parts }, null, 2)}
                      language="json"
                      maxHeight={420}
                      className="select-text"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}
