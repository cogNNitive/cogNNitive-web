#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const prompts = require('prompts');

const config = require('./config');
const scanner = require('./scanner');
const transformer = require('./transformer');
const provenance = require('./provenance');
const webImport = require('./webImport');
const { bootstrapProject } = require('./lib/bootstrap');
const { checkLineage } = require('./lib/lineage-check');
const { auditModelCitations, checkScanImpact, writeImpactReport, detectSourceFamilyEvolution } = require('./lib/impact-checker');
const { promoteConversation, PROMOTION_OPTIONS } = require('./lib/conversations');
const externalScanner = require('./lib/external-scanner');
const watchDigestStore = require('./lib/watch-digest-store');
const curateCsv = require('./lib/curate-csv');
const gc = require('./lib/gc');
const convergence = require('./lib/convergence-delta');
const { sidecarPathOf } = require('./lib/innfo-core.generated.cjs');

async function main() {
  const argv = minimist(process.argv.slice(2));

  const hasArgs =
    argv.scan ||
    argv['normalize-file'] ||
    argv.cognitivize ||
    argv.file ||
    argv['scan-external'] ||
    argv.external ||
    argv['watch-digest'] ||
    argv['digest-decide'] ||
    argv.apply ||
    argv.provenance ||
    argv.lineage ||
    argv.check ||
    argv['check-impact'] ||
    argv.impact ||
    argv['impact-check'] ||
    argv.report ||
    argv.src ||
    argv.dest ||
    argv.name ||
    argv['import-url'] ||
    argv['promote-conv'] ||
    argv['promote-conversation'] ||
    argv.unlink ||
    argv.purge ||
    argv['remove-source'] ||
    argv['curate-csv'] ||
    argv.converge ||
    argv['converge-mark'] ||
    argv.gc;

  if (hasArgs) {
    await handleCliMode(argv);
  } else {
    await handleInteractiveMode();
  }
}

/**
 * Renders a convergence proposal (read-only) for humans. Use `--json` for the
 * machine-readable form.
 */
function printConvergenceProposal(proposal) {
  console.log(`Convergence proposal for family "${proposal.family}" (strategy: ${proposal.strategy}, key: ${proposal.key})`);
  if (proposal.empty) {
    console.log(`\n✅ No convergence needed (${proposal.reason}).`);
    return;
  }
  console.log(`  from: ${proposal.from.file} (${proposal.from.sha256.slice(0, 12)})`);
  console.log(`  to:   ${proposal.to.file} (${proposal.to.sha256.slice(0, 12)})`);
  console.log(`\nAdded keys (${proposal.added.length}):`);
  for (const a of proposal.added) console.log(`  + ${a.key}`);
  console.log(`\nChanged values (${proposal.changed.length}):`);
  for (const c of proposal.changed) console.log(`  ~ ${c.key}.${c.field}: ${c.from} -> ${c.to}`);
  console.log(`\nRemoved keys (${proposal.removed.length}) — flag only, never deleted:`);
  for (const r of proposal.removed) console.log(`  - ${r.key}`);
  console.log(`\nThis is a read-only proposal. Apply it through the reviewed model mutation path, then mark it with --converge-mark.`);
}

/**
 * Reports the citations that still target an older member of a write-once family
 * (the family impact check): superseded ones as information, ones whose cited unit
 * no longer resolves in the latest member as warnings.
 */
function reportScanImpact(projectDir) {
  for (const impact of checkScanImpact(projectDir)) {
    const unresolved = impact.affectedModels.filter((a) => a.status === 'unresolved_in_latest');
    if (unresolved.length > 0) {
      console.warn(`\n⚠️  [IMPACT WARNING] A newer member of "${impact.source}" exists (${impact.latest}); cited units that do not resolve in it:`);
      for (const aff of unresolved) {
        console.warn(`    - ${aff.modelFile}${aff.element ? ` (${aff.element})` : ''}: "${aff.citation}"`);
      }
    }
    const superseded = impact.affectedModels.filter((a) => a.status === 'superseded');
    if (superseded.length > 0) {
      console.log(`\nℹ️  Superseded citations of "${impact.source}" (still resolve in ${impact.latest}):`);
      for (const aff of superseded) {
        console.log(`    - ${aff.modelFile}${aff.element ? ` (${aff.element})` : ''}: "${aff.citation}"`);
      }
    }
  }
}

/**
 * Garbage collection of write-once families. Dry run by default: lists the
 * non-latest, uncited members. `--apply` deletes only the user-confirmed
 * `--paths` that are still in a freshly computed plan, and needs `--yes`.
 * CI never applies.
 */
