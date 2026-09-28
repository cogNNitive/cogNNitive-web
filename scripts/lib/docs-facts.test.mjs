#!/usr/bin/env node

/**
 * scripts/lib/docs-facts.test.mjs
 *
 * Plain-node fixture tests for scripts/lib/docs-facts.mjs (matches the
 * repo's assert-based `.test.mjs`/`.test.js` convention — no test framework,
 * no repo scan, no dist import). Auto-discovered by scripts/verify.js step 0b
 * once this generator ships; run directly during development:
 *   node scripts/lib/docs-facts.test.mjs
 */

import assert from 'node:assert';
import {
  replaceRegion,
  renderMcpToolsRegion,
  renderSkillsCatalogRegion,
  checkSkillPageSet,
  findHandTypedFacts,
  normalizeOutput,
} from './docs-facts.mjs';

function section(name, fn) {
  console.log(`\n▶ ${name}`);
  fn();
}

function testReplaceRegion() {
  const fixture = [
    '# innfo-mcp',
    '',
    '## Tools',
    '',
    '<!-- generated:mcp-tools (source: innfo-mcp TOOL_REGISTRY; run node scripts/generate-docs-facts.mjs) -->',
    'STALE BODY',
    '<!-- /generated:mcp-tools -->',
    '',
    '## Running',
  ].join('\n');

  // 1. Happy path: body is replaced, markers and surrounding content survive byte-identical.
  {
    const result = replaceRegion(fixture, 'mcp-tools', '**2** tools\n\n| Tool | Description |\n|------|-------------|\n| `a` | A |\n| `b` | B |');
    assert.ok(result.includes('<!-- generated:mcp-tools (source: innfo-mcp TOOL_REGISTRY; run node scripts/generate-docs-facts.mjs) -->'), 'open marker preserved verbatim');
    assert.ok(result.includes('<!-- /generated:mcp-tools -->'), 'close marker preserved verbatim');
    assert.ok(result.includes('**2** tools'), 'new body is present');
    assert.ok(!result.includes('STALE BODY'), 'old body is gone');
    assert.ok(result.includes('## Running'), 'content after the region survives');
    assert.ok(result.includes('## Tools\n\n<!--'), 'content before the region survives');
  }

  // 2. Triangulation: a different region name / body produces a different, still-correct result.
  {
    const skillsFixture = [
      '# skills',
      '<!-- generated:skills-catalog (source: manifest/source.yaml) -->',
      'old',
      '<!-- /generated:skills-catalog -->',
    ].join('\n');
    const result = replaceRegion(skillsFixture, 'skills-catalog', '**3** skills');
    assert.ok(result.includes('**3** skills'), 'different region name replaces its own body');
    assert.ok(!result.includes('old'), 'old body for the other region name is gone');
  }

  // 3. Missing open marker fails loudly instead of appending.
  {
    assert.throws(
      () => replaceRegion('# no markers here', 'mcp-tools', 'x'),
      /missing region marker: generated:mcp-tools/,
      'missing open marker must throw naming the region',
    );
  }

  // 4. Missing close marker fails loudly.
  {
    const unclosed = '<!-- generated:mcp-tools (source: x) -->\nbody with no closing marker';
    assert.throws(
      () => replaceRegion(unclosed, 'mcp-tools', 'x'),
      /missing closing region marker: \/generated:mcp-tools/,
      'missing close marker must throw naming the region',
    );
  }

  console.log('✔ replaceRegion: replaces in place, isolates by region name, fails loudly on missing markers');
}

