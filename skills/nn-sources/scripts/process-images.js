#!/usr/bin/env node

/**
 * process-images.js: cognitivize the photos of a domaiNN in place and write
 * optimized copies as write-once artifacts.
 *
 *   node process-images.js [projectDir] [inputDir]
 *
 *  - `inputDir` (default `sources/import/photos`, relative to `projectDir`) holds
 *    the raw images. They are never moved or rewritten: each one gets a
 *    co-located sidecar through innfo-core `cognitivize`, with a normalizer
 *    that records the image format and size and keeps the image citable;
 *  - the optimized copy of each image is a new suffixed member of its family
 *    under `artifacts/photos/` (write-once; identical bytes dedupe).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { cognitivize, writeOnce, parseName } = require('./lib/innfo-core.generated.cjs');
const { TRANNNSFORM_VERSION } = require('./lib/normalizer');

const IMAGE_FILE = /\.(jpg|jpeg|png|webp|gif)$/i;
const DEFAULT_INPUT = 'sources/import/photos';
const OPTIMIZED_DIR = 'artifacts/photos';

function isDepInstalled(pkgName) {
  try {
    require.resolve(pkgName, { paths: [__dirname] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizer injected into core `cognitivize` for image files.
 * @param {(input: Buffer) => any} sharp
 * @returns {(input: { path: string, ext: string, bytes: Uint8Array }) => Promise<{ body: string, normalizedBy: string, metadata: Record<string, string | number> }>}
 */
function createImageNormalizer(sharp) {
  return async function normalizeImage({ path: rel, ext, bytes }) {
    const info = await sharp(Buffer.from(bytes)).metadata();
    const name = path.basename(rel);
    const width = Number(info.width) || 0;
    const height = Number(info.height) || 0;
    return {
      body: `# ${name}\n\nImage (${info.format || ext}), ${width} x ${height} px.\n`,
      normalizedBy: `traNNsform v${TRANNNSFORM_VERSION}`,
      metadata: { width, height },
    };
  };
}

function optimize(sharp, bytes, ext) {
  const pipeline = sharp(Buffer.from(bytes)).resize(768, 768, { fit: 'inside', withoutEnlargement: true });
  if (ext === 'png') return pipeline.png({ quality: 80 }).toBuffer();
  if (ext === 'webp') return pipeline.webp({ quality: 80 }).toBuffer();
  if (ext === 'gif') return pipeline.gif().toBuffer();
  return pipeline.jpeg({ quality: 80 }).toBuffer();
}

/**
 * @param {string} projectDir domaiNN root
 * @param {{ inputDir?: string, sharp: (input: Buffer) => any, log?: (line: string) => void }} options
 * @returns {Promise<{ processed: number, failed: number }>}
 */
async function processImages(projectDir, { inputDir = DEFAULT_INPUT, sharp, log = () => {} }) {
  const absInput = path.join(projectDir, inputDir);
  const names = fs.readdirSync(absInput).filter((f) => IMAGE_FILE.test(f)).sort();
  const normalizer = createImageNormalizer(sharp);
  let processed = 0;
  let failed = 0;

  for (const name of names) {
    const rel = `${inputDir.replace(/\\/g, '/').replace(/\/+$/, '')}/${name}`;
    try {
      const cog = await cognitivize(projectDir, rel, { normalizer });
      if (cog.status === 'rejected') throw new Error(`not cognitivized (${cog.reason})`);
      const bytes = fs.readFileSync(path.join(projectDir, rel));
      const parsed = parseName(name);
      const ext = String(parsed.ext || path.extname(name).slice(1)).toLowerCase();
      const optimized = await optimize(sharp, bytes, ext);
      await writeOnce(projectDir, { dir: OPTIMIZED_DIR, key: parsed.key, ext: parsed.ext }, optimized, { inputs: [rel] });
      log(`Optimized: ${name}`);
      processed++;
    } catch (err) {
      log(`Failed to process ${name}: ${err.message}`);
      failed++;
    }
  }
  return { processed, failed };
}

async function main() {
  const projectDir = path.resolve(process.argv[2] || '.');
  const inputDir = process.argv[3] || DEFAULT_INPUT;

  if (!fs.existsSync(path.join(projectDir, inputDir))) {
    console.error(`Input directory does not exist: ${path.join(projectDir, inputDir)}`);
    process.exit(1);
  }

  if (!isDepInstalled('sharp')) {
    console.log('Installing "sharp" dependency locally...');
    try {
      execSync('npm install sharp', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
      console.log('"sharp" installed successfully.');
    } catch (err) {
      console.error(`Failed to install sharp: ${err.message}`);
      process.exit(1);
    }
  }

  const sharp = require('sharp');
  const { processed, failed } = await processImages(projectDir, { inputDir, sharp, log: console.log });
  console.log(`Batch image processing completed: ${processed} processed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

module.exports = { processImages, createImageNormalizer, isDepInstalled };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
