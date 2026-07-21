/**
 * filters.svelte.js — shared reactive filter state for the timeline/map prototype.
 *
 * Faceted model (standard): OR *within* a facet (picking two themes widens results),
 * AND *across* facets (theme ∩ action ∩ source ∩ time). An empty facet = no constraint.
 * One `$derived` list (`filtered`) feeds BOTH the map swarm and the timeline, and the
 * scrubber + any month chips write the same `range` — single source of truth.
 *
 * Svelte 5 gotcha honored: a plain Set inside $state is NOT reactive on add/delete —
 * we use SvelteSet from svelte/reactivity so toggles re-run the derived list.
 */
import { SvelteSet } from 'svelte/reactivity';

/**
 * @typedef {{ key:string, field:string, label:string, array?:boolean }} Facet
 * @typedef {Record<string, any>} Clip
 */

export class FilterStore {
	/** @type {Record<string, SvelteSet<string>>} */
	sel = {};
	/** time window as epoch ms; ±Infinity = unbounded */
	range = $state({ start: -Infinity, end: Infinity });

	/** @type {Clip[]} */ #clips;
	/** @type {Facet[]} */ #facets;

	/** @param {Clip[]} clips @param {Facet[]} facets */
	constructor(clips, facets) {
		this.#clips = clips;
		this.#facets = facets;
		for (const f of facets) this.sel[f.key] = new SvelteSet();
	}

	/** values a clip carries for a facet (array facets → the list; scalar → [value]) */
	#vals(/** @type {Clip} */ c, /** @type {Facet} */ f) {
		return f.array ? c[f.field] ?? [] : [c[f.field]];
	}
	#passesFacet(/** @type {Clip} */ c, /** @type {Facet} */ f) {
		const set = this.sel[f.key];
		if (set.size === 0) return true; // empty = no constraint
		return this.#vals(c, f).some((v) => set.has(v));
	}
	#inRange(/** @type {Clip} */ c) {
		const t = Date.parse(c.date);
		return Number.isFinite(t) ? t >= this.range.start && t <= this.range.end : true;
	}

	/** THE list feeding map + timeline. Lazy + memoized; recomputes on any dep change. */
	filtered = $derived.by(() =>
		this.#clips.filter((c) => this.#inRange(c) && this.#facets.every((f) => this.#passesFacet(c, f)))
	);

	/**
	 * Faceted count for one chip: apply ALL OTHER facets (not this facet's own selection,
	 * so a facet never zeroes its own siblings). Deliberately IGNORES the time window so
	 * counts stay stable — and cheap — while scrubbing (they read only the facet sets).
	 * @param {string} key @param {string} value
	 */
	count(key, value) {
		const facet = this.#facets.find((f) => f.key === key);
		if (!facet) return 0;
		let n = 0;
		for (const c of this.#clips) {
			if (!this.#vals(c, facet).includes(value)) continue;
			let ok = true;
			for (const f of this.#facets) if (f.key !== key && !this.#passesFacet(c, f)) { ok = false; break; }
			if (ok) n++;
		}
		return n;
	}

	/** @param {string} key @param {string} value */
	toggle(key, value) {
		const s = this.sel[key];
		if (s.has(value)) s.delete(value);
		else s.add(value);
	}
	/** @param {string} key @param {string} value */
	isActive(key, value) {
		return this.sel[key].has(value);
	}
	get timeActive() {
		return Number.isFinite(this.range.start) || Number.isFinite(this.range.end);
	}
	get activeCount() {
		let n = this.timeActive ? 1 : 0;
		for (const k in this.sel) n += this.sel[k].size;
		return n;
	}
	clear() {
		for (const k in this.sel) this.sel[k].clear();
		this.range = { start: -Infinity, end: Infinity };
	}
}
