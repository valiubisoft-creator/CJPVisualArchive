<script>
	import VideoTile from './VideoTile.svelte';

	let { events } = $props();
</script>

{#if events.length === 0}
	<p class="empty">No clips match the current filter.</p>
{:else}
	<ul class="grid">
		{#each events as event (event.id)}
			<li><VideoTile {event} /></li>
		{/each}
	</ul>
{/if}

<style>
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--tile-min), 1fr));
		gap: var(--sp-4);
	}
	.grid > li {
		display: flex;
	}
	.grid > li > :global(.tile) {
		width: 100%;
	}
	.empty {
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--fs-100);
		padding: var(--sp-5) 0;
	}
</style>
