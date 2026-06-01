/* eslint-disable react-refresh/only-export-components -- exports shared helper with component */
// ============================================
// ChatArea - 聊天消息显示区域
// ============================================
//
// Normal column layout keeps DOM order and visual order aligned.
// - scrollTop=max is bottom
// - new messages append at the visual bottom
// - a small auto-scroll effect follows streaming only while already at bottom
// - IntersectionObserver on the top sentinel triggers history loading

import {
  useRef,
  useImperativeHandle,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { animate } from 'motion/mini'
import { MessageRenderer } from '../message'
import { messageStore } from '../../store'
import { useTheme } from '../../hooks/useTheme'
import type { Message } from '../../types/message'
import { RetryStatusInline, type RetryStatusInlineData } from './RetryStatusInline'
import { buildVisibleMessageEntries, getVisibleMessageForkTargetId } from './chatAreaVisibility'
import { AT_BOTTOM_THRESHOLD_PX } from '../../constants'
import { useChatViewport } from './chatViewport'

const MESSAGE_RENDER_ROOT_MARGIN = '150% 0px'
const STICKY_RENDER_MESSAGE_COUNT = 8
const ESTIMATED_USER_MESSAGE_HEIGHT = 72
const ESTIMATED_ASSISTANT_MESSAGE_HEIGHT = 160
const MAX_MEASURED_MESSAGE_HEIGHT_CACHE = 2000
const measuredMessageHeightCache = new Map<string, number>()

/** Stable no-op to avoid creating a new closure on every render. */
const NOOP = () => {}

function estimateMessageHeight(message: Message): number {
  if (message.info.role === 'user') {
    return Math.max(ESTIMATED_USER_MESSAGE_HEIGHT, message.parts.length * 40)
  }

  return Math.max(ESTIMATED_ASSISTANT_MESSAGE_HEIGHT, message.parts.length * 80)
}

function rememberMeasuredMessageHeight(cacheKey: string, height: number) {
  measuredMessageHeightCache.set(cacheKey, height)
  if (measuredMessageHeightCache.size <= MAX_MEASURED_MESSAGE_HEIGHT_CACHE) return

  const oldestKey = measuredMessageHeightCache.keys().next().value
  if (oldestKey) measuredMessageHeightCache.delete(oldestKey)
}

export function buildTurnDurationMap(messages: Message[], visibleMessages: Message[]): Map<string, number> {
  const map = new Map<string, number>()
  const visibleAssistantIds = new Set(
    visibleMessages.filter(message => message.info.role === 'assistant').map(message => message.info.id),
  )

  let currentUserCreated: number | null = null
  let currentVisibleAssistantId: string | null = null
  let currentLastCompleted: number | null = null

  const commitTurn = () => {
    if (currentUserCreated == null || currentVisibleAssistantId == null || currentLastCompleted == null) return
    map.set(currentVisibleAssistantId, currentLastCompleted - currentUserCreated)
  }

  for (const message of messages) {
    if (message.info.role === 'user') {
      commitTurn()
      currentUserCreated = message.info.time.created
      currentVisibleAssistantId = null
      currentLastCompleted = null
      continue
    }

    if (currentUserCreated == null || message.info.role !== 'assistant') continue

    if (visibleAssistantIds.has(message.info.id)) {
      currentVisibleAssistantId = message.info.id
    }
    if (message.info.time.completed != null) {
      currentLastCompleted = message.info.time.completed
    }
  }

  commitTurn()

  return map
}

interface ChatAreaProps {
  messages: Message[]
  sessionId?: string | null
  isStreaming?: boolean
  allowStreamingLayoutAnimation?: boolean
  loadState?: 'idle' | 'loading' | 'loaded' | 'error'
  hasMoreHistory?: boolean
  onLoadMore?: () => void | Promise<void>
  onUndo?: (userMessageId: string) => void
  onFork?: (message: Message, forkMessageId?: string) => void | Promise<void>
  canUndo?: boolean
  registerMessage?: (id: string, element: HTMLElement | null) => void
  retryStatus?: RetryStatusInlineData | null
  bottomPadding?: number
  onVisibleMessageIdsChange?: (ids: string[]) => void
  onAtBottomChange?: (atBottom: boolean) => void
}

export type ChatAreaHandle = {
  scrollToBottom: (instant?: boolean) => void
  scrollToBottomIfAtBottom: () => void
  scrollToLastMessage: () => void
  scrollToMessageIndex: (index: number) => void
  scrollToMessageId: (messageId: string) => void
}

export const ChatArea = memo(
  forwardRef<ChatAreaHandle, ChatAreaProps>(
    (
      {
        messages,
        sessionId,
        isStreaming: _isStreaming = false,
        allowStreamingLayoutAnimation = true,
        loadState = 'idle',
        onLoadMore,
        onUndo,
        onFork,
        canUndo,
        hasMoreHistory: _hasMoreHistory = false,
        registerMessage,
        retryStatus = null,
        bottomPadding = 0,
        onVisibleMessageIdsChange,
        onAtBottomChange,
      },
      ref,
    ) => {
      // ---- Refs ----
      const { t } = useTranslation('chat')
      const scrollRef = useRef<HTMLDivElement>(null)
      const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
      const topSentinelRef = useRef<HTMLDivElement>(null)
      const isAtBottomRef = useRef(true)
      const loadMoreRef = useRef(onLoadMore)
      useEffect(() => {
        loadMoreRef.current = onLoadMore
      }, [onLoadMore])
      const isLoadingRef = useRef(false)
      const [isLoadingMore, setIsLoadingMore] = useState(false)

      // Guard: 防止 session 初始加载时 sentinel 在视口内立即触发 loadMore。
      // 只有用户主动滚离底部后解除。
      const loadMoreBlockedRef = useRef(true)

      const { isWideMode } = useTheme()
      const { presentation } = useChatViewport()
      const atBottomThreshold = presentation.isCompact ? 150 : AT_BOTTOM_THRESHOLD_PX
      const messagePaddingClass = presentation.isCompact ? 'px-3' : 'px-5'

      // ---- Data ----
      const visibleMessageEntries = useMemo(() => buildVisibleMessageEntries(messages), [messages])
      const visibleMessages = useMemo(() => visibleMessageEntries.map(e => e.message), [visibleMessageEntries])
      const forkTargetIdMap = useMemo(
        () =>
          new Map(visibleMessageEntries.map(entry => [entry.message.info.id, getVisibleMessageForkTargetId(entry)])),
        [visibleMessageEntries],
      )

      const turnDurationMap = useMemo(
        () => buildTurnDurationMap(messages, visibleMessages),
        [messages, visibleMessages],
      )

      const messageMaxWidthClass = isWideMode ? 'max-w-[95%] xl:max-w-6xl' : 'max-w-2xl'
      const heightCacheScope = `${presentation.surfaceVariant}:${isWideMode ? 'wide' : 'normal'}`
      const stickyRenderIds = useMemo(
        () => new Set(visibleMessages.slice(-STICKY_RENDER_MESSAGE_COUNT).map(message => message.info.id)),
        [visibleMessages],
      )

      const setScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
        scrollRef.current = node
        setScrollRoot(prev => (prev === node ? prev : node))
      }, [])

      // ============================================
      // Scroll: isAtBottom tracking
      // ============================================

      useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const onScroll = () => {
          const hasOverflow = el.scrollHeight > el.clientHeight + 1
          const distFromBottom = Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop)
          const atBottom = !hasOverflow || distFromBottom <= atBottomThreshold
          const prev = isAtBottomRef.current
          isAtBottomRef.current = atBottom
          if (prev !== atBottom) onAtBottomChange?.(atBottom)

          // 用户滚离底部 → 解除 loadMore guard
          if (!atBottom) loadMoreBlockedRef.current = false
        }
        el.addEventListener('scroll', onScroll, { passive: true })
        return () => el.removeEventListener('scroll', onScroll)
      }, [atBottomThreshold, onAtBottomChange])

      // Follow new content while the user is already at the bottom.
      useEffect(() => {
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (!el || !isAtBottomRef.current) return
          el.scrollTop = el.scrollHeight
        })
      }, [visibleMessages, retryStatus, bottomPadding])

      // ============================================
      // Session switch: snap to bottom
      // ============================================

      const prevSessionIdRef = useRef(sessionId)
      useEffect(() => {
        if (sessionId === prevSessionIdRef.current) return
        prevSessionIdRef.current = sessionId
        isAtBottomRef.current = true
        loadMoreBlockedRef.current = true // 重置 guard
        onAtBottomChange?.(true)

        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (!el) return
          el.scrollTop = el.scrollHeight

          // 消息列表整体淡入 — 一次命令式 animate，零 React 开销
          animate(el, { opacity: [0, 1] }, { duration: 0.2, ease: 'easeOut' })
        })
      }, [sessionId, onAtBottomChange])

      // 加载完成后 snap to bottom
      useEffect(() => {
        if (loadState !== 'loaded') return
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (el && isAtBottomRef.current) el.scrollTop = el.scrollHeight
        })
      }, [loadState])

      // ============================================
      // Load more: IntersectionObserver on top sentinel
      // ============================================
      // Normal column layout requires scroll compensation after prepending history.

      useEffect(() => {
        const sentinel = topSentinelRef.current
        const root = scrollRef.current
        if (!sentinel || !root) return

        const observer = new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting || isLoadingRef.current) return
            if (loadMoreBlockedRef.current) return

            const fn = loadMoreRef.current
            if (!fn) return

            const sid = sessionId
            if (!sid) return
            const hasMore = messageStore.getSessionState(sid)?.hasMoreHistory ?? false
            if (!hasMore) return

            isLoadingRef.current = true
            setIsLoadingMore(true)
            const prevScrollHeight = root.scrollHeight

            Promise.resolve(fn()).finally(() => {
              requestAnimationFrame(() => {
                root.scrollTop += root.scrollHeight - prevScrollHeight
              })
              isLoadingRef.current = false
              setIsLoadingMore(false)
            })
          },
          { root, rootMargin: '200px 0px 0px 0px' },
        )

        observer.observe(sentinel)
        return () => observer.disconnect()
      }, [sessionId, visibleMessages])

      // History prepend is compensated in the load-more callback above.

      // ============================================
      // Visible message tracking (for outline)
      // ============================================

      const onVisibleIdsChangeRef = useRef(onVisibleMessageIdsChange)
      useEffect(() => {
        onVisibleIdsChangeRef.current = onVisibleMessageIdsChange
      }, [onVisibleMessageIdsChange])

      useEffect(() => {
        const root = scrollRef.current
        if (!root) return

        const visibleIds = new Set<string>()
        const observer = new IntersectionObserver(
          entries => {
            let changed = false
            for (const entry of entries) {
              const id = entry.target.getAttribute('data-message-id')
              if (!id) continue
              if (entry.isIntersecting) {
                if (!visibleIds.has(id)) {
                  visibleIds.add(id)
                  changed = true
                }
              } else if (visibleIds.has(id)) {
                visibleIds.delete(id)
                changed = true
              }
            }
            if (changed) {
              onVisibleIdsChangeRef.current?.(Array.from(visibleIds))
            }
          },
          { root, rootMargin: '100% 0px' },
        )

        // Observe all current message elements
        const elements = root.querySelectorAll<HTMLElement>('[data-message-id]')
        elements.forEach(el => observer.observe(el))

        return () => observer.disconnect()
      }, [visibleMessages])

      // ============================================
      // Imperative Handle
      // ============================================

      useImperativeHandle(
        ref,
        () => ({
          scrollToBottom: (instant = false) => {
            const el = scrollRef.current
            if (!el) return
            el.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' })
          },
          scrollToBottomIfAtBottom: () => {
            const el = scrollRef.current
            if (!el) return
            // 自动跟随使用严格贴底判定，避免用户刚开始向上滚时还在宽松阈值内被抢回去。
            const distFromBottom = Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop)
            if (distFromBottom > 2) return
            el.scrollTop = el.scrollHeight
          },
          scrollToLastMessage: () => {
            if (visibleMessages.length === 0) return
            const lastId = visibleMessages[visibleMessages.length - 1].info.id
            scrollRef.current
              ?.querySelector(`[data-message-id="${lastId}"]`)
              ?.scrollIntoView({ block: 'end', behavior: 'auto' })
          },
          scrollToMessageIndex: (index: number) => {
            const msg = visibleMessages[index]
            if (!msg) return
            scrollRef.current
              ?.querySelector(`[data-message-id="${msg.info.id}"]`)
              ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
          },
          scrollToMessageId: (messageId: string) => {
            scrollRef.current
              ?.querySelector(`[data-message-id="${messageId}"]`)
              ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
          },
        }),
        [visibleMessages],
      )

      // ============================================
      // Render
      // ============================================

      // 将连续助手消息分组，共享容器渲染（浑然一体）
      const messageGroups = useMemo(() => {
        const groups: Message[][] = []
        for (const msg of visibleMessages) {
          const prev = groups[groups.length - 1]
          if (prev && msg.info.role === 'assistant' && prev[0].info.role === 'assistant') {
            prev.push(msg)
          } else {
            groups.push([msg])
          }
        }
        return groups
      }, [visibleMessages])

      const renderMessageGroup = useCallback(
        (messages: Message[]) => {
          const isUser = messages[0].info.role === 'user'
          return (
            <div
              className={`w-full ${messageMaxWidthClass} mx-auto ${messagePaddingClass} py-3 transition-[max-width] duration-300 ease-in-out`}
            >
              <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`min-w-0 group ${!isUser ? 'w-full' : ''} flex flex-col gap-2`}>
                  {messages.map(msg => (
                    <ViewportMessageItem
                      key={msg.info.id}
                      messageId={msg.info.id}
                      scrollRoot={scrollRoot}
                      registerMessage={registerMessage}
                      forceRender={msg.isStreaming || stickyRenderIds.has(msg.info.id)}
                      estimatedHeight={estimateMessageHeight(msg)}
                      heightCacheKey={`${heightCacheScope}:${msg.info.id}`}
                    >
                      <MessageRenderer
                        message={msg}
                        allowStreamingLayoutAnimation={allowStreamingLayoutAnimation}
                        turnDuration={turnDurationMap.get(msg.info.id)}
                        onUndo={onUndo}
                        onFork={onFork}
                        forkMessageId={forkTargetIdMap.get(msg.info.id)}
                        canUndo={canUndo}
                        onEnsureParts={NOOP}
                      />
                    </ViewportMessageItem>
                  ))}
                </div>
              </div>
            </div>
          )
        },
        [
          scrollRoot,
          heightCacheScope,
          stickyRenderIds,
          registerMessage,
          onUndo,
          onFork,
          canUndo,
          messageMaxWidthClass,
          messagePaddingClass,
          turnDurationMap,
          forkTargetIdMap,
          allowStreamingLayoutAnimation,
        ],
      )

      return (
        <div className="h-full overflow-hidden contain-strict relative">
          {/* Session loading spinner — 延迟 150ms 显示，快速加载时不闪烁 */}
          {loadState === 'loading' && visibleMessages.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-text-400 session-loading-indicator">
                <span className="w-5 h-5 border-2 border-text-400/30 border-t-text-400 rounded-full animate-spin" />
                <span className="text-[length:var(--fs-base)]">{t('chatArea.loadingSession')}</span>
              </div>
            </div>
          )}

          <div
            ref={setScrollContainerRef}
            className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar contain-content flex flex-col"
          >
            {/* Top sentinel for loadMore (视觉最顶部) */}
            <div ref={topSentinelRef} className="h-px shrink-0" aria-hidden="true" />

            {/* Top spacing (视觉顶部) */}
            <div className="h-20 shrink-0" />

            {/* Loading more indicator (视觉顶部附近) */}
            {visibleMessages.length > 0 && isLoadingMore && (
              <div className="flex justify-center py-3 shrink-0">
                <div className="flex items-center gap-2 text-text-400 text-[length:var(--fs-sm)]">
                  <span className="w-3.5 h-3.5 border-2 border-text-400/30 border-t-text-400 rounded-full animate-spin" />
                  {t('chatArea.loadingHistory')}
                </div>
              </div>
            )}

            {/* Shim: flex-1 占满剩余空间，消息不满一屏时推到视觉底部 */}
            <div className="flex-1" />

            {/* Messages */}
            {messageGroups.map(group => {
              const first = group[0]
              return (
                <div key={first.info.id} className="shrink-0">
                  {renderMessageGroup(group)}
                </div>
              )
            })}

            {/* Retry status */}
            {retryStatus && (
              <div className={`w-full ${messageMaxWidthClass} mx-auto ${messagePaddingClass} shrink-0`}>
                <div className="flex justify-start">
                  <div className="w-full min-w-0">
                    <RetryStatusInline status={retryStatus} />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom spacing (视觉底部)：
             * 预留一块高 = inputBoxHeight + GAP 的空区，让最后一条消息不被贴底的 InputBox 遮住。
             * GAP 控制消息底部 (fork/copy 按钮一行) 到输入胶囊顶部的空白，
             * 保持偏宽松的留白，避免最后一条消息贴近输入区。 */}
            <div
              className="shrink-0"
              style={{
                height: bottomPadding > 0 ? `${bottomPadding + 48}px` : '256px',
              }}
            />
          </div>
        </div>
      )
    },
  ),
)

