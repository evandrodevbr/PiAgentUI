import { piClient } from './piClient'
import type { NetworkAccessInfo } from '../types/api/network'

export async function getNetworkAccess(): Promise<NetworkAccessInfo> {
  return await piClient.get<NetworkAccessInfo>('/api/network/access')
}

export async function updateNetworkAccess(lanAccessEnabled: boolean): Promise<NetworkAccessInfo> {
  return await piClient.post<NetworkAccessInfo>('/api/network/access', { lanAccessEnabled })
}
