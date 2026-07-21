<script>
	import { thumbnailUrl, watchUrl, formatDuration } from '$lib/utils/youtube.js';
	import { activePlayerId } from '$lib/stores/filters.js';
	import VerificationBadge from './VerificationBadge.svelte';
	import YouTubePlayer from './YouTubePlayer.svelte';

	let { event } = $props();

	// graphic-content interstitial must be cleared before the facade shows.
	let revealed = $state(false);
	let thumbFailed = $state(false);

	const playing = $derived($activePlayerId === event.id);
	const duration = $derived(formatDuration(event._duration_seconds));

	/** @type {Record<string, string>} */
	const SOURCE_LABELS = {
		citizen: 'Citizen',
		'mainstream-media': 'Mainstream media',
		'party-channel': 'Party channel'
	};

	function play() {
		activePlayerId.set(event.id);
	}
	function close() {
		if (playing) activePlayerId.set(null);
	}
</script>

<article class="tile">
	<div class="media">
		{#if playing}
			<YouTubePlayer youtubeId={event.youtube_id} title={event.title} />
			<button class="close" onclick={close} aria-label="Close video">✕</button>
		{:else if event.graphic_content && !revealed}
			<button class="interstitial" onclick={() => (revealed = true)}>
				<span class="warn-label">Sensitive content</span>
				<span class="warn-sub">Click to reveal preview</span>
			</button>
		{:else}
			<button class="facade" onclick={play} aria-label={`Play: ${event.title}`}>
				{#if thumbFailed}
					<span class="thumb-fallback mono">NO PREVIEW</span>
				{:else}
					<img
						class="thumb"
						src={thumbnailUrl(event)}
						alt=""
						loading="lazy"
						onerror={() => (thumbFailed = true)}
					/>
				{/if}
				<span class="play" aria-hidden="true">▶</span>
				{#if duration}<span class="duration mono">{duration}</span>{/if}
			</button>
		{/if}
	</div>

	<div class="meta">
		<div class="row-top">
			<VerificationBadge status={event.verification_status} size="sm" />
			<span class="source mono" data-source={event.source_type}>
				{SOURCE_LABELS[event.source_type] ?? event.source_type}
			</span>
		</div>

		<h3 class="title">{event.title}</h3>

		<dl class="facts">
			{#if event.channel}
				<div><dt>Channel</dt><dd>{event.channel}</dd></div>
			{/if}
			{#if event.date_claimed}
				<div><dt>Claimed date</dt><dd><time datetime={event.date_claimed}>{event.date_claimed}</time></dd></div>
			{/if}
			{#if event.location_claimed}
				<div><dt>Claimed location</dt><dd>{event.location_claimed}</dd></div>
			{/if}
		</dl>

		{#if event.verification_notes}
			<p class="notes">{event.verification_notes}</p>
		{/if}

		<a class="source-link mono" href={watchUrl(event.youtube_id)} target="_blank" rel="noopener noreferrer">
			View source on YouTube ↗
		</a>
	</div>
</article>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		border: var(--rule);
		border-radius: var(--radius);
		background: var(--bg);
		height: 100%;
	}

	.media {
		position: relative;
		aspect-ratio: 16 / 9;
		background: var(--surface);
		border-bottom: var(--rule);
	}

	/* facade / interstitial buttons fill the media box, reset button chrome */
	.facade,
	.interstitial {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: var(--surface);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.facade:hover,
	.interstitial:hover {
		background: var(--surface);
		color: var(--fg);
	}

	.thumb {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.thumb-fallback {
		color: var(--muted);
		font-size: var(--fs-100);
		letter-spacing: 0.08em;
	}

	.play {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		background: var(--bg);
		color: var(--fg);
		border: var(--rule);
		font-size: 1rem;
		transition: background var(--transition), color var(--transition);
	}
	.facade:hover .play {
		background: var(--accent);
		color: var(--accent-fg);
		border-color: var(--accent);
	}

	.duration {
		position: absolute;
		right: var(--sp-1);
		bottom: var(--sp-1);
		z-index: 1;
		padding: 1px 4px;
		background: var(--fg);
		color: var(--bg);
		font-size: var(--fs-050);
	}

	.interstitial {
		flex-direction: column;
		gap: var(--sp-1);
		background: var(--fg);
		color: var(--bg);
	}
	.interstitial:hover {
		background: var(--fg);
		color: var(--bg);
	}
	.warn-label {
		font-weight: var(--fw-bold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: var(--fs-100);
	}
	.warn-sub {
		font-family: var(--font-mono);
		font-size: var(--fs-050);
		opacity: 0.8;
	}

	.close {
		position: absolute;
		top: var(--sp-1);
		right: var(--sp-1);
		z-index: 2;
		width: 28px;
		height: 28px;
		padding: 0;
		display: grid;
		place-items: center;
		background: var(--bg);
		border: var(--rule);
		font-size: var(--fs-100);
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-3);
	}
	.row-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-2);
	}
	.source {
		font-size: var(--fs-050);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	.title {
		font-size: var(--fs-200);
		font-weight: var(--fw-medium);
		line-height: var(--lh-tight);
		margin: 0;
	}

	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 2px var(--sp-2);
		margin: 0;
		font-size: var(--fs-100);
	}
	.facts > div {
		display: contents;
	}
	.facts dt {
		font-family: var(--font-mono);
		font-size: var(--fs-050);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--muted);
		align-self: baseline;
	}
	.facts dd {
		margin: 0;
	}

	.notes {
		margin: 0;
		font-size: var(--fs-100);
		color: var(--muted);
		max-width: none;
	}

	.source-link {
		font-size: var(--fs-050);
		align-self: flex-start;
		margin-top: auto;
	}
</style>
