# Sourcing, ethics & takedown policy

## What this archive is

A curated, verification-labelled index of video documentation of the 2026 CJP protests in Delhi. It is **documentation and archive**, not surveillance or identification. It is **not a live feed** — it is deliberately, slowly curated.

## Sourcing rules

- **Embed, never rehost.** Video is embedded from its original platform via the YouTube IFrame Player (privacy-enhanced `youtube-nocookie.com`). We never download or store the source file. A consequence: we cannot anonymize the embedded footage itself (see [ANONYMIZATION.md](ANONYMIZATION.md)).
- **YouTube** is the only automated source, via the YouTube Data API v3, in a handful of deliberate queries.
- **X/Twitter and Instagram** have no workable open API — content from them is logged manually by URL, never scraped.
- **Every clip carries a visible verification status.** There is no "default confirmed." An `unverified` label is not a claim of fact.

## Hard boundaries (never build toward these)

- **No face recognition or face-matching** of any kind. Redacting a face is fine; matching a face across clips is not.
- **No search or filter by individual identifiable person.** Filters are theme, date, verification status, and source type only.

## Ethical framework — WITNESS

We follow WITNESS's *Ethical Guidelines for Using Eyewitness Videos in Human Rights Reporting and Advocacy* and *Video as Evidence* field guide. Built-in, not just policy:

- **Minimize harm to the people filmed**, as a design constraint.
- **Read visual consent cues** — a protester facing the camera and chanting is different from a bystander incidentally in frame; treat them differently.
- **Protect at-risk sources** — nothing about the site (metadata, framing) should make it easier to identify who filmed something.
- **A pre-decided graphic-content threshold** — what we won't show regardless of newsworthiness. Sensitive clips sit behind a click-to-reveal interstitial (`graphic_content` flag).

## Legal note — India (DPDPA 2023)

India's Digital Personal Data Protection Act (Rules cleared Nov 2025) has **no journalism exemption**, and **biometric data is sensitive personal data**. This is the practical argument for the boundaries above: redacting faces removes identifying data; matching faces processes sensitive data to identify someone — only the first should ever exist here. Keep the project consistently framed as documentation/archive (a narrower research/archiving exemption). *This is not legal advice; if scope or visibility grows, consult an India-based media/tech lawyer.*

## Takedown / report a concern

If you find yourself in footage indexed here, or have a concern about a clip, contact **concerns@example.org** *(replace with the real address before launch)*. We will review and, where appropriate, remove the entry from this index. Because we only embed, removing our entry stops us surfacing it; the original remains on its host platform, which you may contact separately.
