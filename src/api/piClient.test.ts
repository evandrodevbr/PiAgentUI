import { describe, it, expect, vi, beforeEach } from 'vitest'
import { piClient } from './piClient'
import { serverStore } from '../store/serverStore'

describe('piClient Authenticated Fetch Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('builds headers with Bearer token if running in Pi Mode', async () => {
    vi.spyOn(serverStore, 'isPiMode').mockReturnValue(true)
    vi.spyOn(serverStore, 'getActiveToken').mockReturnValue('my-test-bearer-token')
    vi.spyOn(serverStore, 'getActiveBaseUrl').mockReturnValue('http://127.0.0.1:4000')

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))))

    const result = await piClient.get<{ ok: boolean }>('/api/test')
    expect(result.ok).toBe(true)

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:4000/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-test-bearer-token',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('throws backend JSON error messages instead of generic HTTP status text', async () => {
    vi.spyOn(serverStore, 'getActiveToken').mockReturnValue('my-test-bearer-token')
    vi.spyOn(serverStore, 'getActiveBaseUrl').mockReturnValue('http://127.0.0.1:4000')
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'fatal: not a git repository' }), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(piClient.get('/api/vcs/status')).rejects.toThrow('fatal: not a git repository')
  })
})
