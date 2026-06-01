// ============================================
// File Search API Functions - Decoupled from SDK
// ============================================

import { piClient } from './piClient'
import { formatPathForApi } from '../utils/directoryUtils'
import type { FileNode, FileContent, FileStatusItem, SymbolInfo } from './types'
import { serverStore } from '../store/serverStore'

const ROOT_DIRECTORY_CACHE_TTL_MS = 10_000

const rootDirectoryCache = new Map<string, { data: FileNode[]; expiresAt: number }>()
const rootDirectoryInflight = new Map<string, Promise<FileNode[]>>()

function isRootDirectoryPath(path: string): boolean {
  return path === '' || path === '.' || path === './'
}

function getRootDirectoryCacheKey(directory?: string): string {
  return `${serverStore.getActiveServerId()}::${formatPathForApi(directory) ?? ''}`
}

async function fetchDirectory(path: string, directory?: string): Promise<FileNode[]> {
  const isAbsolute = /^[a-zA-Z]:/.test(path) || path.startsWith('/')
  const targetDir = isAbsolute ? path : (directory || '')
  const targetPath = isAbsolute ? '' : path

  try {
    const query = `?path=${encodeURIComponent(targetPath)}&directory=${encodeURIComponent(targetDir)}`
    const data = await piClient.get<{ files: FileNode[] }>(`/api/files/list${query}`)
    return data.files || []
  } catch {
    return []
  }
}

/**
 * 搜索文件或目录
 */
export async function searchFiles(
  query: string,
  options: {
    directory?: string
    type?: 'file' | 'directory'
    limit?: number
  } = {},
): Promise<string[]> {
  try {
    const q = `?query=${encodeURIComponent(query)}&directory=${encodeURIComponent(options.directory || '')}&type=${options.type || ''}&limit=${options.limit || ''}`
    const data = await piClient.get<{ files: string[] }>(`/api/find/files${q}`)
    return data.files || []
  } catch {
    return []
  }
}

/**
 * 列出目录内容
 */
export async function listDirectory(path: string, directory?: string): Promise<FileNode[]> {
  if (!isRootDirectoryPath(path)) {
    return fetchDirectory(path, directory)
  }

  const key = getRootDirectoryCacheKey(directory)
  const now = Date.now()
  const cached = rootDirectoryCache.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.data
  }

  const inflight = rootDirectoryInflight.get(key)
  if (inflight) {
    return inflight
  }

  const request = fetchDirectory(path === '' ? '.' : path, directory)
    .then(data => {
      rootDirectoryCache.set(key, { data, expiresAt: Date.now() + ROOT_DIRECTORY_CACHE_TTL_MS })
      return data
    })
    .finally(() => {
      rootDirectoryInflight.delete(key)
    })

  rootDirectoryInflight.set(key, request)
  return request
}

export async function prefetchRootDirectory(directory?: string): Promise<void> {
  await listDirectory('.', directory)
}

/**
 * 读取文件内容
 */
export async function getFileContent(path: string, directory?: string): Promise<FileContent> {
  try {
    const q = `?path=${encodeURIComponent(path)}&directory=${encodeURIComponent(directory || '')}`
    const data = await piClient.get<FileContent>(`/api/files/read${q}`)
    return {
      ...data,
      text: data.text ?? data.content ?? '',
      content: data.content ?? data.text ?? '',
    }
  } catch (e) {
    const errText = `Failed to load file content: ${e instanceof Error ? e.message : String(e)}`
    return {
      path,
      text: errText,
      content: errText,
    }
  }
}

/**
 * 获取文件 git 状态
 */
export async function getFileStatus(directory?: string): Promise<FileStatusItem[]> {
  try {
    const q = `?directory=${encodeURIComponent(directory || '')}`
    const data = await piClient.get<{ status: FileStatusItem[] }>(`/api/files/status${q}`)
    return data.status || []
  } catch {
    return []
  }
}

/**
 * 搜索代码符号
 */
export async function searchSymbols(query: string, directory?: string): Promise<SymbolInfo[]> {
  try {
    const q = `?query=${encodeURIComponent(query)}&directory=${encodeURIComponent(directory || '')}`
    const data = await piClient.get<{ symbols: SymbolInfo[] }>(`/api/find/symbols${q}`)
    return data.symbols || []
  } catch {
    return []
  }
}

/**
 * 搜索目录（便捷方法）
 */
export async function searchDirectories(query: string, baseDirectory?: string, limit: number = 50): Promise<string[]> {
  return searchFiles(query, {
    directory: baseDirectory,
    type: 'directory',
    limit,
  })
}
