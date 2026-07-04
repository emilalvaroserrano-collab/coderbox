import { useState, useEffect } from 'react'
import { Settings, Cloud, GitBranch, Palette } from 'lucide-react'
import { useStore } from '@/store'
import { EBURON_DISPLAY_NAMES } from '@/lib/providers/types'

type SettingsTab = 'general' | 'models' | 'worktrees' | 'appearance'

export default function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>('general')
  const { activeModel, setActiveModel, availableProviders, refreshProviders } = useStore()

  useEffect(() => {
    refreshProviders()
  }, [])

  const tabs = [
    { id: 'general' as const, icon: Settings, label: 'General' },
    { id: 'models' as const, icon: Cloud, label: 'Eburon Engines' },
    { id: 'worktrees' as const, icon: GitBranch, label: 'Worktrees & Git' },
    { id: 'appearance' as const, icon: Palette, label: 'Appearance' },
  ]

  return (
    <div className="w-full max-w-[860px] flex flex-col gap-5 px-5 py-8 pb-24 mx-auto">
      <div className="flex justify-between items-center border-b border-codebox-border pb-4">
        <h2 className="text-xl font-semibold text-codebox-primary">Preferences</h2>
      </div>

      <div className="flex gap-6 min-h-[480px]">
        <nav className="w-[180px] flex flex-col gap-1 border-r border-codebox-border pr-4">
          {tabs.map(({ id, icon: Icon, label }) => (
            <div
              key={id}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-[13px] transition-colors ${
                tab === id ? 'bg-white/5 text-codebox-primary font-medium' : 'text-codebox-secondary hover:bg-white/5 hover:text-codebox-primary'
              }`}
              onClick={() => setTab(id)}
            >
              <Icon size={15} /> {label}
            </div>
          ))}
        </nav>

        <div className="flex-1 flex flex-col gap-5">
          {tab === 'general' && (
            <>
              <div className="bg-codebox-card border border-codebox-border rounded-xl p-4 flex flex-col gap-3.5">
                <div className="text-sm font-medium text-codebox-primary">Workspace Configuration</div>

                <SettingRow label="Default Project Directory" hint="Base root path for Eburon code indexing">
                  <input
                    className="bg-codebox-input border border-codebox-border text-codebox-primary px-2.5 py-[7px] rounded-md outline-none text-xs w-[180px] font-mono transition-colors focus:border-codebox-secondary"
                    defaultValue="~/Projects/code-box"
                    readOnly
                  />
                </SettingRow>

                <SettingRow label="Auto-Save Conversations" hint="Persist thread history in SQLite database">
                  <ToggleSwitch defaultChecked />
                </SettingRow>

                <SettingRow label="Collect Anonymous Telemetry" hint="Help improve Eburon CodeBox">
                  <ToggleSwitch defaultChecked />
                </SettingRow>

                <SettingRow label="Prevent Sleep While Running" hint="Keep computer awake during active threads">
                  <ToggleSwitch />
                </SettingRow>
              </div>

              <div className="bg-codebox-card border border-codebox-border rounded-xl p-4 flex flex-col gap-3.5">
                <div className="text-sm font-medium text-codebox-primary">AI Engine & Voice</div>

                <SettingRow label="Voice Orb WebSocket URL" hint="Endpoint for real-time streaming voice agent">
                  <input
                    className="bg-codebox-input border border-codebox-border text-codebox-primary px-2.5 py-[7px] rounded-md outline-none text-xs w-[240px] font-mono transition-colors focus:border-codebox-secondary"
                    defaultValue="wss://voice.eburon.ai/v1/stream"
                  />
                </SettingRow>

                <SettingRow label="Max Token Context Window" hint="Allocated memory buffer per thread">
                  <input
                    className="bg-codebox-input border border-codebox-border text-codebox-primary px-2.5 py-[7px] rounded-md outline-none text-xs w-[100px] font-mono transition-colors focus:border-codebox-secondary"
                    defaultValue="128000"
                  />
                </SettingRow>

                <SettingRow label="Default Reasoning Effort" hint="medium = balanced, high = thorough but slower">
                  <select className="bg-codebox-input border border-codebox-border text-codebox-primary px-2.5 py-[7px] rounded-md outline-none text-xs w-[140px] transition-colors focus:border-codebox-secondary">
                    <option>low</option>
                    <option selected>medium</option>
                    <option>high</option>
                  </select>
                </SettingRow>
              </div>
            </>
          )}

          {tab === 'models' && (
            <>
              <div className="bg-codebox-card border border-codebox-border rounded-xl p-4 flex flex-col gap-3.5">
                <div className="text-sm font-medium text-codebox-primary">Eburon Engine Selection</div>
                <p className="text-xs text-codebox-secondary">
                  Eburon engines transparently select the best available provider for your task.
                  Choose &quot;Auto&quot; to let Eburon pick the best engine automatically.
                </p>

                <div className="flex flex-col gap-1.5 mt-2">
                  {availableProviders.length > 0 ? (
                    availableProviders.map((provider) => {
                      const isActive = activeModel === provider.alias
                      return (
                        <div
                          key={provider.alias}
                          className={`flex items-center justify-between px-3.5 py-3 rounded-lg cursor-pointer border transition-all ${
                            isActive
                              ? 'border-codebox-purple bg-codebox-purple/5'
                              : 'border-codebox-border hover:border-codebox-secondary'
                          }`}
                          onClick={() => setActiveModel(provider.alias)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-sm ${isActive ? 'text-codebox-primary font-medium' : 'text-codebox-primary'}`}>
                              {provider.displayName}
                            </span>
                            <span className="text-[11px] text-codebox-secondary">
                              Context: {provider.contextLimit.toLocaleString()} tokens
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${provider.available ? 'bg-codebox-green' : 'bg-codebox-red'}`} />
                            <span className={`text-[11px] ${provider.available ? 'text-codebox-green' : 'text-codebox-red'}`}>
                              {provider.available ? 'Available' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-xs text-codebox-secondary py-4 text-center">
                      Loading engine status...
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-codebox-border">
                  <button
                    className="text-xs text-codebox-blue hover:text-codebox-purple transition-colors cursor-pointer bg-transparent border-none"
                    onClick={() => refreshProviders()}
                  >
                    Refresh engine status
                  </button>
                </div>
              </div>

              <div className="bg-codebox-card border border-codebox-border rounded-xl p-4 flex flex-col gap-3.5">
                <div className="text-sm font-medium text-codebox-primary">Engine Priority</div>
                <p className="text-xs text-codebox-secondary">
                  Configure the order in which engines are tried. Set via environment variable:
                </p>

                <div className="bg-codebox-input border border-codebox-border rounded-md p-3">
                  <code className="text-xs text-codebox-primary font-mono">
                    PROVIDER_PRIORITY=eburon-sirius,eburon-vega,eburon-orion,eburon-polaris
                  </code>
                </div>
                <p className="text-[11px] text-codebox-muted">
                  In auto mode, engines are tried in priority order. Each engine uses a different provider behind the scenes.
                </p>
              </div>
            </>
          )}

          {tab === 'worktrees' && (
            <>
              <div className="bg-codebox-card border border-codebox-border rounded-xl p-4 flex flex-col gap-3.5">
                <div className="text-sm font-medium text-codebox-primary">Worktree Configuration</div>

                <SettingRow label="Git Root Path" hint="Path to your Git repository root">
                  <input
                    className="bg-codebox-input border border-codebox-border text-codebox-primary px-2.5 py-[7px] rounded-md outline-none text-xs w-[180px] font-mono transition-colors focus:border-codebox-secondary"
                    defaultValue="~/Projects/codebox/.git"
                  />
                </SettingRow>

                <div className="bg-codebox-bg border border-codebox-border p-4 space-y-3">
                  <h4 className="font-medium text-sm text-codebox-primary">Active Worktrees</h4>
                  <p className="text-xs text-codebox-secondary">No active worktrees. Use Git CLI or the terminal pane to create new ones.</p>

                  <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-codebox-border">
                    {['Auto-create on git branch checkout', 'Use system git for commands', 'Ignore worktree changes during streaming'].map((label) => (
                      <SettingRow key={label} label={label}>
                        <ToggleSwitch />
                      </SettingRow>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[12px] mt-1">
                  <span className="w-2 h-2 rounded-full bg-codebox-green" />
                  <span className="text-codebox-primary">Git detected</span>
                  <span className="text-codebox-secondary ml-auto">v2.39.x (Homebrew)</span>
                </div>
              </div>
            </>
          )}

          {tab === 'appearance' && (
            <>
              <div className="bg-codebox-card border border-codebox-border rounded-xl p-4 flex flex-col gap-3.5">
                <SettingRow label="Theme" hint="Choose between dark or light color scheme">
                  <span className="text-[12.5px] text-codebox-secondary flex items-center gap-1.5">
                    Dark / Light
                  </span>
                </SettingRow>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm text-codebox-primary">{label}</div>
        {hint && <p className="text-[12px] text-codebox-secondary mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function ToggleSwitch({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <label className="relative inline-flex w-[36px] h-[20px] flex-shrink-0 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={() => setChecked(!checked)} className="sr-only peer" />
      <span className={`absolute top-0 left-0 right-0 bottom-0 rounded-full transition-all ${checked ? 'bg-codebox-green' : 'bg-codebox-input border border-codebox-border'} peer-focus:ring-2 peer-focus:ring-codebox-blue/30`} />
      <span className={`absolute w-[16px] h-[16px] bg-white rounded-full shadow-sm top-1 transition-all ${checked ? 'left-[18px]' : 'left-1'}`} />
    </label>
  )
}
