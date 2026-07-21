<script>
	import { embedUrl } from '$lib/utils/youtube.js';

	/**
	 * The YouTube IFrame Player (privacy-enhanced nocookie host), mounted only
	 * after an explicit click (facade pattern). We EMBED, never rehost (PRD §3):
	 * YouTube's own player renders the file. `enablejsapi=1` leaves the door open
	 * for programmatic control later without changing the embed contract.
	 */
	let { youtubeId, title = 'Embedded video' } = $props();

	const src = $derived(`${embedUrl(youtubeId, { autoplay: true })}&enablejsapi=1`);
</script>

<div class="frame">
	<iframe
		{src}
		{title}
		loading="lazy"
		referrerpolicy="strict-origin-when-cross-origin"
		allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
		allowfullscreen
	></iframe>
</div>

<style>
	.frame {
		position: relative;
		aspect-ratio: 16 / 9;
		background: var(--video-letterbox);
	}
	iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
</style>
