#!/usr/bin/env node
/**
 * derive-network.mjs — derive the reposting / shared-footage network WITHOUT
 * downloading video. Two edge sources (metadata + thumbnails only):
 *
 *   Stage A — credit-link edges: a corpus video's description explicitly cites
 *     another corpus video's id/URL ("via", "credit", pasted watch?v=…). Directed,
 *     high confidence.
 *   Stage B — shared-footage edges: perceptual-hash (dHash) each video's auto
 *     thumbnail + storyboard frame; a close Hamming distance ⇒ same footage (DSV).
 *
 * FIVR caveat: this flags DSV (same footage). It deliberately does NOT edge on
 * text similarity alone, which conflates DSV with CSV/ISV (same event, different
 * camera). Only tiny JPEGs are fetched and discarded; no media is stored.
 *
 * Output: footage_edges.json + footage_clusters.json (kept separate from
 * events.json so the graph regenerates deterministically). Clusters spanning
 * conflicting claimed dates/locations are flagged as misattribution candidates.
 *
 * Usage:  node scripts/derive-network.mjs [--input <path>] [--threshold 10]
 *   default input: curation/candidates.json if present, else events.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import jpeg from 'jpeg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dataDir = resolve(root, 'src/lib/data');

const { values } = parseArgs({
	options: {
		input: { type: 'string' },
		// max dHash Hamming distance to call a match. Default 6 = the script's own
		// "high-confidence" band: empirically, ≥8 over-connects news thumbnails
		// (shared chyron/lower-third layout ⇒ a false-positive mega-cluster).
		threshold: { type: 'string', default: '6' }
	}
});
const THRESH = Number(values.threshold) || 10;

// --- load corpus ---
const inputPath = values.input
	? resolve(root, values.input)
	: existsSync(resolve(root, 'curation/candidates.json'))
		? resolve(root, 'curation/candidates.json')
		: resolve(dataDir, 'events.json');
if (!existsSync(inputPath)) {
	console.error(`✗ No corpus found (${inputPath}). Run ingest.mjs first.`);
	process.exit(1);
}
const corpus = JSON.parse(readFileSync(inputPath, 'utf8')).filter((r) => r.youtube_id);
const byId = new Map(corpus.map((r) => [r.youtube_id, r]));
const nowISO = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

// --- perceptual hash (dHash 64-bit) over YouTube thumbnails ---
function grayDownscale(img, tw, th) {
	const { width: sw, height: sh, data } = img;
	const out = new Float64Array(tw * th);
	for (let ty = 0; ty < th; ty++) {
		for (let tx = 0; tx < tw; tx++) {
			const x0 = Math.floor((tx * sw) / tw),
				x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * sw) / tw));
			const y0 = Math.floor((ty * sh) / th),
				y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * sh) / th));
			let sum = 0,
				n = 0;
			for (let y = y0; y < y1; y++)
				for (let x = x0; x < x1; x++) {
					const i = (y * sw + x) * 4;
					sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
					n++;
				}
			out[ty * tw + tx] = n ? sum / n : 0;
		}
	}
	return out;
}

function dhashHex(buffer) {
	let img;
	try {
		img = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 64 });
	} catch {
		return null;
	}
	if (!img?.width || !img?.height) return null;
	const g = grayDownscale(img, 9, 8); // 9×8 → 8×8 = 64 comparisons
	let bits = '';
	for (let r = 0; r < 8; r++)
		for (let c = 0; c < 8; c++) bits += g[r * 9 + c] < g[r * 9 + c + 1] ? '1' : '0';
	return BigInt('0b' + bits).toString(16).padStart(16, '0');
}

function hamming(a, b) {
	let x = BigInt('0x' + a) ^ BigInt('0x' + b),
		d = 0;
	while (x) {
		d += Number(x & 1n);
		x >>= 1n;
	}
	return d;
}

async function fetchHash(url) {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return dhashHex(Buffer.from(await res.arrayBuffer()));
	} catch {
		return null;
	}
}

// hash hqdefault (cover) + storyboard frame 1 (auto-sampled, robust to custom covers)
async function hashVideo(id) {
	const [hq, sb] = await Promise.all([
		fetchHash(`https://img.youtube.com/vi/${id}/hqdefault.jpg`),
		fetchHash(`https://img.youtube.com/vi/${id}/1.jpg`)
	]);
	return { hq, sb };
}

async function pool(items, size, fn) {
	const out = new Array(items.length);
	let i = 0;
	await Promise.all(
		Array.from({ length: Math.min(size, items.length) }, async () => {
			while (i < items.length) {
				const idx = i++;
				out[idx] = await fn(items[idx], idx);
			}
		})
	);
	return out;
}

// --- Stage A: credit-link edges (description cites another corpus video) ---
const ID_RE = /(?:youtu\.be\/|watch\?v=|\/embed\/|\bv=)([A-Za-z0-9_-]{11})|\b([A-Za-z0-9_-]{11})\b/g;
function creditEdges() {
	const edges = [];
	for (const r of corpus) {
		const desc = r.description ?? '';
		const cited = new Set();
		for (const m of desc.matchAll(ID_RE)) {
			const id = m[1] ?? m[2];
			if (id && id !== r.youtube_id && byId.has(id)) cited.add(id);
		}
		for (const target of cited)
			edges.push({
				source: r.youtube_id,
				target,
				relation: 'repost-of',
				method: 'credit-link',
				score: 1,
				confidence: 'high',
				detected_at: nowISO
			});
	}
	return edges;
}

// --- Stage B: shared-footage edges (thumbnail dHash) ---
function sharedFootageEdges(hashes) {
	const edges = [];
	for (let i = 0; i < corpus.length; i++) {
		for (let j = i + 1; j < corpus.length; j++) {
			const a = hashes[i],
				b = hashes[j];
			const dists = [];
			if (a.hq && b.hq) dists.push(hamming(a.hq, b.hq));
			if (a.sb && b.sb) dists.push(hamming(a.sb, b.sb));
			if (!dists.length) continue;
			const dist = Math.min(...dists);
			if (dist > THRESH) continue;
			// direction: earliest published_at ≈ original
			const ra = corpus[i],
				rb = corpus[j];
			const [earlier, later] =
				(ra.published_at ?? '') <= (rb.published_at ?? '') ? [ra, rb] : [rb, ra];
			// Same-channel matches are usually branded-thumbnail-template reuse across a
			// channel's own series, NOT cross-source footage reposting. Flag so the
			// interesting cross-channel DSV candidates can be isolated downstream.
			const sameChannel = Boolean(earlier.channel_id && earlier.channel_id === later.channel_id);
			edges.push({
				source: later.youtube_id, // repost points to original
				target: earlier.youtube_id,
				relation: 'shared-footage',
				method: 'thumbnail-dhash',
				same_channel: sameChannel,
				source_channel: later.channel ?? null,
				target_channel: earlier.channel ?? null,
				score: Number((1 - dist / 64).toFixed(3)),
				distance: dist,
				confidence: dist <= 6 ? 'high' : 'medium',
				ambiguous_direction: (ra.published_at ?? '') === (rb.published_at ?? ''),
				detected_at: nowISO
			});
		}
	}
	return edges;
}

// --- union-find → connected components ---
function clusters(edges) {
	const parent = new Map();
	const find = (x) => {
		if (!parent.has(x)) parent.set(x, x);
		while (parent.get(x) !== x) {
			parent.set(x, parent.get(parent.get(x)));
			x = parent.get(x);
		}
		return x;
	};
	const union = (a, b) => parent.set(find(a), find(b));
	for (const e of edges) union(e.source, e.target);
	const groups = new Map();
	for (const node of parent.keys()) {
		const root = find(node);
		if (!groups.has(root)) groups.set(root, []);
		groups.get(root).push(node);
	}
	return [...groups.values()].filter((g) => g.length >= 2);
}

function summariseCluster(members, idx) {
	const recs = members.map((id) => byId.get(id)).filter(Boolean);
	const inferredOriginal = recs
		.slice()
		.sort((a, b) => (a.published_at ?? '') < (b.published_at ?? '') ? -1 : 1)[0]?.youtube_id;
	const dates = [...new Set(recs.map((r) => r.date_claimed).filter(Boolean))];
	const locs = [...new Set(recs.map((r) => r.location_claimed).filter(Boolean))];
	const dateConflict = dates.length > 1;
	const locConflict = locs.length > 1;
	return {
		cluster_id: `fc_${String(idx + 1).padStart(4, '0')}`,
		members,
		size: members.length,
		inferred_original: inferredOriginal,
		misattribution_candidate: dateConflict || locConflict,
		conflicting_dates: dateConflict ? dates : undefined,
		conflicting_locations: locConflict ? locs : undefined
	};
}

// --- run ---
console.log(`Deriving network over ${corpus.length} videos (threshold ${THRESH})…`);
const credit = creditEdges();
// Cache perceptual hashes (curation/, gitignored) so re-thresholding never re-fetches.
const HASH_CACHE = resolve(root, 'curation/thumb_hashes.json');
const hashCache = existsSync(HASH_CACHE) ? JSON.parse(readFileSync(HASH_CACHE, 'utf8')) : {};
const ids = corpus.map((r) => r.youtube_id);
const toFetch = ids.filter((id) => !(id in hashCache));
if (toFetch.length) {
	console.log(`  hashing ${toFetch.length} new thumbnails (${ids.length - toFetch.length} cached)…`);
	const fetched = await pool(toFetch, 8, hashVideo);
	toFetch.forEach((id, k) => (hashCache[id] = fetched[k]));
	mkdirSync(dirname(HASH_CACHE), { recursive: true });
	writeFileSync(HASH_CACHE, JSON.stringify(hashCache) + '\n');
}
const hashes = ids.map((id) => hashCache[id] ?? { hq: null, sb: null });
const hashed = hashes.filter((h) => h.hq || h.sb).length;
const shared = sharedFootageEdges(hashes);
const edges = [...credit, ...shared];
const cls = clusters(edges).map(summariseCluster);

mkdirSync(dataDir, { recursive: true });
writeFileSync(resolve(dataDir, 'footage_edges.json'), JSON.stringify(edges, null, 2) + '\n');
writeFileSync(resolve(dataDir, 'footage_clusters.json'), JSON.stringify(cls, null, 2) + '\n');

const misattr = cls.filter((c) => c.misattribution_candidate).length;
console.log(
	`✓ ${edges.length} edges (${credit.length} credit-link, ${shared.length} shared-footage) · ` +
		`${hashed}/${corpus.length} thumbnails hashed · ${cls.length} footage clusters` +
		(misattr ? ` · ⚠ ${misattr} misattribution candidate(s)` : '') +
		`\n  → src/lib/data/footage_edges.json, footage_clusters.json`
);
