#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
#  Eburon CodeBox — One-Command Bootstrap Installer
#  Installs everything: Node, pnpm, Python, Ollama, OpenCode, Freebuff,
#  Gemini, CLI tools, CodeBox app, and all dependencies.
#
#  Usage:  bash bootstrap.sh
#  Re-run: safe to run multiple times (idempotent)
# ============================================================================

BOLD='\03c[1m'
GREEN='\03c[32m'
YELLOW='\03c[33m'
RED='\03c[31m'
BLUE='\03c[34m'
NC='\03c[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

echo ""
echo "=================================================="
echo "  Eburon CodeBox — Full System Bootstrap"
echo "=================================================="
echo ""

# ── 1. System detection ──────────────────────────────────────────────

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" != "Linux" ] && [ "$OS" != "Darwin" ]; then
  err "Unsupported OS: $OS (only Linux/macOS)"
  exit 1
fi

if [ "$OS" = "Darwin" ] && ! command -v brew &>/dev/null; then
  warn "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

ok "OS: $OS ($ARCH)"

# ── 2. Node.js ──────────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  info "Installing Node.js 22..."
  if [ "$OS" = "Darwin" ]; then
    brew install node@22
  else
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
fi
ok "Node.js: $(node --version)"

# ── 3. pnpm ──────────────────────────────────────────────────────────

if ! command -v pnpm &>/dev/null; then
  info "Installing pnpm..."
  npm install -g pnpm@latest
fi
ok "pnpm: $(pnpm --version)"

# ── 4. Python 3 ──────────────────────────────────────────────────────

if ! command -v python3 &>/dev/null; then
  info "Installing Python 3..."
  if [ "$OS" = "Darwin" ]; then
    brew install python@3.13
  else
    sudo apt-get install -y python3 python3-pip python3-venv
  fi
fi
ok "Python: $(python3 --version)"

# ── 5. Git ────────────────────────────────────────────────────────────

if ! command -v git &>/dev/null; then
  info "Installing Git..."
  if [ "$OS" = "Darwin" ]; then
    brew install git
  else
    sudo apt-get install -y git
  fi
fi
ok "Git: $(git --version | head -1)"

# ── 6. Ollama (Local LLM server) ─────────────────────────────────────

if ! command -v ollama &>/dev/null; then
  info "Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
fi
ok "Ollama: $(ollama --version 2>&1 || echo 'installed')"

# Pull required models
info "Pulling Ollama models (this may take a while)..."
ollama pull ornith:9b 2>/dev/null || warn "Could not pull ornith:9b — download manually with 'ollama pull ornith:9b'"
ollama pull llava:7b  2>/dev/null || warn "Could not pull llava:7b — download manually with 'ollama pull llava:7b'"
ok "Ollama models ready"

# ── 7. OpenCode CLI ──────────────────────────────────────────────────

if ! command -v opencode &>/dev/null; then
  info "Installing OpenCode CLI..."
  curl -fsSL https://opencode.ai/install | bash
fi
ok "OpenCode: $(opencode --version 2>&1 || echo 'installed')"

# ── 8. Freebuff CLI + Proxy ──────────────────────────────────────────

if ! command -v freebuff &>/dev/null; then
  info "Installing Freebuff CLI..."
  npm install -g freebuff
fi
ok "Freebuff CLI: installed"

# Freebuff2API proxy
FREEBUFF2API_DIR="${HOME}/.openbuff/freebuff2api"
if [ ! -d "$FREEBUFF2API_DIR" ]; then
  info "Installing Freebuff2API proxy..."
  mkdir -p "$(dirname "$FREEBUFF2API_DIR")"
  git clone https://github.com/XxxXTeam/freebuff2api.git "$FREEBUFF2API_DIR"
  cd "$FREEBUFF2API_DIR"
  python3 -m venv .venv
  .venv/bin/pip install -e .
  if [ -f .env.example ]; then cp .env.example .env; fi
  cd "$REPO_ROOT"
fi
ok "Freebuff2API proxy: installed at $FREEBUFF2API_DIR"

# ── 9. Gemini CLI ─────────────────────────────────────────────────────

