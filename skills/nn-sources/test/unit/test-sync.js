const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const INDEX = path.resolve(__dirname, '..', '..', 'scripts', 'index.js');

// The CLI reads a per-user config; a throwaway home keeps the suite off the real one.
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-home-'));

function cli(args, cwd) {
  const env = { ...process.env, HOME, USERPROFILE: HOME };
  return spawnSync(process.execPath, [INDEX, ...args], { encoding: 'utf8', cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
}

function put(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const MODEL = (extra = '') => `---\nlevel: 3\nparent_spec:\n  name: organization_V_0-1-0\n---\n\n# Organization\n${extra}\n`;

function catalog(entries) {
  const blocks = entries.map(
    (e) =>
      `## NN Synchronization: ${e.name}\nalias:: ${e.alias}\norigin_uri:: ${e.origin}\nkind:: ${e.kind || 'folder'}\nstate:: ${e.state || 'active'}\n`,
  );
  return `---\nlevel: 3\ntitle: "Sources"\n---\n\n# NN Synchronization\n\n${blocks.join('\n')}`;
}

/** A consumer domaiNN root and an origin folder, both temporary. */
function fixture(entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-root-'));
  const origin = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-origin-'));
  put(root, 'sources/sources_NN.md', catalog(entries(origin)));
  return {
    root,
    origin,
    done: () => {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(origin, { recursive: true, force: true });
    },
  };
}

/** The `propose_changeset` payloads printed on stdout, in order. */
function payloads(stdout) {
  const found = [];
  const marker = 'propose_changeset payload (comment):\n';
  let at = stdout.indexOf(marker);
  while (at !== -1) {
    const start = at + marker.length;
    const end = stdout.indexOf('\n}\n', start) + 2;
    found.push(JSON.parse(stdout.slice(start, end)));
    at = stdout.indexOf(marker, end);
  }
  return found;
}

async function run() {
  let passed = 0;
  let failed = 0;

  async function it(desc, fn) {
    try {
      await fn();
      console.log(`  PASS: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL: ${desc}`);
      console.error(err);
      failed++;
    }
  }

  console.log('\n--- test-sync ---');

  await it('--sync refreshes every active Synchronization and skips a paused one', () => {
    const f = fixture((o) => [
      { name: 'Org', alias: 'org', origin: o },
      { name: 'Frozen', alias: 'frozen', origin: o, state: 'paused' },
    ]);
    try {
      put(f.origin, 'organization_NN.md', MODEL());
      const r = cli(['--src', f.root, '--sync']);
      assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      assert.ok(fs.existsSync(path.join(f.root, 'sources/sync/org/organization_NN.md')));
      assert.ok(!fs.existsSync(path.join(f.root, 'sources/sync/frozen')), 'a paused Synchronization is not refreshed');
      assert.match(r.stdout, /frozen.*paused/i);
    } finally {
      f.done();
    }
  });

  await it('--sync <alias> refreshes only that alias', () => {
    const f = fixture((o) => [
      { name: 'Org', alias: 'org', origin: o },
      { name: 'Fin', alias: 'fin', origin: o },
    ]);
    try {
      put(f.origin, 'organization_NN.md', MODEL());
      const r = cli(['--src', f.root, '--sync', 'org']);
      assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      assert.ok(fs.existsSync(path.join(f.root, 'sources/sync/org/organization_NN.md')));
      assert.ok(!fs.existsSync(path.join(f.root, 'sources/sync/fin')));
    } finally {
      f.done();
    }
  });

  await it('prints one comment payload with per-file before->after sha256 and never writes changes/', () => {
    const f = fixture((o) => [{ name: 'Org', alias: 'org', origin: o }]);
    try {
      put(f.origin, 'organization_NN.md', MODEL('v1'));
      const first = cli(['--src', f.root, '--sync']);
      assert.strictEqual(first.status, 0, first.stderr + first.stdout);
      const [added] = payloads(first.stdout);
      assert.strictEqual(payloads(first.stdout).length, 1);
      assert.strictEqual(added.tool, 'propose_changeset');
      assert.strictEqual(added.arguments.operations.length, 1);
      const op = added.arguments.operations[0];
      assert.strictEqual(op.op, 'comment');
      assert.strictEqual(op.target, 'sources/sync/org');
      assert.strictEqual(op.evidence, 'decision');
      assert.ok(op.notes.includes(`organization_NN.md -> ${sha(MODEL('v1'))}`), op.notes);

      put(f.origin, 'organization_NN.md', MODEL('v2'));
      const second = cli(['--src', f.root, '--sync']);
      const [changed] = payloads(second.stdout);
      const notes = changed.arguments.operations[0].notes;
      assert.ok(notes.includes(`organization_NN.md ${sha(MODEL('v1'))} -> ${sha(MODEL('v2'))}`), notes);
      assert.ok(!fs.existsSync(path.join(f.root, 'changes')), 'the CLI never writes changes/');
    } finally {
      f.done();
    }
  });

  await it('prints no payload when nothing changed', () => {
    const f = fixture((o) => [{ name: 'Org', alias: 'org', origin: o }]);
    try {
      put(f.origin, 'organization_NN.md', MODEL());
      cli(['--src', f.root, '--sync']);
      const again = cli(['--src', f.root, '--sync']);
      assert.strictEqual(again.status, 0, again.stderr + again.stdout);
      assert.strictEqual(payloads(again.stdout).length, 0);
    } finally {
      f.done();
    }
  });

  await it('an unreachable origin exits 1, keeps the mirror and prints no payload for it', () => {
    const f = fixture((o) => [{ name: 'Org', alias: 'org', origin: o }]);
    try {
      put(f.origin, 'organization_NN.md', MODEL());
      cli(['--src', f.root, '--sync']);
      fs.rmSync(f.origin, { recursive: true, force: true });
      const r = cli(['--src', f.root, '--sync']);
      assert.strictEqual(r.status, 1, r.stderr + r.stdout);
      assert.ok(fs.existsSync(path.join(f.root, 'sources/sync/org/organization_NN.md')), 'the mirror is kept');
      assert.match(r.stderr, /org/);
      assert.strictEqual(payloads(r.stdout).length, 0);
    } finally {
      f.done();
    }
  });

  await it('an invalid alias is refused and never builds a mirror path', () => {
    const f = fixture((o) => [{ name: 'Bad', alias: '../x', origin: o }]);
    try {
      put(f.origin, 'organization_NN.md', MODEL());
      const r = cli(['--src', f.root, '--sync']);
      assert.strictEqual(r.status, 1, r.stderr + r.stdout);
      assert.match(r.stderr, /SYNC_ALIAS_INVALID/);
      assert.ok(!fs.existsSync(path.join(f.root, 'sources/sync')));
      assert.ok(!fs.existsSync(path.join(path.dirname(f.root), 'x')));
    } finally {
      f.done();
    }
  });

  await it('--sync <alias> with an unknown alias exits 1', () => {
    const f = fixture((o) => [{ name: 'Org', alias: 'org', origin: o }]);
    try {
      const r = cli(['--src', f.root, '--sync', 'nope']);
      assert.strictEqual(r.status, 1, r.stderr + r.stdout);
      assert.match(r.stderr, /nope/);
    } finally {
      f.done();
    }
  });

  await it('non-model files land under sources/import/<alias> with origin keys in their sidecar', () => {
    const f = fixture((o) => [{ name: 'Org', alias: 'org', origin: o }]);
    try {
      put(f.origin, 'docs/notes.md', '# Notes\n');
      const r = cli(['--src', f.root, '--sync']);
      assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      const dir = path.join(f.root, 'sources/import/org/docs');
      const sidecar = fs.readdirSync(dir).find((n) => n.endsWith('_sidecar_NN.md'));
      assert.ok(sidecar, fs.readdirSync(dir).join(','));
      const text = fs.readFileSync(path.join(dir, sidecar), 'utf8');
      assert.match(text, /synchronization: org/);
      assert.match(text, /origin_path: docs\/notes\.md/);
    } finally {
      f.done();
    }
  });

  await it('--sync without an alias removes an orphan mirror and prints one payload for it', () => {
    const f = fixture((o) => [{ name: 'Org', alias: 'org', origin: o }]);
    try {
      put(f.origin, 'organization_NN.md', MODEL());
      put(f.root, 'sources/sync/gone/old_NN.md', MODEL());
      const r = cli(['--src', f.root, '--sync']);
      assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      assert.ok(!fs.existsSync(path.join(f.root, 'sources/sync/gone')), 'the orphan mirror is removed');
      const orphan = payloads(r.stdout).filter((p) => p.arguments.operations[0].target === 'sources/sync/gone');
      assert.strictEqual(orphan.length, 1);
      assert.ok(orphan[0].arguments.operations[0].notes.includes(`old_NN.md ${sha(MODEL())} ->`));
    } finally {
      f.done();
    }
  });

  await it('--sync <alias> does not remove orphans', () => {
    const f = fixture((o) => [{ name: 'Org', alias: 'org', origin: o }]);
    try {
      put(f.origin, 'organization_NN.md', MODEL());
      put(f.root, 'sources/sync/gone/old_NN.md', MODEL());
      const r = cli(['--src', f.root, '--sync', 'org']);
      assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      assert.ok(fs.existsSync(path.join(f.root, 'sources/sync/gone/old_NN.md')));
    } finally {
      f.done();
    }
  });

  await it('the watch-root flags are unknown options', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-cwd-'));
    try {
      for (const flag of ['--scan-external', '--watch-digest', '--digest-decide']) {
        const r = cli([flag, 'x'], cwd);
        assert.strictEqual(r.status, 1, `${flag}: ${r.stderr}`);
        assert.match(r.stderr, new RegExp(`unknown option.*${flag}`), `${flag}: ${r.stderr}`);
      }
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  // --- https origins: the skill downloads, nn-core stays offline ---------------------------
  const { runSync } = require('../../scripts/lib/sync');
  const URL_ORIGIN = 'https://example.test/policies/leave.html';
  const PAGE = '<html><head><title>Leave policy</title></head><body><p>Twenty days.</p></body></html>';

  /** Runs `fn` with a stubbed global fetch and captured console output; always restores both. */
  async function withStubbedFetch(respond, fn) {
    const realFetch = global.fetch;
    const realLog = console.log;
    const realError = console.error;
    const calls = [];
    const out = [];
    global.fetch = async (url) => {
      calls.push(String(url));
      return respond(String(url));
    };
    console.log = (...a) => out.push(a.join(' '));
    console.error = (...a) => out.push(a.join(' '));
    try {
      await fn(calls, out);
    } finally {
      global.fetch = realFetch;
      console.log = realLog;
      console.error = realError;
    }
  }

  const page = (body = PAGE) => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  const urlEntry = (kind = 'file') => () => [{ name: 'Leave', alias: 'leave', origin: URL_ORIGIN, kind }];

  await it('an https origin downloads through fetch into sources/import/<alias> with origin keys in the sidecar', async () => {
    const f = fixture(urlEntry());
    try {
      await withStubbedFetch(() => page(), async (calls, out) => {
        const code = await runSync(f.root, null);
        assert.strictEqual(code, 0, out.join('\n'));
        assert.deepStrictEqual(calls, [URL_ORIGIN], 'the stub intercepted the download');
        const dir = path.join(f.root, 'sources/import/leave');
        const names = fs.readdirSync(dir);
        const sidecar = names.find((n) => n.endsWith('_sidecar_NN.md'));
        assert.ok(sidecar && names.some((n) => n.endsWith('.html')), names.join(','));
        const text = fs.readFileSync(path.join(dir, sidecar), 'utf8');
        assert.match(text, /origin_uri: https:\/\/example\.test\/policies\/leave\.html/);
        assert.match(text, /retrieved_at: /);
        assert.match(text, /synchronization: leave/);
        assert.ok(!/source_url|downloaded_at/.test(text), 'the legacy keys are gone');
        assert.strictEqual(payloads(out.join('\n')).length, 1);
      });
    } finally {
      f.done();
    }
  });

  await it('re-downloading identical bytes prints no payload; changed bytes record before->after', async () => {
    const f = fixture(urlEntry());
    const changed = PAGE.replace('Twenty', 'Thirty');
    try {
      await withStubbedFetch(() => page(), async () => {
        await runSync(f.root, null);
      });
      await withStubbedFetch(() => page(), async (calls, out) => {
        assert.strictEqual(await runSync(f.root, null), 0);
        assert.strictEqual(payloads(out.join('\n')).length, 0, 'identical bytes are not a change');
      });
      await withStubbedFetch(() => page(changed), async (calls, out) => {
        assert.strictEqual(await runSync(f.root, null), 0, out.join('\n'));
        const [payload] = payloads(out.join('\n'));
        const notes = payload.arguments.operations[0].notes;
        assert.ok(notes.includes(`.html ${sha(PAGE)} -> ${sha(changed)}`), notes);
      });
    } finally {
      f.done();
    }
  });

  await it('the stub decides the outcome: an HTTP error is an unreachable origin (exit 1, nothing landed)', async () => {
    const f = fixture(urlEntry());
    try {
      await withStubbedFetch(() => new Response('gone', { status: 404, statusText: 'Not Found' }), async (calls, out) => {
        assert.strictEqual(await runSync(f.root, null), 1);
        assert.strictEqual(calls.length, 1);
        assert.ok(!fs.existsSync(path.join(f.root, 'sources/import/leave')));
        assert.strictEqual(payloads(out.join('\n')).length, 0);
      });
    } finally {
      f.done();
    }
  });

  await it('an https origin is only allowed for kind: file', async () => {
    const f = fixture(urlEntry('folder'));
    try {
      await withStubbedFetch(() => page(), async (calls, out) => {
        assert.strictEqual(await runSync(f.root, null), 1);
        assert.deepStrictEqual(calls, [], 'nothing is downloaded for a folder origin');
        assert.ok(/kind: file/.test(out.join('\n')), out.join('\n'));
      });
    } finally {
      f.done();
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
