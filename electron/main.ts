import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  clipboard,
  Tray,
  Menu,
  nativeImage,
  screen,
  session,
  dialog,
  shell,
} from 'electron'
import path from 'path'
import fs from 'fs'
import { performanceMonitor } from './performance-monitor'

let overlayWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let historyWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isRecording = false
let isInTray = false // Track if app is minimized to tray

// Extend app with custom property for quit handling
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean
    }
  }
}

const DIST = path.join(__dirname, '../dist')
const ELECTRON_DIST = path.join(__dirname)
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

// ============================================================
// i18n FOR MAIN PROCESS (TRAY MENU)
// ============================================================

type TrayLocaleKey = 
  | 'selectEngine' | 'geminiApi' | 'whisperLocal'
  | 'checkUpdates' | 'history' | 'settings'
  | 'startRecording' | 'stopRecording' | 'exit'
  | 'updateAvailable' | 'updateMessage' | 'currentVersion' | 'newVersion'
  | 'noUpdates' | 'noUpdatesMessage' | 'appMinimized'

interface TrayLocale {
  selectEngine: string
  geminiApi: string
  whisperLocal: string
  checkUpdates: string
  history: string
  settings: string
  startRecording: string
  stopRecording: string
  exit: string
  updateAvailable: string
  updateMessage: string
  currentVersion: string
  newVersion: string
  noUpdates: string
  noUpdatesMessage: string
  appMinimized: string
}

const TRAY_LOCALES: Record<string, TrayLocale> = {
  en: {
    selectEngine: 'Select Engine',
    geminiApi: 'Gemini API',
    whisperLocal: 'Whisper Local',
    checkUpdates: 'Check for Updates',
    history: 'History',
    settings: 'Settings',
    startRecording: 'Start Recording',
    stopRecording: 'Stop Recording',
    exit: 'Exit',
    updateAvailable: 'Update Available',
    updateMessage: 'Version v{{latest}} is available!',
    currentVersion: 'Current version: v{{current}}',
    newVersion: 'New version: v{{latest}}',
    noUpdates: 'No Updates',
    noUpdatesMessage: 'You are using the latest version!',
    appMinimized: 'App minimized to system tray. Click the icon to restore.',
  },
  vi: {
    selectEngine: 'Chọn Engine',
    geminiApi: 'Gemini API',
    whisperLocal: 'Whisper Local',
    checkUpdates: 'Kiểm tra cập nhật',
    history: 'Lịch sử',
    settings: 'Cài đặt',
    startRecording: 'Bắt đầu ghi âm',
    stopRecording: 'Dừng ghi âm',
    exit: 'Thoát',
    updateAvailable: 'Cập nhật có sẵn',
    updateMessage: 'Phiên bản v{{latest}} đã sẵn sàng!',
    currentVersion: 'Phiên bản hiện tại: v{{current}}',
    newVersion: 'Phiên bản mới: v{{latest}}',
    noUpdates: 'Không có cập nhật',
    noUpdatesMessage: 'Bạn đang sử dụng phiên bản mới nhất!',
    appMinimized: 'Ứng dụng đã được thu nhỏ vào system tray. Nhấp vào icon để hiện lại.',
  },
  ja: {
    selectEngine: 'エンジンを選択',
    geminiApi: 'Gemini API',
    whisperLocal: 'Whisper (ローカル)',
    checkUpdates: 'アップデートを確認',
    history: '履歴',
    settings: '設定',
    startRecording: '録音開始',
    stopRecording: '録音停止',
    exit: '終了',
    updateAvailable: 'アップデートあり',
    updateMessage: 'バージョン v{{latest}} が利用可能です！',
    currentVersion: '現在のバージョン: v{{current}}',
    newVersion: '新しいバージョン: v{{latest}}',
    noUpdates: 'アップデートなし',
    noUpdatesMessage: '最新バージョンを使用しています！',
    appMinimized: 'システムはトレイに最小化されました。アイコンをクリックして復元します。',
  },
  ko: {
    selectEngine: '엔진 선택',
    geminiApi: 'Gemini API',
    whisperLocal: 'Whisper (로컬)',
    checkUpdates: '업데이트 확인',
    history: '기록',
    settings: '설정',
    startRecording: '녹음 시작',
    stopRecording: '녹음 중지',
    exit: '종료',
    updateAvailable: '업데이트 가능',
    updateMessage: '버전 v{{latest}}을(를) 사용할 수 있습니다!',
    currentVersion: '현재 버전: v{{current}}',
    newVersion: '새 버전: v{{latest}}',
    noUpdates: '업데이트 없음',
    noUpdatesMessage: '최신 버전을 사용 중입니다!',
    appMinimized: '앱이 시스템 트레이로 최소화되었습니다. 아이콘을 클릭하여 복원하세요.',
  },
  zh: {
    selectEngine: '选择引擎',
    geminiApi: 'Gemini API',
    whisperLocal: 'Whisper (本地)',
    checkUpdates: '检查更新',
    history: '历史',
    settings: '设置',
    startRecording: '开始录音',
    stopRecording: '停止录音',
    exit: '退出',
    updateAvailable: '有可用更新',
    updateMessage: '版本 v{{latest}} 可用！',
    currentVersion: '当前版本：v{{current}}',
    newVersion: '新版本：v{{latest}}',
    noUpdates: '没有更新',
    noUpdatesMessage: '您正在使用最新版本！',
    appMinimized: '应用已最小化到系统托盘。点击图标恢复。',
  },
}

function getTrayLocale(lang: string): TrayLocale {
  return TRAY_LOCALES[lang] || TRAY_LOCALES.en
}

