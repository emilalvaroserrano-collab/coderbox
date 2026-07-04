import { execFile, ChildProcess } from 'child_process'
import { ProviderAdapter, ProviderConfig, LLMContext, LLMResponse } from '../types'
import { SafeLogger } from '../logger'
import { mergeProviderEnv } from '../config'

interface OpenCodeEvent {
  type: string
  part?: { text?: string; reason?: string }
  sessionID?: string
}

export class OpencodeCliAdapter implements ProviderAdapter {
  readonly internalName: string
  readonly alias: string
  readonly displayName: string
  readonly contextLimit: number
  readonly availableModels: string[]
  protected config: ProviderConfig
  protected processEnv: Record<string, string>
  protected model: string

  constructor(config: ProviderConfig, processEnv: Record<string, string | undefined> = {}) {
    this.config = config
    this.internalName = config.internalName
    this.alias = config.alias
    this.displayName = config.displayName
    this.contextLimit = config.contextLimit
    this.processEnv = mergeProviderEnv(config, processEnv)
    this.model = this.processEnv['OPENCODE_MODEL'] || config.models[0] || 'opencode/deepseek-v4-flash-free'
    this.availableModels = config.models || [this.model]
  }

  /** Swap to a different model on this same opencode CLI provider */
  setModel(model: string): void {
    SafeLogger.internal('info', `[${this.internalName}] Swapping model: ${this.model} -> ${model}`)
    this.model = model
    this.processEnv['OPENCODE_MODEL'] = model
  }

  get currentModel(): string {
    return this.model
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await run('opencode', ['--version'])
      return stdout.trim().length > 0
    } catch {
      return false
    }
  }

  async execute(prompt: string, context?: LLMContext): Promise<LLMResponse> {
    const fullPrompt = this.buildPrompt(prompt, context)
    const args = ['run', '--format', 'json', '--model', this.model, fullPrompt]

    SafeLogger.internal('info', `[${this.internalName}] Executing: opencode run --model ${this.model} (${fullPrompt.length} chars)`)

    try {
      const { stdout, stderr } = await run('opencode', args, this.config.timeout)

      if (stderr) {
        SafeLogger.internal('warn', `[${this.internalName}] stderr: ${stderr.slice(0, 500)}`)
      }

      const content = this.parseResponse(stdout)

      if (!content.trim()) {
        throw new Error('EMPTY_RESPONSE')
      }

      return {
        content,
        tokensUsed: this.estimateTokens(content),
        finishReason: 'stop',
        modelUsed: this.alias,
      }
    } catch (err: any) {
      if (err.message?.includes('EMPTY_RESPONSE')) throw err
      if (err.code === 'ENOENT') throw new Error('PROVIDER_UNAVAILABLE')
      if (err.killed || err.signal) throw new Error('TIMEOUT')
      throw new Error(`CLI_COMMAND_FAILURE: ${err.message}`)
    }
  }

  async *stream(prompt: string, context?: LLMContext): AsyncGenerator<string, void, undefined> {
    const fullPrompt = this.buildPrompt(prompt, context)
    const args = ['run', '--format', 'json', '--model', this.model, fullPrompt]

    SafeLogger.internal('info', `[${this.internalName}] Streaming: opencode run --model ${this.model} (${fullPrompt.length} chars)`)

    let child: ChildProcess | null = null
    let hasContent = false

    try {
      const result = await new Promise<{ content: string }>((resolve, reject) => {
        child = execFile('opencode', args, {
          timeout: this.config.timeout,
          maxBuffer: 10 * 1024 * 1024,
        }, (err, stdout, stderr) => {
          if (err) {
            if (err.killed || err.signal) {
              reject(new Error('TIMEOUT'))
            } else if ((err as any).code === 'ENOENT') {
              reject(new Error('PROVIDER_UNAVAILABLE'))
            } else {
              reject(new Error(`CLI_COMMAND_FAILURE: ${err.message}`))
            }
            return
          }

          if (stderr) {
            SafeLogger.internal('warn', `[${this.internalName}] stderr: ${stderr.slice(0, 500)}`)
          }

          try {
            const content = this.parseResponse(stdout)
            resolve({ content })
          } catch (parseErr: any) {
            reject(parseErr)
          }
        })
      })

      if (!result.content.trim()) {
        throw new Error('EMPTY_RESPONSE')
      }

      yield result.content
    } finally {
      child = null
    }
  }

  private buildPrompt(prompt: string, context?: LLMContext): string {
    const parts: string[] = []

    if (context?.systemPrompt) {
      parts.push(`System: ${context.systemPrompt}`)
    }

    if (context?.messages) {
      for (const msg of context.messages) {
        if (msg.role === 'system') {
          parts.push(`System: ${msg.content}`)
        } else if (msg.role === 'user') {
          parts.push(`User: ${msg.content}`)
        } else if (msg.role === 'assistant') {
          parts.push(`Assistant: ${msg.content}`)
        }
      }
    }

    parts.push(`User: ${prompt}`)
    return parts.join('\n\n')
  }

  private parseResponse(stdout: string): string {
    let text = ''
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      try {
        const event: OpenCodeEvent = JSON.parse(line)
        if (event.type === 'text' && event.part?.text) {
          text += event.part.text
        }
      } catch {}
    }
    return text
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5)
  }
}

function run(cmd: string, args: string[], timeoutMs = 60000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err)
      else resolve({ stdout, stderr })
    })
  })
}
