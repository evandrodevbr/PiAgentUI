export type ExtensionPackageScope = 'user' | 'project'
export type ExtensionPackageStatus = 'active' | 'inactive' | 'missing' | 'error'

export interface ExtensionResource {
  name: string
  path: string
  enabled: boolean
}

export interface ExtensionPackageResources {
  extensions: ExtensionResource[]
  skills: ExtensionResource[]
  prompts: ExtensionResource[]
  themes: ExtensionResource[]
}

export interface ExtensionPackageInfo {
  source: string
  scope: ExtensionPackageScope
  filtered: boolean
  installedPath?: string
  packageName?: string
  version?: string
  description?: string
  image?: string
  keywords?: string[]
  status: ExtensionPackageStatus
  error?: string
  resources: ExtensionPackageResources
}

export interface ExtensionCatalogSummary {
  total: number
  active: number
  inactive: number
  missing: number
  error: number
}

export interface ExtensionCatalog {
  packages: ExtensionPackageInfo[]
  summary: ExtensionCatalogSummary
}

export interface ExtensionInstallResult {
  source: string
  scope: ExtensionPackageScope
  reloadRequired: boolean
  stdout?: string
  stderr?: string
}

export interface ExtensionRemoveResult {
  source: string
  scope: ExtensionPackageScope
  reloadRequired: boolean
  stdout?: string
  stderr?: string
}
