import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useModels } from './useModels'

const { onServerChangeCallbacks, getActiveModelsMock } = vi.hoisted(() => ({
  onServerChangeCallbacks: [] as (() => void)[],
  getActiveModelsMock: vi.fn(),
}))

vi.mock('../store/serverStore', () => ({
  serverStore: {
    onServerChange: (callback: () => void) => {
      onServerChangeCallbacks.push(callback)
    }
  }
}))

vi.mock('../api', () => ({
  getActiveModels: (...args: unknown[]) => getActiveModelsMock(...args),
}))

describe('useModels', () => {
  beforeEach(() => {
    getActiveModelsMock.mockReset()
    // Reset singleton state by triggering the server change callbacks
    getActiveModelsMock.mockResolvedValue([])
    onServerChangeCallbacks.forEach(cb => cb())
    getActiveModelsMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('triggers models fetching on mount and transitions from loading to loaded', async () => {
    let resolvePromise!: (val: any) => void
    const fetchPromise = new Promise(resolve => {
      resolvePromise = resolve
    })
    getActiveModelsMock.mockReturnValue(fetchPromise)

    const { result } = renderHook(() => useModels())

    // Should immediately show loading
    expect(result.current.isLoading).toBe(true)
    expect(result.current.models).toEqual([])

    // Resolve models fetching
    await act(async () => {
      resolvePromise([{ id: 'gemini-1.5', name: 'Gemini 1.5', providerId: 'google' }])
      await fetchPromise
      // Allow react rendering cycles to flush
      await Promise.resolve()
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.models).toEqual([
      { id: 'gemini-1.5', name: 'Gemini 1.5', providerId: 'google' }
    ])
  })

  it('allows manual refetching of the models list', async () => {
    getActiveModelsMock.mockResolvedValue([
      { id: 'gemini-1.5', name: 'Gemini 1.5', providerId: 'google' }
    ])

    const { result } = renderHook(() => useModels())

    // Wait for initial load
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.models).toHaveLength(1)

    // Setup next refetch value
    getActiveModelsMock.mockResolvedValue([
      { id: 'gemini-1.5', name: 'Gemini 1.5', providerId: 'google' },
      { id: 'gemini-2.0', name: 'Gemini 2.0', providerId: 'google' }
    ])

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.models).toHaveLength(2)
    expect(result.current.models[1].id).toBe('gemini-2.0')
  })

  it('resets models list and triggers fetch when server switches', async () => {
    getActiveModelsMock.mockResolvedValue([
      { id: 'gemini-1.5', name: 'Gemini 1.5', providerId: 'google' }
    ])

    const { result } = renderHook(() => useModels())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.models).toHaveLength(1)

    // Switch server
    getActiveModelsMock.mockResolvedValue([
      { id: 'openai-gpt-4', name: 'GPT-4', providerId: 'openai' }
    ])

    await act(async () => {
      // Simulate server switch
      onServerChangeCallbacks.forEach(cb => cb())
      await Promise.resolve()
    })

    expect(result.current.models).toHaveLength(1)
    expect(result.current.models[0].id).toBe('openai-gpt-4')
  })
})
