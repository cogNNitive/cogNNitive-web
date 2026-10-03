const {
  applyGc,
  collectFamilies,
  parseCitation,
  planGc,
  projectLineage,
  readLineageSnapshot,
} = require('./innfo-core.generated.cjs');
const { collectCitationSites } = require('./impact-checker');

const toPosix = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '');

/**
 * Every workspace file some citation site points at. The sites come from the
 * projection (kNNowledge bodies, artifact frontmatter, console meta, and the
 * sidecars that declare upstream). A cited sidecar counts for its subject inside
 * core `planGc`.
 *
 * @param {string} projectDir
 * @returns {Set<string>}
 */
function citedPaths(projectDir) {
  const snapshot = readLineageSnapshot(projectDir);
  const projection = projectLineage(snapshot);
  const cited = new Set();
  for (const site of collectCitationSites(snapshot, projection)) {
    // An unparseable citation still names a path: keep it rather than risk deleting a cited file.
    const parsed = parseCitation(site.value);
    cited.add(toPosix(parsed ? parsed.filePath : String(site.value).split('@')[0].trim()));
  }
  return cited;
}

/**
 * Dry run: the non-latest, uncited members of every write-once family. Nothing
 * is written or deleted.
 *
 * @param {string} projectDir
 * @returns {Promise<{ candidates: string[] }>}
 */
async function planProjectGc(projectDir) {
  return planGc({ families: await collectFamilies(projectDir), citedPaths: citedPaths(projectDir) });
}

/**
 * Deletes the intersection of the user-confirmed list and a plan recomputed now
 * (a member cited since the proposal survives), each with its sidecar.
 *
 * @param {string} projectDir
 * @param {string[]} confirmed
 * @returns {Promise<{ deleted: string[], kept: string[] }>} \`kept\`: confirmed paths that were not in the plan
 */
async function applyProjectGc(projectDir, confirmed) {
  const paths = confirmed.map(toPosix);
  const { deleted } = await applyGc(projectDir, paths, { citedPaths: () => citedPaths(projectDir) });
  return { deleted, kept: paths.filter((p) => !deleted.includes(p)) };
}

/** `--paths a,b` and repeated `--paths a --paths b` both yield a flat list. */
function parsePathsArg(value) {
  const parts = Array.isArray(value) ? value : [value];
  return parts
    .filter((v) => typeof v === 'string')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

module.exports = { citedPaths, planProjectGc, applyProjectGc, parsePathsArg };
