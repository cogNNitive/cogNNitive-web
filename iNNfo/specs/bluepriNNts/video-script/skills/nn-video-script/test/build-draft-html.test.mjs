import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDraftHtml } from '../scripts/build-draft-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '..', 'scripts', 'draft-template.html');

test('the draft HTML is self-contained and substitutes the series title', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-html-'));
  const thumb = path.join(dir, 'thumb.jpg');
  fs.writeFileSync(thumb, Buffer.from('fake-jpg-bytes'));
  const draft = { schema: 'video-script.draft.v1', slug: 'demo', title: 'Demo', media: [{ id: 'm1', thumb: 'thumb.jpg' }], scenes: [] };
  const html = buildDraftHtml(draft, { baseDir: dir, templatePath: TEMPLATE, seriesTitle: 'Mi Serie' });
  assert.match(html, /data:image\/jpeg;base64,/);
  assert.match(html, /Mi Serie/);
  assert.doesNotMatch(html, /\{\{SERIES\}\}/);
  assert.doesNotMatch(html, /\/\*__DRAFT_JSON__\*\/|\/\*__THUMBS_JSON__\*\//);
  assert.match(html, /video-script\.draft\.reviewed\.v1/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a missing thumbnail is skipped, not fatal', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-html-'));
  const draft = { slug: 'demo', title: 'Demo', media: [{ id: 'm1', thumb: 'missing.jpg' }], scenes: [] };
  const html = buildDraftHtml(draft, { baseDir: dir, templatePath: TEMPLATE, seriesTitle: 'S' });
  assert.ok(html.length > 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
