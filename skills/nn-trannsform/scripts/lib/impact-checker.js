const fs = require('fs');
const path = require('path');
const {
  readLineageSnapshot,
  projectLineage,
  createFsSourceResolver,
  validateCitations,
  parseCitation,
} = require('./innfo-core.generated.cjs');

/**
 * Audit all models in the workspace to verify that every `sources::` citation
 * resolves to an existing normalized source file AND an existing unit anchor.
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
  };

  for (const diag of diagnostics) {
    const rawVal = diag.site.value;
    const parsed = parseCitation(rawVal);
    const reason = CODE_TO_REASON[diag.code] || 'missing_heading';
    const sourceFile = parsed ? parsed.filePath.replace(/^sources\/nn\//, '') : rawVal;

    let headingSlug = '';
    if (parsed && parsed.unit) {
      if (parsed.unit.kind === 'header') {
        headingSlug = parsed.unit.slug;
      } else if (parsed.unit.kind === 'row') {
        headingSlug = parsed.unit.id;
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
 * Check impact on models specifically for a set of recently modified/archived sources.
 *
 * @param {Array<{ baseName: string, displayOutPath: string, snapshot?: { version: string, archivePath: string } }>} changedSources
 * @param {string} projectDir
 * @returns {Array<{ source: string, affectedModels: Array<{ modelFile: string, element?: string, citation: string, status: string }> }>}
 */
