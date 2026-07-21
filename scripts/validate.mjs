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
