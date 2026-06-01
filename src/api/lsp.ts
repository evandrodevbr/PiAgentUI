// ============================================
// LSP API Stub - Language Server Protocol
// Gracefully stubbed out for Pi Agent MVP
// ============================================

export interface LSPStatus {
  running: boolean
  language?: string
  capabilities?: string[]
}

/**
 * 获取 LSP 服务状态
 */
export async function getLspStatus(_directory?: string): Promise<LSPStatus> {
  return { running: false }
}

export interface FormatterStatus {
  available: boolean
  name?: string
}

/**
 * 获取格式化器状态
 */
export async function getFormatterStatus(_directory?: string): Promise<FormatterStatus> {
  return { available: false }
}
