/**
 * nn-conntent/test/folder-contract-crosscheck.test.mjs
 *
 * The names `references/folder-contract.md` promises agree with the code that
 * produces them, so renaming a file in either place fails here. Each name is looked
 * up in the doc AND in the source that owns it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(SKILL, rel), 'utf8');

const doc = read('references/folder-contract.md');
const layout = /```\n([\s\S]*?)```/.exec(doc)?.[1] ?? '';

test('the doc has a canonical layout block', () => {
  assert.ok(layout.includes('series/<s>/'), 'the layout block lists the episode tree');
});

test('master suffix: doc and the render step agree', () => {
  assert.ok(layout.includes('<slug>_<W>x<H>.mp4'), 'the layout names the master as <slug>_<W>x<H>.mp4');
  assert.ok(doc.includes('`<slug>_<W>x<H>.mp4`'), 'the prose names the master');
  assert.ok(
    read('scripts/lib/render.mjs').includes('${slug}_${masterWidth}x${masterHeight}.mp4'),
    'lib/render.mjs names the master from the Video slug and the master resolution',
  );
});

test('the draft-era fixed names are retired', () => {
  // Slice 7b: the console drafts are gone, so the fixed names must not come back.
  assert.doesNotMatch(doc, /_draft_|<slug>_reviewed|<slug>_review_console/);
  for (const gone of ['build-draft-html.mjs', 'draft-template.html', 'build-script-from-draft.mjs']) {
    assert.equal(fs.existsSync(path.join(SKILL, 'scripts', gone)), false, `${gone} is deleted`);
  }
});

test('hyperframes/ entries: doc and engine agree', () => {
  const engine = read('scripts/lib/compile.mjs');
  for (const [name, inCode] of [['manifest.json', "'manifest.json'"], ['hyperframes', "'hyperframes'"]]) {
    assert.ok(layout.includes(name), `${name} is in the doc layout`);
    assert.ok(engine.includes(inCode), `lib/compile.mjs writes ${inCode}`);
  }
  assert.match(doc, /no `build\/`/, 'the doc states there is no build/ directory');
  assert.doesNotMatch(layout, /build\//, 'the layout block names no build/ folder');
});

test('description.md: doc and the chapter printer agree', () => {
  assert.ok(layout.includes('description.md'), 'description.md is in the doc layout');
  assert.ok(read('scripts/lib/description.mjs').includes('`description.md`'), 'the chapter block is documented as description.md');
  assert.ok(read('scripts/produce.mjs').includes('description'), 'produce writes the chapter block for description.md');
});

test('render.tmp.mp4: doc and the render step agree', () => {
  assert.ok(layout.includes('render.tmp.mp4'));
  assert.match(doc, /`render\.tmp\.mp4` during a render/);
  assert.ok(read('scripts/lib/render.mjs').includes("'render.tmp.mp4'"), 'lib/render.mjs renders through render.tmp.mp4');
});
