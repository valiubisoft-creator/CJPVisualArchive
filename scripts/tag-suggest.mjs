#!/usr/bin/env node
/**
 * tag-suggest.mjs — LLM FIRST-PASS facet proposals (a human confirms every one later).
 *
 * Reads the controlled vocabulary (src/lib/data/vocab.json) and asks Claude to PROPOSE
 * facets for each clip via a FORCED tool call whose input_schema encodes the enums — so
 * values are vocab-valid by construction. Writes PROPOSALS ONLY; never touches events.json.
 *
 * Ethics (enforced in the schema + system prompt; see docs/TAXONOMY.md):
 *  - enum-only values (forced tool schema)
 *  - actors are role/type, NEVER a named individual
 *  - NO sensitive-attribute inference (religion/caste/ethnicity/…) — asserted per record
 *  - over-flag graphic content + identity protection
 *  - Hindi/English code-mixing is first-class (dharna, roko, lathi-charge, Chalo Sansad)
 *  - metadata-only: the model sees title/description/tags, NOT the footage — anything
 *    that needs seeing the video is proposed conservatively and left for human review
 *  - each facet carries a confidence + a quoted evidence span; "insufficient_evidence"
 *    rather than guessing
 *  - nothing auto-publishes: rows land in curation/tag_proposals.jsonl as status "pending";
 *    review-tags.mjs (human gate) accepts/edits/rejects before anything reaches events.json
 *
 * Every call is appended to curation/tag_audit.jsonl (model, prompt version, ts, usage)
 * for DPDPA accountability + WITNESS chain-of-custody.
 *
 * Usage:
 *   node scripts/tag-suggest.mjs [--corpus <path>] [--limit N] [--model <id>] [--redo] [--dry-run]
 *     --corpus    default curation/candidates_cjp.json
 *     --limit     how many untagged clips to propose for this run (default 8)
 *     --model     override the model id
 *     --redo      re-propose even if a clip already has a proposal
 *     --dry-run   print the request for the first clip and exit (no API call, no cost)
 *
 * Requires ANTHROPIC_API_KEY in .env.local.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
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

const { values } = parseArgs({
	options: {
		corpus: { type: 'string', default: 'curation/candidates_cjp.json' },
		limit: { type: 'string', default: '8' },
		model: { type: 'string' },
		redo: { type: 'boolean', default: false },
		'dry-run': { type: 'boolean', default: false }
	}
});

const MODEL = values.model ?? 'claude-sonnet-5';
const ANTHROPIC_VERSION = '2023-06-01';
const API = 'https://api.anthropic.com/v1/messages';
const PROMPT_VERSION = 'tag-suggest/v1';
const KEY = process.env.ANTHROPIC_API_KEY;

const readJSON = (p, fb) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fb);

// --- vocabulary → enums ---
const vocab = readJSON(resolve(dataDir, 'vocab.json'), null);
if (!vocab) {
	console.error('✗ src/lib/data/vocab.json not found.');
	process.exit(1);
}
const F = vocab.facets;
const enumOf = (f) => F[f].values.map((x) => x.value);
const ENUMS = {
	action: [...enumOf('action'), 'insufficient_evidence'],
	setting: [...enumOf('setting'), 'insufficient_evidence'],
	actors: enumOf('actors'),
	issues: enumOf('issues'),
	media_format: enumOf('media_format'),
	content_warnings: enumOf('content_warnings'),
	sensitivity: enumOf('sensitivity')
};
const allowed = Object.fromEntries(Object.entries(ENUMS).map(([k, v]) => [k, new Set(v)]));

// --- forced tool: enum-constrained facet proposal ---
const CONF_KEYS = ['action', 'actors', 'issues', 'setting', 'media_format', 'content_warnings', 'sensitivity'];
const TOOL = {
	name: 'propose_facets',
	description:
		'Propose the faceted tags for one protest clip, using ONLY the allowed enum values. Values you cannot support from the text: use "insufficient_evidence" for single facets, or an empty array for multi facets.',
	input_schema: {
		type: 'object',
		properties: {
			action: { type: 'string', enum: ENUMS.action, description: 'F1 primary action/event (exactly one).' },
			actors: { type: 'array', items: { type: 'string', enum: ENUMS.actors }, description: 'F2 role/type only — NEVER a named person. Empty if none evident.' },
			issues: { type: 'array', items: { type: 'string', enum: ENUMS.issues }, description: 'F3 CJP issue(s). Empty if none evident.' },
			setting: { type: 'string', enum: ENUMS.setting, description: 'F4 setting/location type (exactly one).' },
			media_format: { type: 'array', items: { type: 'string', enum: ENUMS.media_format }, description: 'F5 media format(s).' },
			content_warnings: { type: 'array', items: { type: 'string', enum: ENUMS.content_warnings }, description: 'Over-flag. Use ["none"] only if clearly nothing graphic.' },
			sensitivity: { type: 'array', items: { type: 'string', enum: ENUMS.sensitivity }, description: 'Handling flags; over-flag identity_protection_required when individuals are identifiable.' },
			confidence: {
				type: 'object',
				description: '0..1 confidence for each facet you assigned.',
				properties: Object.fromEntries(CONF_KEYS.map((k) => [k, { type: 'number' }])),
				additionalProperties: false
			},
			evidence: {
				type: 'object',
				description: 'Short quoted span from the metadata (original language ok) justifying each facet.',
				additionalProperties: { type: 'string' }
			},
			sensitive_attribute_inference: {
				type: 'string',
				enum: ['none_performed'],
				description: 'Assert you did NOT infer religion/caste/ethnicity/gender of any person.'
			},
			reasoning: { type: 'string', description: 'One or two sentences. Do not name or profile any individual.' }
		},
		required: ['action', 'actors', 'issues', 'setting', 'media_format', 'content_warnings', 'sensitivity', 'sensitive_attribute_inference']
	}
};

// --- system prompt (rules + compact vocab reference) ---
function vocabReference() {
	const line = (f) =>
		`${f} (${F[f].multi ? 'multi' : 'one'}): ` +
		F[f].values.map((v) => `${v.value}${v.kind ? `[${v.kind}]` : ''}`).join(', ');
	const issueNotes = F.issues.values
		.filter((v) => v.note)
		.map((v) => `    - ${v.value}: ${v.note}`)
		.join('\n');
	return (
		'CONTROLLED VOCABULARY (use these exact values only):\n' +
		['action', 'actors', 'issues', 'setting', 'media_format', 'content_warnings', 'sensitivity'].map(line).join('\n') +
		'\n  CJP issue notes:\n' +
		issueNotes
	);
}
const SYSTEM =
	`You are a careful human-rights archivist tagging footage from the 2026 CJP ("Cockroach Janta Party") protests in Delhi for a documentation archive. You propose faceted tags that a human curator will review; you never publish.\n\n` +
	`HARD RULES:\n` +
	`1. Use ONLY the allowed enum values (the tool enforces this).\n` +
	`2. Actors are ROLE/TYPE only (protesters, police, press, party_figures…). NEVER name or describe a specific identifiable individual.\n` +
	`3. Do NOT infer any sensitive attribute (religion, caste, ethnicity, gender, political belief) of any person. Themes describe the CAUSE, not a person. Set sensitive_attribute_inference = "none_performed".\n` +
	`4. You see only TEXT metadata (title, description, tags) — NOT the video. For anything that needs watching the footage (content warnings, who is visibly present), rely on explicit textual cues, keep confidence low, and leave it for human visual review.\n` +
	`5. Over-flag rather than under-flag content_warnings and sensitivity.identity_protection_required.\n` +
	`6. Hindi/English code-mixing is first-class: dharna, roko, lathi-charge/लाठीचार्ज, Chalo Sansad, आंसू गैस map to the right enums; never treat them as "other".\n` +
	`7. If the text does not support a facet, use "insufficient_evidence" (single) or [] (multi). Do not guess.\n` +
	`8. Give a short quoted evidence span (original language fine) for each facet you assign.\n\n` +
	vocabReference();

function buildUserPrompt(v) {
	const desc = (v.description ?? '').slice(0, 1500);
	return (
		`Propose facets for this clip (metadata only):\n\n` +
		`title: ${v.title ?? ''}\n` +
		`channel: ${v.channel ?? ''}\n` +
		`published_at: ${v.published_at ?? ''}\n` +
		`duration_seconds: ${v.duration_seconds ?? ''}\n` +
		`default_language: ${v.default_audio_language ?? ''}\n` +
		`tags: ${(v.tags ?? []).slice(0, 20).join(', ')}\n` +
		`description:\n${desc}`
	);
}

async function tagOne(v) {
	const body = {
		model: MODEL,
		max_tokens: 1024,
		system: SYSTEM,
		tools: [TOOL],
		tool_choice: { type: 'tool', name: 'propose_facets' },
		messages: [{ role: 'user', content: buildUserPrompt(v) }]
	};
	const res = await fetch(API, {
		method: 'POST',
		headers: { 'x-api-key': KEY, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	const json = await res.json();
	if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
	const tu = (json.content ?? []).find((c) => c.type === 'tool_use');
	if (!tu) throw new Error('no tool_use block in response');
	return { input: tu.input, usage: json.usage };
}

// defence-in-depth: flag any value the schema somehow let through off-vocab
function offVocab(proposals) {
	const bad = [];
	for (const [facet, set] of Object.entries(allowed)) {
		const val = proposals[facet];
		const vals = Array.isArray(val) ? val : val == null || val === 'insufficient_evidence' ? [] : [val];
		for (const x of vals) if (!set.has(x)) bad.push(`${facet}:${x}`);
	}
	return bad;
}

// --- run ---
const corpusPath = resolve(root, values.corpus);
const corpus = readJSON(corpusPath, []).filter((r) => r.youtube_id);
if (!corpus.length) {
	console.error(`✗ no clips in ${values.corpus}. Run ingest + filter first.`);
	process.exit(1);
}

const proposalsPath = resolve(root, 'curation/tag_proposals.jsonl');
const auditPath = resolve(root, 'curation/tag_audit.jsonl');
const done = new Set();
if (existsSync(proposalsPath) && !values.redo)
	for (const l of readFileSync(proposalsPath, 'utf8').split('\n').filter(Boolean))
		try {
			done.add(JSON.parse(l).youtube_id);
		} catch {
			/* skip */
		}

