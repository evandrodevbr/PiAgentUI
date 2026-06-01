// ============================================
// Tool API - Decoupled
// ============================================

import { piClient } from './piClient'
import type { ToolIDs, ToolList } from '../types/api/tool'

/**
 * 获取工具 ID 列表
 */
export async function getToolIds(directory?: string): Promise<ToolIDs> {
  try {
    const q = `?directory=${encodeURIComponent(directory || '')}`
    const data = await piClient.get<{ ids: ToolIDs }>(`/api/tools/ids${q}`)
    return data.ids || []
  } catch {
    return []
  }
}

/**
 * 获取工具列表（带详细信息）
 */
export async function getTools(provider: string, model: string, directory?: string): Promise<ToolList> {
  try {
    const q = `?provider=${encodeURIComponent(provider)}&model=${encodeURIComponent(model)}&directory=${encodeURIComponent(directory || '')}`
    const data = await piClient.get<{ tools: ToolList }>(`/api/tools/list${q}`)
    return data.tools || []
  } catch {
    return []
  }
}
