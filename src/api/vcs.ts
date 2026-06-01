// ============================================
// VCS API - Decoupled
// ============================================

import { piClient } from './piClient'
import type { FileDiff } from './types'
import type {
  CheckoutGitBranchRequest,
  CommitGitChangesRequest,
  CreateGitBranchRequest,
  GitActionResponse,
  GitBranchesResponse,
  GitPathsRequest,
  GitStatusResponse,
  VcsDiffMode,
  VcsInfo,
} from '../types/api/vcs'
import { formatPathForApi } from '../utils/directoryUtils'

function directoryQuery(directory?: string): string {
  return `?directory=${encodeURIComponent(formatPathForApi(directory) || '')}`
}

/**
 * 获取 VCS 信息
 */
export async function getVcsInfo(directory?: string): Promise<VcsInfo | null> {
  try {
    return await piClient.get<VcsInfo>(`/api/vcs/info${directoryQuery(directory)}`)
  } catch {
    // VCS 不可用时返回 null
    return null
  }
}

/**
 * 获取 Git 或分支维度的 diff
 */
export async function getVcsDiff(mode: VcsDiffMode, directory?: string): Promise<FileDiff[]> {
  try {
    const q = `?mode=${mode}&directory=${encodeURIComponent(formatPathForApi(directory) || '')}`
    const data = await piClient.get<{ diff: FileDiff[] }>(`/api/vcs/diff${q}`)
    return data.diff || []
  } catch {
    return []
  }
}

export async function getVcsStatus(directory?: string): Promise<GitStatusResponse> {
  return await piClient.get<GitStatusResponse>(`/api/vcs/status${directoryQuery(directory)}`)
}

export async function getVcsBranches(directory?: string): Promise<GitBranchesResponse> {
  return await piClient.get<GitBranchesResponse>(`/api/vcs/branches${directoryQuery(directory)}`)
}

export async function checkoutGitBranch(
  request: CheckoutGitBranchRequest,
  directory?: string,
): Promise<GitActionResponse> {
  return await piClient.post<GitActionResponse>(`/api/vcs/checkout${directoryQuery(directory)}`, request)
}

export async function createGitBranch(request: CreateGitBranchRequest, directory?: string): Promise<GitActionResponse> {
  return await piClient.post<GitActionResponse>(`/api/vcs/branch${directoryQuery(directory)}`, request)
}

export async function stageGitPaths(request: GitPathsRequest, directory?: string): Promise<GitActionResponse> {
  return await piClient.post<GitActionResponse>(`/api/vcs/stage${directoryQuery(directory)}`, request)
}

export async function unstageGitPaths(request: GitPathsRequest, directory?: string): Promise<GitActionResponse> {
  return await piClient.post<GitActionResponse>(`/api/vcs/unstage${directoryQuery(directory)}`, request)
}

export async function commitGitChanges(
  request: CommitGitChangesRequest,
  directory?: string,
): Promise<GitActionResponse> {
  return await piClient.post<GitActionResponse>(`/api/vcs/commit${directoryQuery(directory)}`, request)
}

export async function pullGitBranch(directory?: string): Promise<GitActionResponse> {
  return await piClient.post<GitActionResponse>(`/api/vcs/pull${directoryQuery(directory)}`, undefined)
}

export async function pushGitBranch(directory?: string): Promise<GitActionResponse> {
  return await piClient.post<GitActionResponse>(`/api/vcs/push${directoryQuery(directory)}`, undefined)
}
