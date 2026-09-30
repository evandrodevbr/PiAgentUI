import { useMemo } from 'react'
import { useMessageStore } from '../store'
import type { AssistantMessageInfo, Message, Part } from '../types/message'
export { formatTokens, formatCost } from './sessionStatsUtils'

export interface RuntimeContextUsage {
  available?: boolean
  tokens?: number | null
  contextWindow?: number | null
  percent?: number | null
  providerID?: string
  modelID?: string
  modelName?: string
  outputLimit?: number | null
}

export interface SessionStats {
  // Token 统计
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number

  // 费用
  totalCost: number

  // 上下文使用率（基于最后一条消息的 input tokens）
  contextUsed: number
  contextLimit: number
  contextPercent: number
  contextEstimated: boolean
  contextKnown: boolean
  contextSource: 'runtime' | 'tokens' | 'estimated'
  contextStatus: 'unknown' | 'normal' | 'warning' | 'danger'
  contextNotice: 'none' | 'compacted' | 'warning' | 'danger'
  providerID?: string
  modelID?: string
  modelName?: string
  outputLimit?: number | null
}

const COMPACTED_TOOL_PLACEHOLDER = '[Old tool result content cleared]'

function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4)
}

function charsFromUserPart(part: Part): number {
  if (part.type === 'text') return part.text.length
  if (part.type === 'file') return part.source?.text.value.length ?? 0
  if (part.type === 'agent') return part.source?.value.length ?? 0
  if (part.type === 'compaction') return 'What did we do so far?'.length
  if (part.type === 'subtask') return 'The following tool was executed by the user'.length
  return 0
}

function charsFromAssistantPart(part: Part): { assistant: number; tool: number } {
  if (part.type === 'text') return { assistant: part.text.length, tool: 0 }
  if (part.type === 'reasoning') return { assistant: part.text.length, tool: 0 }
  if (part.type !== 'tool') return { assistant: 0, tool: 0 }

  const state = part.state
  if (!state) return { assistant: 0, tool: 0 }

  const inputSize = Object.keys(state.input ?? {}).length * 16
  if (state.status === 'pending') return { assistant: 0, tool: inputSize + (state.raw?.length ?? 0) }
  if (state.status === 'completed') {
    const outputText = state.time?.compacted ? COMPACTED_TOOL_PLACEHOLDER : (state.output ?? '')
    return { assistant: 0, tool: inputSize + outputText.length }
  }
  if (state.status === 'error') return { assistant: 0, tool: inputSize + (state.error?.length ?? 0) }
  return { assistant: 0, tool: inputSize }
}

function estimateCurrentContext(messages: Message[]): number {
  const system = [...messages].reverse().find((msg): msg is Message & { info: { system?: string } } => {
    return msg.info.role === 'user' && typeof (msg.info as { system?: string }).system === 'string'
  })
  const systemChars = system ? ((system.info as { system?: string }).system ?? '').trim().length || 0 : 0

  let userChars = 0
  let assistantChars = 0
  let toolChars = 0

  for (const message of messages) {
    if (message.info.role === 'user') {
      for (const part of message.parts) userChars += charsFromUserPart(part)
      continue
    }

    if (message.info.role !== 'assistant') continue
    for (const part of message.parts) {
      const next = charsFromAssistantPart(part)
      assistantChars += next.assistant
      toolChars += next.tool
    }
  }

  return (
    estimateTokens(systemChars) + estimateTokens(userChars) + estimateTokens(assistantChars) + estimateTokens(toolChars)
  )
}

function shouldUseEstimatedContext(
  messages: Message[],
  lastAssistantWithTokensIndex: number,
  lastAssistantWithTokens: AssistantMessageInfo | null,
) {
  if (messages.length === 0) return false
  if (!lastAssistantWithTokens) return true
  if (lastAssistantWithTokens.summary) return true

  for (let i = Math.max(0, lastAssistantWithTokensIndex + 1); i < messages.length; i++) {
    const msg = messages[i]
    if (msg.parts.some(part => part.type === 'compaction')) return true
    if (msg.info.role === 'assistant' && (msg.info as AssistantMessageInfo).summary) return true
  }

  return false
}

function getContextStatus(
  contextKnown: boolean,
  contextPercent: number,
): Pick<SessionStats, 'contextStatus' | 'contextNotice'> {
  if (!contextKnown) return { contextStatus: 'unknown', contextNotice: 'compacted' }
  if (contextPercent >= 90) return { contextStatus: 'danger', contextNotice: 'danger' }
  if (contextPercent >= 70) return { contextStatus: 'warning', contextNotice: 'warning' }
  return { contextStatus: 'normal', contextNotice: 'none' }
}

