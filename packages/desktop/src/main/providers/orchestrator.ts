import {
  ProviderAdapter,
  LLMContext,
  LLMResponse,
  FailReason,
  SwitchLogEntry,
  RequestLogEntry,
  OrchestratorConfig,
  NO_FAILOVER_REASONS,
} from './types'
import { getProviderConfig, loadOrchestratorConfig, internalToAlias, aliasToInternal } from './config'
import { SafeLogger } from './logger'
import { compressContext, summarizeContext, estimateTokens } from './compressor'
import { OpencodeZenAdapter } from './adapters/opencode-zen'
import { VegaOllamaAdapter } from './adapters/vega-ollama'
import { OrionOllamaAdapter } from './adapters/orion-ollama'
import { FreebuffAdapter } from './adapters/freebuff'
import { OpencodeCliAdapter } from './adapters/opencode-cli'
import { FreebuffCliAdapter } from './adapters/freebuff-cli'
import { OllamaCloudAdapter } from './adapters/ollama-cloud'

/** Public-facing branded messages — never expose provider/model names */
const BRANDED_MESSAGES = {
  switching: 'Eburon AI is switching to a backup route...',
  thinking: 'Eburon AI is thinking...',
  unavailable: 'Eburon AI is temporarily unavailable. Please try again shortly.',
  allFailed: 'Eburon AI is temporarily unavailable. Please try again shortly.',
} as const

const ADAPTER_REGISTRY: Record<string, new (cfg: any, env: any) => ProviderAdapter> = {
  opencode_zen: OpencodeZenAdapter,
  vega_ollama: VegaOllamaAdapter,
  orion_ollama: OrionOllamaAdapter,
  freebuff: FreebuffAdapter,
  opencode_cli: OpencodeCliAdapter,
  freebuff_cli: FreebuffCliAdapter,
  ollama_cloud: OllamaCloudAdapter,
}

export class ProviderOrchestrator {
  private adapters: Map<string, ProviderAdapter> = new Map()
  private config: OrchestratorConfig
  private switchHistory: SwitchLogEntry[] = []
  private requestLog: RequestLogEntry[] = []

  constructor(processEnv: Record<string, string | undefined> = {}) {
    this.config = loadOrchestratorConfig(processEnv)
    this.initializeAdapters(processEnv)
  }

  private initializeAdapters(env: Record<string, string | undefined>): void {
    for (const alias of this.config.priority) {
      const cfg = getProviderConfig(alias)
      if (!cfg) {
        SafeLogger.internal('warn', `Unknown provider alias: ${alias}`)
        continue
      }
      const AdapterClass = ADAPTER_REGISTRY[cfg.internalName]
      if (!AdapterClass) {
        SafeLogger.internal('warn', `No adapter for internal name: ${cfg.internalName}`)
        continue
      }
      const adapter = new AdapterClass(cfg, env)
      this.adapters.set(alias, adapter)
      SafeLogger.internal('info', `Registered adapter: ${alias} -> ${cfg.internalName} (models: ${cfg.models.join(', ')})`)
    }
  }

  resolveActiveProvider(requestedProvider?: string): string {
    if (requestedProvider && requestedProvider !== 'auto' && requestedProvider !== 'eburon-auto') {
      if (this.adapters.has(requestedProvider)) return requestedProvider
      SafeLogger.internal('warn', `Requested provider ${requestedProvider} not registered, falling back to auto`)
    }
    if (this.config.defaultEngineAlias && this.adapters.has(this.config.defaultEngineAlias)) {
      return this.config.defaultEngineAlias
    }
    return this.config.priority[0]
  }

  getAvailableProviders(): string[] { return [...this.adapters.keys()] }
  getProviderCount(): number { return this.adapters.size }
  getSwitchHistory(): SwitchLogEntry[] { return [...this.switchHistory] }
  getRequestLog(): RequestLogEntry[] { return [...this.requestLog] }
  isAutoSwapEnabled(): boolean { return this.config.autoswapEnabled }