if ! command -v gemini &>/dev/null; then
  info "Installing Gemini CLI..."
  npm install -g @anthropic-ai/gemini-cli 2>/dev/null || npm install -g @anthropic-ai/claude-code 2>/dev/null || warn "Gemini CLI install skipped"
fi
ok "Gemini CLI: $(gemini --version 2>&1 || echo 'not installed — optional')"

# ── 10. Codex CLI ────────────────────────────────────────────────────

if ! command -v codex &>/dev/null; then
  info "Installing Codex CLI..."
  npm install -g @openai/codex 2>/dev/null || warn "Codex CLI install skipped (optional)"
fi
ok "Codex CLI: $(codex --version 2>&1 || echo 'not installed — optional')"

# ── 11. Hermes Agent (optional) ─────────────────────────────────────

if ! command -v hermes &>/dev/null; then
  info "Installing Hermes Agent..."
  npm install -g hermes-agent 2>/dev/null || warn "Hermes install skipped (optional)"
fi
ok "Hermes: $(hermes --version 2>&1 || echo 'not installed — optional')"

# ── 12. Browser-act CLI ─────────────────────────────────────────────

if ! command -v browser-act &>/dev/null; then
  info "Installing browser-act..."
  pip install browser-act-cli 2>/dev/null || uv tool install browser-act-cli --python 3.12 2>/dev/null || warn "browser-act install skipped"
fi
ok "browser-act: $(browser-act --version 2>&1 || echo 'not installed — optional')"

# ── 13. System dependencies (Linux) ─────────────────────────────────

if [ "$OS" = "Linux" ]; then
  info "Installing system dependencies..."
  sudo apt-get install -y \
    xvfb \
    zstd \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2t64 libpango-1.0-0 libcairo2 \
    2>/dev/null || warn "Some system deps may already be installed"
fi
ok "System dependencies ready"

# ── 14. Install CodeBox dependencies ─────────────────────────────────

info "Installing CodeBox npm dependencies..."
cd "$REPO_ROOT"
pnpm install 2>&1 | tail -5
ok "Dependencies installed"

# ── 15. Build main process ───────────────────────────────────────────

info "Building Electron main process..."
pnpm --filter @eburon/desktop exec node scripts/build-main.mjs 2>&1 | tail -3
ok "Main process built"

# ── 16. Electron binary ──────────────────────────────────────────────

if [ ! -d "$REPO_ROOT/node_modules/.pnpm/electron@33.4.11/node_modules/electron/dist" ]; then
  info "Downloading Electron binary..."
  cd "$REPO_ROOT/node_modules/.pnpm/electron@33.4.11/node_modules/electron"
  node install.js 2>&1
  cd "$REPO_ROOT"
fi
ok "Electron binary ready"

# ── 17. Environment configuration ─────────────────────────────────────

ENV_FILE="$REPO_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
  info "Creating .env from .env.example..."
  if [ -f "$REPO_ROOT/.env.example" ]; then
    cp "$REPO_ROOT/.env.example" "$ENV_FILE"
  else
    cat > "$ENV_FILE" << 'ENV'
# Eburon CodeBox Environment Configuration

# ── Provider System ──
LLM_PROVIDER=auto
AUTOSWAP_ENABLED=true
DEFAULT_ENGINE_ALIAS=eburon-reasoning
PROVIDER_PRIORITY=eburon-reasoning,eburon-code,eburon-fast,eburon-vision,eburon-cloud,eburon-local,eburon-backup

# ── Ollama ──
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.6:latest
AGENT_ORCHESTRATOR_OLLAMA_URL=http://127.0.0.1:11435
AGENT_ORCHESTRATOR_MODEL=ornith:9b

# ── OpenCode ──
OPENCODE_MODEL=opencode/deepseek-v4-flash-free

# ── Freebuff ──
FREEBUFF_HOST=http://127.0.0.1:8000
FREEBUFF_MODEL=deepseek/deepseek-v4-flash
FREEBUFF_API_KEY=not-needed

# ── Ollama Cloud ──
OLLAMA_CLOUD_HOST=http://localhost:11434
OLLAMA_CLOUD_MODEL=qwen3.6:latest

# ── Firebase (optional, can skip with VITE_SKIP_AUTH=true) ──
VITE_SKIP_AUTH=true

