# CJP Protest Visualiser — Field File

A single-page scrollytelling piece on the CJP protests: the swarm, account withholding, the Jantar Mantar blackout, contested casualty counts, detentions, voter-roll deletions and the state apparatus. Built with anime.js v4.5.0 (`onScroll`), Archivo + Public Sans.

## Open it

No build step. Serve the folder and open `index.html`:

```
npx serve .
```

anime.js and the fonts load from CDNs, so it needs a network connection.

## Folder

| Path | What it is |
|---|---|
| `index.html` | The scrollytelling piece |
| `index-v1-slides.html` | Earlier click-through version |
| `tools/cdp-scroll.mjs` | Headless-Chrome scroll QA: `SIZE=1440,900 node tools/cdp-scroll.mjs <url> <outDir> targets.json` |
| `qa/` | QA screenshots (desktop + mobile) |
| `data/` | Datasets from the earlier SvelteKit archive (channels, events, footage clusters/edges, timeline clips, stats snapshots, vocab, ref lists, event schema) |
| `curation/` | Raw curation pulls and tag audits (gitignored) |
| `assets/`, `static/` | Cursor, favicon, fonts and audio |
| `docs/`, `Prior-Art Research/` | Curation, anonymisation, sourcing/takedown docs and prior-art research |

The earlier SvelteKit video-wall app is in git history (branches `main`, `feat/intro-landing-screen`, `v2-data-foundation`).

Figures marked "claimed" or "unverified" in the piece are the movement's own numbers and have not been independently confirmed.
