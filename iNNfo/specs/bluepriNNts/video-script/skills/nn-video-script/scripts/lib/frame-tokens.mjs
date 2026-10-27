/**
 * nn-video-script/scripts/lib/frame-tokens.mjs
 *
 * Reads a frame design-token document (the HyperFrames frame layer: palette +
 * typography) and reduces it to the handful of tokens the emitter can apply to
 * overlays. The frame is truth for color and type, never for layout — overlay
 * geometry stays the engine's decision.
 *
 * A frame is named by the cascade (`frame:: <name>`) and located as
 * `frames/<name>.md` by the shared nearest-folder walker (design D18); this
 * module only reads and parses the file it is handed.
 *
 * Only the frontmatter is read. The parser is a deliberately small YAML subset
 * (`section:` / `  key: value` / `  key: { k: v, ... }`) so the skill stays
 * dependency-free when installed standalone in a user workspace.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';

const FENCE = /^---\s*$/;
const unquote = (s) => String(s).trim().replace(/^["']|["']$/g, '').trim();

/** Split `k: v, k2: "v2"` into a flat object. */
function parseInlineMap(body) {
  const out = {};
  for (const part of String(body).split(',')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = unquote(value);
  }
  return out;
}

/**
 * Parse a `frame.md` document into design tokens. Returns null when the document
 * carries no frontmatter or no colors/typography. Sections other than
 * colors/typography/radii are ignored.
 * @param {string} text
 * @returns {{ name?: string, colors: Record<string,string>, typography: Record<string, Record<string,string>>, radii: Record<string,string> } | null}
 */
export function parseFrameTokens(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  if (!FENCE.test(lines[0] || '')) return null;
  const end = lines.findIndex((l, i) => i > 0 && FENCE.test(l));
  if (end === -1) return null;

  const tokens = { colors: {}, typography: {}, radii: {} };
  const SECTIONS = new Set(['colors', 'typography', 'radii']);
  let section = null;
  let role = null;

  for (const raw of lines.slice(1, end)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indented = /^\s+/.test(raw);
    const line = raw.trim();

    if (!indented) {
      section = null;
      role = null;
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key === 'name' && value) tokens.name = unquote(value);
      else if (SECTIONS.has(key) && !value) section = key;
      continue;
    }

    if (!section) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();

    if (section === 'typography') {
      if (value.startsWith('{')) {
        tokens.typography[key] = parseInlineMap(value.replace(/^\{|\}$/g, ''));
        role = null;
      } else if (!value) {
        role = key;
        tokens.typography[role] = {};
      } else if (role) {
        tokens.typography[role][key] = unquote(value);
      }
      continue;
    }

    if (value) tokens[section][key] = unquote(value);
  }

  if (!Object.keys(tokens.colors).length && !Object.keys(tokens.typography).length) return null;
  return tokens;
}

/**
 * Reads and parses one frame document. A path that does not exist yields
 * `tokens: null`; callers locate the file first (via the walker), so a missing
 * path is a bug, never a silent fallback.
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