  /**
   * Two-level failover:
   *  1. Try each MODEL on the current provider (model swap)
   *  2. If all models fail, move to the NEXT PROVIDER (provider swap)
   *  3. Repeat until a model succeeds or all providers exhausted
   */
  async execute(
    prompt: string,
    context?: LLMContext,
    requestedProvider?: string,
    streamCallback?: (chunk: string, provider: string) => void,
  ): Promise<LLMResponse> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const startAlias = this.resolveActiveProvider(requestedProvider)
    const priority = this.buildPriorityOrder(startAlias)
    const tried: string[] = []
    const errors: Error[] = []

    for (let i = 0; i < priority.length; i++) {
      const alias = priority[i]
      const adapter = this.adapters.get(alias)
      if (!adapter) continue

      tried.push(alias)

      // Check provider availability first
      const isAvailable = await adapter.isAvailable()
      if (!isAvailable) {
        this.logSwitch(alias, undefined, 'provider_unavailable', priority[i + 1], undefined, 'provider', false, 'Provider offline')
        if (priority[i + 1]) SafeLogger.frontend('Eburon AI', BRANDED_MESSAGES.switching)
        continue
      }

      // ── Level 1: Try each model on this provider ──
      const models = adapter.availableModels
      for (let m = 0; m < models.length; m++) {
        const model = models[m]
        if (m > 0) {
          // Swap model on same provider
          adapter.setModel(model)
          SafeLogger.internal('info', `[${alias}] Trying fallback model: ${model}`)
        }

        let engineStart = Date.now()

        try {
          let effectiveContext = context
          if (effectiveContext && (i > 0 || m > 0) && this.config.compressOnSwitch) {
            const ctxTokens = estimateTokens(effectiveContext.messages.map((msg) => msg.content).join('\n'))
            if (ctxTokens > adapter.contextLimit) {
              effectiveContext = compressContext(effectiveContext, adapter.contextLimit)
              SafeLogger.internal('info', `Compressed context ~${ctxTokens} -> ~${adapter.contextLimit} for ${alias}/${model}`)
            }
          }

          engineStart = Date.now()

          if (streamCallback) {
            let fullContent = ''
            for await (const chunk of adapter.stream(prompt, effectiveContext)) {
              fullContent += chunk
              streamCallback(chunk, 'Eburon AI')
            }
            const latency = Date.now() - engineStart
            this.logRequest(requestId, alias, adapter.internalName, model, latency, true)
            return { content: fullContent, tokensUsed: estimateTokens(prompt + fullContent), finishReason: 'stop', modelUsed: 'Eburon AI' }
          }

          const response = await adapter.execute(prompt, effectiveContext)
          const latency = Date.now() - engineStart

          // Log successful switch if not the first attempt
          if (i > 0 || m > 0) {
            const prevAlias = m === 0 ? priority[i - 1] : alias
            const prevModel = m === 0 ? undefined : models[m - 1]
            this.logSwitch(prevAlias, prevModel, this.classifyError('success'), alias, model, m > 0 ? 'model' : 'provider', true)
          }

          this.logRequest(requestId, alias, adapter.internalName, model, latency, true)
          return { ...response, modelUsed: 'Eburon AI' }
        } catch (err: any) {
          errors.push(err)
          const reason = this.classifyError(err.message)

          // Don't failover for these reasons
          if (NO_FAILOVER_REASONS.has(reason) || !this.config.autoswapEnabled) {
            this.logRequest(requestId, alias, adapter.internalName, model, Date.now() - engineStart, false, err.message)
            throw new Error(BRANDED_MESSAGES.unavailable)
          }

          // Log model-level failure, try next model on same provider
          const nextModel = models[m + 1]
          this.logSwitch(alias, model, reason, nextModel ? alias : priority[i + 1], nextModel || undefined, nextModel ? 'model' : 'provider', false, err.message)

          if (nextModel) {
            SafeLogger.frontend('Eburon AI', BRANDED_MESSAGES.switching)
            continue // try next model on same provider
          }

          // All models on this provider failed — move to next provider
          const nextAlias = priority[i + 1]
          if (nextAlias) SafeLogger.frontend('Eburon AI', BRANDED_MESSAGES.switching)
          break
        }
      }
    }

