#!/usr/bin/env node
/**
 * filter-relevance.mjs — triage the raw capture corpus down to CJP-relevant clips.
 *
 * The channel uploads-enumeration in ingest.mjs pulls each news outlet's recent
 * uploads WHOLESALE (deep coverage the search ceiling can't reach), so
 * curation/candidates.json is CJP footage + a lot of unrelated news. This tags
 * each candidate with `_cjp_relevant` using MOVEMENT-IDENTIFYING terms only —
 * NOT generic "protest"/"Delhi", which over-match general news. Terms are from
 * CJP_Video_Capture_Inputs.md (§1 boolean query).
 *
 * Purely a triage aid before human vetting (add-event.mjs) — nothing here is
 * authoritative. Re-runnable; overwrite-safe. Does not hit the API.
 *
 * Reads:  curation/candidates.json
 * Writes: curation/candidates.json        (adds _cjp_relevant + _cjp_terms in place)
 *         curation/candidates_cjp.json     (the relevant subset — feeds network/profile)
 *
 * Usage:  node scripts/filter-relevance.mjs   (npm run filter)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const inPath = resolve(root, 'curation/candidates.json');
if (!existsSync(inPath)) {
	console.error('✗ curation/candidates.json not found. Run ingest.mjs first.');
	process.exit(1);
}

// Movement-identifying terms (EN + HI + hashtags). Deliberately excludes bare
// "protest"/"march"/"Delhi" — those alone are general-news noise here.
const TERMS = [
	['cockroach_janta_party', /cockroach\s*jan[at]+a?\s*party/i],
	['cockroach_revolution', /cockroach\s*revolution/i],
	['cjp', /\bCJP\b/],
	['chalo_sansad', /chalo\s*sansad|sansad\s*chalo/i],
	['abhijeet_dipke', /abhijeet\s*dipke/i],
	['sonam_wangchuk', /sonam\s*wangchuk/i],
	['hashtags', /#?chalosansad|#?cockroachjantaparty|#?cockroachrevolution/i],
	['devanagari_cjp', /कॉकरोच/],
	['devanagari_chalo_sansad', /चलो\s*संसद|संसद\s*चलो/],
	['devanagari_dipke', /अभिजीत\s*दिपके/],
	['devanagari_wangchuk', /सोनम\s*वांगचुक/]
];

const cands = JSON.parse(readFileSync(inPath, 'utf8'));
let relevant = 0;
const subset = [];
for (const c of cands) {
	const hay = `${c.title ?? ''}\n${c.description ?? ''}\n${(c.tags ?? []).join(' ')}\n${c.channel ?? ''}`;
	const matched = TERMS.filter(([, re]) => re.test(hay)).map(([name]) => name);
	c._cjp_relevant = matched.length > 0;
	c._cjp_terms = matched;
	if (c._cjp_relevant) {
		relevant++;
		subset.push(c);
	}
}

writeFileSync(inPath, JSON.stringify(cands, null, 2) + '\n', 'utf8');
writeFileSync(resolve(root, 'curation/candidates_cjp.json'), JSON.stringify(subset, null, 2) + '\n', 'utf8');

const pct = ((100 * relevant) / cands.length).toFixed(1);
console.log(
	`✓ tagged ${cands.length} candidates · ${relevant} CJP-relevant (${pct}%)\n` +
		`  → curation/candidates.json (in place), curation/candidates_cjp.json (subset)`
);
