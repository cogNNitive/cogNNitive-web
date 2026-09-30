#!/usr/bin/env node
/**
 * scripts/freshness.test.js
 *
 * Plain-node tests for scripts/freshness.js's pure computeFreshness().
 * Git is fully injected via a stubbed runGit — no real git, no network.
 */

const assert = require('node:assert');

const freshnessScript = require.resolve('./freshness.js');

function freshFreshnessModule() {
  delete require.cache[freshnessScript];
  return require(freshnessScript);
}

// Full 4-key stable pin, matching manifest/source.yaml's real shape.
const SOURCE_YAML = `version: "2.0"
entrypoint: "workspace_NN.md"
skills:
  - name: nn-innfo
    repo: cogNNitive/cogNNitive
    path: actioNN/skills/nn-innfo
    version: "V_0-1-0"
    ref_key: skills
    description: Author and validate iNNfo models.
    mcp:
      - name: innfo-mcp
        repo: cogNNitive/cogNNitive
        path: iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js
        version: "0.9.0"
        ref_key: innfo-mcp
templates: []
console_assets:
  - name: innfo-console
    repo: cogNNitive/cogNNitive
    file: iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js
    version: "0.2.0"
    ref_key: innfo-console
workflows: []
channels:
  stable:
    refs:
      - key: skills
        repo: cogNNitive/cogNNitive
        version: "2.0.0"
      - key: templates
        repo: cogNNitive/cogNNitive
        version: "0.10.3"
      - key: innfo-mcp
        repo: cogNNitive/cogNNitive
      - key: innfo-console
        repo: cogNNitive/cogNNitive
  preview:
    refs:
      - key: skills
        repo: cogNNitive/cogNNitive
        ref: main
`;

const HEAD = 'HEAD';

/**
 * Builds an injectable runGit stub from an exact command-string -> response map.
 * A response that is an Error instance is thrown instead of returned.
 * @param {Record<string, string | Error>} responses
 * @returns {(args: string[]) => string}
 */
function fakeRunGit(responses) {
  return (args) => {
    const cmd = args.join(' ');
    if (Object.prototype.hasOwnProperty.call(responses, cmd)) {
      const res = responses[cmd];
      if (res instanceof Error) throw res;
      return res;
    }
    throw new Error(`unstubbed git command: ${cmd}`);
  };
}

