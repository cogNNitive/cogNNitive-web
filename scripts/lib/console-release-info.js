/**
 * scripts/lib/console-release-info.js
 *
 * Single source of truth for the innfo-console release identity (bundle
 * version + CDN pin), derived from `manifest/source.yaml` instead of
 * duplicated as hardcoded literals.
 */

const fs = require('fs');
const path = require('path');
const { parseFocusedYaml } = require('./yaml-parser.js');
const { resolveChannelRefs } = require('./channel-refs.js');

/**
 * @param {string} repoRoot
 * @returns {{ version: string, cdnRef: string, cdnUrl: string }}
 */
function getConsoleReleaseInfo(repoRoot = process.cwd()) {
  const sourcePath = path.join(repoRoot, 'manifest', 'source.yaml');
  const source = parseFocusedYaml(fs.readFileSync(sourcePath, 'utf8'));

  const consoleAssets = Array.isArray(source.console_assets) ? source.console_assets : [];
  const asset = consoleAssets.find((a) => a && a.name === 'innfo-console');
  if (!asset || !asset.version) {
    throw new Error(
      `manifest/source.yaml: missing console_assets entry for "innfo-console" at ${sourcePath}`,
    );
  }
  const version = String(asset.version);

  let stableRefs = [];
  try {
    stableRefs = resolveChannelRefs(source, 'stable');
  } catch (err) {
    throw new Error(`manifest/source.yaml: ${err.message} at ${sourcePath}`);
  }

  const ref = stableRefs.find((r) => r && r.key === 'innfo-console');
  if (!ref || !ref.ref) {
    throw new Error(
      `manifest/source.yaml: missing channels.stable.refs entry keyed "innfo-console" at ${sourcePath}`,
    );
  }
  const repoSlug = ref.repo || 'cogNNitive/cogNNitive';
  const cdnUrl = `https://cdn.jsdelivr.net/gh/${repoSlug}@${ref.ref}/iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js`;

  return { version, cdnRef: ref.ref, cdnUrl };
}

module.exports = { getConsoleReleaseInfo };