function tTray(key: TrayLocaleKey, vars?: Record<string, string>): string {
  const config = loadConfig()
  const locale = getTrayLocale(config.language)
  let text = locale[key] || TRAY_LOCALES.en[key] || key
  
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{{${k}}}`, v)
    }
  }
  return text
}

// In-memory config cache to avoid repeated disk reads
let configCache: AppConfig | null = null
let configLoadTime: number = 0
const CONFIG_CACHE_TTL_MS = 5000 // Cache config for 5 seconds

interface AppConfig {
  apiKey: string
  language: string
  customPrompt: string
  apiType: 'google' | 'antigravity' | 'custom'
  customEndpoint: string
  startWithWindows: boolean
  hotkey: string
  historyHotkey: string
  settingsHotkey: string
  geminiModel: string
  autoUpdate?: boolean
  lastUpdateCheck?: string
  transcriptionEngine: 'gemini' | 'whisper'
  whisperModel: string
  whisperModelPath: string
  whisperTask: 'transcribe' | 'translate'
  // Punctuation & Formatting Settings
  punctuationSettings: {
    autoCapitalize: boolean
    addPeriodAtEnd: boolean
    removeFillerWords: boolean
    numberFormatting: 'none' | 'digits' | 'words'
  }
  // User Window Preferences
  historyWindowBounds?: {
    width: number
    height: number
    x?: number
    y?: number
  }
}

// Default punctuation settings
const DEFAULT_PUNCTUATION_SETTINGS = {
  autoCapitalize: true,
  addPeriodAtEnd: true,
  removeFillerWords: false,
  numberFormatting: 'none' as const,
}

// Compare version strings (e.g., "1.2.0" vs "1.1.0")
// Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  const maxLen = Math.max(parts1.length, parts2.length)

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  return 0
}

function loadEnvApiKey(): string {
  try {
    const envPath = path.join(app.getAppPath(), '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      const match = content.match(/^VITE_GEMINI_API_KEY=(.+)$/m)
      if (match && match[1]?.trim()) return match[1].trim()
    }
  } catch {}
  return ''
}

function loadConfig(forceReload = false): AppConfig {
  const now = Date.now()
  
  // Return cached config if valid and not forcing reload
  if (!forceReload && configCache && (now - configLoadTime) < CONFIG_CACHE_TTL_MS) {
    return configCache
  }
  
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))

      let needsMigration = false

      // Migration: hotkey Win+Alt+H → Control+Space
      if (config.hotkey === 'Win+Alt+H') {
        config.hotkey = 'Control+Space'
        needsMigration = true
      }

      // Migration: geminiModel gemini-2.0-flash → gemini-2.0-flash (current default)
      if (config.geminiModel && config.geminiModel.includes('gemini-3-flash-preview')) {
        config.geminiModel = 'gemini-3-flash-preview'
        needsMigration = true
      }

      // Migration: remove obsolete fields
      const obsoleteFields = ['showTextEditor']
      for (const field of obsoleteFields) {
        if (field in config) {
          delete config[field]
          needsMigration = true
        }
      }

      if (!config.historyHotkey) {
        config.historyHotkey = 'Alt+V'
        needsMigration = true
      }

      if (!config.settingsHotkey) {
        config.settingsHotkey = 'Alt+S'
        needsMigration = true
      }

      const merged: AppConfig = {
        apiKey: '',
        language: 'en',
        customPrompt: '',
        apiType: 'google',
        customEndpoint: '',
        startWithWindows: false,
        hotkey: 'Control+Space',
        historyHotkey: 'Alt+V',
        settingsHotkey: 'Alt+S',
        geminiModel: 'gemini-2.0-flash',
        transcriptionEngine: 'gemini',
        whisperModel: 'onnx-community/whisper-small',
        whisperModelPath: '',
        whisperTask: 'transcribe' as const,
        punctuationSettings: DEFAULT_PUNCTUATION_SETTINGS,

        ...config
      }

      if (needsMigration) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2))
      }

      // Update cache
      configCache = merged
      configLoadTime = now
      return merged
    }
  } catch {}
  
  const defaultConfig: AppConfig = {
    apiKey: '',
    language: 'en',
    customPrompt: '',
    apiType: 'google',
    customEndpoint: '',
    startWithWindows: false,
    hotkey: 'Control+Space',
    historyHotkey: 'Alt+V',
    settingsHotkey: 'Alt+S',
    geminiModel: 'gemini-2.0-flash',
    transcriptionEngine: 'gemini',
    whisperModel: 'onnx-community/whisper-small',
    whisperModelPath: '',
    whisperTask: 'transcribe' as const,
    punctuationSettings: DEFAULT_PUNCTUATION_SETTINGS,
  }
  
  // Cache the default config
  configCache = defaultConfig
  configLoadTime = now
  return defaultConfig
}

function getApiKey(): string {
  const envKey = loadEnvApiKey()
  if (envKey) return envKey
  return loadConfig().apiKey
}

function getApiEndpoint(): string {
  const config = loadConfig()
  if (config.apiType === 'custom' && config.customEndpoint) {
    return config.customEndpoint.replace(/\/$/, '') // Remove trailing slash
  }
  if (config.apiType === 'antigravity') {
    // Default Antigravity endpoint - user should provide their own
    // Common format: https://your-antigravity-endpoint.com
    return config.customEndpoint || 'https://api.antigravity.app'
  }
  // Default Google endpoint
  return 'https://generativelanguage.googleapis.com'
}

interface GeminiModel {
  name: string
  displayName: string
  description: string
  version: string
  supportsAudio?: boolean
}

async function fetchGeminiModels(): Promise<GeminiModel[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []

  const config = loadConfig()
  const baseUrl = getApiEndpoint()
  const apiVersion = (config.apiType === 'google' || !config.apiType) ? 'v1beta' : 'v1'

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (config.apiType === 'google' || !config.apiType) {
      headers['X-goog-api-key'] = apiKey
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`${baseUrl}/${apiVersion}/models?pageSize=100`, {
      headers
    })

    if (!response.ok) {
      console.error('Failed to fetch models:', response.status, await response.text())
      return []
    }

    const data = await response.json()
    const models: GeminiModel[] = []

    if (data.models && Array.isArray(data.models)) {
      for (const model of data.models) {
        // Filter only Gemini models that support generateContent
        if (model.name && model.name.includes('gemini') &&
            (model.supportedGenerationMethods?.includes('generateContent') ||
             model.supportedGenerationMethods?.includes('streamGenerateContent'))) {
          models.push({
            name: model.name.replace('models/', ''),
            displayName: model.displayName || model.name,
            description: model.description || '',
            version: model.version || '',
            supportsAudio: model.supportedGenerationMethods?.includes('streamGenerateContent')
          })
        }
      }
    }

    return models
  } catch (error) {
    console.error('Error fetching Gemini models:', error)
    return []
  }
}

function saveConfig(config: Partial<AppConfig>) {
  const existing = loadConfig(true) // Force reload to get latest
  const merged = { ...existing, ...config }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2))
  
  // Update cache with new config
  configCache = merged
  configLoadTime = Date.now()

  // Broadcast config changes to all windows
  broadcastConfigUpdate(config)

  // Handle auto-start setting changes
  if (config.startWithWindows !== undefined) {
    setAutoStart(config.startWithWindows)
  }
}

function broadcastConfigUpdate(partial: Partial<AppConfig>) {
  const windows = [overlayWindow, settingsWindow, historyWindow]
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send('config-updated', partial)
    }
  }

  // Rebuild tray menu when language or settingsHotkey changes
  if (tray && (partial.language !== undefined || partial.settingsHotkey !== undefined)) {
    currentSettingsHotkey = partial.settingsHotkey || currentSettingsHotkey
    tray.setContextMenu(buildTrayMenu())
  }
}

function setAutoStart(enabled: boolean) {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: ['--hidden']
    })
  }
}

function getAutoStartStatus(): boolean {
  if (process.platform === 'win32') {
    const settings = app.getLoginItemSettings()
    return settings.openAtLogin
  }
  return false
}

function setupPermissions() {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(['media', 'clipboard-read', 'clipboard-sanitized-write'].includes(permission))
    }
  )
  // Only check permissions for our app - not all origins
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    // Allow clipboard and media for our windows only
    const origin = webContents.getURL()
    // For now, allow these permissions within the app
    if (['clipboard-read', 'clipboard-sanitized-write', 'media'].includes(permission)) {
      return true
    }
    // Deny everything else by default
    return false
  })
}

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
  const overlayWidth = 320
  const overlayHeight = 72

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: Math.round((screenWidth - overlayWidth) / 2),
    y: screenHeight - overlayHeight - 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false, // Show icon in taskbar
    show: false,
    focusable: true, // Enable focus so window can be brought to foreground
    // Set taskbar icon
    icon: createTaskbarIcon(),
    webPreferences: {
      preload: path.join(ELECTRON_DIST, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Set overlay icon for Windows taskbar (shown when window is minimized)
  if (process.platform === 'win32') {
    overlayWindow.setOverlayIcon(createTrayIcon(), 'Voice to Prompt')
  }

  // Handle close event - minimize to tray instead of closing
  overlayWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      handleWindowClose(overlayWindow!)
    }
  })

  const url = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}#overlay`
    : path.join(DIST, 'index.html')

  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#overlay`)
  } else {
    overlayWindow.loadFile(url, { hash: 'overlay' })
  }

  // Don't show window automatically - only show when recording starts
  // overlayWindow.once('ready-to-show', () => {
  //   overlayWindow?.show()
  // })
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  settingsWindow = new BrowserWindow({
    width: 620,
    height: 580,
    x: Math.round((screenWidth - 620) / 2),
    y: Math.round((screenHeight - 580) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    // Set taskbar icon
    icon: createTaskbarIcon(),
    webPreferences: {
      preload: path.join(ELECTRON_DIST, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Handle close - minimize to tray instead of closing
  settingsWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      settingsWindow?.hide()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#settings`)
  } else {
    settingsWindow.loadFile(path.join(DIST, 'index.html'), { hash: 'settings' })
  }

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show()
    settingsWindow?.focus()
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

/**
 * Creates the history window for viewing transcription history
 */
function createHistoryWindow() {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.show()
    historyWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const config = loadConfig()
  const bounds = config.historyWindowBounds

  // Default dimensions
  let width = 420
  let height = 500
  let x = Math.round((screenWidth - width) / 2)
  let y = Math.round((screenHeight - height) / 2)

  // Use saved bounds if available and within screen bounds
  if (bounds) {
    width = bounds.width || width
    height = bounds.height || height
    
    // Basic bounds checking to ensure window isn't lost off-screen
    if (bounds.x !== undefined && bounds.y !== undefined) {
      if (bounds.x >= 0 && bounds.x + width <= screenWidth) x = bounds.x
      if (bounds.y >= 0 && bounds.y + height <= screenHeight) y = bounds.y
    }
  }

  historyWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 360,
    minHeight: 400,
    frame: false,
    transparent: true,
    resizable: true,
    show: false,
    alwaysOnTop: false,
    icon: createTaskbarIcon(),
    webPreferences: {
      preload: path.join(ELECTRON_DIST, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Handle close - save bounds and hide instead of closing
  historyWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      
      // Save window bounds before hiding
      if (historyWindow && !historyWindow.isMaximized() && !historyWindow.isFullScreen()) {
        const currentBounds = historyWindow.getBounds()
        saveConfig({ historyWindowBounds: currentBounds })
      }
      
      historyWindow?.hide()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    historyWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#history`)
  } else {
    historyWindow.loadFile(path.join(DIST, 'index.html'), { hash: 'history' })
  }

  historyWindow.once('ready-to-show', () => {
    historyWindow?.show()
    historyWindow?.focus()
  })

  historyWindow.on('closed', () => {
    historyWindow = null
  })
}

/**
 * Sets the history window always on top state
 */
function setHistoryWindowPinned(pinned: boolean) {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.setAlwaysOnTop(pinned, 'screen-saver')
  }
}

// ============================================================
// ICON LOADING UTILITIES
// ============================================================

/**
 * Gets the path to the icon file (.ico or .png)
 */
function getIconPath(): string | null {
  const possiblePaths = [
    // Development paths
    path.join(app.getAppPath(), 'public', 'icon.ico'),
    path.join(app.getAppPath(), 'public', 'icon.png'),
    // Production paths (resources)
    path.join(process.resourcesPath || app.getAppPath(), 'icon.ico'),
    path.join(process.resourcesPath || app.getAppPath(), 'icon.png'),
    // Build output paths
    path.join(DIST, 'icon.ico'),
    path.join(DIST, 'icon.png'),
  ]

  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      return iconPath
    }
  }

  return null
}

/**
 * Creates tray icon (16x16) for system tray
 */
function createTrayIcon(): Electron.NativeImage {
  const iconPath = getIconPath()
  
  if (iconPath) {
    try {
      const icon = nativeImage.createFromPath(iconPath)
      // Resize to 16x16 for system tray
      return icon.resize({ width: 16, height: 16 })
    } catch (err) {
      console.warn('Failed to load tray icon:', err)
    }
  }

  // Fallback: Generate a simple colored icon
  return generateFallbackIcon(16, [99, 102, 241])
}

/**
 * Creates taskbar icon (32x32)
 */
function createTaskbarIcon(): Electron.NativeImage {
  const iconPath = getIconPath()
  
  if (iconPath) {
    try {
      const icon = nativeImage.createFromPath(iconPath)
      return icon.resize({ width: 32, height: 32 })
    } catch (err) {
      console.warn('Failed to load taskbar icon:', err)
    }
  }

  return generateFallbackIcon(32, [99, 102, 241])
}

/**
 * Generates a simple colored square icon as fallback
 */
function generateFallbackIcon(size: number, rgb: number[]): Electron.NativeImage {
  const canvas = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = rgb[0]     // R
    canvas[i * 4 + 1] = rgb[1] // G
    canvas[i * 4 + 2] = rgb[2] // B
    canvas[i * 4 + 3] = 255    // A (opaque)
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size })
}

