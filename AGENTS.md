# AGENTS.md

## Project

Eburon Codebox — Electron desktop AI coding agent using the OpenCode server engine.

## Commands

```
pnpm dev                       # vite dev server only
pnpm --filter @eburon/desktop exec vite --host  # equivalent
```

To launch the full Electron app in dev mode:
```
# Terminal 1: Start Vite dev server
pnpm --filter @eburon/desktop exec vite --host

# Terminal 2: Build main process, then start Electron
pnpm --filter @eburon/desktop exec node scripts/build-main.mjs
VITE_DEV_SERVER_URL=http://localhost:5173 npx electron packages/desktop/dist-electron/main.cjs
```

```
pnpm build:main                # compile main process TS → CJS (esbuild)
pnpm build                     # vite build then package with electron-builder
pnpm package                   # electron-builder only (requires prior vite build)
```

All commands run from repo root. They delegate to `@eburon/desktop` via `pnpm --filter`.

Run a single file typecheck:
```
pnpm --filter @eburon/desktop exec tsc --noEmit
```

There are no tests, linters, or formatters configured.

## Architecture

Single-package pnpm monorepo. The only package is `packages/desktop/`.

```
packages/desktop/src/
  main/             # Electron main process (BrowserWindow, IPC, custom protocol)
    providers/      # Provider adapter system (hidden from frontend)
      adapters/     # 8 provider adapters: opencode-zen, vega-ollama, orion-ollama, freebuff, freebuff-cli, ollama-cloud, opencode-cli, base
  renderer/         # React app (Vite-bundled)
    store/          # Single Zustand store — all app state lives here
    lib/            # engine.ts (OpenCode client), skills.ts, memory.ts, ollama.ts, model-router.ts
      providers/    # Frontend-safe provider client (only eburon- aliases exposed)
    components/     # Feature folders: composer, sidebar, thread, panel, tools, settings, skills, automations
```

The `@/*` path alias resolves to `src/renderer/` — configured in both `tsconfig.json` and `vite.config.ts`.

## Provider System

The app uses a provider-agnostic LLM system. All real provider/model names are hidden from the frontend. The frontend only sees `eburon-` aliases:

| Frontend Alias | Display Name |
|---|---|
| `eburon-sirius` | Eburon Sirius |
| `eburon-vega` | Eburon Vega |
| `eburon-orion` | Eburon Orion |
| `eburon-polaris` | Eburon Polaris |
| `auto` | Auto (Best Available) |

**Default mode:** `LLM_PROVIDER=auto` — automatically picks the best available engine.

**Priority:** Configured via `PROVIDER_PRIORITY` env var (comma-separated aliases). Default:
```
PROVIDER_PRIORITY=eburon-sirius,eburon-vega,eburon-orion,eburon-polaris
```

**Auto-switching:** If a provider fails (token limit, quota, timeout, unavailable), the orchestrator automatically switches to the next in priority. Context is compressed when switching to a lower-capacity engine. The frontend sees only safe messages like: `eburon-sirius reached its limit. Switching to eburon-vega.`

**Provider adapters reside in `src/main/providers/adapters/`** and are compiled into the Electron main process via `scripts/build-main.mjs` (esbuild). The renderer communicates via IPC through the preload bridge. Only `eburon-` alias names cross the IPC boundary.

## External dependencies at runtime

- **OpenCode server** on `localhost:4096` — used by the Sirius engine.
- **Ollama** on `localhost:11434` — local model backend used by Vega and Orion engines.

## State management

One Zustand store (`src/renderer/store/index.ts`). Do not introduce React Context or additional state libraries. The store is the single source of truth for threads, messages, skills, models, and UI toggles.

## Styling

Tailwind CSS with `darkMode: 'class'`. The default theme is dark (`theme: 'dark'`). A custom `codebox` color palette is defined in `packages/desktop/tailwind.config.js` — use these tokens (e.g. `bg-codebox-bg`, `text-codebox-primary`) rather than arbitrary hex values. The light theme uses a `data-theme="light"` attribute on the root div.

## Skills & Memory

Both are backed by `localStorage`, not a real database:
- Skills key: `eburon-codebox-skills`
- Memories key: `eburon-codebox-memories`

Do not expect persistence across Electron sessions if localStorage is cleared (it survives reloads within one session).

## Electron specifics

- Custom protocol `codebox://` registered as a secure file protocol.
- macOS `hiddenInset` titlebar with custom traffic light position.
- `contextIsolation: true`, `nodeIntegration: false` — use IPC/preload for Node access.
- `webviewTag: true` — webview is available in the renderer.

## No git / no CI

The repo has no `.git` directory, no CI config, and no gitignore. If initializing git, add `node_modules/`, `dist/`, `dist-electron/`, `release/` to `.gitignore`.

## No opencode.json instructions config

No `opencode.json` with `instructions` references exists. There are no external prompt files to chase down.