# ── Groq (optional) ──
GROQ_API_KEY=

# ── Google (optional) ──
GOOGLE_GENERATIVE_AI_API_KEY=
ENV
  fi
  ok ".env created"
else
  ok ".env already exists"
fi

# ── 18. Freebuff authentication ─────────────────────────────────────

FREEBUFF_CREDS="${HOME}/.config/manicode/credentials.json"
if [ ! -f "$FREEBUFF_CREDS" ]; then
  warn "Freebuff not authenticated. Run 'freebuff' once in any project to authenticate."
fi

# ── 19. Systemd user services ────────────────────────────────────────

setup_systemd() {
  local SERVICE_NAME="$1"
  local SERVICE_FILE="$2"
  local DEST="${HOME}/.config/systemd/user/${SERVICE_NAME}"

  mkdir -p "${HOME}/.config/systemd/user"
  cp "$SERVICE_FILE" "$DEST"
  systemctl --user daemon-reload
  systemctl --user enable --now "$SERVICE_NAME" 2>/dev/null || warn "Could not start $SERVICE_NAME"
  ok "$SERVICE_NAME service enabled"
}

# Freebuff2API systemd service
FREEBUFF_SERVICE="${FREEBUFF2API_DIR}/freebuff2api.service"
if [ -f "$FREEBUFF_SERVICE" ]; then
  setup_systemd "freebuff2api.service" "$FREEBUFF_SERVICE"
fi

# ── 20. Start Ollama (if not running) ────────────────────────────────

if ! curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  info "Starting Ollama server..."
  ollama serve &>/dev/null &
  sleep 3
fi
ok "Ollama server: $(curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && echo 'running' || echo 'starting...')"

# ── 21. Start Freebuff2API proxy (if not running) ───────────────────

if ! curl -s http://127.0.0.1:8000/v1/models >/dev/null 2>&1; then
  if [ -d "$FREEBUFF2API_DIR" ]; then
    info "Starting Freebuff2API proxy..."
    cd "$FREEBUFF2API_DIR"
    .venv/bin/python main.py &>/dev/null &
    sleep 3
    cd "$REPO_ROOT"
  fi
fi
ok "Freebuff2API: $(curl -s http://127.0.0.1:8000/v1/models >/dev/null 2>&1 && echo 'running' || echo 'not running')"

# ── 22. Final health check ───────────────────────────────────────────

echo ""
echo "=================================================="
echo "  Health Check"
echo "=================================================="

check() {
  if eval "$2" >/dev/null 2>&1; then
    ok "$1"
  else
    warn "$1"
  fi
}

check "Node.js"       "node --version"
check "pnpm"           "pnpm --version"
check "Python 3"       "python3 --version"
check "Git"            "git --version"
check "Ollama"         "curl -s http://127.0.0.1:11434/api/tags"
check "OpenCode"       "opencode --version"
check "Freebuff CLI"   "command -v freebuff"
check "Freebuff2API"   "curl -s http://127.0.0.1:8000/v1/models"
check "Electron"       "test -d $REPO_ROOT/node_modules/.pnpm/electron@33.4.11/node_modules/electron/dist"
check "Main process"   "test -f $REPO_ROOT/packages/desktop/dist-electron/main.cjs"

echo ""
echo "=================================================="
echo "  Next Steps"
echo "=================================================="
echo ""
echo "  1. Edit .env with your API keys (Groq, Google, etc.)"
echo "  2. Run Freebuff auth:   freebuff  (once, in any directory)"
echo "  3. Start the app:"
echo "       pnpm dev                    # Vite dev server"
echo "       # In another terminal:"
echo "       VITE_DEV_SERVER_URL=http://localhost:5173 \\"
echo "         npx electron packages/desktop/dist-electron/main.cjs --no-sandbox"
echo ""
echo "  Or on Wayland:"
echo "       VITE_DEV_SERVER_URL=http://localhost:5173 \\"
echo "         WAYLAND_DISPLAY=wayland-0 \\"
echo "         npx electron packages/desktop/dist-electron/main.cjs --no-sandbox --ozone-platform=wayland"
echo ""
echo "Done!"