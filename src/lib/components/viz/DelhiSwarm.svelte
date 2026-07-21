<script>
	// Delhi outline + a geo-anchored pixel swarm. Each place packs its clips into a tidy
	// phyllotaxis disc at its projected lat/lng (deterministic → stable on scrub, no live
	// force sim, no deps). Visibility (from the filter+scrubber) fades pixels in/out.
	import { makeProjection, DELHI_RING, ringPath, phyllotaxis } from '$lib/viz/geo.js';
	import { SOURCE_META } from '$lib/viz/labels.js';

	/** @type {{ clips:any[], places:any[], bbox:any, visibleIds:Set<string>, onselect:(c:any)=>void }} */
	let { clips, places, bbox, visibleIds, onselect } = $props();

	const W = 800;
	const H = 820;
	const project = makeProjection(bbox, W, H, 48);
	const boundary = ringPath(DELHI_RING, project);
	const SPACING = 3.1;

	// project place anchors + a label radius for each cluster
	const anchors = new Map();
	for (const p of places) {
		const q = project(p.lng, p.lat);
		anchors.set(p.key, { x: q.x, y: q.y, name: p.name, count: p.count, r: SPACING * Math.sqrt(p.count) });
	}

	// deterministic per-clip positions (packed within each cluster, ordered by date)
	const nodes = (() => {
		/** @type {Map<string, any[]>} */
		const byPlace = new Map();
		for (const c of clips) {
			if (!byPlace.has(c.place_key)) byPlace.set(c.place_key, []);
			byPlace.get(c.place_key).push(c);
		}
		/** @type {any[]} */
		const out = [];
		for (const [pk, list] of byPlace) {
			const a = anchors.get(pk);
			if (!a) continue;
			list.sort((x, y) => (x.date ?? '').localeCompare(y.date ?? ''));
			list.forEach((c, i) => {
				const { dx, dy } = phyllotaxis(i, SPACING);
				out.push({ ...c, x: a.x + dx, y: a.y + dy, ax: a.x, ay: a.y });
			});
		}
		return out;
	})();

	let hover = $state(/** @type {any} */ (null));
	let tip = $state({ x: 0, y: 0 });
	/** @type {HTMLDivElement} */
	let wrap;

	function onMove(e) {
		const r = wrap.getBoundingClientRect();
		tip = { x: e.clientX - r.left, y: e.clientY - r.top };
	}
	const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
</script>

<div class="mapwrap" bind:this={wrap} onpointermove={onMove}>
	<svg viewBox="0 0 {W} {H}" class="map" role="img" aria-label="Delhi map: {clips.length} clips by location">
		<path class="boundary" d={boundary} />

		<!-- place labels + connector from label to the cluster anchor -->
		{#each [...anchors.values()].filter((a) => a.count >= 3) as a (a.name)}
			<line class="lead" x1={a.x} y1={a.y} x2={a.x} y2={a.y - a.r - 4} />
			<text class="place" x={a.x} y={a.y - a.r - 8} text-anchor="middle">{a.name}<tspan class="pc"> · {a.count}</tspan></text>
		{/each}

		<!-- the swarm: one pixel per clip, opacity driven by the current filter/time window -->
		{#each nodes as d (d.id)}
			{@const vis = visibleIds.has(d.id)}
			<rect
				class="pixel"
				class:graphic={d.graphic}
				x={d.x - 1.3}
				y={d.y - 1.3}
				width="2.6"
				height="2.6"
				fill={SOURCE_META[d.source]?.color ?? 'var(--fg)'}
				style:opacity={vis ? (d.geo === 'inferred' ? 0.55 : 0.92) : 0.05}
				role="button"
				tabindex="-1"
				aria-label={d.title}
				onpointerenter={() => (hover = d)}
				onpointerleave={() => (hover === d ? (hover = null) : null)}
				onclick={() => onselect(d)}
			/>
		{/each}

		<!-- hovered pixel: emphasise + draw its tie to the exact location -->
		{#if hover}
			<line class="hoverlead" x1={hover.ax} y1={hover.ay} x2={hover.x} y2={hover.y} />
			<rect class="hoverbox" x={hover.x - 3} y={hover.y - 3} width="6" height="6" fill={SOURCE_META[hover.source]?.color ?? 'var(--fg)'} />
		{/if}
	</svg>

	{#if hover}
		<div class="tip" style="left:{tip.x}px; top:{tip.y}px">
			<div class="tt-title">{hover.title}</div>
			<div class="tt-meta">
				<span class="src" style="color:{SOURCE_META[hover.source]?.color}">{SOURCE_META[hover.source]?.label}</span>
				· {hover.channel} · {fmtDate(hover.date)}{hover.place ? ` · ${hover.place}` : ''}
			</div>
		</div>
	{/if}
</div>

<style>
	.mapwrap {
		position: relative;
		width: 100%;
	}
	.map {
		display: block;
		width: 100%;
		height: auto;
		background: var(--bg);
	}
	.boundary {
		fill: color-mix(in srgb, var(--surface) 60%, transparent);
		stroke: var(--rule-color);
		stroke-width: 1.25;
	}
	.lead { stroke: var(--faint); stroke-width: 1; }
	.place {
		fill: var(--muted);
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.04em;
	}
	.pc { fill: var(--faint); }
	.pixel {
		shape-rendering: crispEdges;
		cursor: pointer;
		transition: opacity 220ms linear;
	}
	.pixel.graphic {
		stroke: var(--accent);
		stroke-width: 0.6;
	}
	.hoverlead { stroke: var(--accent); stroke-width: 1; }
	.hoverbox {
		shape-rendering: crispEdges;
		stroke: var(--fg);
		stroke-width: 0.8;
	}
	.tip {
		position: absolute;
		transform: translate(12px, 12px);
		max-width: 300px;
		padding: var(--sp-2);
		background: var(--surface);
		border: var(--rule);
		font-family: var(--font-mono);
		pointer-events: none;
		z-index: 5;
	}
	.tt-title {
		font-size: var(--fs-100);
		color: var(--fg);
		margin-bottom: 2px;
		line-height: var(--lh-tight);
	}
	.tt-meta {
		font-size: var(--fs-050);
		color: var(--muted);
	}
	.src { font-weight: var(--fw-bold); }
	@media (prefers-reduced-motion: reduce) {
		.pixel { transition: none; }
	}
</style>
