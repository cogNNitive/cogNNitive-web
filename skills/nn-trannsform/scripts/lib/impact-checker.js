const fs = require('fs');
const path = require('path');
const modelLib = require('./provenance-model');
const { extractHeadingSlugs, slugifyUnitHeading } = require('../markdown-utils');

/**
 * Audit all models in the workspace to verify that every `sources::` citation
 * resolves to an existing normalized source file AND an existing heading slug.
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
  let totalCitations = 0;
  let validCitations = 0;

  const nnDir = path.join(projectDir, 'sources', 'nn');
  const modelsDir = path.join(projectDir, 'models');

  if (!fs.existsSync(modelsDir)) {
    return { errors, warnings, totalCitations, validCitations, driftedCitations };
  }

  const modelFiles = modelLib.walkFiles(modelsDir, (n) => n.endsWith('_NN.md'));

  // Cache normalized headings per source file
  const headingCache = new Map();

  function getHeadingsForSource(relSourcePath) {
    if (headingCache.has(relSourcePath)) {
      return headingCache.get(relSourcePath);
    }
    const fullPath = path.join(nnDir, relSourcePath);
    if (!fs.existsSync(fullPath)) {
      headingCache.set(relSourcePath, null);
      return null;
    }
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const headings = extractHeadingSlugs(content);
      const slugSet = new Set(headings.map((h) => h.slug));
      const entry = { headings, slugSet, content };
      headingCache.set(relSourcePath, entry);
      return entry;
    } catch {
      headingCache.set(relSourcePath, null);
      return null;
    }
  }

  for (const rel of modelFiles) {
    const modelRelPath = `models/${rel.replace(/\\/g, '/')}`;
    const modelFullPath = path.join(modelsDir, rel);
    const content = fs.readFileSync(modelFullPath, 'utf8');

    // Parse units / elements to associate citation with element name
    const lines = content.split(/\r?\n/);
    let currentElement = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const elemMatch = line.match(/^## NN [^:]+:\s*(.+?)\s*$/);
      if (elemMatch) {
        currentElement = elemMatch[1].trim();
      }

      if (line.trim().startsWith('sources::')) {
        const refs = modelLib.scrapeSourceRefs(line);
        for (const ref of refs) {
          totalCitations++;

          // Model-to-model references cite another model, not a source heading —
          // nothing here to validate against sources/nn/.
          if (ref.startsWith('models/')) {
            validCitations++;
            continue;
          }

          const atIdx = ref.indexOf('@');
          if (atIdx !== -1) {
            const filePartAt = ref.slice(0, atIdx).replace(/^sources\/nn\//, '').trim();
            const unitPartRaw = ref.slice(atIdx + 1).split('&')[0].trim();
            const headerMatch = unitPartRaw.match(/^(#{1,6})\s*(.+?)\s*$/);

            if (!filePartAt || !headerMatch) {
              // Not a header-unit pointer (e.g. a CSV row unit like `data.csv@RowID`) —
              // row-level validation isn't implemented yet, so keep it as unvalidated
              // rather than falsely flagging it as drift.
              validCitations++;
              continue;
            }

            let targetRelPathAt = filePartAt;
            let sourceDataAt = getHeadingsForSource(targetRelPathAt);
            if (!sourceDataAt) {
              const found = findSourceUnderNn(nnDir, filePartAt);
              if (found) {
                targetRelPathAt = found;
                sourceDataAt = getHeadingsForSource(targetRelPathAt);
              }
            }

            if (!sourceDataAt) {
              const msg = `${modelRelPath}${currentElement ? ` (${currentElement})` : ''}: sources:: "${ref}" does not resolve to any file in sources/nn/.`;
              errors.push(msg);
              driftedCitations.push({
                modelFile: modelRelPath,
                elementName: currentElement || undefined,
                citation: ref,
                sourceFile: filePartAt,
                headingSlug: unitPartRaw,
                reason: 'missing_file',
              });
              continue;
            }

            const level = headerMatch[1].length;
            const { slug } = slugifyUnitHeading(level, headerMatch[2]);
            const matches = sourceDataAt.headings.some((h) => h.level === level && h.slug === slug);

            if (!matches) {
              const suggestions = findClosestSlugs(slug, Array.from(sourceDataAt.slugSet));
              const suggStr = suggestions.length > 0 ? ` (Did you mean: ${suggestions.map(s => `@${'#'.repeat(level)} ${s}`).join(', ')}?)` : '';
              const msg = `${modelRelPath}${currentElement ? ` (${currentElement})` : ''}: sources:: "${ref}" references missing heading "${unitPartRaw}" in "sources/nn/${targetRelPathAt}"${suggStr}.`;
              errors.push(msg);
              driftedCitations.push({
                modelFile: modelRelPath,
                elementName: currentElement || undefined,
                citation: ref,
                sourceFile: targetRelPathAt,
                headingSlug: slug,
                reason: 'missing_heading',
                suggestions,
              });
            } else {
              validCitations++;
            }
            continue;
          }

          const hashIdx = ref.indexOf('#');
          const filePart = (hashIdx >= 0 ? ref.substring(0, hashIdx) : ref)
            .replace(/^sources\/nn\//, '')
            .trim();
          const slugPart = hashIdx >= 0 ? ref.substring(hashIdx + 1).trim() : null;

          if (!filePart) continue;

          // Resolve target file path (could be bare name or relative path)
          let targetRelPath = filePart;
          let sourceData = getHeadingsForSource(targetRelPath);

          if (!sourceData) {
            // Search if file exists under any subtree of sources/nn/
            const found = findSourceUnderNn(nnDir, filePart);
            if (found) {
              targetRelPath = found;
              sourceData = getHeadingsForSource(targetRelPath);
            }
          }

          if (!sourceData) {
            const msg = `${modelRelPath}${currentElement ? ` (${currentElement})` : ''}: sources:: "${ref}" does not resolve to any file in sources/nn/.`;
            errors.push(msg);
            driftedCitations.push({
              modelFile: modelRelPath,
              elementName: currentElement || undefined,
              citation: ref,
              sourceFile: filePart,
              headingSlug: slugPart || '',
              reason: 'missing_file',
            });
            continue;
          }

          if (slugPart) {
            if (!sourceData.slugSet.has(slugPart)) {
              // Heading slug is missing in normalized source!
              const suggestions = findClosestSlugs(slugPart, Array.from(sourceData.slugSet));
              const suggStr = suggestions.length > 0 ? ` (Did you mean: ${suggestions.map(s => `#${s}`).join(', ')}?)` : '';
              const msg = `${modelRelPath}${currentElement ? ` (${currentElement})` : ''}: sources:: "${ref}" references missing heading "#${slugPart}" in "sources/nn/${targetRelPath}"${suggStr}.`;
              errors.push(msg);
              driftedCitations.push({
                modelFile: modelRelPath,
                elementName: currentElement || undefined,
                citation: ref,
                sourceFile: targetRelPath,
                headingSlug: slugPart,
                reason: 'missing_heading',
                suggestions,
              });
            } else {
              validCitations++;
            }
          } else {
            validCitations++;
          }
        }
      }
    }
  }

  return {
    errors,
    warnings,
    totalCitations,
    validCitations,
    driftedCitations,
  };
}

/**
 * Helper to locate a source file across subtrees in sources/nn/
 */
