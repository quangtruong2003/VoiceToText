import { useState, useEffect } from 'react'
import { TranscriptionRecord, getHistory, deleteFromHistory, clearHistory, getHistoryStats } from '../lib/transcription-history'
import { useI18n } from '../i18n'

interface HistoryViewProps {
  onClose?: () => void
}

const LANGUAGE_LABELS: Record<string, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
}

export function HistoryView({ onClose }: HistoryViewProps) {
  const { t } = useI18n()
  const [history, setHistory] = useState<TranscriptionRecord[]>([])
  const [stats, setStats] = useState(getHistoryStats())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const loadData = () => {
    setHistory(getHistory())
    setStats(getHistoryStats())
  }

  useEffect(() => {
    loadData()

    // Listen for storage changes from other windows (e.g., RecorderOverlay adding a record)
    window.addEventListener('storage', loadData)
    // Also refresh when the window regains focus to ensure data is always fresh
    window.addEventListener('focus', loadData)

    return () => {
      window.removeEventListener('storage', loadData)
      window.removeEventListener('focus', loadData)
    }
  }, [])

  const handleDelete = (id: string) => {
    deleteFromHistory(id)
    setHistory(getHistory())
    setStats(getHistoryStats())
    if (expandedId === id) {
      setExpandedId(null)
    }
    showToast('Đã xóa bản ghi')
  }

  const handleClearAll = () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử?')) {
      clearHistory()
      setHistory([])
      setStats(getHistoryStats())
      setExpandedId(null)
      showToast('Đã xóa tất cả bản ghi')
    }
  }

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error(err)
    }
  }

  const handlePinToggle = async () => {
    if (!window.electronAPI) return
    const newPinned = !isPinned
    setIsPinned(newPinned)
    await window.electronAPI.setHistoryPinned(newPinned)
  }

  const handleClose = () => {
    if (onClose) {
      onClose()
    } else if (window.electronAPI) {
      window.electronAPI.closeHistory()
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const filteredHistory = searchQuery.trim()
    ? history.filter(record => {
      const text = (record.finalText || record.originalText).toLowerCase()
      return text.includes(searchQuery.toLowerCase())
    })
    : history

  const activeRecord = history.find(r => r.id === expandedId)

  return (
    <div className="settings-container history-master-detail">
      <div className="settings-card">
        {/* Header - giống Settings */}
        <div className="settings-header">
          <div className="settings-header-left">
            <div className="settings-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L12 12" />
                <path d="M18.5 8L18.5 13.5" />
                <path d="M5.5 8L5.5 13.5" />
                <path d="M12 22L12 12" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
            <div>
              <h1 className="settings-title">Lịch sử</h1>
              <p className="settings-subtitle">{history.length} bản ghi</p>
            </div>
          </div>
          <div className="history-header-actions-top">
            <button
              className={`btn-icon ${isPinned ? 'active-pin' : ''}`}
              onClick={handlePinToggle}
              title={isPinned ? 'Bỏ ghim khỏi trên cùng' : 'Ghim lên trên cùng'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 16v6" />
                <path d="M12 2v2" />
                <path d="M4 12H2" />
                <path d="M22 12h-2" />
              </svg>
            </button>
            <button className="btn-icon btn-close-settings" onClick={handleClose} title="Đóng">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="settings-layout">
          {/* Left Sidebar: Danh sách */}
          <div className="history-sidebar">
            <div className="history-search-sticky">
              <div className="history-sidebar-search">
                <svg className="sidebar-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  className="sidebar-search-input"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="sidebar-search-clear" onClick={() => setSearchQuery('')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="history-sidebar-list">
              {filteredHistory.length === 0 ? (
                <div className="history-sidebar-empty">
                  <span>{searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có bản ghi'}</span>
                </div>
              ) : (
                filteredHistory.map((record) => (
                  <button
                    key={record.id}
                    className={`history-sidebar-item ${expandedId === record.id ? 'active' : ''}`}
                    onClick={() => setExpandedId(record.id)}
                  >
                    <div className="item-row-text">
                      {record.finalText || record.originalText}
                    </div>
                    <div className="item-row-bottom">
                      <span className="item-date">{formatDate(record.timestamp)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {history.length > 0 && (
              <div className="history-sidebar-footer">
                <button className="sidebar-clear-btn" onClick={handleClearAll}>
                  Xóa tất cả
                </button>
              </div>
            )}
          </div>

          {/* Right Content Area: Chi tiết hoặc Bảng điều khiển */}
          <div className="settings-body history-content-area">
            {!activeRecord ? (
              /* Trạng thái mặc định: Dashboard / Bento Stats */
              <div className="settings-content-panel empty-selection-panel">
                <div className="empty-state-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                </div>
                <h2 className="empty-selection-title">Chọn một bản ghi</h2>
                <p className="empty-selection-desc">Chọn một bản ghi bên danh sách để xem nội dung chi tiết</p>

                <div className="history-stats-bento mt-6">
                  <div className="bento-stat-item">
                    <span className="bento-stat-value">{stats.totalTranscriptions}</span>
                    <span className="bento-stat-label">Tổng bản ghi</span>
                  </div>
                  <div className="bento-stat-item">
                    <span className="bento-stat-value">{stats.totalWords}</span>
                    <span className="bento-stat-label">Tổng từ</span>
                  </div>
                  <div className="bento-stat-item">
                    <span className="bento-stat-value">{stats.avgWordsPerTranscription}</span>
                    <span className="bento-stat-label">TB từ/bản</span>
                  </div>
                  <div className="bento-stat-item accent">
                    <span className="bento-stat-value">{stats.todayCount}</span>
                    <span className="bento-stat-label">Hôm nay</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Trạng thái xem chi tiết bản ghi */
              <div className="settings-content-panel detail-panel" key={activeRecord.id}>
                <div className="detail-header">
                  <div className="detail-meta">
                    <span className="history-lang-badge">{LANGUAGE_LABELS[activeRecord.language] || activeRecord.language}</span>
                    <h2 className="detail-title">{formatDate(activeRecord.timestamp)} lúc {formatTime(activeRecord.timestamp)}</h2>
                    <span className="detail-info">{formatDuration(activeRecord.duration)} • {activeRecord.wordCount} từ</span>
                  </div>

                  <div className="detail-actions">
                    <button
                      className="btn-icon-subtle"
                      onClick={() => handleCopyText(activeRecord.finalText || activeRecord.originalText, activeRecord.id)}
                      title="Copy văn bản"
                    >
                      {copiedId === activeRecord.id ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981' }}>
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                        </svg>
                      )}
                    </button>
                    <button
                      className="btn-icon-subtle danger"
                      onClick={() => handleDelete(activeRecord.id)}
                      title="Xóa bản ghi"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="detail-text-container">
                  <p className="detail-full-text">
                    {activeRecord.finalText || activeRecord.originalText}
                  </p>

                  {activeRecord.finalText && activeRecord.finalText !== activeRecord.originalText && (
                    <div className="edited-notice">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                      Văn bản đã được chỉnh sửa tự động (viết hoa/chấm câu)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="history-toast">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
