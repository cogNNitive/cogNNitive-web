#!/usr/bin/env node

/**
 * skills/nn-video-script/test/rebranding-scan.test.mjs
 *
 * Automated test / lint checking:
 * 1. Active canonical procedure `generate_video_script_NN.md` contains 0 active VidGeNN tool references.
 * 2. `generate_anydeo_script_NN.md` has a clear deprecation redirect pointing to `generate_video_script_NN.md`.
 * 3. Video template `spec_NN.md` declares `generate-video-script` and `cogNNitive Video`.
 * 4. `SKILL.md` references the cogNNitive Video Script Engine and its CLI commands.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

async function runTests() {
  console.log('Running Rebranding & Procedure Regression scan...');

  // 1. Canonical procedure check
  {
    const canonicalProcPath = path.join(
      repoRoot,
      'iNNfo/specs/bluepriNNts/video/procedures/generate_video_script_NN.md'
    );
    assert.ok(fs.existsSync(canonicalProcPath), 'generate_video_script_NN.md must exist');
    const content = fs.readFileSync(canonicalProcPath, 'utf8');

    // Must use cogNNitive Video Engine and not have VidGeNN as an active tool
    assert.ok(content.includes('cogNNitive Video Tool'), 'Must reference cogNNitive Video Tool');
    assert.ok(content.includes('video-engine-cli.mjs'), 'Must reference video-engine-cli.mjs');
    assert.ok(!content.includes('tool:: [[VidGeNN]]'), 'Must not declare VidGeNN as an active tool');
    console.log('✔ Canonical procedure generate_video_script_NN.md uses cogNNitive Video Engine');
  }

  // 2. Deprecation redirect check
  {
    const legacyProcPath = path.join(
      repoRoot,
      'iNNfo/specs/bluepriNNts/video/procedures/generate_anydeo_script_NN.md'
    );
    assert.ok(fs.existsSync(legacyProcPath), 'generate_anydeo_script_NN.md must exist as a deprecation redirect');
    const content = fs.readFileSync(legacyProcPath, 'utf8');

    assert.ok(content.includes('DEPRECATED'), 'Must declare deprecation status');
    assert.ok(content.includes('generate_video_script_NN.md'), 'Must redirect to generate_video_script_NN.md');
    console.log('✔ Legacy procedure generate_anydeo_script_NN.md cleanly redirects to canonical procedure');
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
    const skillPath = path.join(repoRoot, 'skills/nn-video-script/SKILL.md');
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
