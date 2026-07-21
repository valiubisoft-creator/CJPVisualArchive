import { writable } from 'svelte/store';

/**
 * Client-side filter + playback state. Themes are intentionally NOT a filter
 * dimension yet (deferred until curated volume makes categories meaningful).
 * Filters are verification-status and source-type only — never by person (PRD §3).
 */

/** @type {import('svelte/store').Writable<'all' | 'confirmed' | 'reported' | 'recycled-footage' | 'unverified'>} */
export const statusFilter = writable('all');

/** @type {import('svelte/store').Writable<'all' | 'citizen' | 'mainstream-media' | 'party-channel'>} */
export const sourceFilter = writable('all');

/** id of the tile whose player is currently mounted — only one plays at a time. */
export const activePlayerId = writable(/** @type {string | null} */ (null));