// ============================================================
// SYSTEM TRAY IMPLEMENTATION
// ============================================================

/**
 * Builds the tray context menu with current engine selection
 */
function buildTrayMenu(): Electron.Menu {
  const config = loadConfig()
  const currentEngine = config.transcriptionEngine || 'gemini'

  const contextMenu = Menu.buildFromTemplate([
    {
      label: tTray('selectEngine'),
      submenu: [
        {
          label: tTray('geminiApi'),
          type: 'checkbox',
          checked: currentEngine === 'gemini',
          click: () => {
            saveConfig({ transcriptionEngine: 'gemini' })
            tray?.setContextMenu(buildTrayMenu())
          },
        },
        {
          label: tTray('whisperLocal'),
          type: 'checkbox',
          checked: currentEngine === 'whisper',
          click: () => {
            saveConfig({ transcriptionEngine: 'whisper' })
            tray?.setContextMenu(buildTrayMenu())
          },
        },
      ],
    },
    { type: 'separator' },
    {
      label: tTray('checkUpdates'),
      click: async () => {
        try {
          const currentVersion = app.getVersion()
          const response = await fetch('https://api.github.com/repos/quangtruong2003/VoiceToPrompt/releases/latest')
          if (response.ok) {
            const data = await response.json()
            const latestVersion = data.tag_name?.replace('v', '') || '0.0.0'
            
            const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0
            if (isUpdateAvailable) {
              dialog.showMessageBox({
                type: 'info',
                title: tTray('updateAvailable'),
                message: tTray('updateMessage', { latest: latestVersion }),
                detail: `${tTray('currentVersion', { current: currentVersion })}\n${tTray('newVersion', { latest: latestVersion })}`,
              })
            } else {
              dialog.showMessageBox({
                type: 'info',
                title: tTray('noUpdates'),
                message: tTray('noUpdatesMessage'),
                detail: tTray('currentVersion', { current: currentVersion }),
              })
            }
          }
        } catch (err) {
          console.error('Failed to check for updates:', err)
        }
      },
    },
    { type: 'separator' },
    {
      label: tTray('history'),
      accelerator: currentHistoryHotkey,
      click: () => createHistoryWindow(),
    },
    {
      label: tTray('settings'),
      accelerator: currentSettingsHotkey,
      click: () => createSettingsWindow(),
    },
    {
      label: isRecording ? tTray('stopRecording') : tTray('startRecording'),
      accelerator: currentActionHotkey,
      click: () => toggleRecording(),
    },
    { type: 'separator' },
    {
      label: tTray('exit'),
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  return contextMenu
}

function createTray() {
  const trayIcon = createTrayIcon()
  tray = new Tray(trayIcon)

  // Set tooltip - shown when hovering over tray icon
  tray.setToolTip('Voice to Prompt - Click to open')

  // Build context menu with standard options
  tray.setContextMenu(buildTrayMenu())

  // Single click opens settings directly
  tray.on('click', () => {
    createSettingsWindow()
  })

  // Remove double-click handler
  tray.on('double-click', () => {
    createSettingsWindow()
  })
}

/**
 * Shows the overlay window and removes tray indicator
 */
function showOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    // Use show() + focus() instead of showInactive() to ensure window comes to foreground
    overlayWindow.show()
    overlayWindow.focus()
  }
  isInTray = false
}

/**
 * Handles window close - minimizes to tray instead of closing
 */
function handleWindowClose(window: BrowserWindow) {
  window.hide()
  isInTray = true
  
  // Show balloon notification (Windows only)
  if (process.platform === 'win32' && tray) {
    tray.displayBalloon({
      title: 'Voice to Prompt',
      content: tTray('appMinimized'),
      iconType: 'info',
    })
  }
}

function registerRecordingShortcuts() {
  // Note: Enter/Escape are registered globally while recording to allow stopping/canceling
  // from any application. This is necessary because the overlay window may not have focus.
  // Consider making these configurable in settings in the future.
  try {
    const handleStop = () => {
      if (isRecording) {
        overlayWindow?.webContents.send('force-stop-recording')
      }
    }
    const handleCancel = () => {
      if (isRecording) {
        overlayWindow?.webContents.send('force-cancel-recording')
      }
    }
    globalShortcut.register('Enter', handleStop)
    globalShortcut.register('Return', handleStop)
    globalShortcut.register('Escape', handleCancel)
  } catch (e) {
    console.warn('Failed to register recording shortcuts', e)
  }
}

function unregisterRecordingShortcuts() {
  try { globalShortcut.unregister('Enter') } catch {}
  try { globalShortcut.unregister('Return') } catch {}
  try { globalShortcut.unregister('Escape') } catch {}
}

function toggleRecording() {
  isRecording = !isRecording

  if (isRecording) {
    registerRecordingShortcuts()
    // Show window without stealing focus from the user's current text editor/app
    overlayWindow?.showInactive()
    overlayWindow?.webContents.send('toggle-recording', true)
  } else {
    unregisterRecordingShortcuts()
    overlayWindow?.webContents.send('toggle-recording', false)
    overlayWindow?.hide()
  }
}

async function fetchGemini(apiKey: string, payload: any): Promise<Response> {
  const config = loadConfig()
  
  // Always use model from config - must be set by user from the dropdown
  const model = config.geminiModel || 'gemini-2.0-flash'
  
  const baseUrl = getApiEndpoint()

  // Determine API version path based on API type
  const apiVersion = (config.apiType === 'google' || !config.apiType) ? 'v1beta' : 'v1'

  // Determine headers based on API type
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiType === 'google' || !config.apiType) {
    // Google official API uses X-goog-api-key header
    headers['X-goog-api-key'] = apiKey
  } else {
    // Antigravity/Custom uses Authorization header
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  // Try the selected model with retries
  let retries = 3
  let lastError: Error | null = null
  while (retries > 0) {
    try {
      const resp = await fetch(`${baseUrl}/${apiVersion}/models/${model}:generateContent`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      })
      
      if (resp.ok) return resp
      
      // Retry on 503 (Service Unavailable) and 429 (Too Many Requests)
      if ((resp.status === 503 || resp.status === 429) && retries > 1) {
        const delay = Math.pow(2, 3 - retries) * 1000 // Exponential backoff: 1s, 2s, 4s
        console.warn(`Gemini model ${model} returned ${resp.status}, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        retries--
        continue
      }
      
      console.warn(`Gemini model ${model} failed with status ${resp.status}`)
      // Return the failed response for error handling
      return resp
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`Network error with model ${model}:`, err)
      if (retries > 1) {
        const delay = Math.pow(2, 3 - retries) * 1000
        console.log(`Retrying after ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        retries--
        continue
      }
      break
    }
  }
  
  // If we get here, all retries failed - throw to propagate the error
  throw lastError || new Error('All retries failed')
}

async function transcribeAudio(audioBuffer: ArrayBuffer, language: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('NO_API_KEY')

  const config = loadConfig()
  const base64Audio = Buffer.from(audioBuffer).toString('base64')

  // Always use prompt from settings, or a firm default to prevent describing audio
  const defaultPrompt = 'You are a transcription assistant. Your only job is to exactly transcribe the spoken words in this audio into text in the original language. Do not describe the audio, background noise, or speakers. Do not add metadata, translations, or commentary. Output ONLY the transcribed text.'
  const promptText = config.customPrompt?.trim() || defaultPrompt

  const payload = {
    contents: [{
      parts: [
        { text: promptText },
        { inlineData: { mimeType: 'audio/webm', data: base64Audio } }
      ]
    }]
  }

  const endpoint = `gemini://${config.geminiModel || 'gemini-3.0-flash'}`
  const callMetrics = performanceMonitor.startApiCall(endpoint, 'POST')
  const startTime = Date.now()
  try {
    const response = await fetchGemini(apiKey, payload)

    if (!response || !response.ok) {
      const errorData = response ? await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } })) : { error: { message: 'Network error or all retries failed' } }
      console.error('Gemini API error:', JSON.stringify(errorData, null, 2))
      performanceMonitor.completeApiCall(callMetrics, response?.status || 500, Date.now() - startTime)
      throw new Error(errorData.error?.message || `API_ERROR: HTTP ${response?.status || 'unknown'}`)
    }

    const data = await response.json()
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

    const punctuationSettings = config.punctuationSettings || DEFAULT_PUNCTUATION_SETTINGS
    const result = formatText(rawText, punctuationSettings)
    performanceMonitor.completeApiCall(callMetrics, 200, Date.now() - startTime)
    return result
  } catch (err) {
    performanceMonitor.completeApiCall(callMetrics, 500, Date.now() - startTime)
    throw err
  }
}