async function handleGc(projectDir, argv) {
  if (!argv.apply) {
    const { candidates } = await gc.planProjectGc(projectDir);
    if (argv.json) {
      console.log(JSON.stringify({ candidates }, null, 2));
      process.exit(0);
    }
    if (candidates.length === 0) {
      console.log('✅ Nothing to collect: every superseded member is cited or there is none.');
      process.exit(0);
    }
    console.log(`Superseded and uncited members (${candidates.length}). Nothing was deleted:`);
    for (const c of candidates) console.log(`  ${c}`);
    console.log('\nTo delete a confirmed subset: --gc --apply --yes --paths <path>[,<path>...]');
    process.exit(0);
  }

  if (process.env.CI) {
    console.error('Error: --gc --apply never runs in CI. Run it interactively and confirm the paths.');
    process.exit(1);
  }
  const confirmed = gc.parsePathsArg(argv.paths);
  if (!argv.yes || confirmed.length === 0) {
    console.error('Error: --gc --apply needs --yes and --paths <path>[,<path>...] naming the members to delete.');
    process.exit(2);
  }
  const { deleted, kept } = await gc.applyProjectGc(projectDir, confirmed);
  for (const d of deleted) console.log(`🗑️  Deleted ${d} (and its sidecar)`);
  for (const k of kept) console.warn(`⚠️  Kept ${k}: not in the current plan (latest member, cited, or unknown).`);
  process.exit(0);
}

