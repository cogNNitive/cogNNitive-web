const fs = require('fs');
const path = require('path');

const INDEX_SKIP_DIRS = new Set(['backups', 'archive', 'specs', '.spec-cache', 'node_modules', '.git']);

/**
 * List workspace models matching *_NN.md.
 * @param {string} projectDir
 * @returns {string[]}
 */
function listWorkspaceModels(projectDir) {
  const found = [];
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('.') || INDEX_SKIP_DIRS.has(name)) continue;
      if (entry.isDirectory()) {
        walk(path.join(dir, name), prefix + name + '/');
      } else if (entry.isFile() && name.endsWith('_NN.md')) {
        found.push(prefix + name);
      }
    }
  };
  walk(projectDir, './');
  return found.sort();
}

/**
 * Parse `* [label](target)` and `* [[target]]` link lines out of a workspace
 * index.md. Returns `{ type, label, target }` entries.
 * @param {string} content
 * @returns {Array<{ type: string, label: string | null, target: string }>}
 */
function parseIndexLinks(content) {
  const links = [];
  const re = /^\*\s*(?:\[([^\]]*)\]\(([^)]*)\)|\[\[([^\]]+)\]\])\s*$/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1] !== undefined) {
      links.push({ type: 'md', label: m[1], target: m[2] });
    } else {
      links.push({ type: 'wiki', label: null, target: m[3] });
    }
  }
  return links;
}

/**
 * Normalizes index target link path.
 * @param {string} projectDir
 * @param {string} target
 * @returns {{ key: string, resolved: string }}
 */
