import { create } from 'zustand'
import { getSkillManager } from '@/lib/skills'
import { getMemoryStore } from '@/lib/memory'
import { executePrompt, streamPrompt, getAvailableProviders, getOnlineProviders } from '@/lib/providers/client'
import { ProviderInfo, EBURON_ALIASES, EBURON_DISPLAY_NAMES } from '@/lib/providers/types'
import { ALL_SKILLS } from '@/components/skills/skills-data'

export interface Thread {
  id: string
  title: string
  mode: 'local' | 'worktree' | 'cloud'
  branch?: string
  projectId: string
  sessionId?: string
  createdAt: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  code?: string
  reasoning?: string
  toolCalls?: { name: string; args: string; result?: string }[]
  timestamp: number
}

export interface SkillDef {
  id: string
  name: string
  description: string
  type: 'system' | 'custom'
  enabled: boolean
  icon: string
  source: 'opencode' | 'claude' | 'codex' | 'hermes'
  tags?: string[]
}

export interface ModelDef {
  id: string
  name: string
  provider: string
  isDefault?: boolean
}

interface AppState {
  activeView: 'new-thread' | 'chat' | 'automations' | 'skills' | 'settings' | 'memory'
  activeThreadId: string | null
  threads: Thread[]
  messages: Record<string, Message[]>
  skills: SkillDef[]
  models: ModelDef[]
  activeModel: string
  activeMode: 'local' | 'worktree' | 'cloud'
  isSidebarOpen: boolean
  isOrbVisible: boolean
  isOrbConnected: boolean
  theme: 'dark' | 'light'
  isStreaming: boolean
  isTerminalOpen: boolean
  isDiffOpen: boolean
  diffContent: string | null
  engineConnected: boolean
  ollamaConnected: boolean
  availableProviders: ProviderInfo[]
  providerLoading: boolean
  /** Source code path selected by the user (folder on local machine) */
  sourcePath: string | null
  /** Files attached to the current thread */
  attachedFiles: Array<{ path: string; name: string; content?: string; size?: number }>

  setActiveView: (view: AppState['activeView']) => void
  setActiveThread: (id: string | null) => void
  addThread: (thread: Thread) => void
  removeThread: (id: string) => void
  addMessage: (threadId: string, message: Message) => void
  updateMessage: (threadId: string, msgId: string, updates: Partial<Message>) => void
  toggleSkill: (id: string) => void
  setActiveModel: (id: string) => void
  setActiveMode: (mode: AppState['activeMode']) => void
  toggleSidebar: () => void
  toggleOrb: () => void
  toggleOrbConnection: () => void
  toggleTheme: () => void
  setStreaming: (v: boolean) => void
  toggleTerminal: () => void
  toggleDiff: () => void
  setDiffContent: (content: string | null) => void
  setEngineConnected: (v: boolean) => void
  setOllamaConnected: (v: boolean) => void
  setSourcePath: (path: string | null) => void
  addAttachedFile: (file: { path: string; name: string; content?: string; size?: number }) => void
  removeAttachedFile: (path: string) => void
  clearAttachedFiles: () => void
  refreshProviders: () => Promise<void>
  sendPrompt: (threadId: string, text: string) => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  activeView: 'new-thread',
  activeThreadId: null,
  threads: [],
  messages: {},
  skills: ALL_SKILLS.map((s) => ({ ...s })),
  models: EBURON_ALIASES.map((alias) => ({
    id: alias,
    name: EBURON_DISPLAY_NAMES[alias] || alias,
    provider: 'eburon',
    isDefault: alias === 'auto',
  })),
  activeModel: 'auto',
  activeMode: 'local',
  isSidebarOpen: true,
  isOrbVisible: false,
  isOrbConnected: false,
  theme: 'dark',
  isStreaming: false,
  isTerminalOpen: false,
  isDiffOpen: true,
  diffContent: null,
  engineConnected: false,
  ollamaConnected: false,
  availableProviders: [],
  providerLoading: false,
  sourcePath: null,
  attachedFiles: [],

