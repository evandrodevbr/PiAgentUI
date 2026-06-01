import { SttSettings } from './SttSettings'
import { TtsSettings } from './TtsSettings'

export function VoiceSettings() {
  return (
    <div className="space-y-4">
      <SttSettings />
      <TtsSettings />
    </div>
  )
}
