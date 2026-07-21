# Anonymization (`deface`)

This is a **local curation step**, not part of the live site. It runs on your machine before you commit any image you generated yourself.

## The limitation you must be upfront about

The site **embeds** video and never downloads or rehosts it (PRD §3). A playing YouTube clip lives inside a cross-origin `<iframe>` — its pixels are **unreadable** to our page (same-origin policy), and the IFrame API exposes only play/seek/volume, never frame data. CSS `filter: blur()` would blur the whole player and is trivially reversible.

**Consequence:** the footage that actually plays is the original, unredacted source. We cannot blur faces in it. The site says so plainly (see the "About this archive" notice) rather than implying the archive is redacted.

So `deface` applies **only to imagery you create yourself** — a custom thumbnail, a review frame, an exported still — never the embedded player.

## What to redact

- **Default: redact bystander and crowd faces.**
- **Exception: do NOT redact people knowingly, publicly representing the movement** — speakers at a podium, named organizers. (PRD §4.5 / §6.3.)
- Faces aren't the only identifier — also consider tattoos, distinctive clothing, signs, and **metadata** (strip EXIF/location).

## How (mosaic/solid, not soft blur)

Install once: `pip install deface`

```bash
# Solid boxes (irreversible) — preferred default:
deface review-frame.jpg --replacewith solid

# Mosaic — also irreversible, keeps rough composition:
deface review-frame.jpg --replacewith mosaic

# A video you generated yourself (NOT a downloaded source clip):
deface my-still-sequence.mp4 --replacewith mosaic
```

Use **`solid` or `mosaic`, never soft gaussian** — soft blur is sometimes partially reversible by other models; mosaic/solid isn't a judgment call you have to revisit.

Then strip metadata from the output, e.g.:

```bash
exiftool -all= redacted-output.jpg
```

## QA checklist (do not skip)

`deface`'s detector (CenterFace) is fast but dated and **misses small, profile, or occluded faces** common in crowds. Every output gets a human pass:

- [ ] Scrub the whole image/clip — did any face survive? Re-run with a lower threshold (`--thresh 0.15`) or a stronger detector (YOLO-face / RetinaFace) and box it manually if needed.
- [ ] Public organizers intentionally left visible; everyone else redacted.
- [ ] Other identifiers (signs, tattoos, plates) considered.
- [ ] Metadata stripped.
- [ ] Redaction is `solid`/`mosaic`, not soft blur.

Only after QA does the image go into the repo.
