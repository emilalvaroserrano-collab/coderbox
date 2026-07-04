# Eburon CodeBox

An Electron-based desktop AI coding agent with a hidden provider system, automatic failover (AutoSwap), and an agent orchestrator watchdog.

## Quick Start

```bash
# Clone
git clone https://github.com/emilalvaroserrano-collab/coderbox.git
cd coderbox

# One-command install (installs everything)
bash bootstrap.sh

# Start the app
pnpm dev                    # Terminal 1: Vite dev server
# Terminal 2:
VITE_DEV_SERVER_URL=http://localhost:5173 \
  npx electron packages/desktop/dist-electron/main.cjs --no-sandbox
```

## What bootstrap.sh Installs

| Component | Purpose |
|---|---|
| Node.js 22 | JavaScript runtime |
| pnpm | Package manager |
| Python 3 | For Freebuff2API proxy |
| Git | Version control |
| Ollama | Local LLM server (GPU-backed) |
| OpenCode CLI | Free AI models gateway |
| Freebuff CLI + Freebuff2API | Free, ad-supported AI proxy |
| Gemini CLI | Google AI (optional) |
| Codex CLI | OpenAI Codex (optional) |
| Hermes Agent | Self-improving AI agent (optional) |
| browser-act | Browser automation (optional) |
| Electron | Desktop app runtime |
| xvfb, libnss3, etc. | System libs for Electron |

## Architecture

```
packages/desktop/src/
  main/                    # Electron main process
    providers/
      config.ts            # Alias → internal provider mapping (backend-only)
      orchestrator.ts      # Two-level AutoSwap: model swap, then provider swap
      agent-orchestrator.ts # Watchdog: monitors/restarts agents via local Ollama
      logger.ts            # SafeLogger: branded messages only
      adapters/            # Provider adapters (Ollama, OpenCode, Freebuff, etc.)
    index.ts               # IPC handlers (sanitized for public, full for admin)
    preload.ts             # Context bridge (provider + admin APIs)
  renderer/                # React frontend (Vite)
    components/
      composer/             # Input area with file/folder attach
      sidebar/             # Navigation
      thread/              # Chat canvas
      settings/            # Preferences
    store/                 # Zustand store
    lib/
      providers/           # Frontend-safe provider client (aliases only)
```

## Hidden AutoSwap Provider System

The public UI only shows **"Eburon AI"**. No provider or model names are ever exposed to users.

### Public Aliases (what users see)
- `eburon-auto` — Let the backend pick
- `eburon-fast` — Fast/lightweight
- `eburon-code` — Code-optimized
- `eburon-reasoning` — Deep reasoning
- `eburon-vision` — Vision/multimodal
- `eburon-local` — Local-only
- `eburon-cloud` — Cloud-backed
- `eburon-backup` — Fallback

### Two-Level Failover

1. **Model swap** — Try alternative models on the same provider
2. **Provider swap** — If all models on a provider fail, switch to the next provider

### Failover Triggers
- Authentication failure
- Rate limit (429)
- Quota exceeded
- Timeout
- Network/provider failure
- Empty or invalid response
- Context limit exceeded
- CLI command failure
- Local route offline

### No Failover For
- User cancellation
- Invalid request
- Permission errors
- Unsupported uploads
- Frontend validation failures

## Agent Orchestrator

A watchdog that monitors all running agents and restarts them when they crash. Uses a **locally-hosted Ollama model** (`ornith:9b`) to decide restart strategy — so it can never fail due to network outages.

| Agent | Health Check | Critical |
|---|---|---|
| Ollama | `http://127.0.0.1:11435/api/tags` | Yes (never gives up) |
| OpenCode Server | `http://localhost:8765/health` | No |
| Freebuff2API | `http://127.0.0.1:8000/v1/models` | No |

Restart strategies (decided by local AI):
- `restart` — Start again
- `restart_with_clean_state` — Kill lingering process, start fresh
- `wait_and_retry` — Wait 10s, then restart
- `give_up` — Stop trying (non-critical only)

## Configuration

See `.env.example` for all environment variables. Key settings:

```bash
# AutoSwap (enabled by default)
LLM_PROVIDER=auto
AUTOSWAP_ENABLED=true

# Agent Orchestrator (local model, never cloud)
AGENT_ORCHESTRATOR_OLLAMA_URL=http://127.0.0.1:11435
AGENT_ORCHESTRATOR_MODEL=ornith:9b

# Optional API keys
GROQ_API_KEY=          # https://console.groq.com/keys
GOOGLE_GENERATIVE_AI_API_KEY=  # https://aistudio.google.com/apikey
OPENROUTER_API_KEY=    # https://openrouter.ai/keys
```

## Development

```bash
# Start Vite dev server
pnpm dev

# Build main process
pnpm build:main

# Typecheck
pnpm --filter @eburon/desktop exec tsc --noEmit

# Build production
pnpm build

# Package for distribution
pnpm package
```

## Admin Panel

Admin-only IPC endpoints (accessed via `window.electronAPI.admin`):
- `getProviderStatus()` — Full internal details (route, model, health)
- `getSwitchHistory()` — Failover log with internal names
- `getRequestLog()` — Request ID, alias, route, model, latency
- `testRoute(alias)` — Test a specific engine
- `getAgentStatus()` — All monitored agents
- `restartAgent(id)` — Manually restart an agent

## License

MIT