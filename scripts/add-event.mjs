#!/usr/bin/env node
/**
 * add-event.mjs — promote a curated clip into events.json, validating against
 * the schema BEFORE writing (a malformed record never lands in the source of truth).
 *
 * Two input modes:
 *   1. Flags:   node scripts/add-event.mjs --youtube-id ABCDEFGHIJK \
 *                 --title "…" --channel "…" --source-type citizen \
 *                 --status unverified --date-claimed 2026-07-20 \
 *                 --location "Patel Chowk, New Delhi" --theme march,assembly \
 *                 --by vali [--published-at 2026-07-20T09:14:00Z] [--notes "…"] [--graphic]
 *   2. JSON:    node scripts/add-event.mjs --json '{ "youtube_id": "…", … }'
 *
 * id is auto-assigned (next evt_####); added_at defaults to now; added_by falls
 * back to $USER. Everything is checked against src/lib/schema/event.schema.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const schemaPath = resolve(root, 'src/lib/schema/event.schema.json');
const dataPath = resolve(root, 'src/lib/data/events.json');

const { values } = parseArgs({
	options: {
		json: { type: 'string' },
		'youtube-id': { type: 'string' },
		title: { type: 'string' },
		channel: { type: 'string' },
		'source-type': { type: 'string' },
		status: { type: 'string' },
		'date-claimed': { type: 'string' },
		'published-at': { type: 'string' },
		location: { type: 'string' },
		theme: { type: 'string' }, // comma-separated
		notes: { type: 'string' },
		graphic: { type: 'boolean', default: false },
		by: { type: 'string' }
	}
});

const nowISO = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const addedBy = values.by || process.env.USER || 'unknown';

/** Build the record from either --json or the individual flags. */
function buildRecord() {
	if (values.json) {
		const rec = JSON.parse(values.json);
		return { added_by: addedBy, added_at: nowISO, ...rec };
	}
	if (!values['youtube-id'] || !values.title || !values['source-type'] || !values.status) {
		console.error(
			'✗ Missing required flags. Need at least: --youtube-id --title --source-type --status\n' +
				'  (or pass a full record via --json). See the header for examples.'
		);
		process.exit(1);
	}
	return {
		youtube_id: values['youtube-id'],
		title: values.title,
		channel: values.channel ?? '',
		published_at: values['published-at'] ?? null,
		date_claimed: values['date-claimed'] ?? null,
		location_claimed: values.location ?? null,
		theme: values.theme ? values.theme.split(',').map((t) => t.trim()).filter(Boolean) : [],
		source_type: values['source-type'],
		verification_status: values.status,
		verification_notes: values.notes ?? '',
		graphic_content: Boolean(values.graphic),
		reposted_from: null,
		added_by: addedBy,
		added_at: nowISO
	};
}

const events = JSON.parse(readFileSync(dataPath, 'utf8'));
if (!Array.isArray(events)) {
	console.error('✗ events.json is not an array.');
	process.exit(1);
}

const record = buildRecord();

// Auto-assign the next evt_#### id (unless the record already carries one).
if (!record.id) {
	const maxN = events.reduce((max, e) => {
		const m = /^evt_(\d+)$/.exec(e.id ?? '');
		return m ? Math.max(max, Number(m[1])) : max;
	}, 0);
	record.id = `evt_${String(maxN + 1).padStart(4, '0')}`;
}

// Reject duplicates early with a clear message.
if (events.some((e) => e.youtube_id === record.youtube_id)) {
	console.error(`✗ youtube_id ${record.youtube_id} is already in events.json.`);
	process.exit(1);
}

// Validate against the schema BEFORE writing.
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

if (!validate(record)) {
	console.error(`✗ Record is invalid — not written:`);
	for (const e of validate.errors ?? []) {
		console.error(`  ${e.instancePath || '(root)'} ${e.message}`);
	}
	process.exit(1);
}

events.push(record);
writeFileSync(dataPath, JSON.stringify(events, null, '\t') + '\n', 'utf8');
console.log(`✓ Added ${record.id} (${record.youtube_id}) — ${events.length} records total.`);