function testRenderMcpToolsRegion() {
  // 1. Registry order preserved, count derived from array length, not hardcoded.
  {
    const body = renderMcpToolsRegion([
      { name: 'list_models', description: 'Scan the models directory' },
      { name: 'read_model', description: 'Parse a model' },
    ]);
    assert.ok(body.startsWith('**2** tools'), 'count line reflects the input length');
    const rows = body.split('\n').filter((line) => line.startsWith('| `'));
    assert.deepStrictEqual(
      rows,
      ['| `list_models` | Scan the models directory |', '| `read_model` | Parse a model |'],
      'rows render in registry (input) order, not sorted',
    );
  }

  // 2. Triangulation: a different tool count produces a different count line — proves it is derived, not fixed.
  {
    const body = renderMcpToolsRegion([
      { name: 'a', description: 'A' },
      { name: 'b', description: 'B' },
      { name: 'c', description: 'C' },
    ]);
    assert.ok(body.startsWith('**3** tools'), 'count line tracks a 3-tool registry');
  }

  // 3. Pipe characters and multi-line whitespace in a description do not break the table row.
  {
    const body = renderMcpToolsRegion([
      { name: 'weird', description: 'Has a | pipe and\n  multiple   spaces' },
    ]);
    const row = body.split('\n').find((line) => line.startsWith('| `weird`'));
    assert.strictEqual(row, '| `weird` | Has a \\| pipe and multiple spaces |', 'pipes escaped, whitespace collapsed to single spaces');
  }

  console.log('✔ renderMcpToolsRegion: derives count from input, preserves registry order, escapes table-breaking text');
}

function testRenderSkillsCatalogRegion() {
  // 1. Source.yaml order preserved, count derived from array length; no Triggers column.
  {
    const body = renderSkillsCatalogRegion([
      { name: 'nn-start', version: 'V_3-4-1', description: 'Central system governance and start router.' },
      { name: 'nn-innfo', version: 'V_0-5-3', description: 'Author, edit, and validate iNNfo models.' },
    ]);
    assert.ok(body.startsWith('**2** skills'), 'count line reflects the input length');
    assert.ok(!/Triggers/i.test(body), 'the Triggers column is dropped');
    const rows = body.split('\n').filter((line) => line.startsWith('| ['));
    assert.deepStrictEqual(
      rows,
      [
        '| [`nn-start`](skills/nn-start.md) | `V_3-4-1` | Central system governance and start router. |',
        '| [`nn-innfo`](skills/nn-innfo.md) | `V_0-5-3` | Author, edit, and validate iNNfo models. |',
      ],
      'rows render in source.yaml (input) order, linking to the conventional skills/<name>.md page',
    );
  }

  // 2. Triangulation: a different skill count produces a different count line — proves it is derived, not fixed.
  {
    const body = renderSkillsCatalogRegion([
      { name: 'a', version: 'V_0-1-0', description: 'A' },
      { name: 'b', version: 'V_0-1-0', description: 'B' },
      { name: 'c', version: 'V_0-1-0', description: 'C' },
    ]);
    assert.ok(body.startsWith('**3** skills'), 'count line tracks a 3-skill catalog');
  }

  // 3. Pipe characters and multi-line whitespace in a description do not break the table row.
  {
    const body = renderSkillsCatalogRegion([
      { name: 'weird', version: 'V_0-1-0', description: 'Has a | pipe and\n  multiple   spaces' },
    ]);
    const row = body.split('\n').find((line) => line.startsWith('| [`weird`]'));
    assert.strictEqual(
      row,
      '| [`weird`](skills/weird.md) | `V_0-1-0` | Has a \\| pipe and multiple spaces |',
      'pipes escaped, whitespace collapsed to single spaces',
    );
  }

  console.log('✔ renderSkillsCatalogRegion: derives count from input, preserves source.yaml order, drops Triggers, escapes table-breaking text');
}

function testCheckSkillPageSet() {
  // 1. Equal sets: ok, no missing or extra pages.
  {
    const result = checkSkillPageSet(['nn-start', 'nn-innfo'], ['nn-start', 'nn-innfo']);
    assert.deepStrictEqual(result, { ok: true, missingPages: [], extraPages: [] });
  }

  // 2. A skill in source.yaml with no matching Page is reported as missing.
  {
    const result = checkSkillPageSet(['nn-start'], ['nn-start', 'nn-video-script']);
    assert.strictEqual(result.ok, false, 'a skill without a page fails the guard');
    assert.deepStrictEqual(result.missingPages, ['nn-video-script']);
    assert.deepStrictEqual(result.extraPages, []);
  }

  // 3. Triangulation: a Page with no matching skill entry is reported as extra (proves both directions are checked).
  {
    const result = checkSkillPageSet(['nn-start', 'nn-router'], ['nn-start']);
    assert.strictEqual(result.ok, false, 'a page without a skill entry fails the guard');
    assert.deepStrictEqual(result.missingPages, []);
    assert.deepStrictEqual(result.extraPages, ['nn-router']);
  }

  console.log('✔ checkSkillPageSet: ok on equal sets, reports missing pages and extra pages independently');
}

