#!/usr/bin/env node
/**
 * build-viz-data.mjs — bridge the offline curation corpus into a COMMITTED, viz-ready
 * dataset for the timeline/map prototype. Reads the gitignored candidate corpus +
 * heuristic tag proposals, geocodes each clip against a Delhi protest-location gazetteer,
 * classifies its source, and writes src/lib/data/timeline_clips.json (public: embed ids +
 * public YouTube metadata + MACHINE tags only).
 *
 * PROTOTYPE NOTE: facets here are heuristic, UNREVIEWED (no human gate). Fine for a
 * preview prototype; a production launch must run review-tags.mjs first.
 *
 * Reads:  curation/candidates_cjp.json, curation/tag_proposals.jsonl
 * Writes: src/lib/data/timeline_clips.json  { meta, places, clips }
 * Usage:  node scripts/build-viz-data.mjs   (npm run viz-data)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const curDir = resolve(root, 'curation');
const dataDir = resolve(root, 'src/lib/data');
const readJSON = (p, fb) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb);

// --- Delhi gazetteer: protest-relevant locations → lat/lng (ordered by specificity) ---
const PLACES = [
	{ key: 'jantar_mantar', name: 'Jantar Mantar', lat: 28.627, lng: 77.2166, terms: ['jantar mantar', 'जंतर मंतर', 'jantar-mantar', 'jantarmantar'] },
	{ key: 'ramlila', name: 'Ramlila Maidan', lat: 28.6392, lng: 77.2294, terms: ['ramlila', 'रामलीला'] },
	{ key: 'safdarjung', name: 'Safdarjung Hospital', lat: 28.5687, lng: 77.2065, terms: ['safdarjung', 'सफदरजंग'] },
	{ key: 'ito', name: 'ITO', lat: 28.6285, lng: 77.241, terms: ['ito', 'आईटीओ'] },
	{ key: 'rajghat', name: 'Rajghat', lat: 28.6417, lng: 77.2493, terms: ['rajghat', 'राजघाट'] },
	{ key: 'du_north', name: 'Delhi University (North Campus)', lat: 28.6889, lng: 77.2091, terms: ['delhi university', 'north campus', 'du north', 'डीयू', 'arts faculty'] },
	{ key: 'jnu', name: 'JNU', lat: 28.5383, lng: 77.1641, terms: ['jnu', 'जेएनयू'] },
	{ key: 'jamia', name: 'Jamia Millia', lat: 28.5615, lng: 77.2807, terms: ['jamia', 'जामिया'] },
	{ key: 'mandi_house', name: 'Mandi House', lat: 28.6259, lng: 77.2344, terms: ['mandi house', 'मंडी हाउस'] },
	{ key: 'shastri_bhawan', name: 'Shastri Bhawan', lat: 28.6142, lng: 77.2196, terms: ['shastri bhawan', 'शास्त्री भवन'] },
	{ key: 'connaught', name: 'Connaught Place', lat: 28.6315, lng: 77.2167, terms: ['connaught', 'कनॉट'] },
	{ key: 'india_gate', name: 'India Gate / Kartavya Path', lat: 28.6129, lng: 77.2295, terms: ['india gate', 'इंडिया गेट', 'kartavya path', 'rajpath'] },
	// Parliament last among specifics: broad terms, and Jantar Mantar (its neighbour) is the epicentre
	{ key: 'parliament', name: 'Parliament / Sansad Marg', lat: 28.6172, lng: 77.2082, terms: ['sansad marg', 'parliament street', 'sansad bhavan', 'संसद मार्ग', 'parliament house', 'vijay chowk', 'विजय चौक'] }
];
// Epicentre fallback for CJP clips with no explicit place cue (the 20 Jul action centred on Jantar Mantar).
const FALLBACK = PLACES[0];
const wb = (t) => (/^[a-z0-9][a-z0-9 ]*[a-z0-9]$/.test(t) || /^[a-z0-9]$/.test(t) ? new RegExp(`\\b${t}\\b`) : null);
const COMPILED = PLACES.map((p) => ({ ...p, matchers: p.terms.map((t) => [t, wb(t)]) }));

function geocode(hay) {
	for (const p of COMPILED)
		for (const [t, re] of p.matchers)
			if (re ? re.test(hay) : hay.includes(t)) return { place: p, confidence: 'confirmed' };
	return { place: FALLBACK, confidence: 'inferred' };
}

const NEWS_RE = /news|tak|abp|ndtv|cnn|india today|zee|tv9|republic|times now|wire|lallantop|patrika|jagran|samachar|tv18|cnbc|bharat|ndtv|newslaundry|the print|quint|opindia|dblive|db live/i;
function sourceClass(channel) {
	const c = (channel ?? '').toLowerCase();
	if (/cockroach/.test(c)) return 'party';
	if (NEWS_RE.test(c)) return 'news';
	return 'citizen';
}

// --- load corpus + proposals ---
const clipsIn = readJSON(resolve(curDir, 'candidates_cjp.json'), []);
if (!clipsIn.length) {
	console.error('✗ curation/candidates_cjp.json not found. Run: npm run ingest && npm run filter');
	process.exit(1);
}
const proposals = new Map();
const propPath = resolve(curDir, 'tag_proposals.jsonl');
if (existsSync(propPath))
	for (const l of readFileSync(propPath, 'utf8').split('\n').filter(Boolean)) {
		try {
			const r = JSON.parse(l);
			proposals.set(r.youtube_id, r.proposals);
		} catch { /* skip */ }
	}

