import { ProviderConfig, OrchestratorConfig } from './types'

/**
 * ALIAS_CONFIG — Backend-only mapping of public aliases to internal providers.
 *
 * The public UI only sees generic aliases like `eburon-auto`, `eburon-fast`,
 * `eburon-code`, etc.  The actual provider/model names (`opencode_zen`,
 * `vega_ollama`, `qwen3.6:latest`, …) MUST NEVER cross this boundary.
 *
 * `eburon-auto` is a virtual alias — it is not in this map.  The orchestrator
 * resolves it to the first available engine in priority order.
 */
const ALIAS_CONFIG: Record<string, ProviderConfig> = {
  'eburon-fast': {
    alias: 'eburon-fast',
    internalName: 'orion_ollama',
    displayName: 'Eburon Fast',
    contextLimit: 32000,
    timeout: 60000,
    env: {
      OLLAMA_MODEL: 'ornith:9b',
    },
    models: ['ornith:9b', 'qwen3.6:latest', 'gemma4:e4b'],
  },
  'eburon-code': {
    alias: 'eburon-code',
    internalName: 'opencode_cli',
    displayName: 'Eburon Code',
    contextLimit: 128000,
    timeout: 120000,
    env: {
      OPENCODE_MODEL: 'opencode/deepseek-v4-flash-free',
    },
    models: [
      'opencode/deepseek-v4-flash-free',
      'opencode/deepseek-v4-pro',
      'groq/llama-3.3-70b-versatile',
      'openrouter/qwen/qwen3-coder:free',
    ],
  },
  'eburon-reasoning': {
    alias: 'eburon-reasoning',
    internalName: 'opencode_zen',
    displayName: 'Eburon Reasoning',
    contextLimit: 128000,
    timeout: 180000,
    env: {
      OLLAMA_MODEL: 'qwen3.6:latest',
    },
    models: ['qwen3.6:latest', 'gemma4:e4b', 'llava:7b'],
  },
  'eburon-vision': {
    alias: 'eburon-vision',
    internalName: 'vega_ollama',
    displayName: 'Eburon Vision',
    contextLimit: 64000,
    timeout: 120000,
    env: {
      OLLAMA_MODEL: 'llava:7b',
    },
    models: ['llava:7b', 'qwen3.6:latest'],
  },
  'eburon-local': {
    alias: 'eburon-local',
    internalName: 'freebuff',
    displayName: 'Eburon Local',
    contextLimit: 8000,
    timeout: 60000,
    env: {
      OLLAMA_MODEL: 'orbit-ai:latest',
    },
    models: ['orbit-ai:latest', 'ornith:9b'],
  },
  'eburon-cloud': {
    alias: 'eburon-cloud',
    internalName: 'ollama_cloud',
    displayName: 'Eburon Cloud',
    contextLimit: 128000,
    timeout: 180000,
    env: {
      OLLAMA_CLOUD_MODEL: 'qwen3.6:latest',
      OLLAMA_CLOUD_HOST: 'http://localhost:11434',
    },
    models: ['qwen3.6:latest', 'gemma4:e4b', 'llava:7b'],
  },
  'eburon-backup': {
    alias: 'eburon-backup',
    internalName: 'freebuff_cli',
    displayName: 'Eburon Backup',
    contextLimit: 64000,
    timeout: 90000,
    env: {
      FREEBUFF_MODEL: 'deepseek/deepseek-v4-flash',
      FREEBUFF_HOST: 'http://localhost:8000',
    },
    models: [
      'deepseek/deepseek-v4-flash',
      'deepseek/deepseek-v4-pro',
      'moonshotai/kimi-k2.6',
      'mimo/mimo-v2.5',
    ],
  },
}

/**
 * The canonical public alias list exposed to the UI.
 * `eburon-auto` is always first — it is the default and means
 * "let the backend pick the best engine."
 */
export const PUBLIC_ALIASES = [
  'eburon-auto',
  'eburon-fast',
  'eburon-code',
  'eburon-reasoning',
  'eburon-vision',
  'eburon-local',
  'eburon-cloud',
  'eburon-backup',
] as const

export function getProviderConfig(alias: string): ProviderConfig | undefined {
  return ALIAS_CONFIG[alias]
}

export function getAllAliases(): string[] {
  return Object.keys(ALIAS_CONFIG)
}

export function getAllConfigs(): ProviderConfig[] {
  return Object.values(ALIAS_CONFIG)
}

export function aliasToInternal(alias: string): string | undefined {
  return ALIAS_CONFIG[alias]?.internalName
}

export function internalToAlias(internalName: string): string | undefined {
  for (const cfg of Object.values(ALIAS_CONFIG)) {
    if (cfg.internalName === internalName) return cfg.alias
  }
  return undefined
}

/**
 * Load orchestrator configuration from environment.
 *
 * Env vars (all optional):
 *   LLM_PROVIDER          — 'auto' (default) or a specific alias
 *   AUTOSWAP_ENABLED      — 'true' (default) enables automatic failover
 *   DEFAULT_ENGINE_ALIAS  — alias used when LLM_PROVIDER=auto (default: first in priority)
 *   PROVIDER_PRIORITY     — comma-separated alias order
 */
export function loadOrchestratorConfig(env: Record<string, string | undefined>): OrchestratorConfig {
  const defaultPriority = ['eburon-reasoning', 'eburon-code', 'eburon-fast', 'eburon-vision', 'eburon-cloud', 'eburon-local', 'eburon-backup']
  const envPriority = env['PROVIDER_PRIORITY']
  const priority = envPriority
    ? envPriority.split(',').map((s) => s.trim()).filter((a) => ALIAS_CONFIG[a])
    : defaultPriority

  const autoswapEnabled = env['AUTOSWAP_ENABLED'] !== 'false'
  const defaultEngineAlias = env['DEFAULT_ENGINE_ALIAS'] || priority[0] || 'eburon-reasoning'

  return {
    defaultMode: env['LLM_PROVIDER'] || 'auto',
    priority: priority.length > 0 ? priority : defaultPriority,
    maxRetries: priority.length,
    maxContextForFallback: 32000,
    compressOnSwitch: true,
    autoswapEnabled,
    defaultEngineAlias,
  }
}

export function mergeProviderEnv(
  config: ProviderConfig,
  processEnv: Record<string, string | undefined>,
): Record<string, string> {
  const merged: Record<string, string> = { ...config.env }
  for (const key of Object.keys(processEnv)) {
    const val = processEnv[key]
    if (val !== undefined) merged[key] = val
  }
  return merged
}