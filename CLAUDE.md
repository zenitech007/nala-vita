## Project: Nala Vita (MediConnect)

Single Next.js 14 App Router project at this directory root. Patient-doctor medical platform — route groups `(patient)/(doctor)/(admin)/(auth)` under `src/app/`. Stack: Next 14, TypeScript, Prisma 7, Supabase (PostgreSQL + Auth + Storage + Realtime), Tailwind 3, OpenAI, jest, next-intl.

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read `graphify-out/GRAPH_REPORT.md` before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF `graphify-out/wiki/index.md` EXISTS, navigate it instead of reading raw files.
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## History

This repo was relocated on 2026-05-22 from `C:\Users\IKA\Med connect\` to its current location, replacing the older AI-assistant ("Amelia") implementation that lived at `nalavita-frontend/`. The legacy git histories are preserved as bundle files in `.archive/` (gitignored). The original Med connect folder remains at its old path as a backup until manually deleted.

## Pre-pivot planning artifacts

`docs/superpowers/plans/2026-05-21-mediconnect-pivot-*.md` were written before the relocation, planning a from-scratch pivot of the Amelia codebase. They are now **superseded** — see banners at the top of each file — but kept for the gap analysis and the Stripe/payments work still pending.
