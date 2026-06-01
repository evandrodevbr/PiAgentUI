export interface Worktree {
  directory?: string
  branch?: string
  head?: string
  prunable?: boolean
}

export interface WorktreeCreateInput {
  name: string
  directory?: string
}

export interface WorktreeRemoveInput {
  directory: string
}

export interface WorktreeResetInput {
  directory: string
}
