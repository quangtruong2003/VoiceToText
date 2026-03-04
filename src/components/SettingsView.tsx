import { useState, useEffect, useCallback, useRef } from 'react'
import { PerformanceDashboard } from './PerformanceDashboard'
import { HistoryView } from './HistoryView'
import { useAudioDevices } from '../hooks/useAudioDevices'

const LANGUAGES = [
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
]

// App version - will be loaded from config
const GITHUB_REPO = 'quangtruong2003/voice-to-text'

const API_PROVIDERS = [
    {
        id: 'google',
        label: 'Google',
        desc: 'Gemini API chính thức',
    },
    {
        id: 'antigravity',
        label: 'Antigravity',
        desc: 'Proxy server',
    },
    {
        id: 'custom',
        label: 'Custom',
        desc: 'Endpoint tùy chỉnh',
    },
]



function CollapsibleSection({
    title,
    icon,
    defaultOpen = false,
    children
}: {
    title: string
    icon: React.ReactNode
    defaultOpen?: boolean
    children: React.ReactNode
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const contentRef = useRef<HTMLDivElement>(null)

    return (
        <div className={`settings-section-group collapsible ${isOpen ? 'is-open' : ''}`}>
            <button
                className="section-toggle"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <span className="section-icon-wrap">{icon}</span>
                <span className="section-title">{title}</span>
                <span className={`section-arrow ${isOpen ? 'open' : ''}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </span>
            </button>
            <div
                className="section-content-animated"
                ref={contentRef}
                style={{
                    maxHeight: isOpen ? (contentRef.current?.scrollHeight || 500) + 'px' : '0px',
                }}
            >
                <div className="section-content-inner">
                    {children}
                </div>
            </div>
        </div>
    )
}

function ConnectionStatus({
    isValid,
    isChecking,
    error
}: {
    isValid: boolean | null
    isChecking: boolean
    error: string | null
}) {
    if (isChecking) {
        return (
            <div className="connection-status checking">
                <span className="status-spinner"></span>
                <span>Đang kiểm tra...</span>
            </div>
        )
    }

    if (isValid === null) {
        return (
            <div className="connection-status unknown">
                <span className="status-dot"></span>
                <span>Chưa kiểm tra</span>
            </div>
        )
    }

    return (
        <div className={`connection-status ${isValid ? 'valid' : 'invalid'}`}>
            <span className={`status-dot ${isValid ? 'valid' : 'invalid'}`}></span>
            <span>{isValid ? 'Đã kết nối' : 'Lỗi kết nối'}</span>
        </div>
    )
}

function Toast({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000)
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

export function SettingsView() {
    const [activeTab, setActiveTab] = useState<'settings' | 'api' | 'performance' | 'about'>('settings')
    const [apiKey, setApiKey] = useState('')
    const [apiKeyInput, setApiKeyInput] = useState('')
    const [customPrompt, setCustomPrompt] = useState('')
    const [language, setLanguage] = useState('vi')
    const [hasEnvKey, setHasEnvKey] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [isValid, setIsValid] = useState<boolean | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [apiType, setApiType] = useState<'google' | 'antigravity' | 'custom'>('google')
    const [customEndpoint, setCustomEndpoint] = useState('')
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)
    const [showApiKey, setShowApiKey] = useState(false)
    const [startWithWindows, setStartWithWindows] = useState(false)
    const [autoUpdate, setAutoUpdate] = useState(true)
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
    const [updateAvailable, setUpdateAvailable] = useState(false)
    const [lastUpdateCheck, setLastUpdateCheck] = useState<string | null>(null)
    const [appVersion, setAppVersion] = useState<string>('')

    // Punctuation & formatting settings
    const [punctuationSettings, setPunctuationSettings] = useState({
        autoCapitalize: true,
        addPeriodAtEnd: true,
        removeFillerWords: false,
        numberFormatting: 'none' as 'none' | 'digits' | 'words',
    })


    // Audio device state
    const { devices: audioDevices, selectedDeviceId: selectedAudioDevice, isLoading: audioDevicesLoading, selectDevice: setAudioDevice, reloadDevices: reloadAudioDevices } = useAudioDevices()

    // Toast function
    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type })
    }, [])

    // Hotkey customization state
    const [hotkey, setHotkey] = useState({ win: false, alt: false, ctrl: true, shift: false, key: 'Space' })
    const [isRecordingHotkey, setIsRecordingHotkey] = useState(false)

    useEffect(() => {
        if (!window.electronAPI) return
        window.electronAPI.getConfig().then((config) => {
            if (config.apiKey) {
                setApiKey(config.apiKey)
                setApiKeyInput(config.apiKey)
            }
            if (config.language) setLanguage(config.language)
            if (config.customPrompt) setCustomPrompt(config.customPrompt)
            if (config.hasEnvKey) setHasEnvKey(true)
            if (config.apiType) setApiType(config.apiType)
            if (config.customEndpoint) setCustomEndpoint(config.customEndpoint)
            if (config.startWithWindows !== undefined) setStartWithWindows(config.startWithWindows)
            if (config.autoUpdate !== undefined) setAutoUpdate(config.autoUpdate)
            if (config.lastUpdateCheck) setLastUpdateCheck(config.lastUpdateCheck)
            if (config.appVersion) setAppVersion(config.appVersion)
            if (config.punctuationSettings) {
                setPunctuationSettings(config.punctuationSettings)
            }

            if (config.hotkey) {
                const parts = config.hotkey.split('+')
                setHotkey({
                    win: parts.includes('Win'),
                    alt: parts.includes('Alt'),
                    ctrl: parts.includes('Control'),
                    shift: parts.includes('Shift'),
                    key: parts.find(p => !['Win', 'Alt', 'Control', 'Ctrl', 'Shift'].includes(p)) || 'Space'
                })
            }
        })
    }, [])

    const handleSaveApiKey = async () => {
        if (!apiKeyInput.trim()) return
        setError(null)
        setIsValidating(true)
        try {
            const result = await window.electronAPI.validateApiKey(apiKeyInput.trim())
            if (result.valid) {
                await window.electronAPI.saveConfig({
                    apiKey: apiKeyInput.trim(),
                    language,
                    apiType,
                    customEndpoint
                })
                setApiKey(apiKeyInput.trim())
                setIsValid(true)
                showToast('Đã lưu API Key!', 'success')
            } else {
                setIsValid(false)
                setError(`API Key không hợp lệ: ${result.error || 'N/A'}`)
                showToast('API Key không hợp lệ', 'error')
            }
        } catch (err: any) {
            setIsValid(false)
            setError(`Lỗi kết nối: ${err.message || ''}`)
            showToast('Lỗi kết nối', 'error')
        } finally {
            setIsValidating(false)
        }
    }

    const handleSavePrompt = async () => {
        await window.electronAPI.saveConfig({ customPrompt })
        showToast('Đã lưu Prompt!', 'success')
    }

    const handleLanguageChange = async (newLang: string) => {
        setLanguage(newLang)
        await window.electronAPI.saveConfig({ language: newLang })
        showToast('Đã lưu ngôn ngữ!', 'success')
    }

    const handleStartWithWindowsChange = async (enabled: boolean) => {
        setStartWithWindows(enabled)
        const result = await window.electronAPI.setStartWithWindows(enabled)
        if (result.success) {
            showToast(enabled ? 'Đã bật khởi động cùng Windows!' : 'Đã tắt khởi động cùng Windows!', 'success')
        } else {
            setStartWithWindows(!enabled)
            showToast(`Lỗi: ${result.error || 'Không thể thay đổi cài đặt'}`, 'error')
        }
    }

    // App version for about tab
    // App version - loaded from config (Electron)

    // Check for updates
    const checkForUpdate = useCallback(async () => {
        setIsCheckingUpdate(true)
        setUpdateAvailable(false)
        try {
            const result = await window.electronAPI.checkForUpdate()
            if (result.updateAvailable) {
                setUpdateAvailable(true)
                showToast('Có bản cập nhật mới!', 'success')
            } else {
                showToast('Bạn đang sử dụng phiên bản mới nhất!', 'success')
            }
            const now = new Date()
            setLastUpdateCheck(now.toLocaleString('vi-VN'))
        } catch (err) {
            showToast('Lỗi kiểm tra cập nhật', 'error')
        } finally {
            setIsCheckingUpdate(false)
        }
    }, [showToast])

    const handleApiTypeChange = async (newType: 'google' | 'antigravity' | 'custom') => {
        setApiType(newType)
        await window.electronAPI.saveConfig({ apiType: newType })
    }

    const handleEndpointBlur = async () => {
        await window.electronAPI.saveConfig({ customEndpoint })
    }

    const handlePunctuationSettingChange = async (key: keyof typeof punctuationSettings, value: any) => {
        const newSettings = { ...punctuationSettings, [key]: value }
        setPunctuationSettings(newSettings)
        await window.electronAPI.saveConfig({ punctuationSettings: newSettings })
        showToast('Đã lưu cài đặt!', 'success')
    }



    const handleAudioDeviceChange = async (deviceId: string) => {
        setAudioDevice(deviceId)
        showToast('Đã chọn microphone!', 'success')
    }

    const handleClose = () => {
        window.electronAPI.closeSettings()
    }

    const providerIndex = API_PROVIDERS.findIndex(p => p.id === apiType)

    // Handle hotkey capture
    const handleHotkeyCapture = useCallback((e: KeyboardEvent) => {
        if (!isRecordingHotkey) return

        e.preventDefault()
        e.stopPropagation()

        const key = e.key
        const ctrl = e.ctrlKey
        const alt = e.altKey
        const shift = e.shiftKey
        const win = e.metaKey

        if (['Control', 'Ctrl', 'Alt', 'Shift', 'Meta', 'Win'].includes(key)) {
            return
        }

        const hotkeyParts: string[] = []
        if (ctrl) hotkeyParts.push('Control')
        if (alt) hotkeyParts.push('Alt')
        if (shift) hotkeyParts.push('Shift')
        if (win) hotkeyParts.push('Win')

        const finalKey = key === ' ' ? 'Space' : key.length === 1 ? key.toUpperCase() : key
        hotkeyParts.push(finalKey)

        if (hotkeyParts.length < 2) {
            showToast('Cần ít nhất 2 phím (ví dụ: Ctrl+Space)', 'error')
            return
        }

        const hotkeyString = hotkeyParts.join('+')
        setHotkey({
            win: hotkeyString.includes('Win'),
            alt: hotkeyString.includes('Alt'),
            ctrl: hotkeyString.includes('Control'),
            shift: hotkeyString.includes('Shift'),
            key: finalKey
        })

        window.electronAPI.saveConfig({ hotkey: hotkeyString })
        window.electronAPI.registerHotkey(hotkeyString)

        setIsRecordingHotkey(false)
        showToast(`Đã lưu phím tắt: ${hotkeyString}`, 'success')
    }, [isRecordingHotkey, showToast])

    useEffect(() => {
        if (isRecordingHotkey) {
            window.addEventListener('keydown', handleHotkeyCapture)
            return () => window.removeEventListener('keydown', handleHotkeyCapture)
        }
    }, [isRecordingHotkey, handleHotkeyCapture])

    const getCurrentHotkeyDisplay = () => {
        const parts = []
        if (hotkey.ctrl) parts.push('Ctrl')
        if (hotkey.alt) parts.push('Alt')
        if (hotkey.shift) parts.push('Shift')
        if (hotkey.win) parts.push('Win')
        parts.push(hotkey.key)
        return parts.join(' + ')
    }

    return (
        <div className="settings-container">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="settings-card">
                <div className="settings-header">
                    <div className="settings-header-left">
                        <div className="settings-logo">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="settings-title">Voice to Text</h1>
                            <p className="settings-subtitle">Cài đặt ứng dụng</p>
                        </div>
                    </div>
                    <button className="btn-icon btn-close-settings" onClick={handleClose} title="Đóng">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="settings-tabs">
                    <button
                        className={`settings-tab ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51-1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                        <span>Cài đặt</span>
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
                        onClick={() => setActiveTab('api')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12h8" /><path d="M4 18V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M18 12h2" /><path d="M18 6h2" /><path d="M18 18h2" />
                        </svg>
                        <span>API</span>
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'performance' ? 'active' : ''}`}
                        onClick={() => setActiveTab('performance')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                        <span>Hiệu năng</span>
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'about' ? 'active' : ''}`}
                        onClick={() => setActiveTab('about')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                        </svg>
                        <span>Giới thiệu</span>
                    </button>
                    <div
                        className="settings-tab-indicator"
                        style={{
                            transform: activeTab === 'settings' ? 'translateX(0)' :
                                activeTab === 'api' ? 'translateX(calc(100% + 2px))' :
                                    activeTab === 'performance' ? 'translateX(calc(200% + 4px))' :
                                        'translateX(calc(300% + 6px))'
                        }}
                    />
                </div>

                <div className="settings-body">
                    {activeTab === 'settings' ? (
                        /* Settings Tab */
                        <div className="tab-content-stack">
                            {/* Group 1: Ngôn ngữ & Phím tắt */}
                            <div className="settings-section-group">
                                <div className="section-header">
                                    <span className="section-icon-wrap">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="3"></circle>
                                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51-1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                        </svg>
                                    </span>
                                    <span className="section-title">Cài đặt</span>
                                </div>
                                <div className="section-content-inner">
                                    <div className="settings-section">
                                        <label className="settings-label">Ngôn ngữ mặc định</label>
                                        <div className="language-selector">
                                            {LANGUAGES.map((lang) => (
                                                <button
                                                    key={lang.code}
                                                    className={`language-chip ${language === lang.code ? 'active' : ''}`}
                                                    onClick={() => handleLanguageChange(lang.code)}
                                                >
                                                    <span className="language-flag">{lang.flag}</span>
                                                    <span className="language-name">{lang.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="settings-section">
                                        <label className="settings-label">Phím tắt ghi âm</label>
                                        <div className="hotkey-capture">
                                            {isRecordingHotkey ? (
                                                <div className="hotkey-recording">
                                                    <span className="recording-indicator"></span>
                                                    <span>Nhấn phím tắt mới...</span>
                                                    <button
                                                        className="btn btn-ghost btn-small"
                                                        onClick={() => setIsRecordingHotkey(false)}
                                                    >
                                                        Hủy
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="hotkey-display-setting">
                                                    <div className="current-hotkey">
                                                        {hotkey.ctrl && <>
                                                            <kbd>Ctrl</kbd>
                                                            <span>+</span>
                                                        </>}
                                                        {hotkey.win && <>
                                                            <kbd>Win</kbd>
                                                            <span>+</span>
                                                        </>}
                                                        {hotkey.alt && <>
                                                            <kbd>Alt</kbd>
                                                            <span>+</span>
                                                        </>}
                                                        {hotkey.shift && <>
                                                            <kbd>Shift</kbd>
                                                            <span>+</span>
                                                        </>}
                                                        <kbd>{hotkey.key}</kbd>
                                                    </div>
                                                    <button
                                                        className="btn btn-primary btn-small"
                                                        onClick={() => setIsRecordingHotkey(true)}
                                                    >
                                                        Đổi phím tắt
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <p className="settings-hint">
                                            Nhấn tổ hợp phím mới (cần ít nhất 2 phím)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Group 2: Hệ thống */}
                            <div className="settings-section-group">
                                <div className="section-header">
                                    <span className="section-icon-wrap">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                                        </svg>
                                    </span>
                                    <span className="section-title">Hệ thống</span>
                                </div>
                                <div className="section-content-inner">
                                    <div className="settings-section">
                                        <div className="toggle-setting">
                                            <span className="toggle-label">Bắt đầu cùng Windows</span>
                                            <button
                                                className={`toggle-switch ${startWithWindows ? 'active' : ''}`}
                                                onClick={() => handleStartWithWindowsChange(!startWithWindows)}
                                                role="switch"
                                                aria-checked={startWithWindows}
                                            >
                                                <span className="toggle-slider" />
                                            </button>
                                        </div>
                                        <p className="settings-hint">
                                            Tự động khởi động ứng dụng khi đăng nhập vào Windows
                                        </p>
                                    </div>

                                </div>
                            </div>

                            {/* Group 3: Định dạng văn bản */}
                            <CollapsibleSection
                                title="Định dạng văn bản"
                                icon={
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 7V4h16v3" />
                                        <path d="M9 20h6" />
                                        <path d="M12 4v16" />
                                    </svg>
                                }
                                defaultOpen={true}
                            >
                                <div className="settings-section">
                                    <div className="toggle-setting">
                                        <span className="toggle-label">Viết hoa đầu câu</span>
                                        <button
                                            className={`toggle-switch ${punctuationSettings.autoCapitalize ? 'active' : ''}`}
                                            onClick={() => handlePunctuationSettingChange('autoCapitalize', !punctuationSettings.autoCapitalize)}
                                            role="switch"
                                            aria-checked={punctuationSettings.autoCapitalize}
                                        >
                                            <span className="toggle-slider" />
                                        </button>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <div className="toggle-setting">
                                        <span className="toggle-label">Thêm dấu chấm cuối câu</span>
                                        <button
                                            className={`toggle-switch ${punctuationSettings.addPeriodAtEnd ? 'active' : ''}`}
                                            onClick={() => handlePunctuationSettingChange('addPeriodAtEnd', !punctuationSettings.addPeriodAtEnd)}
                                            role="switch"
                                            aria-checked={punctuationSettings.addPeriodAtEnd}
                                        >
                                            <span className="toggle-slider" />
                                        </button>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <div className="toggle-setting">
                                        <span className="toggle-label">Xóa từ thừa (à, ừ, um, uh...)</span>
                                        <button
                                            className={`toggle-switch ${punctuationSettings.removeFillerWords ? 'active' : ''}`}
                                            onClick={() => handlePunctuationSettingChange('removeFillerWords', !punctuationSettings.removeFillerWords)}
                                            role="switch"
                                            aria-checked={punctuationSettings.removeFillerWords}
                                        >
                                            <span className="toggle-slider" />
                                        </button>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <label className="settings-label">Định dạng số</label>
                                    <div className="number-format-selector">
                                        <button
                                            className={`format-option ${punctuationSettings.numberFormatting === 'none' ? 'active' : ''}`}
                                            onClick={() => handlePunctuationSettingChange('numberFormatting', 'none')}
                                        >
                                            Giữ nguyên
                                        </button>
                                        <button
                                            className={`format-option ${punctuationSettings.numberFormatting === 'digits' ? 'active' : ''}`}
                                            onClick={() => handlePunctuationSettingChange('numberFormatting', 'digits')}
                                        >
                                            Chuyển thành số (1, 2, 3)
                                        </button>
                                    </div>
                                </div>
                            </CollapsibleSection>

                            {/* Group 4: Microphone */}
                            <div className="settings-section-group">
                                <div className="section-header">
                                    <span className="section-icon-wrap">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                            <line x1="12" y1="19" x2="12" y2="23" />
                                            <line x1="8" y1="23" x2="16" y2="23" />
                                        </svg>
                                    </span>
                                    <span className="section-title">Microphone</span>
                                </div>
                                <div className="section-content-inner">
                                    <div className="settings-section">
                                        <label className="settings-label">Thiết bị Microphone</label>
                                        {audioDevicesLoading ? (
                                            <div className="device-loading">
                                                <span className="device-spinner"></span>
                                                <span>Đang tìm thiết bị...</span>
                                            </div>
                                        ) : audioDevices.length === 0 ? (
                                            <div className="device-empty">
                                                <span>Không tìm thấy microphone</span>
                                                <button className="btn btn-ghost btn-small" onClick={reloadAudioDevices}>
                                                    Thử lại
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="device-selector">
                                                <select
                                                    className="settings-input"
                                                    value={selectedAudioDevice}
                                                    onChange={(e) => handleAudioDeviceChange(e.target.value)}
                                                >
                                                    {audioDevices.map((device) => (
                                                        <option key={device.deviceId} value={device.deviceId}>
                                                            {device.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    className="btn btn-ghost btn-small"
                                                    onClick={reloadAudioDevices}
                                                    title="Làm mới danh sách"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 2v6h-6" />
                                                        <path d="M3 12a9 9 0 0115-6.7L21 8" />
                                                        <path d="M3 22v-6h6" />
                                                        <path d="M21 12a9 9 0 01-15 6.7L3 16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                        <p className="settings-hint">
                                            Chọn microphone để ghi âm
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'api' ? (
                        /* API & Advanced Tab */
                        <div className="tab-content-stack">
                            {/* Connection Section */}
                            <div className="settings-section-group">
                                <div className="section-header">
                                    <span className="section-icon-wrap">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 12h8" /><path d="M4 18V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M18 12h2" /><path d="M18 6h2" /><path d="M18 18h2" />
                                        </svg>
                                    </span>
                                    <span className="section-title">Kết nối API</span>
                                    <ConnectionStatus
                                        isValid={isValid}
                                        isChecking={isValidating}
                                        error={error}
                                    />
                                </div>

                                <div className="section-content-inner">
                                    <div className="settings-section">
                                        <label className="settings-label">Nhà cung cấp</label>
                                        <div className="provider-selector">
                                            <div
                                                className="provider-indicator"
                                                style={{
                                                    transform: `translateX(${providerIndex * 100}%)`,
                                                    width: `${100 / API_PROVIDERS.length}%`
                                                }}
                                            />
                                            {API_PROVIDERS.map((provider) => (
                                                <button
                                                    key={provider.id}
                                                    className={`provider-option ${apiType === provider.id ? 'active' : ''}`}
                                                    onClick={() => handleApiTypeChange(provider.id as 'google' | 'antigravity' | 'custom')}
                                                    title={provider.desc}
                                                >
                                                    <span className="provider-label">{provider.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {apiType !== 'google' && (
                                        <div className="settings-section fade-in">
                                            <label className="settings-label">
                                                {apiType === 'antigravity' ? 'Endpoint' : 'Custom Endpoint'}
                                            </label>
                                            <input
                                                type="text"
                                                className="settings-input"
                                                placeholder={apiType === 'antigravity' ? 'Để trống = mặc định' : 'https://your-proxy.com'}
                                                value={customEndpoint}
                                                onChange={(e) => setCustomEndpoint(e.target.value)}
                                                onBlur={handleEndpointBlur}
                                            />
                                        </div>
                                    )}

                                    <div className="settings-section">
                                        <label className="settings-label">
                                            API Key
                                            {hasEnvKey && <span className="env-badge">.env</span>}
                                        </label>
                                        {hasEnvKey ? (
                                            <div className="env-notice">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                                </svg>
                                                <span>Đang sử dụng key từ <code>.env</code></span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="input-with-toggle">
                                                    <input
                                                        type={showApiKey ? 'text' : 'password'}
                                                        className="settings-input"
                                                        placeholder={apiType === 'google' ? 'AIzaSy...' : 'Token...'}
                                                        value={apiKeyInput}
                                                        onChange={(e) => setApiKeyInput(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                                                    />
                                                    <button
                                                        className="input-toggle-btn"
                                                        onClick={() => setShowApiKey(!showApiKey)}
                                                        title={showApiKey ? 'Ẩn' : 'Hiện'}
                                                        tabIndex={-1}
                                                    >
                                                        {showApiKey ? (
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                                                <line x1="1" y1="1" x2="23" y2="23" />
                                                            </svg>
                                                        ) : (
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                <circle cx="12" cy="12" r="3" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                                <div className="button-row single-button">
                                                    <button
                                                        className="btn btn-primary btn-full"
                                                        onClick={handleSaveApiKey}
                                                        disabled={isValidating || !apiKeyInput.trim()}
                                                    >
                                                        {isValidating ? (
                                                            <span className="btn-spinner"></span>
                                                        ) : (
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                                                <polyline points="9 12 12 15 16 10"></polyline>
                                                            </svg>
                                                        )}
                                                        {isValid ? 'Đã xác minh' : 'Lưu & Xác minh'}
                                                    </button>
                                                </div>
                                                <p className="settings-hint">
                                                    Lấy key tại{' '}
                                                    <a
                                                        href="#"
                                                        className="link"
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            window.electronAPI.openExternal('https://aistudio.google.com/app/apikey')
                                                        }}
                                                    >
                                                        aistudio.google.com
                                                    </a>
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Advanced Section (Collapsible) */}
                            <CollapsibleSection
                                title="Tùy chỉnh nâng cao"
                                icon={
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51-1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                    </svg>
                                }
                                defaultOpen={!!customPrompt}
                            >
                                <div className="settings-section">
                                    <label className="settings-label">
                                        Custom Prompt
                                        <span className="optional-badge">Tùy chọn</span>
                                    </label>
                                    <textarea
                                        className="settings-textarea"
                                        placeholder="Ví dụ: Viết hoa chữ cái đầu câu. Tự động phân đoạn..."
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        rows={3}
                                    />
                                    <div className="textarea-footer">
                                        <p className="settings-hint">
                                            Hướng dẫn thêm cho AI khi xử lý văn bản.
                                        </p>
                                        <button
                                            className="btn btn-primary btn-small"
                                            onClick={handleSavePrompt}
                                            disabled={!customPrompt.trim()}
                                        >
                                            Lưu
                                        </button>
                                    </div>
                                </div>
                            </CollapsibleSection>
                        </div>
                    ) : activeTab === 'performance' ? (
                        /* Performance Tab */
                        <PerformanceDashboard />
                    ) : activeTab === 'about' ? (
                        /* About Tab */
                        <div className="about-tab">
                            <div className="about-header">
                                <div className="about-logo">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="23" />
                                        <line x1="8" y1="23" x2="16" y2="23" />
                                    </svg>
                                </div>
                                <h2>Voice to Text</h2>
                                <p className="about-version">Phiên bản {appVersion}</p>
                            </div>

                            <div className="about-description">
                                <p>Ứng dụng chuyển giọng nói thành văn bản sử dụng AI. Ghi âm giọng nói và chuyển đổi thành văn bản một cách nhanh chóng và chính xác.</p>
                            </div>

                            <div className="about-features">
                                <div className="about-feature">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>Hỗ trợ nhiều ngôn ngữ</span>
                                </div>
                                <div className="about-feature">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>Tích hợp AI xử lý ngôn ngữ tự nhiên</span>
                                </div>
                                <div className="about-feature">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>Phím tắt tùy chỉnh</span>
                                </div>
                                <div className="about-feature">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>Tự động khởi động cùng Windows</span>
                                </div>
                            </div>

                            <div className="about-section">
                                <h3>Người phát triển</h3>
                                <p>Nguyễn Quang Trường - Full Stack Developer</p>
                                <p className="about-contact">
                                    <a href="https://github.com/quangtruong2003" target="_blank" rel="noopener noreferrer">GitHub</a>
                                </p>
                            </div>

                            <div className="about-section">
                                <h3>Cập nhật tự động</h3>
                                <div className="update-status">
                                    <label className="toggle-label">
                                        <div className="update-label-text">
                                            <span>Kiểm tra cập nhật khi khởi động</span>
                                            <span className="update-label-sub">
                                                Ứng dụng sẽ tự kiểm tra bản mới mỗi khi khởi động cùng Windows
                                            </span>
                                        </div>
                                        <button
                                            className={`toggle-switch ${autoUpdate ? 'active' : ''}`}
                                            onClick={() => {
                                                const next = !autoUpdate
                                                setAutoUpdate(next)
                                                window.electronAPI.saveConfig({ autoUpdate: next })
                                            }}
                                            role="switch"
                                            aria-checked={autoUpdate}
                                        >
                                            <span className="toggle-slider" />
                                        </button>
                                    </label>

                                    <div className="update-meta">
                                        {lastUpdateCheck && (
                                            <p className="update-check-time">
                                                Kiểm tra lần cuối: {lastUpdateCheck}
                                            </p>
                                        )}
                                        {updateAvailable && (
                                            <p className="update-available">Có bản cập nhật mới!</p>
                                        )}
                                    </div>

                                    <div className="button-row single-button">
                                        <button
                                            className="btn btn-ghost btn-small btn-full"
                                            onClick={checkForUpdate}
                                            disabled={isCheckingUpdate}
                                        >
                                            {isCheckingUpdate ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="about-footer">
                                <p>© 2026 Voice to Text. All rights reserved.</p>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="settings-footer">
                    <div className="hotkey-display">
                        {hotkey.ctrl && <>
                            <kbd>Ctrl</kbd>
                            <span className="hotkey-plus">+</span>
                        </>}
                        {hotkey.win && <>
                            <kbd>Win</kbd>
                            <span className="hotkey-plus">+</span>
                        </>}
                        {hotkey.alt && <>
                            <kbd>Alt</kbd>
                            <span className="hotkey-plus">+</span>
                        </>}
                        {hotkey.shift && <>
                            <kbd>Shift</kbd>
                            <span className="hotkey-plus">+</span>
                        </>}
                        <kbd>{hotkey.key}</kbd>
                    </div>
                    <span className="settings-footer-text">để bắt đầu ghi âm</span>
                </div>
            </div>
        </div>
    )
}
