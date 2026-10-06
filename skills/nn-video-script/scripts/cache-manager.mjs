#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/cache-manager.mjs
 *
 * Deterministic SHA-256 asset cache manager for media & TTS synthesis.
 * Implements content-addressed storage under `.cognnitive/cache/video/`
 * with subdirectory isolation (`tts/`, `images/`, `temp/`).
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { resolveDefaultCacheDir } from './lib/video-guard.mjs';

export class CacheManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.baseDir] Base directory for video cache. Defaults to `<workspaceRoot>/.cognnitive/cache/video`.
   * @param {boolean} [options.readOnly] Never create directories or write files (used by dry runs and pre-flight planning).
   * @param {string} [options.startDir] Where the workspace-root search starts when no baseDir is given (defaults to the cwd).
   */
  constructor(options = {}) {
    this.baseDir = options.baseDir
      ? path.resolve(options.baseDir)
      : resolveDefaultCacheDir(options.startDir || process.cwd());
    this.categories = ['tts', 'images', 'temp'];
    this.readOnly = Boolean(options.readOnly);
    if (!this.readOnly) this.ensureDirs();
  }

  /**
   * Ensures all isolation subdirectories exist.
   */
  ensureDirs() {
    for (const cat of this.categories) {
      const catDir = path.join(this.baseDir, cat);
      if (!fs.existsSync(catDir)) {
        fs.mkdirSync(catDir, { recursive: true });
      }
    }
  }

  /**
   * Returns directory path for a given category.
   * @param {string} [category=""]
   * @returns {string}
   */
  getCacheDir(category = '') {
    if (!category) return this.baseDir;
    const catDir = path.join(this.baseDir, category);
    if (!this.readOnly && !fs.existsSync(catDir)) {
      fs.mkdirSync(catDir, { recursive: true });
    }
    return catDir;
  }

  /**
   * Deterministically computes a SHA-256 hash for content and optional configuration.
   * Sorts object keys recursively to ensure deterministic serialization across runs.
   * @param {string} content
   * @param {Record<string, unknown>} [options={}]
   * @returns {string} Hex SHA-256 string
   */
  computeHash(content, options = {}) {
    const normalizedContent = (content || '').trim().normalize('NFC');
    const sortedOptionsStr = this._deterministicStringify(options);
    const hash = crypto.createHash('sha256');
    hash.update(normalizedContent);
    hash.update(':::');
    hash.update(sortedOptionsStr);
    return hash.digest('hex');
  }

  /**
   * @private
   */
  _deterministicStringify(obj) {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => this._deterministicStringify(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const entries = keys.map((k) => `${JSON.stringify(k)}:${this._deterministicStringify(obj[k])}`);
    return '{' + entries.join(',') + '}';
  }

  /**
   * Resolves the target file path for a hash, extension, and category.
   * @param {string} hash
   * @param {string} extension
   * @param {"tts" | "images" | "temp"} [category="tts"]
   * @returns {string}
   */
  resolvePath(hash, extension, category = 'tts') {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return path.join(this.getCacheDir(category), `${hash}${ext}`);
  }

  /**
   * Checks if an asset exists in cache.
   * @param {string} hash
   * @param {string} extension
   * @param {"tts" | "images" | "temp"} [category="tts"]
   * @returns {Promise<boolean>}
   */
  async has(hash, extension, category = 'tts') {
    const filePath = this.resolvePath(hash, extension, category);
    return fs.existsSync(filePath);
  }

  /**
   * Synchronous check for asset in cache.
   * @param {string} hash
   * @param {string} extension
   * @param {"tts" | "images" | "temp"} [category="tts"]
   * @returns {boolean}
   */
  hasSync(hash, extension, category = 'tts') {
    const filePath = this.resolvePath(hash, extension, category);
    return fs.existsSync(filePath);
  }

  /**
   * Retrieves asset file path if present in cache, otherwise null.
   * @param {string} hash
   * @param {string} extension
   * @param {"tts" | "images" | "temp"} [category="tts"]
   * @returns {Promise<string | null>}
   */
  async get(hash, extension, category = 'tts') {
    const filePath = this.resolvePath(hash, extension, category);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  /**
   * Synchronously retrieves asset file path if present in cache, otherwise null.
   * @param {string} hash
   * @param {string} extension
   * @param {"tts" | "images" | "temp"} [category="tts"]
   * @returns {string | null}
   */
  getSync(hash, extension, category = 'tts') {
    const filePath = this.resolvePath(hash, extension, category);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  /**
   * Stores data in cache under the computed hash.
   * @param {string} hash
   * @param {string} extension
   * @param {Buffer | string} data
   * @param {"tts" | "images" | "temp"} [category="tts"]
   * @returns {Promise<string>} Full path to cached file
   */
  async put(hash, extension, data, category = 'tts') {
    if (this.readOnly) throw new Error('CacheManager is read-only');
    const filePath = this.resolvePath(hash, extension, category);
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.promises.writeFile(tmpPath, data);
    await fs.promises.rename(tmpPath, filePath);
    return filePath;
  }

  /**
   * Synchronously stores data in cache under the computed hash.
   * @param {string} hash
   * @param {string} extension
   * @param {Buffer | string} data
   * @param {"tts" | "images" | "temp"} [category="tts"]
   * @returns {string} Full path to cached file
   */
  putSync(hash, extension, data, category = 'tts') {
    if (this.readOnly) throw new Error('CacheManager is read-only');
    const filePath = this.resolvePath(hash, extension, category);
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, data);
    fs.renameSync(tmpPath, filePath);
    return filePath;
  }
}
