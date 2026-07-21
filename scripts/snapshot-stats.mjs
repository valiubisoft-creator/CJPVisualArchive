#!/usr/bin/env node
/**
 * snapshot-stats.mjs — re-sample YouTube view/like/comment COUNTS for the archive
 * and append a timestamped row per video to stats_snapshots.jsonl.
 *
 * WHY: the Data API returns only a *current* snapshot — there is no views-over-time
 * endpoint for third-party videos. Re-running this on a schedule (cron / CI, e.g.
 * daily) builds the time series ourselves, which is the ONLY path to view/engagement
 * VELOCITY. Aggregate counts only — never comment text/authors.
 *
 * Usage:  node scripts/snapshot-stats.mjs [--candidates]
 *   default: sample the curated archive (events.json)
 *   --candidates: also sample the raw capture corpus (curation/candidates.json)
 *
 * Requires YT_API_KEY in .env.local.
 */
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dataDir = resolve(root, 'src/lib/data');

try {
	process.loadEnvFile(resolve(root, '.env.local'));
} catch {
	/* ambient env */
}
const KEY = process.env.YT_API_KEY;
if (!KEY) {
	console.error('✗ YT_API_KEY not found (see .env.example / .env.local).');
	process.exit(1);
}

const { values } = parseArgs({ options: { candidates: { type: 'boolean', default: false } } });
const API = 'https://www.googleapis.com/youtube/v3';

function readIds() {
	const ids = new Set();
	const events = resolve(dataDir, 'events.json');
	if (existsSync(events))
		for (const e of JSON.parse(readFileSync(events, 'utf8'))) if (e.youtube_id) ids.add(e.youtube_id);
	if (values.candidates) {
		const cand = resolve(root, 'curation/candidates.json');
		if (existsSync(cand))
			for (const c of JSON.parse(readFileSync(cand, 'utf8'))) if (c.youtube_id) ids.add(c.youtube_id);
	}
	return [...ids];
}

async function statsFor(ids) {
	const out = [];
	for (let i = 0; i < ids.length; i += 50) {
		const url = new URL(`${API}/videos`);
		url.search = new URLSearchParams({
			key: KEY,
			part: 'statistics',
			id: ids.slice(i, i + 50).join(',')
		}).toString();
		const res = await fetch(url);
		const body = await res.json();
		if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
		out.push(...(body.items ?? []));
	}
	return out;
}

const capturedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const num = (x) => (x == null ? null : Number(x));

try {
	const ids = readIds();
	if (ids.length === 0) {
		console.log('No video ids to snapshot (events.json empty?).');
		process.exit(0);
	}
	const items = await statsFor(ids);
	const outPath = resolve(dataDir, 'stats_snapshots.jsonl');
	const lines = items
		.map((v) =>
			JSON.stringify({
				youtube_id: v.id,
				captured_at: capturedAt,
				views: num(v.statistics?.viewCount),
				likes: num(v.statistics?.likeCount),
				comments: num(v.statistics?.commentCount)
			})
		)
		.join('\n');
	appendFileSync(outPath, lines + '\n', 'utf8');
	// videos that vanished (id requested but not returned) = removed/private → a takedown signal.
	const gone = ids.filter((id) => !items.some((v) => v.id === id));
	console.log(
		`✓ snapshot ${items.length}/${ids.length} videos @ ${capturedAt} → stats_snapshots.jsonl` +
			(gone.length ? `\n  ⚠ ${gone.length} no longer returned (removed/private): ${gone.join(', ')}` : '')
	);
} catch (err) {
	console.error(`✗ ${err.message}`);
	process.exit(1);
}
