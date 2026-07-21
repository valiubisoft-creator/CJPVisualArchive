<script>
	import { statusFilter, sourceFilter } from '$lib/stores/filters.js';

	/** @type {{ statusCounts: Record<string, number>, sourceCounts: Record<string, number>, total: number }} */
	let { statusCounts, sourceCounts, total } = $props();

	/** @type {Array<'confirmed' | 'reported' | 'recycled-footage' | 'unverified'>} */
	const STATUSES = ['confirmed', 'reported', 'recycled-footage', 'unverified'];
	/** @type {Record<string, string>} */
	const STATUS_LABELS = {
		confirmed: 'Confirmed',
		reported: 'Reported',
		'recycled-footage': 'Recycled',
		unverified: 'Unverified'
	};
	/** @type {Array<'citizen' | 'mainstream-media' | 'party-channel'>} */
	const SOURCES = ['citizen', 'mainstream-media', 'party-channel'];
	/** @type {Record<string, string>} */
	const SOURCE_LABELS = {
		citizen: 'Citizen',
		'mainstream-media': 'Mainstream',
		'party-channel': 'Party channel'
	};
</script>

<div class="filters">
	<fieldset>
		<legend>Verification status</legend>
		<div class="chips">
			<button
				class="chip"
				aria-pressed={$statusFilter === 'all'}
				onclick={() => statusFilter.set('all')}
			>
				All <span class="count">{total}</span>
			</button>
			{#each STATUSES as s}
				<button
					class="chip"
					data-status={s}
					aria-pressed={$statusFilter === s}
					onclick={() => statusFilter.set(s)}
				>
					<span class="dot" aria-hidden="true"></span>
					{STATUS_LABELS[s]} <span class="count">{statusCounts[s] ?? 0}</span>
				</button>
			{/each}
		</div>
	</fieldset>

	<fieldset>
		<legend>Source type</legend>
		<div class="chips">
			<button
				class="chip"
				aria-pressed={$sourceFilter === 'all'}
				onclick={() => sourceFilter.set('all')}
			>
				All
			</button>
			{#each SOURCES as src}
				<button
					class="chip"
					aria-pressed={$sourceFilter === src}
					onclick={() => sourceFilter.set(src)}
				>
					{SOURCE_LABELS[src]} <span class="count">{sourceCounts[src] ?? 0}</span>
				</button>
			{/each}
		</div>
	</fieldset>
</div>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-6);
		padding: var(--sp-3) 0;
		border-top: var(--rule);
		border-bottom: var(--rule);
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
	legend {
		font-family: var(--font-mono);
		font-size: var(--fs-050);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		padding: 0;
		margin-bottom: var(--sp-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: var(--fs-100);
		padding: 4px var(--sp-2);
		border: var(--hairline);
		background: var(--bg);
		color: var(--fg);
	}
	.chip:hover {
		background: var(--surface);
		color: var(--fg);
	}
	.chip[aria-pressed='true'] {
		background: var(--fg);
		color: var(--bg);
		border-color: var(--fg);
	}
	.count {
		font-size: var(--fs-050);
		opacity: 0.7;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--muted);
	}
	.chip[data-status='confirmed'] .dot {
		background: var(--status-confirmed);
	}
	.chip[data-status='reported'] .dot {
		background: var(--status-reported);
	}
	.chip[data-status='recycled-footage'] .dot {
		background: var(--status-recycled);
	}
	.chip[data-status='unverified'] .dot {
		background: var(--status-unverified);
	}
</style>
