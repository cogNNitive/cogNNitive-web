#!/usr/bin/env node

/**
 * nn-video-script/test/rebranding-scan.test.mjs
 *
 * Automated test / lint checking:
 * 1. The canonical procedure `generate_video_script_procedures_NN.md` renders through the cogNNitive Video Engine.
 * 2. The retired deprecation-redirect procedure is gone and the video template no longer routes to it.
 *    (The repo-wide ban on the retired product names lives in scripts/lib/brand-purge-guard.js.)
 * 3. Video template `spec_NN.md` declares `generate-video-script` and `cogNNitive Video`.
 * 4. `SKILL.md` references the cogNNitive Video Script Engine and its CLI commands.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../../../../..');

async function runTests() {
  console.log('Running Rebranding & Procedure Regression scan...');

  // 1. Canonical procedure check
  {
    const canonicalProcPath = path.join(
      repoRoot,
      'iNNfo/specs/bluepriNNts/video/procedures/generate_video_script_procedures_NN.md'
    );
    assert.ok(fs.existsSync(canonicalProcPath), 'generate_video_script_procedures_NN.md must exist');
    const content = fs.readFileSync(canonicalProcPath, 'utf8');

    // Must use the cogNNitive Video Engine
    assert.ok(content.includes('cogNNitive Video Tool'), 'Must reference cogNNitive Video Tool');
    assert.ok(content.includes('video-engine-cli.mjs'), 'Must reference video-engine-cli.mjs');
    console.log('✔ Canonical procedure generate_video_script_procedures_NN.md uses cogNNitive Video Engine');
  }

  // 2. Retired redirect procedure check
  {
    const procDir = path.join(repoRoot, 'iNNfo/specs/bluepriNNts/video/procedures');
    const legacy = fs.readdirSync(procDir).filter((f) => /deprecat|legacy/i.test(f) || /^generate_(?!video_script)/.test(f));
    assert.deepStrictEqual(legacy, [], `No retired redirect procedures may remain: ${legacy.join(', ')}`);
    const spec = fs.readFileSync(path.join(repoRoot, 'iNNfo/specs/bluepriNNts/video/spec_NN.md'), 'utf8');
    assert.ok(!/\(Deprecated\)/i.test(spec), 'spec_NN.md must not list deprecated procedures');
    console.log('✔ Retired redirect procedure is removed and no longer routed');
  }

  // 3. spec_NN.md verification
  {
    const specPath = path.join(repoRoot, 'iNNfo/specs/bluepriNNts/video/spec_NN.md');
    assert.ok(fs.existsSync(specPath), 'spec_NN.md must exist');
    const content = fs.readFileSync(specPath, 'utf8');

    assert.ok(content.includes('id: "generate-video-script"'), 'spec_NN.md must declare generate-video-script procedure');
    assert.ok(content.includes('cogNNitive Video'), 'spec_NN.md must use cogNNitive Video brand');
    console.log('✔ spec_NN.md correctly declares cogNNitive Video and procedure routes');
  }

  // 4. SKILL.md verification
  {
    const skillPath = path.join(repoRoot, 'iNNfo/specs/bluepriNNts/video/skills/nn-video-script/SKILL.md');
    assert.ok(fs.existsSync(skillPath), 'SKILL.md must exist');
    const content = fs.readFileSync(skillPath, 'utf8');

    assert.ok(content.includes('cogNNitive Video'), 'SKILL.md must reference cogNNitive Video');
    assert.ok(content.includes('video-engine-cli.mjs'), 'SKILL.md must document video-engine-cli.mjs');
    console.log('✔ SKILL.md documents cogNNitive Video Script Engine and CLI tooling');
  }

  console.log('\nAll rebranding and procedure regression scans passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
