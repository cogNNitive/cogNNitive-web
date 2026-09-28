/**
 * scripts/lib/docs-facts.mjs
 *
 * Pure functions shared by the docs-derived-facts generators
 * (scripts/generate-docs-facts.mjs and, from Unit 3 onward, the skills-catalog
 * render). Everything here is a pure function of its inputs — no filesystem,
 * no git, no network — so it is unit-testable against fixture strings alone.
 *
 * Region contract (design D4): generated facts live inside HTML-comment
 * marker pairs already present in a hand-authored doc page:
 *
 *   <!-- generated:<name> (source: ...; run node scripts/generate-docs-facts.mjs) -->
 *   ...rendered body...
 *   <!-- /generated:<name> -->
 *
 * A missing marker is a hard failure (exit 2 at the CLI layer) — the region
 * is never appended to the end of the file.
 */

/**
 * Builds the tolerant open-marker matcher for a named region. Tolerant of
 * the exact "(source: ...)" annotation text so a future wording tweak to the
 * annotation does not itself count as drift; the annotation is never
 * rewritten by `replaceRegion` because it slices around the existing marker
 * text instead of reconstructing it.
 * @param {string} name
 * @returns {RegExp}
 */
function openMarkerPattern(name) {
  return new RegExp(`<!--\\s*generated:${name}\\b[^>]*-->`);
}

/**
 * @param {string} name
 * @returns {string}
 */
function closeMarker(name) {
  return `<!-- /generated:${name} -->`;
}

/**
 * Replaces the body of a marker-delimited region with `body`. The markers
 * themselves are left byte-identical; only the text between them changes.
 *
 * @param {string} content - Full file content.
 * @param {string} name - Region name (e.g. "mcp-tools").
 * @param {string} body - New region body (leading/trailing blank lines are
 *   normalized to exactly one surrounding newline on each side).
 * @returns {string} Updated file content.
 * @throws {Error} When the open or close marker is missing.
 */
export function replaceRegion(content, name, body) {
  const openRe = openMarkerPattern(name);
  const openMatch = openRe.exec(content);
  if (!openMatch) {
    throw new Error(`missing region marker: generated:${name}`);
  }

  const close = closeMarker(name);
  const bodyStart = openMatch.index + openMatch[0].length;
  const closeIndex = content.indexOf(close, bodyStart);
  if (closeIndex === -1) {
    throw new Error(`missing closing region marker: /generated:${name}`);
  }

  const before = content.slice(0, bodyStart);
  const after = content.slice(closeIndex);
  const trimmedBody = body.trim();
  return `${before}\n${trimmedBody}\n${after}`;
}

/**
 * Strips the rendered body out of every generated region, keeping the
 * marker pair itself, so `findHandTypedFacts` never flags a generator's own
 * output as a hand-typed literal (e.g. a rendered "**17** tools" line).
 * @param {string} content
 * @returns {string}
 */
function stripGeneratedRegions(content) {
  return content.replace(
    /<!--\s*generated:([\w-]+)\b[^>]*-->[\s\S]*?<!--\s*\/generated:\1\s*-->/g,
    (_full, name) => `<!-- generated:${name} --><!-- /generated:${name} -->`,
  );
}

/**
 * Collapses internal whitespace to single spaces and escapes pipes, so a
 * multi-line or pipe-containing description cannot break a Markdown table
 * row.
 * @param {string} text
 * @returns {string}
 */
function escapeTableCell(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\|/g, '\\|');
}

/**
 * Renders the `mcp-tools` region body: a bold tool count followed by a
 * `| Tool | Description |` table, in registry order (design D3/D4).
 * @param {Array<{ name: string, description: string }>} tools
 * @returns {string}
 */
export function renderMcpToolsRegion(tools) {
  const rows = tools.map(
    (tool) => `| \`${tool.name}\` | ${escapeTableCell(tool.description)} |`,
  );
  const lines = [`**${tools.length}** tools`, '', '| Tool | Description |', '|------|-------------|', ...rows];
  return lines.join('\n');
}