function testFindHandTypedFacts() {
  // 1. A hand-typed spelled-out count is flagged.
  {
    const violations = findHandTypedFacts([
      { path: 'docs/innfo/llms-full.txt', content: 'innfo-mcp is a stdio MCP server with seven semantic tools.' },
    ]);
    assert.strictEqual(violations.length, 1, 'exactly one violation for the spelled-out count');
    assert.strictEqual(violations[0].rule, 'tool-count');
    assert.strictEqual(violations[0].line, 1);
  }

  // 2. Triangulation: a numeric count on a different line/file is also flagged (proves it is a real regex, not a literal string match on "seven").
  {
    const violations = findHandTypedFacts([
      { path: 'docs/innfo/about.md', content: 'Line one is safe.\ninnfo-mcp exposes 9 MCP tools today.' },
    ]);
    assert.strictEqual(violations.length, 1, 'exactly one violation for the numeric count');
    assert.strictEqual(violations[0].line, 2, 'line number matches the offending line, not the file start');
    assert.strictEqual(violations[0].rule, 'tool-count');
  }

  // 3. The same literal text INSIDE a generated region must not be flagged — it is the generator's own output.
  {
    const content = [
      '## Tools',
      '<!-- generated:mcp-tools (source: x) -->',
      '**9** tools',
      '| Tool | Description |',
      '<!-- /generated:mcp-tools -->',
    ].join('\n');
    const violations = findHandTypedFacts([{ path: 'docs/innfo/documentation/innfo-mcp.md', content }]);
    assert.strictEqual(violations.length, 0, 'generated region content is excluded from the scan');
  }

  // 4. A registered skill name paired with a version literal on the same line is flagged.
  {
    const violations = findHandTypedFacts(
      [{ path: 'docs/skills/documentation/README.md', content: 'nn-start is pinned at V_1-2-0 in this doc.' }],
      { skillNames: ['nn-start'] },
    );
    assert.strictEqual(violations.length, 1, 'skill name + version literal is flagged when skillNames is provided');
    assert.strictEqual(violations[0].rule, 'skill-version');
  }

  // 5. A version literal with NO registered skill name on the line is not flagged (avoids false positives on unrelated V_x-y-z text).
  {
    const violations = findHandTypedFacts(
      [{ path: 'docs/skills/documentation/README.md', content: 'The spec pins V_1-2-0 for an unrelated reason.' }],
      { skillNames: ['nn-start'] },
    );
    assert.strictEqual(violations.length, 0, 'version literal alone (no skill name on the line) is not a violation');
  }

  console.log('✔ findHandTypedFacts: flags spelled-out and numeric tool counts and skill+version pairs, excludes generated regions, avoids false positives');
}

function testNormalizeOutput() {
  // 1. CRLF -> LF, trailing whitespace stripped, exactly one trailing newline.
  {
    const input = 'line one  \r\nline two\t\r\n\r\n\r\n';
    const result = normalizeOutput(input);
    assert.strictEqual(result, 'line one\nline two\n', 'CRLF normalized, trailing whitespace and blank tail collapsed to one newline');
  }

  // 2. Idempotent: normalizing already-normalized text is a no-op (determinism requirement).
  {
    const once = normalizeOutput('a\nb\n');
    const twice = normalizeOutput(once);
    assert.strictEqual(once, twice, 'normalizing twice produces byte-identical output');
  }

  console.log('✔ normalizeOutput: deterministic LF/no-trailing-whitespace/single-trailing-newline output');
}

function main() {
  console.log('Running docs-facts unit tests...');
  section('replaceRegion', testReplaceRegion);
  section('renderMcpToolsRegion', testRenderMcpToolsRegion);
  section('renderSkillsCatalogRegion', testRenderSkillsCatalogRegion);
  section('checkSkillPageSet', testCheckSkillPageSet);
  section('findHandTypedFacts', testFindHandTypedFacts);
  section('normalizeOutput', testNormalizeOutput);
  console.log('\nAll docs-facts unit tests passed successfully!');
}

main();
