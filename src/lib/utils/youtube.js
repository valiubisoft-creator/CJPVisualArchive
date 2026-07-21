/**
 * YouTube helpers. The site EMBEDS by id and never rehosts video (PRD §3).
 * We use youtube-nocookie.com for reduced tracking until a user clicks play.
 */

/**
 * Thumbnail for a tile facade. Prefers the ingest-hydrated URL, else the
 * keyless img.youtube.com convention (no API key, no quota).
 * @param {{ youtube_id: string, _thumbnail?: string | null }} event
 * @param {'hqdefault' | 'mqdefault' | 'sddefault' | 'maxresdefault'} [quality]
 * @returns {string}
 */
export function thumbnailUrl(event, quality = 'hqdefault') {
	if (event._thumbnail) return event._thumbnail;
	return `https://img.youtube.com/vi/${event.youtube_id}/${quality}.jpg`;
}

/**
 * Privacy-enhanced embed URL. Only loaded after an explicit click (facade pattern).
 * @param {string} youtubeId
 * @param {{ autoplay?: boolean }} [opts]
 * @returns {string}
 */
export function embedUrl(youtubeId, { autoplay = true } = {}) {
	const params = new URLSearchParams({
		autoplay: autoplay ? '1' : '0',
		rel: '0',
		modestbranding: '1',
		playsinline: '1'
	});
	return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;
}

/**
 * Canonical watch URL (used for provenance / "view source" links).
 * @param {string} youtubeId
 * @returns {string}
 */
export function watchUrl(youtubeId) {
	return `https://www.youtube.com/watch?v=${youtubeId}`;
}

/**
 * Parse an ISO-8601 duration (e.g. "PT2M13S") into seconds.
 * @param {string | null | undefined} iso
 * @returns {number | null}
 */
export function parseISODuration(iso) {
	if (!iso) return null;
	const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
	if (!m) return null;
	const [, h, min, s] = m;
	return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

/**
 * Format seconds as m:ss (or h:mm:ss).
 * @param {number | null | undefined} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
	if (seconds == null || !Number.isFinite(seconds)) return '';
	const s = Math.round(seconds);
	const hh = Math.floor(s / 3600);
	const mm = Math.floor((s % 3600) / 60);
	const ss = s % 60;
	const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
	return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}
