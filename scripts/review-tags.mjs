#!/usr/bin/env node
/**
 * review-tags.mjs — HUMAN GATE for facet proposals. Nothing here auto-publishes.
 *
 * Walks pending rows in curation/tag_proposals.jsonl and, per clip, lets a human
 * Accept / Edit / Reject. Accepted facets are written onto the CANDIDATE record
 * (curation/candidates.json + candidates_cjp.json if present) as `facets`, so they
 * carry over when the clip is promoted to events.json via add-event.mjs. Every
 * decision is appended to curation/tag_audit.jsonl (WITNESS chain-of-custody + DPDPA).
 *
 * Forced review (never eligible for --accept-safe): confidence < 0.7 on any facet,
 * OR any content_warning, OR any sensitivity flag. On accept, an "insufficient_evidence"
 * single facet is stored as null; values are re-validated against vocab.json.
 *
 * Usage:
 *   node scripts/review-tags.mjs                     interactive review of pending
 *   node scripts/review-tags.mjs --summary           counts only; writes nothing
 *   node scripts/review-tags.mjs --accept <id>       non-interactive: accept one as-is
 *   node scripts/review-tags.mjs --reject <id> [--reason "..."]
 *   node scripts/review-tags.mjs --accept-safe       accept ONLY non-forced-review proposals
 *   [--filter flagged|all] [--limit N] [--reviewer <name>]
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dataDir = resolve(root, 'src/lib/data');
const curDir = resolve(root, 'curation');

const { values } = parseArgs({
	options: {
		summary: { type: 'boolean', default: false },
		accept: { type: 'string' },
		reject: { type: 'string' },
		reason: { type: 'string' },
		'accept-safe': { type: 'boolean', default: false },
		filter: { type: 'string', default: 'all' },
		limit: { type: 'string' },
		reviewer: { type: 'string' }
	}
});

const readJSON = (p, fb) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb);
const nowISO = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const REVIEWER = values.reviewer ?? process.env.USER ?? 'local';

// --- vocab / validation ---
const vocab = readJSON(resolve(dataDir, 'vocab.json'), { facets: {} }).facets;
const allowed = Object.fromEntries(Object.entries(vocab).map(([f, d]) => [f, new Set(d.values.map((v) => v.value))]));
const FACET_KEYS = ['action', 'actors', 'issues', 'setting', 'media_format', 'content_warnings', 'sensitivity'];
const SINGLE = new Set(['action', 'setting']);

function validateFacets(f) {
	const problems = [];
	for (const k of FACET_KEYS) {
		const set = allowed[k];
		if (!set) continue;
		if (SINGLE.has(k)) {
			const v = f[k];
			if (v != null && v !== 'insufficient_evidence' && !set.has(v)) problems.push(`${k}="${v}"`);
		} else {
			for (const v of f[k] ?? []) if (!set.has(v)) problems.push(`${k}="${v}"`);
		}
	}
	return problems;
}

// proposal.proposals → the 7-key facets object stored on the record (insufficient_evidence → null)
function toFacetObject(p) {
	const out = {};
	for (const k of FACET_KEYS) {
		if (SINGLE.has(k)) out[k] = p[k] === 'insufficient_evidence' || p[k] == null ? null : p[k];
		else out[k] = Array.isArray(p[k]) ? [...p[k]] : [];
	}
	return out;
}

function isForcedReview(p) {
	const lowConf = Object.values(p.confidence ?? {}).some((c) => c < 0.7);
	const cw = (p.content_warnings ?? []).some((w) => w !== 'none');
	const sens = (p.sensitivity ?? []).length > 0;
	return lowConf || cw || sens;
}

// --- load proposals + candidate corpora ---
const proposalsPath = resolve(curDir, 'tag_proposals.jsonl');
const auditPath = resolve(curDir, 'tag_audit.jsonl');
if (!existsSync(proposalsPath)) {
	console.error('✗ curation/tag_proposals.jsonl not found. Run: npm run tag-suggest');
	process.exit(1);
}
const rows = readFileSync(proposalsPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const candFiles = ['candidates.json', 'candidates_cjp.json']
	.map((n) => resolve(curDir, n))
	.filter(existsSync);
const corpora = candFiles.map((p) => ({ path: p, data: readJSON(p, []) }));
const idIndex = corpora.map((c) => ({ ...c, map: new Map(c.data.map((r) => [r.youtube_id, r])) }));

function writeFacetsToCandidate(id, facets) {
	let hit = false;
	for (const c of idIndex) {
		const rec = c.map.get(id);
		if (rec) {
			rec.facets = facets;
			hit = true;
		}
	}
	return hit;
}
function persist() {
	for (const c of idIndex) writeFileSync(c.path, JSON.stringify(c.data, null, 2) + '\n');
	writeFileSync(proposalsPath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}
function audit(entry) {
	mkdirSync(curDir, { recursive: true });
	appendFileSync(auditPath, JSON.stringify({ ts: nowISO(), event: 'review', reviewer: REVIEWER, ...entry }) + '\n');
}

function decide(row, decision, finalFacets, extra = {}) {
	row.status = decision; // 'accepted' | 'rejected'
	row.reviewed_by = REVIEWER;
	row.reviewed_at = nowISO();
	if (decision === 'accepted') {
		row.final_facets = finalFacets;
		writeFacetsToCandidate(row.youtube_id, finalFacets);
	}
	audit({
		youtube_id: row.youtube_id,
		decision,
		prompt_version: row.prompt_version,
		engine: row.engine,
		...(decision === 'accepted' ? { final_facets: finalFacets } : {}),
		...extra
	});
}

// --- summary (no writes) ---
function summary() {
	const by = (s) => rows.filter((r) => r.status === s).length;
	const pending = rows.filter((r) => r.status === 'pending');
	const forced = pending.filter((r) => isForcedReview(r.proposals)).length;
	console.log(`proposals: ${rows.length}`);
	console.log(`  pending:  ${pending.length}  (${forced} forced-review, ${pending.length - forced} safe)`);
	console.log(`  accepted: ${by('accepted')}`);
	console.log(`  rejected: ${by('rejected')}`);
	console.log(`  candidate corpora updated in place: ${candFiles.map((f) => f.replace(root + '/', '')).join(', ')}`);
}

// --- render one proposal ---
function render(row, i, total) {
	const p = row.proposals;
	const line = (k) => {
		const v = SINGLE.has(k) ? p[k] : `[${(p[k] ?? []).join(', ')}]`;
		const c = p.confidence?.[k] != null ? ` (${p.confidence[k]})` : '';
		const ev = p.evidence?.[k] ? ` — "${p.evidence[k]}"` : '';
		return `    ${k.padEnd(17)} ${v}${c}${ev}`;
	};
	console.log(`\n─── [${i}/${total}] ${row.youtube_id}  ·  ${row.channel ?? ''}`);
	console.log(`    ${row.title ?? ''}`);
	console.log(`    https://youtu.be/${row.youtube_id}`);
	console.log(FACET_KEYS.map(line).join('\n'));
	if (isForcedReview(p)) console.log('    ⚑ forced review (low confidence / content warning / sensitivity)');
}

// --- edit via $EDITOR ---
function editFacets(p) {
	const seed = {};
	for (const k of FACET_KEYS) seed[k] = SINGLE.has(k) ? (p[k] === 'insufficient_evidence' ? null : p[k]) : p[k] ?? [];
	const allowedList = FACET_KEYS.map((k) => `// ${k}: ${[...(allowed[k] ?? [])].join(' | ')}${SINGLE.has(k) ? ' | null' : ''}`).join('\n');
	const tmp = resolve(tmpdir(), `cjp-tags-${p && p.action ? 'edit' : 'x'}-${Math.floor(process.hrtime()[1])}.jsonc`);
	writeFileSync(tmp, `${allowedList}\n// Edit values, save & close. Single facets accept null. Multi facets are arrays.\n${JSON.stringify(seed, null, 2)}\n`);
	const editor = process.env.EDITOR || 'nano';
	const r = spawnSync(editor, [tmp], { stdio: 'inherit' });
	if (r.status !== 0) return null;
	try {
		const text = readFileSync(tmp, 'utf8').replace(/^\s*\/\/.*$/gm, '');
		const edited = JSON.parse(text);
		const facets = {};
		for (const k of FACET_KEYS) facets[k] = SINGLE.has(k) ? edited[k] ?? null : edited[k] ?? [];
		const bad = validateFacets(facets);
		if (bad.length) {
			console.log(`  ✗ off-vocab: ${bad.join(', ')} — edit discarded.`);
			return null;
		}
		return facets;
	} catch (e) {
		console.log(`  ✗ could not parse edited JSON (${e.message}) — edit discarded.`);
		return null;
	}
}

// --- non-interactive paths ---
function findPending(id) {
	const row = [...rows].reverse().find((r) => r.youtube_id === id && r.status === 'pending');
	if (!row) console.error(`✗ no pending proposal for ${id}.`);
	return row;
}

if (values.summary) {
	summary();
	process.exit(0);
}

if (values.accept) {
	const row = findPending(values.accept);
	if (!row) process.exit(1);
	const facets = toFacetObject(row.proposals);
	const bad = validateFacets(facets);
	if (bad.length) {
		console.error(`✗ proposal is off-vocab (${bad.join(', ')}); edit it instead.`);
		process.exit(1);
	}
	decide(row, 'accepted', facets);
	persist();
	console.log(`✓ accepted ${values.accept} → facets written onto candidate record(s).`);
	process.exit(0);
}

if (values.reject) {
	const row = findPending(values.reject);
	if (!row) process.exit(1);
	decide(row, 'rejected', null, values.reason ? { reason: values.reason } : {});
	persist();
	console.log(`✓ rejected ${values.reject}.`);
	process.exit(0);
}

if (values['accept-safe']) {
	const safe = rows.filter((r) => r.status === 'pending' && !isForcedReview(r.proposals));
	let n = 0;
	for (const row of safe) {
		const facets = toFacetObject(row.proposals);
		if (validateFacets(facets).length) continue;
		decide(row, 'accepted', facets);
		n++;
	}
	persist();
	console.log(`✓ auto-accepted ${n} non-forced-review proposal(s). ${rows.filter((r) => r.status === 'pending').length} still pending human review.`);
	process.exit(0);
}

// --- interactive review ---
const pool = rows.filter((r) => r.status === 'pending' && (values.filter === 'all' || isForcedReview(r.proposals)));
const limit = values.limit ? Math.max(1, Number(values.limit)) : pool.length;
const queue = pool.slice(0, limit);
if (!queue.length) {
	console.log('Nothing pending to review. (Try --filter all, or run npm run tag-suggest first.)');
	process.exit(0);
}

console.log(`Reviewing ${queue.length} pending proposal(s) as "${REVIEWER}". Keys: [a]ccept  [e]dit  [r]eject  [s]kip  [q]uit`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));
const tally = { accepted: 0, edited: 0, rejected: 0, skipped: 0 };

try {
	for (let i = 0; i < queue.length; i++) {
		const row = queue[i];
		render(row, i + 1, queue.length);
		let done = false;
		while (!done) {
			const key = (await ask('  > ')).trim().toLowerCase();
			if (key === 'a') {
				const facets = toFacetObject(row.proposals);
				if (validateFacets(facets).length) { console.log('  ✗ proposal off-vocab; use [e]dit.'); continue; }
				decide(row, 'accepted', facets);
				tally.accepted++; done = true;
			} else if (key === 'e') {
				const facets = editFacets(row.proposals);
				if (!facets) continue;
				decide(row, 'accepted', facets, { edited: true });
				tally.edited++; done = true;
			} else if (key === 'r') {
				const reason = (await ask('  reason (optional) > ')).trim();
				decide(row, 'rejected', null, reason ? { reason } : {});
				tally.rejected++; done = true;
			} else if (key === 's') {
				tally.skipped++; done = true;
			} else if (key === 'q') {
				done = true; i = queue.length;
			} else {
				console.log('  [a]ccept  [e]dit  [r]eject  [s]kip  [q]uit');
			}
		}
	}
} finally {
	rl.close();
	persist();
}

console.log(`\n✓ session done — accepted ${tally.accepted}, edited ${tally.edited}, rejected ${tally.rejected}, skipped ${tally.skipped}.`);
console.log(`  Facets written onto candidate records; carried to events.json on promotion (add-event.mjs). Audit: curation/tag_audit.jsonl`);
