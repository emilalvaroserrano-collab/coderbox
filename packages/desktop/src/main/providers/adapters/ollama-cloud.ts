import { ProviderAdapter, ProviderConfig, LLMContext, LLMResponse } from '../types'
import { SafeLogger } from '../logger'
import { mergeProviderEnv } from '../config'

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434'

interface OllamaMessage {
  role: string
  content: string
}

interface OllamaChatRequest {
  model: string
  messages: OllamaMessage[]
  stream: boolean
  options?: {
    temperature?: number
    num_predict?: number
    num_ctx?: number
  }
}

interface OllamaChatResponse {
  message: { role: string; content: string }
  done: boolean
  done_reason?: string
  eval_count?: number
}

export class OllamaCloudAdapter implements ProviderAdapter {
  readonly internalName: string
  readonly alias: string
  readonly displayName: string
  readonly contextLimit: number
  readonly availableModels: string[]
  protected config: ProviderConfig
  protected processEnv: Record<string, string>
  protected model: string
  protected baseUrl: string

  constructor(config: ProviderConfig, processEnv: Record<string, string | undefined> = {}) {
    this.config = config
    this.internalName = config.internalName
    this.alias = config.alias
    this.displayName = config.displayName
    this.contextLimit = config.contextLimit
    this.processEnv = mergeProviderEnv(config, processEnv)
    this.model = this.processEnv['OLLAMA_CLOUD_MODEL'] || config.models[0] || 'qwen3.6:latest'
    this.baseUrl = this.processEnv['OLLAMA_CLOUD_HOST'] || DEFAULT_OLLAMA_HOST
    this.availableModels = config.models || [this.model]
  }

  /** Swap to a different model on this same Ollama Cloud provider */
  setModel(model: string): void {
    SafeLogger.internal('info', `[${this.internalName}] Swapping model: ${this.model} -> ${model}`)
    this.model = model
    this.processEnv['OLLAMA_CLOUD_MODEL'] = model
  }

  get currentModel(): string {
    return this.model
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return false
      const data = await res.json()
      const models: string[] = (data.models || []).map((m: any) => m.name)
      return models.some((m) => this.model === m || m.startsWith(this.model.split(':')[0]))
    } catch {
      return false
    }
  }

  async execute(prompt: string, context?: LLMContext): Promise<LLMResponse> {
    const messages = this.buildMessages(prompt, context)

    SafeLogger.internal('info', `[${this.internalName}] Executing: ${this.model} via ${this.baseUrl} (${prompt.length} chars)`)

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: { num_ctx: this.contextLimit },
        } satisfies OllamaChatRequest),
        signal: AbortSignal.timeout(this.config.timeout),
      })

      if (!res.ok) {
        if (res.status === 404) throw new Error('PROVIDER_UNAVAILABLE')
        if (res.status === 429) throw new Error('RATE_LIMITED')
        if (res.status === 413) throw new Error('CONTEXT_WINDOW_EXCEEDED')
        throw new Error(`PROVIDER_UNAVAILABLE: ${res.status}`)
      }

      const data: OllamaChatResponse = await res.json()
      const content = data.message?.content || ''

      if (!content.trim()) {
        throw new Error('EMPTY_RESPONSE')
      }

      SafeLogger.internal('info', `[${this.internalName}] Response: ${content.length} chars, model=${this.model}`)

      return {
        content,
        tokensUsed: data.eval_count || this.estimateTokens(content),
        finishReason: data.done_reason || 'stop',
        modelUsed: this.alias,
      }
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new Error('TIMEOUT')
      if (err.message?.startsWith('PROVIDER_UNAVAILABLE')) throw err
      if (err.message?.startsWith('RATE_LIMITED')) throw err
      if (err.message?.startsWith('CONTEXT_WINDOW_EXCEEDED')) throw err
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
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          options: { num_ctx: this.contextLimit },
        } satisfies OllamaChatRequest),
        signal: AbortSignal.timeout(this.config.timeout),
      })

      if (!res.ok) {
        if (res.status === 404) throw new Error('PROVIDER_UNAVAILABLE')
        if (res.status === 429) throw new Error('RATE_LIMITED')
        if (res.status === 413) throw new Error('CONTEXT_WINDOW_EXCEEDED')
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
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)
            if (data.message?.content) {
              hasContent = true
              yield data.message.content
            }
          } catch {}
        }
      }

      if (!hasContent) throw new Error('EMPTY_RESPONSE')
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new Error('TIMEOUT')
      if (err.message?.startsWith('PROVIDER_UNAVAILABLE')) throw err
      if (err.message?.startsWith('RATE_LIMITED')) throw err
      if (err.message?.startsWith('CONTEXT_WINDOW_EXCEEDED')) throw err
      if (err.message?.startsWith('EMPTY_RESPONSE')) throw err
      if (err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED')) {
        throw new Error('PROVIDER_UNAVAILABLE')
      }
      SafeLogger.internal('error', `[${this.internalName}] Stream failed: ${err.message}`)
      throw err
    }
  }

  private buildMessages(prompt: string, context?: LLMContext): OllamaMessage[] {
    const messages: OllamaMessage[] = []

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
