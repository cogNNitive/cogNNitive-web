#!/usr/bin/env node

/**
 * extract.js — quick text extraction (no ingestion).
 *
 * Prints the plain text of a single file to stdout. Unlike a full scan it does
 * not write to sources/, generate scanner frontmatter, or build the provenance
 * model — useful when the agent's model cannot read a binary directly and full
 * ingestion is not needed.
 *
 * Usage:
 *   node scripts/extract.js <file> [--format pdf|docx|xlsx|txt|md|csv|json|html]
 *
 * Format is detected from the file extension when --format is omitted.
 * Because this script lives inside the skill folder, require('pdf-parse'),
 * require('mammoth') and require('xlsx') resolve against the skill's own
 * node_modules — no NODE_PATH is needed.
 */

const fs = require('fs');
const path = require('path');

const scanner = require('./scanner');

const FORMAT_BY_EXT = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.xlsx': 'xlsx',
  '.xls': 'xlsx',
  '.txt': 'txt',
  '.md': 'md',
  '.csv': 'csv',
  '.json': 'json',
  '.html': 'html',
  '.htm': 'html',
  '.doc': 'doc',
};

const FORMAT_ALIASES = { xls: 'xlsx', htm: 'html', markdown: 'md' };

const USAGE = `Usage: node scripts/extract.js <file> [--format pdf|docx|xlsx|doc|txt|md|csv|json|html]

Extracts plain text from a single file without running a full ingestion scan.
Format is detected from the file extension when --format is omitted.

The script lives inside the skill folder, so require('pdf-parse') (mammoth,
xlsx) resolves against the skill's own node_modules — no NODE_PATH is needed.`;

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function stripHeading(body) {
  return body.replace(/^# [^\n]*\n\n/, '');
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0];

  if (!filePath) {
    console.error(USAGE);
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`extract.js: file not found: ${filePath}`);
    process.exit(1);
  }

  let format = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      format = args[i + 1].toLowerCase().replace(/^\./, '');
    }
  }
  if (!format) {
    format = FORMAT_BY_EXT[path.extname(filePath).toLowerCase()];
  }
  if (format && FORMAT_ALIASES[format]) {
    format = FORMAT_ALIASES[format];
  }
  if (!format) {
    console.error(`extract.js: cannot detect format for "${filePath}". Pass --format pdf|docx|xlsx|txt|md|csv|json|html.`);
    process.exit(1);
  }

  const baseName = path.basename(filePath, path.extname(filePath));

  try {
    switch (format) {
      case 'doc':
        throw new Error("Legacy .doc is not supported — convert it to .docx, or provide the .txt");
      case 'pdf': {
        const result = await scanner.convertPdf(filePath, baseName);
        if (result.partial) {
          throw new Error(`PDF text extraction failed: ${result.note}`);
        }
        console.log(stripHeading(result.body));
        break;
      }
      case 'docx': {
        const result = await scanner.convertDocx(filePath);
        console.log(result.body);
        break;
      }
      case 'xlsx': {
        const result = scanner.convertXlsx(filePath, baseName);
        console.log(stripHeading(result.body));
        break;
      }
      case 'md':
        console.log(scanner.stripFrontmatter(readUtf8(filePath)));
        break;
      case 'html':
        console.log(scanner.htmlToPlainText(readUtf8(filePath)));
        break;
      case 'txt':
      case 'csv':
      case 'json':
        console.log(readUtf8(filePath));
        break;
      default:
        console.error(`extract.js: unsupported format "${format}".`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`extract.js: ${err.message}`);
    process.exit(1);
  }
}

main();
