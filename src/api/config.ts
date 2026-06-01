// ============================================
// Config API - 配置管理
// ============================================

import type { Config } from '../types/api/config'
import type { ProvidersResponse } from '../types/api/model'

/**
 * 获取当前配置
 */
export async function getConfig(_directory?: string): Promise<Config> {
  return {
    models: {},
    providers: {},
  } as unknown as Config
}

/**
 * 更新配置
 */
export async function updateConfig(config: Config, _directory?: string): Promise<Config> {
  return config
}

/**
 * 获取 provider 配置列表
 */
export async function getProviderConfigs(_directory?: string): Promise<ProvidersResponse> {
  return {
    providers: [
      {
        id: "google",
        name: "Google Gemini",
        models: [
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google" },
          { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google" }
        ],
        auth: {
          authorization: { configured: true }
        }
      },
      {
        id: "anthropic",
        name: "Anthropic Claude",
        models: [
          { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic" }
        ],
        auth: {
          authorization: { configured: true }
        }
      }
    ],
    default: {
      "google": "gemini-2.5-flash",
      "anthropic": "claude-3-5-sonnet"
    }
  }
}