interface ViewportMessageItemProps {
  messageId: string
  scrollRoot: HTMLDivElement | null
  forceRender?: boolean
  estimatedHeight: number
  heightCacheKey: string
  registerMessage?: (id: string, element: HTMLElement | null) => void
  children: ReactNode
}

const ViewportMessageItem = memo(function ViewportMessageItem({
  messageId,
  scrollRoot,
  forceRender = false,
  estimatedHeight,
  heightCacheKey,
  registerMessage,
  children,
}: ViewportMessageItemProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [isNearViewport, setIsNearViewport] = useState(() => forceRender || typeof IntersectionObserver === 'undefined')
  const [measuredHeightState, setMeasuredHeightState] = useState(() => ({
    cacheKey: heightCacheKey,
    height: measuredMessageHeightCache.get(heightCacheKey) ?? null,
  }))
  const measuredHeight =
    measuredHeightState.cacheKey === heightCacheKey
      ? measuredHeightState.height
      : (measuredMessageHeightCache.get(heightCacheKey) ?? null)

  const setWrapperElement = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node
      registerMessage?.(messageId, node)
    },
    [messageId, registerMessage],
  )

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || !scrollRoot) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(prev => (prev === entry.isIntersecting ? prev : entry.isIntersecting))
      },
      {
        root: scrollRoot,
        rootMargin: MESSAGE_RENDER_ROOT_MARGIN,
      },
    )

    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [scrollRoot])

  const shouldRender = forceRender || isNearViewport

  useEffect(() => {
    const content = contentRef.current
    if (!content || !shouldRender || typeof ResizeObserver === 'undefined') return

    const updateHeight = () => {
      const nextHeight = content.offsetHeight
      if (nextHeight <= 0) return
      setMeasuredHeightState(prev => {
        if (prev.cacheKey === heightCacheKey && prev.height !== null && Math.abs(prev.height - nextHeight) < 1)
          return prev
        rememberMeasuredMessageHeight(heightCacheKey, nextHeight)
        return { cacheKey: heightCacheKey, height: nextHeight }
      })
    }

    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(content)
    return () => observer.disconnect()
  }, [heightCacheKey, shouldRender])

  return (
    <div ref={setWrapperElement} data-message-id={messageId}>
      {shouldRender ? (
        <div ref={contentRef}>{children}</div>
      ) : (
        <div aria-hidden="true" style={{ height: `${measuredHeight ?? estimatedHeight}px` }} />
      )}
    </div>
  )
})
