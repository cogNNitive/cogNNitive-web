#!/usr/bin/env node
/**
 * skills/nn-video-script/scripts/render-vertical.mjs
 *
 * Cheap 16:9 -> 9:16 reframe fallback (no provider cost): blur background +
 * centered video + series header + episode title. Prefer the native path
 * (`video-engine-cli.mjs compile/render --format 9:16`, overlays scale via
 * useVideoConfig) when burned-in captions must stay inside the frame.
 *
 * Usage:
 *   node render-vertical.mjs --source renders/<ref>/master.mp4 --out renders/<ref>/master_vertical.mp4 [--series "Name"] [--title "Ep title"]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function escapeDrawtext(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

const source = arg('--source');
const out = arg('--out');
if (!source || !out) {
  console.error('Usage: node render-vertical.mjs --source <master.mp4> --out <master_vertical.mp4> [--series X] [--title Y]');
  process.exit(1);
}
const series = arg('--series') || '';
const title = arg('--title') || '';
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

// UTF-8 filter script (preserves tildes; avoids shell/fontfile quoting bugs).
const filter = [
  '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg]',
  '[0:v]scale=1080:-1[fg]',
  '[bg][fg]overlay=(W-w)/2:(H-h)/2',
  series ? `drawtext=text='${escapeDrawtext(series)}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=120:shadowcolor=black@0.8:shadowx=2:shadowy=2` : null,
  title ? `drawtext=text='${escapeDrawtext(title)}':fontsize=54:fontcolor=white:x=(w-text_w)/2:y=h-220:shadowcolor=black@0.8:shadowx=2:shadowy=2` : null,
].filter(Boolean).join(',');
const filterPath = `${path.resolve(out)}.filter.txt`;
fs.writeFileSync(filterPath, filter, 'utf8');

const r = spawnSync('ffmpeg', ['-y', '-i', path.resolve(source), '-filter_script', filterPath, '-c:a', 'copy', path.resolve(out)], { stdio: 'inherit' });
fs.rmSync(filterPath, { force: true });
if (r.status !== 0) {
  console.error('❌ [render-vertical] ffmpeg failed (fallback only; prefer --format 9:16 native render).');
  process.exit(r.status || 1);
}
console.log(`✅ [render-vertical] ${path.resolve(out)}`);
