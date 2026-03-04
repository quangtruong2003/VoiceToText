import { OverlayView } from './components/OverlayView'
import { SettingsView } from './components/SettingsView'
import { HistoryView } from './components/HistoryView'
import { I18nProvider } from './i18n'
import './styles/index.css'

function App() {
    const hash = window.location.hash.replace('#', '')

    return (
        <I18nProvider>
            {hash === 'settings' ? (
                <SettingsView />
            ) : hash === 'history' ? (
                <HistoryView />
            ) : (
                <OverlayView />
            )}
        </I18nProvider>
    )
}

export default App
