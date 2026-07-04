import { contextBridge, ipcRenderer } from 'electron'

export interface ProviderExecuteResult {
  success: boolean
  content?: string
  tokensUsed?: number
  finishReason?: string
  modelUsed?: string
  error?: string
}

export interface ProviderConfig {
  alias: string
  displayName: string
  contextLimit: number
}

export interface SwitchLogEntry {
  timestamp: number
  failedAlias: string
  reason: string
  nextAlias: string
  success: boolean
}

const google = {
  auth: {
    init: (credentialsPath?: string): Promise<boolean> =>
      ipcRenderer.invoke('google:auth:init', credentialsPath),
    authenticate: (): Promise<boolean> =>
      ipcRenderer.invoke('google:auth:authenticate'),
    signOut: (): Promise<void> =>
      ipcRenderer.invoke('google:auth:signOut'),
    isAuthenticated: (): Promise<boolean> =>
      ipcRenderer.invoke('google:auth:isAuthenticated'),
  },
  gmail: {
    listLabels: (): Promise<any[]> =>
      ipcRenderer.invoke('google:gmail:listLabels'),
    listMessages: (opts?: { maxResults?: number; labelIds?: string[]; query?: string }): Promise<any[]> =>
      ipcRenderer.invoke('google:gmail:listMessages', opts),
    getMessage: (messageId: string): Promise<any> =>
      ipcRenderer.invoke('google:gmail:getMessage', messageId),
    sendMessage: (to: string, subject: string, body: string): Promise<string> =>
      ipcRenderer.invoke('google:gmail:sendMessage', to, subject, body),
  },
  calendar: {
    listCalendars: (): Promise<any[]> =>
      ipcRenderer.invoke('google:calendar:listCalendars'),
    listEvents: (opts?: { calendarId?: string; maxResults?: number; timeMin?: string; timeMax?: string }): Promise<any[]> =>
      ipcRenderer.invoke('google:calendar:listEvents', opts),
    createEvent: (opts: { summary: string; description?: string; start: string; end: string; location?: string; attendees?: string[] }): Promise<any> =>
      ipcRenderer.invoke('google:calendar:createEvent', opts),
  },
  drive: {
    listFiles: (opts?: { pageSize?: number; query?: string; orderBy?: string }): Promise<any[]> =>
      ipcRenderer.invoke('google:drive:listFiles', opts),
    uploadFile: (opts: { filePath: string; name?: string; mimeType?: string; parentFolderId?: string }): Promise<any> =>
      ipcRenderer.invoke('google:drive:uploadFile', opts),
    downloadFile: (fileId: string, destPath: string): Promise<string> =>
      ipcRenderer.invoke('google:drive:downloadFile', fileId, destPath),
    createFolder: (name: string, parentFolderId?: string): Promise<any> =>
      ipcRenderer.invoke('google:drive:createFolder', name, parentFolderId),
  },
}

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  readFile: (filePath: string, maxBytes?: number): Promise<{ path: string; size?: number; content?: string; truncated?: boolean; error?: string }> =>
    ipcRenderer.invoke('file:read', filePath, maxBytes),
  listDir: (dirPath: string, maxEntries?: number): Promise<{ path: string; entries?: Array<{ name: string; type: string; path: string; size?: number }>; error?: string }> =>
    ipcRenderer.invoke('file:listDir', dirPath, maxEntries),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  google,

  db: {
    user: {
      findByFirebaseUid: (firebaseUid: string): Promise<any> => ipcRenderer.invoke('db:user:findByFirebaseUid', firebaseUid),
      create: (data: any): Promise<any> => ipcRenderer.invoke('db:user:create', data),
      update: (id: string, data: any): Promise<any> => ipcRenderer.invoke('db:user:update', id, data),
    },
    thread: {
      list: (): Promise<any[]> => ipcRenderer.invoke('db:thread:list'),
      get: (id: string): Promise<any> => ipcRenderer.invoke('db:thread:get', id),
      create: (data: any): Promise<any> => ipcRenderer.invoke('db:thread:create', data),
      update: (id: string, data: any): Promise<any> => ipcRenderer.invoke('db:thread:update', id, data),
      delete: (id: string): Promise<boolean> => ipcRenderer.invoke('db:thread:delete', id),
    },
    message: {
      list: (threadId: string): Promise<any[]> => ipcRenderer.invoke('db:message:list', threadId),
      create: (data: any): Promise<any> => ipcRenderer.invoke('db:message:create', data),
    },
    memory: {
      list: (project?: string): Promise<any[]> => ipcRenderer.invoke('db:memory:list', project),
      create: (data: any): Promise<any> => ipcRenderer.invoke('db:memory:create', data),
      search: (query: string, project?: string): Promise<any[]> => ipcRenderer.invoke('db:memory:search', query, project),
    },
    skill: {
      list: (): Promise<any[]> => ipcRenderer.invoke('db:skill:list'),
      create: (data: any): Promise<any> => ipcRenderer.invoke('db:skill:create', data),
      update: (id: string, data: any): Promise<any> => ipcRenderer.invoke('db:skill:update', id, data),
      delete: (id: string): Promise<boolean> => ipcRenderer.invoke('db:skill:delete', id),
    },
  },

  provider: {
    getAliases: (): Promise<string[]> => ipcRenderer.invoke('provider:getAliases'),
    getConfig: (alias: string): Promise<ProviderConfig | null> =>
      ipcRenderer.invoke('provider:getConfig', alias),
    checkAvailability: (): Promise<Record<string, boolean>> =>
      ipcRenderer.invoke('provider:checkAvailability'),
    getSwitchHistory: (): Promise<SwitchLogEntry[]> =>
      ipcRenderer.invoke('provider:getSwitchHistory'),
    getAvailable: (): Promise<string[]> =>
      ipcRenderer.invoke('provider:getAvailable'),
    execute: (payload: { prompt: string; provider?: string; sessionId?: string }): Promise<ProviderExecuteResult> =>
      ipcRenderer.invoke('provider:execute', payload),
    streamStart: (payload: { prompt: string; provider?: string; sessionId?: string }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('provider:streamStart', payload),
    streamStop: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('provider:streamStop'),
    onStreamChunk: (callback: (data: { chunk: string; provider: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { chunk: string; provider: string }) =>
        callback(data)
      ipcRenderer.on('provider:streamChunk', handler)
      return () => ipcRenderer.removeListener('provider:streamChunk', handler)
    },
    onStreamDone: (callback: (data: { content: string; modelUsed: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { content: string; modelUsed: string }) =>
        callback(data)
      ipcRenderer.on('provider:streamDone', handler)
      return () => ipcRenderer.removeListener('provider:streamDone', handler)
    },
    onStreamError: (callback: (data: { error: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { error: string }) =>
        callback(data)
      ipcRenderer.on('provider:streamError', handler)
      return () => ipcRenderer.removeListener('provider:streamError', handler)
    },
  },

  // Admin-only API — never exposed to normal users, only accessed via /admin/providers
  admin: {
    getProviderStatus: (): Promise<Array<{
      alias: string
      internalRoute: string
      model: string
      displayName: string
      contextLimit: number
      available: boolean
      timeout: number
    }>> => ipcRenderer.invoke('provider:admin:getStatus'),
    getSwitchHistory: (): Promise<SwitchLogEntry[]> =>
      ipcRenderer.invoke('provider:admin:getSwitchHistory'),
    getRequestLog: (): Promise<Array<{
      requestId: string
      alias: string
      internalName: string
      internalModel?: string
      latencyMs: number
      success: boolean
      error?: string
      timestamp: number
    }>> => ipcRenderer.invoke('provider:admin:getRequestLog'),
    testRoute: (alias: string): Promise<{ success: boolean; latency?: number; content?: string; error?: string }> =>
      ipcRenderer.invoke('provider:admin:testRoute', alias),

    // Agent Orchestrator
    getAgentStatus: (): Promise<Array<{
      id: string
      pid: number | null
      status: string
      restartCount: number
      lastHealthCheck: number
      lastError?: string
      startedAt: number | null
      uptime: number
    }>> => ipcRenderer.invoke('orchestrator:getStatus'),
    restartAgent: (agentId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('orchestrator:restart', agentId),
  },
})
