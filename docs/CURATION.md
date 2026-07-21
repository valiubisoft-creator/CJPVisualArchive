# Curation workflow

The site renders a single flat file — [`src/lib/data/events.json`](../src/lib/data/events.json) — which is the **source of truth**. Curation is the offline process of getting well-vetted records into that file. Nothing here runs on the live site.

```
discover → vet → set status → promote → validate → deploy
(ingest)  (InVID)          (add-event) (validate)  (git push)
```

## 0. One-time setup

1. `cp .env.example .env.local` and paste your YouTube Data API key into `YT_API_KEY`.
   `.env.local` is git-ignored — **never commit it.**
2. Get a key: Google Cloud Console → enable **YouTube Data API v3** → Credentials → API key → restrict it to that API.

## 1. Discover candidates — `npm run ingest`

Runs `search.list` (discover) → `videos.list` (hydrate) and writes `curation/candidates.json` (git-ignored scratch). It **never** edits `events.json`.

```bash
node scripts/ingest.mjs \
  --q '(protest|rally|march|dharna|andolan) ("New Delhi"|Delhi|"Jantar Mantar"|"India Gate")' \
  --after 2026-05-01 --before 2026-08-01 \
  --region IN --lang en --order relevance --pages 2
```

- **Quota:** `search.list` = 100 units/call; `videos.list` = 1 unit/50 ids; default daily quota 10,000. `--pages 2` ≈ 200 units. Run a **handful of deliberate queries**, not continuous polling.
- Vary `--order` (`relevance`, `date`, `viewCount`) and `--lang` (`en`, `hi`) across runs for coverage.
- Geo (`location`/`radius`) is deliberately not wired in as a primary filter — most uploads aren't geotagged, so it has poor recall. Place-scope through the query text + `--region IN`.
- Candidates are pre-filtered to embeddable, public, non-region-blocked-for-IN clips.

## 2. Vet each candidate (the human step)

For every candidate you're considering, before it can be `confirmed`:

1. Run it through **InVID-WeVerify** (free browser plugin): keyframe extraction, reverse-image search on frames, metadata check.
2. Cross-check the **claimed date and location** against at least one independent source.
3. Apply the **ethics screen** ([SOURCING_TAKEDOWN.md](SOURCING_TAKEDOWN.md)): consent cues, at-risk sources, graphic-content threshold.

Then choose a status:

| Status | Meaning |
|---|---|
| `confirmed` | Verified authentic against ≥1 independent source |
| `reported` | Claimed but not yet independently cross-checked |
| `recycled-footage` | Traced to an earlier, unrelated event |
| `unverified` | Not yet run through the workflow |

## 3. Promote to `events.json` — `npm run add-event`

Validates against the schema **before** writing — a malformed record never lands.

```bash
node scripts/add-event.mjs \
  --youtube-id dQw4w9WgXcQ \
  --title "Crowd gathers at Patel Chowk" \
  --channel "Some Channel" \
  --source-type citizen \
  --status reported \
  --date-claimed 2026-07-20 \
  --location "Patel Chowk, New Delhi" \
  --theme "assembly,march" \
  --by vali \
  --notes "InVID keyframes match; date cross-checked vs local report."
```

- `id` is auto-assigned (`evt_####`); `added_at` defaults to now; `added_by` falls back to `$USER`.
- Add `--graphic` for footage that should sit behind the click-to-reveal interstitial.
- To promote a hydrated candidate wholesale, pass `--json '<record>'`.
- **Manual (non-YouTube) sources** — X/Twitter, Instagram, Reddit have no automated pull (PRD §3/§5). Log those by hand with `add-event.mjs`, same schema.

## 4. Validate & deploy

```bash
npm run validate   # also runs automatically on `npm run build` (prebuild hook) and in CI
npm run build      # fails the build if events.json breaks the schema
git add src/lib/data/events.json && git commit && git push   # Vercel redeploys
```

## Related

- [ANONYMIZATION.md](ANONYMIZATION.md) — the `deface` step for any imagery you generate yourself.
- [SOURCING_TAKEDOWN.md](SOURCING_TAKEDOWN.md) — sourcing policy, ethics, takedown handling.