function main() {
  console.log('Running freshness unit tests...');

  // (a) Two subsystems, distinct tags, distinct commitsSincePin — no misattribution.
  {
    const mod = freshFreshnessModule();
    const runGit = fakeRunGit({
      'rev-parse skills-v2.0.0^{commit}': '6ad8eb8000000000000000000000000000000000\n',
      'log -1 --format=%cI skills-v2.0.0': '2026-09-16T08:41:12+00:00\n',
      'rev-list --count skills-v2.0.0..HEAD -- skills/': '9\n',
      'diff --name-only skills-v2.0.0..HEAD -- skills/': 'skills/nn-preflight/scripts/preflight-check.js\n',

      'rev-parse templates-v0.10.3^{commit}': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
      'log -1 --format=%cI templates-v0.10.3': '2026-09-10T00:00:00+00:00\n',
      'rev-list --count templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '3\n',
      'diff --name-only templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': 'iNNfo/specs/bluepriNNts/business/spec_01.md\n',

      'rev-parse innfo-mcp-v0.9.0^{commit}': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n',
      'log -1 --format=%cI innfo-mcp-v0.9.0': '2026-09-01T00:00:00+00:00\n',
      'rev-list --count innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '0\n',
      'diff --name-only innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '',

      'rev-parse innfo-console-v0.2.0^{commit}': 'cccccccccccccccccccccccccccccccccccccccc\n',
      'log -1 --format=%cI innfo-console-v0.2.0': '2026-08-01T00:00:00+00:00\n',
      'rev-list --count innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '0\n',
      'diff --name-only innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '',
    });
    const subsystems = mod.computeFreshness({ sourceYaml: SOURCE_YAML, runGit, head: HEAD });
    assert.strictEqual(subsystems.skills.commitsSincePin, 9, 'skills drift must be 9');
    assert.strictEqual(subsystems.templates.commitsSincePin, 3, 'templates drift must be 3');
    assert.notStrictEqual(
      subsystems.skills.commitsSincePin,
      subsystems.templates.commitsSincePin,
      'skills and templates drift must not be conflated'
    );
    assert.deepStrictEqual(
      subsystems.skills.filesTouched,
      ['skills/nn-preflight/scripts/preflight-check.js'],
      'skills filesTouched must only list skills/ paths'
    );
    console.log('✔ (a) two subsystems, distinct tags, distinct commitsSincePin');
  }

  // (b) Unresolvable tag -> commitsSincePin: null + unresolved reason, never 0, never omitted.
  {
    const mod = freshFreshnessModule();
    const runGit = fakeRunGit({
      'rev-parse skills-v2.0.0^{commit}': new Error('fatal: ambiguous argument'),
      'rev-parse templates-v0.10.3^{commit}': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
      'log -1 --format=%cI templates-v0.10.3': '2026-09-10T00:00:00+00:00\n',
      'rev-list --count templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '0\n',
      'diff --name-only templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '',
      'rev-parse innfo-mcp-v0.9.0^{commit}': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n',
      'log -1 --format=%cI innfo-mcp-v0.9.0': '2026-09-01T00:00:00+00:00\n',
      'rev-list --count innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '0\n',
      'diff --name-only innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '',
      'rev-parse innfo-console-v0.2.0^{commit}': 'cccccccccccccccccccccccccccccccccccccccc\n',
      'log -1 --format=%cI innfo-console-v0.2.0': '2026-08-01T00:00:00+00:00\n',
      'rev-list --count innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '0\n',
      'diff --name-only innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '',
    });
    const subsystems = mod.computeFreshness({ sourceYaml: SOURCE_YAML, runGit, head: HEAD });
    assert.strictEqual(subsystems.skills.commitsSincePin, null, 'unresolved tag must report null, never 0');
    assert.ok(subsystems.skills.unresolved, 'unresolved subsystem must carry a reason');
    assert.notStrictEqual(subsystems.skills, undefined, 'unresolved subsystem must not be omitted');
    console.log('✔ (b) unresolvable tag -> commitsSincePin: null + unresolved reason');
  }

  // (c) Zero commits since pin -> subsystem still published with commitsSincePin: 0, filesTouched: [].
  {
    const mod = freshFreshnessModule();
    const runGit = fakeRunGit({
      'rev-parse skills-v2.0.0^{commit}': '6ad8eb8000000000000000000000000000000000\n',
      'log -1 --format=%cI skills-v2.0.0': '2026-09-16T08:41:12+00:00\n',
      'rev-list --count skills-v2.0.0..HEAD -- skills/': '0\n',
      'diff --name-only skills-v2.0.0..HEAD -- skills/': '',
      'rev-parse templates-v0.10.3^{commit}': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
      'log -1 --format=%cI templates-v0.10.3': '2026-09-10T00:00:00+00:00\n',
      'rev-list --count templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '0\n',
      'diff --name-only templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '',
      'rev-parse innfo-mcp-v0.9.0^{commit}': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n',
      'log -1 --format=%cI innfo-mcp-v0.9.0': '2026-09-01T00:00:00+00:00\n',
      'rev-list --count innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '0\n',
      'diff --name-only innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '',
      'rev-parse innfo-console-v0.2.0^{commit}': 'cccccccccccccccccccccccccccccccccccccccc\n',
      'log -1 --format=%cI innfo-console-v0.2.0': '2026-08-01T00:00:00+00:00\n',
      'rev-list --count innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '0\n',
      'diff --name-only innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '',
    });
    const subsystems = mod.computeFreshness({ sourceYaml: SOURCE_YAML, runGit, head: HEAD });
    assert.strictEqual(subsystems.skills.commitsSincePin, 0, 'zero drift must be reported as 0, not omitted');
    assert.deepStrictEqual(subsystems.skills.filesTouched, [], 'zero drift must report an empty filesTouched array');
    assert.ok(
      Object.prototype.hasOwnProperty.call(subsystems, 'skills'),
      'a zero-drift subsystem must not be omitted from the output'
    );
    console.log('✔ (c) zero commits since pin -> commitsSincePin: 0, filesTouched: []');
  }

  // (d) runGit throwing for one subsystem -> that subsystem unresolved, siblings still computed.
  {
    const mod = freshFreshnessModule();
    const runGit = fakeRunGit({
      'rev-parse skills-v2.0.0^{commit}': '6ad8eb8000000000000000000000000000000000\n',
      'log -1 --format=%cI skills-v2.0.0': new Error('git: unexpected failure'),
      'rev-parse templates-v0.10.3^{commit}': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
      'log -1 --format=%cI templates-v0.10.3': '2026-09-10T00:00:00+00:00\n',
      'rev-list --count templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '3\n',
      'diff --name-only templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': 'iNNfo/specs/bluepriNNts/business/spec_01.md\n',
      'rev-parse innfo-mcp-v0.9.0^{commit}': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n',
      'log -1 --format=%cI innfo-mcp-v0.9.0': '2026-09-01T00:00:00+00:00\n',
      'rev-list --count innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '0\n',
      'diff --name-only innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '',
      'rev-parse innfo-console-v0.2.0^{commit}': 'cccccccccccccccccccccccccccccccccccccccc\n',
      'log -1 --format=%cI innfo-console-v0.2.0': '2026-08-01T00:00:00+00:00\n',
      'rev-list --count innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '0\n',
      'diff --name-only innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '',
    });
    const subsystems = mod.computeFreshness({ sourceYaml: SOURCE_YAML, runGit, head: HEAD });
    assert.strictEqual(subsystems.skills.commitsSincePin, null, 'a mid-computation git failure must unresolve only that subsystem');
    assert.ok(subsystems.skills.unresolved, 'mid-computation failure must carry an unresolved reason');
    assert.strictEqual(subsystems.templates.commitsSincePin, 3, 'sibling subsystems must still be computed');
    console.log('✔ (d) runGit throwing for one subsystem -> that subsystem unresolved, siblings still computed');
  }

  // (e) Output key order stable across runs.
  {
    const mod = freshFreshnessModule();
    const runGit = fakeRunGit({
      'rev-parse skills-v2.0.0^{commit}': '6ad8eb8000000000000000000000000000000000\n',
      'log -1 --format=%cI skills-v2.0.0': '2026-09-16T08:41:12+00:00\n',
      'rev-list --count skills-v2.0.0..HEAD -- skills/': '9\n',
      'diff --name-only skills-v2.0.0..HEAD -- skills/': '',
      'rev-parse templates-v0.10.3^{commit}': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
      'log -1 --format=%cI templates-v0.10.3': '2026-09-10T00:00:00+00:00\n',
      'rev-list --count templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '3\n',
      'diff --name-only templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '',
      'rev-parse innfo-mcp-v0.9.0^{commit}': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n',
      'log -1 --format=%cI innfo-mcp-v0.9.0': '2026-09-01T00:00:00+00:00\n',
      'rev-list --count innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '0\n',
      'diff --name-only innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '',
      'rev-parse innfo-console-v0.2.0^{commit}': 'cccccccccccccccccccccccccccccccccccccccc\n',
      'log -1 --format=%cI innfo-console-v0.2.0': '2026-08-01T00:00:00+00:00\n',
      'rev-list --count innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '0\n',
      'diff --name-only innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '',
    });
    const first = mod.computeFreshness({ sourceYaml: SOURCE_YAML, runGit, head: HEAD });
    const second = mod.computeFreshness({ sourceYaml: SOURCE_YAML, runGit, head: HEAD });
    assert.deepStrictEqual(Object.keys(first), Object.keys(second), 'subsystem key order must be stable across runs');
    assert.deepStrictEqual(
      Object.keys(first),
      ['skills', 'templates', 'innfo-mcp', 'innfo-console'],
      'subsystem key order must match the declared SUBSYSTEM_PATHS table order'
    );
    console.log('✔ (e) output key order stable across runs');
  }

  // (f) Baseline resolved from manifest/source.yaml channels.stable.refs, not from sorting tags —
  // a newer unpinned tag must not mask drift.
  {
    const mod = freshFreshnessModule();
    // Only skills-v2.0.0 (the declared stable pin) is stubbed. If the implementation
    // sorted tags instead and picked up a newer skills-v2.1.0, this stub would throw
    // "unstubbed git command" for that tag, failing the test for the right reason.
    const runGit = fakeRunGit({
      'rev-parse skills-v2.0.0^{commit}': '6ad8eb8000000000000000000000000000000000\n',
      'log -1 --format=%cI skills-v2.0.0': '2026-09-16T08:41:12+00:00\n',
      'rev-list --count skills-v2.0.0..HEAD -- skills/': '9\n',
      'diff --name-only skills-v2.0.0..HEAD -- skills/': '',
      'rev-parse templates-v0.10.3^{commit}': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
      'log -1 --format=%cI templates-v0.10.3': '2026-09-10T00:00:00+00:00\n',
      'rev-list --count templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '0\n',
      'diff --name-only templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '',
      'rev-parse innfo-mcp-v0.9.0^{commit}': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n',
      'log -1 --format=%cI innfo-mcp-v0.9.0': '2026-09-01T00:00:00+00:00\n',
      'rev-list --count innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '0\n',
      'diff --name-only innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '',
      'rev-parse innfo-console-v0.2.0^{commit}': 'cccccccccccccccccccccccccccccccccccccccc\n',
      'log -1 --format=%cI innfo-console-v0.2.0': '2026-08-01T00:00:00+00:00\n',
      'rev-list --count innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '0\n',
      'diff --name-only innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '',
    });
    const subsystems = mod.computeFreshness({ sourceYaml: SOURCE_YAML, runGit, head: HEAD });
    assert.strictEqual(subsystems.skills.pinnedTag, 'skills-v2.0.0', 'baseline must be the source.yaml-pinned tag, not a newer sorted tag');
    assert.strictEqual(subsystems.skills.commitsSincePin, 9, 'drift must be measured from the pinned tag');
    console.log('✔ (f) baseline resolved from manifest/source.yaml refs, not from sorting tags');
  }

  // Every subsystem entry is self-describing: subsystem name, pinnedTag,
  // pinnedTagDate, commitsSincePin, filesTouched (spec requirement 3).
  {
    const mod = freshFreshnessModule();
    const runGit = fakeRunGit({
      'rev-parse skills-v2.0.0^{commit}': '6ad8eb8000000000000000000000000000000000\n',
      'log -1 --format=%cI skills-v2.0.0': '2026-09-16T08:41:12+00:00\n',
      'rev-list --count skills-v2.0.0..HEAD -- skills/': '9\n',
      'diff --name-only skills-v2.0.0..HEAD -- skills/': 'skills/nn-preflight/scripts/preflight-check.js\n',
      'rev-parse templates-v0.10.3^{commit}': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
      'log -1 --format=%cI templates-v0.10.3': '2026-09-10T00:00:00+00:00\n',
      'rev-list --count templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '0\n',
      'diff --name-only templates-v0.10.3..HEAD -- iNNfo/specs/bluepriNNts/': '',
      'rev-parse innfo-mcp-v0.9.0^{commit}': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n',
      'log -1 --format=%cI innfo-mcp-v0.9.0': '2026-09-01T00:00:00+00:00\n',
      'rev-list --count innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '0\n',
      'diff --name-only innfo-mcp-v0.9.0..HEAD -- iNNfo/packages/innfo-mcp/': '',
      'rev-parse innfo-console-v0.2.0^{commit}': 'cccccccccccccccccccccccccccccccccccccccc\n',
      'log -1 --format=%cI innfo-console-v0.2.0': '2026-08-01T00:00:00+00:00\n',
      'rev-list --count innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '0\n',
      'diff --name-only innfo-console-v0.2.0..HEAD -- iNNfo/specs/bluepriNNts/console/': '',
    });
    const subsystems = mod.computeFreshness({ sourceYaml: SOURCE_YAML, runGit, head: HEAD });
    for (const key of ['subsystem', 'pinnedTag', 'pinnedTagDate', 'commitsSincePin', 'filesTouched']) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(subsystems.skills, key),
        `resolved subsystem entry must carry ${key}`
      );
    }
    assert.strictEqual(subsystems.skills.subsystem, 'skills', 'entry must name its own subsystem');
    console.log('✔ resolved subsystem entries are self-describing');
  }

  console.log('All freshness unit tests passed successfully!');
}

main();
