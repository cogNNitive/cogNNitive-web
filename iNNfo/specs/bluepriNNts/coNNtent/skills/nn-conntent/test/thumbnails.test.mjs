/**
 * nn-conntent/test/thumbnails.test.mjs
 *
 * Thumbnails inside produce: declared sizes, the Video title, the first scene still and
 * no badge (capability two-phase-thumbnail; tasks 3b-5.4/3b-5.5).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  DEFAULT_THUMBNAIL_FORMATS,
  renderEpisodeThumbnails,
  thumbnailOutputs,
  thumbnailSizes,
} from '../scripts/lib/thumbnails.mjs';
import { buildThumbnailProject } from '../scripts/render-thumbnail.mjs';

test('an unset thumbnail_formats uses the two defaults', () => {
  assert.deepEqual(DEFAULT_THUMBNAIL_FORMATS, ['2560x1440', '1080x1920']);
  assert.deepEqual(thumbnailSizes(undefined), [
    { width: 2560, height: 1440 },
    { width: 1080, height: 1920 },
  ]);
});

test('declared sizes are honoured and malformed entries are ignored', () => {
  assert.deepEqual(thumbnailSizes(['1280x720', 'nope', '640x640']), [
    { width: 1280, height: 720 },
    { width: 640, height: 640 },
  ]);
  assert.deepEqual(thumbnailSizes(['nope']), [
    { width: 2560, height: 1440 },
    { width: 1080, height: 1920 },
  ]);
});

test('thumbnail files are <slug>_thumbnail_<W>x<H>.png', () => {
  const outputs = thumbnailOutputs({ episodeDir: 'ep', slug: 'probe', formats: ['1280x720'] });
  assert.equal(outputs[0].path, path.join('ep', 'probe_thumbnail_1280x720.png'));
});

test('every size renders with the Video title and no badge', async () => {
  const calls = [];
  const outputs = await renderEpisodeThumbnails({
    episodeDir: 'ep',
    slug: 'probe',
    title: 'Probe title',
    basePath: 'ep/first-frame.png',
    formats: ['1280x720', '640x640'],
    render: async (options) => {
      calls.push(options);
      return { outputPath: options.outputPath };
    },
  });
  assert.equal(outputs.length, 2);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.title, 'Probe title');
    assert.equal(call.badge, null, 'the engine ships no badge');
    assert.equal(call.basePath, 'ep/first-frame.png');
  }
  assert.deepEqual(calls.map((c) => [c.width, c.height]), [
    [1280, 720],
    [640, 640],
  ]);
});

test('a null badge removes the badge from the project', () => {
  const project = buildThumbnailProject({ title: 'T', badge: null, baseFileName: 'base.png' });
  assert.equal(project.indexHtml.includes('id="badge"'), false);
  const withBadge = buildThumbnailProject({ title: 'T', badge: 'Brand', baseFileName: 'base.png' });
  assert.equal(withBadge.indexHtml.includes('id="badge"'), true);
});
