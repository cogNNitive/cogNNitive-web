const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  readLineageSnapshot,
  projectLineage,
  extractFileCitations,
  createFsSourceResolver,
  validateCitations,
  parseCitation,
  parseName,
  compareMembers,
  familyOf,
  formatMemberName,
  isSidecarName,
  rawPathOfSidecar,
  sidecarPathOf,
  parseSidecarFrontmatter,
  writeOnce,
} = require('./innfo-core.generated.cjs');

const toPosix = (p) => p.replace(/\\/g, '/');

/**
 * Every citation site of the projection: kNNowledge bodies, artifact
 * frontmatter, console meta, and the sidecars/sources that declare upstream.
 *
 * @param {Array<{ path: string, content: string }>} snapshot
 * @param {ReturnType<typeof projectLineage>} projection
 */
function collectCitationSites(snapshot, projection) {
  const sites = [];
  for (const k of projection.knowledge) sites.push(...k.citations);
  for (const a of projection.artifacts) sites.push(...a.citations);
  for (const s of extractFileCitations(snapshot)) {
    if (!sites.some((e) => e.referringPath === s.referringPath && e.value === s.value && e.element === s.element && e.field === s.field)) {
      sites.push(s);
    }
  }
  return sites;
}

/**
 * The hash guard: workspace-relative files whose co-located sidecar records a
 * sha256 that no longer matches the raw bytes. A cited sidecar is checked
 * against its subject.
 *
 * @param {string} projectDir
 * @param {Iterable<string>} relPaths
 * @returns {string[]}
 */
function findStaleSources(projectDir, relPaths) {
  const stale = [];
  const seen = new Set();
  for (const rel of relPaths) {
    const subject = isSidecarName(rel) ? rawPathOfSidecar(rel) : rel;
    if (!subject || seen.has(subject)) continue;
    seen.add(subject);
    const sidecarAbs = path.join(projectDir, sidecarPathOf(subject));
    const rawAbs = path.join(projectDir, subject);
    if (!fs.existsSync(sidecarAbs) || !fs.existsSync(rawAbs)) continue;
    const recorded = parseSidecarFrontmatter(fs.readFileSync(sidecarAbs, 'utf8'));
    const expected = recorded && recorded.sha256 ? String(recorded.sha256).toLowerCase() : '';
    const actual = crypto.createHash('sha256').update(fs.readFileSync(rawAbs)).digest('hex');
    if (expected && expected !== actual) stale.push(subject);
  }
  return stale;
}

/**
 * Audit all models in the workspace to verify that every `sources::` citation
 * resolves to an existing source file AND an existing unit anchor. Anchor and
 * row checks are core's (`validateCitations`); this module only maps them to
 * reasons and adds the hash guard over the cited sources.
 *
 * @param {string} projectDir
 * @returns {{
 *   errors: string[],
 *   warnings: string[],
 *   totalCitations: number,
 *   validCitations: number,
 *   driftedCitations: Array<{
 *     modelFile: string,
 *     elementName?: string,
 *     citation: string,
 *     sourceFile: string,
 *     headingSlug: string,
 *     reason: string,
 *     suggestions?: string[]
 *   }>
 * }}
 */
