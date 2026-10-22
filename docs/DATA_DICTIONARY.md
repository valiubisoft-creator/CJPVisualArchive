# Data dictionary — what we can measure

Every dimension the v2 pipeline can capture or derive, by entity, with what it enables analytically. This is the **reference** ("what could we visualize?"); the computed distributions on the *actual* corpus live in the generated [DATA_PROFILE.md](DATA_PROFILE.md).

**Ground rules:** embed-only (no media stored) · **aggregate counts only** (no comment text/authors) · YouTube Data API v3 costs ~**1 unit / 50 videos** (all parts in one call), so capture is cheap; `search` is the scarce part (100 units). Fields marked _derived_ cost no quota (computed by us); _self-sampled_ needs repeated runs.

---

## Per-video (single snapshot) — `videos.list`

| Field | Type | Enables |
|---|---|---|
| `published_at` | datetime | upload timeline, cadence, time-of-day/day-of-week |
| `channel_id` / `channel` | id / string | join to channel; source clustering |
| `title`, `description`, `tags` | text | keyword/theme mining, credit-link extraction, event naming |
| `category_id` (→ `ref/categories.json`) | categorical | News-&-Politics share, category mix |
| `default_audio_language` | BCP-47 | spoken-language distribution (Hindi/English/…) |
| `duration_seconds` | number | length distribution, Shorts vs long-form, raw-vs-edited heuristic |
| `definition` | hd / sd | production-quality proxy, HD-share over time |
| `caption` | bool | accessibility/subtitle-availability rate (existence only, not text) |
| `license` | youtube / creativeCommon | reuse-rights share |
| `age_restricted` (`ytRating`) | bool | graphic/age-restriction proxy |
| `region_restriction` | {allowed?/blocked?} | **geo-censorship footprint** (esp. relevant for rights content) |
| `contains_synthetic_media` | bool | uploader-declared AI/altered-media flag |
| `topic_categories` | list | algorithmic topic mix (Politics/Society/…) |
| `status.upload_status` + `failure/rejection_reason` | enum | availability; **takedown signal** (also see vanished-video detection below) |
| `thumbnails` (+ storyboard `1/2/3.jpg`) | image URLs | perceptual-hashing for the repost network (Phase C) |

## Engagement — aggregate counts only

| Field | Type | Enables |
|---|---|---|
| `stats.views` | number | reach / popularity |
| `stats.likes` | number | positive engagement; like/view ratio |
| `stats.comments` | number | discourse **volume** proxy (the number, never the text) |

_(dislikeCount was removed by YouTube; favoriteCount is dead. Comment text/authors are deliberately **not** captured — PII.)_

## Per-channel — `channels.list` → `channels.json`

| Field | Type | Enables |
|---|---|---|
| `stats.subscribers` | number (3-sig-fig) | reach / influence of a source |
| `stats.videos` | number | prolificacy |
| `stats.views` | number | lifetime aggregate reach |
| `published_at` | datetime | **channel age** — burner vs established account |
| `country` | ISO-3166 | best available geographic provenance of a source |
| `topic_categories`, `keywords` | list / string | thematic identity of the source |

## Live streams (when present) — `liveStreamingDetails`

| Field | Type | Enables |
|---|---|---|
| `live_actual_start` / `_end` | datetime | **real event time & duration** (better than upload time) |
| `concurrentViewers` | number | live audience size — **live-sample only**, not backfillable |

## Temporal & derived (computed — no quota)

| Metric | From | Enables |
|---|---|---|
| upload cadence / bursts | `published_at` per channel | activity spikes around events |
| time-of-day / day-of-week | `published_at` (normalize by channel `country`) | posting rhythm |
| event→upload lag | `published_at` − `live_actual_start` | how fast footage surfaces |
| **view/engagement velocity** | `stats_snapshots.jsonl` (_self-sampled_) | growth-over-time — the **only** path, via repeated `snapshot-stats` runs |
| ratios | likes/views, comments/views | engagement intensity |
| corpus rates | across the set | %HD, %captioned, %CC, %age-restricted, %geo-blocked |
| **vanished videos** | ids requested but not returned on re-sample | removed/private = **takedown** evidence |

## Categorical facets (human-tagged) — see `docs/TAXONOMY.md`

The 8-facet controlled vocabulary (ACLED backbone · Mnemonic multi-boolean · WITNESS ethics) is the analytic spine for distributions and cross-tabs:

F1 action/event · F2 actors (role/type only) · F3 issue/theme · F4 setting · F5 media qualities + content warnings · F6 provenance/verification · F7 geo & time (ACLED columns) · F8 sensitivity/handling.

High-value once tagged: Action×Actors (police-presence by tactic), Issue×Geo, Issue×Time, Verification×Media, the ACLED **escalation ladder** (peaceful → intervention → excessive-force) as a repression index, and actor/issue **co-occurrence** (needs multi-select facets).

## Network (derived — `footage_edges.json` / `footage_clusters.json`)

| Field | Enables |
|---|---|
| edges (`credit-link`, `thumbnail-dhash`) | who reposts whom |
| `footage_cluster_id` + size | "all uploads of the same clip"; spread magnitude |
| in-degree | most-reposted originals |
| `inferred_original` | original-vs-repost (earliest upload) |
| `misattribution_candidate` | shared footage with **conflicting claimed date/location** — the fact-checking payoff |

---

## NOT available via the public API (design around these)

- **Per-video views-over-time** — only via our own `snapshot-stats` sampling.
- **Audience analytics** (demographics, watch-time, traffic, retention, CTR) — owner-only (YouTube Analytics API).
- **Share / repost graph** — not exposed; we **derive** it (Phase C).
- **Related-video graph** — endpoint removed (2023).
- **Reliable per-video geolocation** — `recordingDetails.location` deprecated; parse text instead.
- **Third-party transcripts** — `captions.download` needs owner OAuth; we get subtitle *availability + language*, not text.
- **Exact subscriber count** — rounded to 3 significant figures.
