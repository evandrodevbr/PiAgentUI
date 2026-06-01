interface ConnectTauriPtyParams {
  ptyId: string
  directory?: string
  cursor?: number
  onConnected: () => void
  onMessage: (chunk: string) => void
  onDisconnected: (info: { code?: number; reason?: string }) => void
  onError: (message: string) => void
}

export interface TauriPtyConnection {
  send: (data: string) => void
  close: () => void
}

export async function connectTauriPty({
  onError,
}: ConnectTauriPtyParams): Promise<TauriPtyConnection> {
  const msg = 'PTY terminals are not supported in the Pi Agent MVP.'
  setTimeout(() => onError(msg), 0)
  return {
    send(_data: string) {},
    close() {},
  }
}