function normalizeIndexTarget(projectDir, target) {
  let t = String(target).trim();
  try {
    t = decodeURIComponent(t);
  } catch (err) {
    // keep the raw target when it contains malformed percent-escapes
  }
  t = t.replace(/\\/g, '/').replace(/^\.\//, '');
  return { key: t.toLowerCase(), resolved: path.resolve(projectDir, t) };
}

/**
 * Derives display label for an index entry from path.
 * @param {string} relPath
 * @returns {string}
 */
function deriveIndexLabel(relPath) {
  return path
    .basename(relPath)
    .replace(/_V_\d+-\d+-\d+_[A-Za-z0-9-]+_NN\.md$/, '')
    .replace(/_NN\.md$/, '')
    .replace(/_/g, ' ');
}

/**
 * Converts relPath to URI-encoded href.
 * @param {string} relPath
 * @returns {string}
 */
function indexHref(relPath) {
  return relPath.split('/').map((seg, i, arr) =>
    i === arr.length - 1 ? encodeURIComponent(seg) : seg
  ).join('/');
}

/**
 * Compares two 3-part version tuples [major, minor, patch].
 * @param {number[]} v1
 * @param {number[]} v2
 * @returns {number}
 */
function compareVersions(v1, v2) {
  for (let i = 0; i < 3; i++) {
    const diff = v1[i] - v2[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Parses 3-part version tuple from path string.
 * @param {string} relPath
 * @returns {number[]}
 */
function parseVersionFromPath(relPath) {
  const m = relPath.match(/_V_(\d+)-(\d+)-(\d+)_/i);
  if (m) {
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  }
  return [0, 0, 0];
}

/**
 * Strips version tag from link target for matching.
 * @param {string} target
 * @returns {string}
 */
function getVersionStrippedKey(target) {
  let t = String(target).trim();
  try {
    t = decodeURIComponent(t);
  } catch (e) {}
  t = t.replace(/\\/g, '/').toLowerCase();
  return t.replace(/_v_\d+-\d+-\d+_/, '_');
}

/**
 * Generates or refreshes the semantic index.md in the project root.
 * @param {string} projectDir
 * @returns {void}
 */
function writeWorkspaceIndex(projectDir) {
  const indexPath = path.join(projectDir, 'index.md');
  const existed = fs.existsSync(indexPath);

  const fresh = listWorkspaceModels(projectDir);

  let lines = [];
  if (existed) {
    try {
      lines = fs.readFileSync(indexPath, 'utf8').split(/\r?\n/);
    } catch (e) {}
  }

  const parsedLinks = [];
  const nonLinkLines = [];
  const linkRegex = /^\*\s*(?:\[([^\]]*)\]\(([^)]*)\)|\[\[([^\]]+)\]\])\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(linkRegex);
    if (!match) {
      nonLinkLines.push({ lineIndex: i, line });
      continue;
    }

    const label = match[1];
    const target = match[2] || match[3];
    const isWiki = match[3] !== undefined;

    if (!target.endsWith('.md')) {
      nonLinkLines.push({ lineIndex: i, line });
      continue;
    }

    const { key, resolved } = normalizeIndexTarget(projectDir, target);
    const strippedKey = getVersionStrippedKey(target);
    const version = parseVersionFromPath(target);
    const exists = fs.existsSync(resolved);

    parsedLinks.push({
      lineIndex: i,
      line,
      label,
      target,
      isWiki,
      key,
      strippedKey,
      version,
      resolved,
      exists,
    });
  }

  const freshMap = new Map();
  for (const m of fresh) {
    const { key, resolved } = normalizeIndexTarget(projectDir, m);
    const strippedKey = getVersionStrippedKey(m);
    const version = parseVersionFromPath(m);
    freshMap.set(key, { target: indexHref(m), strippedKey, version, resolved, isFresh: true });
  }

  const allCandidates = {};
  const droppedDangling = [];

  for (const pl of parsedLinks) {
    if (!pl.exists) {
      droppedDangling.push(pl.line);
      continue;
    }
    if (!allCandidates[pl.strippedKey]) allCandidates[pl.strippedKey] = [];
    allCandidates[pl.strippedKey].push({
      target: pl.target,
      version: pl.version,
      isFresh: false,
      existingLink: pl,
    });
  }

  for (const [key, fm] of freshMap.entries()) {
    if (!allCandidates[fm.strippedKey]) allCandidates[fm.strippedKey] = [];
    if (!allCandidates[fm.strippedKey].some((c) => c.target === fm.target)) {
      allCandidates[fm.strippedKey].push({
        target: fm.target,
        version: fm.version,
        isFresh: true,
      });
    }
  }

  const selectedLinks = [];
  let added = 0;
  let preserved = 0;

  for (const strippedKey in allCandidates) {
    const candidates = allCandidates[strippedKey];
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (compareVersions(candidates[i].version, best.version) > 0) {
        best = candidates[i];
      }
    }

    for (const c of candidates) {
      if (c !== best && c.existingLink) {
        droppedDangling.push(c.existingLink.line);
      }
    }

    if (best.existingLink) {
      selectedLinks.push({
        type: 'existing',
        lineIndex: best.existingLink.lineIndex,
        line: best.existingLink.line,
      });
      preserved++;
    } else {
      const label = deriveIndexLabel(best.target);
      selectedLinks.push({
        type: 'new',
        line: `* [${label}](${best.target})`,
      });
      added++;
    }
  }

  const finalLines = [];
  const maxOriginalLines = lines.length;
  const originalLineSlot = new Array(maxOriginalLines).fill(null);

  for (const nll of nonLinkLines) {
    originalLineSlot[nll.lineIndex] = nll.line;
  }

  for (const sl of selectedLinks) {
    if (sl.type === 'existing') {
      originalLineSlot[sl.lineIndex] = sl.line;
    }
  }

  for (let i = 0; i < maxOriginalLines; i++) {
    if (originalLineSlot[i] !== null) {
      finalLines.push(originalLineSlot[i]);
    }
  }

  let lastListItemIdx = -1;
  for (let i = 0; i < finalLines.length; i++) {
    if (finalLines[i].startsWith('*')) {
      lastListItemIdx = i;
    }
  }

  const newLinkLines = selectedLinks.filter((sl) => sl.type === 'new').map((sl) => sl.line);
  if (newLinkLines.length > 0) {
    if (lastListItemIdx !== -1) {
      finalLines.splice(lastListItemIdx + 1, 0, ...newLinkLines);
    } else {
      if (finalLines.length === 0) {
        finalLines.push('# NN index', '');
      }
      finalLines.push(...newLinkLines);
    }
  }

  let finalContent = finalLines.join('\n');
  if (!finalContent.endsWith('\n')) {
    finalContent += '\n';
  }
  fs.writeFileSync(indexPath, finalContent, 'utf8');

  if (existed) {
    console.log(
      `Workspace index.md regenerated using Markdown-links format (preserved ${preserved} existing entry(ies), dropped ${droppedDangling.length} dangling/duplicate, added ${added} new). ` +
        `Note that workspace index uses Markdown links, unlike the WikiLinks used internally in Level 3 models.`
    );
  } else {
    console.log('Workspace index.md created');
  }
}

module.exports = {
  INDEX_SKIP_DIRS,
  listWorkspaceModels,
  parseIndexLinks,
  normalizeIndexTarget,
  deriveIndexLabel,
  indexHref,
  compareVersions,
  parseVersionFromPath,
  getVersionStrippedKey,
  writeWorkspaceIndex,
};
