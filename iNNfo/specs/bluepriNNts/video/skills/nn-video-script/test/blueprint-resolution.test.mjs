#!/usr/bin/env node

/**
 * nn-video-script/test/blueprint-resolution.test.mjs
 *
 * Guards the Level 2 video blueprint (`spec_NN.md`) as the canonical home for the
 * three reusable template definitions consumed by the scene compiler:
 *   - `@template`          scene style contract
 *   - `@caption_template`  caption overlay contract
 *   - `@broll_template`    B-Roll overlay contract
 *
 * Each definition MUST expose a style, animation, and positioning contract, and the
 * blueprint MUST document the inheritance/override precedence across series.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC = path.join(__dirname, '..', '..', '..', 'spec_NN.md');

function readSpec() {
  return fs.readFileSync(SPEC, 'utf8');
}

/** Extracts the body of a `## @name` template definition block. */
function block(content, name) {
  const re = new RegExp(`##\\s+${name}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+@|\\n#\\s|$)`);
  const m = re.exec(content);
  return m ? m[1] : '';
}

async function runTests() {
  console.log('Running video blueprint template definition tests...');
  const content = readSpec();

  // 1. The blueprint declares the three reusable template kinds.
  {
    for (const name of ['@template', '@caption_template', '@broll_template']) {
      assert.ok(content.includes(name), `blueprint must declare ${name}`);
    }
    console.log('✔ blueprint declares @template, @caption_template and @broll_template');
  }

  // 2. The scene template exposes its style + animation + positioning contract.
  {
    const body = block(content, '@template');
    assert.ok(body.length > 0, '@template block must have a body');
    assert.match(body, /font_family/, '@template must declare a font/style contract');
    assert.match(body, /enter_animation/, '@template must declare enter animation');
    assert.match(body, /exit_animation/, '@template must declare exit animation');
    console.log('✔ @template exposes a style, animation and positioning contract');
  }

  // 3. The caption template exposes typography + animation.
  {
    const body = block(content, '@caption_template');
    assert.ok(body.length > 0, '@caption_template block must have a body');
    assert.match(body, /caption_style/, '@caption_template must declare a caption style');
    assert.match(body, /enter_animation/, '@caption_template must declare enter animation');
    assert.match(body, /exit_animation/, '@caption_template must declare exit animation');
    console.log('✔ @caption_template exposes typography and animation');
  }

  // 4. The B-Roll template exposes duration + fit + positioning + animation.
  {
    const body = block(content, '@broll_template');
    assert.ok(body.length > 0, '@broll_template block must have a body');
    assert.match(body, /duration/, '@broll_template must declare a default duration');
    assert.match(body, /fit/, '@broll_template must declare a fit mode');
    assert.match(body, /position/, '@broll_template must declare a position');
    assert.match(body, /enter_animation/, '@broll_template must declare enter animation');
    assert.match(body, /exit_animation/, '@broll_template must declare exit animation');
    console.log('✔ @broll_template exposes duration, fit, position and animation');
  }

  // 5. Inheritance precedence is documented (series override wins over the domain default).
  {
    assert.match(content, /series_blueprint\.md/, 'blueprint must document the series override location');
    assert.match(content, /inherit/i, 'blueprint must document inheritance rules');
    console.log('✔ blueprint documents inheritance and series override precedence');
  }

  console.log('\nAll video blueprint template definition tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
