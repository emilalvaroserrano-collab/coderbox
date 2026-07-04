import {
  EburonAlias,
  ProviderInfo,
  SwitchEvent,
  ResponseResult,
  EBURON_DISPLAY_NAMES,
} from './types'

interface ElectronProviderAPI {
  getAliases: () => Promise<string[]>
  getConfig: (alias: string) => Promise<{ alias: string; displayName: string; contextLimit: number } | null>
  checkAvailability: () => Promise<Record<string, boolean>>
  getSwitchHistory: () => Promise<SwitchEvent[]>
  getAvailable: () => Promise<string[]>
  execute: (payload: { prompt: string; provider?: string; sessionId?: string }) => Promise<{
    success: boolean
    content?: string
    tokensUsed?: number
    finishReason?: string
    modelUsed?: string
    error?: string
  }>
  streamStart: (payload: { prompt: string; provider?: string; sessionId?: string }) => Promise<{ success: boolean; error?: string }>
  streamStop: () => Promise<{ success: boolean }>
  onStreamChunk: (callback: (data: { chunk: string; provider: string }) => void) => () => void
  onStreamDone: (callback: (data: { content: string; modelUsed: string }) => void) => () => void
  onStreamError: (callback: (data: { error: string }) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: {
      provider: ElectronProviderAPI
      openDirectory: () => Promise<string | null>
      openFile: () => Promise<string | null>
      readFile: (filePath: string, maxBytes?: number) => Promise<{ path: string; size?: number; content?: string; truncated?: boolean; error?: string }>
      listDir: (dirPath: string, maxEntries?: number) => Promise<{ path: string; entries?: Array<{ name: string; type: string; path: string; size?: number }>; error?: string }>
    }
  }
}

function getProviderAPI(): ElectronProviderAPI | null {
  return window.electronAPI?.provider || null
}

export async function getAvailableProviders(): Promise<ProviderInfo[]> {
  const api = getProviderAPI()
  if (!api) return []

  try {
    const aliases = await api.getAliases()
    const availability = await api.checkAvailability()
    const result: ProviderInfo[] = []

    for (const alias of aliases) {
      const cfg = await api.getConfig(alias)
      result.push({
        alias,
        displayName: cfg?.displayName || EBURON_DISPLAY_NAMES[alias] || alias,
        contextLimit: cfg?.contextLimit || 128000,
        available: availability[alias] ?? false,
      })
    }
    return result
  } catch {
    return []
  }
}

export async function getOnlineProviders(): Promise<string[]> {
  const api = getProviderAPI()
  if (!api) return []

  try {
    return await api.getAvailable()
  } catch {
    return []
  }
}

export async function executePrompt(
  prompt: string,
  provider?: string,
): Promise<ResponseResult> {
  const api = getProviderAPI()
  if (!api) throw new Error('Provider system not available. Run the app in Electron.')

  const result = await api.execute({ prompt, provider })
  return {
    content: result.content || '',
    tokensUsed: result.tokensUsed,
    finishReason: result.finishReason,
    modelUsed: result.modelUsed,
  }
}

export async function streamPrompt(
  prompt: string,
  provider: string | undefined,
  onChunk: (chunk: string, provider: string) => void,
): Promise<ResponseResult> {
  const api = getProviderAPI()
  if (!api) throw new Error('Provider system not available. Run the app in Electron.')

  return new Promise((resolve, reject) => {
    let content = ''
    let modelUsed = 'eburon-sirius'
    let cleanup: (() => void) | null = null
    let settled = false

    const doneHandler = (data: { content: string; modelUsed: string }) => {
      if (settled) return
      settled = true
      if (cleanup) cleanup()
      resolve({
        content: data.content || content,
        modelUsed: data.modelUsed || modelUsed,
      })
    }

    const errorHandler = (data: { error: string }) => {
      if (settled) return
      settled = true
      if (cleanup) cleanup()
      reject(new Error(data.error))
    }

    cleanup = api.onStreamChunk((data) => {
      content += data.chunk
      modelUsed = data.provider || modelUsed
      onChunk(data.chunk, data.provider || modelUsed)
    })

    api.onStreamDone(doneHandler)
    api.onStreamError(errorHandler)

    api.streamStart({ prompt, provider }).catch((err) => {
      if (settled) return
      settled = true
      if (cleanup) cleanup()
      reject(err)
    })

    setTimeout(() => {
      if (!settled) {
        settled = true
        if (cleanup) cleanup()
        api.streamStop()
        reject(new Error('Stream request timed out'))
      }
    }, 300000)
  })
}

export async function getSwitchHistory(): Promise<SwitchEvent[]> {
  const api = getProviderAPI()
  if (!api) return []

  try {
    return await api.getSwitchHistory()
  } catch {
    return []
  }
}
