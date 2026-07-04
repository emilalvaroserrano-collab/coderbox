import { SwitchLogEntry, FailReason } from './types'
import { internalToAlias } from './config'

export type LogLevel = 'info' | 'warn' | 'error' | 'switch'

interface InternalLogEntry {
  timestamp: number
  level: LogLevel
  internalMessage: string
  safeMessage: string
  alias?: string
}

const internalLogs: InternalLogEntry[] = []
const switchLogs: SwitchLogEntry[] = []

/**
 * SafeLogger — all messages that reach the frontend use branded "Eburon AI" name.
 * Internal logs keep provider/alias details for admin debugging only.
 *
 * Never log: API keys, secrets, passwords, tokens, or full sensitive prompts.
 */
export class SafeLogger {
  static internal(level: LogLevel, internalMessage: string, safeMessage?: string, alias?: string): void {
    const entry: InternalLogEntry = {
      timestamp: Date.now(),
      level,
      internalMessage,
      safeMessage: safeMessage || internalMessage,
      alias,
    }
    internalLogs.push(entry)
    console.log(`[provider:internal] [${level}] ${internalMessage}`)
  }

  /**
   * frontend() — emits a message visible to the user.
   * Always uses "Eburon AI" branding, never exposes provider/model names.
   */
  static frontend(_alias: string, message: string): void {
    console.log(`[provider:Eburon AI] ${message}`)
  }

  static switch(
    failedAlias: string,
    reason: FailReason,
    nextAlias: string,
    success: boolean,
    errorDetail?: string,
  ): void {
    const entry: SwitchLogEntry = {
      timestamp: Date.now(),
      failedInternalProvider: failedAlias,
      failedAlias,
      reason,
      nextInternalProvider: nextAlias,
      nextAlias,
      swapType: 'provider',
      success,
      errorDetail,
    }
    switchLogs.push(entry)

    console.log(
      `[provider:switch] ${failedAlias} -> ${nextAlias} | reason=${reason} | success=${success}`,
    )
  }

  static getSwitchLogs(): SwitchLogEntry[] {
    return [...switchLogs]
  }

  static getInternalLogs(): InternalLogEntry[] {
    return [...internalLogs]
  }

  /**
   * @deprecated Use BRANDED_MESSAGES from orchestrator instead
   */
  static getAllFailedSafeMessage(_aliases: string[]): string {
    return 'Eburon AI is temporarily unavailable. Please try again shortly.'
  }

  static clear(): void {
    internalLogs.length = 0
    switchLogs.length = 0
  }
}