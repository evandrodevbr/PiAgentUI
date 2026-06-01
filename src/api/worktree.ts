// ============================================
// Worktree API Stub - Git Worktree
// Gracefully stubbed out for Pi Agent MVP
// ============================================

import type { Worktree, WorktreeCreateInput, WorktreeRemoveInput, WorktreeResetInput } from '../types/api/worktree'

/**
 * 获取所有 worktree 列表
 */
export async function listWorktrees(_directory?: string): Promise<string[]> {
  return []
}

/**
 * 创建新的 worktree
 */
export async function createWorktree(_params: WorktreeCreateInput, _directory?: string): Promise<Worktree> {
  throw new Error('Git worktrees are not supported in the Pi Agent MVP.')
}

/**
 * 删除 worktree
 */
export async function removeWorktree(_params: WorktreeRemoveInput, _directory?: string): Promise<boolean> {
  return true
}

/**
 * 重置 worktree
 */
export async function resetWorktree(_params: WorktreeResetInput, _directory?: string): Promise<boolean> {
  return true
}
