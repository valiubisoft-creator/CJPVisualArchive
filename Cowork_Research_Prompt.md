# Prompt for Cowork: prior-art research for the protest video wall project

Copy everything below into Cowork as a single task.

---

## Context

I'm building a video documentation tile wall (v1) that will later connect to a companion geospatial map project (v2). It curates protest-related video footage, shows a verification status per clip, and embeds rather than rehosts video. This research feeds directly into a Claude Code build session, so the output needs to be implementation-focused, not a design essay.

Three reference projects have already been identified as the closest prior art:

1. **Forensic Architecture**, forensic-architecture.org, an interdisciplinary agency that reconstructs incidents of state violence from crowdsourced video, testimony, and 3D modeling.
2. **Josh Begley**, joshbegley.com, a data artist whose piece *Officer Involved* stitches satellite imagery from over 1,100 sites into a single video.
3. **Mnemonic / Syrian Archive**, syrianarchive.org, an organization with open-source tooling for scraping, verifying, and preserving citizen video from YouTube.

Please research all three, plus the two follow-up sections below, and compile everything into one structured document.

---

## Task 1: Per-project deep dives

For each of the three projects:

- Visit the live site and take screenshots of: the homepage/landing view, the primary visualization or interaction pattern, and any timeline, map, or video component present.
- Check whether the project has a public GitHub repository. If one exists, note the tech stack (languages, frameworks, key libraries) and pull 2 to 3 short, illustrative code snippets relevant to any of: video or media embedding, tagging or verification-status badges, filterable grid or card layouts, responsive tile components.
- If no public repo exists, document the UI/UX pattern through screenshots and written description instead of code. Say plainly when this is the case rather than guessing at an implementation.
- For Forensic Architecture specifically: check whether their 3D reconstruction work is delivered as an interactive WebGL scene the visitor can navigate in-browser, or as a pre-rendered video output from 3D modeling software. This distinction matters a lot for whether it's a directly reusable web pattern, note it explicitly either way.
- Write a 150 to 250 word summary per project covering what they built, how, and 2 to 3 patterns specifically transferable to a video tile wall project.

---

## Task 2: Cutting-edge UI library shortlist

Research current, actively maintained frontend libraries well suited to this project's needs: card/tile grids, filter and tag systems, status badges, video embed components, all inside a static site with no backend.

- Prioritize libraries with real adoption in journalism, civic tech, or data-documentary contexts over generic marketing-template libraries.
- For each of 6 to 10 candidates, give: name, link, one line on its strengths, one line on fit for this specific project.
- Cover at minimum: layout/grid systems, component primitives, animation/interaction libraries, and any video-embed helper libraries worth knowing about.

---

## Task 3: 3D WebGL and Three.js precedents

This is a separate section, broader than the three projects above, since they may not be strong 3D examples on their own.

- Search specifically for protest, conflict, human-rights, or civic data-storytelling projects that use Three.js or raw WebGL for spatial or 3D storytelling, not generic Three.js portfolio demos.
- Starting points to check: the NYT Visual Investigations team's interactive pieces, Bellingcat's satellite and geolocation visual work, any Forensic Architecture case pages with embedded 3D viewers, and Pudding-style scrollytelling pieces that use WebGL or 3D scenes.
- For each finding: a screenshot, a brief description of the specific 3D technique used, and an honest read on whether 3D genuinely adds value for this kind of documentary/evidentiary project or whether it would read as a gimmick.
- Specifically flag any examples of 3D network or force-directed graph visualization, since a future version of this project (not this build) may visualize a video reposting network, and 3D versions of that pattern are worth knowing about even if not used immediately.

---

## Output format

Compile everything into a single structured markdown document, with a subfolder of screenshots referenced inline near the relevant findings.

Structure:
1. A 3 to 5 sentence recommendations summary at the very top.
2. The three per-project deep dives.
3. The UI library shortlist.
4. The 3D/WebGL section.
5. A closing note: a recommended stack for v1, given everything found.

Keep the tone practical throughout, this document exists to save a developer research time before a build session, not to argue a design point of view. Note explicitly anywhere you couldn't find something rather than filling the gap with a guess. Stay scoped to the design and technical patterns of these reference projects, this research task doesn't need to cover the protest movement itself.

Save the final document and its screenshots folder somewhere clearly named so it can be handed directly to a Claude Code session as project context.
