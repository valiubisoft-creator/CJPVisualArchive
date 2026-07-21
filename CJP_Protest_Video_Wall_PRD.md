# PRD: CJP Protest Video Documentation Wall

**Status:** Draft v1, ready for Claude Code hand-off
**Owner:** Vali
**Sibling project:** Geospatial flashpoints map (separate PRD, not covered here, referenced in v2)

---

## 1. Background

A tile-based archive of video documentation from the 2026 CJP (Cockroach Janta Party) protests in Delhi, sourced from YouTube and manually curated from other platforms. The goal is a "nervous system" view of the protest: what's circulating, from whom, and how verified it is, not a live feed, a curated and continuously updated archive.

This is phase one of a two-part piece. Phase two (v2) connects this video archive to the geospatial map project for a layered, cross-referenced narrative. Build v1 completely before starting v2.

---

## 2. Goals

- **v1:** A simple, embeddable video tile wall. Curated videos, verification status visible per tile, zero backend, cheap to run indefinitely.
- **v2 (future, not this build):** Thematic clustering, a reposting-network view (who's sharing what, from where), and cross-referencing with the geospatial map so the two pieces read as one layered story.

---

## 3. Non-goals and hard boundaries

Read this before writing any code. These aren't preferences, they're constraints.

- **No face recognition or face-matching.** Blurring/redacting a face is fine. Matching a face across multiple clips, or building any "find this person" capability, is not. Do not build it, do not scaffold toward it.
- **No downloading or rehosting source video.** Embed only, via the YouTube IFrame Player API. The platform's own player renders the video; you never store the file.
- **No treating unverified footage as fact.** Every tile carries a visible verification status. There is no "default confirmed."
- **No search/filter by individual identifiable person.** Filters are by theme, date, verification status, and source type only.
- **No automated pulls from X/Twitter or Instagram.** Neither has a workable free API anymore (see Section 5.2). Content from those platforms is logged manually, by URL, same as the map project.

---

## 4. v1 scope: the video tile wall

### 4.1 Core features
- Grid of curated video tiles (thumbnail, title, source channel, claimed date, theme tag(s), verification badge)
- Click a tile → YouTube IFrame Player loads and plays in place
- Filter by theme and by verification status
- Footer: methodology note, last-updated timestamp, link to sourcing/takedown policy

### 4.2 Data sourcing
- **YouTube Data API v3** for structured keyword search. Quota-aware: default 10,000 units/day, and a single `search.list` call costs 100 units, so roughly 100 searches/day is the practical ceiling with no self-serve way to raise it. Design the pull as a handful of deliberate daily queries, not continuous polling.
- **X/Twitter:** not used as an automated source. X removed free API access entirely in February 2026 and moved to pay-per-use pricing, so this isn't a casual scraping target anymore. If X content matters, save the URL manually.
- **Instagram/Meta:** similarly gated behind business verification, not built for this kind of open research pull. Manual logging only.
- **Reddit:** has a workable light-access tier if relevant threads are circulating footage, worth a look but not a v1 priority.

### 4.3 Verification workflow
Before a video's status can be set to "confirmed":
1. Run it through **InVID-WeVerify** (free browser plugin, actively maintained): keyframe extraction, reverse image search on frames, metadata check.
2. Cross-check the claimed date and location against at least one independent source.
3. Set status: `confirmed` / `reported` / `recycled-footage` / `unverified`.

The badge is visible on the tile itself, not hidden in a tooltip or detail view.

### 4.4 Data schema

```json
{
  "id": "evt_0001",
  "youtube_id": "XXXXXXXXXXX",
  "title": "",
  "channel": "",
  "published_at": "2026-07-20T09:14:00Z",
  "date_claimed": "2026-07-20",
  "location_claimed": "Patel Chowk, New Delhi",
  "theme": ["police-action", "tear-gas"],
  "source_type": "citizen | mainstream-media | party-channel",
  "verification_status": "confirmed | reported | recycled-footage | unverified",
  "verification_notes": "",
  "reposted_from": null,
  "added_by": "",
  "added_at": ""
}
```

Single `events.json` file, committed to the repo, is the source of truth.

### 4.5 Anonymization pipeline
This applies to any imagery you generate or store yourself (custom thumbnails, review frames, exported stills). It does not apply to the embedded YouTube player itself, since you don't control that file, see the limitation noted in Section 6.3.
- Run any self-generated frames through **`deface`** (CLI, `pip install deface`) before saving or displaying.
- Default redaction mode: mosaic or solid box, not soft gaussian blur. Soft blur is sometimes reversible by other models; mosaic/solid isn't a judgment call you have to revisit later.
- Exception: don't blur people who are knowingly, publicly representing the movement (speakers at a podium, named organizers). Bystanders and crowd faces get redacted by default.

### 4.6 Recommended stack
- Static site, no backend. Same reasoning as the map project: small dataset, no ongoing hosting cost, nothing to secure.
- Vite + vanilla JS, or Svelte if you want to match the map project's stack.
- YouTube IFrame Player API for embeds.
- `events.json` edited directly or through a small local CLI script that enforces the schema on write.
- Deploy to GitHub Pages or Vercel.

### 4.7 Explicitly out of scope for v1
- Thematic clustering or force-directed graphs
- Reposting-network visualization
- ACLED backbone layer
- Cross-referencing with the geospatial map
- Any automated/AI theme tagging

---

## 5. v2 scope (future, do not build yet)

- **Reposting network view:** nodes are videos, sized by views or reshare velocity, positioned by theme cluster, edges connect clips that got reposted across different channels. This is the actual "who's circulating what" story.
- **Theme taxonomy:** refine from v1's manual tags. An LLM can suggest first-pass clusters from titles/descriptions/thumbnails, but a human confirms every tag, no auto-publish.
- **Cross-reference with the geospatial map:** clicking a location on the map surfaces videos tagged with that location, and vice versa. This is the bridge that makes the two pieces read as one layered narrative rather than two separate tools.
- **ACLED backbone layer:** optional ambient context once both pieces are stable.

---

## 6. Data governance and ethics

### 6.1 Legal ground, India-specific

India's Digital Personal Data Protection Act, 2023 (DPDPA), with Rules cleared in November 2025, does not include a journalism exemption the way GDPR does. There's no automatic carve-out for "this is public-interest reporting" the way there might be elsewhere, so this project should treat identifying details in the dataset with real caution rather than leaning on a press-freedom assumption that isn't legally guaranteed here.

Biometric data is classified as sensitive personal data under the Act. That's a strong practical argument for the hard boundary in Section 3: redacting faces is removing identifying data, matching faces across clips is processing sensitive data to identify someone, and only one of those should exist in this project.

Processing for research, archiving, or statistical purposes has a narrower exemption under the Act, worth keeping the project framed consistently as documentation and archive rather than anything closer to surveillance or identification.

This is not legal advice. If the project grows in scope or public visibility, a real conversation with an India-based media/tech lawyer is worth having.

### 6.2 Ethical framework

Adopt WITNESS's ethical guidelines for eyewitness video rather than improvising a house policy. Core principles to build into the product itself, not just a policy page:

- Minimize harm to the people filmed, as a design constraint, not just a legal one.
- Read visual consent cues: a protester facing the camera and chanting is different from a bystander incidentally caught in frame. Treat them differently in how (or whether) they're shown.
- Protect at-risk sources: if an uploader could face retaliation for having filmed something, nothing about your site (metadata, link structure, framing) should make it easier to identify who they are.
- Decide your graphic-content threshold upfront: what you won't show regardless of how "real" or newsworthy it is.

Further reading: WITNESS's *Ethical Guidelines for Using Eyewitness Videos in Human Rights Reporting and Advocacy*, and their *Video as Evidence* field guide. Both are free and written for exactly this situation.

### 6.3 Practical defaults for this build

- Blur bystander faces by default in anything self-generated; never blur people who are clearly, intentionally public.
- No feature that filters or searches for a specific individual across clips.
- Embed only, never download or rehost source video (this also means you can't guarantee anonymization of the original YouTube-hosted footage itself, only of material you generate; be upfront about that limitation rather than implying the whole archive is redacted).
- A visible "report a concern" or takedown contact on the site, for anyone who finds themselves in footage and wants it addressed.

---

## 7. Build sequence for Claude Code

1. Scaffold the static site (Vite, chosen framework), no backend.
2. Build the `events.json` loader and tile grid renderer.
3. Integrate YouTube IFrame Player API for click-to-play.
4. Build the verification-status badge (color-coded, visible on the tile).
5. Build theme and status filters.
6. Build the footer (methodology, last-updated timestamp, sourcing/takedown link).
7. Write a small local CLI/script that appends new entries to `events.json` and validates against the schema before writing.
8. Wire up `deface` as a documented step in the curation workflow for any self-generated imagery (not part of the live site, part of your local process).
9. Deploy to GitHub Pages or Vercel.

---

## 8. Open decisions (ask Vali, don't guess)

- Hosting: GitHub Pages vs. Vercel.
- Framework: vanilla JS vs. Svelte (Svelte would match the map project's stack).
- Curation workflow: direct JSON edits vs. a small local form/CLI.
- Does v1 ship with theme filters at launch, or verification-status filtering first and themes added once there's enough curated volume to make categories meaningful.

---

## 9. Reference projects (prior art)

See chat for full descriptions. In short:
1. **Forensic Architecture** (forensic-architecture.org) — video-based spatial reconstruction of protest violence, closest methodological precedent for the "forensic" half of this project.
2. **Josh Begley**, *Officer Involved* (joshbegley.com) — video mosaic stitched from over 1,100 individual sites, closest aesthetic precedent for the tile-wall-as-nervous-system idea.
3. **Mnemonic / Syrian Archive** (syrianarchive.org) — open-source tooling for scraping, verifying, and preserving citizen video from YouTube, closest precedent for the actual data pipeline.

## 10. Tools referenced in this PRD

- YouTube Data API v3 + IFrame Player API
- InVID-WeVerify (browser plugin, verification)
- `deface` (CLI, video/image anonymization) — github.com/ORB-HD/deface
- WITNESS Ethical Guidelines for Using Eyewitness Videos, and the Video as Evidence field guide — witness.org
