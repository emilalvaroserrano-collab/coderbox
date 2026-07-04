import { ProviderAdapter, ProviderConfig, LLMContext, LLMResponse } from '../types'
import { SafeLogger } from '../logger'
import { mergeProviderEnv } from '../config'

const OLLAMA_BASE = 'http://localhost:11434'

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
  prompt_eval_count?: number
}

export abstract class BaseAdapter implements ProviderAdapter {
  readonly internalName: string
  readonly alias: string
  readonly displayName: string
  readonly contextLimit: number
  readonly availableModels: string[]
  protected config: ProviderConfig
  protected processEnv: Record<string, string>
  protected ollamaModel: string

  constructor(config: ProviderConfig, processEnv: Record<string, string | undefined> = {}) {
    this.config = config
    this.internalName = config.internalName
    this.alias = config.alias
    this.displayName = config.displayName
    this.contextLimit = config.contextLimit
    this.processEnv = mergeProviderEnv(config, processEnv)
    this.ollamaModel = this.processEnv['OLLAMA_MODEL'] || config.models[0] || 'llama3.2'
    this.availableModels = config.models || [this.ollamaModel]
  }

  /** Swap to a different model on this same Ollama provider */
  setModel(model: string): void {
    SafeLogger.internal('info', `[${this.internalName}] Swapping model: ${this.ollamaModel} -> ${model}`)
    this.ollamaModel = model
    // Also update env so mergeProviderEnv picks it up if re-merged
    this.processEnv['OLLAMA_MODEL'] = model
  }

  get currentModel(): string {
    return this.ollamaModel
  }

  abstract isAvailable(): Promise<boolean>

  async execute(prompt: string, context?: LLMContext): Promise<LLMResponse> {
    const messages = this.buildMessages(prompt, context)

    if (this.checkContextLimit(messages)) {
      throw new Error('CONTEXT_WINDOW_EXCEEDED')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          messages,
          stream: false,
          options: {
            num_ctx: this.contextLimit,
          },
        } satisfies OllamaChatRequest),
        signal: controller.signal,
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

      SafeLogger.internal('info', `[${this.internalName}] Response: ${content.length} chars, model=${this.ollamaModel}`)

      return {
        content,
        tokensUsed: data.eval_count || this.estimateTokens(content),
        finishReason: data.done_reason || 'stop',
        modelUsed: this.alias,
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('TIMEOUT')
      if (err.message?.startsWith('PROVIDER_UNAVAILABLE')) throw err
      if (err.message?.startsWith('RATE_LIMITED')) throw err
      if (err.message?.startsWith('CONTEXT_WINDOW_EXCEEDED')) throw err
      if (err.message?.startsWith('EMPTY_RESPONSE')) throw err
      if (err.message?.startsWith('TIMEOUT')) throw err

      if (err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch')) {
        throw new Error('PROVIDER_UNAVAILABLE')
      }

      SafeLogger.internal('error', `[${this.internalName}] Failed: ${err.message}`)
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async *stream(prompt: string, context?: LLMContext): AsyncGenerator<string, void, undefined> {
    const messages = this.buildMessages(prompt, context)

    if (this.checkContextLimit(messages)) {
      throw new Error('CONTEXT_WINDOW_EXCEEDED')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          messages,
          stream: true,
          options: {
            num_ctx: this.contextLimit,
          },
        } satisfies OllamaChatRequest),
        signal: controller.signal,
      })

      if (!res.ok) {
        if (res.status === 404) throw new Error('PROVIDER_UNAVAILABLE')
        if (res.status === 429) throw new Error('RATE_LIMITED')
        if (res.status === 413) throw new Error('CONTEXT_WINDOW_EXCEEDED')
        throw new Error(`PROVIDER_UNAVAILABLE: ${res.status}`)
      }

      if (!res.body) {
        throw new Error('EMPTY_RESPONSE')
      }

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

      if (!hasContent) {
        throw new Error('EMPTY_RESPONSE')
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('TIMEOUT')
      if (err.message?.startsWith('PROVIDER_UNAVAILABLE')) throw err
      if (err.message?.startsWith('RATE_LIMITED')) throw err
      if (err.message?.startsWith('CONTEXT_WINDOW_EXCEEDED')) throw err
      if (err.message?.startsWith('EMPTY_RESPONSE')) throw err
      if (err.message?.startsWith('TIMEOUT')) throw err

      if (err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch')) {
        throw new Error('PROVIDER_UNAVAILABLE')
      }

      SafeLogger.internal('error', `[${this.internalName}] Stream failed: ${err.message}`)
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  protected buildMessages(prompt: string, context?: LLMContext): OllamaMessage[] {
    const messages: OllamaMessage[] = []

    if (context?.systemPrompt) {
      messages.push({ role: 'system', content: context.systemPrompt })
    }

    if (context?.messages) {
      for (const msg of context.messages) {
        if (msg.role === 'system') {
          messages.push({ role: 'system', content: msg.content })
        } else if (msg.role === 'user') {
          messages.push({ role: 'user', content: msg.content })
        } else if (msg.role === 'assistant') {
          messages.push({ role: 'assistant', content: msg.content })
        }
      }
    }

    messages.push({ role: 'user', content: prompt })
    return messages
  }

  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5)
  }

  protected checkContextLimit(messages: OllamaMessage[]): boolean {
    const totalText = messages.map((m) => m.content).join('')
    return this.estimateTokens(totalText) > this.contextLimit
  }
}
