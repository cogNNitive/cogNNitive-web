/**
 * nn-conntent/scripts/lib/frame-tokens.mjs
 *
 * Reads a HyperFrames frame design-token document (`FRAME.md` — palette +
 * typography + spacing + components) and reduces it to the tokens the emitter can
 * apply to overlays and the thumbnail renderer. The frame is truth for color and
 * type; overlay geometry stays the engine's decision (design D18, D-K3).
 *
 * The frontmatter is parsed by nn-core's YAML parser (via the shared mirror), the
 * same parser every other document uses, so nested `components:` maps survive and
 * no third divergent parser exists (verification G11).
 *
 * In Slice 1b the frame is still a single `<name>.md` file (`library/frames/<name>.md`
 * under the new layout); the folder form (`FRAME.md` + `caption-skin.html`) lands in
 * the Frame slice. This module only reads and parses the file it is handed.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from './nn-core.generated.cjs';

/** Extract the YAML frontmatter block of a document. */
const FENCE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:$|\r?\n)/;

/**
 * Parse a `frame.md` document into design tokens. Returns null when the document
 * carries no frontmatter or no colors/typography. Sections other than
 * colors/typography/radii are ignored.
 * @param {string} text
 * @returns {{ name?: string, colors: Record<string,string>, typography: Record<string, Record<string,string>>, radii: Record<string,string> } | null}
 */
export function parseFrameTokens(text) {
  const m = String(text ?? '').match(FENCE);
  if (!m) return null;
  const fm = parseYaml(m[1]);
  if (!fm || typeof fm !== 'object') return null;

  const tokens = { colors: {}, typography: {}, radii: {} };
  if (typeof fm.name === 'string' && fm.name) tokens.name = fm.name;
  if (fm.colors && typeof fm.colors === 'object') {
    for (const [k, v] of Object.entries(fm.colors)) {
      if (typeof v === 'string') tokens.colors[k] = v;
    }
  }
  if (fm.typography && typeof fm.typography === 'object') {
    tokens.typography = Object.fromEntries(
      Object.entries(fm.typography).filter(([, v]) => v && typeof v === 'object'),
    );
  }
  if (fm.radii && typeof fm.radii === 'object') {
    for (const [k, v] of Object.entries(fm.radii)) {
      if (typeof v === 'string' || typeof v === 'number') tokens.radii[k] = String(v);
    }
  }

  if (!Object.keys(tokens.colors).length && !Object.keys(tokens.typography).length) return null;
  return tokens;
}

/**
 * Reads and parses one frame document. A path that does not exist yields
 * `tokens: null`; callers locate the file first, so a missing path is a bug,
 * never a silent fallback.
 * @param {string} filePath
 * @returns {{ path: string, tokens: object | null }}
 */
export function loadFrame(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { path: filePath, tokens: null };
  return { path: filePath, tokens: parseFrameTokens(fs.readFileSync(filePath, 'utf8')) };
}

/**
 * Flatten frame tokens into the CSS declarations an overlay may inherit: the
 * brand typeface and text color, plus the accent for rules/highlights. Layout and
 * legibility surfaces (card fills) stay the emitter's call.
 * `fontCss` is empty when the series declares no frame — the emitter then keeps
 * its own defaults (never an implicit serif).
 * @param {object | null | undefined} tokens
 * @returns {{ fontCss: string, textColor: string | null, accent: string | null, fontFamily: string | null }}
 */
export function frameCss(tokens) {
  const colors = tokens?.colors || {};
  const typography = tokens?.typography || {};
  const body = typography.body || typography.base || {};
  const fontFamily = body.fontFamily || tokens?.fontFamily || null;
  const accent = colors.primary || colors.accent || null;
  const textColor = colors.text || colors.foreground || null;
  const fontCss = fontFamily ? `font-family:'${String(fontFamily).replace(/'/g, "\\'")}',sans-serif` : '';
  return { fontCss, textColor, accent, fontFamily };
}

/**
 * Parses the full FRAME.md frontmatter (every key, preserved), for the frame folder
 * loader that must keep `spacing`, `components` and any DESIGN.md extra keys.
 * Returns null when there is no frontmatter.
 * @param {string} text
 * @returns {object | null}
 */
export function parseFrameFrontmatter(text) {
  const m = String(text ?? '').match(FENCE);
  if (!m) return null;
  const fm = parseYaml(m[1]);
  return fm && typeof fm === 'object' ? fm : null;
}

/**
 * Loads a frame **folder** (`library/frames/<name>/`): the required `FRAME.md`, an
 * optional `caption-skin.html` and an optional `fonts/` directory. The frontmatter is
 * parsed by nn-core's YAML parser, so nested `components:` maps survive (verification
 * G11). (capability conntent-frame "A Frame Is A Folder With FRAME.md".)
 * @param {{ frameDir: string }} input
 * @returns {{ frameDir: string, FRAME: string|null, name: string|null, frontmatter: object|null, tokens: object|null, skin: string|null, fonts: string[] }}
 */
export function loadFrameFolder({ frameDir }) {
  const FRAME_PATH = path.join(frameDir, 'FRAME.md');
  let FRAME = null;
  try {
    FRAME = fs.readFileSync(FRAME_PATH, 'utf8');
  } catch {
    FRAME = null;
  }
  const frontmatter = FRAME ? parseFrameFrontmatter(FRAME) : null;
  const tokens = frontmatter ? { ...frontmatter } : null;
  let skin = null;
  try {
    skin = fs.readFileSync(path.join(frameDir, 'caption-skin.html'), 'utf8');
  } catch {
    skin = null;
  }
  let fonts = [];
  try {
    fonts = fs.readdirSync(path.join(frameDir, 'fonts')).filter((f) => f !== '.DS_Store').sort();
  } catch {
    fonts = [];
  }
  return {
    frameDir,
    FRAME,
    name: frontmatter?.name ?? null,
    frontmatter,
    tokens,
    skin,
    fonts,
  };
}

/**
 * Emits a resolved frame into the HyperFrames project: copies `FRAME.md` unchanged to
 * `hyperframes/frame.md`, the optional `caption-skin.html` to `hyperframes/caption-skin.html`,
 * and the `fonts/` files to `hyperframes/fonts/`. (capability conntent-frame "Frame Is
 * Emitted As frame.md In The HyperFrames Project".)
 * @param {{ frameDir: string, projectDir: string }} input
 */
export function emitHyperframesFrame({ frameDir, projectDir }) {
  const out = path.basename(projectDir) === 'hyperframes' ? projectDir : path.join(projectDir, 'hyperframes');
  fs.mkdirSync(out, { recursive: true });
  const src = path.join(frameDir, 'FRAME.md');
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, 'frame.md'));
  const skin = path.join(frameDir, 'caption-skin.html');
  if (fs.existsSync(skin)) fs.copyFileSync(skin, path.join(out, 'caption-skin.html'));
  const fonts = path.join(frameDir, 'fonts');
  if (fs.existsSync(fonts)) {
    const outFonts = path.join(out, 'fonts');
    fs.mkdirSync(outFonts, { recursive: true });
    for (const f of fs.readdirSync(fonts)) {
      const p = path.join(fonts, f);
      if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(outFonts, f));
    }
  }
}