/**
 * 计算当前 session 的统计信息
 * @param contextLimit 模型的上下文限制（从 ModelInfo 获取）
 */
export function useSessionStats(
  contextLimit: number = 200000,
  runtimeContext?: RuntimeContextUsage | null,
): SessionStats {
  const { messages } = useMessageStore()

  return useMemo(() => {
    const tokenTotal = (tokens?: AssistantMessageInfo['tokens']): number => {
      if (!tokens) return 0
      return (
        (tokens.input || 0) +
        (tokens.output || 0) +
        (tokens.reasoning || 0) +
        (tokens.cache?.read || 0) +
        (tokens.cache?.write || 0)
      )
    }

    let inputTokens = 0
    let outputTokens = 0
    let reasoningTokens = 0
    let cacheRead = 0
    let cacheWrite = 0
    let totalCost = 0
    let lastAssistantWithTokens: AssistantMessageInfo | null = null
    let lastAssistantWithTokensIndex = -1

    for (const msg of messages) {
      if (msg.info.role === 'assistant') {
        const info = msg.info as AssistantMessageInfo
        // 只统计有实际 tokens 数据的消息（跳过 streaming 中的空 tokens）
        const hasTokens = info.tokens && tokenTotal(info.tokens) > 0

        if (hasTokens && info.tokens) {
          inputTokens += info.tokens.input || 0
          outputTokens += info.tokens.output || 0
          reasoningTokens += info.tokens.reasoning || 0
          cacheRead += info.tokens.cache?.read || 0
          cacheWrite += info.tokens.cache?.write || 0
        }
        if (info.cost) {
          totalCost += info.cost
        }
      }
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.info.role !== 'assistant') continue
      const info = msg.info as AssistantMessageInfo
      if (tokenTotal(info.tokens) <= 0) continue
      lastAssistantWithTokens = info
      lastAssistantWithTokensIndex = i
      break
    }

    const totalTokens = inputTokens + outputTokens + reasoningTokens + cacheRead + cacheWrite

    const runtimeContextWindow =
      typeof runtimeContext?.contextWindow === 'number' && Number.isFinite(runtimeContext.contextWindow)
        ? runtimeContext.contextWindow
        : 0

    if (runtimeContext?.available && runtimeContextWindow > 0) {
      const runtimeTokens =
        typeof runtimeContext.tokens === 'number' && Number.isFinite(runtimeContext.tokens)
          ? runtimeContext.tokens
          : null
      const runtimePercent =
        typeof runtimeContext.percent === 'number' && Number.isFinite(runtimeContext.percent)
          ? runtimeContext.percent
          : runtimeTokens !== null
            ? (runtimeTokens / runtimeContextWindow) * 100
            : null

      const contextPercent = runtimePercent === null ? 0 : Math.min(100, Math.max(0, runtimePercent))
      const contextKnown = runtimeTokens !== null

      return {
        inputTokens,
        outputTokens,
        reasoningTokens,
        cacheRead,
        cacheWrite,
        totalTokens,
        totalCost,
        contextUsed: runtimeTokens ?? 0,
        contextLimit: runtimeContextWindow,
        contextPercent,
        contextEstimated: false,
        contextKnown,
        contextSource: 'runtime',
        ...getContextStatus(contextKnown, contextPercent),
        providerID: runtimeContext.providerID,
        modelID: runtimeContext.modelID,
        modelName: runtimeContext.modelName,
        outputLimit: runtimeContext.outputLimit,
      }
    }

    const contextEstimated = shouldUseEstimatedContext(messages, lastAssistantWithTokensIndex, lastAssistantWithTokens)
    const rawContextUsed = contextEstimated
      ? estimateCurrentContext(messages)
      : lastAssistantWithTokens
        ? tokenTotal(lastAssistantWithTokens.tokens)
        : estimateCurrentContext(messages)
    const contextUsed = Number.isFinite(rawContextUsed) ? rawContextUsed : 0
    const rawContextPercent = contextLimit > 0 ? (contextUsed / contextLimit) * 100 : 0
    const contextPercent = Number.isFinite(rawContextPercent) ? Math.min(100, Math.max(0, rawContextPercent)) : 0

    return {
      inputTokens,
      outputTokens,
      reasoningTokens,
      cacheRead,
      cacheWrite,
      totalTokens,
      totalCost,
      contextUsed,
      contextLimit,
      contextPercent,
      contextEstimated,
      contextKnown: true,
      contextSource: contextEstimated ? 'estimated' : 'tokens',
      ...getContextStatus(true, contextPercent),
      providerID: runtimeContext?.providerID,
      modelID: runtimeContext?.modelID,
      modelName: runtimeContext?.modelName,
      outputLimit: runtimeContext?.outputLimit,
    }
  }, [messages, contextLimit, runtimeContext])
}
