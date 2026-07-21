<script>
	import { statusFilter, sourceFilter } from '$lib/stores/filters.js';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import TileGrid from '$lib/components/TileGrid.svelte';
	import ConcernNotice from '$lib/components/ConcernNotice.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { data } = $props();

	// Counts for the filter chips (from the full set, not the filtered view).
	const statusCounts = $derived(tally(data.events, 'verification_status'));
	const sourceCounts = $derived(tally(data.events, 'source_type'));

	/**
	 * @param {any[]} events
	 * @param {string} key
	 * @returns {Record<string, number>}
	 */
	function tally(events, key) {
		/** @type {Record<string, number>} */
		const out = {};
		for (const e of events) out[e[key]] = (out[e[key]] ?? 0) + 1;
		return out;
	}

	// Client-side filtered view — status + source only (never by person, PRD §3).
	const visible = $derived(
		data.events.filter(
			(e) =>
				($statusFilter === 'all' || e.verification_status === $statusFilter) &&
				($sourceFilter === 'all' || e.source_type === $sourceFilter)
		)
	);
</script>

<svelte:head>
	<title>CJP Protest Video Wall</title>
</svelte:head>

<div class="wrap">
	<header class="masthead">
		<div class="titles">
			<h1>CJP Protest Video Wall</h1>
			<p class="tagline">
				Curated video documentation of the 2026 CJP protests in Delhi — what's circulating, from
				whom, and how verified. Embedded, not rehosted.
			</p>
		</div>
		<p class="count mono">
			{visible.length}<span class="of">/{data.events.length}</span> clips
		</p>
	</header>

	<ConcernNotice />

	<FilterBar {statusCounts} {sourceCounts} total={data.events.length} />

	<section class="grid-section">
		<TileGrid events={visible} />
	</section>

	<Footer lastUpdated={data.lastUpdated} />
</div>

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
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--sp-4);
		flex-wrap: wrap;
	}
	.titles {
		max-width: var(--measure);
	}
	h1 {
		margin: 0 0 var(--sp-2);
	}
	.tagline {
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-200);
	}
	.count {
		font-size: var(--fs-400);
		white-space: nowrap;
	}
	.count .of {
		color: var(--muted);
		font-size: var(--fs-200);
	}
	.grid-section {
		min-height: 40vh;
	}
</style>
