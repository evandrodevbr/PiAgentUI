import { IconButton } from '../../../components/ui'
import { MicrophoneIcon, SpinnerIcon, StopIcon } from '../../../components/Icons'
import { useVoiceTranscription } from '../../../hooks/useVoiceTranscription'
import type { SttInsertMode } from '../../../types/api/stt'

interface VoiceInputButtonProps {
  disabled?: boolean
  onTranscription: (text: string, insertMode: SttInsertMode) => void
}

export function VoiceInputButton({ disabled = false, onTranscription }: VoiceInputButtonProps) {
  const { state, isAvailable, error, startRecording, stopRecording } = useVoiceTranscription({ onTranscription })
  const isRecording = state === 'recording'
  const isBusy = state === 'requesting-permission' || state === 'transcribing'
  const isDisabled = disabled || !isAvailable || isBusy

  if (!isAvailable && !error) return null

  if (isRecording) {
    return (
      <IconButton aria-label="Stop voice recording" variant="solid" onClick={stopRecording}>
        <StopIcon />
      </IconButton>
    )
  }

  return (
    <IconButton
      aria-label={error ? error : isBusy ? 'Transcribing voice' : 'Start voice recording'}
      disabled={isDisabled}
      onClick={startRecording}
      title={error || undefined}
      className={error ? 'text-danger-100 hover:text-danger-100' : undefined}
    >
      {isBusy ? <SpinnerIcon className="animate-spin" /> : <MicrophoneIcon />}
    </IconButton>
  )
}
