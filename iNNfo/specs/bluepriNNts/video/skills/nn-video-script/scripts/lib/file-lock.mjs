/**
 * nn-video-script/scripts/lib/file-lock.mjs
 *
 * Cross-process advisory locks built on exclusive file creation (`openSync` flag "wx").
 *
 * - The file holds `{ pid, token, ts }`. `release()` only unlinks a lock whose token is still
 *   ours, so a holder that was (wrongly) robbed can never delete its successor's lock.
 * - A held lock is kept alive by a heartbeat (mtime touch), so a long job is never considered
 *   stale while its owner is alive. A lock is stale when the owner PID is dead (immediately) or
 *   when its mtime is older than `staleMs`.
 * - A stale lock is broken by renaming it to a unique name first (only one waiter's rename can
 *   succeed) and re-checking the token of what was actually moved.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULTS = { staleMs: 10 * 60 * 1000, timeoutMs: 60 * 1000, retryMs: 25, heartbeatMs: 30 * 1000 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True unless the PID is known not to exist (EPERM means it exists but is not ours). */
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return true; // unknown: fall back to the mtime rule
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function readLock(lockPath) {
  try {
    const raw = fs.readFileSync(lockPath, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  } catch {
    return null;
  }
}

function isStale(lockPath, info, staleMs) {
  if (info && info.pid !== undefined && !pidAlive(info.pid)) return true;
  try {
    return Date.now() - fs.statSync(lockPath).mtimeMs > staleMs;
  } catch {
    return false;
  }
}

/**
 * Breaks a stale lock: rename to a unique name, then verify we moved the lock we judged stale.
 * If a fresh lock was moved by mistake it is linked straight back.
 */
function breakStale(lockPath, seen) {
  const parked = lockPath + '.stale-' + crypto.randomBytes(6).toString('hex');
  try {
    fs.renameSync(lockPath, parked);
  } catch {
    return; // another waiter won the rename
  }
  const moved = readLock(parked);
  if (seen && moved && seen.token !== undefined && moved.token !== seen.token) {
    try {
      fs.linkSync(parked, lockPath);
    } catch {
      // someone already took the lock again
    }
  }
  try {
    fs.unlinkSync(parked);
  } catch {
    // already gone
  }
}

/**
 * Tries once. Returns a release function, or null when the lock is held by a live owner.
 * @returns {(() => void) | null}
 */
function tryAcquire(lockPath, { staleMs, heartbeatMs }) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = crypto.randomBytes(8).toString('hex');
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, token, ts: Date.now() }));
      fs.closeSync(fd);
      const timer = setInterval(() => {
        try {
          const now = new Date();
          fs.utimesSync(lockPath, now, now);
        } catch {
          // lock vanished: nothing to keep alive
        }
      }, heartbeatMs);
      timer.unref?.();
      return () => {
        clearInterval(timer);
        const current = readLock(lockPath);
        if (current && current.token === token) {
          try {
            fs.unlinkSync(lockPath);
          } catch {
            // already gone
          }
        }
      };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const info = readLock(lockPath);
      if (info === null) continue; // vanished between open and read
      if (!isStale(lockPath, info, staleMs)) return null;
      breakStale(lockPath, info);
    }
  }
  return null;
}

/**
 * Waits for the lock and returns its release function.
 * @param {string} lockPath
 * @param {{ staleMs?: number, timeoutMs?: number, retryMs?: number, heartbeatMs?: number }} [opts]
 * @returns {Promise<() => void>}
 */
export async function acquireLock(lockPath, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const deadline = Date.now() + o.timeoutMs;
  let release = tryAcquire(lockPath, o);
  while (!release) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for lock ' + lockPath);
    await sleep(o.retryMs);
    release = tryAcquire(lockPath, o);
  }
  return release;
}

/**
 * Runs `fn` while holding the lock at `lockPath`.
 * @template T
 * @param {string} lockPath
 * @param {() => Promise<T> | T} fn
 * @param {{ staleMs?: number, timeoutMs?: number, retryMs?: number, heartbeatMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function withFileLock(lockPath, fn, opts = {}) {
  const release = await acquireLock(lockPath, opts);
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Acquires one of `count` named slots (`<dir>/<name>-<i>.lock`) and returns its release function.
 * @param {string} dir
 * @param {string} name
 * @param {number} count
 * @param {{ staleMs?: number, timeoutMs?: number, retryMs?: number, heartbeatMs?: number }} [opts]
 * @returns {Promise<() => void>}
 */
export async function acquireSlot(dir, name, count, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const deadline = Date.now() + o.timeoutMs;
  for (;;) {
    for (let i = 0; i < count; i++) {
      const release = tryAcquire(path.join(dir, name + '-' + i + '.lock'), o);
      if (release) return release;
    }
    if (Date.now() >= deadline) throw new Error('Timed out waiting for a free "' + name + '" slot in ' + dir);
    await sleep(o.retryMs);
  }
}
