<script>
	import { FilterStore } from '$lib/viz/filters.svelte.js';
	import { SOURCE_META } from '$lib/viz/labels.js';
	import FilterChips from '$lib/components/viz/FilterChips.svelte';
	import TimeScrubber from '$lib/components/viz/TimeScrubber.svelte';
	import DelhiSwarm from '$lib/components/viz/DelhiSwarm.svelte';

	let { data } = $props();
	const { meta, places, clips } = data;

	// facet config — drives both the filter store (field/array) and the chip bar (values)
	const FACETS = [
		{ key: 'issues', field: 'issues', label: 'Theme', array: true, values: Object.keys(meta.facets.issues) },
		{ key: 'action', field: 'action', label: 'Action', array: false, values: Object.keys(meta.facets.action) },
		{ key: 'source', field: 'source', label: 'Source', array: false, values: ['news', 'party', 'citizen'] }
	];

	const f = new FilterStore(clips, FACETS);

	// timeline playhead (epoch ms); cumulative reveal = show clips with date ≤ playhead
	let playhead = $state(Date.parse(meta.date_range.last));
	$effect(() => {
		f.range = { start: -Infinity, end: playhead };
	});

	const visibleIds = $derived(new Set(f.filtered.map((c) => c.id)));

	// clip modal
	let selected = $state(/** @type {any} */ (null));
	let revealed = $state(false);
	function open(clip) {
		selected = clip;
		revealed = !clip.graphic;
	}
	function close() {
		selected = null;
		revealed = false;
	}
	function onKey(e) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:head>
	<title>CJP Protests — Timeline &amp; Map</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<div class="wrap">
	<header class="masthead">
		<div>
			<p class="eyebrow mono">Prototype · Timeline &amp; Map</p>
			<h1>Where & when the CJP protests were filmed</h1>
			<p class="tagline">
				{clips.length} clips across Delhi, {meta.date_range.first?.slice(0, 10)} → {meta.date_range.last?.slice(0, 10)}.
				Scrub the timeline to watch coverage accumulate; filter by theme, action, and source.
			</p>
		</div>
		<a class="back mono" href="/">← video wall</a>
	</header>

	<p class="note mono">
		⚠ Prototype — clips are <strong>machine-tagged (heuristic), unreviewed</strong>, and locations are approximate
		(keyword-geocoded; the dimmer pixels are epicentre-inferred). Public YouTube metadata only.
	</p>

	<TimeScrubber min={meta.date_range.first} max={meta.date_range.last} bind:value={playhead} />

	<FilterChips store={f} facets={FACETS} />

	<div class="statusline mono">
		<span class="showing">{f.filtered.length}<span class="of">/{clips.length}</span> clips shown</span>
		<span class="legend">
			{#each ['news', 'party', 'citizen'] as s (s)}
				<span class="lg"><span class="sw" style="background:{SOURCE_META[s].color}"></span>{SOURCE_META[s].label}</span>
			{/each}
		</span>
	</div>

	<section class="mapzone">
		<DelhiSwarm {clips} {places} bbox={meta.bbox} {visibleIds} onselect={open} />
	</section>
</div>

{#if selected}
	<div class="backdrop" onclick={close} role="presentation">
		<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={selected.title}>
			<button class="x" onclick={close} aria-label="Close">✕</button>
			<div class="frame">
				{#if revealed}
					<iframe
						src="https://www.youtube-nocookie.com/embed/{selected.id}"
						title={selected.title}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				{:else}
					<div class="gate">
						<p class="warn mono">Graphic content flagged</p>
						<p class="mono sub">This clip was auto-flagged as potentially graphic (unreviewed).</p>
						<button class="reveal" onclick={() => (revealed = true)}>Reveal clip</button>
					</div>
				{/if}
			</div>
			<div class="meta mono">
				<div class="mtitle">{selected.title}</div>
				<div class="msub">
					<span style="color:{SOURCE_META[selected.source]?.color}">{SOURCE_META[selected.source]?.label}</span>
					· {selected.channel} · {selected.place} ·
					{selected.date ? new Date(selected.date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''}
				</div>
				{#if selected.action || selected.issues?.length}
					<div class="tags">
						{#if selected.action}<span class="tag">{selected.action.replace(/_/g, ' ')}</span>{/if}
						{#each selected.issues ?? [] as is (is)}<span class="tag">{is.replace(/_/g, ' ')}</span>{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.wrap {
		max-width: var(--wrap-max);
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-6);
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.masthead {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--sp-4);
		flex-wrap: wrap;
	}
	.eyebrow {
		margin: 0 0 var(--sp-2);
		font-size: var(--fs-050);
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--accent);
	}
	h1 {
		margin: 0 0 var(--sp-2);
		font-size: var(--fs-700);
		line-height: var(--lh-tight);
	}
	.tagline {
		margin: 0;
		max-width: var(--measure);
		color: var(--muted);
	}
	.back {
		font-size: var(--fs-100);
		color: var(--muted);
		text-decoration: none;
		white-space: nowrap;
		border-bottom: var(--hairline);
	}
	.back:hover {
		color: var(--fg);
	}
	.note {
		margin: 0;
		padding: var(--sp-2) var(--sp-3);
		font-size: var(--fs-050);
		color: var(--muted);
		background: var(--surface);
		border-left: 2px solid var(--accent);
	}
	.note strong {
		color: var(--fg);
	}
	.statusline {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--sp-3);
		font-size: var(--fs-100);
	}
	.showing {
		color: var(--fg);
	}
	.of {
		color: var(--muted);
	}
	.legend {
		display: flex;
		gap: var(--sp-3);
	}
	.lg {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		font-size: var(--fs-050);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted);
	}
	.sw {
		width: 8px;
		height: 8px;
		display: inline-block;
	}
	.mapzone {
		border: var(--hairline);
		background: var(--bg);
	}

	/* modal */
	.backdrop {
		position: fixed;
		inset: 0;
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--sp-4);
		z-index: 50;
	}
	.modal {
		position: relative;
		width: min(880px, 100%);
		background: var(--surface);
		border: var(--rule);
	}
	.x {
		position: absolute;
		top: calc(-1 * var(--sp-5));
		right: 0;
		background: none;
		border: 0;
		color: var(--fg);
		font-size: var(--fs-300);
		cursor: pointer;
	}
	.frame {
		aspect-ratio: 16 / 9;
		background: var(--video-letterbox);
	}
	.frame iframe {
		width: 100%;
		height: 100%;
		border: 0;
		display: block;
	}
	.gate {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		text-align: center;
		padding: var(--sp-4);
	}
	.warn {
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0;
	}
	.sub {
		color: var(--muted);
		font-size: var(--fs-100);
		margin: 0;
	}
	.reveal,
	.tag {
		font-family: var(--font-mono);
	}
	.reveal {
		margin-top: var(--sp-2);
		padding: var(--sp-2) var(--sp-3);
		background: var(--accent);
		color: var(--accent-fg);
		border: 0;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.meta {
		padding: var(--sp-3);
	}
	.mtitle {
		color: var(--fg);
		margin-bottom: var(--sp-1);
	}
	.msub {
		font-size: var(--fs-100);
		color: var(--muted);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
		margin-top: var(--sp-2);
	}
	.tag {
		font-size: var(--fs-050);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		border: var(--hairline);
		padding: 1px var(--sp-2);
	}
</style>
