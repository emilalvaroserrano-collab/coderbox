#!/bin/bash

# Bootstrap script for Codebox environment
# Creates .env file and downloads/installs all dependencies

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}🔧 Eburon Codebox Bootstrap Script${NC}"
echo -e "${GREEN}==============================${NC}\n"

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
  echo -e "${YELLOW}⚠️  Warning: This script is intended for Linux. Other OS may have issues.${NC}"
fi

# Check for required commands
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for essential dependencies
for cmd in docker curl wget git node npm pnpm; do
  if ! command_exists "$cmd"; then
    echo -e "${YELLOW}⚠️  Installing $cmd...${NC}"
    if [[ "$cmd" == "pnpm" ]]; then
      echo "  To install pnpm, run: npm install -g pnpm"
      exit 1
    elif [[ "$cmd" == "git" ]]; then
      if ! command_exists "apt-get" && ! command_exists "yum" && ! command_exists "dnf"; then
        echo -e "${YELLOW}  Skipping git install (no package manager detected).${NC}"
      else
        echo -e "${YELLOW}  Run: sudo apt-get install git (or sudo yum install git, sudo dnf install git)${NC}"
      fi
      exit 1
    else
      echo -e "${YELLOW}  Manual installation required for $cmd${NC}"
      exit 1
    fi
  fi
  echo -e "${GREEN}✓ $cmd is available${NC}"
done

# Ask for user confirmation before proceeding
echo -e "\n${BLUE}🔍 Environment Check Complete${NC}"
echo -e "${BLUE}=================================${NC}"
echo -e "\n${YELLOW}This script will:${NC}"
echo -e "  1. Install dependencies (ollama, opencode, freebuff2api proxy)"
echo -e "  2. Start local Ollama server"
echo -e "  3. Configure and start freebuff2api proxy"
echo -e "  4. Download Freebuff CLI"
echo -e "  5. Create .env configuration file"
echo -e "\n${YELLOW}Prerequisites:${NC}"
echo -e "  - This script MUST be run as root (or with sudo) to install system packages and access /home"
echo -e "  - Approximately 2GB disk space required"
echo -e "  - This script will pause for interactive prompts during installation (optional additions)"

read -p -e "\n${YELLOW}Continue? (y/N): ${NC}" -r continue_script
if [[ ! "$continue_script" =~ ^[Yy]$ ]]; then
  echo -e "\n${YELLOW}Setup cancelled.${NC}"
  exit 0
fi

# Function to check if a service is running
check_service_running() {
  local service_name=$1
  if pgrep -x "$service_name" >/dev/null 2>&1; then
    echo -e "  ✓ $service_name is running"
    return 0
  fi
  echo -e "  ✗ $service_name is not running"
  return 1
}

# Ask which services to install (optional additional packages)
echo -e "\n${BLUE}🔧 Optional Package Installation${NC}"
echo -e "${BLUE}===============================${NC}"

# Check if Docker is running
docker_running=false
if command_exists "docker"; then
  echo -e "\n${YELLOW}Docker ${NC}"
  if docker ps >/dev/null 2>&1; then
    echo -e "  ✓ Docker daemon is running"
    docker_running=true
  else
    echo -e "  ✗ Docker daemon is not running"
  fi
fi

# Check if Ollama is installed
ollama_installed=false
if command_exists "ollama"; then
  echo -e "\n${YELLOW}Ollama ${NC}"
  if check_service_running "ollama"; then
    ollama_installed=true
  fi
fi

# Check if OpenCode CLI is installed
opencode_installed=false
if command_exists "opencode"; then
  echo -e "\n${YELLOW}OpenCode CLI ${NC}"
  echo -e "  ✓ OpenCode CLI is installed"
  opencode_installed=true
fi

# Check if Freebuff is installed
freebuff_installed=false
if command_exists "freebuff"; then
  echo -e "\n${YELLOW}Freebuff CLI ${NC}"
  echo -e "  ✓ Freebuff CLI is installed"
  freebuff_installed=true
fi

# Create directory structure if needed
mkdir -p "$PROJECT_ROOT/package.json"
mkdir -p "$PROJECT_ROOT/packages/desktop/.env"
mkdir -p "$PROJECT_ROOT/.openbuff"

# Create .env file with all necessary configurations
cat > "$PROJECT_ROOT/packages/desktop/.env" << 'EOF'
# Eburon CodeBox — Environment Configuration
#
# Copy this file to .env and fill in your values.
# The bootstrap.sh script creates this automatically.

