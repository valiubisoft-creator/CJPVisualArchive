<script>
	/**
	 * Honest limitation disclosure (PRD §6.3): embedded originals are NOT redacted.
	 * Kept visible, not buried. Includes the "report a concern" contact.
	 */
	let { contactEmail = 'concerns@example.org' } = $props();
</script>

<aside class="notice">
	<p>
		<strong>About this archive.</strong> Videos are <em>embedded</em> from their original platform
		and are never rehosted or altered — so the footage that plays is the source clip, and faces in
		it are <em>not</em> blurred. Every tile carries a visible verification status; an
		<em>unverified</em> label is not a claim of fact.
	</p>
	<p class="contact">
		In footage and want it addressed?
		<a href={`mailto:${contactEmail}`}>Report a concern / request takedown</a>.
	</p>
</aside>

<style>
	.notice {
		border: var(--rule);
		border-left: 4px solid var(--accent);
		background: var(--surface);
		padding: var(--sp-3);
		font-size: var(--fs-100);
	}
	.notice p {
		margin: 0;
		max-width: none;
	}
	.contact {
		margin-top: var(--sp-2);
		font-family: var(--font-mono);
		font-size: var(--fs-050);
	}
</style>