// ============================================================
// WHISPER LOCAL TRANSCRIPTION (Transformers.js + ONNX)
// ============================================================

const WHISPER_MODELS = [
  { id: 'onnx-community/whisper-tiny', name: 'Whisper Tiny', size: '~75MB' },
  { id: 'onnx-community/whisper-base', name: 'Whisper Base', size: '~142MB' },
  { id: 'onnx-community/whisper-small', name: 'Whisper Small', size: '~461MB' },
  { id: 'onnx-community/whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo', size: '~1.5GB' },
  { id: 'onnx-community/PhoWhisper-base-ONNX', name: 'PhoWhisper Base (Vietnamese)', size: '~140MB' },
]

let whisperPipeline: any = null
let currentWhisperModelId: string | null = null
let currentWhisperCacheDir: string | null = null

function getWhisperCacheDir(): string {
  const config = loadConfig()
  if (config.whisperModelPath && config.whisperModelPath.trim()) {
    return config.whisperModelPath.trim()
  }
  return path.join(app.getPath('userData'), 'whisper-models')
}

async function getWhisperPipeline(modelId: string) {
  const cacheDir = getWhisperCacheDir()

  if (whisperPipeline && currentWhisperModelId === modelId && currentWhisperCacheDir === cacheDir) {
    return whisperPipeline
  }

  const { pipeline, env } = await import('@huggingface/transformers')

  // Set custom cache directory globally for transformers
  env.cacheDir = cacheDir
  env.localModelPath = cacheDir
  env.allowLocalModels = true
  env.allowRemoteModels = true

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }

  console.log(`Loading Whisper model: ${modelId} (cache: ${cacheDir})...`)

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('whisper-download-progress', {
      modelId,
      status: 'loading',
      progress: 0,
    })
  }

  // Also pass to pipeline options as fallback
  whisperPipeline = await pipeline('automatic-speech-recognition', modelId, {
    dtype: 'q8',
    cache_dir: cacheDir,
  })
  currentWhisperModelId = modelId
  currentWhisperCacheDir = cacheDir

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('whisper-download-progress', {
      modelId,
      status: 'ready',
      progress: 100,
    })
  }

  console.log(`Whisper model ${modelId} loaded successfully`)
  return whisperPipeline
}

