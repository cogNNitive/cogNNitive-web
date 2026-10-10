const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.resolve(__dirname, '..', '..', 'scripts');

/**
 * Guard: user-facing / code strings in scripts/ must be English (project rule —
 * generated artifacts and code default to English). Scans every .js file for a
 * short list of Spanish stop-words that only appear in prose, not in valid
 * identifiers or English text.
 */
const SPANISH_MARKERS = [
  'soportado',
  'convertirlo',
  'archivo',
  'fichero',
  'usar el',
  'no válido',
  'invválido',
  'Proveniencia',
  'trazabilidad',
  ' según ',
  ' debe ',
  ' está ',
  ' cuando ',
];

function collectJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function run() {
  let passed = 0;
  let failed = 0;

  const files = collectJsFiles(SCRIPTS_DIR);
  const offenders = [];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const marker of SPANISH_MARKERS) {
      if (text.includes(marker)) {
        offenders.push(`${path.relative(SCRIPTS_DIR, file)} contains "${marker.trim()}"`);
      }
    }
  }

  if (offenders.length === 0) {
    console.log(`  PASS: no Spanish stop-words in ${files.length} script file(s)`);
    passed++;
  } else {
    console.log('  FAIL: Spanish strings found in scripts/:');
    for (const o of offenders) console.log(`    - ${o}`);
    failed++;
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const r = run();
  process.exit(r.failed > 0 ? 1 : 0);
}
