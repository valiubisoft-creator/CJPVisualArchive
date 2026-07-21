<script>
	/**
	 * Landing screen shown before the video wall. Full-black overlay that:
	 *  1. gates on a "click to begin" (also the gesture that unlocks audio),
	 *  2. types out the title with a per-keystroke sound,
	 *  3. after a 0.5s beat, reveals a dense cockroach swarm as a wave rippling
	 *     from the centre out to the borders,
	 *  4. holds ~1s, then fades out and hands off to the wall via oncomplete().
	 *
	 * No third-party libs: Svelte state + a JS distance-from-centre stagger +
	 * Web Audio ($lib/utils/sound.js). Honours prefers-reduced-motion. The roach
	 * is the existing /cursor/cockroach.svg, drawn as <img> (rasterised once by
	 * the browser, cheap to repeat ~hundreds of times).
	 */
	import { onMount, onDestroy, tick } from 'svelte';
	import { initTypeSound, playKey } from '$lib/utils/sound.js';

	/** @type {{ oncomplete?: () => void }} */
	let { oncomplete } = $props();

	const TITLE = 'CJP Protest, New Delhi';
	const WAVE_MS = 1200; // time for the ripple to reach the corners
	const HOLD_MS = 1000; // hold on the full swarm before fading out
	const FADE_MS = 600; // overlay fade-out
	const MAX_ROACHES = 700; // perf cap on large viewports

	let started = $state(false);
	let typed = $state('');
	/** @type {{ x: number, y: number, delay: number, rot: number, size: number }[]} */
	let roaches = $state([]);
	let waveOn = $state(false);
	let leaving = $state(false);

	let reduceMotion = false;
	let done = false;
	let cancelled = false;
	/** @type {ReturnType<typeof setTimeout>[]} */
	const timers = [];

	/** @param {number} ms */
	const sleep = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));

	onMount(() => {
		reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	});

	onDestroy(() => {
		cancelled = true;
		timers.forEach(clearTimeout);
	});

	/** Lay out a jittered grid of roaches, each with a centre-distance-based delay. */
	function buildRoaches() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		const cx = w / 2;
		const cy = h / 2;
		const maxD = Math.hypot(cx, cy) || 1;
		// Keep the node count bounded on huge screens while staying dense.
		const spacing = Math.max(52, Math.sqrt((w * h) / MAX_ROACHES));
		/** @type {typeof roaches} */
		const out = [];
		for (let gy = spacing / 2; gy < h; gy += spacing) {
			for (let gx = spacing / 2; gx < w; gx += spacing) {
				const x = gx + (Math.random() - 0.5) * spacing * 0.6;
				const y = gy + (Math.random() - 0.5) * spacing * 0.6;
				const d = Math.hypot(x - cx, y - cy);
				out.push({
					x,
					y,
					delay: reduceMotion ? 0 : (d / maxD) * WAVE_MS,
					rot: Math.random() * 360,
					size: 16 + Math.random() * 8
				});
			}
		}
		roaches = out;
	}

	async function typeText() {
		if (reduceMotion) {
			typed = TITLE;
			return;
		}
		for (let i = 0; i < TITLE.length; i++) {
			if (cancelled) return;
			typed += TITLE[i];
			if (TITLE[i] !== ' ') playKey();
			await sleep(60 + Math.random() * 40);
		}
	}

	/** The full timed sequence, kicked off by the enter-gate click (a user gesture). */
	async function runSequence() {
		started = true;
		try {
			await initTypeSound(); // decode + unlock AudioContext on this gesture
		} catch {
			/* no audio — the typewriter still runs, silently */
		}
		if (cancelled) return;

		await typeText();
		if (cancelled) return;

		await sleep(reduceMotion ? 200 : 500); // the specified 0.5s beat
		if (cancelled) return;

		buildRoaches();
		await tick(); // ensure the hidden roach nodes are in the DOM…
		requestAnimationFrame(() => {
			if (!cancelled) waveOn = true; // …then flip the wave on to trigger the transitions
		});

		await sleep(reduceMotion ? 0 : WAVE_MS);
		if (cancelled) return;
		await sleep(reduceMotion ? 300 : HOLD_MS);
		if (cancelled) return;

		leaving = true;
		timers.push(setTimeout(complete, FADE_MS));
	}

	function complete() {
		if (done) return;
		done = true;
		cancelled = true;
		timers.forEach(clearTimeout);
		oncomplete?.();
	}

	const titleDone = $derived(typed.length === TITLE.length);
