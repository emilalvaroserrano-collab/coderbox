import { useStore } from '@/store'
import {
  Edit3, Clock, Layers, Folder, Settings, Share2, Copy, Mic, LogOut, Brain,
} from 'lucide-react'

export default function Sidebar() {
  const {
    isSidebarOpen, activeView, setActiveView, setActiveThread,
    threads, activeThreadId, toggleOrb, isOrbVisible,
  } = useStore()

  const navItems = [
    { view: 'new-thread' as const, icon: Edit3, label: 'New thread', matches: ['new-thread', 'chat'] },
    { view: 'automations' as const, icon: Clock, label: 'Automations' },
    { view: 'skills' as const, icon: Layers, label: 'Skills & Capabilities' },
    { view: 'memory' as const, icon: Brain, label: 'Memory & Profile' },
  ]

  return (
      <aside className={`fixed left-0 top-0 h-screen w-[260px] bg-codebox-sidebar border-r border-codebox-border flex flex-col z-10 transition-transform duration-250 ${!isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}`}>
      <div className="p-4 flex flex-col gap-4">
        {/* Window controls */}
        <div className="flex gap-2 items-center pb-1">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
        </div>

        {/* Navigation */}
        <ul className="flex flex-col gap-0.5">
          {navItems.map(({ view, icon: Icon, label, matches }) => {
            const isActive = matches ? matches.includes(activeView) : activeView === view
            return (
              <li
                key={view}
                className={`nav-item-base ${isActive ? 'nav-item-active' : ''}`}
                onClick={() => {
                  if (view === 'new-thread') setActiveThread(null)
                  setActiveView(view)
                }}
              >
                <Icon size={16} /> <span>{label}</span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Threads section */}
      <div className="flex-1 overflow-y-auto px-4 py-2.5 flex flex-col gap-2.5">
        <span className="text-[11px] font-medium text-codebox-muted uppercase tracking-wider pl-1.5 mb-1">
          Threads
        </span>
        <div className="flex items-center gap-2 px-1.5 py-1.5 text-codebox-primary font-medium rounded-md text-[13px]">
          <Folder size={15} className="text-codebox-secondary" />
          <span>CodeBox Workspace</span>
        </div>
        <div className="flex flex-col gap-0.5 pl-2">
          {threads.length === 0 ? (
            <div className="px-2.5 py-4 text-center text-codebox-muted text-xs border border-dashed border-codebox-border rounded-lg mt-1 leading-relaxed">
              No active threads yet.<br />Start typing below to begin.
            </div>
          ) : (
            threads.map((t) => (
              <div
                key={t.id}
                className={`thread-item-base ${t.id === activeThreadId ? 'thread-item-active' : ''}`}
                onClick={() => { setActiveThread(t.id); setActiveView('chat') }}
              >
                {t.id === activeThreadId && (
                  <span className="w-1.5 h-1.5 rounded-full bg-codebox-blue flex-shrink-0" />
                )}
                <span>{t.title}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom footer toolbar with 5 icons matching reference */}
      <div className="p-3 border-t border-codebox-border flex items-center justify-between bg-codebox-sidebar">
        <button
          className={`bg-transparent border-none text-codebox-secondary cursor-pointer p-[6px] rounded-md flex items-center justify-center hover:bg-white/5 hover:text-codebox-primary transition-all`}
          title="Settings"
          onClick={() => setActiveView('settings')}
        >
          <Settings size={17} />
        </button>

        <button
          className="bg-transparent border-none text-codebox-secondary cursor-pointer p-[6px] rounded-md flex items-center justify-center hover:bg-white/5 hover:text-codebox-primary transition-all"
          title="Share Workspace"
          onClick={() => navigator.clipboard?.writeText('https://codebox.eburon.ai/share/' + (threads[0]?.id || ''))}
        >
          <Share2 size={17} />
        </button>

        <button
          className="bg-transparent border-none text-codebox-secondary cursor-pointer p-[6px] rounded-md flex items-center justify-center hover:bg-white/5 hover:text-codebox-primary transition-all"
          title="Copy to clipboard"
          onClick={() => navigator.clipboard?.writeText('~/Projects/codebox')}
        >
          <Copy size={17} />
        </button>

        <button
          className={`bg-transparent border-none cursor-pointer p-[6px] rounded-md flex items-center justify-center transition-all ${isOrbVisible ? 'text-codebox-purple bg-codebox-purple/15 shadow-[0_0_10px_rgba(139,92,246,0.3)]' : ''}`}
          title="Voice Agent Orb (Draggable)"
          onClick={toggleOrb}
        >
          <Mic size={17} />
        </button>

        <button
          className="bg-transparent border-none text-codebox-secondary cursor-pointer p-[6px] rounded-md flex items-center justify-center hover:text-codebox-red hover:bg-red-500/10 transition-all"
          title="Log out"
        >
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  )
}
