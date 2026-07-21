import events from '$lib/data/events.json';

export function load() {
	// Derive the "last updated" stamp from the newest added_at — no manual bookkeeping.
	const lastUpdated = events
		.map((e) => e.added_at)
		.filter(Boolean)
		.sort()
		.at(-1) ?? null;

	return { events, lastUpdated };
}
