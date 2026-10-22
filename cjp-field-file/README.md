# CJP Field File — scrollytelling

A single-page scrollytelling piece on the CJP protests: the swarm, account withholding, the Jantar Mantar blackout, contested casualty counts, detentions, voter-roll deletions and the state apparatus.

- `index.html` — the scrollytelling version (sticky graphic + scrolling steps, anime.js v4.5.0 `onScroll`).
- `index-v1-slides.html` — earlier click-through version, kept for reference.
- `tools/cdp-scroll.mjs` — headless-Chrome QA script: `SIZE=1440,900 node tools/cdp-scroll.mjs <url> <outDir> targets.json`.

No build step. Serve the folder (e.g. `npx serve cjp-field-file`) and open it; anime.js and fonts (Archivo, Public Sans) load from CDNs, so it needs a network connection.

Figures marked "claimed" or "unverified" in the piece are the movement's own numbers and have not been independently confirmed.
