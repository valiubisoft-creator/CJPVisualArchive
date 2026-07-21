/**
 * Minimal Web Audio keystroke player for the intro screen's typewriter.
 * Browser-only: every entry point is called after a user gesture (the "click to
 * begin" enter-gate), so it never runs during prerender.
 *
 * We decode the sample ONCE, then fire a fresh AudioBufferSourceNode per keystroke
 * (source nodes are single-use, GC'd, zero-latency, and overlap freely — the
 * documented idiom, and better than pooling `new Audio()` elements). We play only
 * the leading attack of the sample via start(when, offset, duration) so rapid
 * typing stays crisp instead of piling up 1s tails.
 */

/** @type {AudioContext | null} */
let ctx = null;
/** @type {AudioBuffer | null} */
let buffer = null;

/** Seconds of the sample to play per keystroke — just the attack, no tail. */
const KEY_DURATION = 0.16;

/**
 * Create + unlock the AudioContext and decode the keystroke sample. MUST be
 * called from within a user gesture (click/tap/keydown) or the context stays
 * suspended and nothing will play. Safe to call once; no-ops thereafter.
 * @param {string} [url]
 * @returns {Promise<void>}
 */
export async function initTypeSound(url = '/audio/keystroke.mp3') {
	if (buffer) return;
	const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
	if (!Ctx) return; // no Web Audio support — caller degrades to silence
	ctx = new Ctx();
	if (ctx.state === 'suspended') await ctx.resume(); // unlock on the gesture
	const bytes = await (await fetch(url)).arrayBuffer();
	buffer = await ctx.decodeAudioData(bytes);
}

/**
 * Fire one keystroke click. Silent no-op if audio never initialised (e.g. the
 * fetch/decode failed) so the typewriter still runs. Slight playbackRate jitter
 * keeps repeated keys from sounding robotic.
 * @param {number} [volume] 0..1
 */
export function playKey(volume = 0.4) {
	if (!ctx || !buffer) return;
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.playbackRate.value = 0.92 + Math.random() * 0.16;
	const gain = ctx.createGain();
	gain.gain.value = volume;
	src.connect(gain).connect(ctx.destination);
	src.start(0, 0, KEY_DURATION); // play only the attack
}
