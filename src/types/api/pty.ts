export interface PtySize {
  cols: number
  rows: number
}

export interface Pty {
  id: string
  title: string
  command?: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  size?: PtySize
  status?: 'running' | 'exited' | string
}

export interface PtyCreateParams {
  title?: string
  command?: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  size?: PtySize
}

export interface PtyUpdateParams {
  title?: string
  size?: PtySize
}
