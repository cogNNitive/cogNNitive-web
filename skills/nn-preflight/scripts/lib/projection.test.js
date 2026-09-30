/**
 * skills/nn-preflight/scripts/lib/projection.test.js
 *
 * Unit tests for projection.js: classification states and content hashing.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { isProjectableName, classifyProjection, hashTree } = require('./projection.js');

function createTempDir(prefix = 'proj-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('isProjectableName filters dotfiles and node_modules', () => {
  assert.strictEqual(isProjectableName('SKILL.md'), true);
  assert.strictEqual(isProjectableName('scripts'), true);
  assert.strictEqual(isProjectableName('.git'), false);
  assert.strictEqual(isProjectableName('.claude'), false);
  assert.strictEqual(isProjectableName('node_modules'), false);
});

test('classifyProjection handles absent destinations', () => {
  const tmp = createTempDir();
  try {
    const src = path.join(tmp, 'src');
    const dest = path.join(tmp, 'dest-absent');
    fs.mkdirSync(src, { recursive: true });

    assert.strictEqual(classifyProjection(dest, src), 'absent');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('classifyProjection handles real directory destinations', () => {
  const tmp = createTempDir();
  try {
    const src = path.join(tmp, 'src');
    const dest = path.join(tmp, 'dest-dir');
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(dest, { recursive: true });

    assert.strictEqual(classifyProjection(dest, src), 'dir');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('classifyProjection handles valid symlinks and junctions', () => {
  const tmp = createTempDir();
  try {
    const src = path.join(tmp, 'src');
    const dest = path.join(tmp, 'dest-link');
    fs.mkdirSync(src, { recursive: true });

    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(src, dest, linkType);

    assert.strictEqual(classifyProjection(dest, src), 'link-ok');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('classifyProjection handles wrong-target symlinks', () => {
  const tmp = createTempDir();
  try {
    const src = path.join(tmp, 'src');
    const other = path.join(tmp, 'other');
    const dest = path.join(tmp, 'dest-link');
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(other, { recursive: true });

    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(other, dest, linkType);

    assert.strictEqual(classifyProjection(dest, src), 'link-wrong');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('classifyProjection handles dangling symlinks', () => {
  const tmp = createTempDir();
  try {
    const src = path.join(tmp, 'src');
    const doomed = path.join(tmp, 'doomed');
    const dest = path.join(tmp, 'dest-link');
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(doomed, { recursive: true });

    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(doomed, dest, linkType);
    fs.rmSync(doomed, { recursive: true, force: true });

    assert.strictEqual(classifyProjection(dest, src), 'link-dangling');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('hashTree returns null for non-existent directories', () => {
  assert.strictEqual(hashTree('/non/existent/path/for/test'), null);
});

test('hashTree produces identical hash for identical directory trees', () => {
  const tmp = createTempDir();
  try {
    const dir1 = path.join(tmp, 'dir1');
    const dir2 = path.join(tmp, 'dir2');
    fs.mkdirSync(path.join(dir1, 'sub'), { recursive: true });
    fs.mkdirSync(path.join(dir2, 'sub'), { recursive: true });

    fs.writeFileSync(path.join(dir1, 'a.txt'), 'hello');
    fs.writeFileSync(path.join(dir1, 'sub', 'b.txt'), 'world');

    fs.writeFileSync(path.join(dir2, 'a.txt'), 'hello');
    fs.writeFileSync(path.join(dir2, 'sub', 'b.txt'), 'world');

    // Add ignored files
    fs.writeFileSync(path.join(dir1, '.dotfile'), 'ignored');
    fs.mkdirSync(path.join(dir2, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(dir2, 'node_modules', 'dep.js'), 'ignored');

    assert.strictEqual(hashTree(dir1), hashTree(dir2));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('hashTree detects file modification or orphan files', () => {
  const tmp = createTempDir();
  try {
    const dir1 = path.join(tmp, 'dir1');
    const dir2 = path.join(tmp, 'dir2');
    fs.mkdirSync(dir1, { recursive: true });
    fs.mkdirSync(dir2, { recursive: true });

    fs.writeFileSync(path.join(dir1, 'a.txt'), 'hello');
    fs.writeFileSync(path.join(dir2, 'a.txt'), 'hello modified');

    assert.notStrictEqual(hashTree(dir1), hashTree(dir2));

    fs.writeFileSync(path.join(dir2, 'a.txt'), 'hello');
    fs.writeFileSync(path.join(dir2, 'orphan.txt'), 'extra');

    assert.notStrictEqual(hashTree(dir1), hashTree(dir2));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
