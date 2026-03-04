import { useState, useEffect, useCallback } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { addToHistory } from '../lib/transcription-history'

const LANGUAGES = [
    { code: 'vi', label: 'VI' },
    { code: 'en', label: 'EN' },
    { code: 'ja', label: 'JA' },
    { code: 'ko', label: 'KO' },
    { code: 'zh', label: 'ZH' },
]

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
    const [audioDeviceId, setAudioDeviceId] = useState<string>('')
    const { isRecording, duration, startRecording, stopRecording } = useAudioRecorder({ deviceId: audioDeviceId })
    const [state, setState] = useState<OverlayState>('idle')
    const [language, setLanguage] = useState('vi')
    const [error, setError] = useState<string | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

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
            showToast('Microphone access error', 'error')
            setState('idle')
        }
    }, [startRecording, showToast])

    const handleStopAndTranscribe = useCallback(async () => {
        const blob = await stopRecording()
        // Capture duration before resetting
        const currentDuration = duration
        if (!blob || blob.size < 1000) {
            showToast('No audio detected', 'error')
            setState('idle')
            return
        }
        // Preserve the recording blob for retry
        setPreservedBlob(blob)
        setRecordingDuration(currentDuration)
        setState('processing')
        try {
            const arrayBuffer = await blob.arrayBuffer()
            const result = await window.electronAPI.transcribeAudio(arrayBuffer, language)
            if (result.success && result.text) {
                const trimmedText = result.text.trim()
                addToHistory({
                    duration: currentDuration,
                    language: language,
                    originalText: trimmedText,
                    wordCount: trimmedText.split(/\s+/).filter(Boolean).length,
                })
                window.electronAPI.injectText(trimmedText)
                setPreservedBlob(null)
                setState('idle')
            } else {
                showToast(result.error || 'Transcription error', 'error')
                setState('idle')
            }
        } catch {
            showToast('API connection error', 'error')
            setState('idle')
        }
    }, [stopRecording, duration, language, showToast])



    // Retry transcription with preserved recording data
    const handleRetryTranscription = useCallback(async () => {
        if (!preservedBlob) return

        setState('processing')
        try {
            const arrayBuffer = await preservedBlob.arrayBuffer()
            const result = await window.electronAPI.transcribeAudio(arrayBuffer, language)
            if (result.success && result.text) {
                const trimmedText = result.text.trim()
                addToHistory({
                    duration: recordingDuration,
                    language: language,
                    originalText: trimmedText,
                    wordCount: trimmedText.split(/\s+/).filter(Boolean).length,
                })
                window.electronAPI.injectText(trimmedText)
                setPreservedBlob(null)
                setState('idle')
            } else {
                showToast(result.error || 'Transcription error', 'error')
                setState('idle')
            }
        } catch {
            showToast('API connection error', 'error')
            setState('idle')
        }
    }, [preservedBlob, language, showToast])

    useEffect(() => {
        if (!window.electronAPI) return
        window.electronAPI.getConfig().then((config) => {
            if (config.language) setLanguage(config.language)
            if (config.audioDeviceId) setAudioDeviceId(config.audioDeviceId)
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

        return () => {
            cleanupToggle()
            cleanupInjection()
        }
    }, [handleStartRecording, handleStopAndTranscribe])

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
                    {state === 'processing' && 'Processing...'}
                    {state === 'idle' && (
                        preservedBlob ? (
                            <button
                                className="mini-retry-btn"
                                onClick={handleRetryTranscription}
                                title="Retry transcription"
                            >
                                Retry
                            </button>
                        ) : (
                            'Ready'
                        )
                    )}
                </span>

                <select
                    className="mini-lang"
                    value={language}
                    onChange={(e) => {
                        setLanguage(e.target.value)
                        window.electronAPI.saveConfig({ language: e.target.value })
                    }}
                >
                    {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                </select>

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
