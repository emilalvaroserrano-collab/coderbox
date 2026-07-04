/**
 * AgentOrchestrator — Watchdog for all running agents.
 *
 * Monitors agent health, restarts crashed agents, and uses a
 * locally-hosted Ollama model to make restart-strategy decisions.
 *
 * Because the decision model runs on localhost (no network dependency),
 * the orchestrator itself can never fail due to external outages.
 */

import { spawn, ChildProcess } from 'child_process'
import { SafeLogger } from './logger'

const OLLAMA_URL = process.env.AGENT_ORCHESTRATOR_OLLAMA_URL || 'http://127.0.0.1:11435'
const ORCHESTRATOR_MODEL = process.env.AGENT_ORCHESTRATOR_MODEL || 'ornith:9b'
const HEALTH_CHECK_INTERVAL_MS = parseInt(process.env.AGENT_ORCHESTRATOR_INTERVAL || '15000', 10)
const MAX_RESTART_ATTEMPTS = 5
const RESTART_COOLDOWN_MS = 30000

export interface AgentConfig {
  /** Unique identifier for this agent */
  id: string
  /** Human-readable name (internal only, never shown to users) */
  name: string
  /** Command to start the agent */
  command: string[]
  /** Working directory for the agent */
  cwd?: string
  /** Environment variables for the agent */
  env?: Record<string, string>
  /** Health check URL (HTTP GET must return 200) */
  healthUrl?: string
  /** Health check command (exit 0 = healthy) */
  healthCommand?: string[]
  /** Whether this agent should auto-restart on failure (default: true) */
  autoRestart?: boolean
  /** Whether this agent is critical (orchestrator won't give up) */
  critical?: boolean
}

export interface AgentStatus {
  id: string
  pid: number | null
  status: 'running' | 'stopped' | 'restarting' | 'failed'
  restartCount: number
  lastHealthCheck: number
  lastError?: string
  startedAt: number | null
  uptime: number
}

class AgentOrchestrator {
  private agents: Map<string, { config: AgentConfig; process: ChildProcess | null; status: AgentStatus; restartAttempts: number; lastRestart: number }> = new Map()
  private healthTimer: NodeJS.Timeout | null = null
  private isChecking = false

  /**
   * Register an agent for monitoring.
   * If the agent is not already running, it will be started.
   */
  register(config: AgentConfig): void {
    if (this.agents.has(config.id)) {
      SafeLogger.internal('warn', `[orchestrator] Agent ${config.id} already registered`)
      return
    }

    this.agents.set(config.id, {
      config,
      process: null,
      status: {
        id: config.id,
        pid: null,
        status: 'stopped',
        restartCount: 0,
        lastHealthCheck: 0,
        startedAt: null,
        uptime: 0,
      },
      restartAttempts: 0,
      lastRestart: 0,
    })

    SafeLogger.internal('info', `[orchestrator] Registered agent: ${config.id} (${config.name})`)
    this.startAgent(config.id)
  }

  /**
   * Start the health monitoring loop.
   */
  start(): void {
    if (this.healthTimer) return
    SafeLogger.internal('info', `[orchestrator] Health monitoring started (interval: ${HEALTH_CHECK_INTERVAL_MS}ms)`)
    this.healthTimer = setInterval(() => this.checkAllHealth(), HEALTH_CHECK_INTERVAL_MS)
  }

