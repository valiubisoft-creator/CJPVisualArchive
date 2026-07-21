/**
 * labels.js — pretty labels + source styling for the viz. Facet labels come straight
 * from the controlled vocabulary so the UI and the taxonomy never drift.
 */
import vocab from '$lib/data/vocab.json';

/** @type {Record<string, Record<string,string>>} */
const maps = {};
for (const [facet, def] of Object.entries(vocab.facets ?? {})) {
	maps[facet] = Object.fromEntries((def.values ?? []).map((v) => [v.value, v.label]));
}

const prettify = (v) => String(v ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** @param {string} facet @param {string} value */
export function label(facet, value) {
	return maps[facet]?.[value] ?? prettify(value);
}

/** source-type → display label + colour token (from tokens.css) */
export const SOURCE_META = {
	news: { label: 'News', color: 'var(--source-mainstream-media)' },
	party: { label: 'Party', color: 'var(--source-party-channel)' },
	citizen: { label: 'Citizen', color: 'var(--source-citizen)' }
};
