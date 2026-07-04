import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

let prisma: PrismaClient | null = null

function findEnvPath(): string | null {
  const candidates = [
    resolve(__dirname, '../.env'),
    resolve(process.cwd(), 'packages/desktop/.env'),
    resolve(process.cwd(), '.env'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

export function getDb(): PrismaClient {
  if (!prisma) {
    const envPath = findEnvPath()
    if (envPath) {
      const content = readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim()
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
    writeFileSync('/tmp/prisma-debug.log', JSON.stringify({
      envFound: !!envPath,
      envPath,
      DATABASE_URL: process.env.DATABASE_URL || '(not set)',
      cwd: process.cwd(),
      dirname: __dirname,
    }, null, 2))
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://eburon:eburon@localhost:5433/eburon'
    }
    prisma = new PrismaClient()
  }
  return prisma
}

export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}
