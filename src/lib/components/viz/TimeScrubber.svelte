<script>
	// Zero-dep SVG scrubber (per the timeline research; FA's timemap is the model).
	// Linear date↔x map, pointer-capture drag, per-<line> "watch spoke" ticks, month
	// majors. `value` (epoch ms) is bindable — the page reveals clips with date ≤ value.
	import { onMount } from 'svelte';

	/** @type {{ min:string, max:string, value:number }} */
	let { min, max, value = $bindable() } = $props();

	const PAD = 20;
	const t0 = Date.parse(min);
	const t1 = Date.parse(max);
	let W = $state(720);
	let dragging = $state(false);
	/** @type {SVGSVGElement} */
	let svgEl;

	const clamp01 = (f) => Math.max(0, Math.min(1, f));
	const xOf = (t) => PAD + clamp01((t - t0) / (t1 - t0)) * (W - 2 * PAD);
	const tOf = (x) => t0 + clamp01((x - PAD) / (W - 2 * PAD)) * (t1 - t0);

	const playheadX = $derived(xOf(value));

	// one spoke per day; majors on month starts
	const ticks = $derived.by(() => {
		/** @type {{t:number, major:boolean, month?:string}[]} */
		const out = [];
		const d = new Date(t0);
		d.setUTCHours(0, 0, 0, 0);
		while (d.getTime() <= t1) {
			const major = d.getUTCDate() === 1;
			out.push({
				t: d.getTime(),
				major,
				month: major ? d.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }) : undefined
			});
			d.setUTCDate(d.getUTCDate() + 1);
		}
		return out;
	});

	const readout = $derived(
		new Date(value).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
	);

	function tFromEvent(e) {
		const r = svgEl.getBoundingClientRect();
		return tOf(((e.clientX - r.left) / r.width) * W);
	}
	function down(e) {
		dragging = true;
		svgEl.setPointerCapture(e.pointerId);
		value = tFromEvent(e);
	}
	function move(e) {
		if (dragging) value = tFromEvent(e);
	}
	function up(e) {
		dragging = false;
		try { svgEl.releasePointerCapture(e.pointerId); } catch { /* noop */ }
	}
	function key(e) {
		const day = 86400000;
		const step = (e.shiftKey ? 7 : 1) * day;
		if (e.key === 'ArrowLeft') { value = Math.max(t0, value - step); e.preventDefault(); }
		if (e.key === 'ArrowRight') { value = Math.min(t1, value + step); e.preventDefault(); }
		if (e.key === 'Home') { value = t0; }
		if (e.key === 'End') { value = t1; }
	}

	onMount(() => { if (value == null) value = t1; });
</script>

<div class="scrubber" bind:clientWidth={W}>
	<div class="head">
		<span class="cap">Timeline</span>
		<span class="readout">▸ {readout}</span>
	</div>
	<svg
		bind:this={svgEl}
		viewBox="0 0 {W} 60"
		height="60"
		role="slider"
		tabindex="0"
		aria-label="Reveal clips up to date"
		aria-valuemin={t0}
		aria-valuemax={t1}
		aria-valuenow={value}
		aria-valuetext={readout}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onkeydown={key}
	>
		<line class="axis" x1={PAD} y1="34" x2={W - PAD} y2="34" />
		{#each ticks as tk (tk.t)}
			<line
				class="tick"
				class:major={tk.major}
				class:past={tk.t <= value}
				x1={xOf(tk.t)}
				x2={xOf(tk.t)}
				y1={tk.major ? 20 : 27}
				y2={tk.major ? 48 : 41}
			/>
			{#if tk.month}
				<text class="month" x={xOf(tk.t)} y="12">{tk.month}</text>
			{/if}
		{/each}
		<!-- filled portion up to the playhead -->
		<line class="filled" x1={PAD} y1="34" x2={playheadX} y2="34" />
		<g transform="translate({playheadX},0)">
			<line class="playhead" x1="0" x2="0" y1="16" y2="52" />
			<path class="cap-tri" d="M-6 0 L6 0 L0 9 Z" transform="translate(0,10)" />
		</g>
	</svg>
</div>

<style>
	.scrubber {
		width: 100%;
		user-select: none;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-family: var(--font-mono);
		margin-bottom: var(--sp-1);
	}
	.cap {
		font-size: var(--fs-050);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.readout {
		font-size: var(--fs-100);
		color: var(--fg);
	}
	svg {
		display: block;
		width: 100%;
		touch-action: none;
		cursor: ew-resize;
	}
	svg:focus-visible {
		outline: var(--focus-ring);
		outline-offset: 2px;
	}
	.axis { stroke: var(--faint); stroke-width: 1; }
	.filled { stroke: var(--rule-color); stroke-width: 1; }
	.tick { stroke: var(--faint); stroke-width: 1; }
	.tick.past { stroke: var(--muted); }
	.tick.major { stroke: var(--muted); stroke-width: 1.5; }
	.tick.major.past { stroke: var(--fg); }
	.month {
		fill: var(--muted);
		font-family: var(--font-mono);
		font-size: 10px;
		text-anchor: middle;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.playhead { stroke: var(--accent); stroke-width: 2; }
	.cap-tri { fill: var(--accent); }
</style>
