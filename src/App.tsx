import { OverlayView } from './components/OverlayView'
import { SettingsView } from './components/SettingsView'
import './styles/index.css'

function App() {
    const hash = window.location.hash.replace('#', '')

    if (hash === 'settings') {
        return <SettingsView />
    }

    return <OverlayView />
}

export default App
