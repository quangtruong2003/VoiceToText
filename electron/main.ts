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

interface AppConfig {
  apiKey: string
  language: string
  customPrompt: string
  apiType: 'google' | 'antigravity' | 'custom'
  customEndpoint: string
  startWithWindows: boolean
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

function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
      return { apiKey: '', language: 'vi', customPrompt: '', apiType: 'google', customEndpoint: '', startWithWindows: false, ...config }
    }
  } catch {}
  return { apiKey: '', language: 'vi', customPrompt: '', apiType: 'google', customEndpoint: '', startWithWindows: false }
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

function saveConfig(config: Partial<AppConfig>) {
  const existing = loadConfig()
  const merged = { ...existing, ...config }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2))

  // Handle auto-start setting changes
  if (config.startWithWindows !== undefined) {
    setAutoStart(config.startWithWindows)
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
  session.defaultSession.setPermissionCheckHandler(() => true)
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
    overlayWindow.setOverlayIcon(createTrayIcon(), 'Voice to Text')
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
    width: 480,
    height: 600,
    x: Math.round((screenWidth - 480) / 2),
    y: Math.round((screenHeight - 600) / 2),
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

function createTray() {
  const trayIcon = createTrayIcon()
  tray = new Tray(trayIcon)
  
  // Set tooltip - shown when hovering over tray icon
  tray.setToolTip('Voice to Text - Click to open')

  // Build context menu with standard options
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Hiện cửa sổ',
      click: () => showOverlayWindow(),
    },
    {
      label: 'Cài đặt',
      click: () => createSettingsWindow(),
    },
    {
      label: isRecording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm',
      click: () => toggleRecording(),
    },
    { type: 'separator' },
    {
      label: 'Thoát',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

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
      title: 'Voice to Text',
      content: 'Ứng dụng đã được thu nhỏ vào system tray. Nhấp vào icon để hiện lại.',
      iconType: 'info',
    })
  }
}

function registerEnterShortcut() {
  try {
    const handleEnter = () => {
      if (isRecording) {
        overlayWindow?.webContents.send('force-stop-recording')
      }
    }
    globalShortcut.register('Enter', handleEnter)
    globalShortcut.register('Return', handleEnter)
  } catch (e) {
    console.warn('Failed to register enter shortcut', e)
  }
}

function unregisterEnterShortcut() {
  try { globalShortcut.unregister('Enter') } catch {}
  try { globalShortcut.unregister('Return') } catch {}
}

function toggleRecording() {
  isRecording = !isRecording

  if (isRecording) {
    registerEnterShortcut()
    // Show window without stealing focus from the user's current text editor/app
    overlayWindow?.showInactive()
    overlayWindow?.webContents.send('toggle-recording', true)
  } else {
    unregisterEnterShortcut()
    overlayWindow?.webContents.send('toggle-recording', false)
    overlayWindow?.hide()
  }
}

async function fetchGemini(apiKey: string, payload: any): Promise<Response> {
  const models = ['gemini-3-flash-preview']
  const baseUrl = getApiEndpoint()
  const config = loadConfig()
  let lastResponse: Response | null = null

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

  for (const model of models) {
    try {
      const resp = await fetch(`${baseUrl}/${apiVersion}/models/${model}:generateContent`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      })
      if (resp.ok) return resp
      lastResponse = resp
      console.warn(`Gemini model ${model} failed with status ${resp.status}, trying next...`)
    } catch (err) {
      console.error(`Network error with model ${model}:`, err)
    }
  }
  return lastResponse!
}

async function transcribeAudio(audioBuffer: ArrayBuffer, language: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('NO_API_KEY')

  const config = loadConfig()
  const base64Audio = Buffer.from(audioBuffer).toString('base64')

  // Always use prompt from settings
  const promptText = config.customPrompt?.trim() || ''

  const payload = {
    contents: [{
      parts: [
        { text: promptText },
        { inlineData: { mimeType: 'audio/webm', data: base64Audio } }
      ]
    }]
  }

  const response = await fetchGemini(apiKey, payload)

  if (!response || !response.ok) {
    const errorData = response ? await response.json() : { error: { message: 'Network error or all models failed' } }
    console.error('Gemini API error:', JSON.stringify(errorData, null, 2))
    throw new Error(errorData.error?.message || `API_ERROR: HTTP ${response?.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
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

function registerGlobalShortcut() {
  globalShortcut.register('Super+Alt+H', () => toggleRecording())
}

function setupIPC() {
  ipcMain.handle('transcribe-audio', async (_event, audioBuffer: ArrayBuffer, language: string) => {
    isRecording = false
    unregisterEnterShortcut()
    try {
      const text = await transcribeAudio(audioBuffer, language)
      return { success: true, text }
    } catch (error: any) {
      const msg = error.message || 'Unknown error'
      if (msg === 'NO_API_KEY') {
        dialog.showErrorBox('Voice to Text - Thiếu API Key', 'Chưa có API Key!\nVui lòng mở Cài đặt (click icon System Tray) và nhập Gemini API Key, hoặc tạo file .env chứa VITE_GEMINI_API_KEY.')
      } else {
        dialog.showErrorBox('Voice to Text - Lỗi xử lý giọng nói', `Không thể chuyển đổi giọng nói thành văn bản.\n\nChi tiết: ${msg}`)
      }
      return { success: false, error: msg }
    }
  })

  ipcMain.on('inject-text', async (_event, text: string) => {
    isRecording = false
    unregisterEnterShortcut()
    await injectText(text)
  })

  ipcMain.on('cancel-recording', () => {
    isRecording = false
    unregisterEnterShortcut()
    overlayWindow?.hide()
  })

  ipcMain.handle('get-config', () => {
    const config = loadConfig()
    const envKey = loadEnvApiKey()
    // Get actual auto-start status from system
    const autoStartStatus = getAutoStartStatus()
    return { ...config, apiKey: envKey || config.apiKey, hasEnvKey: !!envKey, startWithWindows: autoStartStatus }
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

  ipcMain.handle('save-config', (_event, config: Partial<AppConfig>) => {
    try {
      saveConfig(config)
      return { success: true }
    } catch (err: any) {
      dialog.showErrorBox('Voice to Text - Lỗi lưu cài đặt', `Không thể lưu cấu hình.\n\nChi tiết: ${err.message || 'Lỗi ghi file'}`)
      return { success: false }
    }
  })

  ipcMain.handle('validate-api-key', async (_event, apiKey: string) => {
    const result = await validateApiKey(apiKey)
    // Return result without showing native dialogs - UI handles notifications via toast
    return result
  })

  ipcMain.on('close-settings', () => {
    settingsWindow?.hide()
  })

  ipcMain.on('open-external', (_event, url: string) => {
    shell.openExternal(url)
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
  if (config.startWithWindows !== undefined) {
    setAutoStart(config.startWithWindows)
  }

  setupPermissions()
  createOverlayWindow()
  createTray()
  registerGlobalShortcut()
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
