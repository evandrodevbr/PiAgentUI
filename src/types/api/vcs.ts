export interface VcsInfo {
  branch?: string
  dirty?: boolean
  default_branch?: string
}

export type VcsDiffMode = 'git' | 'branch'

export interface GitBranchInfo {
  name: string
  current: boolean
  remote: boolean
  upstream?: string
  commit?: string
}

export interface GitBranchesResponse {
  current?: string
  branches: GitBranchInfo[]
}

export interface GitStatusFile {
  path: string
  index: string
  workingTree: string
  staged: boolean
  unstaged: boolean
  untracked: boolean
}

export interface GitStatusResponse {
  branch?: string
  upstream?: string
  ahead: number
  behind: number
  dirty: boolean
  files: GitStatusFile[]
}

export interface GitActionResponse {
  ok: true
  stdout?: string
  stderr?: string
}

export interface CheckoutGitBranchRequest {
  branch: string
}

export interface CreateGitBranchRequest {
  name: string
}

export interface GitPathsRequest {
  paths: string[]
}

export interface CommitGitChangesRequest {
  message: string
}
