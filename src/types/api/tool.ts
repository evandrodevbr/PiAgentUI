export type ToolIDs = string[]

export interface ToolListItem {
  name: string
  description?: string
  inputSchema?: any
}

export type ToolList = ToolListItem[]
