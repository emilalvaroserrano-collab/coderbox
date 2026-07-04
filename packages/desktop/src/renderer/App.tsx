import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { initFirebase } from '@/lib/auth/firebase'
import AuthPage from '@/components/auth/AuthPage'
import Sidebar from '@/components/sidebar/Sidebar'
import TopBar from '@/components/TopBar'
import ThreadCanvas from '@/components/thread/ThreadCanvas'
import Composer from '@/components/composer/Composer'
import SkillsView from '@/components/skills/SkillsView'
import SettingsView from '@/components/settings/SettingsView'
import AutomationsView from '@/components/automations/AutomationsView'
import MemoryView from '@/components/settings/MemoryView'
import DiffPane from '@/components/panel/DiffPane'
import TerminalPane from '@/components/tools/TerminalPane'
import BrowserPane from '@/components/tools/BrowserPane'
import VoiceOrb from '@/components/tools/VoiceOrb'
import Toast from '@/components/Toast'

export default function App() {
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(import.meta.env.VITE_SKIP_AUTH === 'true')
  const { theme, activeView, isSidebarOpen } = useStore()
  useKeyboardShortcuts()

  useEffect(() => {
    initFirebase().then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-codebox-bg">
        <div className="animate-spin w-8 h-8 border-2 border-codebox-blue border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!authenticated) {
    return <AuthPage onAuthenticated={() => setAuthenticated(true)} />
  }

  const isLight = theme === 'light'
  const showComposer = !['settings', 'skills', 'automations', 'memory'].includes(activeView)

  return (
    <div className="flex h-screen overflow-hidden" {...(isLight ? { 'data-theme': 'light' } : {})}>
      <Sidebar />
      <main className={`flex-1 flex flex-col relative bg-codebox-bg h-screen transition-[margin-left] duration-250 ${isSidebarOpen ? 'ml-[260px]' : 'ml-0'}`}>
        <TopBar />
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-y-auto px-5 pb-[180px] pt-5">
          <ContentView />
        </div>
        {showComposer && <Composer />}
        <TerminalPane />
      </main>
      <DiffPane />
      <BrowserPane />
      <VoiceOrb />
      <Toast />
    </div>
  )
}

function ContentView() {
  const { activeView } = useStore()
  switch (activeView) {
    case 'new-thread': case 'chat': return <ThreadCanvas />
    case 'skills': return <SkillsView />
    case 'settings': return <SettingsView />
    case 'automations': return <AutomationsView />
    case 'memory': return <MemoryView />
    default: return <ThreadCanvas />
  }
}
