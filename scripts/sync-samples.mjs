#!/usr/bin/env node

/**
 * scripts/sync-samples.mjs
 *
 * Synchronizes and validates canonical sample models from the Single Source of Truth
 * (_samples_nn/models/) into their respective Level-2 template distribution folders
 * (iNNfo/specs/bluepriNNts/<template>/samples/).
 *
 * Usage:
 *   node scripts/sync-samples.mjs          # Syncs files from _samples_nn to templates
 *   node scripts/sync-samples.mjs --check  # Verifies zero drift between _samples_nn and templates (fails with exit code 1 if drift is detected)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SAMPLES_SSOT_DIR = fs.existsSync(path.join(REPO_ROOT, '_samples_nn', 'kNNowledge'))
  ? path.join(REPO_ROOT, '_samples_nn', 'kNNowledge')
  : path.join(REPO_ROOT, '_samples_nn', 'models');
const BLUEPRINTS_ROOT = path.join(REPO_ROOT, 'iNNfo', 'specs', 'bluepriNNts');

export const SAMPLE_MAPPINGS = [
  {
    source: 'Ghostbusters_analysis_NN.md',
    target: path.join('analysis', 'samples', 'Ghostbusters_V_0-2-0_analysis_NN.md')
  },
  {
    source: 'Ghostbusters_business_NN.md',
    target: path.join('business', 'samples', 'Ghostbusters_V_0-2-3_business_NN.md')
  },
  {
    source: 'Ghostbusters_business-model_NN.md',
    target: path.join('business-model', 'samples', 'Ghostbusters_V_0-2-1_business-model_NN.md')
  },
  {
    source: 'Ghostbusters_documentation_NN.md',
    target: path.join('documentation', 'samples', 'Ghostbusters_V_0-2-0_documentation_NN.md')
  },
  {
    source: 'Ghostbusters_innovation_NN.md',
    target: path.join('innovation', 'samples', 'Ghostbusters_V_0-2-0_innovation_NN.md')
  },
  {
    source: 'Ghostbusters_metrics_NN.md',
    target: path.join('metrics', 'samples', 'Ghostbusters_V_0-1-0_metrics_NN.md')
  },
  {
    source: 'Ghostbusters_organization_NN.md',
    target: path.join('organization', 'samples', 'Ghostbusters_V_0-2-0_organization_NN.md')
  },
  {
    source: 'Ghostbusters_procedures_NN.md',
    target: path.join('procedures', 'samples', 'Ghostbusters_V_0-2-0_procedures_NN.md')
  },
  {
    source: 'Ghostbusters_projects_NN.md',
    target: path.join('projects', 'samples', 'Ghostbusters_V_0-2-0_projects_NN.md')
  },
  {
    source: 'Ghostbusters_repository_NN.md',
    target: path.join('repository', 'samples', 'Ghostbusters_V_0-1-0_repository_NN.md')
  },
  {
    source: 'Ghostbusters_video_NN.md',
    target: path.join('video', 'samples', 'Ghostbusters_V_0-1-0_video_NN.md')
  },
  {
    source: 'Ghostbusters_design-presets_NN.md',
    target: path.join('design-presets', 'samples', 'Ghostbusters_V_0-1-0_design-presets_NN.md')
  }
];

export function syncSamples({ check = false, silent = false } = {}) {
  let hasDrift = false;
  const errors = [];

  for (const mapping of SAMPLE_MAPPINGS) {
    const srcPath = path.join(SAMPLES_SSOT_DIR, mapping.source);
    const dstPath = path.join(BLUEPRINTS_ROOT, mapping.target);

    if (!fs.existsSync(srcPath)) {
      const msg = `Missing SSOT sample file: ${srcPath}`;
      errors.push(msg);
      hasDrift = true;
      continue;
    }

    const srcContent = fs.readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n');

    if (check) {
      if (!fs.existsSync(dstPath)) {
        errors.push(`Missing target sample file: ${dstPath}`);
        hasDrift = true;
      } else {
        const dstContent = fs.readFileSync(dstPath, 'utf8').replace(/\r\n/g, '\n');
        if (srcContent !== dstContent) {
          errors.push(`Drift detected in template sample: ${mapping.target} does not match ${mapping.source}`);
          hasDrift = true;
        }
      }
    } else {
      const dstDir = path.dirname(dstPath);
      if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir, { recursive: true });
      }
      fs.writeFileSync(dstPath, srcContent, 'utf8');
      if (!silent) {
        console.log(`  ✓ Synced ${mapping.source} -> ${mapping.target}`);
      }
    }
  }

  return { ok: !hasDrift, errors };
}

// Direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const isCheck = process.argv.includes('--check');

  if (isCheck) {
    console.log('🔍 Checking samples parity (_samples_nn/models/ <-> iNNfo/specs/bluepriNNts/*/samples/)...');
    const res = syncSamples({ check: true });
    if (!res.ok) {
      console.error('❌ Samples drift detected:');
      for (const err of res.errors) {
        console.error(`  - ${err}`);
      }
      console.error('\nRun `npm run sync:samples` to synchronize template samples from _samples_nn.');
      process.exit(1);
    }
    console.log('✅ All template samples are in sync with _samples_nn.');
  } else {
    console.log('📦 Projecting samples from _samples_nn/models/ into template packages...');
    const res = syncSamples({ check: false });
    if (!res.ok) {
      console.error('❌ Failed to sync samples:');
      for (const err of res.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    console.log('🎉 Successfully synchronized all template samples.');
  }
}
