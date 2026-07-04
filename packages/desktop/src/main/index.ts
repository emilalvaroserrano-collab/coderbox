import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import path from 'path'
import { getOrchestrator } from './providers/orchestrator'
import { SafeLogger } from './providers/logger'
import { getAllAliases, getProviderConfig, getAllConfigs } from './providers/config'
import { getDb, disconnectDb } from './db'
import { GoogleService } from './services'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'codebox', privileges: { standard: true, secure: true } },
])

app.whenReady().then(() => {
  protocol.registerFileProtocol('codebox', (request, callback) => {
    const url = request.url.substring('codebox://'.length)
    callback({ path: path.normalize(decodeURIComponent(url)) })
  })
  createWindow()
})

app.on('window-all-closed', async () => {
  await disconnectDb()
  app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0]
})

// Read a file from the local filesystem (used when attaching source code)
ipcMain.handle('file:read', async (_event, filePath: string, maxBytes = 51200) => {
  try {
    const fs = await import('fs/promises')
    const stat = await fs.stat(filePath)
    if (stat.size > maxBytes) {
      const content = await fs.readFile(filePath, 'utf-8')
      return { path: filePath, size: stat.size, content: content.slice(0, maxBytes), truncated: true }
    }
    const content = await fs.readFile(filePath, 'utf-8')
    return { path: filePath, size: stat.size, content, truncated: false }
  } catch (err: any) {
    return { path: filePath, error: err.message }
  }
})

// List files in a directory (used when attaching a source folder)
ipcMain.handle('file:listDir', async (_event, dirPath: string, maxEntries = 200) => {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const result: Array<{ name: string; type: string; path: string; size?: number }> = []
    for (const entry of entries.slice(0, maxEntries)) {
      const fullPath = path.join(dirPath, entry.name)
      const type = entry.isDirectory() ? 'dir' : entry.isFile() ? 'file' : 'other'
      let size: number | undefined
      if (entry.isFile()) {
        try { const s = await fs.stat(fullPath); size = s.size } catch {}
      }
      result.push({ name: entry.name, type, path: fullPath, size })
    }
    return { path: dirPath, entries: result }
  } catch (err: any) {
    return { path: dirPath, error: err.message }
  }
})

ipcMain.handle('app:getVersion', () => app.getVersion())

const orchestrator = getOrchestrator()

// Start the Agent Orchestrator watchdog (monitors and restarts agents)
import { getAgentOrchestrator, DEFAULT_AGENTS } from './providers/agent-orchestrator'
const agentOrchestrator = getAgentOrchestrator()
for (const agentConfig of DEFAULT_AGENTS) {
  agentOrchestrator.register(agentConfig)
}
agentOrchestrator.start()

ipcMain.handle('db:user:findByFirebaseUid', async (_e, firebaseUid: string) => {
  const db = getDb()
  return db.user.findUnique({ where: { firebaseUid } })
})

ipcMain.handle('db:user:create', async (_e, data: { firebaseUid: string; email?: string; name?: string; avatarUrl?: string }) => {
  const db = getDb()
  return db.user.upsert({
    where: { firebaseUid: data.firebaseUid },
    update: { email: data.email, name: data.name, avatarUrl: data.avatarUrl },
    create: data,
  })
})

ipcMain.handle('db:user:update', async (_e, id: string, data: { name?: string; avatarUrl?: string; preferences?: any }) => {
  const db = getDb()
  return db.user.update({ where: { id }, data })
})

ipcMain.handle('db:thread:list', async () => {
  const db = getDb()
  return db.thread.findMany({ orderBy: { createdAt: 'desc' } })
})

ipcMain.handle('db:thread:get', async (_e, id: string) => {
  const db = getDb()
  return db.thread.findUnique({ where: { id }, include: { messages: true } })
})

ipcMain.handle('db:thread:create', async (_e, data: { userId: string; title?: string; mode?: string; projectId?: string; branch?: string; sessionId?: string }) => {
  const db = getDb()
  return db.thread.create({ data })
})

ipcMain.handle('db:thread:update', async (_e, id: string, data: { title?: string; branch?: string; sessionId?: string }) => {
  const db = getDb()
  return db.thread.update({ where: { id }, data })
})

ipcMain.handle('db:thread:delete', async (_e, id: string) => {
  const db = getDb()
  await db.thread.delete({ where: { id } })
  return true
})

ipcMain.handle('db:message:list', async (_e, threadId: string) => {
  const db = getDb()
  return db.message.findMany({ where: { threadId }, orderBy: { timestamp: 'asc' } })
})