/**
 * Renders the `skills-catalog` region body: a bold skill count followed by a
 * `| Skill | Version | Description |` table, in `manifest/source.yaml`
 * order (design D1). There is no `Triggers` column — this catalog documents
 * what a skill is, not the router's dispatch table. Each skill name links to
 * its conventional doc page (`skills/<name>.md`), the same slug every
 * existing canonical-skill page already uses.
 * @param {Array<{ name: string, version: string, description: string }>} skills
 * @returns {string}
 */
export function renderSkillsCatalogRegion(skills) {
  const rows = skills.map(
    (skill) =>
      `| [\`${skill.name}\`](skills/${skill.name}.md) | \`${skill.version}\` | ${escapeTableCell(skill.description)} |`,
  );
  const lines = [
    `**${skills.length}** skills`,
    '',
    '| Skill | Version | Description |',
    '|-------|---------|-------------|',
    ...rows,
  ];
  return lines.join('\n');
}

/**
 * Compares the set of canonical-skill Page names declared in the iNNfo
 * model against the set of skill names declared in `manifest/source.yaml`
 * (design D1). The two sets MUST be equal: a skill with no Page would be
 * undiscoverable in the published catalog, and a Page with no matching skill
 * documents something that was never actually distributed.
 * @param {string[]} pageNames - Page ids under the model's canonical skills section.
 * @param {string[]} skillNames - `source.yaml` skill names.
 * @returns {{ ok: boolean, missingPages: string[], extraPages: string[] }}
 */
export function checkSkillPageSet(pageNames, skillNames) {
  const pageSet = new Set(pageNames);
  const skillSet = new Set(skillNames);
  const missingPages = skillNames.filter((name) => !pageSet.has(name));
  const extraPages = pageNames.filter((name) => !skillSet.has(name));
  return { ok: missingPages.length === 0 && extraPages.length === 0, missingPages, extraPages };
}

const NUMBER_WORDS =
  'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';

// Matches a hand-typed tool count anywhere it might have been reintroduced,
// e.g. "seven semantic tools" or "9 MCP tools" (design "Interfaces / Contracts").
const TOOL_COUNT_RE = new RegExp(`\\b(\\d+|${NUMBER_WORDS})\\s+(semantic\\s+|MCP\\s+)?tools\\b`, 'i');

// A registered skill name followed by a version literal on the same line,
// e.g. "nn-start (V_1-2-0)" — versions must come from manifest/source.yaml,
// never be hand-typed alongside the skill name (design "Interfaces / Contracts").
const VERSION_LITERAL_RE = /(?<!\w)V_\d+-\d+-\d+/;

/**
 * Scans a set of already-loaded files for hand-typed facts that must instead
 * be derived: a literal MCP tool count, or a registered skill name paired
 * with a literal version string on the same line. Pure — callers own file
 * discovery (git-visible walk in production, fixtures in tests) and pass in
 * `{ path, content }` pairs.
 *
 * @param {Array<{ path: string, content: string }>} files
 * @param {{ skillNames?: string[] }} [options] - `skillNames` enables the
 *   skill-version check (wired by Unit 3's skills-catalog callers); omitted
 *   or empty, only the tool-count check runs.
 * @returns {Array<{ path: string, line: number, rule: 'tool-count' | 'skill-version', excerpt: string }>}
 */
export function findHandTypedFacts(files, options = {}) {
  const skillNames = options.skillNames ?? [];
  const violations = [];

  for (const file of files) {
    const stripped = stripGeneratedRegions(file.content);
    const lines = stripped.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (TOOL_COUNT_RE.test(line)) {
        violations.push({ path: file.path, line: index + 1, rule: 'tool-count', excerpt: line.trim() });
      }

      if (VERSION_LITERAL_RE.test(line)) {
        const hasSkillName = skillNames.some((name) => line.includes(name));
        if (hasSkillName) {
          violations.push({ path: file.path, line: index + 1, rule: 'skill-version', excerpt: line.trim() });
        }
      }
    });
  }

  return violations;
}

/**
 * Deterministic output normalization shared by every docs-facts generator:
 * LF line endings, no trailing whitespace per line, exactly one trailing
 * newline. Matches `normalizeOutput` in scripts/manifest/generate-manifest.js
 * so all generated docs artifacts share one determinism contract.
 * @param {string} text
 * @returns {string}
 */
export function normalizeOutput(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}