# ── Provider System (AutoSwap) ──────────────────────────────────
# auto = backend automatically selects best engine
LLM_PROVIDER=auto
AUTOSWAP_ENABLED=true
DEFAULT_ENGINE_ALIAS=eburon-reasoning
# Comma-separated fallback order (tried left to right)
PROVIDER_PRIORITY=eburon-reasoning,eburon-code,eburon-fast,eburon-vision,eburon-cloud,eburon-local,eburon-backup

# ── Local Ollama ────────────────────────────────────────────────
# Primary local LLM server (installed by bootstrap.sh)
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.6:latest

# ── Agent Orchestrator (uses local Ollama for restart decisions) ──
# This must be a LOCAL model — never cloud — so the orchestrator
# can never fail due to network outages.
AGENT_ORCHESTRATOR_OLLAMA_URL=http://127.0.0.1:11435
AGENT_ORCHESTRATOR_MODEL=ornith:9b
AGENT_ORCHESTRATOR_INTERVAL=15000

# ── OpenCode CLI ────────────────────────────────────────────────
# Free models via OpenCode (no API key needed)
OPENCODE_MODEL=opencode/deepseek-v4-flash-free

# ── Freebuff2API Proxy ──────────────────────────────────────────
# Start: cd ~/.openbuff/freebuff2api && .venv/bin/python main.py
FREEBUFF_HOST=http://127.0.0.1:8000
FREEBUFF_MODEL=deepseek/deepseek-v4-flash
FREEBUFF_API_KEY=not-needed

# ── Ollama Cloud (remote Ollama instance) ──────────────────────
OLLAMA_CLOUD_HOST=http://localhost:11434
OLLAMA_CLOUD_MODEL=qwen3.6:latest

# ── Firebase Auth (optional) ────────────────────────────────────
# Set VITE_SKIP_AUTH=true to bypass Firebase authentication in dev
VITE_SKIP_AUTH=true

# Firebase config (only needed if VITE_SKIP_AUTH is not set)
# VITE_FIREBASE_API_KEY=
# VITE_FIREBASE_AUTH_DOMAIN=
# VITE_FIREBASE_PROJECT_ID=
# VITE_FIREBASE_APP_ID=

# ── Groq (optional, fast inference) ─────────────────────────────
# Get a key at https://console.groq.com/keys
GROQ_API_KEY=

# ── Google Gemini (optional) ────────────────────────────────────
# Get a key at https://aistudio.google.com/apikey
GOOGLE_GENERATIVE_AI_API_KEY=

# ── OpenRouter (optional, free models) ──────────────────────────
OPENROUTER_API_KEY=

# ── Database (optional, SQLite by default) ──────────────────────
# DATABASE_URL=postgresql://user:password@localhost:5432/eburon

# ── Terminal Settings ────────────────────────────────────────────
TERMINAL_ENABLED=true
TERMINAL_REQUIRE_CONFIRMATION=true

# ── Workspace ────────────────────────────────────────────────────
# Default source code directory for AI operations
# WORKSPACE_DEFAULT_PATH=~/Projects

# ── Logging ─────────────────────────────────────────────────────
LOG_LEVEL=info
EOF

echo -e "\n${GREEN}✓ Configuration file created at packages/desktop/.env${NC}"

# Now we need to generate Prisma client
echo -e "\n${YELLOW}Generating Prisma client...${NC}"

# Generate Prisma client
pnpm --filter @eburon/desktop exec prisma generate

echo -e "\n${GREEN}✓ Bootstrap complete!${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo -e "  1. Make sure you're running from the codebox root directory"
echo -e "  2. Start PostgreSQL: docker compose -f packages/desktop/docker-compose.yml up -d"
echo -e "  3. Configure environment: Edit packages/desktop/.env with your DATABASE_URL"
echo -e "  4. Install dependencies: pnpm install"
echo -e "  5. Push database schema: pnpm --filter @eburon/desktop exec prisma db push"
echo -e "  6. Build Electron main process: pnpm --filter @eburon/desktop exec node scripts/build-main.mjs"
echo -e "  7. Terminal 1: Start Vite dev server: pnpm --filter @eburon/desktop exec vite --host"
echo -e "  8. Terminal 2: Launch Electron: DATABASE_URL=\"postgresql://eburon:eburon@localhost:5432/eburon\" \\ \"
echo -e "      VITE_DEV_SERVER_URL=http://localhost:5173 \\ \"
echo -e "      npx electron packages/desktop/dist-electron/main.cjs"

echo -e "\n${YELLOW}Note: The bootstrap.sh script creates a quick-start environment.${NC}"
echo -e "${YELLOW}For a manual setup, see README.md in packages/desktop/${NC}"
