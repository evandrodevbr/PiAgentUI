export type FileNodeType = 'file' | 'directory' | string

export interface FileNode {
  name: string
  path: string
  type: FileNodeType
  children?: FileNode[]
  size?: number
  absolute?: string
  ignored?: boolean
}

export interface FilePatch {
  hunks: {
    header: string
    lines: string[]
  }[]
}

export type PatchHunk = {
  header: string
  lines: string[]
}

export interface FileContent {
  path: string
  text: string
  content?: string
  encoding?: string
  mimeType?: string
  patch?: FilePatch
}

export interface FileStatusItem {
  path: string
  status: 'modified' | 'added' | 'deleted' | string
  added: number
  removed: number
}

export interface FileDiff {
  file: string
  path?: string
  status: 'modified' | 'added' | 'deleted' | string
  before?: string
  after?: string
  additions: number
  deletions: number
  patch?: any
}

export interface SymbolRange {
  start: { line: number; character: number }
  end: { line: number; character: number }
}

export interface SymbolLocation {
  uri: string
  range: SymbolRange
}

export interface Symbol {
  name: string
  kind: string
  location: SymbolLocation
  containerName?: string
}
