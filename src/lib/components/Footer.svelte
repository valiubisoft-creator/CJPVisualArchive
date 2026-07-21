<script>
	let { lastUpdated = null, contactEmail = 'concerns@example.org' } = $props();

	const formatted = $derived(lastUpdated ? lastUpdated.slice(0, 10) : '—');
</script>

<footer class="footer">
	<div class="col">
		<h2>Methodology</h2>
		<p>
			A curated, continuously-updated archive — not a live feed. Clips are discovered via the
			YouTube Data API and manually vetted (keyframe / reverse-image checks and an independent
			date-and-location cross-check) before a status is set. Content from platforms without an open
			API is logged manually. We follow WITNESS's ethical guidelines for eyewitness video.
		</p>
	</div>

	<div class="col">
		<h2>Status key</h2>
		<ul class="key">
			<li><span class="dot" data-status="confirmed"></span> Confirmed — cross-checked authentic</li>
			<li><span class="dot" data-status="reported"></span> Reported — claim awaiting cross-check</li>
			<li><span class="dot" data-status="recycled-footage"></span> Recycled — traced to an earlier event</li>
			<li><span class="dot" data-status="unverified"></span> Unverified — not yet vetted</li>
		</ul>
	</div>

	<div class="col">
		<h2>Sourcing &amp; takedown</h2>
		<p>
			Video is embedded, never rehosted. To report a concern or request removal from this index,
			<a href={`mailto:${contactEmail}`}>contact us</a>.
		</p>
		<p class="stamp mono">Last updated: <time datetime={lastUpdated ?? ''}>{formatted}</time></p>
	</div>
</footer>

<style>
	.footer {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--sp-5);
		margin-top: var(--sp-6);
		padding-top: var(--sp-4);
		border-top: var(--rule);
		font-size: var(--fs-100);
	}
	h2 {
		font-family: var(--font-mono);
		font-size: var(--fs-050);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin: 0 0 var(--sp-2);
	}
	.col p {
		margin: 0 0 var(--sp-2);
		max-width: none;
	}
	.key {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.key li {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--muted);
		flex: none;
	}
	.dot[data-status='confirmed'] {
		background: var(--status-confirmed);
	}
	.dot[data-status='reported'] {
		background: var(--status-reported);
	}
	.dot[data-status='recycled-footage'] {
		background: var(--status-recycled);
	}
	.dot[data-status='unverified'] {
		background: var(--status-unverified);
	}
	.stamp {
		font-size: var(--fs-050);
		color: var(--muted);
	}
</style>
