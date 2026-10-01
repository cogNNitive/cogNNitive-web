#!/usr/bin/env node
/**
 * Domain State Probe
 *
 * Fast, deterministic local inspection of workspace state:
 * - Layout (current, legacy, mixed)
 * - Knowledge documents count & listing in kNNowledge/
 * - Pending unnormalized sources in sources/ (sha256-verified)
 * - Attached and workspace procedures
 * - Preflight check status with --workspace-dir and bounded offline runtime
 */

const fs = require('fs');
const path = require('path');
const { runCheck, scanWorkspaceSources } = require('./preflight-check');
const { detectLegacy } = require('./lib/legacy-detect.generated.cjs');

/**
 * Runs a deterministic probe against the target workspace directory.
 * @param {object} [options={}]
 * @param {string} [options.workspaceDir='.']
 * @param {boolean} [options.skipPreflight=false]
 * @param {boolean} [options.offline=true]
 * @returns {Promise<object>}
 */
async function runProbe(options = {}) {
  const workspaceDir = path.resolve(options.workspaceDir || '.');
  const isOffline = options.offline !== undefined ? options.offline : true;

  // 1. Layout detection
  const fsReader = {
    list: async (rel) => {
      const full = path.join(workspaceDir, rel);
      return fs.existsSync(full) ? fs.readdirSync(full) : [];
    },
    read: async (rel) => fs.readFileSync(path.join(workspaceDir, rel), 'utf8'),
  };
  let layout = 'current';
  try {
    const layoutRes = await detectLegacy(fsReader);
    layout = layoutRes.kind || 'current';
  } catch {
    layout = 'unknown';
  }

  // 2. Knowledge items count in canonical kNNowledge/
  const knowledgeDir = path.join(workspaceDir, 'kNNowledge');
  let knowledgeItems = [];
  if (fs.existsSync(knowledgeDir)) {
    try {
      knowledgeItems = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith('.md') && !f.startsWith('.'));
    } catch {
      knowledgeItems = [];
    }
  }

  // 3. Pending sources count (unnormalized raw files or hash mismatches)
  try {
    const srcAudit = scanWorkspaceSources(workspaceDir);
    pendingCount = srcAudit.unnormalized !== undefined ? srcAudit.unnormalized : 0;
    sourceSummary = {
      total: srcAudit.total || 0,
      normalized: srcAudit.normalized || 0,
      unnormalized: srcAudit.unnormalized || 0,
    };
  } catch {
    pendingCount = 0;
  }

  // 4. Procedures count
  let domainProceduresCount = 0;
  const procDir = path.join(workspaceDir, 'procedures');
  if (fs.existsSync(procDir)) {
    try {
      domainProceduresCount = fs.readdirSync(procDir).filter((f) => f.endsWith('.md') && !f.startsWith('.')).length;
    } catch {
      domainProceduresCount = 0;
    }
  }

  let blueprintProceduresCount = 0;
  const specDir = path.join(workspaceDir, 'specs', 'bluepriNNts');
  if (fs.existsSync(specDir)) {
    try {
      for (const bp of fs.readdirSync(specDir, { withFileTypes: true })) {
        if (bp.isDirectory()) {
          const bpProc = path.join(specDir, bp.name, 'procedures');
          if (fs.existsSync(bpProc)) {
            blueprintProceduresCount += fs.readdirSync(bpProc).filter((f) => f.endsWith('.md') && !f.startsWith('.')).length;
          }
        }
      }
    } catch {
      blueprintProceduresCount = 0;
    }
  }

  // 5. Preflight check
  let preflightRes = { status: 'ok', exitCode: 0, warnings: [] };
  if (!options.skipPreflight) {
    try {
      const p = await runCheck({
        workspaceDir,
        json: true,
        offline: isOffline,
      });
      const warningItems = (p.items || []).filter(
        (d) =>
          d.status === 'WARN' ||
          d.status === 'ACTION_REQUIRED' ||
          d.status === 'warning' ||
          d.status === 'blocker' ||
          d.status === 'unnormalized' ||
          d.status === 'stale' ||
          d.status === 'dangling' ||
          d.status === 'upgrade-available' ||
          d.status === 'outdated',
      );
      preflightRes = {
        status: p.status,
        exitCode: p.exitCode,
        warnings: warningItems,
      };
      if (p.summary && p.summary.sourcesUnnormalized !== undefined) {
        pendingCount = p.summary.sourcesUnnormalized;
      }
    } catch (e) {
      preflightRes = {
        status: 'ERROR',
        exitCode: 2,
        warnings: [{ message: e.message }],
      };
    }
  }

  return {
    version: '1.0.0',
    layout,
    preflight: preflightRes,
    knowledge: {
      count: knowledgeItems.length,
      items: knowledgeItems,
    },
    sources: {
      pending_count: pendingCount,
      summary: sourceSummary,
    },
    procedures: {
      domain_count: domainProceduresCount,
      blueprint_count: blueprintProceduresCount,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };
  const isJson = args.includes('--json');
  const skipPreflight = args.includes('--skip-preflight');
  const isOffline = !args.includes('--online');
  const workspaceDir = getArg('--workspace-dir') || '.';

  try {
    const result = await runProbe({ workspaceDir, skipPreflight, offline: isOffline });
    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n=== Domain State Probe ===`);
      console.log(`Layout: ${result.layout}`);
      console.log(`Preflight: ${result.preflight.status} (exit ${result.preflight.exitCode})`);
      if (result.preflight.warnings.length > 0) {
        console.log(`Warnings (${result.preflight.warnings.length}):`);
        result.preflight.warnings.forEach((w) => {
          console.log(`  - [${w.status || 'WARN'}] ${w.name || w.type || ''}: ${w.detail || w.message || ''}`);
        });
      }
      console.log(`Knowledge count: ${result.knowledge.count}`);
      console.log(`Pending sources: ${result.sources.pending_count}`);
      console.log(`Procedures (domain/blueprint): ${result.procedures.domain_count}/${result.procedures.blueprint_count}`);
    }
    process.exit(result.preflight.exitCode === 0 ? 0 : 1);
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ status: 'ERROR', error: err.message, exitCode: 2 }));
    } else {
      console.error(`Domain probe error: ${err.message}`);
    }
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runProbe };