async function transcribeWithWhisper(pcmFloat32: Float32Array, language: string): Promise<string> {
  const config = loadConfig()
  const modelId = config.whisperModel

  const pipe = await getWhisperPipeline(modelId)

  const whisperTask = config.whisperTask

  // Mirror the whisper.cpp / Handy approach:
  // - Beam search (beam_size=3) gives better accuracy than greedy decoding
  // - condition_on_prev_tokens=false prevents the model from hallucinating
  //   based on its own previous output (main cause of repeated "Hello, hello, hello...")
  // - compression_ratio_threshold & logprob_threshold reject low-quality segments
  //   (same as whisper.cpp's built-in quality gates)
  const isLargeModel = modelId.toLowerCase().includes('large') || modelId.toLowerCase().includes('turbo')

  const generateKwargs: Record<string, any> = {
    num_beams: 3,                       // beam search — same as whisper.cpp default
    do_sample: false,                   // no random sampling when using beams
    max_new_tokens: 448,                // Whisper's natural maximum
    condition_on_prev_tokens: false,    // key: stops hallucination loops
    compression_ratio_threshold: 2.4,  // reject overly repetitive segments
    logprob_threshold: -1.0,           // reject low-confidence segments
    no_speech_threshold: 0.6,          // treat as silence when no-speech prob > 0.6
  }
  if (isLargeModel) {
    generateKwargs.repetition_penalty = 1.3  // extra safety for large/turbo models
  }

  const generationOptions: Record<string, any> = {
    task: whisperTask,
    generate_kwargs: generateKwargs,
  }

  // Try to force language auto-detection by passing empty language token
  // This is a workaround for Transformers.js defaulting to English
  // The language token format is <|X|> where X is the language name
  // Setting to empty string may trigger auto-detection in some versions
  const languageMap: Record<string, string> = {
    'vi': 'vietnamese',
    'en': 'english',
  }

  // Only set language when explicitly provided; otherwise let Whisper auto-detect.
  const normalizedLang = language?.toLowerCase().trim()
  if (normalizedLang && normalizedLang !== 'auto' && languageMap[normalizedLang]) {
    generationOptions.language = languageMap[normalizedLang]
    console.log(`Using explicit language: ${generationOptions.language}`)
  } else {
    console.log('Using auto language detection')
  }

  const callMetrics = performanceMonitor.startApiCall('local://whisper', 'PROCESS')
  const startTime = Date.now()
  let result: any
  try {
    result = await pipe(pcmFloat32, generationOptions)
    performanceMonitor.completeApiCall(callMetrics, 200, Date.now() - startTime)
  } catch (err) {
    performanceMonitor.completeApiCall(callMetrics, 500, Date.now() - startTime)
    throw err
  }

  let rawText = (result?.text || '').trim()

  // Remove Whisper's own annotation tokens: [laughter], [music], (silence), etc.
  // These are bracketed/parenthesised tokens injected by the model itself, not real speech.
  // Do NOT remove bare words — that would corrupt legitimate transcription.
  rawText = rawText.replace(/\[.*?\]/g, '')  // [laughter], [music], [BLANK_AUDIO]
  rawText = rawText.replace(/\(.*?\)/g, '')  // (silence), (laughing)

  // Discard output that is only a no-speech sentinel
  if (/^\s*(silence|blank|unintelligible|♪|♫)\s*$/i.test(rawText)) {
    rawText = ''
  }

  // For large/turbo models only: collapse aggressive repetition loops that slip through
  // e.g. "hello hello hello hello" → "hello hello" (keep up to 2 occurrences)
  if (isLargeModel) {
    rawText = rawText.replace(/\b(\w+)(?:\s+\1){3,}\b/gi, '$1 $1')  // 4+ repeats → 2
  }

  // Normalise whitespace
  rawText = rawText.replace(/\s+/g, ' ').trim()

  const punctuationSettings = config.punctuationSettings || DEFAULT_PUNCTUATION_SETTINGS
  return formatText(rawText, punctuationSettings)
}


