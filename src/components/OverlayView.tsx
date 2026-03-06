import { useState, useEffect, useCallback } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { addToHistory } from '../lib/transcription-history'
import { useI18n, AppLanguage } from '../i18n'
import { decodeAudioToFloat32 } from '../utils/audioUtils'


type OverlayState = 'idle' | 'recording' | 'processing'

// Toast notification component
function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000)
        return () => clearTimeout(timer)
    }, [onClose])

    return (
        <div className={`toast toast-${type}`}>
            <span className="toast-icon">
                {type === 'success' ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                )}
            </span>
            <span className="toast-message">{message}</span>
        </div>
    )
}

export function OverlayView() {
    const { t, language: i18nLang, setLanguage: setI18nLanguage } = useI18n()
    const [audioDeviceId, setAudioDeviceId] = useState<string>('')
    const { isRecording, duration, startRecording, stopRecording } = useAudioRecorder({ deviceId: audioDeviceId })
    const [state, setState] = useState<OverlayState>('idle')
    const [error, setError] = useState<string | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)
    const [transcriptionEngine, setTranscriptionEngine] = useState<'gemini' | 'whisper'>('gemini')

    const [recordingDuration, setRecordingDuration] = useState(0)
    // Preserve recording data during API errors
    const [preservedBlob, setPreservedBlob] = useState<Blob | null>(null)

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type })
    }, [])

    const handleStartRecording = useCallback(async () => {
        try {
            setError(null)
            setState('recording')
            setIsVisible(true)
            await startRecording()
        } catch {
            showToast(t('overlay.microphoneAccessError'), 'error')
            setState('idle')
        }
    }, [startRecording, showToast, t])

    const handleStopAndTranscribe = useCallback(async () => {
        const blob = await stopRecording()
        // Capture duration before resetting
        const currentDuration = duration
        if (!blob || blob.size < 1000) {
            showToast(t('overlay.noAudioDetected'), 'error')
            setState('idle')
            return
        }
        // Preserve the recording blob for retry
        setPreservedBlob(blob)
        setRecordingDuration(currentDuration)
        setState('processing')
        try {
            let result: { success: boolean; text?: string; error?: string }
            if (transcriptionEngine === 'whisper') {
                const pcmData = await decodeAudioToFloat32(blob)
                result = await window.electronAPI.transcribeWhisperAudio(pcmData, '')
            } else {
                const arrayBuffer = await blob.arrayBuffer()
                result = await window.electronAPI.transcribeAudio(arrayBuffer, '')
            }
            if (result.success && result.text) {
                const trimmedText = result.text.trim()
                addToHistory({
                    duration: currentDuration,
                    language: '',
                    originalText: trimmedText,
                    wordCount: trimmedText.split(/\s+/).filter(Boolean).length,
                })
                window.electronAPI.injectText(trimmedText)
                setPreservedBlob(null)
                setState('idle')
            } else {
                showToast(result.error || t('overlay.transcriptionError'), 'error')
                setState('idle')
            }
        } catch {
            showToast(t('overlay.apiConnectionError'), 'error')
            setState('idle')
        }
    }, [stopRecording, duration, showToast, t, transcriptionEngine])



    // Retry transcription with preserved recording data
    const handleRetryTranscription = useCallback(async () => {
        if (!preservedBlob) return

        setState('processing')
        try {
            let result: { success: boolean; text?: string; error?: string }
            if (transcriptionEngine === 'whisper') {
                const pcmData = await decodeAudioToFloat32(preservedBlob)
                result = await window.electronAPI.transcribeWhisperAudio(pcmData, '')
            } else {
                const arrayBuffer = await preservedBlob.arrayBuffer()
                result = await window.electronAPI.transcribeAudio(arrayBuffer, '')
            }
            if (result.success && result.text) {
                const trimmedText = result.text.trim()
                addToHistory({
                    duration: recordingDuration,
                    language: '',
                    originalText: trimmedText,
                    wordCount: trimmedText.split(/\s+/).filter(Boolean).length,
                })
                window.electronAPI.injectText(trimmedText)
                setPreservedBlob(null)
                setState('idle')
            } else {
                showToast(result.error || t('overlay.transcriptionError'), 'error')
                setState('idle')
            }
        } catch {
            showToast(t('overlay.apiConnectionError'), 'error')
            setState('idle')
        }
    }, [preservedBlob, showToast, t, transcriptionEngine])

    useEffect(() => {
        if (!window.electronAPI) return
        window.electronAPI.getConfig().then((config) => {
            if (config.audioDeviceId) setAudioDeviceId(config.audioDeviceId)
            if (config.transcriptionEngine) setTranscriptionEngine(config.transcriptionEngine)
        })

        const cleanupToggle = window.electronAPI.onToggleRecording((shouldRecord: boolean) => {
            if (shouldRecord) {
                handleStartRecording()
            } else {
                handleStopAndTranscribe()
            }
        })

        const cleanupInjection = window.electronAPI.onInjectionComplete((result) => {
            if (result.success) {
                setTimeout(() => {
                    setIsVisible(false)
                    setState('idle')
                }, 300)
            }
        })

        const cleanupConfigUpdate = window.electronAPI.onConfigUpdated((partial) => {
            if (partial.language) {
                setI18nLanguage(partial.language as AppLanguage)
            }
        })

        return () => {
            cleanupToggle()
            cleanupInjection()
            cleanupConfigUpdate()
        }
    }, [handleStartRecording, handleStopAndTranscribe, setI18nLanguage])

    useEffect(() => {
        const cleanupForceStop = window.electronAPI.onForceStopRecording(() => {
            if (state === 'recording') {
                handleStopAndTranscribe()
            }
        })
        const cleanupForceCancel = window.electronAPI.onForceCancelRecording(() => {
            if (state === 'recording') stopRecording()
            setIsVisible(false)
            setState('idle')
            setError(null)
            setPreservedBlob(null)
            window.electronAPI.cancelRecording()
        })
        return () => {
            cleanupForceStop()
            cleanupForceCancel()
        }
    }, [state, handleStopAndTranscribe, stopRecording])

    const handleCancel = () => {
        if (isRecording) stopRecording()
        setIsVisible(false)
        setState('idle')
        setError(null)
        setPreservedBlob(null)
        window.electronAPI.cancelRecording()
    }

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60)
        const secs = s % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (!isVisible) return null

    return (
        <div className="mini-overlay">
            {/* Toast notification - positioned at top to not block close button */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            <div className="mini-overlay-inner">
                <div className={`mic-icon ${state === 'recording' ? 'active' : ''} ${state === 'processing' ? 'processing' : ''}`}>
                    {state === 'processing' ? (
                        <div className="mini-spinner" />
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    )}
                </div>

                {state === 'recording' && (
                    <div className="mini-wave-container">
                        <div className="mini-wave-bar" style={{ animationDelay: '0s' }} />
                        <div className="mini-wave-bar" style={{ animationDelay: '0.12s' }} />
                        <div className="mini-wave-bar" style={{ animationDelay: '0.24s' }} />
                        <div className="mini-wave-bar" style={{ animationDelay: '0.36s' }} />
                        <div className="mini-wave-bar" style={{ animationDelay: '0.48s' }} />
                    </div>
                )}

                <span className="mini-timer">
                    {state === 'recording' && formatDuration(duration)}
                    {state === 'processing' && t('overlay.processing')}
                    {state === 'idle' && (
                        preservedBlob ? (
                            <button
                                className="mini-retry-btn"
                                onClick={handleRetryTranscription}
                                title={t('overlay.retry')}
                            >
                                {t('overlay.retry')}
                            </button>
                        ) : (
                            t('overlay.ready')
                        )
                    )}
                </span>

                <button className="mini-btn-close" onClick={handleCancel} title="Cancel">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

        </div>
    )
}
