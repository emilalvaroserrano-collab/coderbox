import { ProviderAdapter, ProviderConfig, LLMContext, LLMResponse } from '../types'
import { SafeLogger } from '../logger'
import { mergeProviderEnv } from '../config'

const DEFAULT_FREEBUFF_HOST = 'http://localhost:8000'

interface FreebuffMessage {
  role: string
  content: string
}

interface FreebuffChatRequest {
  model: string
  messages: FreebuffMessage[]
  stream: boolean
  max_tokens?: number
}

interface FreebuffModel {
  id: string
  object: string
}

interface FreebuffChatResponse {
  choices: {
    message: { role: string; content: string }
    finish_reason: string
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class FreebuffCliAdapter implements ProviderAdapter {
  readonly internalName: string
  readonly alias: string
  readonly displayName: string
  readonly contextLimit: number
  readonly availableModels: string[]
  protected config: ProviderConfig
  protected processEnv: Record<string, string>
  protected model: string
  protected baseUrl: string
  protected apiKey: string

  constructor(config: ProviderConfig, processEnv: Record<string, string | undefined> = {}) {
    this.config = config
    this.internalName = config.internalName
    this.alias = config.alias
    this.displayName = config.displayName
    this.contextLimit = config.contextLimit
    this.processEnv = mergeProviderEnv(config, processEnv)
    this.model = this.processEnv['FREEBUFF_MODEL'] || config.models[0] || 'deepseek/deepseek-v4-flash'
    this.baseUrl = this.processEnv['FREEBUFF_HOST'] || DEFAULT_FREEBUFF_HOST
    this.apiKey = this.processEnv['FREEBUFF_API_KEY'] || 'not-needed'
    this.availableModels = config.models || [this.model]
  }

  /** Swap to a different model on this same Freebuff provider */
  setModel(model: string): void {
    SafeLogger.internal('info', `[${this.internalName}] Swapping model: ${this.model} -> ${model}`)
    this.model = model
    this.processEnv['FREEBUFF_MODEL'] = model
  }

  get currentModel(): string {
    return this.model
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) return false
      const data = await res.json()
      const models: FreebuffModel[] = data.data || []
      return models.some((m) => m.id.includes('deepseek') || m.id.includes('freebuff'))
    } catch {
      return false
    }
  }

  async execute(prompt: string, context?: LLMContext): Promise<LLMResponse> {
    const messages = this.buildMessages(prompt, context)

    SafeLogger.internal('info', `[${this.internalName}] Executing: ${this.model} via ${this.baseUrl} (${prompt.length} chars)`)

    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          max_tokens: Math.min(this.contextLimit, 4096),
        } satisfies FreebuffChatRequest),
        signal: AbortSignal.timeout(this.config.timeout),
      })

      if (!res.ok) {
        if (res.status === 429) throw new Error('RATE_LIMITED')
        if (res.status === 401 || res.status === 403) throw new Error('USAGE_QUOTA')
        throw new Error(`PROVIDER_UNAVAILABLE: ${res.status}`)
      }

      const data: FreebuffChatResponse = await res.json()
      const content = data.choices?.[0]?.message?.content || ''

      if (!content.trim()) {
        throw new Error('EMPTY_RESPONSE')
      }

      return {
        content,
        tokensUsed: data.usage?.total_tokens || this.estimateTokens(content),
        finishReason: data.choices?.[0]?.finish_reason || 'stop',
        modelUsed: this.alias,
      }
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new Error('TIMEOUT')
      if (err.message?.startsWith('RATE_LIMITED')) throw err
      if (err.message?.startsWith('USAGE_QUOTA')) throw err
      if (err.message?.startsWith('PROVIDER_UNAVAILABLE')) throw err
      if (err.message?.startsWith('EMPTY_RESPONSE')) throw err
      if (err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED')) {
        throw new Error('PROVIDER_UNAVAILABLE')
      }
      SafeLogger.internal('error', `[${this.internalName}] Failed: ${err.message}`)
      throw err
    }
  }

  async *stream(prompt: string, context?: LLMContext): AsyncGenerator<string, void, undefined> {
    const messages = this.buildMessages(prompt, context)

    SafeLogger.internal('info', `[${this.internalName}] Streaming: ${this.model} via ${this.baseUrl}`)

    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          max_tokens: Math.min(this.contextLimit, 4096),
        } satisfies FreebuffChatRequest),
        signal: AbortSignal.timeout(this.config.timeout),
      })

      if (!res.ok) {
        if (res.status === 429) throw new Error('RATE_LIMITED')
        throw new Error(`PROVIDER_UNAVAILABLE: ${res.status}`)
      }

      if (!res.body) throw new Error('EMPTY_RESPONSE')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let hasContent = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const jsonStr = trimmed.slice(6)
          if (jsonStr === '[DONE]') return

          try {
            const data = JSON.parse(jsonStr)
            const delta = data.choices?.[0]?.delta?.content
            if (delta) {
              hasContent = true
              yield delta
            }
          } catch {}
        }
      }

      if (!hasContent) throw new Error('EMPTY_RESPONSE')
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new Error('TIMEOUT')
      if (err.message?.startsWith('RATE_LIMITED')) throw err
      if (err.message?.startsWith('EMPTY_RESPONSE')) throw err
      if (err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED')) {
        throw new Error('PROVIDER_UNAVAILABLE')
      }
      SafeLogger.internal('error', `[${this.internalName}] Stream failed: ${err.message}`)
      throw err
    }
  }

  private buildMessages(prompt: string, context?: LLMContext): FreebuffMessage[] {
    const messages: FreebuffMessage[] = []

    if (context?.systemPrompt) {
      messages.push({ role: 'system', content: context.systemPrompt })
    }

    if (context?.messages) {
      for (const msg of context.messages) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    messages.push({ role: 'user', content: prompt })
    return messages
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5)
  }
}
