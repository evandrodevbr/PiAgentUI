import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSessionStats } from './useSessionStats'

const useMessageStoreMock = vi.fn()

vi.mock('../store', () => ({
  useMessageStore: () => useMessageStoreMock(),
}))

describe('useSessionStats', () => {
  it('does not scan message text when actual usage is available', () => {
    const readText = vi.fn(() => 'large historical message')
    useMessageStoreMock.mockReturnValue({
      messages: [
        {
          info: {
            role: 'assistant',
            cost: 0,
            tokens: { input: 10, output: 5, reasoning: 0, cache: { read: 0, write: 0 } },
          },
          parts: [
            {
              type: 'text',
              get text() {
                return readText()
              },
            },
          ],
        },
      ],
    })

    const { result } = renderHook(() => useSessionStats(100))

    expect(result.current.contextUsed).toBe(15)
    expect(result.current.contextEstimated).toBe(false)
    expect(readText).not.toHaveBeenCalled()
  })

  it('switches to estimated context after a compaction turn', () => {
    useMessageStoreMock.mockReturnValue({
      messages: [
        {
          info: { id: 'user-1', role: 'user', time: { created: 1 } },
          parts: [{ type: 'text', text: 'hello world', id: 'p1', sessionID: 's1', messageID: 'user-1' }],
        },
        {
          info: {
            id: 'assistant-1',
            role: 'assistant',
            time: { created: 2 },
            parentID: 'user-1',
            modelID: 'model',
            providerID: 'provider',
            mode: 'chat',
            agent: 'default',
            path: { cwd: '/', root: '/' },
            cost: 0,
            tokens: { input: 12000, output: 800, reasoning: 200, cache: { read: 0, write: 0 } },
          },
          parts: [{ type: 'text', text: 'long reply', id: 'p2', sessionID: 's1', messageID: 'assistant-1' }],
        },
        {
          info: { id: 'user-2', role: 'user', time: { created: 3 } },
          parts: [{ type: 'compaction', id: 'p3', sessionID: 's1', messageID: 'user-2' }],
        },
        {
          info: {
            id: 'assistant-2',
            role: 'assistant',
            time: { created: 4 },
            parentID: 'user-2',
            modelID: 'model',
            providerID: 'provider',
            mode: 'compaction',
            agent: 'compaction',
            path: { cwd: '/', root: '/' },
            cost: 0,
            summary: true,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          },
          parts: [{ type: 'text', text: 'short summary', id: 'p4', sessionID: 's1', messageID: 'assistant-2' }],
        },
      ],
    })

    const { result } = renderHook(() => useSessionStats(200000))

    expect(result.current.contextEstimated).toBe(true)
    expect(result.current.contextUsed).toBeLessThan(12000)
    expect(result.current.contextUsed).toBeGreaterThan(0)
  })

  it('uses real runtime context usage when available', () => {
    useMessageStoreMock.mockReturnValue({
      messages: [
        {
          info: { id: 'user-1', role: 'user', time: { created: 1 } },
          parts: [{ type: 'text', text: 'hello world', id: 'p1', sessionID: 's1', messageID: 'user-1' }],
        },
      ],
    })

    const { result } = renderHook(() =>
      useSessionStats(128000, {
        available: true,
        tokens: 42000,
        contextWindow: 1000000,
        percent: 4.2,
        providerID: 'opencode-go',
        modelID: 'deepseek-v4-flash',
        modelName: 'DeepSeek V4 Flash',
        outputLimit: 384000,
      }),
    )

    expect(result.current.contextUsed).toBe(42000)
    expect(result.current.contextLimit).toBe(1000000)
    expect(result.current.contextPercent).toBe(4.2)
    expect(result.current.contextEstimated).toBe(false)
    expect(result.current.contextKnown).toBe(true)
    expect(result.current.contextSource).toBe('runtime')
    expect(result.current.providerID).toBe('opencode-go')
    expect(result.current.modelID).toBe('deepseek-v4-flash')
    expect(result.current.modelName).toBe('DeepSeek V4 Flash')
    expect(result.current.outputLimit).toBe(384000)
  })

  it('marks runtime context as unknown when Pi reports null tokens after compaction', () => {
    useMessageStoreMock.mockReturnValue({ messages: [] })

    const { result } = renderHook(() =>
      useSessionStats(128000, {
        available: true,
        tokens: null,
        contextWindow: 1000000,
        percent: null,
      }),
    )

    expect(result.current.contextUsed).toBe(0)
    expect(result.current.contextLimit).toBe(1000000)
    expect(result.current.contextPercent).toBe(0)
    expect(result.current.contextEstimated).toBe(false)
    expect(result.current.contextKnown).toBe(false)
    expect(result.current.contextSource).toBe('runtime')
    expect(result.current.contextStatus).toBe('unknown')
    expect(result.current.contextNotice).toBe('compacted')
  })

  it('marks context usage as warning and danger near the model limit', () => {
    useMessageStoreMock.mockReturnValue({ messages: [] })

    const warning = renderHook(() =>
      useSessionStats(128000, {
        available: true,
        tokens: 750000,
        contextWindow: 1000000,
        percent: 75,
      }),
    )
    expect(warning.result.current.contextStatus).toBe('warning')
    expect(warning.result.current.contextNotice).toBe('warning')

    const danger = renderHook(() =>
      useSessionStats(128000, {
        available: true,
        tokens: 920000,
        contextWindow: 1000000,
        percent: 92,
      }),
    )
    expect(danger.result.current.contextStatus).toBe('danger')
    expect(danger.result.current.contextNotice).toBe('danger')
  })
})