const targets = corpus.filter((v) => !done.has(v.youtube_id)).slice(0, Math.max(1, Number(values.limit) || 8));

if (values['dry-run']) {
	console.log('=== SYSTEM ===\n' + SYSTEM + '\n\n=== USER (first target) ===\n' + buildUserPrompt(targets[0]));
	console.log('\n=== TOOL input_schema (enums) ===\n' + JSON.stringify(ENUMS, null, 2));
	console.log(`\n[dry-run] would tag ${targets.length} clip(s) with ${MODEL}. No API call made.`);
	process.exit(0);
}

if (!KEY) {
	console.error('✗ ANTHROPIC_API_KEY not found in .env.local.');
	process.exit(1);
}

mkdirSync(dirname(proposalsPath), { recursive: true });
let ok = 0;
const flagged = [];
for (const v of targets) {
	const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
	try {
		const { input, usage } = await tagOne(v);
		const bad = offVocab(input);
		const row = {
			youtube_id: v.youtube_id,
			title: v.title,
			channel: v.channel,
			model: MODEL,
			prompt_version: PROMPT_VERSION,
			proposed_at: ts,
			status: 'pending',
			off_vocab: bad.length ? bad : undefined,
			proposals: input
		};
		appendFileSync(proposalsPath, JSON.stringify(row) + '\n');
		appendFileSync(
			auditPath,
			JSON.stringify({ ts, youtube_id: v.youtube_id, model: MODEL, prompt_version: PROMPT_VERSION, usage, off_vocab: bad.length || 0 }) + '\n'
		);
		ok++;
		const lowConf = Object.entries(input.confidence ?? {}).filter(([, c]) => c < 0.7).map(([k]) => k);
		const forceReview = lowConf.length || (input.content_warnings ?? []).some((w) => w !== 'none') || (input.sensitivity ?? []).length;
		if (forceReview) flagged.push(v.youtube_id);
		console.log(
			`  ✓ ${v.youtube_id}  action=${input.action}  issues=[${(input.issues ?? []).join(',')}]  cw=[${(input.content_warnings ?? []).join(',')}]` +
				(forceReview ? '  ⚑ needs review' : '') +
				(bad.length ? `  ⚠ off-vocab: ${bad.join(',')}` : '')
		);
	} catch (err) {
		appendFileSync(auditPath, JSON.stringify({ ts, youtube_id: v.youtube_id, model: MODEL, prompt_version: PROMPT_VERSION, error: err.message }) + '\n');
		console.error(`  ✗ ${v.youtube_id}: ${err.message}`);
	}
}

console.log(
	`\n✓ ${ok}/${targets.length} proposed → curation/tag_proposals.jsonl (status: pending) · audit → curation/tag_audit.jsonl\n` +
		`  ${flagged.length} flagged for forced human review (low confidence / content warning / sensitivity).\n` +
		`  Nothing published. Next: the human review gate (review-tags.mjs) accepts/edits/rejects before events.json.`
);