ipcMain.handle('db:message:create', async (_e, data: { threadId: string; role: string; content: string; code?: string; reasoning?: string }) => {
  const db = getDb()
  return db.message.create({ data })
})

ipcMain.handle('db:memory:list', async (_e, project?: string) => {
  const db = getDb()
  const where = project ? { project } : {}
  return db.memory.findMany({ where, orderBy: { createdAt: 'desc' } })
})

ipcMain.handle('db:memory:create', async (_e, data: { userId: string; type: string; content: string; project?: string; sourceSession?: string; confidence?: number }) => {
  const db = getDb()
  return db.memory.create({ data })
})

ipcMain.handle('db:memory:search', async (_e, query: string, project?: string) => {
  const db = getDb()
  const memories = await db.memory.findMany({
    where: {
      content: { contains: query, mode: 'insensitive' },
      ...(project ? { project } : {}),
    },
    orderBy: { confidence: 'desc' },
  })
  return memories
})

ipcMain.handle('db:skill:list', async () => {
  const db = getDb()
  return db.skill.findMany({ orderBy: { createdAt: 'desc' } })
})

ipcMain.handle('db:skill:create', async (_e, data: { userId: string; name: string; description?: string; type?: string; content?: string; icon?: string }) => {
  const db = getDb()
  return db.skill.create({ data })
})

ipcMain.handle('db:skill:update', async (_e, id: string, data: { name?: string; description?: string; type?: string; content?: string; icon?: string; enabled?: boolean }) => {
  const db = getDb()
  return db.skill.update({ where: { id }, data })
})

ipcMain.handle('db:skill:delete', async (_e, id: string) => {
  const db = getDb()
  await db.skill.delete({ where: { id } })
  return true
})

ipcMain.handle('google:auth:init', async (_e, credentialsPath?: string) => {
  return GoogleService.auth.init(credentialsPath)
})

ipcMain.handle('google:auth:authenticate', async () => {
  return GoogleService.auth.authenticate()
})

ipcMain.handle('google:auth:signOut', async () => {
  return GoogleService.auth.signOut()
})

ipcMain.handle('google:auth:isAuthenticated', () => {
  return GoogleService.auth.isAuthenticated()
})

ipcMain.handle('google:gmail:listLabels', async () => {
  return GoogleService.gmail.listLabels()
})

ipcMain.handle('google:gmail:listMessages', async (_e, opts?: { maxResults?: number; labelIds?: string[]; query?: string }) => {
  return GoogleService.gmail.listMessages(opts)
})

ipcMain.handle('google:gmail:getMessage', async (_e, messageId: string) => {
  return GoogleService.gmail.getMessage(messageId)
})

ipcMain.handle('google:gmail:sendMessage', async (_e, to: string, subject: string, body: string) => {
  return GoogleService.gmail.sendMessage(to, subject, body)
})

ipcMain.handle('google:calendar:listCalendars', async () => {
  return GoogleService.calendar.listCalendars()
})

ipcMain.handle('google:calendar:listEvents', async (_e, opts?: { calendarId?: string; maxResults?: number; timeMin?: string; timeMax?: string }) => {
  return GoogleService.calendar.listEvents(opts)
})

ipcMain.handle('google:calendar:createEvent', async (_e, opts: { summary: string; description?: string; start: string; end: string; location?: string; attendees?: string[] }) => {
  return GoogleService.calendar.createEvent(opts)
})

ipcMain.handle('google:drive:listFiles', async (_e, opts?: { pageSize?: number; query?: string; orderBy?: string }) => {
  return GoogleService.drive.listFiles(opts)
})

ipcMain.handle('google:drive:uploadFile', async (_e, opts: { filePath: string; name?: string; mimeType?: string; parentFolderId?: string }) => {
  return GoogleService.drive.uploadFile(opts)
})

ipcMain.handle('google:drive:downloadFile', async (_e, fileId: string, destPath: string) => {
  return GoogleService.drive.downloadFile(fileId, destPath)
})

ipcMain.handle('google:drive:createFolder', async (_e, name: string, parentFolderId?: string) => {
  return GoogleService.drive.createFolder(name, parentFolderId)
})

ipcMain.handle('provider:getAliases', () => {
  // Public API: returns only generic public aliases (no internal names)
  return ['eburon-auto', ...getAllAliases()]
})

ipcMain.handle('provider:getConfig', (_event, alias: string) => {
  // Public API: only returns displayName + contextLimit (never internalName/env)
  if (alias === 'eburon-auto') {
    return { alias: 'eburon-auto', displayName: 'Eburon AI', contextLimit: 128000 }
  }
  const cfg = getProviderConfig(alias)
  if (!cfg) return null
  return {
    alias: cfg.alias,
    displayName: cfg.displayName,
    contextLimit: cfg.contextLimit,
  }
})

