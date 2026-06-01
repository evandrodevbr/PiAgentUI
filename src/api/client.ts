// ============================================
// API Client for Pi Agent Backend
// ============================================

import { piClient } from './piClient'
import { formatPathForApi } from '../utils/directoryUtils'
import type { ModelInfo, ApiProject, ApiPath } from './types'

// Re-export all types
export * from './types'

// Re-export from Attachment feature
export { fromFilePart, fromAgentPart } from '../features/attachment'

// Re-export from sub-modules
export * from './session'
export * from './message'
export * from './permission'
export * from './file'
export * from './agent'
export * from './skill'
export * from './events'
export * from './config'
export * from './vcs'
export * from './mcp'
export * from './pty'
export * from './worktree'
export * from './command'
export * from './global'
export * from './tool'
export * from './lsp'
export * from './extension'

// ============================================
// Model API Functions
// ============================================

export async function getActiveModels(_directory?: string): Promise<ModelInfo[]> {
  try {
    const data = await piClient.get<{ models: any[] }>('/api/models')
    return data.models.map(model => ({
      id: model.id,
      name: model.name || model.id,
      providerId: model.providerId ?? model.provider,
      providerName: model.providerName ?? model.provider,
      family: model.family ?? '',
      contextLimit: model.contextLimit ?? model.contextWindow ?? 128000,
      outputLimit: model.outputLimit ?? model.maxOutputTokens ?? model.maxTokens ?? 4096,
      supportsReasoning: model.supportsReasoning ?? model.reasoning ?? false,
      supportsImages: model.supportsImages ?? model.input?.includes('image') ?? false,
      supportsPdf: model.supportsPdf ?? false,
      supportsAudio: model.supportsAudio ?? false,
      supportsVideo: model.supportsVideo ?? false,
      supportsToolcall: model.supportsToolcall ?? true,
      variants: model.variants ?? [],
    }))
  } catch {
    return [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        providerId: 'google',
        providerName: 'google',
        family: '',
        contextLimit: 128000,
        outputLimit: 4096,
        supportsReasoning: true,
        supportsImages: true,
        supportsPdf: false,
        supportsAudio: false,
        supportsVideo: false,
        supportsToolcall: true,
        variants: [],
      },
    ]
  }
}

export async function getDefaultModels(_directory?: string): Promise<Record<string, string>> {
  return {
    google: 'gemini-2.5-flash',
    anthropic: 'claude-3-5-sonnet',
  }
}

// ============================================
// Project API Functions
// ============================================

export async function getCurrentProject(directory?: string): Promise<ApiProject> {
  return {
    id: 'default',
    name: 'Default Project',
    directory: formatPathForApi(directory),
  }
}

export async function getProjects(directory?: string): Promise<ApiProject[]> {
  return [
    {
      id: 'default',
      name: 'Default Project',
      directory: formatPathForApi(directory),
    },
  ]
}

export async function initGitProject(directory?: string): Promise<ApiProject> {
  return {
    id: 'default',
    name: 'Default Project',
    directory: formatPathForApi(directory),
  }
}

export async function updateProject(
  projectId: string,
  params: {
    name?: string
    icon?: { url?: string; override?: string; color?: string }
  },
  directory?: string,
): Promise<ApiProject> {
  return {
    id: projectId,
    name: params.name || 'Default Project',
    directory: formatPathForApi(directory),
  }
}

// ============================================
// Path API Functions
// ============================================

export async function getPath(): Promise<ApiPath> {
  return {
    home: '',
    path: '',
  }
}
