import { useState, useEffect, useCallback, useRef } from 'react'
import { PerformanceDashboard } from './PerformanceDashboard'
import { HistoryView } from './HistoryView'
import { useAudioDevices } from '../hooks/useAudioDevices'
import { useI18n, AppLanguage } from '../i18n'

const LANGUAGES = [
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
]

const GITHUB_REPO = 'quangtruong2003/VoiceToPrompt'

type SidebarSection = 'general' | 'microphone' | 'engine' | 'api' | 'formatting' | 'performance' | 'about'

function getSidebarItems(t: (key: string) => string): { id: SidebarSection; label: string; icon: JSX.Element }[] {
    return [
        {
            id: 'general',
            label: t('settings.sections.general'),
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51-1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            ),
        },
        {
            id: 'microphone',
            label: t('settings.sections.microphone'),
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
            ),
        },
        {
            id: 'engine',
            label: t('settings.sections.engine'),
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 0 0-4 4v1H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
                    <circle cx="9" cy="14" r="1" />
                    <circle cx="15" cy="14" r="1" />
                </svg>
            ),
        },
        {
            id: 'api',
            label: t('settings.sections.api'),
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12h8" /><path d="M4 18V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M18 12h2" /><path d="M18 6h2" /><path d="M18 18h2" />
                </svg>
            ),
        },
        {
            id: 'formatting',
            label: t('settings.sections.formatting'),
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7V4h16v3" />
                    <path d="M9 20h6" />
                    <path d="M12 4v16" />
                </svg>
            ),
        },
        {
            id: 'performance',
            label: t('settings.sections.performance'),
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
            ),
        },
        {
            id: 'about',
            label: t('settings.sections.about'),
            icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                </svg>
            ),
        },
    ]
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
    const { t } = useI18n()
    if (isChecking) {
        return (
            <div className="connection-status checking">
                <span className="status-spinner"></span>
                <span>{t('common.checking')}</span>
            </div>
        )
    }

    if (isValid === null) {
        return (
            <div className="connection-status unknown">
                <span className="status-dot"></span>
                <span>{t('settings.connectionStatus.unknown')}</span>
            </div>
        )
    }

    return (
        <div className={`connection-status ${isValid ? 'valid' : 'invalid'}`}>
            <span className={`status-dot ${isValid ? 'valid' : 'invalid'}`}></span>
            <span>{isValid ? t('settings.connectionStatus.connected') : t('settings.connectionStatus.error')}</span>
        </div>
    )
}

interface LanguageDropdownProps {
    value: string
    onChange: (lang: string) => void
    languages: { code: string; name: string; flag?: string }[]
    showFlag?: boolean
}

