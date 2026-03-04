import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import vi from './locales/vi.json'
import en from './locales/en.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import zh from './locales/zh.json'

export type AppLanguage = 'vi' | 'en' | 'ja' | 'ko' | 'zh'

type Dict = Record<string, any>

const DICTS: Record<AppLanguage, Dict> = { vi, en, ja, ko, zh }

const LOCALE_BY_LANG: Record<AppLanguage, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
}

function getByPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str
  return str.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

function translate(dict: Dict, key: string, vars?: Record<string, string | number>): string {
  const val = getByPath(dict, key)
  if (typeof val === 'string') return interpolate(val, vars)
  return key
}

interface I18nContextValue {
  language: AppLanguage
  locale: string
  setLanguage: (lang: AppLanguage) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  dict: Dict
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('vi')

  const applyLanguage = useCallback((lang: string) => {
    const next = (['vi', 'en', 'ja', 'ko', 'zh'] as const).includes(lang as any) ? (lang as AppLanguage) : 'vi'
    setLanguageState(next)
  }, [])

  useEffect(() => {
    // Initial load from config
    if (!window.electronAPI?.getConfig) return
    window.electronAPI.getConfig().then((config) => {
      if (config?.language) applyLanguage(config.language)
    }).catch(() => {})
  }, [applyLanguage])

  useEffect(() => {
    // Live updates from main process
    if (!window.electronAPI?.onConfigUpdated) return
    return window.electronAPI.onConfigUpdated((partial) => {
      if (partial?.language) applyLanguage(partial.language)
    })
  }, [applyLanguage])

  const ctx = useMemo<I18nContextValue>(() => {
    const dict = DICTS[language] || DICTS.vi
    return {
      language,
      locale: LOCALE_BY_LANG[language] || 'vi-VN',
      setLanguage: setLanguageState,
      dict,
      t: (key, vars) => translate(dict, key, vars),
    }
  }, [language])

  return <I18nContext.Provider value={ctx}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

