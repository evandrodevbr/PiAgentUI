import { formatPathForApi } from '../utils/directoryUtils'
import { piClient } from './piClient'
import type {
  ExtensionCatalog,
  ExtensionInstallResult,
  ExtensionPackageScope,
  ExtensionRemoveResult,
} from '../types/api/extension'

function withDirectoryQuery(path: string, directory?: string): string {
  const formatted = formatPathForApi(directory)
  return formatted ? `${path}?directory=${encodeURIComponent(formatted)}` : path
}

export async function getExtensions(directory?: string): Promise<ExtensionCatalog> {
  return await piClient.get<ExtensionCatalog>(withDirectoryQuery('/api/extensions', directory))
}

export async function installExtension(command: string, directory?: string): Promise<ExtensionInstallResult> {
  return await piClient.post<ExtensionInstallResult>('/api/extensions/install', {
    command,
    directory: formatPathForApi(directory),
  })
}

export async function removeExtensionPackage(
  source: string,
  scope: ExtensionPackageScope,
  directory?: string,
): Promise<ExtensionRemoveResult> {
  return await piClient.delete<ExtensionRemoveResult>('/api/extensions/package', {
    source,
    scope,
    directory: formatPathForApi(directory),
  })
}