ipcMain.handle('provider:checkAvailability', async () => {
  // Public API: returns alias -> boolean (never exposes internal names)
  return orchestrator.checkAvailability()
})

ipcMain.handle('provider:getSwitchHistory', () => {
  // Public API: strips internal provider names, uses branded messages
  return orchestrator.getSwitchHistory().map((entry) => ({
    timestamp: entry.timestamp,
    failedAlias: 'Eburon AI',
    reason: entry.reason,
    nextAlias: 'Eburon AI',
    success: entry.success,
  }))
})

ipcMain.handle('provider:getAvailable', async () => {
  const avail = await orchestrator.checkAvailability()
  return Object.entries(avail)
    .filter(([, isAvail]) => isAvail)
    .map(([alias]) => alias)
})

ipcMain.handle('provider:execute', async (_event, payload: {
  prompt: string
  provider?: string
  sessionId?: string
}) => {
  const { prompt: text, provider } = payload
  try {
    const response = await orchestrator.execute(text, undefined, provider)
    // Sanitize: never expose internal modelUsed
    return {
      success: true,
      content: response.content,
      tokensUsed: response.tokensUsed,
      finishReason: response.finishReason,
      modelUsed: 'Eburon AI',
    }
  } catch (err: any) {
    return {
      success: false,
      error: 'Eburon AI is temporarily unavailable. Please try again shortly.',
    }
  }
})

let streamBuffer: string[] = []

ipcMain.handle('provider:streamStart', async (_event, payload: {
  prompt: string
  provider?: string
  sessionId?: string
}) => {
  streamBuffer = []
  const { prompt: text, provider } = payload

  try {
    for await (const { chunk, provider: prov } of orchestrator.stream(text, undefined, provider)) {
      streamBuffer.push(chunk)
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Sanitize: always send "Eburon AI" as provider, never the internal alias
        mainWindow.webContents.send('provider:streamChunk', { chunk, provider: 'Eburon AI' })
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('provider:streamDone', {
        content: streamBuffer.join(''),
        modelUsed: 'Eburon AI',
      })
    }

    return { success: true }
  } catch (err: any) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('provider:streamError', {
        error: 'Eburon AI is temporarily unavailable. Please try again shortly.',
      })
    }
    return { success: false, error: 'Eburon AI is temporarily unavailable.' }
  }
})

ipcMain.handle('provider:streamStop', async () => {
  return { success: true }
})

// ─── Admin-only endpoints (never expose to normal users) ───

ipcMain.handle('provider:admin:getStatus', async () => {
  // Admin only: returns full internal details for the admin panel
  const availability = await orchestrator.checkAvailability()
  const configs = getAllConfigs()
  const switchHistory = orchestrator.getSwitchHistory()
  const requestLog = orchestrator.getRequestLog()

  return configs.map((cfg) => ({
    alias: cfg.alias,
    internalRoute: cfg.internalName,
    model: cfg.env.OLLAMA_MODEL || cfg.env.OPENCODE_MODEL || cfg.env.FREEBUFF_MODEL || cfg.env.OLLAMA_CLOUD_MODEL || 'unknown',
    displayName: cfg.displayName,
    contextLimit: cfg.contextLimit,
    available: availability[cfg.alias] ?? false,
    timeout: cfg.timeout,
  }))
})

ipcMain.handle('provider:admin:getSwitchHistory', () => {
  // Admin only: full switch history with internal names
  return orchestrator.getSwitchHistory()
})

ipcMain.handle('provider:admin:getRequestLog', () => {
  // Admin only: request log with alias/route/latency
  return orchestrator.getRequestLog()
})

ipcMain.handle('provider:admin:testRoute', async (_event, alias: string) => {
  // Admin only: test a specific route
  const cfg = getProviderConfig(alias)
  if (!cfg) return { success: false, error: 'Unknown alias' }
  const start = Date.now()
  try {
    const response = await orchestrator.execute('Say OK', undefined, alias)
    return {
      success: true,
      latency: Date.now() - start,
      content: response.content?.slice(0, 100),
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      latency: Date.now() - start,
    }
  }
})

// ─── Agent Orchestrator endpoints (admin only) ───

ipcMain.handle('orchestrator:getStatus', () => {
  // Admin only: returns full status of all monitored agents
  return agentOrchestrator.getStatus()
})

ipcMain.handle('orchestrator:restart', async (_event, agentId: string) => {
  // Admin only: manually restart a specific agent
  return { success: await agentOrchestrator.restart(agentId) }
})
