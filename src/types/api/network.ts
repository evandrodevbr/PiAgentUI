export interface NetworkAccessInfo {
  lanAccessEnabled: boolean
  port: number
  localUrl: string
  lanUrls: string[]
  primaryLanUrl: string | null
  browserLanUrl: string | null
}

export interface UpdateNetworkAccessRequest {
  lanAccessEnabled: boolean
}
