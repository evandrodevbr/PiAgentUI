// ============================================
// Agent API Functions - Decoupled from SDK
// ============================================

import { piClient } from './piClient'
import type { ApiAgent } from './types'

/**
 * 获取 agent 列表
 */
export async function getAgents(_directory?: string): Promise<ApiAgent[]> {
  try {
    const data = await piClient.get<{ agents: ApiAgent[] }>('/api/agents')
    return data.agents || []
  } catch {
    return [
      { id: 'build', name: 'Build', description: 'Main coder agent', hidden: false, mode: 'chat' },
      { id: 'research', name: 'Research', description: 'Code researcher', hidden: false, mode: 'chat' },
    ]
  }
}

/**
 * 获取可选择的 agent 列表（过滤掉 hidden 的）
 */
export async function getSelectableAgents(directory?: string): Promise<ApiAgent[]> {
  const agents = await getAgents(directory)
  return agents.filter(agent => !agent.hidden)
}