/**
 * Format text based on punctuation settings
 */
function formatText(text: string, settings: AppConfig['punctuationSettings']): string {
  let formatted = text

  // Remove filler words (Vietnamese: à, ừ, ờ, ơ, ạ... | English: um, uh, er...)
  if (settings.removeFillerWords) {
    const vietnameseFillers = /\b(à|ừ|ờ|ơ|ạ|à|úi|ui|ở|ể|ọ|ể|ị|ì|ì|ì)\b/gi
    const englishFillers = /\b(um|uh|er|ah|like|you know|well|so|I mean)\b/gi
    const japaneseFillers = /\b(あの|その|つまり|えーと)\b/gi
    const koreanFillers = /\b(음|어|저기|그냥)\b/gi
    const chineseFillers = /\b(嗯|啊|这个|就是)\b/gi

    formatted = formatted
      .replace(vietnameseFillers, '')
      .replace(englishFillers, '')
      .replace(japaneseFillers, '')
      .replace(koreanFillers, '')
      .replace(chineseFillers, '')

    // Clean up multiple spaces
    formatted = formatted.replace(/\s+/g, ' ').trim()
  }

  // Auto capitalize first letter of sentences
  if (settings.autoCapitalize) {
    formatted = formatted.replace(/(^\w|[.!?]\s+\w)/g, (match) => match.toUpperCase())
  }

  // Add period at end if no punctuation
  if (settings.addPeriodAtEnd) {
    const trimmed = formatted.trim()
    if (trimmed && !/[.!?]$/.test(trimmed)) {
      formatted = trimmed + '.'
    }
  }

  // Number formatting
  if (settings.numberFormatting === 'digits') {
    // Convert number words to digits
    const numberWords: Record<string, string> = {
      'một': '1', 'hai': '2', 'ba': '3', 'bốn': '4', 'năm': '5',
      'sáu': '6', 'bảy': '7', 'tám': '8', 'chín': '9', 'mười': '10',
      'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
      'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    }
    for (const [word, digit] of Object.entries(numberWords)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      formatted = formatted.replace(regex, digit)
    }
  }

  return formatted.trim()
}

async function validateApiKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
  if (!apiKey) return { valid: false, error: 'Empty API key' }
  try {
    const config = loadConfig()
    const payload = { contents: [{ parts: [{ text: 'ping' }] }] }
    const response = await fetchGemini(apiKey, payload)

    if (response && response.ok) return { valid: true }

    // Log detailed error for debugging
    let errorMsg = `HTTP ${response?.status}`
    try {
      if (response) {
        const errorData = await response.json()
        console.error('API Error Response:', JSON.stringify(errorData, null, 2))
        errorMsg = errorData.error?.message || errorData.message || errorMsg
      }
    } catch {
      errorMsg = response ? `HTTP ${response.status}` : 'No response from server'
    }

    return { valid: false, error: errorMsg }
  } catch (error: any) {
    console.error('Validation error:', error)
    return { valid: false, error: error.message || 'Unknown error' }
  }
}

async function injectText(text: string) {
  if (!text || text.trim().length === 0) return
  try {
    const previousClipboard = clipboard.readText()
    clipboard.writeText(text)

    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide()
    await new Promise((resolve) => setTimeout(resolve, 150))

    const { keyboard, Key } = await import('@nut-tree-fork/nut-js')
    keyboard.config.autoDelayMs = 20
    await keyboard.pressKey(Key.LeftControl, Key.V)
    await keyboard.releaseKey(Key.LeftControl, Key.V)

    setTimeout(() => clipboard.writeText(previousClipboard), 500)

    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('injection-complete', { success: true })
    }
  } catch (error) {
    console.error('Text injection failed:', error)
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('injection-complete', { success: false })
    }
  }
}

let currentActionHotkey = 'Control+Space'
let currentHistoryHotkey = 'Alt+V'
let currentSettingsHotkey = 'Alt+S'

function registerGlobalShortcut() {
  const config = loadConfig()
  currentActionHotkey = config.hotkey || 'Control+Space'
  const electronHotkey = currentActionHotkey.replace('Win', 'Super')
  try {
    globalShortcut.register(electronHotkey, () => toggleRecording())
  } catch (e) {
    console.warn('Failed to register global shortcut', e)
  }
}

function registerHistoryShortcut() {
  const config = loadConfig()
  currentHistoryHotkey = config.historyHotkey || 'Alt+V'
  const electronHotkey = currentHistoryHotkey.replace('Win', 'Super')
  try {
    globalShortcut.register(electronHotkey, () => createHistoryWindow())
  } catch (e) {
    console.warn('Failed to register history shortcut', e)
  }
}

function registerNewHotkey(hotkey: string) {
  const electronHotkey = hotkey.replace('Win', 'Super')
  try {
    if (currentActionHotkey) {
      globalShortcut.unregister(currentActionHotkey.replace('Win', 'Super'))
    }
    globalShortcut.register(electronHotkey, () => toggleRecording())
    currentActionHotkey = hotkey
  } catch (e) {
    console.warn('Failed to register new hotkey', e)
    registerGlobalShortcut()
  }
}

function registerNewHistoryHotkey(hotkey: string) {
  const electronHotkey = hotkey.replace('Win', 'Super')
  try {
    if (currentHistoryHotkey) {
      globalShortcut.unregister(currentHistoryHotkey.replace('Win', 'Super'))
    }
    globalShortcut.register(electronHotkey, () => createHistoryWindow())
    currentHistoryHotkey = hotkey
  } catch (e) {
    console.warn('Failed to register new history hotkey', e)
    registerHistoryShortcut()
  }
}

function registerSettingsShortcut() {
  const config = loadConfig()
  currentSettingsHotkey = config.settingsHotkey || 'Alt+S'
  const electronHotkey = currentSettingsHotkey.replace('Win', 'Super')
  try {
    globalShortcut.register(electronHotkey, () => createSettingsWindow())
  } catch (e) {
    console.warn('Failed to register settings shortcut', e)
  }
}

function registerNewSettingsHotkey(hotkey: string) {
  const electronHotkey = hotkey.replace('Win', 'Super')
  try {
    if (currentSettingsHotkey) {
      globalShortcut.unregister(currentSettingsHotkey.replace('Win', 'Super'))
    }
    globalShortcut.register(electronHotkey, () => createSettingsWindow())
    currentSettingsHotkey = hotkey
  } catch (e) {
    console.warn('Failed to register new settings hotkey', e)
    registerSettingsShortcut()
  }
}