    this.logAllFailed(requestId, tried, errors)
    throw new Error(BRANDED_MESSAGES.allFailed)
  }

  /**
   * Streaming with two-level failover.
   */
  async *stream(
    prompt: string,
    context?: LLMContext,
    requestedProvider?: string,
  ): AsyncGenerator<{ chunk: string; provider: string }, void, undefined> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const startAlias = this.resolveActiveProvider(requestedProvider)
    const priority = this.buildPriorityOrder(startAlias)
    const tried: string[] = []

    for (let i = 0; i < priority.length; i++) {
      const alias = priority[i]
      const adapter = this.adapters.get(alias)
      if (!adapter) continue

      tried.push(alias)

      const isAvailable = await adapter.isAvailable()
      if (!isAvailable) {
        this.logSwitch(alias, undefined, 'provider_unavailable', priority[i + 1], undefined, 'provider', false, 'Provider offline')
        if (priority[i + 1]) SafeLogger.frontend('Eburon AI', BRANDED_MESSAGES.switching)
        continue
      }

      const models = adapter.availableModels
      for (let m = 0; m < models.length; m++) {
        const model = models[m]
        if (m > 0) {
          adapter.setModel(model)
          SafeLogger.internal('info', `[${alias}] Trying fallback model: ${model}`)
        }

        let engineStart = Date.now()

        try {
          let effectiveContext = context
          if (effectiveContext && (i > 0 || m > 0) && this.config.compressOnSwitch) {
            const ctxTokens = estimateTokens(effectiveContext.messages.map((msg) => msg.content).join('\n'))
            if (ctxTokens > adapter.contextLimit) {
              effectiveContext = compressContext(effectiveContext, adapter.contextLimit)
            }
          }

          engineStart = Date.now()
          for await (const chunk of adapter.stream(prompt, effectiveContext)) {
            yield { chunk, provider: 'Eburon AI' }
          }

          const latency = Date.now() - engineStart
          this.logRequest(requestId, alias, adapter.internalName, model, latency, true)

          if (i > 0 || m > 0) {
            const prevAlias = m === 0 ? priority[i - 1] : alias
            const prevModel = m === 0 ? undefined : models[m - 1]
            this.logSwitch(prevAlias, prevModel, this.classifyError('success'), alias, model, m > 0 ? 'model' : 'provider', true)
          }
          return
        } catch (err: any) {
          const reason = this.classifyError(err.message)

          if (NO_FAILOVER_REASONS.has(reason) || !this.config.autoswapEnabled) {
            this.logRequest(requestId, alias, adapter.internalName, model, Date.now() - engineStart, false, err.message)
            throw new Error(BRANDED_MESSAGES.unavailable)
          }

          const nextModel = models[m + 1]
          this.logSwitch(alias, model, reason, nextModel ? alias : priority[i + 1], nextModel || undefined, nextModel ? 'model' : 'provider', false, err.message)

          if (nextModel) {
            SafeLogger.frontend('Eburon AI', BRANDED_MESSAGES.switching)
            continue
          }

          const nextAlias = priority[i + 1]
          if (nextAlias) SafeLogger.frontend('Eburon AI', BRANDED_MESSAGES.switching)
          break
        }
      }
    }

    this.logAllFailed(requestId, tried, [])
    throw new Error(BRANDED_MESSAGES.allFailed)
  }

  async checkAvailability(): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {}
    for (const [alias, adapter] of this.adapters) {
      result[alias] = await adapter.isAvailable()
    }
    return result
  }

  private buildPriorityOrder(startAlias: string): string[] {
    const idx = this.config.priority.indexOf(startAlias)
    if (idx === -1) return this.config.priority
    return [...this.config.priority.slice(idx), ...this.config.priority.slice(0, idx)]
  }

  private classifyError(message: string): FailReason {
    const upper = message.toUpperCase()
    if (upper === 'SUCCESS') return 'task_incomplete' // sentinel for success logging
    if (upper.includes('AUTH') || upper.includes('UNAUTHORIZED') || upper.includes('API_KEY') || upper.includes('401')) return 'authentication_failure'
    if (upper.includes('TOKEN_LIMIT') || upper.includes('MAX_TOKENS')) return 'token_limit'
    if (upper.includes('CONTEXT_WINDOW') || upper.includes('CONTEXT_LENGTH') || upper.includes('TOO_LONG') || upper.includes('CONTEXT_LIMIT')) return 'context_limit'
    if (upper.includes('USAGE_QUOTA') || upper.includes('QUOTA') || upper.includes('EXCEEDED')) return 'usage_quota'
    if (upper.includes('RATE_LIMIT') || upper.includes('RATE LIMITED') || upper.includes('429')) return 'rate_limited'
    if (upper.includes('TIMEOUT') || upper.includes('ABORT')) return 'timeout'
    if (upper.includes('ECONNREFUSED') || upper.includes('ENOTFOUND') || upper.includes('NETWORK') || upper.includes('SOCKET')) return 'network_failure'
    if (upper.includes('EMPTY_RESPONSE') || upper.includes('NO CONTENT')) return 'empty_response'
    if (upper.includes('INVALID_RESPONSE') || upper.includes('PARSE') || upper.includes('JSON')) return 'invalid_response'
    if (upper.includes('PROVIDER_UNAVAILABLE') || upper.includes('UNAVAILABLE') || upper.includes('OFFLINE')) return 'provider_unavailable'
    if (upper.includes('CLI_COMMAND_FAILURE') || upper.includes('COMMAND_FAILED') || upper.includes('ENOENT')) return 'cli_command_failure'
    if (upper.includes('LOCAL') && upper.includes('OFFLINE')) return 'local_route_offline'
    return 'task_incomplete'
  }

  private logSwitch(
    failedAlias: string,
    failedModel: string | undefined,
    reason: FailReason,
    nextAlias: string | undefined,
    nextModel: string | undefined,
    swapType: 'model' | 'provider',
    success: boolean,
    errorDetail?: string,
  ): void {
    const failedInternal = aliasToInternal(failedAlias) || failedAlias
    const nextInternal = nextAlias ? (aliasToInternal(nextAlias) || nextAlias) : 'none'

    const entry: SwitchLogEntry = {
      timestamp: Date.now(),
      failedInternalProvider: failedInternal,
      failedAlias,
      failedModel,
      reason,
      nextInternalProvider: nextInternal,
      nextAlias: nextAlias || 'none',
      nextModel,
      swapType,
      success,
      errorDetail,
    }
    this.switchHistory.push(entry)
    SafeLogger.internal('switch', `${swapType} swap: ${failedAlias}/${failedModel || '-'} -> ${nextAlias || 'none'}/${nextModel || '-'} | reason=${reason} | success=${success}`)
  }

  private logRequest(
    requestId: string,
    alias: string,
    internalName: string,
    model: string,
    latencyMs: number,
    success: boolean,
    error?: string,
  ): void {
    const entry: RequestLogEntry = { requestId, alias, internalName, internalModel: model, latencyMs, success, error, timestamp: Date.now() }
    this.requestLog.push(entry)
    SafeLogger.internal('info', `Request ${requestId} | alias=${alias} | route=${internalName} | model=${model} | latency=${latencyMs}ms | success=${success}`)
  }

  private logAllFailed(requestId: string, tried: string[], errors: Error[]): void {
    SafeLogger.internal('error', `All providers and models exhausted (request ${requestId})`, `Tried: ${tried.join(', ')}`)
    for (const err of errors) SafeLogger.internal('error', `Error: ${err.message}`)
  }
}

let orchestratorInstance: ProviderOrchestrator | null = null

export function getOrchestrator(): ProviderOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ProviderOrchestrator(process.env as Record<string, string | undefined>)
  }
  return orchestratorInstance
}

export function createOrchestrator(env: Record<string, string | undefined>): ProviderOrchestrator {
  orchestratorInstance = new ProviderOrchestrator(env)
  return orchestratorInstance
}

function estimateContext(text: string): number {
  return Math.ceil(text.length / 3.5)
}