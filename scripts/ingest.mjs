#!/usr/bin/env node
/**
 * ingest.mjs — DISCOVER candidate clips from the YouTube Data API v3, hydrate
 * their metadata, and write a candidates file for a human to curate from.
 *
 *   discover (search.list, 100 units/call) → hydrate (videos.list, 1 unit/50)
 *   → drop non-embeddable / non-public / IN-region-blocked → curation/candidates.json
 *
 * This is an OFFLINE curation tool. It holds the API key; the static site never
 * does. It writes CANDIDATES only — it never edits events.json. A human vets
 * candidates (relevance, authenticity, sensitivity, consent) and promotes chosen
 * ones with add-event.mjs.
 *
 * Usage:
 *   node scripts/ingest.mjs \
 *     --q '(protest|rally|march|dharna) ("New Delhi"|Delhi|"Jantar Mantar")' \
 *     --after 2026-05-01 --before 2026-08-01 \
 *     --region IN --lang en --order relevance --pages 2
 *
 * Requires YT_API_KEY in .env.local (see .env.example).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseISODuration } from '../src/lib/utils/youtube.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// --- load YT_API_KEY from .env.local (Node native, no dependency) ---
try {
	process.loadEnvFile(resolve(root, '.env.local'));
} catch {
	/* fall back to the ambient environment */
}
const KEY = process.env.YT_API_KEY;
if (!KEY) {
	console.error(
		'✗ YT_API_KEY not found. Copy .env.example → .env.local and add your key.\n' +
			'  (Google Cloud Console → enable YouTube Data API v3 → create an API key.)'
	);
	process.exit(1);
}

const { values } = parseArgs({
	options: {
		q: { type: 'string' },
		after: { type: 'string' }, // YYYY-MM-DD
		before: { type: 'string' }, // YYYY-MM-DD
		region: { type: 'string', default: 'IN' },
		lang: { type: 'string', default: 'en' },
		order: { type: 'string', default: 'relevance' }, // relevance|date|viewCount|rating
		duration: { type: 'string' }, // short|medium|long
		pages: { type: 'string', default: '2' }, // 50 results/page; 100 units/page
		out: { type: 'string', default: 'curation/candidates.json' }
	}
});

if (!values.q) {
	console.error('✗ --q is required (the search query). See the header for an example.');
	process.exit(1);
}

const toRFC3339 = (d, end = false) => (d ? `${d}T${end ? '23:59:59' : '00:00:00'}Z` : undefined);
const API = 'https://www.googleapis.com/youtube/v3';

async function ytGet(path, params) {
	const url = new URL(`${API}/${path}`);
	url.search = new URLSearchParams({ key: KEY, ...params }).toString();
	const res = await fetch(url);
	const body = await res.json();
	if (!res.ok) {
		const reason = body?.error?.errors?.[0]?.reason ?? res.status;
		throw new Error(`${path} failed: ${reason} — ${body?.error?.message ?? ''}`);
	}
	return body;
}

// --- STEP 1: discover video ids via search.list (paginated) ---
async function discover() {
	const maxPages = Math.max(1, Number(values.pages) || 1);
	const ids = new Set();
	let pageToken;
	let calls = 0;

	for (let page = 0; page < maxPages; page++) {
		const params = {
			part: 'snippet',
			type: 'video',
			videoEmbeddable: 'true',
			maxResults: '50',
			q: values.q,
			regionCode: values.region,
			relevanceLanguage: values.lang,
			order: values.order,
			safeSearch: 'none'
		};
		if (values.after) params.publishedAfter = toRFC3339(values.after);
		if (values.before) params.publishedBefore = toRFC3339(values.before, true);
		if (values.duration) params.videoDuration = values.duration;
		if (pageToken) params.pageToken = pageToken;

		const data = await ytGet('search', params);
		calls++;
		for (const item of data.items ?? []) if (item.id?.videoId) ids.add(item.id.videoId);
		pageToken = data.nextPageToken;
		if (!pageToken) break;
	}
	return { ids: [...ids], searchCalls: calls };
}

// --- STEP 2: hydrate via videos.list (batches of 50) ---
async function hydrate(ids) {
	const items = [];
	for (let i = 0; i < ids.length; i += 50) {
		const batch = ids.slice(i, i + 50);
		const data = await ytGet('videos', {
			part: 'snippet,contentDetails,statistics,status',
			id: batch.join(',')
		});
		items.push(...(data.items ?? []));
	}
	return items;
}

function blockedInRegion(video, region) {
	const rr = video.contentDetails?.regionRestriction;
	if (!rr) return false;
	if (rr.blocked?.includes(region)) return true;
	if (rr.allowed && !rr.allowed.includes(region)) return true;
	return false;
}

function toCandidate(v) {
	const s = v.snippet ?? {};
	const thumb =
		s.thumbnails?.medium?.url ?? `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
	return {
		youtube_id: v.id,
		title: s.title ?? '',
		channel: s.channelTitle ?? '',
		published_at: s.publishedAt ?? null,
		_description: (s.description ?? '').slice(0, 280),
		_duration_seconds: parseISODuration(v.contentDetails?.duration),
		_thumbnail: thumb,
		_view_count: Number(v.statistics?.viewCount ?? 0),
		_embeddable: v.status?.embeddable ?? null,
		// --- curator fills these before promotion with add-event.mjs ---
		_needs_curation: {
			date_claimed: null,
			location_claimed: null,
			theme: [],
			source_type: 'citizen | mainstream-media | party-channel',
			verification_status: 'unverified',
			verification_notes: ''
		}
	};
}

// --- run ---
try {
	const { ids, searchCalls } = await discover();
	if (ids.length === 0) {
		console.log('No candidate video ids found for that query/window.');
		process.exit(0);
	}
	const videos = await hydrate(ids);
	const usable = videos.filter(
		(v) =>
			v.status?.embeddable &&
			v.status?.privacyStatus === 'public' &&
			!blockedInRegion(v, values.region)
	);
	const candidates = usable
		.map(toCandidate)
		.sort((a, b) => (b._view_count ?? 0) - (a._view_count ?? 0));

	const outPath = resolve(root, values.out);
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, JSON.stringify(candidates, null, 2) + '\n', 'utf8');

	const units = searchCalls * 100 + Math.ceil(ids.length / 50);
	console.log(
		`✓ ${candidates.length} candidates (from ${ids.length} discovered, ${videos.length} hydrated) → ${values.out}\n` +
			`  quota used ≈ ${units} units (${searchCalls} search × 100 + hydration).\n` +
			`  Next: vet each candidate, then promote chosen ones with scripts/add-event.mjs.`
	);
} catch (err) {
	console.error(`✗ ${err.message}`);
	process.exit(1);
}
