#!/usr/bin/env node
/**
 * profile-data.mjs — read the captured/derived data and emit a statistics report
 * so we can UNDERSTAND THE DATA before choosing any visualization.
 *
 * Reads (each optional, degrades gracefully):
 *   src/lib/data/events.json            curated archive (default corpus)
 *   src/lib/data/channels.json          channel profiles
 *   src/lib/data/stats_snapshots.jsonl  timestamped counts (→ velocity)
 *   src/lib/data/footage_{edges,clusters}.json   derived network
 *   src/lib/data/ref/categories.json    decode categoryId
 *
 * Writes:
 *   docs/DATA_PROFILE.md      human-readable distributions + summary stats
 *   src/lib/data/data_profile.json   the numbers (for later viz)
 *
 * The companion docs/DATA_DICTIONARY.md documents every dimension we *can* measure.
 *
 * Usage:  node scripts/profile-data.mjs [--corpus <path>]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dataDir = resolve(root, 'src/lib/data');
const { values } = parseArgs({ options: { corpus: { type: 'string' } } });

const readJSON = (p, fb) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb);
const corpusPath = values.corpus ? resolve(root, values.corpus) : resolve(dataDir, 'events.json');
const videos = readJSON(corpusPath, []);
const channels = readJSON(resolve(dataDir, 'channels.json'), []);
const edges = readJSON(resolve(dataDir, 'footage_edges.json'), []);
const clustersData = readJSON(resolve(dataDir, 'footage_clusters.json'), []);
const categories = readJSON(resolve(dataDir, 'ref/categories.json'), {});
const snapshots = existsSync(resolve(dataDir, 'stats_snapshots.jsonl'))
	? readFileSync(resolve(dataDir, 'stats_snapshots.jsonl'), 'utf8')
			.split('\n')
			.filter(Boolean)
			.map((l) => JSON.parse(l))
	: [];

// --- field accessors (tolerate v1 + v2 shapes) ---
const views = (r) => r._stats?.views ?? r._view_count ?? null;
const likes = (r) => r._stats?.likes ?? null;
const comments = (r) => r._stats?.comments ?? null;
const duration = (r) => r._duration_seconds ?? null;

// --- helpers ---
function counts(items, key) {
	const m = new Map();
	for (const it of items) {
		const v = typeof key === 'function' ? key(it) : it[key];
		const vals = Array.isArray(v) ? v : [v];
		for (const x of vals) {
			if (x === null || x === undefined || x === '') continue;
			m.set(x, (m.get(x) ?? 0) + 1);
		}
	}
	return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function summary(nums) {
	const xs = nums.filter((n) => n != null && Number.isFinite(n)).sort((a, b) => a - b);
	if (!xs.length) return null;
	const q = (p) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
	return {
		n: xs.length,
		min: xs[0],
		p25: q(0.25),
		median: q(0.5),
		p75: q(0.75),
		max: xs[xs.length - 1],
		mean: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
	};
}
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(0)}%` : '—');
const durationBucket = (s) =>
	s == null ? 'unknown' : s < 60 ? '<1m (Short)' : s < 240 ? '1–4m' : s < 1200 ? '4–20m' : '>20m';
const bar = (n, max, w = 24) => '█'.repeat(Math.max(0, Math.round((n / (max || 1)) * w)));

function distTable(title, pairs, total) {
	if (!pairs.length) return `### ${title}\n\n_no data_\n`;
	const max = pairs[0][1];
	let md = `### ${title}\n\n| value | n | % | |\n|---|--:|--:|---|\n`;
	for (const [k, v] of pairs) md += `| ${k} | ${v} | ${pct(v, total)} | ${bar(v, max)} |\n`;
	return md + '\n';
}
function summaryTable(title, s, fmt = (x) => x) {
	if (!s) return `### ${title}\n\n_no data_\n`;
	return (
		`### ${title}\n\n| n | min | p25 | median | p75 | max | mean |\n|--:|--:|--:|--:|--:|--:|--:|\n` +
		`| ${s.n} | ${fmt(s.min)} | ${fmt(s.p25)} | ${fmt(s.median)} | ${fmt(s.p75)} | ${fmt(s.max)} | ${fmt(s.mean)} |\n\n`
	);
}

// --- velocity from snapshots (needs ≥2 timestamps per video) ---
function velocity() {
	const byId = new Map();
	for (const s of snapshots) {
		if (!byId.has(s.youtube_id)) byId.set(s.youtube_id, []);
		byId.get(s.youtube_id).push(s);
	}
	const rates = [];
	for (const rows of byId.values()) {
		if (rows.length < 2) continue;
		rows.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
		const a = rows[0],
			b = rows[rows.length - 1];
		const days = (Date.parse(b.captured_at) - Date.parse(a.captured_at)) / 86400000;
		if (days > 0 && a.views != null && b.views != null)
			rates.push((b.views - a.views) / days);
	}
	return { tracked: byId.size, withSeries: rates.length, viewsPerDay: summary(rates) };
}

// --- network stats ---
function networkStats() {
	const indeg = new Map();
	for (const e of edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
	const topReposted = [...indeg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
	return {
		edges: edges.length,
		byMethod: Object.fromEntries(counts(edges, 'method')),
		clusters: clustersData.length,
		clusterSizes: summary(clustersData.map((c) => c.size)),
		misattribution: clustersData.filter((c) => c.misattribution_candidate).length,
		topReposted
	};
}

// --- assemble profile ---
const total = videos.length;
const dates = videos.map((r) => r.published_at).filter(Boolean).sort();
const profile = {
	generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
	corpus: corpusPath.replace(root + '/', ''),
	videos: total,
	channels: channels.length,
	upload_range: dates.length ? { first: dates[0], last: dates[dates.length - 1] } : null,
	verification_status: Object.fromEntries(counts(videos, 'verification_status')),
	source_type: Object.fromEntries(counts(videos, 'source_type')),
	definition: Object.fromEntries(counts(videos, (r) => r._definition)),
	license: Object.fromEntries(counts(videos, (r) => r._license)),
	captioned: videos.filter((r) => r._caption === true).length,
	age_restricted: videos.filter((r) => r._age_restricted === true).length,
	geo_blocked: videos.filter((r) => r._region_restriction).length,
	category: Object.fromEntries(counts(videos, (r) => categories[r._category_id] ?? r._category_id)),
	language: Object.fromEntries(counts(videos, (r) => r._default_audio_language)),
	topic_categories: Object.fromEntries(counts(videos, (r) => r._topic_categories ?? [])),
	duration_buckets: Object.fromEntries(counts(videos, (r) => durationBucket(duration(r)))),
	duration_seconds: summary(videos.map(duration)),
	views: summary(videos.map(views)),
	uploads_by_month: Object.fromEntries(
		counts(videos, (r) => (r.published_at ? r.published_at.slice(0, 7) : null))
	),
	uploads_by_hour_utc: Object.fromEntries(
		counts(videos, (r) => (r.published_at ? `${r.published_at.slice(11, 13)}:00` : null))
	),
	channel_subscribers: summary(channels.map((c) => c.stats?.subscribers)),
	channel_videos: summary(channels.map((c) => c.stats?.videos)),
	channel_country: Object.fromEntries(counts(channels, 'country')),
	velocity: velocity(),
	network: networkStats(),
	// facets appear once tagging (Phase B) has run:
	facets_present: videos.some((r) => r.facets)
};

writeFileSync(resolve(dataDir, 'data_profile.json'), JSON.stringify(profile, null, 2) + '\n');

// --- render DATA_PROFILE.md ---
const P = profile;
let md = `# CJP archive — data profile

_Generated ${P.generated_at} from \`${P.corpus}\`. Companion reference: [DATA_DICTIONARY.md](DATA_DICTIONARY.md)._

**Corpus:** ${P.videos} videos · ${P.channels} channels` +
	(P.upload_range ? ` · uploads ${P.upload_range.first.slice(0, 10)} → ${P.upload_range.last.slice(0, 10)}` : '') +
	`\n\n---\n\n## Provenance & verification\n\n` +
	distTable('Verification status', counts(videos, 'verification_status'), total) +
	distTable('Source type', counts(videos, 'source_type'), total) +
	`## Content & rights\n\n` +
	distTable('Definition (HD/SD)', counts(videos, (r) => r._definition), total) +
	distTable('License', counts(videos, (r) => r._license), total) +
	`Captioned: **${P.captioned}/${total}** (${pct(P.captioned, total)}) · Age-restricted: **${P.age_restricted}** (${pct(P.age_restricted, total)}) · Geo-blocked: **${P.geo_blocked}** (${pct(P.geo_blocked, total)})\n\n` +
	`## Topic, category & language\n\n` +
	distTable('YouTube category', counts(videos, (r) => categories[r._category_id] ?? r._category_id), total) +
	distTable('Topic categories', counts(videos, (r) => r._topic_categories ?? []), total) +
	distTable('Audio language', counts(videos, (r) => r._default_audio_language), total) +
	`## Length & reach\n\n` +
	distTable('Duration buckets', counts(videos, (r) => durationBucket(duration(r))), total) +
	summaryTable('Duration (seconds)', P.duration_seconds) +
	summaryTable('View count', P.views) +
	`## Timeline\n\n` +
	distTable('Uploads by month', counts(videos, (r) => (r.published_at ? r.published_at.slice(0, 7) : null)), total) +
	distTable('Uploads by hour (UTC — normalize by channel country for local time)', counts(videos, (r) => (r.published_at ? `${r.published_at.slice(11, 13)}:00` : null)), total) +
	`## Channels (who is documenting)\n\n` +
	summaryTable('Subscribers per channel', P.channel_subscribers) +
	summaryTable('Videos per channel', P.channel_videos) +
	distTable('Channel country', counts(channels, 'country'), channels.length) +
	`## Reposting / shared-footage network\n\n` +
	`Edges: **${P.network.edges}** (${Object.entries(P.network.byMethod).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}) · ` +
	`footage clusters: **${P.network.clusters}** · **⚠ ${P.network.misattribution}** misattribution candidate(s)\n\n` +
	(P.network.topReposted.length
		? `Most-reposted (in-degree): ${P.network.topReposted.map(([id, n]) => `\`${id}\` (${n})`).join(', ')}\n\n`
		: '') +
	`## View velocity (self-sampled)\n\n` +
	(P.velocity.withSeries
		? summaryTable('Views/day across tracked videos', P.velocity.viewsPerDay)
		: `_Needs ≥2 \`snapshot-stats\` runs. Tracked ${P.velocity.tracked} videos so far._\n\n`) +
	`## Not available via the API (design around these)\n\n` +
	`- Per-video views-over-time — only via our own \`snapshot-stats\` sampling.\n` +
	`- Audience analytics / demographics / watch-time — owner-only.\n` +
	`- Share/repost graph — derived here, not provided.\n` +
	`- Reliable per-video geolocation — deprecated; parse text instead.\n` +
	`- Third-party transcripts — owner-OAuth only.\n\n` +
	(P.facets_present
		? ''
		: `> **Facet distributions & cross-tabs** (action×actor, issue×geo, escalation ladder, co-occurrence) appear here once Phase B tagging has run.\n`);

mkdirSync(resolve(root, 'docs'), { recursive: true });
writeFileSync(resolve(root, 'docs/DATA_PROFILE.md'), md);

console.log(
	`✓ profiled ${total} videos / ${channels.length} channels → docs/DATA_PROFILE.md + data_profile.json` +
		(P.network.edges ? ` · ${P.network.clusters} clusters` : '') +
		(P.velocity.withSeries ? ` · velocity from ${P.velocity.withSeries} series` : '')
);