const single = (v) => (v == null || v === 'insufficient_evidence' ? null : v);
const clips = [];
for (const c of clipsIn) {
	const hay = `${c.title ?? ''} ${c.description ?? ''} ${(c.tags ?? []).join(' ')}`.toLowerCase();
	const { place, confidence } = geocode(hay);
	const p = proposals.get(c.youtube_id) ?? {};
	const cw = p.content_warnings ?? [];
	clips.push({
		id: c.youtube_id,
		title: c.title ?? '',
		channel: c.channel ?? '',
		source: sourceClass(c.channel),
		date: c.published_at ?? null,
		lat: place.lat,
		lng: place.lng,
		place: place.name,
		place_key: place.key,
		geo: confidence,
		action: single(p.action),
		issues: p.issues ?? [],
		media_format: p.media_format ?? [],
		cw,
		graphic: cw.some((w) => w === 'graphic_violence' || w === 'injury' || w === 'death'),
		views: c.stats?.views ?? null,
		duration: c.duration_seconds ?? null
	});
}
clips.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

// --- meta: facet options + counts + bbox for projection ---
const tally = (arr) => {
	const m = new Map();
	for (const x of arr) if (x != null && x !== '') m.set(x, (m.get(x) ?? 0) + 1);
	return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
};
const dates = clips.map((c) => c.date).filter(Boolean).sort();
const meta = {
	generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
	note: 'PROTOTYPE — clips machine-tagged (heuristic), UNREVIEWED. Embed ids + public YouTube metadata + machine facets only. Geo is approximate (gazetteer keyword match; "inferred" = epicentre fallback).',
	count: clips.length,
	date_range: { first: dates[0] ?? null, last: dates[dates.length - 1] ?? null },
	bbox: { latMin: 28.40, latMax: 28.90, lngMin: 76.83, lngMax: 77.35 },
	facets: {
		source: tally(clips.map((c) => c.source)),
		action: tally(clips.map((c) => c.action)),
		issues: tally(clips.flatMap((c) => c.issues)),
		place: tally(clips.map((c) => c.place)),
		month: tally(clips.map((c) => c.date?.slice(0, 7)))
	},
	geo_confidence: tally(clips.map((c) => c.geo))
};
const places = PLACES.map((p) => ({ key: p.key, name: p.name, lat: p.lat, lng: p.lng, count: clips.filter((c) => c.place_key === p.key).length })).filter((p) => p.count);

writeFileSync(resolve(dataDir, 'timeline_clips.json'), JSON.stringify({ meta, places, clips }, null, 2) + '\n');
console.log(
	`✓ ${clips.length} clips → src/lib/data/timeline_clips.json\n` +
		`  geo: ${JSON.stringify(meta.geo_confidence)} · sources: ${JSON.stringify(meta.facets.source)}\n` +
		`  places placed: ${places.length} · date range ${meta.date_range.first?.slice(0, 10)} → ${meta.date_range.last?.slice(0, 10)}`
);
