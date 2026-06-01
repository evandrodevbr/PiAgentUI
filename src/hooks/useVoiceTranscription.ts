import { useCallback, useEffect, useRef, useState } from 'react'
import { getSttSettings, transcribeAudio } from '../api/stt'
import type { SttInsertMode, SttSettings } from '../types/api/stt'

export type VoiceTranscriptionState = 'idle' | 'requesting-permission' | 'recording' | 'transcribing' | 'error'

interface UseVoiceTranscriptionOptions {
  onTranscription: (text: string, insertMode: SttInsertMode) => void
}

function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

export function useVoiceTranscription({ onTranscription }: UseVoiceTranscriptionOptions) {
  const [state, setState] = useState<VoiceTranscriptionState>('idle')
  const [settings, setSettings] = useState<SttSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const loadSettings = useCallback(async () => {
    const nextSettings = await getSttSettings()
    setSettings(nextSettings)
    return nextSettings
  }, [])

  useEffect(() => {
    let cancelled = false
    getSttSettings()
      .then(nextSettings => {
        if (!cancelled) setSettings(nextSettings)
      })
      .catch(() => {
        if (!cancelled) {
          setSettings(null)
          setError('Voice transcription settings unavailable')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  const startRecording = useCallback(async () => {
    if (state === 'recording' || state === 'requesting-permission' || state === 'transcribing') return
    setError(null)
    setState('requesting-permission')

    let activeSettings: SttSettings
    try {
      activeSettings = await loadSettings()
    } catch {
      setSettings(null)
      setError('Voice transcription settings unavailable')
      setState('error')
      return
    }

    if (!activeSettings.enabled || (activeSettings.apiKeyRequired && !activeSettings.apiKeyConfigured)) {
      setError('Voice transcription is not configured')
      setState('error')
      return
    }

    if (!isRecordingSupported()) {
      setError('Voice recording is not supported in this browser')
      setState('error')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported?.('audio/webm') ? 'audio/webm' : undefined
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        setState('transcribing')
        cleanupStream()
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
          const result = await transcribeAudio(blob)
          if (result.text.trim()) onTranscription(result.text, activeSettings.insertMode)
          setState('idle')
        } catch {
          setError('Voice transcription failed')
          setState('error')
        } finally {
          chunksRef.current = []
          recorderRef.current = null
        }
      }
      recorder.start()
      setState('recording')
    } catch {
      cleanupStream()
      setError('Microphone permission denied')
      setState('error')
    }
  }, [cleanupStream, loadSettings, onTranscription, state])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
  }, [])

  const resetError = useCallback(() => {
    setError(null)
    setState('idle')
  }, [])

  useEffect(() => cleanupStream, [cleanupStream])

  return {
    state,
    settings,
    error,
    isAvailable: isRecordingSupported(),
    startRecording,
    stopRecording,
    resetError,
  }
}
