import { BaseAdapter } from './base'
import { ProviderConfig } from '../types'

export class VegaOllamaAdapter extends BaseAdapter {
  constructor(config: ProviderConfig, env: Record<string, string | undefined> = {}) {
    super(config, env)
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) return false
      const data = await res.json()
      const models: string[] = (data.models || []).map((m: any) => m.name)
      return models.includes(this.ollamaModel)
    } catch {
      return false
    }
  }
}
