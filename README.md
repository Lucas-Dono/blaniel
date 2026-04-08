<div align="center">

<img src="public/logo.png" alt="Blaniel" width="80" height="80" />

# Blaniel

**Emotional AI Engine with Real Psychological Models**

An open-source engine for creating AI agents that *actually feel* — powered by OCC cognitive appraisal, the Plutchik emotion wheel, Big Five personality traits, attachment theory, and long-term vector memory.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/contributing.md)
[![Made by Lucas](https://img.shields.io/badge/made%20by-Lucas%20Dono-purple)](https://www.linkedin.com/in/lucas-dono/)

[Getting Started](#quick-start) · [Architecture](#architecture) · [Docs](#documentation) · [Why Blaniel?](#why-blaniel)

</div>

---

## Why Blaniel?

Most "AI character" platforms are thin wrappers around ChatGPT with a system prompt and a cute avatar. Blaniel is different — it's a **real emotional engine** that models the entire psychological pipeline:

| What others do | What Blaniel does |
|---|---|
| Static system prompt | 8-phase cognitive appraisal (OCC theory) |
| "The character is sad" | Plutchik emotion wheel with 8 primary + 24 compound emotions |
| No memory | Vector-based long-term memory with HNSWLib (semantic + episodic + procedural) |
| Fixed personality | Big Five traits, 30 facets, Dark Triad, attachment styles |
| One behavior fits all | 13 psychological behavior profiles with phase-based progression |
| Generic responses | Dual-LLM pipeline: Gemini orchestrates cognition, Venice writes in-character |
| Isolated agents | Multi-agent worlds with a dramatic director system |

**If you want a chatbot**, there are hundreds. **If you want agents with genuine emotional depth that evolve over time**, that's what this builds.

## What You Get

```
git clone → npm install → npm run dev:setup → npm run dev
```

A working playground at `localhost:3000` where you can:
- **Create agents** with custom personalities, behavior profiles, and attachment styles
- **Chat in real time** and watch emotions, trust, and affinity evolve
- **Observe the emotional pipeline** — see cognitive appraisal results, active emotions, mood shifts
- **No login required** — dev mode auto-authenticates for testing

## Architecture

```
                     ┌─────────────────────────────────────────┐
                     │            Client Layer                  │
                     │  Web │ Mobile (Expo) │ MC Mod │ SDK     │
                     └──────────────┬──────────────────────────┘
                                    │
                     ┌──────────────▼──────────────────────────┐
                     │          API Layer (Next.js)             │
                     │  50+ endpoints │ Socket.IO │ Middleware  │
                     └──────────────┬──────────────────────────┘
                                    │
               ┌────────────────────┼────────────────────────┐
               │                    │                        │
     ┌─────────▼──────────┐ ┌──────▼───────┐ ┌──────────────▼──────┐
     │   Emotional Core   │ │    Memory     │ │   LLM Pipeline      │
     │                    │ │    Engine     │ │                     │
     │ OCC Appraisal      │ │ Vector Store  │ │ Gemini (orchestrator)│
     │ Plutchik Emotions  │ │ RAG Retrieval │ │ Venice (writer)     │
     │ Behavior System    │ │ Dual Memory   │ │ Hybrid Provider     │
     │ Bond Orchestrator  │ │ Compression   │ │ Circuit Breaker     │
     └────────────────────┘ └──────────────┘ └─────────────────────┘
               │                    │                        │
     ┌─────────▼──────────────────▼────────────────────────▼──┐
     │              PostgreSQL + Redis + S3                     │
     └─────────────────────────────────────────────────────────┘
```

**The emotional pipeline** processes every message through 8 phases:

```
User message → Event Classification → Cognitive Appraisal (OCC)
    → Emotion Generation (Plutchik) → Emotion Decay
    → Behavior Activation → Response Strategy
    → LLM Generation (character-faithful) → Memory Storage
```

Every phase is based on published psychological research, not vibes.

## Key Systems

**Emotional Engine** — Agents don't just "feel happy or sad." The OCC model classifies events as positive/negative, expected/unexpected, then the Plutchik wheel generates combinations like *awe* (fear + surprise) or *contempt* (anger + disgust). Emotions decay over time based on intensity.

**Psychological Profiling** — Big Five traits with 30 sub-facets, Dark Triad (Machiavellianism, narcissism, psychopathy), attachment styles (secure, anxious, avoidant, disorganized), and self-determination theory needs. All configurable per agent.

**Behavior System** — 13 psychologically-grounded behavior profiles with phase-based progression. An agent with borderline personality doesn't just "act dramatic" — it goes through idealization → testing → splitting → crisis → reconciliation cycles.

**Memory** — Three-layer system: semantic (facts), episodic (events), procedural (learned patterns). Vector similarity search via HNSWLib for contextual recall. Memory compression keeps the context window efficient.

**Multi-Agent Worlds** — Groups of agents interact autonomously. A dramatic director system generates scenes, injects tension seeds, and manages narrative arcs between agents.

**Symbolic Bonds** — User-agent relationships with tier progression (stranger → acquaintance → friend → confidant → bond), decay mechanics, and scarcity. Trust, affinity, and respect are tracked independently.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 + TypeScript | Full-stack App Router |
| Database | PostgreSQL + Prisma (80+ models) | Primary data store |
| Cache | Redis | Caching, rate limiting, queues |
| LLM - Orchestrator | Google Gemini 2.5 Flash/Lite | Cognitive appraisal, emotion, behavior |
| LLM - Writer | Venice AI | Character-faithful response generation |
| LLM - Local | Ollama / LM Studio / LocalAI | 100% free, offline, private |
| Embeddings | OpenAI `text-embedding-3-small` | Vector memory |
| Vector Search | HNSWLib (`hnswlib-node`) | Semantic similarity |
| Real-time | Socket.IO | Chat streaming, presence |
| Queues | BullMQ | Async AI processing |

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Redis 7+ (or use Upstash free tier)

### 1. Clone and Install

```bash
git clone https://github.com/Lucas-Dono/blaniel.git
cd blaniel
npm install
```

### 2. Start Database

**Docker (easiest):**
```bash
docker run -d --name blaniel-db \
  -e POSTGRES_PASSWORD=blaniel \
  -e POSTGRES_DB=blaniel \
  -p 5432:5432 \
  postgres:16
```

**Free cloud:** [Neon](https://neon.tech) or [Supabase](https://supabase.com) — copy the connection string to `.env`

### 3. Configure API Keys

```bash
cp .env.example .env
```

Edit `.env` and add at minimum:

| Key | Free Tier? | Get it |
|-----|-----------|--------|
| `GOOGLE_AI_API_KEY` | Yes | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `VENICE_API_KEY` | Yes (limited) | [Venice AI](https://venice.ai/settings/api/keys) |
| `OPENAI_API_KEY` | ~$0.01/1K requests | [OpenAI](https://platform.openai.com/api-keys) |

**Want to go 100% free?** See [Local LLMs](#local-llms-100-free) below.

### 4. Initialize and Run

```bash
npm run dev:setup   # Generate Prisma client, create tables, seed demo agents
npm run dev         # → http://localhost:3000
```

You'll get 3 demo agents (Luna, Atlas, Echo) to start experimenting immediately.

> `DEV_MODE=true` bypasses authentication. Never use in production.

### Local LLMs (100% Free)

Run everything on your own hardware — no API keys, no costs, complete privacy.

```bash
# Install Ollama: https://ollama.com
ollama pull llama3.1
```

Add to `.env`:
```
LOCAL_LLM_TYPE=ollama
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama3.1
```

Also works with [LM Studio](https://lmstudio.ai), [LocalAI](https://localai.io), and [text-generation-webui](https://github.com/oobabooga/text-generation-webui).

> Requires 8GB+ VRAM for decent quality. For CPU-only, use smaller models like `llama3.2:3b`.

### Alternative Cloud Providers

The LLM pipeline supports any OpenAI-compatible API. Popular options:

- [Together.ai](https://together.ai) — competitive pricing, many models
- [OpenRouter](https://openrouter.ai) — unified access to 100+ models
- [Grok](https://x.ai/api) — xAI models
- [Anthropic](https://anthropic.com) — Claude

Community PRs for built-in provider support are welcome.

### Troubleshooting

| Issue | Fix |
|-------|-----|
| `DATABASE_URL` not found | Copy `.env.example` to `.env` and verify the variable |
| `P1001: Can't reach database` | Check if PostgreSQL is running: `docker ps \| grep postgres` |
| LLM API errors | Verify keys are valid and have credits |
| `npm install` fails on `hnswlib-node` | You may need `cmake` and `gcc`: `sudo apt install cmake build-essential` |

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Detailed setup guide |
| [Architecture](docs/architecture.md) | System design with diagrams |
| [Emotional System](docs/features/emotional-system.md) | OCC + Plutchik 8-phase pipeline |
| [Memory System](docs/features/memory-system.md) | Vector RAG, HNSWLib, dual memory |
| [Behavior System](docs/features/behavior-system.md) | 13 psychological behavior profiles |
| [Bonds System](docs/features/bonds.md) | Symbolic bonds, decay, queues |
| [Multi-Agent Worlds](docs/features/multi-agent-worlds.md) | Director, scenes, tension |
| [LLM Pipeline](docs/features/llm-pipeline.md) | Dual-provider architecture |
| [Proactive System](docs/features/proactive-system.md) | Autonomous agent messaging |
| [Voice System](docs/features/voice-system.md) | TTS + STT pipeline |
| [API Reference](docs/api-reference.md) | Complete endpoint docs |
| [Deployment](docs/deployment.md) | Docker, infrastructure |
| [Contributing](docs/contributing.md) | Contribution guide |

## Roadmap

- [ ] **WebRTC voice chat** — Real-time voice conversations with agents
- [ ] **Emotion visualization API** — Real-time emotion charts for third-party integrations
- [ ] **Agent marketplace** — Share and discover community-created agents
- [ ] **Plugin system** — Extend agent capabilities with custom tools
- [ ] **Fine-tuning pipeline** — Train models on your agents' conversation history

## Related Projects

| Repository | Description |
|------------|-------------|
| [blaniel-sdk](https://github.com/Lucas-Dono/blaniel-sdk) | Rust NPC SDK (Axum) + Python bindings |
| [blaniel-mobile](https://github.com/Lucas-Dono/blaniel-mobile) | React Native + Expo mobile app |
| [blaniel-mc](https://github.com/Lucas-Dono/blaniel-mc) | Minecraft Fabric 1.20.1 mod |

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](docs/contributing.md) for guidelines.

## License

MIT — use it, build on it, deploy it. Just give credit.
