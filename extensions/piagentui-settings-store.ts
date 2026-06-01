import * as fs from 'node:fs'
import * as path from 'node:path'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)
const { DatabaseSync } = nodeRequire('node:sqlite') as typeof import('node:sqlite')
type DatabaseSyncInstance = InstanceType<typeof DatabaseSync>

export type SttProviderKind = 'openai' | 'openai-compatible'
export type SttMode = 'file' | 'realtime'
export type SttInsertMode = 'append' | 'replace'
export type TtsResponseFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'

export type StoredSttSettings = {
  enabled?: boolean
  providerKind?: SttProviderKind
  mode?: SttMode
  baseUrl?: string
  apiKey?: string
  apiKeyRequired?: boolean
  transcriptionEndpoint?: string
  transcriptionModel?: string
  language?: string
  insertMode?: SttInsertMode
}

export type StoredTtsSettings = {
  enabled?: boolean
  providerKind?: SttProviderKind
  baseUrl?: string
  apiKey?: string
  apiKeyRequired?: boolean
  speechEndpoint?: string
  model?: string
  voice?: string
  responseFormat?: TtsResponseFormat
  speed?: number
}

export type PiAgentUiLocalSettings = {
  schemaVersion?: number
  network?: {
    lanAccessEnabled?: boolean
  }
  stt?: StoredSttSettings
  tts?: StoredTtsSettings
}

export interface PiAgentUiSettingsPaths {
  databasePath: string
  legacyJsonPath: string
}

type SettingsNamespace = 'network' | 'stt' | 'tts'

const SETTINGS_SCHEMA_VERSION = 1
const SETTINGS_KEYS: Record<SettingsNamespace, string> = {
  network: 'access',
  stt: 'settings',
  tts: 'settings',
}

export function resolvePiAgentUiSettingsPaths(
  homeDir = process.env.USERPROFILE || process.env.HOME || '',
): PiAgentUiSettingsPaths {
  const settingsDir = path.join(homeDir, '.pi', 'agent')
  return {
    databasePath: path.join(settingsDir, 'piagentui.db'),
    legacyJsonPath: path.join(settingsDir, 'piagentui-settings.json'),
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJsonObject(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value)
    return isObject(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function normalizeSettings(raw: unknown): PiAgentUiLocalSettings {
  if (!isObject(raw)) return {}
  const next: PiAgentUiLocalSettings = { schemaVersion: SETTINGS_SCHEMA_VERSION }

  if (isObject(raw.network)) {
    next.network = { lanAccessEnabled: raw.network.lanAccessEnabled === true }
  }
  if (isObject(raw.stt)) {
    next.stt = raw.stt as StoredSttSettings
  }
  if (isObject(raw.tts)) {
    next.tts = raw.tts as StoredTtsSettings
  }

  return next
}

function readLegacyJsonSettings(legacyJsonPath: string): PiAgentUiLocalSettings | null {
  try {
    if (!fs.existsSync(legacyJsonPath)) return null
    return normalizeSettings(JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8')))
  } catch {
    return null
  }
}

export class PiAgentUiSettingsStore {
  private readonly db: DatabaseSyncInstance

  constructor(private readonly paths: PiAgentUiSettingsPaths) {
    fs.mkdirSync(path.dirname(paths.databasePath), { recursive: true })
    this.db = new DatabaseSync(paths.databasePath)
    this.initialize()
    this.importLegacyJsonOnce()
  }

  close(): void {
    this.db.close()
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value?: string } | undefined
    return typeof row?.value === 'string' ? row.value : null
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO app_meta (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, Date.now())
  }

  getSettings(): PiAgentUiLocalSettings {
    return {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      network: this.getNamespace('network') as PiAgentUiLocalSettings['network'],
      stt: this.getNamespace('stt') as StoredSttSettings | undefined,
      tts: this.getNamespace('tts') as StoredTtsSettings | undefined,
    }
  }

  saveSettings(settings: PiAgentUiLocalSettings): void {
    const normalized = normalizeSettings(settings)
    this.db.exec('BEGIN')
    try {
      if (normalized.network) this.setNamespace('network', normalized.network)
      if (normalized.stt) this.setNamespace('stt', normalized.stt)
      if (normalized.tts) this.setNamespace('tts', normalized.tts)
      this.setMeta('schema_version', String(SETTINGS_SCHEMA_VERSION))
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private initialize(): void {
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA foreign_keys = ON')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (namespace, key)
      );
    `)
    this.setMeta('schema_version', String(SETTINGS_SCHEMA_VERSION))
  }

  private importLegacyJsonOnce(): void {
    if (this.getMeta('legacy_json_imported_at')) return
    const legacy = readLegacyJsonSettings(this.paths.legacyJsonPath)
    if (!legacy) return
    this.saveSettings(legacy)
    this.setMeta('legacy_json_imported_at', new Date().toISOString())
  }

  private getNamespace(namespace: SettingsNamespace): Record<string, unknown> | undefined {
    const row = this.db
      .prepare('SELECT value_json FROM settings WHERE namespace = ? AND key = ?')
      .get(namespace, SETTINGS_KEYS[namespace]) as { value_json?: string } | undefined
    return parseJsonObject(row?.value_json)
  }

  private setNamespace(namespace: SettingsNamespace, value: unknown): void {
    this.db
      .prepare(
        `INSERT INTO settings (namespace, key, value_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(namespace, key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(namespace, SETTINGS_KEYS[namespace], JSON.stringify(value), Date.now())
  }
}

export function createPiAgentUiSettingsStore(paths = resolvePiAgentUiSettingsPaths()): PiAgentUiSettingsStore {
  return new PiAgentUiSettingsStore(paths)
}
