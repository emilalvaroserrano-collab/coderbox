export interface SkillDef {
  id: string
  name: string
  description: string
  type: 'system' | 'custom'
  enabled: boolean
  icon: string
  source: 'opencode' | 'claude' | 'codex' | 'hermes'
  tags?: string[]
}

export const SOURCE_CONFIG = {
  opencode: { label: 'OpenCode', color: 'text-blue-400 bg-blue-400/10', border: 'border-blue-400/20' },
  claude: { label: 'Claude', color: 'text-amber-400 bg-amber-400/10', border: 'border-amber-400/20' },
  codex: { label: 'Codex', color: 'text-emerald-400 bg-emerald-400/10', border: 'border-emerald-400/20' },
  hermes: { label: 'Hermes Agent', color: 'text-purple-400 bg-purple-400/10', border: 'border-purple-400/20' },
} as const

export const ALL_SKILLS: SkillDef[] = [
  // ── OpenCode ──────────────────────────────────────────────
  {
    id: 'ast-indexer',
    name: 'AST Codebase Indexer',
    description: 'Builds vector embeddings and semantic syntax trees across your local repository for ultra-fast code retrieval and context-aware suggestions.',
    type: 'system', enabled: true, icon: 'Code2', source: 'opencode', tags: ['code', 'search', 'indexing'],
  },
  {
    id: 'cve-scanner',
    name: 'CVE Security Scanner',
    description: 'Real-time scanning of code modifications for SQL injections, XSS, command injection, and outdated package dependencies with auto-remediation.',
    type: 'system', enabled: true, icon: 'Shield', source: 'opencode', tags: ['security', 'scanning'],
  },
  {
    id: 'auto-fallback',
    name: 'Auto-Fallback Provider Router',
    description: 'Automatic multi-provider failover across Ollama, OpenAI, Anthropic, Groq, and local models with context compression on downgrade.',
    type: 'system', enabled: true, icon: 'Shuffle', source: 'opencode', tags: ['infra', 'routing'],
  },
  {
    id: 'skill-orchestrator',
    name: 'Skill Orchestrator',
    description: 'Meta-skill that pipelines complex multi-step tasks by discovering, loading, and sequencing the right skills in optimal order.',
    type: 'system', enabled: true, icon: 'GitMerge', source: 'opencode', tags: ['meta', 'pipeline'],
  },
  {
    id: 'browser-automation',
    name: 'Browser Automation (browser-act)',
    description: 'Stealth browser automation for JS-rendered pages, captcha handling, multi-session workflows, XHR interception, and parallel scraping.',
    type: 'system', enabled: false, icon: 'Globe', source: 'opencode', tags: ['web', 'scraping', 'automation'],
  },
  {
    id: 'azure-deploy-engine',
    name: 'Azure Deploy Engine',
    description: 'End-to-end Azure deployment with Bicep/Terraform generation, azd up/down, RBAC validation, and error recovery for production IaC.',
    type: 'system', enabled: true, icon: 'Cloud', source: 'opencode', tags: ['azure', 'deploy', 'infra'],
  },
  {
    id: 'azure-prepare',
    name: 'Azure App Scaffolder',
    description: 'Generates Dockerfiles, azure.yaml, and Bicep/Terraform for web apps, serverless APIs, containerized services, and static sites on Azure.',
    type: 'system', enabled: true, icon: 'Layers', source: 'opencode', tags: ['azure', 'scaffolding'],
  },
  {
    id: 'azure-kubernetes',
    name: 'AKS Cluster Planner',
    description: 'Designs production-ready AKS clusters with network topology, node pools, spot instances, autoscaling, upgrade strategy, and cost analysis.',
    type: 'system', enabled: true, icon: 'Container', source: 'opencode', tags: ['azure', 'kubernetes', 'infra'],
  },
  {
    id: 'edge-llm-deploy',
    name: 'Edge LLM Deployment',
    description: 'Deploys and serves local LLMs via Ollama, vLLM, llama.cpp, or TensorRT-LLM with OpenAI-compatible APIs and GPU optimization.',
    type: 'system', enabled: true, icon: 'Cpu', source: 'opencode', tags: ['local', 'llm', 'edge'],
  },
  {
    id: 'ai-video-production',
    name: 'AI Video Production',
    description: 'Full pipeline: Veo 3.1 text-to-video, Remotion compositing, TTS voiceover, background music, FFmpeg overlays, and upscaling.',
    type: 'system', enabled: false, icon: 'Video', source: 'opencode', tags: ['video', 'generation', 'media'],
  },
  {
    id: 'flutter-dev',
    name: 'Flutter Full-Stack Dev',
    description: 'Production Flutter development with state management, routing, localization, testing, responsive layouts, and deep linking.',
    type: 'system', enabled: false, icon: 'Smartphone', source: 'opencode', tags: ['mobile', 'flutter'],
  },
  {
    id: 'google-search-serp',
    name: 'Google SERP Extractor',
    description: 'Extracts organic results, paid ads, People Also Ask, AI Overview, and related searches from Google search result pages.',
    type: 'system', enabled: false, icon: 'Search', source: 'opencode', tags: ['seo', 'search'],
  },
  {
    id: 'youtube-transcript',
    name: 'YouTube Transcript Engine',
    description: 'Downloads full transcripts and captions from YouTube videos with timestamps for content analysis and summarization.',
    type: 'system', enabled: false, icon: 'Subtitles', source: 'opencode', tags: ['video', 'transcript'],
  },
  {
    id: 'flutter-keyboard',
    name: 'Brainstorming & Planning',
    description: 'Structured exploration of user intent, requirements, and design before implementation — mandatory for creative and feature work.',
    type: 'system', enabled: true, icon: 'Lightbulb', source: 'opencode', tags: ['planning', 'design'],
  },
  {
    id: 'writing-plans',
    name: 'Writing Plans',
    description: 'Transforms specs and requirements into actionable multi-step implementation plans before touching any code.',
    type: 'system', enabled: true, icon: 'FileText', source: 'opencode', tags: ['planning', 'documentation'],
  },
  {
    id: 'test-driven-dev',
    name: 'Test-Driven Development',
    description: 'Enforces TDD workflow: write tests first, implement to pass, refactor, and verify — before production code.',
    type: 'system', enabled: true, icon: 'CheckCircle', source: 'opencode', tags: ['testing', 'tdd'],
  },
  {
    id: 'code-review',
    name: 'Requesting Code Review',
    description: 'Verifies work meets requirements, checks edge cases, validates test coverage, and reviews diff before merge.',
    type: 'system', enabled: true, icon: 'GitPullRequest', source: 'opencode', tags: ['review', 'quality'],
  },
  {
    id: 'systematic-debugging',
    name: 'Systematic Debugger',
    description: 'Structured bug investigation: reproduce, isolate root cause, check hypotheses, fix, and verify — no guesswork.',
    type: 'system', enabled: true, icon: 'Bug', source: 'opencode', tags: ['debugging'],
  },
  {
    id: 'web-page-marker',
    name: 'Web Page to Markdown',
    description: 'Converts any webpage into clean readable Markdown — ideal for documentation scraping, article extraction, and research.',
    type: 'system', enabled: true, icon: 'FileDown', source: 'opencode', tags: ['web', 'extraction'],
  },
  {
    id: 'memory-profile',
    name: 'Memory & Profile Manager',
    description: 'Persistent cross-session memory with localStorage-backed skill and context storage for continuous learning.',
    type: 'system', enabled: true, icon: 'Brain', source: 'opencode', tags: ['memory', 'persistence'],
  },
  {
    id: 'flutter-cinema',
    name: 'Cinematic AI Video',
    description: 'Cinematic video generation with the 5-part prompt formula, camera controls, reference-image consistency, and first-to-last-frame transitions.',
    type: 'system', enabled: false, icon: 'Clapperboard', source: 'opencode', tags: ['video', 'cinematic'],
  },
  {
    id: 'entra-id-setup',
    name: 'Entra ID & Auth Setup',
    description: 'Guides app registration, OAuth 2.0, MSAL integration, and Agent Identity Blueprints with Microsoft Entra ID.',
    type: 'system', enabled: false, icon: 'Key', source: 'opencode', tags: ['auth', 'entra', 'identity'],
  },
  {
    id: 'foundry-deploy',
    name: 'Microsoft Foundry Deploy',
    description: 'Deploys, evaluates, fine-tunes, and manages Foundry agents end-to-end with Docker, ACR, prompt optimization, and continuous eval.',
    type: 'system', enabled: false, icon: 'Rocket', source: 'opencode', tags: ['foundry', 'deploy', 'ai'],
  },
  {
    id: 'azure-compliance',
    name: 'Azure Compliance Auditor',
    description: 'Runs azqr compliance and security audits plus Key Vault expiration checks across all Azure resources.',
    type: 'system', enabled: false, icon: 'ShieldCheck', source: 'opencode', tags: ['azure', 'compliance', 'audit'],
  },
  {
    id: 'cloudinary-media',
    name: 'Cloudinary Media Optimizer',
    description: 'Builds optimized Cloudinary delivery URLs with transformations, responsive breakpoints, and format negotiation for images and video.',
    type: 'system', enabled: false, icon: 'Image', source: 'opencode', tags: ['media', 'optimization'],
  },
  {
    id: 'gemini-api',
    name: 'Gemini API Integration',
    description: 'Leverages Gemini models with multimodal understanding, function calling, structured output, and the Live API for real-time streaming.',
    type: 'system', enabled: false, icon: 'Sparkles', source: 'opencode', tags: ['gemini', 'api', 'multimodal'],
  },
  {
    id: 'google-adk-agents',
    name: 'Google ADK Agent Builder',
    description: 'Scaffolds, develops, evaluates, deploys, and publishes agents using Google Agent Development Kit (ADK) with full lifecycle management.',
    type: 'system', enabled: false, icon: 'Bot', source: 'opencode', tags: ['google', 'agents', 'adk'],
  },
  {
    id: 'image-gen',
    name: 'Image Generation (Gemini)',
    description: 'Generates images via Gemini CLI with text-to-image capabilities and creative prompt engineering.',
    type: 'system', enabled: false, icon: 'Palette', source: 'opencode', tags: ['image', 'generation'],
  },

  // ── Claude ──────────────────────────────────────────────
  {
    id: 'extended-thinking',
    name: 'Extended Thinking',
    description: 'Deep chain-of-thought reasoning for complex math, multi-step logic, and architecture design with visible reasoning traces.',
    type: 'system', enabled: true, icon: 'BrainCircuit', source: 'claude', tags: ['reasoning', 'thinking'],
  },
  {
    id: 'claude-tool-use',
    name: 'MCP Tool Orchestration',
    description: 'Discovers, authenticates, and orchestrates Model Context Protocol servers for databases, APIs, file systems, and cloud services.',
    type: 'system', enabled: true, icon: 'Wrench', source: 'claude', tags: ['mcp', 'tools', 'integration'],
  },
  {
    id: 'computer-use',
    name: 'Computer Use (GUI Control)',
    description: 'Direct desktop GUI interaction — click buttons, type into apps, take screenshots, and control any visible interface element.',
    type: 'system', enabled: false, icon: 'Monitor', source: 'claude', tags: ['automation', 'gui'],
  },
  {
    id: 'vision-analysis',
    name: 'Vision & Multimodal Analysis',
    description: 'Analyzes images, charts, diagrams, screenshots, and UI mockups with detailed visual understanding and object detection.',
    type: 'system', enabled: true, icon: 'Eye', source: 'claude', tags: ['vision', 'multimodal'],
  },
  {
    id: 'artifacts',
    name: 'Artifact Generation',
    description: 'Creates rich, interactive content artifacts — SVG, HTML, React components, Mermaid diagrams, flowcharts, and data visualizations.',
    type: 'system', enabled: true, icon: 'Component', source: 'claude', tags: ['artifacts', 'visualization'],
  },
  {
    id: 'prompt-caching',
    name: 'Prompt Caching',
    description: 'Intelligent context reuse with semantic caching of system prompts, few-shot examples, and large document contexts to reduce latency and cost.',
    type: 'system', enabled: true, icon: 'Database', source: 'claude', tags: ['caching', 'optimization'],
  },
  {
    id: 'code-formatting',
    name: 'Code Formatting & Linting',
    description: 'Language-aware code formatting, import organization, dead code elimination, and consistent style enforcement across files.',
    type: 'system', enabled: true, icon: 'Indent', source: 'claude', tags: ['formatting', 'quality'],
  },
  {
    id: 'refactoring-engine',
    name: 'Multi-File Refactoring',
    description: 'Cross-file refactoring with dependency graph analysis, type-safe renames, interface extraction, and pattern-based transforms.',
    type: 'system', enabled: true, icon: 'GitBranch', source: 'claude', tags: ['refactoring', 'code'],
  },
  {
    id: 'documentation-gen',
    name: 'Documentation Generator',
    description: 'Generates JSDoc, TSDoc, Python docstrings, README files, API references, and changelogs from source code analysis.',
    type: 'system', enabled: true, icon: 'BookOpen', source: 'claude', tags: ['documentation', 'docs'],
  },
  {
    id: 'testing-assistant',
    name: 'Test Suite Generator',
    description: 'Creates unit, integration, and E2E tests with mocking, fixture generation, edge case coverage, and test framework configuration.',
    type: 'system', enabled: true, icon: 'Flask', source: 'claude', tags: ['testing', 'coverage'],
  },
  {
    id: 'dependency-audit',
    name: 'Dependency Audit & Upgrade',
    description: 'Scans package manifests for outdated, vulnerable, or deprecated dependencies and generates safe upgrade plans.',
    type: 'system', enabled: true, icon: 'Package', source: 'claude', tags: ['dependencies', 'security'],
  },
  {
    id: 'cli-automation',
    name: 'Terminal CLI Automation',
    description: 'Executes shell commands, interprets outputs, handles errors, and automates multi-step CLI workflows with timeout and retry.',
    type: 'system', enabled: true, icon: 'Terminal', source: 'claude', tags: ['cli', 'automation'],
  },

  // ── Codex ──────────────────────────────────────────────
  {
    id: 'sandbox-execution',
    name: 'Sandboxed Code Execution',
    description: 'Isolated environment for running untrusted code with resource limits, network restrictions, and filesystem sandboxing.',
    type: 'system', enabled: true, icon: 'Shield', source: 'codex', tags: ['sandbox', 'execution'],
  },
  {
    id: 'file-ops',
    name: 'Advanced File Operations',
    description: 'Read, write, search, and transform files with glob patterns, diff-based editing, streaming for large files, and binary support.',
    type: 'system', enabled: true, icon: 'File', source: 'codex', tags: ['filesystem', 'editing'],
  },
  {
    id: 'repl-integration',
    name: 'REPL & Interactive Shell',
    description: 'Interactive code execution with stateful REPL sessions, pip install, stdout/stderr capture, and visualization output.',
    type: 'system', enabled: true, icon: 'Play', source: 'codex', tags: ['repl', 'interactive'],
  },
  {
    id: 'multi-file-editor',
    name: 'Multi-File Co-Editing',
    description: 'Simultaneously edits multiple files across the project with coordinated changes, import updates, and cross-reference consistency.',
    type: 'system', enabled: true, icon: 'Files', source: 'codex', tags: ['editing', 'multi-file'],
  },
  {
    id: 'web-scraper',
    name: 'Web Fetch & Scrape',
    description: 'Fetches web content, extracts structured data from HTML/JSON, handles pagination, and converts to Markdown or structured output.',
    type: 'system', enabled: true, icon: 'Globe', source: 'codex', tags: ['web', 'scraping'],
  },
  {
    id: 'search-replace',
    name: 'Smart Search & Replace',
    description: 'Pattern-aware search and replace across the codebase with regex support, semantic matching, and dry-run preview.',
    type: 'system', enabled: true, icon: 'Replace', source: 'codex', tags: ['search', 'replace'],
  },
  {
    id: 'git-automation',
    name: 'Git Workflow Automation',
    description: 'Automated git operations: smart commits, branch management, diff review, rebase, conflict resolution, and PR summaries.',
    type: 'system', enabled: true, icon: 'GitCommit', source: 'codex', tags: ['git', 'version-control'],
  },
  {
    id: 'project-scaffold',
    name: 'Project Scaffolder',
    description: 'Bootstraps new projects from templates with config files, directory structure, dependency setup, and CI/CD pipeline stubs.',
    type: 'system', enabled: true, icon: 'FolderPlus', source: 'codex', tags: ['scaffolding', 'setup'],
  },
  {
    id: 'error-diagnostics',
    name: 'Error Diagnostics & Fixes',
    description: 'Analyzes compiler, runtime, and test errors with root cause localization, stack trace parsing, and automated fix generation.',
    type: 'system', enabled: true, icon: 'Bug', source: 'codex', tags: ['diagnostics', 'errors'],
  },
  {
    id: 'agent-collab',
    name: 'Multi-Agent Collaboration',
    description: 'Coordinates multiple AI agents for parallel task execution, sub-delegation, result merging, and conflict resolution.',
    type: 'system', enabled: false, icon: 'Users', source: 'codex', tags: ['agents', 'collaboration'],
  },

  // ── Hermes Agent ──────────────────────────────────────────
  {
    id: 'self-improving-loop',
    name: 'Self-Improving Loop',
    description: 'Creates skills from experience, improves them during use, and builds user profiles across sessions — grows smarter over time.',
    type: 'system', enabled: true, icon: 'RefreshCw', source: 'hermes', tags: ['learning', 'adaptation'],
  },
  {
    id: 'memory-consolidation',
    name: 'Memory Consolidation',
    description: 'Cross-session memory with importance scoring, decay curves, consolidation scheduling, and retrieval-augmented generation.',
    type: 'system', enabled: true, icon: 'Brain', source: 'hermes', tags: ['memory', 'rag'],
  },
  {
    id: 'multi-platform-bridge',
    name: 'Multi-Platform Bridge',
    description: 'Simultaneous deployment across Telegram, Discord, Slack, WhatsApp, Signal, and CLI with platform-aware response formatting.',
    type: 'system', enabled: false, icon: 'MessageSquare', source: 'hermes', tags: ['platform', 'messaging'],
  },
  {
    id: 'skill-forging',
    name: 'Skill Forge',
    description: 'Automatically creates reusable, parameterized Skill packages from observed task patterns and website exploration.',
    type: 'system', enabled: true, icon: 'Hammer', source: 'hermes', tags: ['skill-creation', 'automation'],
  },
  {
    id: 'user-profiling',
    name: 'Adaptive User Profiling',
    description: 'Builds evolving user profiles from interaction patterns, preferences, coding style, and expertise level for personalized responses.',
    type: 'system', enabled: true, icon: 'UserCheck', source: 'hermes', tags: ['personalization', 'profiling'],
  },
  {
    id: 'knowledge-synthesis',
    name: 'Knowledge Synthesis',
    description: 'Deep research with multi-source citation, cross-referencing, summarization, and structured knowledge graph construction.',
    type: 'system', enabled: true, icon: 'Library', source: 'hermes', tags: ['research', 'knowledge'],
  },
  {
    id: 'context-window-opt',
    name: 'Context Window Optimizer',
    description: 'Intelligent context management with sliding windows, summarization, priority ranking, and token budget enforcement.',
    type: 'system', enabled: true, icon: 'SlidersHorizontal', source: 'hermes', tags: ['context', 'optimization'],
  },
  {
    id: 'privacy-first-mode',
    name: 'Privacy-First Mode',
    description: '100% offline operation with local-only processing, no telemetry, encrypted storage, and opt-in data sharing controls.',
    type: 'system', enabled: true, icon: 'Lock', source: 'hermes', tags: ['privacy', 'security'],
  },
  {
    id: 'tool-discovery',
    name: 'Autonomous Tool Discovery',
    description: 'Probes and integrates new tools at runtime via MCP, OpenAPI, and plugin registries without predefined configuration.',
    type: 'system', enabled: true, icon: 'Compass', source: 'hermes', tags: ['tools', 'discovery'],
  },
  {
    id: 'state-persistence',
    name: 'State Persistence Engine',
    description: 'Persists agent state, conversation context, learned skills, and user profiles across restarts with crash recovery.',
    type: 'system', enabled: true, icon: 'Save', source: 'hermes', tags: ['persistence', 'state'],
  },
]
