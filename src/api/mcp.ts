// ============================================
// MCP API - Model Context Protocol
// ============================================

import type { MCPStatusResponse, McpServerConfig } from '../types/api/mcp'
import { piClient } from './piClient'

/**
 * 获取所有 MCP 服务器状态
 */
export async function getMcpStatus(_directory?: string): Promise<MCPStatusResponse> {
  return piClient.get<MCPStatusResponse>('/api/mcp/status')
}

/**
 * 添加 MCP 服务器
 */
export async function addMcpServer(_name: string, _config: McpServerConfig, _directory?: string): Promise<void> {
  throw new Error('MCP is not supported in the Pi Agent MVP.')
}

/**
 * 连接到 MCP 服务器
 */
export async function connectMcpServer(_name: string, _directory?: string): Promise<void> {
  throw new Error('MCP is not supported in the Pi Agent MVP.')
}

/**
 * 断开 MCP 服务器连接
 */
export async function disconnectMcpServer(_name: string, _directory?: string): Promise<void> {
  throw new Error('MCP is not supported in the Pi Agent MVP.')
}

/**
 * 开始 MCP 认证流程
 */
export function startMcpAuth(_name: string, _directory?: string): Promise<{ url: string }> {
  return Promise.reject(new Error('MCP authentication is not supported yet.'))
}

/**
 * 移除 MCP 认证
 */
export async function removeMcpAuth(_name: string, _directory?: string): Promise<void> {
  throw new Error('MCP is not supported in the Pi Agent MVP.')
}

/**
 * 完成 MCP OAuth 认证（使用授权码）
 */
export async function completeMcpAuth(_name: string, _code: string, _directory?: string): Promise<void> {
  throw new Error('MCP is not supported in the Pi Agent MVP.')
}

/**
 * 启动完整的 OAuth 认证流程
 */
export async function authenticateMcp(_name: string, _directory?: string): Promise<void> {
  throw new Error('MCP is not supported in the Pi Agent MVP.')
}