  /**
   * Stop monitoring (agents keep running).
   */
  stop(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
      SafeLogger.internal('info', `[orchestrator] Health monitoring stopped`)
    }
  }

  /**
   * Get status of all registered agents.
   */
  getStatus(): AgentStatus[] {
    const statuses: AgentStatus[] = []
    for (const [, entry] of this.agents) {
      const s = { ...entry.status }
      if (entry.status.startedAt) {
        s.uptime = Date.now() - entry.status.startedAt
      }
      statuses.push(s)
    }
    return statuses
  }

  /**
   * Manually restart a specific agent.
   */
  async restart(agentId: string): Promise<boolean> {
    const entry = this.agents.get(agentId)
    if (!entry) return false

    SafeLogger.internal('info', `[orchestrator] Manual restart requested for ${agentId}`)
    return this.restartAgent(agentId)
  }

  /**
   * Start an agent process.
   */
  private startAgent(agentId: string): boolean {
    const entry = this.agents.get(agentId)
    if (!entry) return false

    const { config } = entry

    try {
      const proc = spawn(config.command[0], config.command.slice(1), {
        cwd: config.cwd,
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      })

      entry.process = proc
      entry.status.pid = proc.pid ?? null
      entry.status.status = 'running'
      entry.status.startedAt = Date.now()
      entry.status.lastError = undefined
      entry.restartAttempts = 0

      SafeLogger.internal('info', `[orchestrator] Started ${agentId} (PID: ${proc.pid})`)

      proc.on('exit', (code, signal) => {
        SafeLogger.internal('warn', `[orchestrator] ${agentId} exited (code: ${code}, signal: ${signal})`)
        entry.status.status = 'stopped'
        entry.status.pid = null

        if (config.autoRestart !== false && code !== 0) {
          // Auto-restart on non-zero exit
          this.restartAgent(agentId).catch((err) => {
            SafeLogger.internal('error', `[orchestrator] Failed to restart ${agentId}: ${err.message}`)
          })
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) SafeLogger.internal('warn', `[orchestrator] ${agentId} stderr: ${msg.slice(0, 200)}`)
      })

      return true
    } catch (err: any) {
      SafeLogger.internal('error', `[orchestrator] Failed to start ${agentId}: ${err.message}`)
      entry.status.status = 'failed'
      entry.status.lastError = err.message
      return false
    }
  }

  /**
   * Restart an agent with cooldown and attempt limits.
   * Uses the local Ollama model to decide the restart strategy.
   */
  private async restartAgent(agentId: string): Promise<boolean> {
    const entry = this.agents.get(agentId)
    if (!entry) return false

    const now = Date.now()
    const { config, status } = entry

    // Cooldown check
    if (now - entry.lastRestart < RESTART_COOLDOWN_MS) {
      SafeLogger.internal('warn', `[orchestrator] ${agentId} restart on cooldown (${Math.ceil((RESTART_COOLDOWN_MS - (now - entry.lastRestart)) / 1000)}s left)`)
      return false
    }

    // Max attempts check
    if (entry.restartAttempts >= MAX_RESTART_ATTEMPTS) {
      if (config.critical) {
        // Critical agents never give up — reset and keep trying
        SafeLogger.internal('warn', `[orchestrator] ${agentId} exceeded max restarts but is critical — resetting counter`)
        entry.restartAttempts = 0
      } else {
        SafeLogger.internal('error', `[orchestrator] ${agentId} exceeded max restart attempts (${MAX_RESTART_ATTEMPTS}) — giving up`)
        status.status = 'failed'
        return false
      }
    }

    entry.restartAttempts++
    entry.lastRestart = now
    status.status = 'restarting'

    // Ask the local Ollama model for restart strategy
    const strategy = await this.getRestartStrategy(agentId, status.lastError || 'unknown')

    SafeLogger.internal('info', `[orchestrator] Restart strategy for ${agentId}: ${strategy.action} (reason: ${strategy.reason})`)

    // Apply strategy
    switch (strategy.action) {
      case 'restart':
        return this.startAgent(agentId)

      case 'restart_with_clean_state':
        // Kill any lingering process, then restart
        if (entry.process) {
          try { entry.process.kill('SIGKILL') } catch {}
          entry.process = null
        }
        await new Promise((r) => setTimeout(r, 2000))
        return this.startAgent(agentId)

      case 'wait_and_retry':
        await new Promise((r) => setTimeout(r, 10000))
        return this.startAgent(agentId)

      case 'give_up':
        SafeLogger.internal('error', `[orchestrator] Giving up on ${agentId}: ${strategy.reason}`)
        status.status = 'failed'
        return false

      default:
        return this.startAgent(agentId)
    }
  }

  /**
   * Ask the local Ollama model to decide the restart strategy.
   * This is LOCAL ONLY — no network dependency, can never fail due to outages.
   */
  private async getRestartStrategy(agentId: string, lastError: string): Promise<{ action: string; reason: string }> {
    const prompt = `You are an agent orchestrator. An agent named "${agentId}" has crashed.

Last error: ${lastError.slice(0, 500)}
Restart attempts so far: ${this.agents.get(agentId)?.restartAttempts || 0}

Choose ONE action: restart, restart_with_clean_state, wait_and_retry, or give_up.
Respond in JSON only: {"action": "...", "reason": "..."}`

    try {
      const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ORCHESTRATOR_MODEL,
          prompt,
          stream: false,
          options: { num_ctx: 2048, temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) throw new Error(`Ollama returned ${res.status}`)

      const data = await res.json() as { response?: string }
      const text = data.response || ''

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          action: parsed.action || 'restart',
          reason: parsed.reason || 'no reason given',
        }
      }

      // Fallback: simple keyword matching
      if (text.toLowerCase().includes('give_up') || text.toLowerCase().includes('give up')) {
        return { action: 'give_up', reason: 'model suggested giving up' }
      }
      if (text.toLowerCase().includes('wait')) {
        return { action: 'wait_and_retry', reason: 'model suggested waiting' }
      }
      if (text.toLowerCase().includes('clean')) {
        return { action: 'restart_with_clean_state', reason: 'model suggested clean restart' }
      }
      return { action: 'restart', reason: 'default: restart' }
    } catch (err: any) {
      // If even the local Ollama fails, fall back to simple restart
      SafeLogger.internal('warn', `[orchestrator] Local model unavailable (${err.message}) — using default restart`)
      return { action: 'restart', reason: 'local model unavailable, defaulting to restart' }
    }
  }

  /**
   * Check health of all registered agents.
   */
  private async checkAllHealth(): Promise<void> {
    if (this.isChecking) return
    this.isChecking = true

    const checks: Promise<void>[] = []
    for (const [agentId, entry] of this.agents) {
      checks.push(this.checkAgentHealth(agentId, entry))
    }

    await Promise.all(checks)
    this.isChecking = false
  }

  /**
   * Check health of a single agent.
   */
  private async checkAgentHealth(
    agentId: string,
    entry: { config: AgentConfig; process: ChildProcess | null; status: AgentStatus; restartAttempts: number; lastRestart: number },
  ): Promise<void> {
    const { config, status } = entry
    status.lastHealthCheck = Date.now()

    // Check if process is alive
    if (!entry.process || entry.process.killed) {
      if (config.autoRestart !== false && status.status !== 'restarting') {
        SafeLogger.internal('warn', `[orchestrator] ${agentId} process dead — triggering restart`)
        await this.restartAgent(agentId)
      }
      return
    }

    // HTTP health check
    if (config.healthUrl) {
      try {
        const res = await fetch(config.healthUrl, {
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) {
          SafeLogger.internal('warn', `[orchestrator] ${agentId} health check failed: HTTP ${res.status}`)
          if (config.autoRestart !== false) {
            await this.restartAgent(agentId)
          }
        }
      } catch (err: any) {
        SafeLogger.internal('warn', `[orchestrator] ${agentId} health check error: ${err.message}`)
        // Only restart if the process is truly dead, not just health endpoint down
        if (entry.process.killed || entry.process.exitCode !== null) {
          await this.restartAgent(agentId)
        }
      }
    }

    // Command health check
    if (config.healthCommand) {
      try {
        const { execFile } = await import('child_process')
        const result = await new Promise<number>((resolve) => {
          const proc = execFile(config.healthCommand![0], config.healthCommand!.slice(1), { timeout: 5000 }, (err) => {
            resolve(err ? 1 : 0)
          })
          proc.on('exit', (code) => resolve(code ?? 1))
        })
        if (result !== 0) {
          SafeLogger.internal('warn', `[orchestrator] ${agentId} health command failed (exit ${result})`)
          if (config.autoRestart !== false) {
            await this.restartAgent(agentId)
          }
        }
      } catch {
        // Health command failed — try restart if process is dead
      }
    }
  }
}