function checkScanImpact(changedSources, projectDir) {
  if (!changedSources || changedSources.length === 0) return [];

  const audit = auditModelCitations(projectDir);
  const results = [];

  for (const changed of changedSources) {
    const matchName = changed.baseName.toLowerCase();
    const matchPath = changed.displayOutPath.toLowerCase();

    const affected = audit.driftedCitations.filter((dc) => {
      const dcSource = dc.sourceFile.toLowerCase();
      return dcSource === matchPath || dcSource === `${matchName}.md` || dcSource.endsWith(`/${matchName}.md`) || dcSource === matchName;
    });

    if (affected.length > 0) {
      results.push({
        source: changed.displayOutPath,
        affectedModels: affected.map((a) => ({
          modelFile: a.modelFile,
          element: a.elementName,
          citation: a.citation,
          status: a.reason,
          suggestions: a.suggestions,
        })),
      });
    }
  }

  return results;
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
 * @param {string} date ISO date string used for the filename/header (e.g. "2026-09-12").
 * @returns {string}
 */
function buildImpactReport(audit, date) {
  const d = date || new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push('---');
  lines.push('type: report');
  lines.push('title: Dynamic Sources Impact Audit Report');
  lines.push(`date: ${d}`);
  lines.push('generated_by: auditModelCitations');
  lines.push('---');
  lines.push('');
  lines.push('# Dynamic Sources Impact Audit Report');
  lines.push('');
  lines.push(`Generated on **${d}**.`);
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
      lines.push(`| Source file | \`sources/nn/${dc.sourceFile}\` |`);
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
 * Write a structured Markdown impact audit report to
 * `export/Impact_Audit_<date>_report.md` inside the workspace.
 *
 * @param {string} projectDir
 * @param {ReturnType<typeof auditModelCitations>} audit
 * @param {string} [date] ISO date string used for the filename (defaults to today).
 * @returns {{ reportPath: string, content: string }}
 */
function writeImpactReport(projectDir, audit, date) {
  const d = date || new Date().toISOString().slice(0, 10);
  const exportDir = path.join(projectDir, 'export');
  fs.mkdirSync(exportDir, { recursive: true });
  const reportPath = path.join(exportDir, `Impact_Audit_${d}_report.md`);
  const content = buildImpactReport(audit, d);
  fs.writeFileSync(reportPath, content, 'utf8');
  return { reportPath: reportPath.replace(/\\/g, '/'), content };
}

/**
 * Regular expression matching timestamped normalized source files
 * e.g. "quarterly_forecast_20260912-185536.md"
 */
const TIMESTAMP_REGEX = /^(.+)_(\d{8}-\d{6})(?:\.md)?$/i;

/**
 * Groups normalized Markdown source files under sources/nn/ into time-series families.
 *
 * @param {string} projectDir
 * @returns {Record<string, Array<{ relPath: string, fullPath: string, fileName: string, timestamp: string }>>}
 */
function groupSourceFamilies(projectDir) {
  const nnDir = path.join(projectDir, 'sources', 'nn');
  /** @type {Record<string, Array<{ relPath: string, fullPath: string, fileName: string, timestamp: string }>>} */
  const families = {};
  if (!fs.existsSync(nnDir)) return families;

  const walk = (d, rel) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      if (ent.name.startsWith('.')) continue;
      const abs = path.join(d, ent.name);
      const relPath = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(abs, relPath);
      else if (ent.isFile() && ent.name.endsWith('.md')) {
        const base = ent.name;
        const m = base.match(TIMESTAMP_REGEX);
        if (m) {
          const stem = m[1];
          const timestamp = m[2];
          if (!families[stem]) {
            families[stem] = [];
          }
          families[stem].push({
            relPath: relPath.replace(/\\/g, '/'),
            fullPath: abs.replace(/\\/g, '/'),
            fileName: base,
            timestamp,
          });
        }
      }
    }
  };
  walk(nnDir, '');

  for (const stem of Object.keys(families)) {
    families[stem].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  return families;
}

/**
 * Detects models that cite an earlier snapshot when a newer timestamped snapshot
 * in the same source family is available.
 *
 * @param {string} projectDir
 * @returns {Array<{
 *   modelFile: string,
 *   elementName?: string,
 *   citation: string,
 *   family: string,
 *   currentSnapshot: string,
 *   latestSnapshot: string,
 *   headingSlug?: string,
 *   headingPreserved: boolean,
 *   advisory: string
 * }>}
 */
function detectSourceFamilyEvolution(projectDir) {
  const families = groupSourceFamilies(projectDir);
  const evolutions = [];

  if (Object.keys(families).length === 0) {
    return evolutions;
  }

  const snapshot = readLineageSnapshot(projectDir);
  const projection = projectLineage(snapshot);
  const resolver = createFsSourceResolver(projectDir);

  for (const k of projection.knowledge) {
    for (const cit of k.citations) {
      const parsed = parseCitation(cit.value);
      if (!parsed) continue;

      const baseFile = path.basename(parsed.filePath);
      const match = baseFile.match(TIMESTAMP_REGEX);
      if (!match) continue;

      const stem = match[1];
      const citedTs = match[2];
      const snapshots = families[stem];
      if (!snapshots || snapshots.length <= 1) continue;

      const latest = snapshots[snapshots.length - 1];
      if (latest.timestamp > citedTs) {
        let headingPreserved = true;
        let slugPart = '';
        if (parsed.unit && parsed.unit.kind === 'header') {
          slugPart = parsed.unit.slug;
          const targetPath = latest.relPath.startsWith('sources/nn/') ? latest.relPath : `sources/nn/${latest.relPath}`;
          const res = resolver(targetPath);
          if (res && res.exists && res.headings) {
            headingPreserved = res.headings.includes(slugPart);
          } else {
            headingPreserved = false;
          }
        }

        evolutions.push({
          modelFile: cit.referringPath,
          elementName: cit.element,
          citation: cit.value,
          family: stem,
          currentSnapshot: baseFile,
          latestSnapshot: latest.fileName,
          headingSlug: slugPart || undefined,
          headingPreserved,
          advisory: `Model cites previous snapshot "${baseFile}". Newer snapshot "${latest.fileName}" is available${
            slugPart ? (headingPreserved ? ' (heading preserved)' : ' (heading missing in newer snapshot)') : ''
          }.`,
        });
      }
    }
  }

  return evolutions;
}

module.exports = {
  TIMESTAMP_REGEX,
  auditModelCitations,
  checkScanImpact,
  findClosestSlugs,
  buildImpactReport,
  writeImpactReport,
  groupSourceFamilies,
  detectSourceFamilyEvolution,
};
