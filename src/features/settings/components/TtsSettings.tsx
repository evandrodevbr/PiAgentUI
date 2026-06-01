import { useEffect, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { getTtsSettings, updateTtsSettings } from '../../../api/tts'
import type { TtsResponseFormat, TtsSettings as TtsSettingsData } from '../../../types/api/tts'
import { SettingRow, SettingsCard, SettingsSelect, Toggle } from './SettingsUI'

const inputClass =
  'w-full h-8 px-3 text-[length:var(--fs-sm)] bg-bg-000 border border-border-200/60 rounded-md focus:outline-none focus:border-accent-main-100/60 focus:ring-1 focus:ring-accent-main-100/20 text-text-100 placeholder:text-text-400 shadow-sm transition-colors'

const KOKORO_VOICES = [
  { value: 'pf_dora', label: 'pf_dora — Portuguese BR female' },
  { value: 'pm_alex', label: 'pm_alex — Portuguese BR male' },
  { value: 'pm_santa', label: 'pm_santa — Portuguese BR male' },
  { value: 'af_heart', label: 'af_heart — English US female' },
  { value: 'af_bella', label: 'af_bella — English US female' },
  { value: 'af_nicole', label: 'af_nicole — English US female' },
  { value: 'am_adam', label: 'am_adam — English US male' },
  { value: 'am_eric', label: 'am_eric — English US male' },
  { value: 'bf_alice', label: 'bf_alice — English UK female' },
  { value: 'bf_emma', label: 'bf_emma — English UK female' },
  { value: 'bm_daniel', label: 'bm_daniel — English UK male' },
  { value: 'bm_george', label: 'bm_george — English UK male' },
  { value: 'ef_dora', label: 'ef_dora — Spanish female' },
  { value: 'em_alex', label: 'em_alex — Spanish male' },
  { value: 'em_santa', label: 'em_santa — Spanish male' },
  { value: 'ff_siwis', label: 'ff_siwis — French female' },
  { value: 'if_sara', label: 'if_sara — Italian female' },
  { value: 'im_nicola', label: 'im_nicola — Italian male' },
  { value: 'jf_alpha', label: 'jf_alpha — Japanese female' },
  { value: 'jm_kumo', label: 'jm_kumo — Japanese male' },
  { value: 'zf_xiaobei', label: 'zf_xiaobei — Chinese female' },
  { value: 'zm_yunjian', label: 'zm_yunjian — Chinese male' },
]

export function TtsSettings() {
  const [settings, setSettings] = useState<TtsSettingsData | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getTtsSettings()
      .then(data => {
        if (!cancelled) setSettings(data)
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load text-to-speech settings')
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
        await updateTtsSettings({
          enabled: settings.enabled,
          providerKind: settings.providerKind,
          baseUrl: settings.baseUrl,
          apiKey: apiKey.trim() || undefined,
          apiKeyRequired: settings.apiKeyRequired,
          speechEndpoint: settings.speechEndpoint,
          model: settings.model,
          voice: settings.voice,
          responseFormat: settings.responseFormat,
          speed: settings.speed,
        }),
      )
      setApiKey('')
    } catch {
      setError('Unable to save text-to-speech settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (!settings) {
    return <div className="text-[length:var(--fs-sm)] text-text-400">Loading text-to-speech settings…</div>
  }

  return (
    <SettingsCard
      title="Text-to-speech"
      description="Choose the speech model and voice used by compatible TTS features."
    >
      <SettingRow
        label="Enable text-to-speech"
        description="Allows PiAgentUI to synthesize audio through your configured OpenAI-compatible speech endpoint."
        onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
      >
        <Toggle
          enabled={settings.enabled}
          onChange={() => setSettings({ ...settings, enabled: !settings.enabled })}
          ariaLabel="Enable text-to-speech"
        />
      </SettingRow>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
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
            value={settings.speechEndpoint}
            onChange={event => setSettings({ ...settings, speechEndpoint: event.target.value })}
            placeholder="/audio/speech"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[length:var(--fs-xs)] font-medium text-text-300">Model</span>
          <input
            className={inputClass}
            value={settings.model}
            onChange={event => setSettings({ ...settings, model: event.target.value })}
            placeholder="speaches-ai/Kokoro-82M-v1.0-ONNX"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[length:var(--fs-xs)] font-medium text-text-300">Voice</span>
          <SettingsSelect
            wrapperClassName="w-full"
            value={settings.voice}
            onChange={event => setSettings({ ...settings, voice: event.target.value })}
          >
            {KOKORO_VOICES.map(voice => (
              <option key={voice.value} value={voice.value}>
                {voice.label}
              </option>
            ))}
          </SettingsSelect>
        </label>
        <label className="space-y-1">
          <span className="text-[length:var(--fs-xs)] font-medium text-text-300">Response format</span>
          <SettingsSelect
            wrapperClassName="w-full"
            value={settings.responseFormat}
            onChange={event => setSettings({ ...settings, responseFormat: event.target.value as TtsResponseFormat })}
          >
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
            <option value="opus">Opus</option>
            <option value="aac">AAC</option>
            <option value="flac">FLAC</option>
            <option value="pcm">PCM</option>
          </SettingsSelect>
        </label>
        <label className="space-y-1">
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
        description="Turn this off for local servers such as Speaches that do not require bearer-token authentication."
        onClick={() => setSettings({ ...settings, apiKeyRequired: !settings.apiKeyRequired })}
      >
        <Toggle
          enabled={settings.apiKeyRequired}
          onChange={() => setSettings({ ...settings, apiKeyRequired: !settings.apiKeyRequired })}
          ariaLabel="Require text-to-speech API key"
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
          {isSaving ? 'Saving…' : 'Save text-to-speech settings'}
        </Button>
      </div>
    </SettingsCard>
  )
}