function LanguageDropdown({ value, onChange, languages, showFlag = true }: LanguageDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const { t } = useI18n()

    const selectedLang = languages.find(l => l.code === value) || languages[0]

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="language-dropdown" ref={dropdownRef}>
            <button
                className={`language-dropdown-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className="language-dropdown-label">
                    {showFlag && selectedLang.flag && (
                        <span className="lang-flag">{selectedLang.flag}</span>
                    )}
                    <span className="language-dropdown-label-text">{selectedLang.name}</span>
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            {isOpen && (
                <div className="language-dropdown-menu">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            className={`language-dropdown-item ${value === lang.code ? 'active' : ''}`}
                            onClick={() => {
                                onChange(lang.code)
                                setIsOpen(false)
                            }}
                            type="button"
                        >
                            <span className="lang-flag">{lang.flag}</span>
                            <span className="lang-name">{lang.name}</span>
                        </button>
                    ))}
                </div>
            )}
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
    const { t, language: i18nLang, setLanguage: setI18nLanguage, dict } = useI18n()
    const [activeSection, setActiveSection] = useState<SidebarSection>('general')
    const [apiKey, setApiKey] = useState('')
    const [apiKeyInput, setApiKeyInput] = useState('')
    const [customPrompt, setCustomPrompt] = useState('')
    const [language, setLanguage] = useState(i18nLang)
    const [hasEnvKey, setHasEnvKey] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [isValid, setIsValid] = useState<boolean | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [apiType] = useState<'google' | 'antigravity' | 'custom'>('google')
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)
    const [showApiKey, setShowApiKey] = useState(false)
    const [startWithWindows, setStartWithWindows] = useState(false)
    const [autoUpdate, setAutoUpdate] = useState(true)
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
    const [updateAvailable, setUpdateAvailable] = useState(false)
    const [lastUpdateCheck, setLastUpdateCheck] = useState<string | null>(null)
    const [appVersion, setAppVersion] = useState<string>('')

    const [punctuationSettings, setPunctuationSettings] = useState({
        autoCapitalize: true,
        addPeriodAtEnd: true,
        removeFillerWords: false,
        numberFormatting: 'none' as 'none' | 'digits' | 'words',
    })

    // Gemini model selection
    const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash')
    const [availableModels, setAvailableModels] = useState<{ name: string; displayName: string }[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)

    // Whisper engine state
    const [transcriptionEngine, setTranscriptionEngine] = useState<'gemini' | 'whisper'>('gemini')
    const [whisperModel, setWhisperModel] = useState('onnx-community/whisper-small')
    const [whisperModels, setWhisperModels] = useState<{ id: string; name: string; size: string }[]>([])
    const [isDeletingWhisper, setIsDeletingWhisper] = useState(false)
    const [isDownloadingWhisper, setIsDownloadingWhisper] = useState(false)
    const [whisperDownloadStatus, setWhisperDownloadStatus] = useState<string>('')
    const [whisperModelPath, setWhisperModelPath] = useState<string>('')
    const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set())

    const { devices: audioDevices, selectedDeviceId: selectedAudioDevice, isLoading: audioDevicesLoading, selectDevice: setAudioDevice, reloadDevices: reloadAudioDevices } = useAudioDevices()

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type })
    }, [])

    const validateApiKey = useCallback(async (keyToValidate: string) => {
        if (!keyToValidate.trim()) return
        setError(null)
        setIsValidating(true)
        try {
            const result = await window.electronAPI.validateApiKey(keyToValidate.trim())
            if (result.valid) {
                setApiKey(keyToValidate.trim())
                setApiKeyInput(keyToValidate.trim())
                setIsValid(true)
            } else {
                setIsValid(false)
                setError(`${t('settings.toast.apiKeyInvalid')}: ${result.error || 'N/A'}`)
                showToast(t('settings.toast.apiKeyInvalid'), 'error')
            }
        } catch (err: any) {
            setIsValid(false)
            setError(`${t('settings.toast.connectionError')}: ${err.message || ''}`)
            showToast(t('settings.toast.connectionError'), 'error')
        } finally {
            setIsValidating(false)
        }
    }, [t, showToast])

    const [hotkey, setHotkey] = useState({ win: false, alt: false, ctrl: true, shift: false, key: 'Space' })
    const [isRecordingHotkey, setIsRecordingHotkey] = useState(false)
    const [historyHotkey, setHistoryHotkey] = useState({ win: false, alt: true, ctrl: false, shift: false, key: 'V' })
    const [isRecordingHistoryHotkey, setIsRecordingHistoryHotkey] = useState(false)
    const [settingsHotkey, setSettingsHotkey] = useState({ win: false, alt: true, ctrl: false, shift: false, key: 'S' })
    const [isRecordingSettingsHotkey, setIsRecordingSettingsHotkey] = useState(false)

    useEffect(() => {
        if (!window.electronAPI) return
        window.electronAPI.getConfig().then((config) => {
            if (config.apiKey) {
                setApiKey(config.apiKey)
                setApiKeyInput(config.apiKey)
                // Tự động kiểm tra API key khi mở app nếu đã có key
                validateApiKey(config.apiKey)
            }
            if (config.language) setLanguage(config.language as AppLanguage)
            if (config.customPrompt) setCustomPrompt(config.customPrompt)
            if (config.hasEnvKey) setHasEnvKey(true)
            if (config.startWithWindows !== undefined) setStartWithWindows(config.startWithWindows)
            if (config.autoUpdate !== undefined) setAutoUpdate(config.autoUpdate)
            if (config.lastUpdateCheck) setLastUpdateCheck(config.lastUpdateCheck)
            if (config.appVersion) setAppVersion(config.appVersion)
            if (config.punctuationSettings) {
                setPunctuationSettings(config.punctuationSettings)
            }
            if (config.geminiModel) {
                setGeminiModel(config.geminiModel)
            }

            // Load available Gemini models
            loadGeminiModels()
            loadWhisperModels()

            if (config.transcriptionEngine) {
                setTranscriptionEngine(config.transcriptionEngine)
            }
            if (config.whisperModel) {
                setWhisperModel(config.whisperModel)
            }
            if (config.whisperModelPath) {
                setWhisperModelPath(config.whisperModelPath)
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
            if (config.historyHotkey) {
                const parts = config.historyHotkey.split('+')
                setHistoryHotkey({
                    win: parts.includes('Win'),
                    alt: parts.includes('Alt'),
                    ctrl: parts.includes('Control'),
                    shift: parts.includes('Shift'),
                    key: parts.find(p => !['Win', 'Alt', 'Control', 'Ctrl', 'Shift'].includes(p)) || 'V'
                })
            }
            if (config.settingsHotkey) {
                const parts = config.settingsHotkey.split('+')
                setSettingsHotkey({
                    win: parts.includes('Win'),
                    alt: parts.includes('Alt'),
                    ctrl: parts.includes('Control'),
                    shift: parts.includes('Shift'),
                    key: parts.find((p: string) => !['Win', 'Alt', 'Control', 'Ctrl', 'Shift'].includes(p)) || 'S'
                })
            }
        })

        // Listen for config changes from other windows
        const cleanupConfigUpdate = window.electronAPI.onConfigUpdated((partial) => {
            if (partial.language) {
                setLanguage(partial.language as AppLanguage)
                setI18nLanguage(partial.language as AppLanguage)
            }
        })
        return cleanupConfigUpdate
    }, [setI18nLanguage, validateApiKey])

    const loadWhisperModels = async () => {
        if (!window.electronAPI) return
        try {
            const result = await window.electronAPI.getWhisperModels()
            if (result.models && result.models.length > 0) {
                setWhisperModels(result.models)
                checkDownloadedModels(result.models.map((m: any) => m.id))
            }
        } catch (err) {
            console.error('Failed to load Whisper models:', err)
        }
    }

    const handleEngineChange = async (engine: 'gemini' | 'whisper') => {
        setTranscriptionEngine(engine)
        await window.electronAPI.saveConfig({ transcriptionEngine: engine })
        showToast(t('settings.engine.engineSaved'), 'success')
    }

    const handleWhisperModelChange = async (modelId: string) => {
        setWhisperModel(modelId)
        await window.electronAPI.saveConfig({ whisperModel: modelId })
        showToast(t('settings.engine.modelSaved'), 'success')
    }

    const handleDownloadWhisperModel = async () => {
        setIsDownloadingWhisper(true)
        setWhisperDownloadStatus(t('settings.engine.downloading'))
        try {
            const result = await window.electronAPI.downloadWhisperModel(whisperModel)
            if (result.success) {
                setWhisperDownloadStatus(t('settings.engine.modelReady'))
                setDownloadedModels(prev => new Set(prev).add(whisperModel))
                showToast(t('settings.engine.downloadSuccess'), 'success')
            } else {
                setWhisperDownloadStatus('')
                showToast(t('settings.engine.downloadError') + ': ' + (result.error || ''), 'error')
            }
        } catch (err: any) {
            setWhisperDownloadStatus('')
            showToast(t('settings.engine.downloadError'), 'error')
        } finally {
            setIsDownloadingWhisper(false)
        }
    }

    const handleDeleteWhisperModel = async () => {
        if (!confirm(t('settings.engine.confirmDeleteModel'))) return
        setIsDeletingWhisper(true)
        try {
            const result = await window.electronAPI.deleteWhisperModel(whisperModel)
            if (result.success) {
                setDownloadedModels(prev => {
                    const next = new Set(prev)
                    next.delete(whisperModel)
                    return next
                })
                showToast(t('settings.engine.deleteSuccess'), 'success')
            } else {
                showToast(t('settings.engine.deleteError') + ': ' + (result.error || ''), 'error')
            }
        } catch (err: any) {
            console.error('Lỗi khi xóa model:', err)
            showToast(t('settings.engine.deleteError'), 'error')
        } finally {
            setIsDeletingWhisper(false)
        }
    }

    const checkDownloadedModels = async (modelIds: string[]) => {
        const downloaded = new Set<string>()
        for (const modelId of modelIds) {
            try {
                const result = await window.electronAPI.checkWhisperModelDownloaded(modelId)
                if (result?.downloaded) {
                    downloaded.add(modelId)
                }
            } catch { }
        }
        setDownloadedModels(downloaded)
    }

    const handleSelectModelFolder = async () => {
        try {
            const result = await window.electronAPI.selectWhisperModelFolder()
            if (result.success && result.path) {
                setWhisperModelPath(result.path)
                checkDownloadedModels(whisperModels.map(m => m.id))
                showToast(t('settings.engine.folderSaved'), 'success')
            }
        } catch (err) {
            console.error('Failed to select model folder:', err)
        }
    }

    const handleSaveApiKey = async () => {
        if (!apiKeyInput.trim()) return
        await validateApiKey(apiKeyInput.trim())
        try {
            await window.electronAPI.saveConfig({
                apiKey: apiKeyInput.trim(),
                language
            })
            showToast(t('settings.toast.apiKeySaved'), 'success')
            // Reload models after API key is saved
            loadGeminiModels()
        } catch (err: any) {
            showToast(t('settings.toast.connectionError'), 'error')
        }
    }

    const loadGeminiModels = async () => {
        if (!window.electronAPI) return
        setIsLoadingModels(true)
        try {
            const result = await window.electronAPI.getGeminiModels()
            if (result.models && result.models.length > 0) {
                setAvailableModels(result.models)
            }
        } catch (err) {
            console.error('Failed to load Gemini models:', err)
        } finally {
            setIsLoadingModels(false)
        }
    }

    const handleGeminiModelChange = async (model: string) => {
        setGeminiModel(model)
        await window.electronAPI.saveConfig({ geminiModel: model })
        showToast(t('settings.api.modelSaved'), 'success')
    }

    const handleSavePrompt = async () => {
        await window.electronAPI.saveConfig({ customPrompt })
        showToast(t('settings.api.promptSaved'), 'success')
    }

    const handleLanguageChange = async (newLang: string) => {
        setLanguage(newLang as AppLanguage)
        setI18nLanguage(newLang as AppLanguage)
        await window.electronAPI.saveConfig({ language: newLang })
        showToast(t('settings.general.languageSaved'), 'success')
    }

    const handleStartWithWindowsChange = async (enabled: boolean) => {
        setStartWithWindows(enabled)
        const result = await window.electronAPI.setStartWithWindows(enabled)
        if (result.success) {
            showToast(enabled ? t('settings.general.startWithWindows') : t('settings.general.startWithWindows'), 'success')
        } else {
            setStartWithWindows(!enabled)
            showToast(`Lỗi: ${result.error || ''}`, 'error')
        }
    }

    const checkForUpdate = useCallback(async () => {
        setIsCheckingUpdate(true)
        setUpdateAvailable(false)
        try {
            const result = await window.electronAPI.checkForUpdate()
            if (result.updateAvailable) {
                setUpdateAvailable(true)
                showToast(t('settings.toast.updateAvailable'), 'success')
            } else {
                showToast(t('settings.toast.upToDate'), 'success')
            }
            const now = new Date()
            setLastUpdateCheck(now.toLocaleString('vi-VN'))
        } catch (err) {
            // Nếu kiểm tra cập nhật thất bại (ví dụ chạy bản dev hoặc không cấu hình auto-update),
            // chỉ log lỗi để debug, không hiển thị toast lỗi gây khó chịu cho người dùng.
            console.error('checkForUpdate error', err)
        } finally {
            setIsCheckingUpdate(false)
        }
    }, [showToast, t])

    useEffect(() => {
        if (activeSection === 'microphone') {
            reloadAudioDevices()
        }
    }, [activeSection, reloadAudioDevices])

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
    const handleHotkeyCapture = useCallback((e: KeyboardEvent) => {
        if (!isRecordingHotkey && !isRecordingHistoryHotkey && !isRecordingSettingsHotkey) return

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
            showToast(t('settings.general.needAtLeast2Keys'), 'error')
            return
        }

        const hotkeyString = hotkeyParts.join('+')

        if (isRecordingHotkey) {
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
        } else if (isRecordingHistoryHotkey) {
            setHistoryHotkey({
                win: hotkeyString.includes('Win'),
                alt: hotkeyString.includes('Alt'),
                ctrl: hotkeyString.includes('Control'),
                shift: hotkeyString.includes('Shift'),
                key: finalKey
            })
            window.electronAPI.saveConfig({ historyHotkey: hotkeyString })
            window.electronAPI.registerHistoryHotkey(hotkeyString)
            setIsRecordingHistoryHotkey(false)
        } else if (isRecordingSettingsHotkey) {
            setSettingsHotkey({
                win: hotkeyString.includes('Win'),
                alt: hotkeyString.includes('Alt'),
                ctrl: hotkeyString.includes('Control'),
                shift: hotkeyString.includes('Shift'),
                key: finalKey
            })
            window.electronAPI.saveConfig({ settingsHotkey: hotkeyString })
            window.electronAPI.registerSettingsHotkey(hotkeyString)
            setIsRecordingSettingsHotkey(false)
        }

        showToast(t('settings.toast.hotkeySaved', { hotkey: hotkeyString }), 'success')
    }, [isRecordingHotkey, isRecordingHistoryHotkey, isRecordingSettingsHotkey, showToast, t])

    useEffect(() => {
        if (isRecordingHotkey || isRecordingHistoryHotkey || isRecordingSettingsHotkey) {
            window.addEventListener('keydown', handleHotkeyCapture)
            return () => window.removeEventListener('keydown', handleHotkeyCapture)
        }
    }, [isRecordingHotkey, isRecordingHistoryHotkey, isRecordingSettingsHotkey, handleHotkeyCapture])

    const getCurrentHotkeyDisplay = () => {
        const parts = []
        if (hotkey.ctrl) parts.push('Ctrl')
        if (hotkey.alt) parts.push('Alt')
        if (hotkey.shift) parts.push('Shift')
        if (hotkey.win) parts.push('Win')
        parts.push(hotkey.key)
        return parts.join(' + ')
    }

    const renderContent = () => {
        switch (activeSection) {
            case 'general':
                return (
                    <div className="settings-content-panel">
                        <h2 className="content-panel-title">{t('settings.sections.general')}</h2>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item no-border" style={{ alignItems: 'center', gap: 16 }}>
                                <div className="list-item-left" style={{ flex: '0 0 auto' }}>
                                    <span className="list-item-label">{t('settings.general.defaultLanguage')}</span>
                                </div>
                                <div style={{ flex: '0 0 230px' }}>
                                    <LanguageDropdown
                                        value={language}
                                        onChange={handleLanguageChange}
                                        languages={LANGUAGES}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.general.hotkey')}</span>
                                </div>
                            </div>
                            <div className="list-grouped-item">
                                <div className="hotkey-capture">
                                    {isRecordingHotkey ? (
                                        <div className="hotkey-recording">
                                            <span className="recording-indicator"></span>
                                            <span>{t('settings.general.pressNewHotkey')}</span>
                                            <button
                                                className="btn btn-ghost btn-small"
                                                onClick={() => setIsRecordingHotkey(false)}
                                            >
                                                {t('common.cancel')}
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
                                                {t('settings.general.changeHotkey')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.general.historyHotkey')}</span>
                                </div>
                            </div>
                            <div className="list-grouped-item no-border">
                                <div className="hotkey-capture">
                                    {isRecordingHistoryHotkey ? (
                                        <div className="hotkey-recording">
                                            <span className="recording-indicator"></span>
                                            <span>{t('settings.general.pressNewHotkey')}</span>
                                            <button
                                                className="btn btn-ghost btn-small"
                                                onClick={() => setIsRecordingHistoryHotkey(false)}
                                            >
                                                {t('common.cancel')}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="hotkey-display-setting">
                                            <div className="current-hotkey">
                                                {historyHotkey.ctrl && <>
                                                    <kbd>Ctrl</kbd>
                                                    <span>+</span>
                                                </>}
                                                {historyHotkey.win && <>
                                                    <kbd>Win</kbd>
                                                    <span>+</span>
                                                </>}
                                                {historyHotkey.alt && <>
                                                    <kbd>Alt</kbd>
                                                    <span>+</span>
                                                </>}
                                                {historyHotkey.shift && <>
                                                    <kbd>Shift</kbd>
                                                    <span>+</span>
                                                </>}
                                                <kbd>{historyHotkey.key}</kbd>
                                            </div>
                                            <button
                                                className="btn btn-primary btn-small"
                                                onClick={() => setIsRecordingHistoryHotkey(true)}
                                            >
                                                {t('settings.general.changeHistoryHotkey')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.general.settingsHotkey') || 'Settings Hotkey'}</span>
                                </div>
                            </div>
                            <div className="list-grouped-item no-border">
                                <div className="hotkey-capture">
                                    {isRecordingSettingsHotkey ? (
                                        <div className="hotkey-recording">
                                            <span className="recording-indicator"></span>
                                            <span>{t('settings.general.pressNewHotkey')}</span>
                                            <button
                                                className="btn btn-ghost btn-small"
                                                onClick={() => setIsRecordingSettingsHotkey(false)}
                                            >
                                                {t('common.cancel')}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="hotkey-display-setting">
                                            <div className="current-hotkey">
                                                {settingsHotkey.ctrl && <>
                                                    <kbd>Ctrl</kbd>
                                                    <span>+</span>
                                                </>}
                                                {settingsHotkey.win && <>
                                                    <kbd>Win</kbd>
                                                    <span>+</span>
                                                </>}
                                                {settingsHotkey.alt && <>
                                                    <kbd>Alt</kbd>
                                                    <span>+</span>
                                                </>}
                                                {settingsHotkey.shift && <>
                                                    <kbd>Shift</kbd>
                                                    <span>+</span>
                                                </>}
                                                <kbd>{settingsHotkey.key}</kbd>
                                            </div>
                                            <button
                                                className="btn btn-primary btn-small"
                                                onClick={() => setIsRecordingSettingsHotkey(true)}
                                            >
                                                {t('settings.general.changeSettingsHotkey')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item no-border">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.general.startWithWindows')}</span>
                                    <span className="list-item-hint">{t('settings.general.startWithWindowsHint')}</span>
                                </div>
                                <button
                                    className={`toggle-switch ${startWithWindows ? 'active' : ''}`}
                                    onClick={() => handleStartWithWindowsChange(!startWithWindows)}
                                    role="switch"
                                    aria-checked={startWithWindows}
                                >
                                    <span className="toggle-slider" />
                                </button>
                            </div>
                        </div>
                    </div>
                )

            case 'microphone':
                return (
                    <div className="settings-content-panel">
                        <h2 className="content-panel-title">{t('settings.sections.microphone')}</h2>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item no-border" style={{ alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                <div className="list-item-left" style={{ flex: '0 0 auto' }}>
                                    <span className="list-item-label">{t('settings.microphone.device')}</span>
                                    <span className="list-item-hint">{t('settings.microphone.deviceHint')}</span>
                                </div>
                                {audioDevicesLoading ? (
                                    <div className="device-loading" style={{ flex: '1 1 220px', minWidth: 0 }}>
                                        <span className="device-spinner"></span>
                                        <span>{t('settings.microphone.searching')}</span>
                                    </div>
                                ) : audioDevices.length === 0 ? (
                                    <div className="device-empty" style={{ flex: '1 1 220px', minWidth: 0 }}>
                                        <span>{t('settings.microphone.notFound')}</span>
                                    </div>
                                ) : (
                                    <div className="device-selector" style={{ flex: '1 1 260px', minWidth: 0 }}>
                                        <LanguageDropdown
                                            value={selectedAudioDevice || audioDevices[0].deviceId}
                                            onChange={handleAudioDeviceChange}
                                            languages={audioDevices.map((device) => ({
                                                code: device.deviceId,
                                                name: device.label
                                            }))}
                                            showFlag={false}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )

            case 'engine':
                return (
                    <div className="settings-content-panel">
                        <h2 className="content-panel-title">{t('settings.engine.title')}</h2>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.engine.selectEngine')}</span>
                                    <span className="list-item-hint">{t('settings.engine.selectEngineHint')}</span>
                                </div>
                            </div>
                            <div className="list-grouped-item no-border">
                                <div className="provider-selector" style={{ width: '100%' }}>
                                    <div
                                        className="provider-indicator"
                                        style={{
                                            width: '50%',
                                            transform: transcriptionEngine === 'gemini' ? 'translateX(0)' : 'translateX(100%)',
                                        }}
                                    />
                                    <button
                                        className={`provider-option ${transcriptionEngine === 'gemini' ? 'active' : ''}`}
                                        onClick={() => handleEngineChange('gemini')}
                                        type="button"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                            <path d="M2 17l10 5 10-5" />
                                            <path d="M2 12l10 5 10-5" />
                                        </svg>
                                        <span className="provider-label">{t('settings.engine.gemini')}</span>
                                    </button>
                                    <button
                                        className={`provider-option ${transcriptionEngine === 'whisper' ? 'active' : ''}`}
                                        onClick={() => handleEngineChange('whisper')}
                                        type="button"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 2a4 4 0 0 0-4 4v1H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
                                            <circle cx="9" cy="14" r="1" />
                                            <circle cx="15" cy="14" r="1" />
                                        </svg>
                                        <span className="provider-label">{t('settings.engine.whisper')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {transcriptionEngine === 'gemini' ? (
                            <div className="list-grouped-card">
                                <div className="list-grouped-item no-border">
                                    <div className="list-item-left">
                                        <span className="list-item-label">{t('settings.engine.gemini')}</span>
                                        <span className="list-item-hint">{t('settings.engine.geminiDesc')}</span>
                                        <span className="list-item-hint" style={{ marginTop: 4, opacity: 0.7 }}>
                                            {t('settings.engine.geminiHint')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="list-grouped-card">
                                    <div className="list-grouped-item">
                                        <div className="list-item-left">
                                            <span className="list-item-label">{t('settings.engine.whisperModel')}</span>
                                            <span className="list-item-hint">{t('settings.engine.modelHint')}</span>
                                        </div>
                                    </div>
                                    <div className="list-grouped-item no-border">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                            <select
                                                className="settings-select"
                                                value={whisperModel}
                                                onChange={(e) => handleWhisperModelChange(e.target.value)}
                                            >
                                                {whisperModels.map((model) => (
                                                    <option key={model.id} value={model.id}>
                                                        {model.name} ({model.size})
                                                    </option>
                                                ))}
                                            </select>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                {downloadedModels.has(whisperModel) ? (
                                                    <>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '4px 10px', borderRadius: 6, fontWeight: 500 }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                            {t('settings.engine.downloaded')}
                                                        </span>
                                                        <button
                                                            className="btn btn-ghost btn-small error"
                                                            onClick={handleDeleteWhisperModel}
                                                            disabled={isDeletingWhisper}
                                                            title={t('settings.engine.deleteModel')}
                                                            style={{ padding: '6px', minWidth: 'unset', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            {isDeletingWhisper ? (
                                                                <span className="btn-spinner" style={{ width: 14, height: 14 }}></span>
                                                            ) : (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M3 6h18"></path>
                                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            className="btn btn-primary btn-small"
                                                            onClick={handleDownloadWhisperModel}
                                                            disabled={isDownloadingWhisper}
                                                            style={{ flex: '0 0 auto' }}
                                                        >
                                                            {isDownloadingWhisper ? (
                                                                <span className="btn-spinner"></span>
                                                            ) : (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                    <polyline points="7 10 12 15 17 10" />
                                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                                </svg>
                                                            )}
                                                            {isDownloadingWhisper ? t('settings.engine.downloading') : t('settings.engine.downloadModel')}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="list-grouped-card">
                                    <div className="list-grouped-item">
                                        <div className="list-item-left">
                                            <span className="list-item-label">{t('settings.engine.modelFolder')}</span>
                                            <span className="list-item-hint">{t('settings.engine.modelFolderHint')}</span>
                                        </div>
                                    </div>
                                    <div className="list-grouped-item no-border">
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                                            <span style={{ fontSize: 12, opacity: 0.7, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {whisperModelPath || t('settings.engine.defaultFolder')}
                                            </span>
                                            <button
                                                className="btn btn-secondary btn-small"
                                                onClick={handleSelectModelFolder}
                                                style={{ flex: '0 0 auto' }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                                </svg>
                                                {t('settings.engine.changeFolder')}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="list-grouped-card">
                                    <div className="list-grouped-item no-border">
                                        <div className="list-item-left">
                                            <span className="list-item-hint">{t('settings.engine.whisperDesc')}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )

            case 'api':
                return (
                    <div className="settings-content-panel">
                        <h2 className="content-panel-title">
                            {t('settings.api.title')}
                            <ConnectionStatus
                                isValid={isValid}
                                isChecking={isValidating}
                                error={error}
                            />
                        </h2>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">
                                        {t('settings.api.apiKey')}
                                        {hasEnvKey && <span className="env-badge">.env</span>}
                                    </span>
                                </div>
                            </div>
                            <div className="list-grouped-item no-border">
                                {hasEnvKey ? (
                                    <div className="env-notice">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                        </svg>
                                        <span>{t('settings.api.envKeyInUse')}</span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                        <div className="input-with-toggle">
                                            <input
                                                type={showApiKey ? 'text' : 'password'}
                                                className="settings-input"
                                                placeholder="AIzaSy..."
                                                value={apiKeyInput}
                                                onChange={(e) => setApiKeyInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                                            />
                                            <button
                                                className="input-toggle-btn"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                title={showApiKey ? t('settings.api.hide') : t('settings.api.show')}
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
                                                {isValid ? t('settings.api.verified') : t('settings.api.saveAndVerify')}
                                            </button>
                                        </div>
                                        <p className="settings-hint">
                                            {t('settings.api.getKeyAt')}{' '}
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
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">
                                        {t('settings.api.geminiModel')}
                                    </span>
                                </div>
                            </div>
                            <div className="list-grouped-item no-border">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <select
                                            className="settings-select"
                                            value={geminiModel}
                                            onChange={(e) => handleGeminiModelChange(e.target.value)}
                                            disabled={isLoadingModels || availableModels.length === 0}
                                            style={{ flex: 1 }}
                                        >
                                            {isLoadingModels ? (
                                                <option value="">{t('common.loading')}...</option>
                                            ) : availableModels.length > 0 ? (
                                                availableModels.map((model) => (
                                                    <option key={model.name} value={model.name}>
                                                        {model.displayName}
                                                    </option>
                                                ))
                                            ) : (
                                                <option value="">{t('settings.api.noModels')}</option>
                                            )}
                                        </select>
                                        <button
                                            className="btn btn-secondary btn-small"
                                            onClick={loadGeminiModels}
                                            disabled={isLoadingModels}
                                            title={t('settings.api.refreshModels')}
                                        >
                                            {isLoadingModels ? (
                                                <span className="btn-spinner"></span>
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M23 4v6h-6"></path>
                                                    <path d="M1 20v-6h6"></path>
                                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                    <p className="settings-hint">
                                        {t('settings.api.modelHint')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">
                                        {t('settings.api.customPrompt')}
                                        <span className="optional-badge">{t('settings.api.optional')}</span>
                                    </span>
                                </div>
                            </div>
                            <div className="list-grouped-item no-border">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                    <textarea
                                        className="settings-textarea"
                                        placeholder={t('settings.api.promptPlaceholder')}
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        rows={3}
                                    />
                                    <div className="textarea-footer">
                                        <p className="settings-hint">
                                            {t('settings.api.promptHint')}
                                        </p>
                                        <button
                                            className="btn btn-primary btn-small"
                                            onClick={handleSavePrompt}
                                            disabled={!customPrompt.trim()}
                                        >
                                            {t('common.save')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )

            case 'formatting':
                return (
                    <div className="settings-content-panel">
                        <h2 className="content-panel-title">{t('settings.formatting.title')}</h2>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.formatting.autoCapitalize')}</span>
                                </div>
                                <button
                                    className={`toggle-switch ${punctuationSettings.autoCapitalize ? 'active' : ''}`}
                                    onClick={() => handlePunctuationSettingChange('autoCapitalize', !punctuationSettings.autoCapitalize)}
                                    role="switch"
                                    aria-checked={punctuationSettings.autoCapitalize}
                                >
                                    <span className="toggle-slider" />
                                </button>
                            </div>

                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.formatting.addPeriod')}</span>
                                </div>
                                <button
                                    className={`toggle-switch ${punctuationSettings.addPeriodAtEnd ? 'active' : ''}`}
                                    onClick={() => handlePunctuationSettingChange('addPeriodAtEnd', !punctuationSettings.addPeriodAtEnd)}
                                    role="switch"
                                    aria-checked={punctuationSettings.addPeriodAtEnd}
                                >
                                    <span className="toggle-slider" />
                                </button>
                            </div>

                            <div className="list-grouped-item no-border">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.formatting.removeFillers')}</span>
                                </div>
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

                        <div className="list-grouped-card">
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.formatting.numberFormat')}</span>
                                </div>
                            </div>
                            <div className="list-grouped-item no-border">
                                <div className="number-format-selector">
                                    <button
                                        className={`format-option ${punctuationSettings.numberFormatting === 'none' ? 'active' : ''}`}
                                        onClick={() => handlePunctuationSettingChange('numberFormatting', 'none')}
                                    >
                                        {t('settings.formatting.keep')}
                                    </button>
                                    <button
                                        className={`format-option ${punctuationSettings.numberFormatting === 'digits' ? 'active' : ''}`}
                                        onClick={() => handlePunctuationSettingChange('numberFormatting', 'digits')}
                                    >
                                        {t('settings.formatting.toDigits')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )

            case 'performance':
                return <PerformanceDashboard />

            case 'about':
                return (
                    <div className="settings-content-panel">
                        <h2 className="content-panel-title">{t('settings.sections.about')}</h2>

                        <div className="about-header-compact">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                                <div className="about-logo">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="23" />
                                        <line x1="8" y1="23" x2="16" y2="23" />
                                    </svg>
                                </div>
                                <div>
                                    <h3>{t('app.name')}</h3>
                                    <span className="about-version">{t('settings.about.version', { version: appVersion || '' })}</span>
                                </div>
                            </div>
                            <button
                                className="btn btn-ghost btn-small"
                                onClick={checkForUpdate}
                                disabled={isCheckingUpdate}
                                style={{ flexShrink: 0 }}
                            >
                                {isCheckingUpdate ? t('common.checking') : t('settings.about.checkUpdatesButton')}
                            </button>
                        </div>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item no-border">
                                <p className="about-desc-text">
                                    {t('settings.about.desc')}
                                </p>
                            </div>
                        </div>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.about.features')}</span>
                                </div>
                            </div>
                            {(((dict as any)?.settings?.about?.featureList as string[]) || []).map((feature, i, arr) => (
                                <div key={feature} className={`list-grouped-item ${i === arr.length - 1 ? 'no-border' : ''}`}>
                                    <div className="list-item-left" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span className="list-item-label" style={{ fontWeight: 400 }}>{feature}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item no-border">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.about.developer')}</span>
                                    <span className="list-item-hint">
                                        Nguyễn Quang Trường —{' '}
                                        <a href="#" className="link" onClick={(e) => { e.preventDefault(); window.electronAPI.openExternal('https://github.com/quangtruong2003') }}>
                                            GitHub
                                        </a>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="list-grouped-card">
                            <div className="list-grouped-item">
                                <div className="list-item-left">
                                    <span className="list-item-label">{t('settings.about.autoUpdate')}</span>
                                    <span className="list-item-hint">
                                        {t('settings.about.autoUpdateHint')}
                                        {appVersion && ` (Phiên bản hiện tại: v${appVersion})`}
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
                            </div>
                            {(lastUpdateCheck || updateAvailable) && (
                                <div className="list-grouped-item no-border">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                                        {lastUpdateCheck && (
                                            <p className="settings-hint">{t('settings.about.lastCheck', { time: lastUpdateCheck })}</p>
                                        )}
                                        {updateAvailable && (
                                            <p style={{ color: 'var(--success)', fontSize: 12, fontWeight: 500 }}>{t('settings.about.updateAvailableInline')}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="about-footer">
                            <p>© 2026 {t('app.name')}. All rights reserved.</p>
                        </div>
                    </div>
                )

            default:
                return null
        }
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
                            <h1 className="settings-title">{t('app.name')}</h1>
                            <p className="settings-subtitle">{t('settings.title')}</p>
                        </div>
                    </div>
                    <button className="btn-icon btn-close-settings" onClick={handleClose} title={t('common.close')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="settings-layout">
                    <nav className="settings-sidebar">
                        {getSidebarItems(t).map((item) => (
                            <button
                                key={item.id}
                                className={`sidebar-item ${activeSection === item.id ? 'active' : ''}`}
                                onClick={() => setActiveSection(item.id)}
                            >
                                <span className="sidebar-item-icon">{item.icon}</span>
                                <span className="sidebar-item-label">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="settings-body">
                        {renderContent()}
                    </div>
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
                    <span className="settings-footer-text">{t('settings.footer.toStartRecording')}</span>
                </div>
            </div>
        </div>
    )
}
