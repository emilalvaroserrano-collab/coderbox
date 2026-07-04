# Dockerfile for Eburon CodeBox (development container)
# Supports running the Electron app headless via Xvfb

FROM node:22-slim

RUN apt-get update && apt-get install -y \
  python3 python3-venv python3-pip \
  git curl wget \
  xvfb \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2t64 libpango-1.0-0 libcairo2 \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/desktop/package.json packages/desktop/
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @eburon/desktop exec node scripts/build-main.mjs

# Download Electron binary
RUN cd node_modules/.pnpm/electron@*/node_modules/electron && node install.js || true

ENV VITE_SKIP_AUTH=true
ENV DISPLAY=:99

EXPOSE 5173 8765 11435 8000

CMD ["sh", "-c", "Xvfb :99 -screen 0 1440x900x24 & sleep 1 && pnpm --filter @eburon/desktop exec vite --host --port 5173"]