<script>
	// Faceted chip toolbar. OR within a facet, AND across — per the filter-chip research.
	// Native <button aria-pressed> + <fieldset>/<legend> for a11y; counts computed against
	// the OTHER facets so a facet never zeroes its own siblings. Styled from tokens.css.
	import { label as facetLabel, SOURCE_META } from '$lib/viz/labels.js';

	/** @type {{ store:any, facets:{key:string,label:string,values:string[]}[] }} */
	let { store, facets } = $props();

	/** @param {string} key @param {string} value */
	function display(key, value) {
		if (key === 'source') return SOURCE_META[/** @type {'news'} */ (value)]?.label ?? value;
		return facetLabel(key, value);
	}
</script>

<div class="toolbar" role="group" aria-label="Filter clips">
	{#each facets as facet (facet.key)}
		<fieldset class="facet">
			<legend class="facet-label">{facet.label}</legend>
			<div class="chips">
				{#each facet.values as value (value)}
					{@const n = store.count(facet.key, value)}
					{@const active = store.isActive(facet.key, value)}
					<button
						type="button"
						class="chip"
						class:source={facet.key === 'source'}
						aria-pressed={active}
						disabled={n === 0 && !active}
						onclick={() => store.toggle(facet.key, value)}
					>
						{#if facet.key === 'source'}
							<span class="dot" style="background:{SOURCE_META[value]?.color}"></span>
						{/if}
						<span class="chip-label">{display(facet.key, value)}</span>
						<span class="chip-count" aria-hidden="true">{n}</span>
						<span class="sr-only">, {n} clips</span>
					</button>
				{/each}
			</div>
		</fieldset>
	{/each}

	{#if store.activeCount}
		<button type="button" class="chip clear" onclick={() => store.clear()}>
			Clear ({store.activeCount})
		</button>
	{/if}
</div>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--sp-4);
		padding: var(--sp-3);
		background: var(--surface);
		border: var(--hairline);
		font-family: var(--font-mono);
	}
	.facet {
		margin: 0;
		padding: 0;
		border: 0;
		min-inline-size: 0;
	}
	.facet-label {
		display: block;
		margin-bottom: var(--sp-2);
		font-size: var(--fs-050);
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		height: 26px;
		padding: 0 var(--sp-2);
		border: 1px solid var(--rule-color);
		border-radius: var(--radius);
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: var(--fs-050);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		cursor: pointer;
		transition: color var(--transition), border-color var(--transition), background var(--transition);
	}
	.chip-count {
		font-size: var(--fs-050);
		opacity: 0.6;
	}
	.dot {
		width: 7px;
		height: 7px;
		display: inline-block;
	}
	.chip:hover:not(:disabled) {
		color: var(--fg);
		border-color: var(--muted);
	}
	.chip:focus-visible {
		outline: var(--focus-ring);
		outline-offset: 2px;
	}
	.chip[aria-pressed='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-fg);
	}
	.chip[aria-pressed='true'] .chip-count {
		color: var(--accent-fg);
		opacity: 0.85;
	}
	.chip:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	.clear {
		align-self: flex-end;
		border-style: dashed;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
