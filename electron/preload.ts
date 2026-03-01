import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onToggleRecording: (callback: (isRecording: boolean) => void) => {
    const listener = (_event: any, isRecording: boolean) => callback(isRecording)
    ipcRenderer.on('toggle-recording', listener)
    return () => ipcRenderer.removeListener('toggle-recording', listener)
  },

  onForceStopRecording: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('force-stop-recording', listener)
    return () => ipcRenderer.removeListener('force-stop-recording', listener)
  },

  transcribeAudio: (audioBuffer: ArrayBuffer, language: string) => {
    return ipcRenderer.invoke('transcribe-audio', audioBuffer, language)
  },

  injectText: (text: string) => {
    ipcRenderer.send('inject-text', text)
  },

  cancelRecording: () => {
    ipcRenderer.send('cancel-recording')
  },

  onInjectionComplete: (callback: (result: { success: boolean }) => void) => {
    const listener = (_event: any, result: any) => callback(result)
    ipcRenderer.on('injection-complete', listener)
    return () => ipcRenderer.removeListener('injection-complete', listener)
  },

  getConfig: () => {
    return ipcRenderer.invoke('get-config')
  },

  setStartWithWindows: (enabled: boolean) => {
    return ipcRenderer.invoke('set-start-with-windows', enabled)
  },

  registerHotkey: (hotkey: string) => {
    ipcRenderer.send('register-hotkey', hotkey)
  },

  saveConfig: (config: Record<string, any>) => {
    return ipcRenderer.invoke('save-config', config)
  },

  validateApiKey: (apiKey: string) => {
    return ipcRenderer.invoke('validate-api-key', apiKey)
  },

  closeSettings: () => {
    ipcRenderer.send('close-settings')
  },

  // Performance monitoring APIs
  getPerformanceSummary: () => {
    return ipcRenderer.invoke('get-performance-summary')
  },

  getOptimizationStatus: () => {
    return ipcRenderer.invoke('get-optimization-status')
  },

  getLatencyMetrics: () => {
    return ipcRenderer.invoke('get-latency-metrics')
  },

  getApiCalls: (limit: number = 50) => {
    return ipcRenderer.invoke('get-api-calls', limit)
  },

  getExecutionTrace: (callId: string) => {
    return ipcRenderer.invoke('get-execution-trace', callId)
  },

  resetPerformanceMetrics: () => {
    return ipcRenderer.invoke('reset-performance-metrics')
  },

  setOptimizationFeatures: (features: {
    connectionPool?: boolean;
    compression?: boolean;
    caching?: boolean;
    asyncProcessing?: boolean;
  }) => {
    return ipcRenderer.invoke('set-optimization-features', features)
  }
})