// Singleton
let orchestratorInstance: AgentOrchestrator | null = null

export function getAgentOrchestrator(): AgentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestrator()
  }
  return orchestratorInstance
}

/**
 * Default agent configurations for this machine.
 * These map the known running agents to their restart commands.
 */
export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'ollama',
    name: 'Ollama LLM Server',
    command: ['/tmp/ollama-runtime/bin/ollama', 'serve'],
    env: { OLLAMA_HOST: '127.0.0.1:11435', OLLAMA_MODELS: '/storage/ollama' },
    healthUrl: 'http://127.0.0.1:11435/api/tags',
    autoRestart: true,
    critical: true,
  },
  {
    id: 'opencode-server',
    name: 'OpenCode Server',
    command: ['opencode', 'serve', '--hostname', '0.0.0.0', '--port', '8765'],
    healthUrl: 'http://localhost:8765/health',
    autoRestart: true,
    critical: false,
  },
  {
    id: 'freebuff2api',
    name: 'Freebuff2API Proxy',
    command: ['/home/ubuntu26/.openbuff/freebuff2api/.venv/bin/python', 'main.py'],
    cwd: '/home/ubuntu26/.openbuff/freebuff2api',
    healthUrl: 'http://127.0.0.1:8000/v1/models',
    autoRestart: true,
    critical: false,
  },
]