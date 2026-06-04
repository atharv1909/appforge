# AppForge — AI App Compiler

> Natural Language → Validated, Executable App Architecture

Live URL: https://appforge-nu.vercel.app

## What It Does

AppForge converts a plain English app description into a complete, validated, cross-consistent application architecture through a 6-stage compiler pipeline.

## Pipeline Stages

1. **Intent Extraction** — Parses user prompt into structured JSON (domain, entities, roles, features, assumptions, conflicts)
2. **System Design** — Converts intent into architecture (pages, flows, entity relations, navigation)
3. **Schema Generation** — Generates all 4 schemas simultaneously (UI, API, DB, Auth)
4. **Validation** — 15 cross-layer consistency checks in pure logic (no AI)
5. **Repair** — Surgical auto-repair of inconsistencies (not brute retry)
6. **Runtime Simulation** — Generates executable React, Express, and SQL stubs + ERD diagram

## Output

- UI Schema (pages, components, layouts)
- API Schema (endpoints, methods, auth, request/response fields)
- DB Schema (tables, columns, types, foreign keys, indexes)
- Auth Rules (JWT, roles, permissions, protected routes)
- React component stubs
- Express route stubs
- SQL migration file
- Entity Relationship Diagram (auto-generated SVG)

## Validation Engine

Runs 15 checks across all layers:
- UI components reference valid API endpoints
- API endpoints reference valid DB tables
- API request fields exist as DB columns
- Auth roles match intent roles
- Protected routes match UI pages
- No duplicate tables or endpoints
- Users table exists when auth required
- And more...

## Evaluation Results

| Metric | Value |
|--------|-------|
| Success Rate | 95% (19/20 prompts) |
| Edge Case Success | 100% (10/10) |
| Avg Latency | ~22s |
| Repairs Triggered | 11 |
| Cost | $0.00 |

## Cost vs Quality

| Mode | Temperature | Max Tokens | Latency |
|------|-------------|------------|---------|
| Fast | 0.3 | 2,048 | ~8s |
| Balanced | 0.2 | 4,096 | ~15s |
| Deep | 0.1 | 5,500 | ~25s |

## Tech Stack

- **Frontend:** Next.js 14 + Tailwind CSS
- **AI:** Groq API (llama-3.1-8b-instant) — free tier
- **Validation:** Zod schemas + custom cross-layer checks
- **Deploy:** Vercel

## Local Setup

```bash
git clone https://github.com/atharv1909/appforge
cd appforge
npm install
```

Add `.env.local`:
```
GROQ_API_KEY=your_groq_key
GROQ_API_KEY_2=your_second_groq_key
```

```bash
npm run dev
```

Open http://localhost:3000