  setActiveView: (view) => set({ activeView: view }),
  setActiveThread: (id) => set({ activeThreadId: id }),
  addThread: (thread) => set((s) => ({ threads: [thread, ...s.threads] })),
  removeThread: (id) => set((s) => ({ threads: s.threads.filter((t) => t.id !== id) })),
  addMessage: (threadId, message) =>
    set((s) => ({
      messages: { ...s.messages, [threadId]: [...(s.messages[threadId] || []), message] },
    })),
  updateMessage: (threadId, msgId, updates) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: (s.messages[threadId] || []).map((m) =>
          m.id === msgId ? { ...m, ...updates } : m,
        ),
      },
    })),
  toggleSkill: (id) =>
    set((s) => ({
      skills: s.skills.map((sk) => (sk.id === id ? { ...sk, enabled: !sk.enabled } : sk)),
    })),
  setActiveModel: (id) => set({ activeModel: id }),
  setActiveMode: (mode) => set({ activeMode: mode }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  toggleOrb: () => set((s) => ({ isOrbVisible: !s.isOrbVisible })),
  toggleOrbConnection: () => set((s) => ({ isOrbConnected: !s.isOrbConnected })),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setStreaming: (v) => set({ isStreaming: v }),
  toggleTerminal: () => set((s) => ({ isTerminalOpen: !s.isTerminalOpen })),
  toggleDiff: () => set((s) => ({ isDiffOpen: !s.isDiffOpen })),
  setDiffContent: (content) => set({ diffContent: content }),
  setEngineConnected: (v) => set({ engineConnected: v }),
  setOllamaConnected: (v) => set({ ollamaConnected: v }),
  setSourcePath: (path) => set({ sourcePath: path }),
  addAttachedFile: (file) => set((s) => {
    if (s.attachedFiles.some((f) => f.path === file.path)) return s
    return { attachedFiles: [...s.attachedFiles, file] }
  }),
  removeAttachedFile: (path) => set((s) => ({
    attachedFiles: s.attachedFiles.filter((f) => f.path !== path),
  })),
  clearAttachedFiles: () => set({ attachedFiles: [] }),

  refreshProviders: async () => {
    set({ providerLoading: true })
    try {
      const providers = await getAvailableProviders()
      const online = await getOnlineProviders()
      set({
        availableProviders: providers.map((p) => ({
          ...p,
          available: online.includes(p.alias),
        })),
        providerLoading: false,
      })
    } catch {
      set({ providerLoading: false })
    }
  },

  sendPrompt: async (threadId, text) => {
    const state = get()
    const skillMgr = getSkillManager()
    const memStore = getMemoryStore()

    set({ isStreaming: true })

    const assistantMsgId = `msg-${Date.now()}-ai`

    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: [
          ...(s.messages[threadId] || []),
          { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() },
        ],
      },
    }))

    try {
      const [systemPrompt, projectMemories] = await Promise.all([
        skillMgr.getSystemPrompt(),
        memStore.getByProject('default'),
      ])
      const memoryContext = projectMemories
        .slice(0, 5)
        .map((m: any) => `- [${m.type}] ${m.content}`)
        .join('\n')

      let fullPrompt = text
      if (memoryContext) {
        fullPrompt = `Relevant context from past sessions:\n${memoryContext}\n\nUser: ${text}`
      }

      // Include source code path context
      if (state.sourcePath) {
        fullPrompt = `Source code directory: ${state.sourcePath}\nAll file operations should be relative to this path unless specified otherwise.\n\n${fullPrompt}`
      }

      // Include attached file contents
      if (state.attachedFiles.length > 0) {
        const fileContext = state.attachedFiles
          .map((f) => {
            if (f.content) {
              return `--- ${f.name} (${f.path}) ---\n${f.content.slice(0, 10000)}${f.content.length > 10000 ? '\n... (truncated)' : ''}`
            }
            return `--- ${f.name} (${f.path}) ---`
          })
          .join('\n\n')
        fullPrompt = `Attached files:\n${fileContext}\n\n${fullPrompt}`
      }

      if (systemPrompt) {
        fullPrompt = `${systemPrompt}\n\n${fullPrompt}`
      }

      const activeModel = state.activeModel
      const provider = activeModel !== 'auto' ? activeModel : undefined

      let aiText = ''

      try {
        const result = await streamPrompt(fullPrompt, provider, (chunk, _prov) => {
          aiText += chunk
          set((s) => ({
            messages: {
              ...s.messages,
              [threadId]: s.messages[threadId].map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + chunk }
                  : m,
              ),
            },
          }))
        })

        aiText = result.content || aiText
        set({ engineConnected: true })
      } catch (streamErr: any) {
        if (streamErr.message?.includes('All available Eburon engines failed')) {
          throw streamErr
        }
        try {
          const result = await executePrompt(fullPrompt, provider)
          aiText = result.content
          set({ engineConnected: true })
        } catch (execErr: any) {
          throw execErr
        }
      }

      if (aiText) {
        set((s) => ({
          messages: {
            ...s.messages,
            [threadId]: s.messages[threadId].map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: aiText, code: aiText.includes('```') ? aiText : undefined }
                : m,
            ),
          },
        }))
      }
    } catch (err: any) {
      const errorMsg = err.message?.includes('All available Eburon engines')
        ? 'All available Eburon engines failed to complete the task. Please try again.'
        : `Error: ${err.message || 'Unknown error'}`

      set((s) => ({
        messages: {
          ...s.messages,
          [threadId]: s.messages[threadId].map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: errorMsg }
              : m,
          ),
        },
      }))
    } finally {
      set({ isStreaming: false })
    }
  },
}))
