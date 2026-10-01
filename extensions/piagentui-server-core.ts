import * as path from 'node:path'
import * as os from 'node:os'
import type { ServerResponse } from 'node:http'

/** Finish a failed request without sending headers twice or leaving a partial response open. */
export function sendInternalServerError(
  response: Pick<ServerResponse, 'headersSent' | 'writableEnded' | 'destroyed' | 'writeHead' | 'end' | 'destroy'>,
): void {
  if (response.writableEnded || response.destroyed) return
  if (response.headersSent) {
    response.destroy()
    return
  }
  response.writeHead(500, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ error: 'Internal Server Error' }))
}

/**
 * Checks if a host string matches a loopback host (localhost or 127.0.0.1 or ::1)
 */
export function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false

  // Handle bracketed IPv6 hosts (e.g. "[::1]" or "[::1]:3000")
  if (host.startsWith('[')) {
    const closingBracket = host.indexOf(']')
    if (closingBracket !== -1) {
      const hostname = host.slice(1, closingBracket)
      return hostname === '::1'
    }
  }

  // Handle port splitting for IPv4 or localhost
  const lastColon = host.lastIndexOf(':')
  let hostname = host
  if (lastColon !== -1) {
    const colonsCount = (host.match(/:/g) || []).length
    if (colonsCount === 1 || host.includes('localhost')) {
      hostname = host.slice(0, lastColon)
    }
  }

  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

/**
 * Validates the Authorization header against the expected bearer token
 */
export function validateBearerToken(authHeader: string | undefined, expectedToken: string): boolean {
  if (!authHeader || !expectedToken) return false
  if (!authHeader.startsWith('Bearer ')) return false
  const token = authHeader.substring(7).trim()
  return token === expectedToken
}

/**
 * Prevents path traversal out of the designated base directory
 */
export function preventPathTraversal(baseDir: string, relativePath: string): boolean {
  try {
    const resolvedBase = path.resolve(baseDir)
    const resolvedTarget = path.resolve(path.join(baseDir, relativePath))
    return resolvedTarget.startsWith(resolvedBase)
  } catch {
    return false
  }
}

/**
 * Validates both Host and Origin headers to be local/loopback only
 */
export function validateHostAndOrigin(host: string | undefined, origin: string | undefined): boolean {
  return validateHostAndOriginForAccess(host, origin, false)
}

function getHostname(host: string | undefined): string {
  if (!host) return ''
  if (host.startsWith('[')) {
    const closingBracket = host.indexOf(']')
    return closingBracket === -1 ? host : host.slice(1, closingBracket)
  }

  const lastColon = host.lastIndexOf(':')
  const colonsCount = (host.match(/:/g) || []).length
  if (lastColon !== -1 && colonsCount === 1) {
    return host.slice(0, lastColon)
  }
  return host
}

function isAllowedLanHost(host: string | undefined): boolean {
  const hostname = getHostname(host)
  if (!hostname || isLoopbackHost(hostname)) return false
  if (hostname === '0.0.0.0') return false
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return true
  return false
}

function isLikelyVirtualInterface(name: string, entry: os.NetworkInterfaceInfo): boolean {
  const normalizedName = name.toLowerCase()
  if (
    normalizedName.includes('wsl') ||
    normalizedName.includes('hyper-v') ||
    normalizedName.includes('vethernet') ||
    normalizedName.includes('default switch') ||
    normalizedName.includes('docker') ||
    normalizedName.includes('virtualbox') ||
    normalizedName.includes('vmware') ||
    normalizedName.includes('zerotier') ||
    normalizedName.includes('tailscale')
  ) {
    return true
  }

  // Hyper-V virtual adapters commonly use Microsoft's 00:15:5d OUI.
  return entry.mac.toLowerCase().startsWith('00:15:5d:')
}

export function validateHostAndOriginForAccess(
  host: string | undefined,
  origin: string | undefined,
  lanAccessEnabled: boolean,
): boolean {
  const hostAllowed = isLoopbackHost(host) || (lanAccessEnabled && isAllowedLanHost(host))
  if (!hostAllowed) return false

  if (origin) {
    try {
      const url = new URL(origin)
      const originAllowed = isLoopbackHost(url.host) || (lanAccessEnabled && isAllowedLanHost(url.host))
      if (!originAllowed) return false
    } catch {
      return false
    }
  }

  return true
}

export function getLocalNetworkUrls(port: number, interfaces?: NodeJS.Dict<os.NetworkInterfaceInfo[]>): string[] {
  if (!interfaces) {
    try {
      interfaces = os.networkInterfaces()
    } catch {
      // LAN discovery is best effort; local API access still works without it.
      return []
    }
  }
  const physicalUrls = new Set<string>()
  const fallbackUrls = new Set<string>()

  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries || []) {
      if (entry.internal || entry.family !== 'IPv4') continue
      if (!isAllowedLanHost(entry.address)) continue

      const url = `http://${entry.address}:${port}`
      if (isLikelyVirtualInterface(name, entry)) {
        fallbackUrls.add(url)
      } else {
        physicalUrls.add(url)
      }
    }
  }

  const urls = physicalUrls.size > 0 ? physicalUrls : fallbackUrls
  return Array.from(urls).sort()
}

export function validateSttBaseUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false
  try {
    const url = new URL(baseUrl)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Guards against oversized requests
 */
export function isRequestBodySizeAllowed(
  contentLength: string | undefined,
  maxBytes: number = 10 * 1024 * 1024,
): boolean {
  if (!contentLength) return true
  const size = parseInt(contentLength, 10)
  if (isNaN(size)) return false
  return size <= maxBytes
}
