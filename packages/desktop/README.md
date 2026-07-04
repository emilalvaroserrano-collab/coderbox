# Eburon CodeBox

**AI coding agent desktop app** — Electron + React + Vite + Zustand + Prisma + PostgreSQL.  
Provider-agnostic LLM interface with auto-failover, Firebase auth, and a branded frontend that hides all real provider/model names.

---

## Features

- **7 provider engines** — local Ollama, cloud Ollama, OpenCode CLI (free models), FreeBuff (via proxy)
- **Auto-failover** — seamless switching on timeout, quota, rate-limit, or unavailability
- **Context compression** — automatic summarisation when switching to a smaller context window
- **Firebase Auth** — email/password and Google sign-in
- **PostgreSQL storage** — threads, messages, memories, skills, and user profiles via Prisma ORM
- **10 failure classifications** — token_limit, context_window_exceeded, usage_quota, rate_limited, timeout, empty_response, invalid_response, provider_unavailable, cli_command_failure, task_incomplete
- **Safe dual logging** — internal logs contain real names; frontend shows only `eburon-*` aliases
- **Streaming responses** — real-time token-by-token output
- **Dark/light theme** — Tailwind CSS with custom `codebox` palette
- **Skills & memory** — Prisma-backed persistent learning across sessions
- **Docker Compose** — one-command PostgreSQL setup with alpine image
- **Google Workspace integration** — Gmail, Calendar, Drive APIs via OAuth 2.0
- **Secure token storage** — OAuth tokens encrypted with Electron `safeStorage`

---

## Google Workspace Integration

The app integrates with Google Workspace APIs (Gmail, Calendar, Drive) using OAuth 2.0 via the `googleapis` npm package. OAuth tokens are encrypted at rest using Electron's `safeStorage` API (macOS Keychain / Windows DPAPI).

### Setup

1. **Add the redirect URI** in Google Cloud Console:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Select your OAuth 2.0 Web Client
   - Add `http://localhost` to **Authorized redirect URIs**
   - Save

2. **Enable the APIs** in Google Cloud Console:
   - Gmail API
   - Google Calendar API
   - Google Drive API

3. **Place the credentials file** at:
   `~/Downloads/client_secret_*.apps.googleusercontent.com.json`
   (the default path the app reads), or set `GOOGLE_OAUTH_CREDENTIALS` env var.

### Auth flow

```
User clicks "Connect Google Workspace"
  → Main process starts local HTTP server on random port
  → User's browser opens Google OAuth consent screen
  → Google redirects to http://localhost:<port> with auth code
  → Main process exchanges code for tokens
  → Tokens encrypted with safeStorage, saved to disk
  → Gmail/Calendar/Drive APIs become available to the agent
```

### IPC API (available via `electronAPI.google.*`)

| Namespace | Methods |
|---|---|
| `auth` | `init(credentialsPath?)`, `authenticate()`, `signOut()`, `isAuthenticated()` |
| `gmail` | `listLabels()`, `listMessages(opts?)`, `getMessage(id)`, `sendMessage(to, subject, body)` |
| `calendar` | `listCalendars()`, `listEvents(opts?)`, `createEvent(opts)` |
| `drive` | `listFiles(opts?)`, `uploadFile(opts)`, `downloadFile(id, dest)`, `createFolder(name, parent?)` |

Renderer wrapper at `src/renderer/lib/google/client.ts` — import `googleService` for safe access.

---

## Auth & data flow

```
User opens app
  → Firebase Auth page (email/password or Google)
  → On success, Firebase UID is sent to Electron main process via IPC
  → Main process upserts User record in PostgreSQL via Prisma
  → Renderer enters main app
  → All threads, messages, memories, and skills are linked to the user
```

Firebase handles authentication entirely in the renderer (web SDK with popup/redirect). The main process never touches Firebase — it only stores the resulting UID and profile in PostgreSQL.

---

## Provider system