async function downloadAndInstallUpdate(downloadUrl: string, fileName: string): Promise<void> {
  const tempDir = path.join(app.getPath('temp'), 'voice-to-prompt-update')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  const filePath = path.join(tempDir, fileName)

  const response = await fetch(downloadUrl)
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(filePath, buffer)

  // Launch installer and quit app
  const { exec } = require('child_process')
  exec(`"${filePath}"`, { detached: true, stdio: 'ignore' })

  setTimeout(() => {
    app.isQuitting = true
    app.quit()
  }, 1000)
}

async function showUpdateDialog(currentVersion: string, latestVersion: string, assets: any[]): Promise<void> {
  const setupAsset = assets.find((a: any) => a.name.endsWith('.exe'))
  if (!setupAsset) {
    dialog.showErrorBox('Cập nhật', 'Không tìm thấy file cài đặt cho bản cập nhật này.')
    return
  }

  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Có bản cập nhật mới!',
    message: `Phiên bản mới đã sẵn sàng!`,
    detail: `Phiên bản hiện tại: v${currentVersion}\nPhiên bản mới: v${latestVersion}\n\nBạn có muốn tải và cài đặt bản cập nhật ngay?`,
    buttons: ['Update', 'Skip'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  })

  if (result.response === 0) {
    // User chose "Update"
    const progressDialog = new BrowserWindow({
      width: 360,
      height: 140,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })
    progressDialog.loadURL(`data:text/html;charset=utf-8,
      <html><body style="
        font-family: 'Segoe UI', sans-serif;
        background: rgba(20,20,30,0.95);
        color: #e0e0e0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.1);
      ">
        <p style="font-size:14px;margin:0 0 12px;">Đang tải bản cập nhật v${latestVersion}...</p>
        <div style="width:80%;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
          <div style="width:100%;height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);animation:loading 1.5s ease-in-out infinite;"></div>
        </div>
        <style>@keyframes loading{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}</style>
      </body></html>`)

    try {
      await downloadAndInstallUpdate(setupAsset.browser_download_url, setupAsset.name)
    } catch (err: any) {
      progressDialog.destroy()
      dialog.showErrorBox('Lỗi cập nhật', `Không thể tải bản cập nhật.\n\n${err.message}`)
    }
  }
}