function auditModelCitations(projectDir) {
  const errors = [];
  const warnings = [];
  const driftedCitations = [];

  const snapshot = readLineageSnapshot(projectDir);
  const projection = projectLineage(snapshot);

  const sites = [];
  for (const k of projection.knowledge) {
    for (const cit of k.citations) {
      sites.push(cit);
    }
  }

  const totalCitations = sites.length;
  const resolver = createFsSourceResolver(projectDir);
  const diagnostics = validateCitations(sites, resolver);

  const CODE_TO_REASON = {
    KU_DANGLING_FILE: 'missing_file',
    KU_UNKNOWN_SLUG: 'missing_heading',
    KU_UNKNOWN_ROW: 'missing_row',
    KU_UNKNOWN_COLUMN: 'missing_column',
    KU_UNKNOWN_POINTER: 'missing_pointer',
    KU_INVALID_JSON: 'invalid_json',
  };

  for (const diag of diagnostics) {
    const rawVal = diag.site.value;
    const parsed = parseCitation(rawVal);
    const reason = CODE_TO_REASON[diag.code] || 'missing_heading';
    const sourceFile = parsed ? parsed.filePath : rawVal;

    let headingSlug = '';
    if (parsed && parsed.unit) {
      if (parsed.unit.kind === 'header') {
        headingSlug = parsed.unit.slug;
      } else if (parsed.unit.kind === 'row') {
        headingSlug = parsed.unit.id;
      } else if (parsed.unit.kind === 'pointer') {
        headingSlug = parsed.unit.pointer;
      }
    } else if (parsed && parsed.slug) {
      headingSlug = parsed.slug;
    } else if (rawVal.includes('#')) {
      headingSlug = rawVal.split('#')[1].trim();
    }

    let suggestions = diag.suggestions || [];
    if (suggestions.length === 0 && headingSlug && reason === 'missing_heading') {
      const res = resolver(parsed ? parsed.filePath : rawVal);
      if (res && res.exists && res.headings) {
        suggestions = findClosestSlugs(headingSlug, res.headings);
      }
    }

    const msg = `${diag.site.referringPath}${diag.site.element ? ` (${diag.site.element})` : ''}: sources:: "${rawVal}" failed validation: ${diag.message}`;
    errors.push(msg);

    driftedCitations.push({
      modelFile: diag.site.referringPath,
      elementName: diag.site.element,
      citation: rawVal,
      sourceFile,
      headingSlug,
      reason,
      suggestions,
    });
  }

  const cited = new Set();
  for (const site of sites) {
    const parsed = parseCitation(site.value);
    if (parsed) cited.add(toPosix(parsed.filePath));
  }
  for (const stale of findStaleSources(projectDir, cited)) {
    warnings.push(`Cited source "${stale}" changed since it was cognitivized (hash mismatch with its sidecar sha256). Run \`--cognitivize\` on it before trusting this audit.`);
  }

  const validCitations = totalCitations - driftedCitations.length;

  return {
    errors,
    warnings,
    totalCitations,
    validCitations,
    driftedCitations,
  };
}

/**
 * Find closest matching slugs based on substring or token overlap
 */
function findClosestSlugs(targetSlug, availableSlugs) {
  const targetTokens = new Set(targetSlug.split('-').filter(Boolean));
  const scored = availableSlugs.map((slug) => {
    const tokens = slug.split('-').filter(Boolean);
    let overlap = 0;
    for (const t of tokens) {
      if (targetTokens.has(t)) overlap++;
    }
    return { slug, score: overlap / Math.max(tokens.length, targetTokens.size) };
  });

  return scored
    .filter((s) => s.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.slug);
}

/**
 * Build a recommended remediation directive for a drifted citation based on
 * the reason it was flagged.
 *
 * @param {string} reason
 * @param {string[]} [suggestions]
 * @returns {string}
 */
function remediationFor(reason, suggestions) {
  if (reason === 'missing_file') {
    return 'Restore the missing source file, or update the citation to point to an existing source.';
  }
  if (reason === 'missing_heading' && suggestions && suggestions.length > 0) {
    return `Update the citation to one of the suggested headings: ${suggestions.map((s) => `#${s}`).join(', ')} — or restore the missing heading in the source.`;
  }
  if (reason === 'missing_heading') {
    return 'Update the citation to an existing heading, or restore the missing heading in the source.';
  }
  return 'Review the source and update the model citation accordingly.';
}

/**
 * Render a structured Markdown audit report from an impact audit result.
 *
 * @param {ReturnType<typeof auditModelCitations>} audit
 * @returns {string}
 */