All real provider names (OpenAI, Anthropic, Ollama, OpenCode, FreeBuff) and model names are **never exposed to the frontend**. The UI shows only branded `eburon-*` aliases:

| Alias | Display Name | Backend | File |
|---|---|---|---|
| `eburon-sirius` | Eburon Sirius | Local Ollama (qwen3.6) | `opencode-zen.ts` |
| `eburon-vega` | Eburon Vega | Local Ollama (gemma4) | `vega-ollama.ts` |
| `eburon-zen` | Eburon Zen | OpenCode CLI (free) | `opencode-cli.ts` |
| `eburon-breeze` | Eburon Breeze | FreeBuff proxy | `freebuff-cli.ts` |
| `eburon-vortex` | Eburon Vortex | Cloud Ollama | `ollama-cloud.ts` |
| `eburon-orion` | Eburon Orion | Local Ollama (ornith) | `orion-ollama.ts` |
| `eburon-polaris` | Eburon Polaris | Local Ollama (orbit-ai) | `freebuff.ts` |
| `auto` | Auto (Best Available) | Priority-based selection | orchestrator |

---

## Architecture

```
packages/desktop/
  prisma/
    schema.prisma          # 5 models: User, Thread, Message, Memory, Skill
  prisma.config.ts         # Prisma 7 config (reads DATABASE_URL)
  docker-compose.yml       # PostgreSQL 16-alpine

  src/
    main/                  # Electron main process (Node.js)
      index.ts             # App entry, BrowserWindow, IPC handlers (provider + db)
      preload.ts           # contextBridge: exposes electronAPI.db.* and electronAPI.provider.*
      db/index.ts          # PrismaClient singleton
      providers/
        config.ts          # Alias mapping, env parsing, priority
        orchestrator.ts    # Auto-failover engine, context compression
        compressor.ts      # Token estimation & truncation
        logger.ts          # Dual safe/internal logging
        types.ts           # Shared interfaces
        adapters/          # 7 adapter implementations

    renderer/              # React app (Vite-bundled, contextIsolated)
      App.tsx              # Auth gate + main layout
      main.tsx
      lib/
        auth/
          firebase.ts      # Firebase init, email + Google auth
          useAuth.ts       # React hook: auth state + user sync to PostgreSQL
        providers/
          client.ts        # IPC wrapper for provider operations
          types.ts         # Frontend-safe types
        memory.ts          # Prisma-backed MemoryStore
        skills.ts          # Prisma-backed SkillManager
      store/index.ts       # Zustand store
      components/
        auth/AuthPage.tsx  # Login/signup with email + Google
        composer/
        sidebar/
        thread/
        settings/
        ...

  scripts/
    build-main.mjs         # esbuild: compiles main process TS → CJS
```

---

## Prerequisites

- **Node.js 18+**
- **pnpm** — `npm install -g pnpm`
- **Docker** — for PostgreSQL (`docker compose up -d`)
- **Ollama** — for local models (`brew install ollama`)
- **OpenCode CLI** — `npm install -g opencode`
- **FreeBuff (optional)** — `npm install -g freebuff` + freebuff2api proxy

---

## Quick start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Set up the database
cp .env.example .env
# Edit .env: set DATABASE_URL=postgresql://eburon:eburon@localhost:5432/eburon

# 3. Install deps + generate Prisma client
pnpm install

# 4. Push schema to PostgreSQL
pnpm --filter @eburon/desktop exec prisma db push

# 5. Build Electron main process
pnpm --filter @eburon/desktop exec node scripts/build-main.mjs

# 6. Terminal 1: Vite dev server
pnpm --filter @eburon/desktop exec vite --host

# 7. Terminal 2: Launch Electron
DATABASE_URL="postgresql://eburon:eburon@localhost:5432/eburon" \
  VITE_DEV_SERVER_URL=http://localhost:5173 \
  npx electron packages/desktop/dist-electron/main.cjs
