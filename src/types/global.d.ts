export {}

interface AppConfig {
  apiKey: string
  language: string
  customPrompt: string
  apiType: 'google' | 'antigravity' | 'custom'
  customEndpoint: string
  startWithWindows: boolean
  hotkey: string
  hasEnvKey?: boolean
  autoUpdate?: boolean
  lastUpdateCheck?: string
  appVersion?: string
  // Punctuation & Formatting Settings
  punctuationSettings?: {
    autoCapitalize: boolean
    addPeriodAtEnd: boolean
    removeFillerWords: boolean
    numberFormatting: 'none' | 'digits' | 'words'
  }

  audioDeviceId?: string
}

// Performance monitoring types
interface OptimizationStatus {
  connectionPool: {
    enabled: boolean
    activeConnections: number
    idleConnections: number
    totalRequests: number
    reusedConnections: number
    reuseRatio: number
  }
  compression: {
    enabled: boolean
    algorithm: string
    originalSize: number
    compressedSize: number
    compressionRatio: number
  }
  caching: {
    enabled: boolean
    cacheHits: number
    cacheMisses: number
    hitRatio: number
    cachedResponses: number
  }
  asyncProcessing: {
    enabled: boolean
    parallelStreams: number
    nonBlockingIO: boolean
    workerThreads: number
  }
}

interface LatencyMetrics {
  totalLatencyMs: number
  connectionLatencyMs: number
  dnsLookupMs: number
  tlsHandshakeMs: number
  requestLatencyMs: number
  responseLatencyMs: number
  processingLatencyMs: number
  baselineLatencyMs: number
  savingsMs: number
  savingsPercent: number
}

interface PerformanceSummary {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageLatencyMs: number
  averageSavingsMs: number
  averageSavingsPercent: number
  optimizationEffectiveness: {
    connectionPool: number
    compression: number
    caching: number
    asyncProcessing: number
  }
  uptime: number
}

interface ApiCall {
  id: string
  timestamp: number
  endpoint: string
  method: string
  status: number
  beforeOptimization: {
    connectionMs: number
    compressionMs: number
    processingMs: number
    totalMs: number
  }
  afterOptimization: {
    connectionMs: number
    compressionMs: number
    processingMs: number
    totalMs: number
  }
  optimizations: {
    connectionPool: boolean
    compression: boolean
    caching: boolean
    asyncProcessing: boolean
  }
}

interface ExecutionTrace {
  id: string
  timestamp: number
  optimizations: string[]
  steps: Array<{
    name: string
    startMs: number
    endMs: number
    durationMs: number
    optimizationApplied: boolean
    optimizationType?: string
  }>
  totalLatencyMs: number
}

interface ElectronAPI {
  onToggleRecording: (callback: (isRecording: boolean) => void) => () => void
  onForceStopRecording: (callback: () => void) => () => void
  onForceCancelRecording: (callback: () => void) => () => void
  transcribeAudio: (audioBuffer: ArrayBuffer, language: string) => Promise<{ success: boolean; text?: string; error?: string }>
  injectText: (text: string) => void
  cancelRecording: () => void
  onInjectionComplete: (callback: (result: { success: boolean }) => void) => () => void
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: Partial<AppConfig>) => Promise<{ success: boolean }>
  setStartWithWindows: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
  checkForUpdate: () => Promise<{ updateAvailable: boolean; latestVersion?: string; error?: string }>
  registerHotkey: (hotkey: string) => void
  validateApiKey: (apiKey: string) => Promise<{valid: boolean, error?: string}>
  closeSettings: () => void
  openExternal: (url: string) => void
  // Performance monitoring APIs
  getPerformanceSummary: () => Promise<PerformanceSummary>
  getOptimizationStatus: () => Promise<OptimizationStatus>
  getLatencyMetrics: () => Promise<LatencyMetrics>
  getApiCalls: (limit?: number) => Promise<ApiCall[]>
  getExecutionTrace: (callId: string) => Promise<ExecutionTrace | null>
  resetPerformanceMetrics: () => Promise<{ success: boolean }>
  setOptimizationFeatures: (features: {
    connectionPool?: boolean
    compression?: boolean
    caching?: boolean
    asyncProcessing?: boolean
  }) => Promise<{ success: boolean }>
  // History APIs
  setHistoryPinned: (pinned: boolean) => Promise<void>
  closeHistory: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
