#!/usr/bin/env node
/**
 * Domain State Probe
 *
 * Fast, deterministic local inspection of workspace state:
 * - Knowledge documents count & listing in kNNowledge/
 * - Pending unnormalized sources in sources/ (sha256-verified)
 * - Attached and workspace procedures
 * - Preflight check status with --workspace-dir and bounded offline runtime
 */

const fs = require('fs');
const path = require('path');
const { runCheck, scanWorkspaceSources } = require('./preflight-check');
const { isNNName, isSidecarName } = /** @type {any} */ (require('./lib/naming-contract.generated.cjs'));

/**
 * Filename tokens that identify the workspace lineage / entrypoint record — the
 * document that may declare `## NN External Watch Roots:`. Mirrors the discovery
 * used by `nn-sources` (`domaiNN` canonical, `cogNNitive` lineage, `workspace`
 * legacy) without depending on that skill.
 */
const RECORD_TOKENS = ['cogNNitive', 'domaiNN', 'workspace'];

/**
 * Finds the lineage / entrypoint record that may declare watch roots: first a
 * `*_NN.md` file under `kNNowledge/`, then one at the workspace root.
 * @param {string} workspaceDir
 * @returns {string | null} absolute path to the record, or null
 */
function findLineageRecord(workspaceDir) {
  const candidates = [];
  const push = (dir) => {
    if (!fs.existsSync(dir)) return;
    try {
      for (const f of fs.readdirSync(dir)) {
        if (isNNName(f) && !isSidecarName(f)) candidates.push(path.join(dir, f));
      }
    } catch {
      /* ignore unreadable dirs */
    }
  };
  push(path.join(workspaceDir, 'kNNowledge'));
  push(workspaceDir);
  return candidates.find((p) => RECORD_TOKENS.some((t) => path.basename(p).includes(t))) || null;
}

/**
 * Counts the roots declared in the record's `## NN External Watch Roots:` block.
 * Cheap, offline, and tolerant of CRLF and quoted paths. Never walks the roots.
 * @param {string} workspaceDir
 * @returns {number}
 */
function countWatchRoots(workspaceDir) {
  const recordPath = findLineageRecord(workspaceDir);
  if (!recordPath) return 0;
  let content;
  try {
    content = fs.readFileSync(recordPath, 'utf8');
  } catch {
    return 0;
  }
  const sectionMatch = content.match(/## NN External Watch Roots:\s*([\s\S]*?)(?=\n## NN |\n# NN |$)/i);
  if (!sectionMatch) return 0;
  let count = 0;
  for (const rawLine of sectionMatch[1].split(/\r?\n/)) {
    if (/^\s*-\s*Root:\s*"?[^"\r\n]+"?/i.test(rawLine)) count++;
  }
  return count;
}

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

  // 1. Knowledge items count in canonical kNNowledge/
  const knowledgeDir = path.join(workspaceDir, 'kNNowledge');
  let knowledgeItems = [];
  if (fs.existsSync(knowledgeDir)) {
    try {
      knowledgeItems = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith('.md') && !f.startsWith('.'));
    } catch {
      knowledgeItems = [];
    }
  }

  // 2. Pending sources count (unnormalized raw files or hash mismatches)
  let pendingCount = 0;
  /** @type {{ total: number, normalized: number, unnormalized: number } | undefined} */
  let sourceSummary;
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

  // 3. Procedures count
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
    const countMd = (dir) =>
      fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('.')).length : 0;
    try {
      for (const bp of fs.readdirSync(specDir, { withFileTypes: true })) {
        if (!bp.isDirectory()) continue;
        const bpDir = path.join(specDir, bp.name);
        blueprintProceduresCount += countMd(path.join(bpDir, 'procedures'));
        for (const sub of fs.readdirSync(bpDir, { withFileTypes: true })) {
          if (sub.isDirectory() && /^V_\d+-\d+-\d+$/.test(sub.name)) {
            blueprintProceduresCount += countMd(path.join(bpDir, sub.name, 'procedures'));
          }
        }
      }
    } catch {
      blueprintProceduresCount = 0;
    }
  }

  // 4. Preflight check
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
    watch_roots: {
      declared: countWatchRoots(workspaceDir),
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
      console.log(`Watch roots: ${result.watch_roots.declared}`);
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