```

---

## Database

### Schema (5 models)

```
User      1──N Thread     — chat sessions
Thread    1──N Message    — individual messages
User      1──N Memory     — cross-session learnings
User      1──N Skill      — reusable instruction packs
```

### Commands

```bash
# Generate Prisma client
pnpm --filter @eburon/desktop exec prisma generate

# Push schema changes to an existing database
pnpm --filter @eburon/desktop exec prisma db push

# Create a new migration
pnpm --filter @eburon/desktop exec prisma migrate dev --name description

# Open Prisma Studio (GUI data browser)
pnpm --filter @eburon/desktop exec prisma studio

# Reset the database (drops all data)
pnpm --filter @eburon/desktop exec prisma db push --force-reset
```

### Docker

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: eburon-db
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: eburon
      POSTGRES_PASSWORD: eburon
      POSTGRES_DB: eburon
    volumes:
      - pgdata:/var/lib/postgresql/data
```

---

## Firebase Auth

The app uses **Firebase Authentication** with two providers:

- **Email/password** — standard registration and sign-in
- **Google** — one-click OAuth popup

### Firebase config

Located in `src/renderer/lib/auth/firebase.ts`. To use your own Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project → enable Authentication (Email/Password + Google)
3. Copy your web app config into `firebase.ts`:

```ts
const firebaseConfig = {
  apiKey: 'your-api-key',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.firebasestorage.app',
  messagingSenderId: 'your-sender-id',
  appId: 'your-app-id',
}
```

### Auth flow

1. App boots → Firebase initializes
2. If no user is signed in → `AuthPage` is shown
3. User signs in via email/password or Google
4. On auth state change → `syncUser()` sends the Firebase UID + profile to Electron main process via IPC
5. Main process `db:user:*` handlers upsert the record in PostgreSQL
6. Renderer enters the main app

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LLM_PROVIDER` | No | `auto` or `manual` |
| `PROVIDER_PRIORITY` | No | Comma-separated failover order |
| `OLLAMA_HOST` | No | Local Ollama base URL |
| `OLLAMA_CLOUD_HOST` | No | Remote Ollama base URL |
| `OLLAMA_CLOUD_MODEL` | No | Cloud adapter model |
| `OPENCODE_MODEL` | No | OpenCode CLI model |
| `FREEBUFF_HOST` | No | freebuff2api proxy URL |
| `FREEBUFF_MODEL` | No | FreeBuff model |

No defaults are assumed — configure each as needed.

---

## OpenCode CLI — how it works

OpenCode stores its data at `~/.config/opencode/`:

```
~/.config/opencode/
  config.json            # Provider configs, credentials, model preferences
  sessions.db            # SQLite database of all sessions
  keys.json              # API keys (encrypted at rest)
  plugins/               # Installed plugins
  agents/                # Custom agent definitions
```

When `eburon-zen` uses the OpenCode CLI adapter, it:

1. Spawns `opencode run --format json --model opencode/deepseek-v4-flash-free "<prompt>"`
2. Captures stdout as NDJSON events
3. Parses `type: "text"` events to extract response content
4. Returns the concatenated text as the LLM response

The `deepseek-v4-flash-free` model costs $0 and requires no API key.

---

## Build & package

```bash
# Type check
pnpm --filter @eburon/desktop exec tsc --noEmit

# Development build (main process only)
pnpm --filter @eburon/desktop exec node scripts/build-main.mjs

# Full Vite + Electron build
pnpm --filter @eburon/desktop build

# Package for distribution
pnpm --filter @eburon/desktop package:mac    # → release/*.dmg
pnpm --filter @eburon/desktop package:win    # → release/*.exe
pnpm --filter @eburon/desktop package:linux  # → release/*.AppImage

# Clean generated files
pnpm --filter @eburon/desktop clean
```

---

## Keybindings

| Key | Action |
|---|---|
| `Cmd+B` / `Ctrl+B` | Toggle sidebar |
| `Cmd+J` / `Ctrl+J` | Toggle terminal |
| `Cmd+K` / `Ctrl+K` | New thread |
| `Cmd+,` / `Ctrl+,` | Open settings |

---

## License

MIT