</script>

<div class="intro" class:leaving>
	{#if !started}
		<button class="gate" onclick={runSequence}>
			<span class="caret gate-caret" aria-hidden="true"></span>
			<span class="gate-label">click to begin</span>
		</button>
	{:else}
		<h1 class="title" aria-label={TITLE}>
			<span class="typed">{typed}</span><span
				class="caret"
				class:hidden={titleDone && waveOn}
				aria-hidden="true"
			></span>
		</h1>

		<div class="swarm" class:reveal={waveOn} aria-hidden="true">
			{#each roaches as r}
				<img
					class="roach"
					src="/cursor/cockroach.svg"
					alt=""
					style="left:{r.x}px; top:{r.y}px; width:{r.size}px; height:{r.size}px; --delay:{r.delay}ms; --rot:{r.rot}deg"
				/>
			{/each}
		</div>

		{#if !leaving}
			<button class="skip" onclick={complete}>Skip</button>
		{/if}
	{/if}
</div>

<style>
	.intro {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: #000; /* explicit full black (deeper than --bg) */
		display: grid;
		place-items: center;
		overflow: hidden;
		transition: opacity 600ms ease;
	}
	.intro.leaving {
		opacity: 0;
		pointer-events: none;
	}

	/* ---- enter gate ---- */
	.gate {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		background: transparent;
		border: 0;
		color: var(--fg);
		font-family: var(--font-mono);
		font-size: var(--fs-300);
		letter-spacing: 0.02em;
		cursor: var(--cursor-default);
		padding: var(--sp-3);
	}
	.gate-label {
		opacity: 0.75;
	}
	.gate:hover .gate-label,
	.gate:focus-visible .gate-label {
		opacity: 1;
	}
	.gate:focus-visible {
		outline: var(--focus-ring);
		outline-offset: 4px;
	}

	/* ---- typed title ---- */
	.title {
		position: relative;
		z-index: 2;
		margin: 0;
		padding: 0 var(--sp-4);
		text-align: center;
		font-family: var(--font-mono);
		font-weight: var(--fw-medium);
		font-size: clamp(1.8rem, 7vw, 3.5rem);
		line-height: var(--lh-tight);
		letter-spacing: 0.01em;
		color: var(--fg);
	}

	/* blinking caret (red accent) */
	.caret {
		display: inline-block;
		width: 0.55ch;
		height: 1em;
		margin-left: 0.12em;
		background: var(--accent);
		transform: translateY(0.14em);
		animation: blink 1s steps(1) infinite;
	}
	.gate-caret {
		height: 1.1em;
		margin: 0;
	}
	.caret.hidden {
		display: none;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	/* ---- cockroach swarm ---- */
	.swarm {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
	}
	.roach {
		position: absolute;
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.4) rotate(var(--rot));
		will-change: transform, opacity;
		transition:
			opacity 350ms ease var(--delay),
			transform 450ms cubic-bezier(0.2, 0.8, 0.3, 1) var(--delay);
	}
	.swarm.reveal .roach {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1) rotate(var(--rot));
	}

	/* ---- skip ---- */
	.skip {
		position: absolute;
		z-index: 3;
		right: var(--sp-4);
		bottom: var(--sp-4);
		background: transparent;
		border: var(--hairline);
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--fs-050);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: var(--sp-1) var(--sp-2);
		cursor: var(--cursor-default);
		transition: color 120ms linear, border-color 120ms linear;
	}
	.skip:hover,
	.skip:focus-visible {
		color: var(--fg);
		border-color: var(--fg);
	}
	.skip:focus-visible {
		outline: var(--focus-ring);
		outline-offset: 2px;
	}

	/* Honour reduced motion: no blink, no ripple — everything just appears. */
	@media (prefers-reduced-motion: reduce) {
		.caret {
			animation: none;
		}
		.roach {
			transition: none;
		}
		.intro {
			transition: none;
		}
	}
</style>
