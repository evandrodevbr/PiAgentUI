export interface OpenRouterModelEntry {
  id: string
  name: string
  description?: string | null
  context_length?: number | null
  architecture?: {
    modality?: string | null
    input_modalities?: string[] | null
    output_modalities?: string[] | null
    tokenizer?: string | null
    instruct_type?: string | null
  } | null
  pricing?: Record<string, string | undefined> | null
  top_provider?: {
    context_length?: number | null
    max_completion_tokens?: number | null
    is_moderated?: boolean | null
  } | null
  supported_parameters?: string[] | null
}

interface ModelQuery {
  modelID?: string
  providerID?: string
  modelName?: string
  contextWindow?: number
}

function normalize(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function providerFromOpenRouterId(id: string): string {
  return id.split('/')[0] ?? ''
}

function isFreeVariant(id: string): boolean {
  return id.endsWith(':free')
}

function scoreModel(entry: OpenRouterModelEntry, query: ModelQuery): number {
  const modelID = query.modelID ?? ''
  const providerID = query.providerID ?? ''
  const fullID = providerID && modelID ? `${providerID}/${modelID}` : modelID
  const normalizedEntryID = normalize(entry.id)
  const normalizedModelID = normalize(modelID)
  const normalizedFullID = normalize(fullID)
  const normalizedEntryName = normalize(entry.name)
  const normalizedModelName = normalize(query.modelName)

  let score = 0

  if (entry.id === fullID) score += 1000
  if (entry.id === modelID) score += 900
  if (normalizedEntryID === normalizedFullID) score += 700
  if (normalizedEntryID === normalizedModelID) score += 650
  if (modelID && entry.id.endsWith(`/${modelID}`)) score += 600
  if (normalizedModelID && normalizedEntryID.endsWith(normalizedModelID)) score += 450
  if (normalizedModelName && normalizedEntryName.includes(normalizedModelName)) score += 250

  const normalizedProvider = normalize(providerID)
  if (normalizedProvider && normalize(providerFromOpenRouterId(entry.id)) === normalizedProvider) score += 150

  if (query.contextWindow && entry.context_length) {
    const distance = Math.abs(entry.context_length - query.contextWindow) / query.contextWindow
    score += Math.max(0, 120 - distance * 120)
  }

  if (isFreeVariant(entry.id)) score -= 40

  return score
}

export function selectOpenRouterModel(
  catalog: OpenRouterModelEntry[],
  query: ModelQuery,
): OpenRouterModelEntry | undefined {
  let best: { entry: OpenRouterModelEntry; score: number } | undefined

  for (const entry of catalog) {
    const score = scoreModel(entry, query)
    if (score <= 0) continue
    if (!best || score > best.score) best = { entry, score }
  }

  return best?.entry
}

export function formatOpenRouterPricePerMillion(value: string | undefined): string {
  if (value === undefined) return '—'
  const perToken = Number(value)
  if (!Number.isFinite(perToken)) return '—'
  const perMillion = perToken * 1_000_000
  if (perMillion === 0) return '$0/M'
  if (perMillion < 0.01) return '<$0.01/M'
  return `$${perMillion
    .toFixed(perMillion >= 10 ? 2 : 4)
    .replace(/0+$/, '')
    .replace(/\.$/, '')}/M`
}

export function getModelProviderLabel(entry: OpenRouterModelEntry | undefined): string | undefined {
  if (!entry) return undefined
  const [provider] = entry.name.split(':')
  return provider?.trim() || providerFromOpenRouterId(entry.id) || undefined
}
