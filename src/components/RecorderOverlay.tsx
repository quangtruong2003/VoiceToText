import { useState, useEffect, useCallback } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'

const LANGUAGES = [
    { code: 'vi', label: 'Tiếng Việt' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'zh', label: '中文' },
]

type AppState = 'idle' | 'recording' | 'processing' | 'result' | 'settings'

export function RecorderOverlay() {
    const { isRecording, duration, startRecording, stopRecording } = useAudioRecorder()

    const [appState, setAppState] = useState<AppState>('idle')
    const [isVisible, setIsVisible] = useState(false)
    const [language, setLanguage] = useState('vi')
    const [transcript, setTranscript] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [apiKey, setApiKey] = useState('')
    const [apiKeyInput, setApiKeyInput] = useState('')

    const [isValidating, setIsValidating] = useState(false)

    const handleStartRecording = useCallback(async () => {
        try {
            setError(null)
            setTranscript('')
            setAppState('recording')
            await startRecording()
        } catch {
            setError('Không thể truy cập microphone')
            setAppState('idle')
        }
    }, [startRecording])

    const handleStopAndTranscribe = useCallback(async () => {
        const blob = await stopRecording()
        if (!blob || blob.size < 1000) {
            setError('Không có âm thanh được ghi')
            setAppState('idle')
            return
        }

        setAppState('processing')

        try {
            const arrayBuffer = await blob.arrayBuffer()
            const result = await window.electronAPI.transcribeAudio(arrayBuffer, language)

            if (result.success && result.text) {
                setTranscript(result.text)
                setAppState('result')
            } else {
                if (result.error === 'NO_API_KEY') {
                    setError('Chưa cấu hình API Key')
                    setAppState('settings')
                    return
                }
                if (result.error === 'INVALID_API_KEY') {
                    setError('API Key không hợp lệ')
                    setAppState('settings')
                    return
                }
                setError(result.error || 'Lỗi không xác định')
                setAppState('idle')
            }
        } catch (err) {
            setError('Lỗi kết nối tới API')
            setAppState('idle')
        }
    }, [stopRecording, language])

    useEffect(() => {
        window.electronAPI.getConfig().then((config) => {
            if (config.apiKey) setApiKey(config.apiKey)
            if (config.language) setLanguage(config.language)
        })

        const cleanupToggle = window.electronAPI.onToggleRecording((shouldRecord: boolean) => {
            if (shouldRecord) {
                setIsVisible(true)
                setError(null)
                setTranscript('')
                handleStartRecording()
            } else {
                handleStopAndTranscribe()
            }
        })

        const cleanupInjection = window.electronAPI.onInjectionComplete((result) => {
            if (result.success) {
                setTimeout(() => {
                    setIsVisible(false)
                    setAppState('idle')
                    setTranscript('')
                }, 500)
            }
        })

        return () => {
            cleanupToggle()
            cleanupInjection()
        }
    }, [handleStartRecording, handleStopAndTranscribe])

    useEffect(() => {
        const cleanupForceStop = window.electronAPI.onForceStopRecording(() => {
            if (appState === 'recording') {
                handleStopAndTranscribe()
            }
        })
        return cleanupForceStop
    }, [appState, handleStopAndTranscribe])

    const handleConfirm = useCallback(() => {
        if (transcript.trim()) {
            window.electronAPI.injectText(transcript.trim())
            setAppState('idle')
        }
    }, [transcript])

    // Auto-inject when result is ready
    useEffect(() => {
        if (appState === 'result' && transcript.trim()) {
            handleConfirm()
        }
    }, [appState, transcript, handleConfirm])

    const handleCancel = () => {
        if (isRecording) stopRecording()
        setIsVisible(false)
        setAppState('idle')
        setTranscript('')
        setError(null)
        window.electronAPI.cancelRecording()
    }

    const handleSaveApiKey = async () => {
        if (!apiKeyInput.trim()) return

        setError(null)
        setIsValidating(true)

        try {
            const result = await window.electronAPI.validateApiKey(apiKeyInput.trim())

            if (result.valid) {
                await window.electronAPI.saveConfig({ apiKey: apiKeyInput.trim(), language })
                setApiKey(apiKeyInput.trim())
                setAppState('idle')
            } else {
                setError(`Lỗi: ${result.error || 'N/A'}`)
            }
        } catch (err: any) {
            setError(`Lỗi kết nối: ${err.message || ''}`)
        } finally {
            setIsValidating(false)
        }
    }

    const formatDuration = (s: number) => {
        const mins = Math.floor(s / 60)
        const secs = s % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (!isVisible) return null

    return (
        <div className="overlay-container">
            <div className="overlay-card">
                <div className="overlay-header">
                    <div className="header-left">
                        <div className={`recording-dot ${appState === 'recording' ? 'active' : ''} ${appState === 'processing' ? 'processing' : ''}`} />
                        <span className="header-title">
                            {appState === 'recording' && `Đang ghi âm ${formatDuration(duration)}`}
                            {appState === 'processing' && 'Đang xử lý...'}
                            {appState === 'result' && 'Kết quả'}
                            {appState === 'settings' && 'Cài đặt'}
                            {appState === 'idle' && 'Voice to Text'}
                        </span>
                    </div>
                    <div className="header-right">
                        <select
                            className="language-select"
                            value={language}
                            onChange={(e) => {
                                setLanguage(e.target.value)
                                window.electronAPI.saveConfig({ apiKey, language: e.target.value })
                            }}
                        >
                            {LANGUAGES.map((l) => (
                                <option key={l.code} value={l.code}>{l.label}</option>
                            ))}
                        </select>
                        <button
                            className="btn-icon"
                            onClick={() => setAppState(appState === 'settings' ? 'idle' : 'settings')}
                            title="Cài đặt"
                        >
                            ⚙
                        </button>
                    </div>
                </div>

                <div className="transcript-area">
                    {appState === 'settings' && (
                        <div className="settings-panel">
                            <label className="settings-label">Gemini API Key</label>
                            <input
                                type="password"
                                className="settings-input"
                                placeholder="sk-..."
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                            />
                            <p className="settings-hint">
                                Lấy API key tại{' '}
                                <span className="link">aistudio.google.com/app/apikey</span>
                            </p>
                            {error && appState === 'settings' && (
                                <p className="error-text" style={{ marginTop: 0 }}>{error}</p>
                            )}
                            <button
                                className="btn btn-confirm btn-full"
                                onClick={handleSaveApiKey}
                                disabled={isValidating || !apiKeyInput.trim()}
                            >
                                {isValidating ? 'Đang kiểm tra...' : 'Kiểm tra & Lưu'}
                            </button>
                        </div>
                    )}

                    {appState === 'recording' && (
                        <div className="recording-visual">
                            <div className="wave-container">
                                <div className="wave-bar" style={{ animationDelay: '0s' }} />
                                <div className="wave-bar" style={{ animationDelay: '0.15s' }} />
                                <div className="wave-bar" style={{ animationDelay: '0.3s' }} />
                                <div className="wave-bar" style={{ animationDelay: '0.45s' }} />
                                <div className="wave-bar" style={{ animationDelay: '0.6s' }} />
                            </div>
                            <p className="placeholder-text">Hãy nói gì đó...</p>
                        </div>
                    )}

                    {appState === 'processing' && (
                        <div className="processing-visual">
                            <div className="spinner" />
                            <p className="placeholder-text">Đang nhận diện giọng nói...</p>
                        </div>
                    )}

                    {appState === 'result' && (
                        <p className="transcript-text">{transcript}</p>
                    )}

                    {appState === 'idle' && (
                        <p className="placeholder-text">
                            {error || (apiKey ? 'Nhấn Win+Alt+H để bắt đầu' : 'Cần cấu hình API Key')}
                        </p>
                    )}

                    {error && appState !== 'idle' && appState !== 'settings' && (
                        <p className="error-text">{error}</p>
                    )}
                </div>

                <div className="overlay-actions">
                    {appState === 'recording' && (
                        <>
                            <button className="btn btn-cancel" onClick={handleCancel}>Hủy</button>
                            <button className="btn btn-confirm" onClick={handleStopAndTranscribe}>
                                Dừng & Xử lý
                            </button>
                        </>
                    )}

                    {appState === 'result' && (
                        <>
                            <button className="btn btn-cancel" onClick={handleCancel}>Hủy</button>
                            <button className="btn btn-confirm" onClick={handleConfirm} disabled={!transcript.trim()}>
                                Nhập Text
                            </button>
                        </>
                    )}

                    {appState === 'processing' && (
                        <button className="btn btn-cancel btn-full" onClick={handleCancel}>Hủy</button>
                    )}

                    {(appState === 'idle' && !apiKey) && (
                        <button className="btn btn-confirm btn-full" onClick={() => setAppState('settings')}>
                            Cấu hình API Key
                        </button>
                    )}

                    {(appState === 'idle' && apiKey) && (
                        <>
                            <button className="btn btn-cancel" onClick={handleCancel}>Đóng</button>
                            <button className="btn btn-confirm" onClick={handleStartRecording}>Ghi âm</button>
                        </>
                    )}
                </div>

                <div className="shortcut-hint">Win + Alt + H để toggle</div>
            </div>
        </div>
    )
}
