// ============================================
// PTY API Stub - 终端管理
// Gracefully stubbed out for Pi Agent MVP
// ============================================

import type { Pty, PtyCreateParams, PtyUpdateParams } from '../types/api/pty'

interface PtyConnectUrlOptions {
  includeAuthInUrl?: boolean
  cursor?: number
}

/**
 * 获取所有 PTY 会话列表
 */
export async function listPtySessions(_directory?: string): Promise<Pty[]> {
  return []
}

/**
 * 创建新的 PTY 会话
 */
export async function createPtySession(_params: PtyCreateParams, _directory?: string): Promise<Pty> {
  throw new Error('PTY terminals are not supported in the Pi Agent MVP.')
}

/**
 * 获取单个 PTY 会话信息
 */
export async function getPtySession(_ptyId: string, _directory?: string): Promise<Pty> {
  throw new Error('PTY terminals are not supported in the Pi Agent MVP.')
}

/**
 * 更新 PTY 会话
 */
export async function updatePtySession(_ptyId: string, _params: PtyUpdateParams, _directory?: string): Promise<Pty> {
  throw new Error('PTY terminals are not supported in the Pi Agent MVP.')
}

/**
 * 删除 PTY 会话
 */
export async function removePtySession(_ptyId: string, _directory?: string): Promise<boolean> {
  return true
}

/**
 * 获取 PTY 连接 WebSocket URL
 */
export function getPtyConnectUrl(_ptyId: string, _directory?: string, _options?: PtyConnectUrlOptions): string {
  return ''
}
