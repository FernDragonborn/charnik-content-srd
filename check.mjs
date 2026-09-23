#!/usr/bin/env node
/*
 * The pack guards its own size: every CSV's row count against `manifest.json`.
 *
 * This is what a truncated file, a bad hand-edit or a half-finished import looks like from the
 * outside — a number that moved. It cannot tell you a row is WRONG, only that the pack is no longer
 * the shape it was released as, which is the failure that otherwise ships silently.
 *
 * Zero dependencies on purpose: this repository holds data, and a guard that needs an install is a
 * guard nobody runs. Counting rows needs only quote state — a newline inside a quoted cell is not a
 * row boundary, and most of this content is multi-line prose, so `wc -l` over-counts by ~8x.
 *
 *   node check.mjs           verify against the manifest (exit 1 on any drift)
 *   node check.mjs --update  rewrite the manifest to what is on disk, after a deliberate change
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(HERE, 'manifest.json');
const DIRECTIVE = /^#\s*content-([a-z_-]+)\s*:\s*(.*)$/i;

/** Drop the `#content-…` header block, exactly as the app's loader does before it parses. */
function body(csv) {
	const lines = csv.split('\n');
	let i = 0;
	for (; i < lines.length; i++) {
		let line = (lines[i] ?? '').replace(/\r$/, '');
		if (i === 0 && line.charCodeAt(0) === 0xfeff) line = line.slice(1); // a leading BOM
		if (line.trim() === '') continue; // blank spacer lines are allowed inside the header
		if (!DIRECTIVE.test(line)) break; // the first non-directive line starts the CSV
	}
	return lines.slice(i).join('\n');
}

/**
 * Data rows in a CSV body: every line break outside a quoted field, minus the header line, minus
 * blank lines. `""` inside a quoted field is an escaped quote and leaves the state alone — which
 * falls out of toggling on every quote, since the pair toggles twice.
 */
export function countRows(csv) {
	const text = body(csv);
	let rows = 0;
	let quoted = false;
	let line = '';
	const endLine = () => {
		if (line.replace(/\r$/, '').trim() !== '') rows++;
		line = '';
	};
	for (const ch of text) {
		if (ch === '"') quoted = !quoted;
		if (ch === '\n' && !quoted) endLine();
		else line += ch;
	}
	endLine();
	return Math.max(0, rows - 1); // the header line is not a row
}

/* Run as a script, importable as a counter: the app repo proves this counter against papaparse
   over every shipped file, which is the only reason a hand-rolled CSV scan is trustworthy here. */
if (import.meta.main) {
	const packs = readdirSync(HERE, { withFileTypes: true })
		.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
		.map((e) => e.name)
		.sort();

	const counts = {};
	for (const pack of packs) {
		for (const file of readdirSync(join(HERE, pack)).filter((n) => n.endsWith('.csv')).sort()) {
			counts[`${pack}/${file}`] = countRows(readFileSync(join(HERE, pack, file), 'utf8'));
		}
	}

	if (process.argv.includes('--update')) {
		writeFileSync(MANIFEST, JSON.stringify(counts, null, '\t') + '\n');
		console.log(`manifest.json updated — ${Object.keys(counts).length} files`);
		process.exit(0);
	}

	if (!existsSync(MANIFEST)) {
		console.error('No manifest.json. Run `node check.mjs --update` to write one.');
		process.exit(1);
	}

	const expected = JSON.parse(readFileSync(MANIFEST, 'utf8'));
	const drift = [];
	for (const [file, want] of Object.entries(expected)) {
		const got = counts[file];
		if (got === undefined) drift.push(`${file}: MISSING (manifest expects ${want} rows)`);
		else if (got !== want) drift.push(`${file}: ${got} rows, manifest says ${want}`);
	}
	for (const file of Object.keys(counts)) {
		if (!(file in expected)) drift.push(`${file}: not in the manifest (${counts[file]} rows)`);
	}

	if (drift.length) {
		console.error('Row counts drifted from manifest.json:\n  ' + drift.join('\n  '));
		console.error('\nIf the change was deliberate, re-run with --update and commit both.');
		process.exit(1);
	}
	const total = Object.values(counts).reduce((n, c) => n + c, 0);
	console.log(`ok — ${Object.keys(counts).length} files, ${total} rows, all matching manifest.json`);
}