async function handleCliMode(argv) {
  let projectDir = '';

  if (argv.dest && argv.name) {
    projectDir = path.join(argv.dest, argv.name);
  } else if (argv.src && !argv.dest) {
    projectDir = argv.src;
  } else {
    projectDir = getActiveProjectDir();
  }

  if (argv.src && argv.dest && argv.name) {
    console.log(`Bootstrapping project "${argv.name}" at "${projectDir}"...`);
    const bootstrap = bootstrapProject(argv.src, argv.dest, argv.name);
    console.log(`Copied ${bootstrap.copiedCount} file(s) to sources/import (subfolders preserved).`);
    console.log(`Initialized cogNNitive lineage record at: ${bootstrap.provModelPath}`);
    if (bootstrap.agentsMdPath) {
      console.log(`Scaffolded workspace AGENTS.md entrypoint at: ${bootstrap.agentsMdPath}`);
    }
    console.log(`\n📌 Place your files to import into: ${bootstrap.importDir}\n`);
  }

  if (!fs.existsSync(projectDir)) {
    console.error(`Error: Project directory "${projectDir}" does not exist.`);
    console.error('Please specify valid --src, --dest and --name to bootstrap it first.');
    process.exit(1);
  }

  if (argv.gc) {
    await handleGc(projectDir, argv);
  }

  if (argv.check) {
    const { errors, warnings } = checkLineage(projectDir);
    for (const w of warnings) console.log(`⚠️  ${w}`);
    for (const e of errors) console.error(`❌ ${e}`);
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ Lineage record is in sync with the workspace filesystem.');
    }
    process.exit(errors.length > 0 ? 1 : 0);
  }

  if (argv['check-impact'] || argv.impact || argv['impact-check'] || argv.report) {
    console.log(`Auditing model citations in "${projectDir}"...`);
    const audit = auditModelCitations(projectDir);
    for (const w of audit.warnings) console.log(`⚠️  ${w}`);
    for (const e of audit.errors) console.error(`❌ ${e}`);
    if (audit.errors.length === 0) {
      console.log(`✅ All ${audit.validCitations} model citation(s) resolve to valid source files and headings.`);
    } else {
      console.error(`\nFound ${audit.errors.length} citation drift issue(s) across models.`);
    }
    if (argv.report) {
      const { reportPath, status } = await writeImpactReport(projectDir, audit);
      console.log(
        status === 'deduplicated'
          ? `📊 Impact audit report unchanged (latest: ${reportPath})`
          : `📊 Impact audit report written to: ${reportPath}`,
      );
    }
    process.exit(audit.errors.length > 0 ? 1 : 0);
  }

  if (argv['scan-external'] || argv.external) {
    const scanResult = externalScanner.scanAllWatchRoots(projectDir);

    if (argv.json) {
      console.log(JSON.stringify(externalScanner.serializeScanResult(scanResult), null, 2));
      process.exit(0);
    }

    console.log(`Scanning external watch roots for "${projectDir}"...`);

    console.log(`Discovered ${scanResult.roots.length} external root(s).`);
    for (const r of scanResult.roots) {
      console.log(`- [${r.status}] ${r.root} (${r.cadence}, ${r.items.length} file(s))`);
    }

    const { new: newItems, evolved, alerts, disconnected } = scanResult.classified;
    console.log(`\nDelta Summary:`);
    console.log(`  NEW files: ${newItems.length}`);
    console.log(`  EVOLVED (dynamic): ${evolved.length}`);
    console.log(`  STATIC ALERTS: ${alerts.length}`);
    console.log(`  DISCONNECTED roots: ${disconnected.length}`);

    const candidates = [...newItems, ...evolved];
    if (candidates.length > 0) {
      if (argv.yes || argv.y || argv.apply) {
        console.log(`\nImporting ${candidates.length} candidate file(s) into sources/import/...`);
        const imported = await externalScanner.importExternalFiles(candidates, projectDir);
        for (const imp of imported) {
          console.log(`  ✔ ${imp.status === 'deduplicated' ? 'Already imported' : 'Copied'}: ${imp.importedAs}`);
        }
        console.log(`\nNormalizing imported sources...`);
        const scanRes = await scanner.scanAndProcess(projectDir, { autoAcceptPrompt: true });
        console.log(`Normalization done: Processed ${scanRes.processedCount} source(s).`);
      } else {
        console.log(`\nCandidate files to import:`);
        for (const c of candidates) {
          console.log(`  - [${c.deltaStatus}] ${c.baseName} (${c.cadence})`);
        }
        console.log(`\nRun with --apply or --yes to import and normalize these files.`);
      }
    }

    const evolutions = detectSourceFamilyEvolution(projectDir);
    if (evolutions.length > 0) {
      console.log(`\n⚡ Source Family Evolution Opportunities (${evolutions.length}):`);
      for (const evo of evolutions) {
        console.log(`  - ${evo.modelFile}: cites "${evo.currentSnapshot}" -> newer "${evo.latestSnapshot}" available`);
      }
    }

    process.exit(0);
  }

  if (argv['watch-digest']) {
    // Read-only session-start digest. Never writes to sources/; degrades to an
    // empty digest when no roots are declared or the scan is unavailable.
    let digest;
    try {
      const state = watchDigestStore.loadState(projectDir);
      const scanResult = externalScanner.scanAllWatchRoots(projectDir);
      digest = watchDigestStore.buildDigest(scanResult, state);
    } catch (err) {
      digest = {
        generatedAt: new Date().toISOString(),
        roots: [],
        disconnected: [],
        items: [],
        error: err.message,
      };
    }

    if (argv.json || digest.items.length > 0 || digest.disconnected.length > 0) {
      console.log(JSON.stringify(digest, null, 2));
    }
    process.exit(0);
  }

  if (argv['digest-decide']) {
    const key = String(argv['digest-decide']);
    const status = argv.status || 'postpone';

    if (!watchDigestStore.DECISION_STATUSES.includes(status)) {
      console.error(`Error: --status must be one of: ${watchDigestStore.DECISION_STATUSES.join(', ')}.`);
      process.exit(1);
    }

    try {
      if (status === 'import') {
        const scanResult = externalScanner.scanAllWatchRoots(projectDir);
        const item = watchDigestStore.findItemByKey(scanResult, key);
        if (!item) {
          console.error(`Error: no external item matches digest key "${key}".`);
          process.exit(1);
        }
        await externalScanner.importExternalFiles([item], projectDir);
        await scanner.scanAndProcess(projectDir, { autoAcceptPrompt: true });
      }
      watchDigestStore.decide(projectDir, key, status, argv.note);
      console.log(JSON.stringify({ key, status, state: watchDigestStore.statePath(projectDir) }, null, 2));
    } catch (err) {
      console.error(`Error applying digest decision: ${err.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (argv['converge-mark']) {
    const family = String(argv['converge-mark']);
    const snaps = convergence.resolveFamilySnapshots(projectDir, family);
    if (snaps.length < 2) {
      console.error(`Error: family "${family}" needs at least two snapshots under sources/ to mark as applied.`);
      process.exit(1);
    }
    const to = snaps[snaps.length - 1];
    const toSha = convergence.sha256(fs.readFileSync(to.absPath, 'utf8'));
    watchDigestStore.recordConvergence(projectDir, family, {
      appliedToSha: toSha,
      appliedVersion: argv.version ? String(argv.version) : '',
    });
    console.log(
      JSON.stringify(
        { family, appliedToSha: toSha, appliedVersion: argv.version || '', state: watchDigestStore.statePath(projectDir) },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  if (argv.converge) {
    const family = String(argv.converge);
    const manifestPath = convergence.findFamilyManifest(projectDir);
    if (!manifestPath) {
      console.error(`Error: no domaiNN manifest declaring "## NN Source Family:" found under "${projectDir}".`);
      process.exit(1);
    }
    const families = convergence.parseSourceFamilies(fs.readFileSync(manifestPath, 'utf8'));
    const declared = families.find((f) => f.family === family);
    if (!declared) {
      console.error(`Error: family "${family}" is not declared in ${path.relative(projectDir, manifestPath).replace(/\\/g, '/')}.`);
      process.exit(1);
    }

    if (declared.strategy === 'cite-only') {
      console.log(JSON.stringify({ family, strategy: 'cite-only', empty: true, reason: 'cite-only' }, null, 2));
      process.exit(0);
    }
    if (!declared.key) {
      console.error(`Error: family "${family}" declares strategy "${declared.strategy}" but no key::.`);
      process.exit(1);
    }

    const snaps = convergence.resolveFamilySnapshots(projectDir, family);
    if (snaps.length < 2) {
      console.error(`Error: family "${family}" needs at least two snapshots under sources/ (found ${snaps.length}).`);
      process.exit(1);
    }
    const from = snaps[snaps.length - 2];
    const to = snaps[snaps.length - 1];
    const toContent = fs.readFileSync(to.absPath, 'utf8');
    const toSha = convergence.sha256(toContent);

    if (watchDigestStore.ignoredShas(projectDir).has(toSha)) {
      console.log(JSON.stringify({ family, strategy: declared.strategy, empty: true, reason: 'ignored' }, null, 2));
      process.exit(0);
    }

    const recorded = watchDigestStore.getConvergence(projectDir, family);
    let proposal;
    try {
      proposal = convergence.buildProposal({
        family,
        strategy: declared.strategy,
        key: declared.key,
        fromFile: from.relPath,
        fromContent: fs.readFileSync(from.absPath, 'utf8'),
        toFile: to.relPath,
        toContent,
        appliedToSha: recorded ? recorded.appliedToSha : null,
      });
    } catch (err) {
      console.error(`Error: ${err.message}`);
      for (const c of err.conflicts || []) {
        console.error(`  - ${c.reason}${c.key ? ` (${c.key})` : ''}${c.row ? ` at row ${c.row}` : ''}`);
      }
      process.exit(1);
    }

    if (argv.plan) {
      let plan;
      try {
        plan = convergence.buildApplyPlan(proposal, declared.concept);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
      console.log(JSON.stringify({ family, strategy: declared.strategy, concept: declared.concept, ...plan }, null, 2));
      process.exit(0);
    }

    if (argv.json) {
      console.log(JSON.stringify(proposal, null, 2));
    } else {
      printConvergenceProposal(proposal);
    }
    process.exit(0);
  }

  let importResult = null;
  if (argv['import-url']) {
    const targetLabel = 'sources/import';
    console.log(`Downloading "${argv['import-url']}" into ${targetLabel}/...`);
    try {
      importResult = await webImport.downloadToImport(argv['import-url'], projectDir);
      console.log(
        importResult.deduplicated
          ? `Already imported (identical bytes): ${targetLabel}/${importResult.relPath}`
          : `Downloaded to: ${targetLabel}/${importResult.relPath}`,
      );
    } catch (err) {
      console.error(`Error downloading URL: ${err.message}`);
      process.exit(1);
    }
  }

  if (argv['normalize-file'] || argv.file) {
    const targetFile = argv['normalize-file'] || argv.file;
    console.log(`Normalizing single document "${targetFile}" in "${projectDir}"...`);

    const scanOptions = {
      autoAcceptPrompt: true,
      singleFile: targetFile,
    };

    if (argv.formats) {
      const selected = argv.formats.split(',').map(f => '.' + f.trim().replace(/^\./, ''));
      scanOptions.formats = selected;
    }

    const result = await scanner.scanAndProcess(projectDir, scanOptions);
    console.log(`Normalization completed! Discovered: ${result.totalDiscovered}, Processed: ${result.processedCount}, Skipped: ${result.skippedCount}`);

    reportScanImpact(projectDir);

    const prov = provenance.buildProvenanceKnowledge(projectDir);
    console.log(
      `cogNNitive lineage record ${prov.created ? 'created' : 'refreshed'}: ` +
        `${prov.sourceCount} source(s), ${prov.modelCount} model(s), ${prov.artifactCount} artifact(s) — ${prov.modelPath}`,
    );
    provenance.appendProcedureRun(projectDir, {
      command: 'normalize-file',
      flags: `--file "${targetFile}"`,
      inputs: [targetFile],
      outputs: ['sources/import/*_sidecar_NN.md', 'sources/conversations/*_sidecar_NN.md'],
    });

    process.exit(result.processedCount > 0 ? 0 : 1);
  }

  if (argv.cognitivize) {
    const target = String(argv.cognitivize);
    console.log(`Cognitivizing "${target}" in place in "${projectDir}"...`);

    const options = { autoAcceptPrompt: true };
    if (argv.formats) {
      options.formats = argv.formats.split(',').map(f => '.' + f.trim().replace(/^\./, ''));
    }

    let result;
    try {
      result = await scanner.cognitivizeTarget(projectDir, target, options);
    } catch (err) {
      console.error(`Error cognitivizing "${target}": ${err.message}`);
      process.exit(1);
    }
    for (const entry of result.registry) {
      console.log(`  ${entry.status} ${entry.name}: ${entry.action}`);
    }
    console.log(`Cognitivize completed! Discovered: ${result.totalDiscovered}, Processed: ${result.processedCount}, Skipped: ${result.skippedCount}`);

    const prov = provenance.buildProvenanceKnowledge(projectDir);
    console.log(
      `cogNNitive lineage record ${prov.created ? 'created' : 'refreshed'}: ` +
        `${prov.sourceCount} source(s), ${prov.modelCount} model(s), ${prov.artifactCount} artifact(s) — ${prov.modelPath}`,
    );
    provenance.appendProcedureRun(projectDir, {
      command: 'cognitivize',
      flags: `--cognitivize "${target}"`,
      inputs: [target],
      outputs: ['*_sidecar_NN.md'],
    });

    process.exit(result.totalDiscovered > 0 ? 0 : 1);
  }

  if (argv.scan) {
    console.log(`Scanning and converting documents in "${projectDir}"...`);

    const scanOptions = {
      autoAcceptPrompt: true,
    };

    if (argv.formats) {
      const selected = argv.formats.split(',').map(f => '.' + f.trim().replace(/^\./, ''));
      scanOptions.formats = selected;
    }

    if (importResult) {
      scanOptions.webImportMeta = {
        [importResult.relPath]: {
          source_url: importResult.sourceUrl,
          downloaded_at: importResult.downloadedAt,
          ...importResult.meta,
        }
      };
    }

    const result = await scanner.scanAndProcess(projectDir, scanOptions);
    console.log(`Scan completed! Discovered: ${result.totalDiscovered}, Processed: ${result.processedCount}, Skipped: ${result.skippedCount}`);

    reportScanImpact(projectDir);

    const prov = provenance.buildProvenanceKnowledge(projectDir);
    console.log(
      `cogNNitive lineage record ${prov.created ? 'created' : 'refreshed'}: ` +
        `${prov.sourceCount} source(s), ${prov.modelCount} model(s), ${prov.artifactCount} artifact(s) — ${prov.modelPath}`,
    );
    provenance.appendProcedureRun(projectDir, {
      command: importResult ? 'import-url + scan' : 'scan',
      flags: argv.formats ? `--formats ${argv.formats}` : undefined,
      inputs: importResult ? [`sources/import/${importResult.relPath}`] : ['sources/import/'],
      outputs: ['sources/import/*_sidecar_NN.md', 'sources/conversations/*_sidecar_NN.md'],
    });
  }

  if (argv['curate-csv']) {
    const target = argv['curate-csv'];
    try {
      const result = await curateCsv.curateCsvFile(target, {
        key: argv.key,
        dedup: Boolean(argv.dedup),
        projectDir,
      });
      console.log(`Curated CSV written: ${result.relOutput}`);
      console.log(
        `  key column "${result.keyName}" · ${result.inputRows} input row(s) -> ${result.outputRows} row(s)` +
          (result.collapsed ? ` · ${result.collapsed} duplicate key(s) collapsed` : '') +
          (result.droppedEmptyKey ? ` · ${result.droppedEmptyKey} empty-key row(s) dropped` : ''),
      );
      console.log(`  cite a row as: sources:: [${result.citationExample}]`);
      provenance.appendProcedureRun(projectDir, {
        command: 'curate-csv',
        flags: `--curate-csv "${target}"${argv.key ? ` --key "${argv.key}"` : ''}${argv.dedup ? ' --dedup' : ''}`,
        inputs: [target],
        outputs: [result.relOutput],
      });
    } catch (err) {
      console.error(`Error curating CSV: ${err.message}`);
      process.exit(1);
    }
  }

  if ((argv.provenance || argv.lineage) && !argv.scan) {
    const prov = provenance.buildProvenanceKnowledge(projectDir);
    console.log(
      `cogNNitive lineage record ${prov.created ? 'created' : 'refreshed'}: ` +
        `${prov.sourceCount} source(s), ${prov.modelCount} model(s), ${prov.artifactCount} artifact(s) — ${prov.modelPath}`,
    );
  }

  if (argv.apply) {
    const templateName = argv.apply;
    console.log(`Applying transformation "${templateName}" in "${projectDir}"...`);
    try {
      const result = await transformer.applyTransformation(projectDir, templateName);
      console.log(`Transformation applied successfully!`);
      console.log(`Output saved to: ${result.outputPath}`);
      provenance.buildProvenanceKnowledge(projectDir);
      provenance.appendProcedureRun(projectDir, {
        command: `apply ${templateName}`,
        inputs: ['sources/', 'kNNowledge/'],
        outputs: [result.outputPath.replace(projectDir, '').replace(/^[\\/]/, '')],
      });
    } catch (err) {
      console.error(`Error applying transformation: ${err.message}`);
      process.exit(1);
    }
  }

  if (argv['promote-conv'] || argv['promote-conversation']) {
    const sessionTarget = argv['promote-conv'] || argv['promote-conversation'];
    const sessionFile = path.isAbsolute(sessionTarget) ? sessionTarget : path.join(projectDir, sessionTarget);
    const format = argv.format || 'summary';
    const slug = argv.slug || undefined;

    console.log(`Promoting conversation transcript "${path.basename(sessionFile)}" with format "${format}"...`);
    try {
      const result = await promoteConversation({
        workspaceRoot: projectDir,
        sessionFile,
        titleSlug: slug,
        format,
      });
      console.log(`Promotion complete! Promoted ${result.promotedFiles.length} file(s) to sources/conversations/ and cognitivized in place.`);
    } catch (err) {
      console.error(`Error promoting conversation: ${err.message}`);
      process.exit(1);
    }
  }

  if (argv.unlink || argv.purge || argv['remove-source']) {
    const target = argv.unlink || argv.purge || argv['remove-source'];
    console.log(`Unlinking/purging source "${target}" from workspace "${projectDir}"...`);
    const { deleted } = unlinkSource(projectDir, target);
    if (deleted.length === 0) {
      console.log(`No files matched "${target}".`);
    } else {
      console.log(`Deleted ${deleted.length} file(s)/folder(s):`);
      for (const d of deleted) {
        console.log(`  - ${path.relative(projectDir, d).replace(/\\/g, '/')}`);
      }
      // Regenerate lineage & index
      const scanRes = await scanner.scanAndProcess(projectDir, {});
      const prov = provenance.buildProvenanceKnowledge(projectDir);
      console.log(
        `Workspace lineage refreshed: ${prov.sourceCount} source(s), ${prov.modelCount} model(s), ${prov.artifactCount} artifact(s).`
      );
    }
  }
}

function unlinkSource(projectDir, targetPattern) {
  if (!targetPattern || typeof targetPattern !== 'string') {
    return { deleted: [] };
  }

  const cleanPattern = targetPattern.replace(/\\/g, '/').replace(/^sources\/(import|conversations)\//, '');
  const baseTarget = path.basename(cleanPattern).replace(/\.[^.]+$/, '');

  const slugifyHelper = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const baseSlug = slugifyHelper(baseTarget);

  const deleted = [];
  const sourcesDir = path.join(projectDir, 'sources');

  const checkAndDelete = (filePath) => {
    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          fs.unlinkSync(filePath);
          deleted.push(filePath);
          // A raw file and its co-located sidecar go together: no orphaned sidecar is left behind.
          const sidecar = sidecarPathOf(filePath);
          if (fs.existsSync(sidecar)) {
            fs.unlinkSync(sidecar);
            deleted.push(sidecar);
          }
        } else if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
          deleted.push(filePath);
        }
      } catch (err) {
        console.warn(`Warning: Could not delete ${filePath}: ${err.message}`);
      }
    }
  };

  const walkAndRemove = (dir) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const dName = ent.name.toLowerCase();
        if (dName === baseTarget.toLowerCase() || (baseSlug && dName === baseSlug)) {
          checkAndDelete(full);
        } else {
          walkAndRemove(full);
        }
      } else if (ent.isFile()) {
        const fName = ent.name.toLowerCase();
        const fStem = path.basename(ent.name, path.extname(ent.name)).toLowerCase();
        const fSlug = slugifyHelper(fStem);
        if (
          fName === cleanPattern.toLowerCase() ||
          fStem === baseTarget.toLowerCase() ||
          (baseSlug && fSlug === baseSlug)
        ) {
          checkAndDelete(full);
        }
      }
    }
  };

  walkAndRemove(sourcesDir);

  const assetsDir = path.join(projectDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const assetEntries = fs.readdirSync(assetsDir, { withFileTypes: true });
    for (const ent of assetEntries) {
      const aName = ent.name.toLowerCase();
      if (aName.includes(baseTarget.toLowerCase()) || (baseSlug && aName.includes(baseSlug))) {
        checkAndDelete(path.join(assetsDir, ent.name));
      }
    }
  }

  return { deleted };
}

async function handleInteractiveMode() {
  console.log('=== Welcome to traNNsform CLI ===\n');

  let projectDir = getActiveProjectDir();
  let projectExists = fs.existsSync(projectDir) &&
    fs.existsSync(path.join(projectDir, 'sources', 'import'));

  const choices = [];
  if (projectExists) {
    choices.push({ title: `Use current project: ${path.basename(projectDir)} (${projectDir})`, value: 'current' });
  }
  choices.push({ title: 'Bootstrap/Create a new project', value: 'bootstrap' });
  choices.push({ title: 'Configure default paths', value: 'configure' });
  choices.push({ title: 'Exit', value: 'exit' });

  const response = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices
  });

  if (!response.action || response.action === 'exit') {
    console.log('Goodbye!');
    return;
  }

  if (response.action === 'configure') {
    await configureDefaults();
    return handleInteractiveMode();
  }

  if (response.action === 'bootstrap') {
    projectDir = await runBootstrapperFlow();
    if (!projectDir) return handleInteractiveMode();
    projectExists = true;
  }

  await runProjectMenu(projectDir);
}

async function configureDefaults() {
  const currentDefault = config.getDefaultPath();
  const response = await prompts({
    type: 'text',
    name: 'path',
    message: 'Enter new default parent target directory:',
    initial: currentDefault
  });

  if (response.path) {
    const cleanPath = response.path.replace(/^["']|["']$/g, '').trim();
    config.saveConfig({ defaultPath: path.resolve(cleanPath) });
    console.log(`Saved default path: ${config.getDefaultPath()}`);
  }
}

async function runBootstrapperFlow() {
  const defaultDest = config.getDefaultPath();

  const questions = [
    {
      type: 'text',
      name: 'src',
      message: 'Enter the source directory containing raw files to import (will be copied to sources/import):',
      validate: value => {
        const clean = value.replace(/^["']|["']$/g, '').trim();
        return fs.existsSync(clean) ? true : 'Source directory does not exist';
      }
    },
    {
      type: 'confirm',
      name: 'useSrcAsDest',
      message: 'Use the source directory as the target parent directory?',
      initial: false
    },
    {
      type: (prev, values) => values.useSrcAsDest ? null : 'text',
      name: 'dest',
      message: 'Enter the target parent directory:',
      initial: defaultDest,
      validate: value => {
        const clean = value.replace(/^["']|["']$/g, '').trim();
        return clean.length > 0 ? true : 'Target parent directory cannot be empty';
      }
    },
    {
      type: 'text',
      name: 'name',
      message: 'Enter the project name:',
      initial: (prev, values) => values.useSrcAsDest ? 'traNNsform' : 'MyTransformProject',
      validate: value => value.trim().length > 0 ? true : 'Project name cannot be empty'
    },
  ];

  const answers = await prompts(questions);

  if (!answers.src || !answers.name || (answers.useSrcAsDest === undefined) || (!answers.useSrcAsDest && !answers.dest)) {
    console.log('Bootstrapping cancelled.');
    return null;
  }

  answers.src = answers.src.replace(/^["']|["']$/g, '').trim();
  const targetDest = answers.useSrcAsDest ? answers.src : answers.dest.replace(/^["']|["']$/g, '').trim();

  const projectDir = path.join(targetDest, answers.name);
  const bootstrap = bootstrapProject(answers.src, targetDest, answers.name);
  console.log(`Copied ${bootstrap.copiedCount} file(s) to sources/import (subfolders preserved).`);
  console.log(`Initialized cogNNitive lineage record at: ${bootstrap.provModelPath}`);

  config.saveConfig({ lastProjectPath: projectDir });

  console.log(`Project successfully bootstrapped at: ${projectDir}\n`);
  console.log(`\n📌 Place your files to import into: ${bootstrap.importDir}\n`);
  return projectDir;
}

async function runProjectMenu(projectDir) {
  console.log(`\nActive Project: ${path.basename(projectDir)}`);
  console.log(`Path: ${projectDir}\n`);

  const response = await prompts({
    type: 'select',
    name: 'action',
    message: 'Select an action:',
    choices: [
      { title: 'Scan and process source files in sources/import (and active source trees)', value: 'scan' },
      { title: 'Promote conversation transcript to sources/conversations', value: 'promote_conv' },
      { title: 'Apply template transformation', value: 'transform' },
      { title: 'Create new transformation template', value: 'create_template' },
      { title: 'Back to main menu', value: 'back' }
    ]
  });

  if (response.action === 'back' || !response.action) {
    return handleInteractiveMode();
  }

  if (response.action === 'create_template') {
    await runCreateBlueprintFlow(projectDir);
    return runProjectMenu(projectDir);
  }

  if (response.action === 'promote_conv') {
    await runPromoteConversationFlow(projectDir);
    return runProjectMenu(projectDir);
  }

  if (response.action === 'scan') {
    console.log('\nScanning active source directories (sources/import, sources/conversations)...');
    const result = await scanner.scanAndProcess(projectDir, { autoAcceptPrompt: true });
    console.log('\n=== Scan Completed ===');
    console.log(`Processed: ${result.processedCount} files successfully.`);
    console.log(`Skipped/Needs Review: ${result.skippedCount} files.`);
    if (result.orphans.length > 0) console.log(`Orphaned sidecars (raw file missing, preserved): ${result.orphans.length}.`);

    const prov = provenance.buildProvenanceKnowledge(projectDir);
    console.log(
      `cogNNitive lineage record ${prov.created ? 'created' : 'refreshed'}: ` +
        `${prov.sourceCount} source(s), ${prov.modelCount} model(s), ${prov.artifactCount} artifact(s) — ${prov.modelPath}\n`,
    );
    provenance.appendProcedureRun(projectDir, {
      command: 'scan',
      inputs: ['sources/import/', 'sources/conversations/'],
      outputs: ['sources/import/*_sidecar_NN.md', 'sources/conversations/*_sidecar_NN.md'],
    });

    return runProjectMenu(projectDir);
  }

  if (response.action === 'transform') {
    const templates = transformer.listBlueprints(projectDir);
    if (templates.length === 0) {
      console.log('No transformation templates found in traNNsformations/ directory.');
      return runProjectMenu(projectDir);
    }

    const templateResponse = await prompts({
      type: 'select',
      name: 'templateName',
      message: 'Choose a transformation template to apply:',
      choices: templates.map(t => ({ title: t, value: t }))
    });

    if (!templateResponse.templateName) {
      return runProjectMenu(projectDir);
    }

    try {
      console.log('\nApplying transformation...');
      const result = await transformer.applyTransformation(projectDir, templateResponse.templateName);
      console.log(`\nTransformation successful!`);
      console.log(`Output saved to: ${result.outputPath}`);
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }

    return runProjectMenu(projectDir);
  }
}

async function runPromoteConversationFlow(projectDir) {
  const convDir = path.join(projectDir, 'conversations');
  if (!fs.existsSync(convDir)) {
    console.log('\nNo conversations/ directory found in project.');
    return;
  }
  const files = fs.readdirSync(convDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('\nNo conversation transcript files found in conversations/.');
    return;
  }

  const fileResp = await prompts({
    type: 'select',
    name: 'sessionFile',
    message: 'Select conversation transcript to promote:',
    choices: files.map(f => ({ title: f, value: f })),
  });
  if (!fileResp.sessionFile) return;

  const promoResp = await prompts({
    type: 'select',
    name: 'format',
    message: 'Select promotion format altitude:',
    choices: PROMOTION_OPTIONS.map(o => ({ title: o.title, value: o.value })),
  });
  if (!promoResp.format || promoResp.format === 'none') {
    console.log('Promotion cancelled or format none selected.');
    return;
  }

  const sessionAbsPath = path.join(convDir, fileResp.sessionFile);
  const result = await promoteConversation({
    workspaceRoot: projectDir,
    sessionFile: sessionAbsPath,
    format: promoResp.format,
  });
  console.log(`\nPromoted ${result.promotedFiles.length} file(s) into sources/conversations/ and cognitivized in place.`);
}

async function runCreateBlueprintFlow(projectDir) {
  console.log('\n=== Create New Transformation Template ===\n');

  const answers = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Enter template name (e.g., Summary Report):',
      validate: value => value.trim().length > 0 ? true : 'Template name cannot be empty'
    },
    {
      type: 'text',
      name: 'purpose',
      message: 'Enter the purpose of this transformation:',
      validate: value => value.trim().length > 0 ? true : 'Purpose cannot be empty'
    },
    {
      type: 'text',
      name: 'instructions',
      message: 'Enter transformation instructions/criteria:',
      validate: value => value.trim().length > 0 ? true : 'Instructions cannot be empty'
    },
    {
      type: 'text',
      name: 'structure',
      message: 'Enter template markdown structure (optional):',
      initial: '### [Title]\n**Field:** [Value]'
    }
  ]);

  if (!answers.name || !answers.purpose || !answers.instructions) {
    console.log('Template creation cancelled.');
    return;
  }

  const transDir = path.join(projectDir, 'traNNsformations');
  if (!fs.existsSync(transDir)) {
    fs.mkdirSync(transDir, { recursive: true });
  }

  let fileName = answers.name.trim();
  if (!fileName.endsWith('.md')) {
    fileName += '.md';
  }

  const templatePath = path.join(transDir, fileName);
  const content = `# Transformation: ${answers.name}

## Purpose
${answers.purpose}

## Instructions
${answers.instructions}

## Template
${answers.structure || ''}
`;

  fs.writeFileSync(templatePath, content, 'utf8');
  console.log(`\nTemplate successfully created at: ${templatePath}`);
}

function getActiveProjectDir() {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'sources', 'import'))) {
    return cwd;
  }

  const cfg = config.getConfig();
  if (cfg.lastProjectPath && fs.existsSync(cfg.lastProjectPath)) {
    return cfg.lastProjectPath;
  }

  const workspaceSamplePath = path.join(cwd, 'Sample');
  if (fs.existsSync(workspaceSamplePath)) {
    return workspaceSamplePath;
  }

  return cwd;
}

main().catch(err => {
  console.error('An unexpected error occurred:', err);
});
