import { ChildProcess } from 'child_process'

export type ProviderStatus = 'available' | 'unavailable' | 'rate_limited' | 'quota_exceeded' | 'timeout'

export type FailReason =
  | 'authentication_failure'
  | 'token_limit'
  | 'context_window_exceeded'
  | 'usage_quota'
  | 'rate_limited'
  | 'timeout'
  | 'network_failure'
  | 'empty_response'
  | 'invalid_response'
  | 'context_limit'
  | 'provider_unavailable'
  | 'cli_command_failure'
  | 'local_route_offline'
  | 'task_incomplete'

export interface LLMContext {
  messages: { role: string; content: string }[]
  systemPrompt?: string
  maxTokens?: number
}

export interface LLMResponse {
  content: string
  tokensUsed?: number
  finishReason?: string
  modelUsed?: string
}

export interface ProviderInfo {
  status: ProviderStatus
  contextLimit: number
  lastError?: string
  lastUsed?: number
}

export interface SwitchLogEntry {
  timestamp: number
  failedInternalProvider: string
  failedAlias: string
  failedModel?: string
  reason: FailReason
  nextInternalProvider: string
  nextAlias: string
  nextModel?: string
  /** Whether this was a model-only swap (same provider) or a provider swap */
  swapType: 'model' | 'provider'
  success: boolean
  errorDetail?: string
}

export interface RequestLogEntry {
  requestId: string
  alias: string
  internalName: string
  internalModel?: string
  latencyMs: number
  success: boolean
  error?: string
  timestamp: number
}

export interface OrchestratorConfig {
  defaultMode: 'auto' | string
  priority: string[]
  maxRetries: number
  maxContextForFallback: number
  compressOnSwitch: boolean
  autoswapEnabled: boolean
  defaultEngineAlias: string
}

export interface ProviderAdapter {
  readonly internalName: string
  readonly alias: string
  readonly displayName: string
  readonly contextLimit: number
  isAvailable(): Promise<boolean>
  execute(prompt: string, context?: LLMContext): Promise<LLMResponse>
  stream(prompt: string, context?: LLMContext): AsyncGenerator<string, void, undefined>
}

export interface ProviderConfig {
  alias: string
  internalName: string
  displayName: string
  contextLimit: number
  timeout: number
  env: Record<string, string>
  /**
   * Models available on this provider, tried in order.
   * The first entry is the primary model; subsequent entries are
   * fallback models on the SAME provider endpoint.
   *
   * Each model string is the raw identifier the provider API expects
   * (e.g. "qwen3.6:latest", "deepseek/deepseek-v4-flash", …).
   * These never cross the IPC boundary — they stay backend-only.
   */
  models: string[]
  cliCommand?: string
  cliArgs?: string[]
}

export interface ProviderAdapter {
  readonly internalName: string
  readonly alias: string
  readonly displayName: string
  readonly contextLimit: number
  /** Currently active model on this provider */
  readonly currentModel: string
  /** All models configured for this provider */
  readonly availableModels: string[]
  isAvailable(): Promise<boolean>
  /** Swap to a different model on this same provider endpoint */
  setModel(model: string): void
  execute(prompt: string, context?: LLMContext): Promise<LLMResponse>
  stream(prompt: string, context?: LLMContext): AsyncGenerator<string, void, undefined>
}

/**
 * Reasons that should NOT trigger failover.
 * The orchestrator aborts immediately for these.
 */
export const NO_FAILOVER_REASONS: ReadonlySet<string> = new Set([
  'user_cancellation',
  'invalid_request',
  'permission_error',
  'unsupported_upload',
  'frontend_validation',
])
