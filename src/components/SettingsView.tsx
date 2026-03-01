import { useState, useEffect, useCallback, useRef } from 'react'

const LANGUAGES = [
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
]

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
    const [activeTab, setActiveTab] = useState<'recording' | 'api'>('recording')
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

    useEffect(() => {
        window.electronAPI.getConfig().then((config) => {
            if (config.apiKey) {
                setApiKey(config.apiKey)
                setApiKeyInput(config.apiKey)
                // API validation now only triggers on explicit save action (handleSaveApiKey)
            }
            if (config.language) setLanguage(config.language)
            if (config.customPrompt) setCustomPrompt(config.customPrompt)
            if (config.hasEnvKey) setHasEnvKey(true)
            if (config.apiType) setApiType(config.apiType)
            if (config.customEndpoint) setCustomEndpoint(config.customEndpoint)
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

    const handleApiTypeChange = async (newType: 'google' | 'antigravity' | 'custom') => {
        setApiType(newType)
        await window.electronAPI.saveConfig({ apiType: newType })
    }

    const handleEndpointBlur = async () => {
        await window.electronAPI.saveConfig({ customEndpoint })
    }

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type })
    }, [])

    const handleClose = () => {
        window.electronAPI.closeSettings()
    }

    const providerIndex = API_PROVIDERS.findIndex(p => p.id === apiType)

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
                        className={`settings-tab ${activeTab === 'recording' ? 'active' : ''}`}
                        onClick={() => setActiveTab('recording')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                        <span>Ghi âm</span>
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
                        onClick={() => setActiveTab('api')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12h8" /><path d="M4 18V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M18 12h2" /><path d="M18 6h2" /><path d="M18 18h2" />
                        </svg>
                        <span>API & Nâng cao</span>
                    </button>
                    <div
                        className="settings-tab-indicator"
                        style={{
                            transform: activeTab === 'recording' ? 'translateX(0%)' : 'translateX(100%)'
                        }}
                    />
                </div>

                <div className="settings-body">
                    {activeTab === 'recording' ? (
                        /* Recording Tab */
                        <div className="settings-section-group">
                            <div className="section-header">
                                <span className="section-icon-wrap">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    </svg>
                                </span>
                                <span className="section-title">Ghi âm</span>
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
                            </div>
                        </div>
                    ) : (
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
                                        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
                    )}
                </div>

                <div className="settings-footer">
                    <div className="hotkey-display">
                        <kbd>Win</kbd>
                        <span className="hotkey-plus">+</span>
                        <kbd>Alt</kbd>
                        <span className="hotkey-plus">+</span>
                        <kbd>H</kbd>
                    </div>
                    <span className="settings-footer-text">để bắt đầu ghi âm</span>
                </div>
            </div>
        </div>
    )
}
