import { serverStore } from '../store/serverStore'
import { isTauri } from '../utils/tauri'

let _tauriFetch: typeof globalThis.fetch | null = null

async function getTauriFetch(): Promise<typeof globalThis.fetch> {
  if (_tauriFetch) return _tauriFetch
  const mod = await import('@tauri-apps/plugin-http')
  _tauriFetch = mod.fetch as unknown as typeof globalThis.fetch
  return _tauriFetch
}

async function getFetch(): Promise<typeof globalThis.fetch> {
  if (isTauri()) {
    try {
      return await getTauriFetch()
    } catch {
      return globalThis.fetch
    }
  }
  return globalThis.fetch
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = serverStore.getActiveToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else {
    const auth = serverStore.getActiveAuth()
    if (auth?.password) {
      headers['Authorization'] = 'Basic ' + btoa(`${auth.username}:${auth.password}`)
    }
  }

  return headers
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  const fallback = `HTTP Error ${response.status}: ${response.statusText}`

  try {
    const text = await response.text()
    if (!text) return fallback

    try {
      const data = JSON.parse(text) as { error?: unknown; message?: unknown }
      if (typeof data.error === 'string' && data.error.trim()) return data.error
      if (typeof data.message === 'string' && data.message.trim()) return data.message
    } catch {
      // Plain-text backend errors are still more useful than the generic status text.
    }

    return text.trim() || fallback
  } catch {
    return fallback
  }
}

async function throwIfNotOk(response: Response): Promise<void> {
  if (response.ok) return
  throw new Error(await getResponseErrorMessage(response))
}

export const piClient = {
  async get<T>(path: string): Promise<T> {
    const baseUrl = serverStore.getActiveBaseUrl()
    const headers = buildHeaders()
    const f = await getFetch()

    const response = await f(`${baseUrl}${path}`, {
      method: 'GET',
      headers,
    })

    await throwIfNotOk(response)

    return (await response.json()) as T
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const baseUrl = serverStore.getActiveBaseUrl()
    const headers = buildHeaders()
    const f = await getFetch()

    const response = await f(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    await throwIfNotOk(response)

    return (await response.json()) as T
  },

  async delete<T>(path: string, body?: unknown): Promise<T> {
    const baseUrl = serverStore.getActiveBaseUrl()
    const headers = buildHeaders()
    const f = await getFetch()

    const response = await f(`${baseUrl}${path}`, {
      method: 'DELETE',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    await throwIfNotOk(response)

    return (await response.json()) as T
  },
}
