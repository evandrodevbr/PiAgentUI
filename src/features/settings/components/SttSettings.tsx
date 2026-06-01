import { useEffect, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { getSttSettings, updateSttSettings } from '../../../api/stt'
import type { SttInsertMode, SttProviderKind, SttSettings as SttSettingsData } from '../../../types/api/stt'
import { SettingRow, SettingsCard, SettingsSelect, Toggle } from './SettingsUI'

const inputClass =
  'w-full h-8 px-3 text-[length:var(--fs-sm)] bg-bg-000 border border-border-200/60 rounded-md focus:outline-none focus:border-accent-main-100/60 focus:ring-1 focus:ring-accent-main-100/20 text-text-100 placeholder:text-text-400 shadow-sm transition-colors'

export function SttSettings() {
  const [settings, setSettings] = useState<SttSettingsData | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getSttSettings()
      .then(data => {
        if (!cancelled) setSettings(data)
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load voice transcription settings')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function saveSettings() {
    if (!settings) return
    setIsSaving(true)
    setError('')
    try {
      setSettings(
        await updateSttSettings({
          enabled: settings.enabled,
          providerKind: settings.providerKind,
          mode: settings.mode,
          baseUrl: settings.baseUrl,
          apiKey: apiKey.trim() || undefined,
          apiKeyRequired: settings.apiKeyRequired,
          transcriptionEndpoint: settings.transcriptionEndpoint,
          transcriptionModel: settings.transcriptionModel,
          language: settings.language || null,
          insertMode: settings.insertMode,
        }),
      )
      setApiKey('')
    } catch {
      setError('Unable to save voice transcription settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (!settings) {
    return <div className="text-[length:var(--fs-sm)] text-text-400">Loading voice transcription settings…</div>
  }

  return (
    <SettingsCard
      title="Speech-to-text transcription"
      description="One complete microphone transcription setup. For Speaches, use http://127.0.0.1:8022/v1, /audio/transcriptions, your Whisper model, and turn API key requirement off."
    >
      <SettingRow
        label="Enable transcription"
        description="Shows the microphone button and sends recorded audio to the configured transcription endpoint."
        onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
      >
        <Toggle
          enabled={settings.enabled}
          onChange={() => setSettings({ ...settings, enabled: !settings.enabled })}
          ariaLabel="Enable voice transcription"
        />
      </SettingRow>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[length:var(--fs-xs)] font-medium text-text-300">Provider</span>
          <SettingsSelect
            wrapperClassName="w-full"
            value={settings.providerKind}
            onChange={event => setSettings({ ...settings, providerKind: event.target.value as SttProviderKind })}
          >
            <option value="openai-compatible">OpenAI-compatible / Speaches</option>
            <option value="openai">OpenAI</option>
          </SettingsSelect>
        </label>
        <label className="space-y-1">
          <span className="text-[length:var(--fs-xs)] font-medium text-text-300">Base URL</span>
          <input
            className={inputClass}
            value={settings.baseUrl}
            onChange={event => setSettings({ ...settings, baseUrl: event.target.value })}
            placeholder="http://127.0.0.1:8022/v1"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[length:var(--fs-xs)] font-medium text-text-300">Endpoint</span>
          <input
            className={inputClass}
            value={settings.transcriptionEndpoint}
            onChange={event => setSettings({ ...settings, transcriptionEndpoint: event.target.value })}
            placeholder="/audio/transcriptions"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[length:var(--fs-xs)] font-medium text-text-300">Model</span>
          <input
            className={inputClass}
            value={settings.transcriptionModel}
            onChange={event => setSettings({ ...settings, transcriptionModel: event.target.value })}
            placeholder="deepdml/faster-whisper-large-v3-turbo-ct2"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[length:var(--fs-xs)] font-medium text-text-300">Language</span>
          <input
            className={inputClass}
            value={settings.language || ''}
            onChange={event => setSettings({ ...settings, language: event.target.value || undefined })}
            placeholder="pt, en, es…"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[length:var(--fs-xs)] font-medium text-text-300">Insert mode</span>
          <SettingsSelect
            wrapperClassName="w-full"
            value={settings.insertMode}
            onChange={event => setSettings({ ...settings, insertMode: event.target.value as SttInsertMode })}
          >
            <option value="append">Append to prompt</option>
            <option value="replace">Replace prompt</option>
          </SettingsSelect>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-[length:var(--fs-xs)] font-medium text-text-300">API key</span>
          <input
            className={inputClass}
            type="password"
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
            placeholder={settings.apiKeyConfigured ? 'Configured — leave blank to keep' : 'Optional for local Speaches'}
          />
        </label>
      </div>

      <SettingRow
        className="mt-4"
        label="Require API key"
        description="Turn this off for local OpenAI-compatible servers such as Speaches that accept unauthenticated loopback requests."
        onClick={() => setSettings({ ...settings, apiKeyRequired: !settings.apiKeyRequired })}
      >
        <Toggle
          enabled={settings.apiKeyRequired}
          onChange={() => setSettings({ ...settings, apiKeyRequired: !settings.apiKeyRequired })}
          ariaLabel="Require voice transcription API key"
        />
      </SettingRow>

      {settings.apiKeyConfigured && !apiKey && (
        <p className="mt-3 text-[length:var(--fs-xs)] text-text-400">
          An API key is configured server-side and is not returned to the browser.
        </p>
      )}
      {error && <p className="mt-3 text-[length:var(--fs-xs)] text-danger-100">{error}</p>}

      <div className="mt-4 flex justify-end">
        <Button type="button" size="sm" onClick={saveSettings} isLoading={isSaving}>
          {isSaving ? 'Saving…' : 'Save transcription settings'}
        </Button>
      </div>
    </SettingsCard>
  )
}
