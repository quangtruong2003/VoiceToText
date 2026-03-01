export {}

interface AppConfig {
  apiKey: string
  language: string
  customPrompt: string
  apiType: 'google' | 'antigravity' | 'custom'
  customEndpoint: string
  hasEnvKey?: boolean
}

interface ElectronAPI {
  onToggleRecording: (callback: (isRecording: boolean) => void) => () => void
  onForceStopRecording: (callback: () => void) => () => void
  transcribeAudio: (audioBuffer: ArrayBuffer, language: string) => Promise<{ success: boolean; text?: string; error?: string }>
  injectText: (text: string) => void
  cancelRecording: () => void
  onInjectionComplete: (callback: (result: { success: boolean }) => void) => () => void
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: Partial<AppConfig>) => Promise<{ success: boolean }>
  validateApiKey: (apiKey: string) => Promise<{valid: boolean, error?: string}>
  closeSettings: () => void
  openExternal: (url: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