function setupIPC() {
  ipcMain.handle('transcribe-audio', async (_event, audioBuffer: ArrayBuffer, language: string) => {
    isRecording = false
    unregisterRecordingShortcuts()
    try {
      const config = loadConfig()
      let text: string

      if (config.transcriptionEngine === 'whisper') {
        // Legacy path: should not reach here with new renderer, but kept for safety
        text = 'Error: Whisper engine should use transcribe-whisper-audio channel'
      } else {
        text = await transcribeAudio(audioBuffer, language)
      }

      return { success: true, text }
    } catch (error: any) {
      const msg = error.message || 'Unknown error'
      if (msg === 'NO_API_KEY') {
        dialog.showErrorBox('Voice to Prompt - Thiếu API Key', 'Chưa có API Key!\nVui lòng mở Cài đặt (click icon System Tray) và nhập Gemini API Key, hoặc tạo file .env chứa VITE_GEMINI_API_KEY.')
      } else {
        dialog.showErrorBox('Voice to Prompt - Lỗi xử lý giọng nói', `Không thể chuyển đổi giọng nói thành văn bản.\n\nChi tiết: ${msg}`)
      }
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('transcribe-whisper-audio', async (_event, pcmArray: number[], language: string) => {
    isRecording = false
    unregisterRecordingShortcuts()
    try {
      let pcmFloat32 = new Float32Array(pcmArray)

      // Pad short recordings to 1.25 s of silence (same as Handy / whisper.cpp behaviour).
      // Whisper struggles with very short clips and may produce hallucinated output.
      const WHISPER_SAMPLE_RATE = 16000
      if (pcmFloat32.length < WHISPER_SAMPLE_RATE) {
        const padded = new Float32Array(Math.ceil(WHISPER_SAMPLE_RATE * 1.25))
        padded.set(pcmFloat32)
        pcmFloat32 = padded
      }

      const text = await transcribeWithWhisper(pcmFloat32, language)
      return { success: true, text }
    } catch (error: any) {
      const msg = error.message || 'Unknown error'
      dialog.showErrorBox('Voice to Prompt - Lỗi Whisper', `Không thể chuyển đổi giọng nói thành văn bản.\n\nChi tiết: ${msg}`)
      return { success: false, error: msg }
    }
  })

  ipcMain.on('inject-text', async (_event, text: string) => {
    isRecording = false
    unregisterRecordingShortcuts()
    await injectText(text)
  })

  ipcMain.on('cancel-recording', () => {
    isRecording = false
    unregisterRecordingShortcuts()
    overlayWindow?.hide()
  })

  ipcMain.handle('get-config', () => {
    const config = loadConfig()
    const envKey = loadEnvApiKey()
    // Use config value if exists, otherwise get from system
    // This ensures UI shows the saved preference, not just system state
    const autoStartStatus = config.startWithWindows !== undefined
      ? config.startWithWindows
      : getAutoStartStatus()
    return { ...config, apiKey: envKey || config.apiKey, hasEnvKey: !!envKey, startWithWindows: autoStartStatus, appVersion: app.getVersion() }
  })

  ipcMain.handle('set-start-with-windows', (_event, enabled: boolean) => {
    try {
      setAutoStart(enabled)
      saveConfig({ startWithWindows: enabled })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('check-for-update', async () => {
    try {
      const currentVersion = app.getVersion()
      const response = await fetch('https://api.github.com/repos/quangtruong2003/VoiceToPrompt/releases/latest')
      if (!response.ok) {
        return { updateAvailable: false, error: 'Không thể kiểm tra cập nhật' }
      }
      const data = await response.json()
      const latestVersion = data.tag_name?.replace('v', '') || '0.0.0'

      const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0
      const now = new Date().toISOString()
      saveConfig({ lastUpdateCheck: now, autoUpdate: true })

      if (isUpdateAvailable) {
        showUpdateDialog(currentVersion, latestVersion, data.assets || [])
      }

      return { updateAvailable: isUpdateAvailable, latestVersion }
    } catch (err: any) {
      return { updateAvailable: false, error: err.message }
    }
  })

  ipcMain.on('register-hotkey', (_event, hotkey: string) => {
    try {
      registerNewHotkey(hotkey)
    } catch (err: any) {
      console.error('Failed to register hotkey:', err)
    }
  })

  ipcMain.on('register-history-hotkey', (_event, hotkey: string) => {
    try {
      registerNewHistoryHotkey(hotkey)
    } catch (err: any) {
      console.error('Failed to register history hotkey:', err)
    }
  })

  ipcMain.on('register-settings-hotkey', (_event, hotkey: string) => {
    try {
      registerNewSettingsHotkey(hotkey)
    } catch (err: any) {
      console.error('Failed to register settings hotkey:', err)
    }
  })

  ipcMain.handle('save-config', (_event, config: Partial<AppConfig>) => {
    try {
      saveConfig(config)
      return { success: true }
    } catch (err: any) {
      dialog.showErrorBox('Voice to Prompt - Lỗi lưu cài đặt', `Không thể lưu cấu hình.\n\nChi tiết: ${err.message || 'Lỗi ghi file'}`)
      return { success: false }
    }
  })

  ipcMain.handle('validate-api-key', async (_event, apiKey: string) => {
    const result = await validateApiKey(apiKey)
    // Return result without showing native dialogs - UI handles notifications via toast
    return result
  })

  ipcMain.handle('get-gemini-models', async () => {
    const models = await fetchGeminiModels()
    return { models }
  })

  ipcMain.handle('get-whisper-models', async () => {
    return { models: WHISPER_MODELS }
  })

  ipcMain.handle('download-whisper-model', async (_event, modelId: string) => {
    try {
      await getWhisperPipeline(modelId)
      return { success: true }
    } catch (error: any) {
      console.error('Failed to download whisper model:', error)
      return { success: false, error: error.message || 'Download failed' }
    }
  })

  ipcMain.handle('check-whisper-model-downloaded', async (_event, modelId: string) => {
    try {
      const cacheDir = getWhisperCacheDir()
      const modelPath = path.join(cacheDir, modelId)
      const exists = fs.existsSync(modelPath) && fs.existsSync(path.join(modelPath, 'config.json'))
      return { downloaded: exists }
    } catch {
      return { downloaded: false }
    }
  })

  ipcMain.handle('delete-whisper-model', async (_event, modelId: string) => {
    try {
      const cacheDir = getWhisperCacheDir()
      const modelPath = path.join(cacheDir, modelId)
      if (fs.existsSync(modelPath)) {
        fs.rmSync(modelPath, { recursive: true, force: true })
      }
      return { success: true }
    } catch (error: any) {
      console.error('Failed to delete whisper model:', error)
      return { success: false, error: error.message || 'Delete failed' }
    }
  })

  ipcMain.handle('select-whisper-model-folder', async () => {
    const result = await dialog.showOpenDialog(settingsWindow!, {
      title: 'Chọn thư mục lưu model Whisper',
      defaultPath: getWhisperCacheDir(),
      properties: ['openDirectory', 'createDirectory'],
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]
      const config = loadConfig(true)
      config.whisperModelPath = selectedPath
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
      configCache = null

      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('config-updated', { whisperModelPath: selectedPath })
      }

      return { success: true, path: selectedPath }
    }
    return { success: false }
  })

  ipcMain.on('close-settings', () => {
    settingsWindow?.hide()
  })

  ipcMain.on('close-history', () => {
    historyWindow?.hide()
  })

  ipcMain.handle('set-history-pinned', (_event, pinned: boolean) => {
    setHistoryWindowPinned(pinned)
    return { success: true }
  })

  ipcMain.on('open-external', (_event, url: string) => {
    // Validate URL before opening - only allow http/https and specific allowed hosts
    try {
      const parsedUrl = new URL(url)
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        console.warn('open-external blocked: disallowed protocol:', parsedUrl.protocol)
        return
      }
      // Optional: restrict to known domains. For now, allow all https/http
      // To restrict further, uncomment below:
      // const allowedHosts = ['github.com', 'aistudio.google.com']
      // if (!allowedHosts.includes(parsedUrl.hostname)) {
      //   console.warn('open-external blocked: disallowed host:', parsedUrl.hostname)
      //   return
      // }
      shell.openExternal(url)
    } catch (err) {
      console.error('open-external invalid URL:', err)
    }
  })

  // Performance monitoring IPC handlers
  ipcMain.handle('get-performance-summary', () => {
    return performanceMonitor.getPerformanceSummary()
  })

  ipcMain.handle('get-optimization-status', () => {
    return performanceMonitor.getOptimizationStatus()
  })

  ipcMain.handle('get-latency-metrics', () => {
    return performanceMonitor.getLatencyMetrics()
  })

  ipcMain.handle('get-api-calls', (_event, limit: number) => {
    return performanceMonitor.getApiCalls(limit)
  })

  ipcMain.handle('get-execution-trace', (_event, callId: string) => {
    return performanceMonitor.getExecutionTrace(callId)
  })

  ipcMain.handle('reset-performance-metrics', () => {
    performanceMonitor.reset()
    return { success: true }
  })

  ipcMain.handle('set-optimization-features', (_event, features: {
    connectionPool?: boolean;
    compression?: boolean;
    caching?: boolean;
    asyncProcessing?: boolean;
  }) => {
    performanceMonitor.setOptimizationFeatures(features)
    return { success: true }
  })
}

app.whenReady().then(() => {
  // Set app user model id for Windows taskbar grouping
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.voicetotext.app')
  }

  // Apply auto-start setting on startup
  const config = loadConfig()
  const systemAutoStart = getAutoStartStatus()

  // Sync config with system state if not set yet
  if (config.startWithWindows === undefined) {
    saveConfig({ startWithWindows: systemAutoStart })
  } else if (config.startWithWindows !== systemAutoStart) {
    // Config differs from system - update system to match config
    setAutoStart(config.startWithWindows)
  }

  // Auto check for updates on startup (if enabled)
  if (config.autoUpdate !== false) {
    setTimeout(async () => {
      try {
        const response = await fetch('https://api.github.com/repos/quangtruong2003/VoiceToPrompt/releases/latest')
        if (response.ok) {
          const data = await response.json()
          const latestVersion = data.tag_name?.replace('v', '') || '0.0.0'
          const currentVersion = app.getVersion()
          const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0
          if (isUpdateAvailable) {
            console.log(`[Auto-update] New version available: ${latestVersion} (current: ${currentVersion})`)
            showUpdateDialog(currentVersion, latestVersion, data.assets || [])
          }
          saveConfig({ lastUpdateCheck: new Date().toISOString() })
        }
      } catch (err) {
        console.warn('[Auto-update] Failed to check for updates:', err)
      }
    }, 5000)
  }

  setupPermissions()
  createOverlayWindow()
  createTray()
  registerGlobalShortcut()
  registerHistoryShortcut()
  registerSettingsShortcut()
  setupIPC()
})

// Handle before quit - clean up
app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  // Clean up tray
  if (tray) {
    tray.destroy()
    tray = null
  }
})

// On window all closed - don't quit, keep running in tray
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // App continues running in system tray
  }
})

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createOverlayWindow()
  } else {
    showOverlayWindow()
  }
})