function buildImpactReport(audit) {
  const lines = [];
  // No date: the write-once name carries the UTC suffix, and identical findings must be byte-identical.
  const upstream = [...new Set(audit.driftedCitations.map((dc) => dc.sourceFile).filter(Boolean))].sort();
  lines.push('---');
  lines.push('title: Dynamic Sources Impact Audit Report');
  lines.push('generated_by: auditModelCitations');
  if (upstream.length > 0) {
    lines.push('sources:');
    for (const source of upstream) lines.push(`  - ${source}`);
  }
  lines.push('---');
  lines.push('');
  lines.push('# Dynamic Sources Impact Audit Report');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total citations audited: ${audit.totalCitations}`);
  lines.push(`- Valid citations: ${audit.validCitations}`);
  lines.push(`- Drift issues found: ${audit.errors.length}`);

  if (audit.driftedCitations.length > 0) {
    lines.push('');
    lines.push('## Drifted Citations');
    lines.push('');
    for (const dc of audit.driftedCitations) {
      lines.push(`### ${dc.modelFile}`);
      lines.push('');
      lines.push(`**Element:** ${dc.elementName || '(untitled element)'}`);
      lines.push('');
      lines.push('| Field | Value |');
      lines.push('|-------|-------|');
      lines.push(`| Citation | \`${dc.citation}\` |`);
      lines.push(`| Source file | \`${dc.sourceFile}\` |`);
      lines.push(`| Heading slug | \`${dc.headingSlug || '(whole file)'}\` |`);
      lines.push(`| Status | \`${dc.reason}\` |`);
      if (dc.suggestions && dc.suggestions.length > 0) {
        lines.push(`| Suggested headings | ${dc.suggestions.map((s) => `\`#${s}\``).join(', ')} |`);
      }
      lines.push(`| Recommended remediation | ${remediationFor(dc.reason, dc.suggestions)} |`);
      lines.push('');
    }
  }

  if (audit.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const w of audit.warnings) {
      lines.push(`- ${w}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Write the impact audit report as a write-once member of the family
 * `artifacts/Impact_Audit_report_<UTC suffix>.md`. Identical findings
 * deduplicate against the latest report; changed findings add a member and
 * leave the earlier report untouched. No input hash guard: the report exists
 * to describe stale and drifted sources, so a stale input must not block it.
 *
 * @param {string} projectDir
 * @param {ReturnType<typeof auditModelCitations>} audit
 * @returns {Promise<{ reportPath: string, content: string, status: 'written' | 'deduplicated' }>}
 */
async function writeImpactReport(projectDir, audit) {
  const content = buildImpactReport(audit);
  const result = await writeOnce(projectDir, { dir: 'artifacts', key: 'Impact_Audit_report', ext: 'md' }, content);
  return { reportPath: toPosix(path.join(projectDir, result.path)), content, status: result.status };
}

/** Canonical (unsuffixed) name of a family: `<dir>/<key>.<ext>`. */
function familyName(family) {
  const name = formatMemberName(family.key, family.ext);
  return family.dir ? `${family.dir}/${name}` : name;
}

/**
 * Groups the files of the domaiNN into write-once families `(dir, key, ext)`:
 * every plain file, plus the subject of every sidecar (binaries are not read
 * as text but are represented by their sidecar). Members are ordered with the
 * unsuffixed member first, then by stamp.
 *
 * @param {string} projectDir
 * @param {{ snapshot?: Array<{ path: string }>, projection?: ReturnType<typeof projectLineage> }} [preloaded]
 * @returns {Record<string, Array<{ relPath: string, fullPath: string, fileName: string, timestamp: string }>>}
 */
function groupSourceFamilies(projectDir, preloaded = {}) {
  const snapshot = preloaded.snapshot || readLineageSnapshot(projectDir);
  const projection = preloaded.projection || projectLineage(snapshot);

  const paths = new Set();
  for (const file of snapshot) {
    const parsed = parseName(path.posix.basename(toPosix(file.path)));
    if (parsed.kind === 'file') paths.add(toPosix(file.path));
  }
  for (const source of projection.sources) paths.add(source.raw_filename);

  /** @type {Record<string, Array<{ relPath: string, fullPath: string, fileName: string, timestamp: string }>>} */
  const families = {};
  for (const relPath of paths) {
    const family = familyOf(relPath);
    if (!family) continue;
    const parsed = parseName(path.posix.basename(relPath));
    const name = familyName(family);
    (families[name] = families[name] || []).push({
      relPath,
      fullPath: toPosix(path.join(projectDir, relPath)),
      fileName: path.posix.basename(relPath),
      timestamp: parsed.kind === 'file' && parsed.stamp ? parsed.stamp.stamp : '',
    });
  }

  for (const members of Object.values(families)) {
    members.sort((a, b) => compareMembers(a.fileName, b.fileName) || (a.fileName < b.fileName ? -1 : 1));
  }
  return families;
}

/**
 * Detects citations that target an older member of a write-once family when a
 * newer member exists. Whether the cited unit still resolves in the latest
 * member is decided by core: the same citation is re-validated against the
 * latest member's path. Read-only: no family member is ever changed.
 *
 * @param {string} projectDir
 * @returns {Array<{
 *   modelFile: string,
 *   elementName?: string,
 *   citation: string,
 *   family: string,
 *   currentSnapshot: string,
 *   latestSnapshot: string,
 *   latestPath: string,
 *   headingSlug?: string,
 *   headingPreserved: boolean,
 *   diagnostics: string[],
 *   latestStale: boolean,
 *   advisory: string
 * }>}
 */
function detectSourceFamilyEvolution(projectDir) {
  const snapshot = readLineageSnapshot(projectDir);
  const projection = projectLineage(snapshot);
  const families = groupSourceFamilies(projectDir, { snapshot, projection });
  const evolutions = [];

  if (Object.values(families).every((members) => members.length <= 1)) {
    return evolutions;
  }

  const byPath = new Map();
  for (const [name, members] of Object.entries(families)) {
    for (const m of members) byPath.set(m.relPath, { name, members });
  }

  const resolver = createFsSourceResolver(projectDir);
  const sites = collectCitationSites(snapshot, projection);

  for (const site of sites) {
    const parsed = parseCitation(site.value);
    if (!parsed) continue;

    const citedPath = toPosix(parsed.filePath);
    const viaSidecar = isSidecarName(citedPath);
    const subject = viaSidecar ? rawPathOfSidecar(citedPath) : citedPath;
    const entry = subject ? byPath.get(subject) : undefined;
    if (!entry || entry.members.length < 2) continue;

    const citedName = path.posix.basename(subject);
    const latest = entry.members[entry.members.length - 1];
    if (compareMembers(latest.fileName, citedName) <= 0) continue;

    const latestPath = viaSidecar ? sidecarPathOf(latest.relPath) : latest.relPath;
    let diagnostics = [];
    if (parsed.unit && site.value.startsWith(parsed.filePath)) {
      const rewritten = `${latestPath}${site.value.slice(parsed.filePath.length)}`;
      diagnostics = validateCitations([{ ...site, value: rewritten }], resolver).map((d) => d.message);
    }
    const headingPreserved = diagnostics.length === 0;
    const latestStale = findStaleSources(projectDir, [latest.relPath]).length > 0;

    let slugPart = '';
    if (parsed.unit && parsed.unit.kind === 'header') slugPart = parsed.unit.slug;

    evolutions.push({
      modelFile: site.referringPath,
      elementName: site.element,
      citation: site.value,
      family: entry.name,
      currentSnapshot: citedName,
      latestSnapshot: latest.fileName,
      latestPath,
      headingSlug: slugPart || undefined,
      headingPreserved,
      diagnostics,
      latestStale,
      advisory:
        `Citation targets "${citedName}". Newer member "${latest.fileName}" is available` +
        (parsed.unit ? (headingPreserved ? ' (cited unit still resolves)' : ' (cited unit does not resolve in the latest member)') : '') +
        (latestStale ? '; its sidecar hash is stale, cognitivize it again before trusting this check' : '') +
        '.',
    });
  }

  return evolutions;
}

/**
 * Impact of newer family members on the citations that still target older ones.
 * Superseded citations are listed; those whose cited unit no longer resolves in
 * the latest member are flagged `unresolved_in_latest` (a warning).
 *
 * @param {string} projectDir
 * @param {{ families?: string[] }} [options] Restrict to these family names (`<dir>/<key>.<ext>`).
 * @returns {Array<{ source: string, latest: string, affectedModels: Array<{ modelFile: string, element?: string, citation: string, status: 'superseded' | 'unresolved_in_latest', message: string }> }>}
 */
function checkScanImpact(projectDir, options = {}) {
  const wanted = options.families ? new Set(options.families) : null;
  const byFamily = new Map();

  for (const evo of detectSourceFamilyEvolution(projectDir)) {
    if (wanted && !wanted.has(evo.family)) continue;
    if (!byFamily.has(evo.family)) byFamily.set(evo.family, { source: evo.family, latest: evo.latestPath, affectedModels: [] });
    byFamily.get(evo.family).affectedModels.push({
      modelFile: evo.modelFile,
      element: evo.elementName,
      citation: evo.citation,
      status: evo.headingPreserved ? 'superseded' : 'unresolved_in_latest',
      message: evo.advisory,
    });
  }

  return [...byFamily.values()].sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0));
}

module.exports = {
  auditModelCitations,
  checkScanImpact,
  findClosestSlugs,
  buildImpactReport,
  writeImpactReport,
  groupSourceFamilies,
  detectSourceFamilyEvolution,
  collectCitationSites,
  findStaleSources,
};
