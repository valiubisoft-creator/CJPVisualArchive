<script>
	/**
	 * Always-visible verification status. Multi-dimensional-ready but v1 surfaces
	 * the single PRD status enum. Colour comes from tokens, never hard-coded.
	 */
	let { status, size = 'md' } = $props();

	/** @type {Record<string, string>} */
	const LABELS = {
		confirmed: 'Confirmed',
		reported: 'Reported',
		'recycled-footage': 'Recycled footage',
		unverified: 'Unverified'
	};
	/** @type {Record<string, string>} */
	const TITLES = {
		confirmed: 'Verified authentic against at least one independent source.',
		reported: 'Claimed but not yet independently cross-checked.',
		'recycled-footage': 'Traced to an earlier, unrelated event.',
		unverified: 'Not yet run through the verification workflow.'
	};
</script>

<span class="badge" data-status={status} data-size={size} title={TITLES[status] ?? ''}>
	<span class="dot" aria-hidden="true"></span>
	<span class="label">{LABELS[status] ?? status}</span>
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		font-family: var(--font-mono);
		font-size: var(--fs-050);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		line-height: 1;
		padding: 3px var(--sp-1);
		border: var(--hairline);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--fg);
		white-space: nowrap;
	}
	.badge[data-size='sm'] {
		font-size: 0.625rem;
		padding: 2px 4px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--status-unverified);
		flex: none;
	}
	.badge[data-status='confirmed'] .dot {
		background: var(--status-confirmed);
	}
	.badge[data-status='reported'] .dot {
		background: var(--status-reported);
	}
	.badge[data-status='recycled-footage'] .dot {
		background: var(--status-recycled);
	}
	.badge[data-status='unverified'] .dot {
		background: var(--status-unverified);
	}
</style>
