#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/vus-parse-runner.mjs
 *
 * Internal helper. Imports the in-repo VUS parser
 * (`@cognnitive/innfo-video-parser`, TypeScript source) and parses one script.
 * It must run under the `tsx` loader (vus-parse.mjs spawns it with
 * `node --import tsx/esm`). Never invoked by hand.
 *
 * argv: [scriptPath]
 * stdout: JSON.stringify({ issues })
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARSER_ENTRY = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'iNNfo',
  'packages',
  'innfo-video-parser',
  'src',
  'index.ts',
);

const [scriptPath] = process.argv.slice(2);

if (!scriptPath) {
  console.error('Usage: vus-parse-runner.mjs <scriptPath>');
  process.exit(2);
}

let parse;
try {
  ({ parse } = await import(pathToFileURL(PARSER_ENTRY).href));
} catch (err) {
  console.error(`Failed to import the VUS parser from ${PARSER_ENTRY}: ${err.message}`);
  process.exit(2);
}

// The parser logs diagnostics with console.log; keep stdout clean for the JSON payload.
console.log = console.error;

const content = fs.readFileSync(scriptPath, 'utf8');
const { issues } = parse(content, scriptPath);

process.stdout.write(JSON.stringify({ issues }));
