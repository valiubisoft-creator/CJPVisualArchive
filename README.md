# CJP Protest Video Wall

A static, manifest-driven tile wall of **curated, verification-labelled** video documentation of the 2026 CJP protests in Delhi. It shows what's circulating, from whom, and how verified — a "nervous system" view, not a live feed.

- **Embed, never rehost** — YouTube's own player renders every clip; we store nothing.
- **Every tile carries a visible verification status** — no "default confirmed."
- **Zero backend** — a single JSON file rendered to a fully-prerendered static site.

This is **v1**. v2 (reposting-network graph, geospatial-map cross-reference) is out of scope — see [the plan](../../.claude/plans/) and `CJP_Protest_Video_Wall_PRD.md`.

## Quickstart

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # prerender to build/ (runs schema validation first)
npm run preview    # serve the built static site
```

## How it works — two separated halves

```
 OFFLINE curation (holds the API key)          PUBLIC static site (no key, no backend)
 scripts/ingest.mjs   → discover candidates     reads src/lib/data/events.json
 InVID-WeVerify       → vet                      renders the tile grid
 scripts/add-event.mjs → validate + append  ──▶  click → YouTube IFrame player
   src/lib/data/events.json  (source of truth)   status badges + status/source filter
```

`events.json` is the single source of truth. The browser never calls the YouTube API and never sees the key.

## Project structure

| Path | What |
|---|---|
| `src/lib/data/events.json` | **Source of truth** — one record per clip |
| `src/lib/schema/event.schema.json` | Schema enforced by the CLI and CI |
| `src/lib/styles/tokens.css` | **Source of truth for the look** — see below |
| `src/lib/components/` | `TileGrid`, `VideoTile`, `YouTubePlayer`, `VerificationBadge`, `FilterBar`, `Footer`, `ConcernNotice` |
| `scripts/` | Offline curation CLI (`ingest`, `add-event`, `validate`) |
| `docs/` | [CURATION](docs/CURATION.md) · [ANONYMIZATION](docs/ANONYMIZATION.md) · [SOURCING_TAKEDOWN](docs/SOURCING_TAKEDOWN.md) |

## Scripts

| Command | Does |
|---|---|
| `npm run ingest -- --q '…' --after … --before …` | Discover + hydrate YouTube candidates → `curation/candidates.json` |
| `npm run add-event -- --youtube-id … --title … …` | Validate + append a curated record to `events.json` |
| `npm run validate` | Fail if `events.json` breaks the schema (also runs on `prebuild`) |

## Design tokens (v2 de-risk)

The whole look is a Forensic-Architecture-inspired minimalist/brutalist system driven by **~15 CSS custom properties in [`src/lib/styles/tokens.css`](src/lib/styles/tokens.css)**. Every component styles itself from `var(--…)` only — no hard-coded colours. **To re-skin the entire app, edit that one file.** If the aesthetic isn't working in v2, swap the token file and nothing else.

## Deploy (Vercel)

The site is fully static (`@sveltejs/adapter-static`, `prerender = true`), so Vercel builds and serves it with no server:

- Framework preset: **SvelteKit**, or set Build Command `npm run build`, Output Directory `build`.
- No env vars needed at build/deploy time (the API key is only for local curation).
- Redeploys on push to `main`.

## Boundaries (see [SOURCING_TAKEDOWN](docs/SOURCING_TAKEDOWN.md))

No face recognition/matching · no downloading or rehosting video · no search by individual person · no automated X/Instagram pulls · every clip status-labelled.
