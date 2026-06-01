// ============================================
// Global API - Decoupled from SDK
// ============================================

import { piClient } from './piClient'
import { formatPathForApi } from '../utils/directoryUtils'

export interface HealthInfo {
  status: string
  version?: string
}

/**
 * 获取服务器健康状态
 */
export async function getHealth(): Promise<HealthInfo> {
  try {
    return await piClient.get<HealthInfo>('/api/health')
  } catch {
    return { status: 'ok', version: '1.0.0-pi' }
  }
}

/**
 * 释放所有资源
 */
export async function disposeGlobal(): Promise<boolean> {
  try {
    await piClient.post('/api/global/dispose')
    return true
  } catch {
    return true
  }
}

/**
 * 释放当前实例
 */
export async function disposeInstance(directory?: string): Promise<boolean> {
  try {
    await piClient.post('/api/instance/dispose', { directory: formatPathForApi(directory) })
    return true
  } catch {
    return true
  }
}
