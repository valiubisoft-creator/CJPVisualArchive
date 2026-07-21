#!/usr/bin/env node
/**
 * ingest.mjs — v2 RICH CAPTURE. Discover + hydrate protest-video metadata from
 * the YouTube Data API v3 into a candidates corpus, plus per-channel profiles and
 * decoded reference tables. Feeds curation (add-event.mjs) and profiling
 * (profile-data.mjs).
 *
 * Discovery modes (combine freely):
 *   --q "<boolean query>"            search.list — 100 units/page (scarce)
 *   --channels UC..,@handle,..       enumerate each channel's uploads — 1 unit/50 (deep, cheap)
 *
 * Hydration: videos.list requesting ALL useful parts in one 1-unit/50-id call.
 * AGGREGATE COUNTS ONLY — view/like/comment numbers; NEVER comment text/authors (PII).
 *
 * Outputs:
 *   curation/candidates.json                     rich per-video corpus (gitignored)
 *   src/lib/data/channels.json                   per-channel profiles
 *   src/lib/data/ref/{categories,regions,languages}.json   decoders (cached)
 *
 * Offline only; holds the API key. Never edits events.json.
 * Requires YT_API_KEY in .env.local (see .env.example).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseISODuration } from '../src/lib/utils/youtube.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dataDir = resolve(root, 'src/lib/data');

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
		channels: { type: 'string' }, // comma-separated: UC… ids and/or @handles
		after: { type: 'string' }, // YYYY-MM-DD
		before: { type: 'string' }, // YYYY-MM-DD
		region: { type: 'string', default: 'IN' },
		lang: { type: 'string', default: 'en' },
		order: { type: 'string', default: 'relevance' },
		duration: { type: 'string' }, // short|medium|long
		pages: { type: 'string', default: '2' }, // search pages (50 ids each)
		'channel-pages': { type: 'string', default: '4' }, // uploads pages per channel
		out: { type: 'string', default: 'curation/candidates.json' }
	}
});

if (!values.q && !values.channels) {
	console.error('✗ Provide --q "<query>" and/or --channels UC..,@handle,.. — at least one source.');
	process.exit(1);
}

const toRFC3339 = (d, end = false) => (d ? `${d}T${end ? '23:59:59' : '00:00:00'}Z` : undefined);
const API = 'https://www.googleapis.com/youtube/v3';
let quotaUnits = 0;

async function ytGet(path, params, cost = 1) {
	const url = new URL(`${API}/${path}`);
	url.search = new URLSearchParams({ key: KEY, ...params }).toString();
	const res = await fetch(url);
	const body = await res.json();
	if (!res.ok) {
		const reason = body?.error?.errors?.[0]?.reason ?? res.status;
		throw new Error(`${path} failed: ${reason} — ${body?.error?.message ?? ''}`);
	}
	quotaUnits += cost;
	return body;
}

// --- discovery: search.list (paginated) ---
async function discoverBySearch() {
	const maxPages = Math.max(1, Number(values.pages) || 1);
	const ids = new Set();
	let pageToken;
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

		const data = await ytGet('search', params, 100);
		for (const item of data.items ?? []) if (item.id?.videoId) ids.add(item.id.videoId);
		pageToken = data.nextPageToken;
		if (!pageToken) break;
	}
	return [...ids];
}

// --- resolve @handles / UC ids → channel ids ---
async function resolveChannelIds(list) {
	const ucIds = [];
	for (const raw of list) {
		const token = raw.trim();
		if (!token) continue;
		if (token.startsWith('UC')) {
			ucIds.push(token);
		} else {
			const handle = token.replace(/^@/, '');
			const data = await ytGet('channels', { part: 'id', forHandle: handle });
			const id = data.items?.[0]?.id;
			if (id) ucIds.push(id);
			else console.warn(`  ! could not resolve channel handle @${handle}`);
		}
	}
	return [...new Set(ucIds)];
}

// --- discovery: enumerate a channel's uploads playlist ---
async function discoverByChannels(channelIds) {
	const ids = new Set();
	const maxPages = Math.max(1, Number(values['channel-pages']) || 1);
	// uploads playlist id = channel id with the 2nd char flipped U->U, "UC"→"UU"
	for (const cid of channelIds) {
		const uploads = 'UU' + cid.slice(2);
		let pageToken;
		for (let page = 0; page < maxPages; page++) {
			const params = { part: 'contentDetails', playlistId: uploads, maxResults: '50' };
			if (pageToken) params.pageToken = pageToken;
			let data;
			try {
				data = await ytGet('playlistItems', params);
			} catch (e) {
				console.warn(`  ! uploads for ${cid}: ${e.message}`);
				break;
			}
			for (const it of data.items ?? [])
				if (it.contentDetails?.videoId) ids.add(it.contentDetails.videoId);
			pageToken = data.nextPageToken;
			if (!pageToken) break;
		}
	}
	return [...ids];
}

// --- hydrate videos.list (all parts, batches of 50) ---
async function hydrateVideos(ids) {
	const items = [];
	for (let i = 0; i < ids.length; i += 50) {
		const data = await ytGet('videos', {
			part: 'snippet,contentDetails,statistics,status,topicDetails,liveStreamingDetails',
			id: ids.slice(i, i + 50).join(',')
		});
		items.push(...(data.items ?? []));
	}
	return items;
}

// --- channel profiles (all channels referenced by the corpus) ---
async function hydrateChannels(channelIds) {
	const items = [];
	for (let i = 0; i < channelIds.length; i += 50) {
		const data = await ytGet('channels', {
			part: 'snippet,statistics,contentDetails,topicDetails,brandingSettings,status',
			id: channelIds.slice(i, i + 50).join(',')
		});
		items.push(...(data.items ?? []));
	}
	return items;
}

// --- decode/cache reference tables (near-static; cache and reuse) ---
async function fetchRefTables(region) {
	const cats = await ytGet('videoCategories', { part: 'snippet', regionCode: region });
	const regions = await ytGet('i18nRegions', { part: 'snippet' });
	const langs = await ytGet('i18nLanguages', { part: 'snippet' });
	const toMap = (data, key = 'title') =>
		Object.fromEntries((data.items ?? []).map((i) => [i.id ?? i.snippet?.gl ?? i.snippet?.hl, i.snippet?.[key]]));
	return {
		categories: Object.fromEntries((cats.items ?? []).map((i) => [i.id, i.snippet?.title])),
		regions: toMap(regions, 'name'),
		languages: toMap(langs, 'name')
	};
}

const nowISO = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

function usable(v, region) {
	const rr = v.contentDetails?.regionRestriction;
	const blocked =
		rr && (rr.blocked?.includes(region) || (rr.allowed && !rr.allowed.includes(region)));
	return Boolean(v.status?.embeddable && v.status?.privacyStatus === 'public' && !blocked);
}

function toCandidate(v, region) {
	const s = v.snippet ?? {};
	const cd = v.contentDetails ?? {};
	const st = v.statistics ?? {};
	const status = v.status ?? {};
	const live = v.liveStreamingDetails;
	const num = (x) => (x == null ? null : Number(x));
	return {
		youtube_id: v.id,
		title: s.title ?? '',
		description: s.description ?? '',
		channel: s.channelTitle ?? '',
		channel_id: s.channelId ?? null,
		published_at: s.publishedAt ?? null,
		tags: s.tags ?? [],
		category_id: s.categoryId ?? null,
		default_audio_language: s.defaultAudioLanguage ?? s.defaultLanguage ?? null,
		duration_seconds: parseISODuration(cd.duration),
		definition: cd.definition ?? null, // hd | sd
		caption: cd.caption === 'true' || cd.caption === true, // exists? (not the text)
		licensed_content: cd.licensedContent ?? null,
		license: status.license ?? null, // youtube | creativeCommon
		age_restricted: cd.contentRating?.ytRating === 'ytAgeRestricted',
		region_restriction: cd.regionRestriction ?? null,
		contains_synthetic_media: status.containsSyntheticMedia ?? null,
		topic_categories: (v.topicDetails?.topicCategories ?? []).map((u) =>
			decodeURIComponent(u.split('/').pop() ?? '')
		),
		live: live
			? {
					actual_start: live.actualStartTime ?? null,
					actual_end: live.actualEndTime ?? null,
					scheduled_start: live.scheduledStartTime ?? null
				}
			: null,
		stats: { views: num(st.viewCount), likes: num(st.likeCount), comments: num(st.commentCount) },
		thumbnails: {
			medium: s.thumbnails?.medium?.url ?? `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
			// auto-sampled storyboard frames (robust for perceptual hashing in Phase C)
			storyboard: [1, 2, 3].map((n) => `https://img.youtube.com/vi/${v.id}/${n}.jpg`)
		},
		status: {
			embeddable: status.embeddable ?? null,
			privacy: status.privacyStatus ?? null,
			upload_status: status.uploadStatus ?? null,
			failure_reason: status.failureReason ?? null,
			rejection_reason: status.rejectionReason ?? null
		},
		usable: usable(v, region),
		_captured_at: nowISO
	};
}

function toChannelProfile(c) {
	const s = c.snippet ?? {};
	const st = c.statistics ?? {};
	const num = (x) => (x == null ? null : Number(x));
	return {
		channel_id: c.id,
		title: s.title ?? '',
		description: s.description ?? '',
		custom_url: s.customUrl ?? null,
		published_at: s.publishedAt ?? null, // channel age / provenance
		country: s.country ?? null,
		stats: {
			subscribers: st.hiddenSubscriberCount ? null : num(st.subscriberCount),
			videos: num(st.videoCount),
			views: num(st.viewCount)
		},
		topic_categories: (c.topicDetails?.topicCategories ?? []).map((u) =>
			decodeURIComponent(u.split('/').pop() ?? '')
		),
		uploads_playlist: c.contentDetails?.relatedPlaylists?.uploads ?? null,
		keywords: c.brandingSettings?.channel?.keywords ?? null,
		_captured_at: nowISO
	};
}

function writeJSON(path, obj) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// --- run ---
try {
	const region = values.region;

	// 1. Discover ids from both sources.
	const idSet = new Set();
	if (values.channels) {
		const channelIds = await resolveChannelIds(values.channels.split(','));
		for (const id of await discoverByChannels(channelIds)) idSet.add(id);
	}
	if (values.q) for (const id of await discoverBySearch()) idSet.add(id);
	const ids = [...idSet];
	if (ids.length === 0) {
		console.log('No candidate video ids found for that query/window/channels.');
		process.exit(0);
	}

	// 2. Hydrate videos (all parts).
	const videos = await hydrateVideos(ids);
	const candidates = videos
		.map((v) => toCandidate(v, region))
		.sort((a, b) => (b.stats.views ?? 0) - (a.stats.views ?? 0));

	// 3. Profile every channel referenced by the corpus.
	const channelIds = [...new Set(candidates.map((c) => c.channel_id).filter(Boolean))];
	const channels = (await hydrateChannels(channelIds)).map(toChannelProfile);

	// 4. Decode + cache reference tables.
	const ref = await fetchRefTables(region);

	// 5. Write outputs.
	writeJSON(resolve(root, values.out), candidates);
	writeJSON(resolve(dataDir, 'channels.json'), channels);
	writeJSON(resolve(dataDir, 'ref/categories.json'), ref.categories);
	writeJSON(resolve(dataDir, 'ref/regions.json'), ref.regions);
	writeJSON(resolve(dataDir, 'ref/languages.json'), ref.languages);

	const usableCount = candidates.filter((c) => c.usable).length;
	console.log(
		`✓ captured ${candidates.length} videos (${usableCount} site-usable) from ${channels.length} channels\n` +
			`  → ${values.out}, channels.json, ref/*.json\n` +
			`  quota used ≈ ${quotaUnits} units. Aggregate counts only; no comment text captured.\n` +
			`  Next: vet candidates → add-event.mjs; then tag-suggest / derive-network / profile-data.`
	);
} catch (err) {
	console.error(`✗ ${err.message}`);
	process.exit(1);
}
