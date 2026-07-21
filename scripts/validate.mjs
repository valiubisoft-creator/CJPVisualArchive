#!/usr/bin/env node
/**
 * validate.mjs — fail the build (or curation write) if events.json breaks the schema.
 * Used by `npm run validate`, the `prebuild` hook, and CI.
 *
 * Exit 0 = valid, exit 1 = invalid (with a readable per-record report).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const schemaPath = resolve(root, 'src/lib/schema/event.schema.json');
const dataPath = resolve(root, 'src/lib/data/events.json');
const vocabPath = resolve(root, 'src/lib/data/vocab.json');

function readJSON(path) {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch (err) {
		console.error(`✗ Could not read/parse ${path}\n  ${err.message}`);
		process.exit(1);
	}
}

const schema = readJSON(schemaPath);
const events = readJSON(dataPath);
const vocab = readJSON(vocabPath).facets ?? {};

// allowed values per facet field, from vocab.json (single source of truth)
const allowed = Object.fromEntries(
	Object.entries(vocab).map(([facet, def]) => [facet, new Set(def.values.map((v) => v.value))])
);
// map event.facets keys → vocab facet key (media_format uses the media_format vocab)
function checkFacets(event, label, problems) {
	const f = event.facets;
	if (!f) return;
	const single = { action: 'action', setting: 'setting' };
	const multi = {
		actors: 'actors',
		issues: 'issues',
		media_format: 'media_format',
		content_warnings: 'content_warnings',
		sensitivity: 'sensitivity'
	};
	for (const [key, facet] of Object.entries(single)) {
		const val = f[key];
		if (val != null && allowed[facet] && !allowed[facet].has(val))
			problems.push(`  [${label}] facets.${key} "${val}" not in vocab (${facet})`);
	}
	for (const [key, facet] of Object.entries(multi)) {
		for (const val of f[key] ?? [])
			if (allowed[facet] && !allowed[facet].has(val))
				problems.push(`  [${label}] facets.${key} "${val}" not in vocab (${facet})`);
	}
}

if (!Array.isArray(events)) {
	console.error('✗ events.json must be a JSON array of event records.');
	process.exit(1);
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

let ok = 0;
const problems = [];
const seenIds = new Set();
const seenYouTube = new Set();

events.forEach((event, i) => {
	const label = event?.id ?? `index ${i}`;

	// Schema check
	if (!validate(event)) {
		for (const e of validate.errors ?? []) {
			problems.push(`  [${label}] ${e.instancePath || '(root)'} ${e.message}`);
		}
	} else {
		ok++;
	}

	// Facet values must be in the controlled vocabulary
	checkFacets(event, label, problems);

	// Cross-record integrity: unique ids and youtube_ids
	if (event?.id) {
		if (seenIds.has(event.id)) problems.push(`  [${label}] duplicate id`);
		seenIds.add(event.id);
	}
	if (event?.youtube_id) {
		if (seenYouTube.has(event.youtube_id))
			problems.push(`  [${label}] duplicate youtube_id ${event.youtube_id}`);
		seenYouTube.add(event.youtube_id);
	}
});

if (problems.length) {
	console.error(`✗ events.json failed validation (${events.length} records):`);
	console.error(problems.join('\n'));
	process.exit(1);
}

console.log(`✓ events.json valid — ${ok}/${events.length} records passed the schema.`);