function findSourceUnderNn(nnDir, fileName) {
  if (!fs.existsSync(nnDir)) return null;
  const base = path.basename(fileName);
  const queue = [nnDir];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory() && !ent.name.startsWith('.')) {
        queue.push(full);
      } else if (ent.isFile() && (ent.name === base || ent.name === fileName)) {
        return path.relative(nnDir, full).replace(/\\/g, '/');
      }
    }
  }
  return null;
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
      return dcSource === matchPath || dcSource === `${matchName}.md` || dcSource.endsWith(`/${matchName}.md`);
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
 * The report carries `type: report` and `generated_by` frontmatter, names every
 * affected model and element, and details recommended remediation per drift.
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

  const files = modelLib.walkFiles(nnDir, (n) => n.endsWith('.md'));

  for (const rel of files) {
    const base = path.basename(rel);
    const m = base.match(TIMESTAMP_REGEX);
    if (m) {
      const stem = m[1];
      const timestamp = m[2];
      if (!families[stem]) {
        families[stem] = [];
      }
      families[stem].push({
        relPath: rel.replace(/\\/g, '/'),
        fullPath: path.join(nnDir, rel).replace(/\\/g, '/'),
        fileName: base,
        timestamp,
      });
    }
  }

  // Sort each family by timestamp ascending
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
  const modelsDir = path.join(projectDir, 'models');
  const evolutions = [];

  if (!fs.existsSync(modelsDir) || Object.keys(families).length === 0) {
    return evolutions;
  }

  const modelFiles = modelLib.walkFiles(modelsDir, (n) => n.endsWith('_NN.md'));

  for (const rel of modelFiles) {
    const modelRelPath = `models/${rel.replace(/\\/g, '/')}`;
    const modelFullPath = path.join(modelsDir, rel);
    const content = fs.readFileSync(modelFullPath, 'utf8');

    const lines = content.split(/\r?\n/);
    let currentElement = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const elemMatch = line.match(/^## NN [^:]+:\s*(.+?)\s*$/);
      if (elemMatch) {
        currentElement = elemMatch[1].trim();
      }

      if (line.trim().startsWith('sources::')) {
        const refs = modelLib.scrapeSourceRefs(line);
        for (const ref of refs) {
          const hashIdx = ref.indexOf('#');
          const filePart = (hashIdx >= 0 ? ref.substring(0, hashIdx) : ref)
            .replace(/^sources\/nn\//, '')
            .trim();
          const slugPart = hashIdx >= 0 ? ref.substring(hashIdx + 1).trim() : null;

          const baseFile = path.basename(filePart);
          const match = baseFile.match(TIMESTAMP_REGEX);
          if (!match) continue;

          const stem = match[1];
          const citedTs = match[2];

          const snapshots = families[stem];
          if (!snapshots || snapshots.length <= 1) continue;

          const latest = snapshots[snapshots.length - 1];
          if (latest.timestamp > citedTs) {
            // Check heading preservation in latest
            let headingPreserved = true;
            if (slugPart && fs.existsSync(latest.fullPath)) {
              try {
                const latestContent = fs.readFileSync(latest.fullPath, 'utf8');
                const headings = extractHeadingSlugs(latestContent);
                headingPreserved = headings.some((h) => h.slug === slugPart);
              } catch {
                headingPreserved = false;
              }
            }

            evolutions.push({
              modelFile: modelRelPath,
              elementName: currentElement || undefined,
              citation: ref,
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
