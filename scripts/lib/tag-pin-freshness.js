/**
 * scripts/lib/tag-pin-freshness.js
 *
 * Deterministic, git-only guard for the "tag/pin freshness" failure mode
 * (expediente: 2026-09-24 — a skill directory rename plus `template_version`
 * bumps across ~15 `spec_NN.md` files under `iNNfo/specs/bluepriNNts/` were
 * merged `dev -> main` without cutting a new `skills-v*`/`blueprints-v*` tag
 * or re-pinning `manifest/source.yaml` in the same batch;
 * `validate-manifest.js --channel stable` failed on CI afterward).
 *
 * This check does NOT talk to GitHub and does NOT validate that a tag was
 * actually cut — it only enforces the local half: if a diff touches
 * anything under `skills/` or a canonical `spec_NN.md` file anywhere under
 * `iNNfo/specs/bluepriNNts/`, the same diff must also touch
 * `manifest/source.yaml`. Cutting the tag itself remains the maintainer's
 * job (see `nn-dev-release`).
 */

const { execSync } = require('node:child_process');

// Canonical blueprints ship as `<name>/spec_NN.md` (the literal filename —
// "NN" is not a numeric placeholder in this repo; see
// `iNNfo/specs/bluepriNNts/*/spec_NN.md` and `workspace_spec_NN.md` on disk).
const SKILLS_RE = /^skills\//;
const TEMPLATE_SPEC_RE = /^iNNfo\/specs\/bluepriNNts\/.*spec_NN\.md$/;
const MANIFEST_PATH = 'manifest/source.yaml';

/**
 * @param {string} repoRoot
 * @param {{ base?: string, head?: string }} [options]
 *   `base`/`head` default to `origin/main`/`HEAD`, which is the shape a
 *   manual pre-merge check wants while still checked out on `dev`
 *   (`origin/main...HEAD`). `nn-dev-development` §4e invokes this
 *   conceptually as `origin/main..origin/dev` when reviewing a batch from
 *   outside that checkout — pass those refs explicitly in that case.
 * @returns {{ ok: boolean, errors: string[], skipped?: boolean }}
 */
function checkTagPinFreshness(repoRoot = process.cwd(), { base = 'origin/main', head = 'HEAD' } = {}) {
  let out;
  try {
    out = execSync(`git diff --name-only ${base}...${head}`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // Ref doesn't resolve (shallow clone, fresh repo with no history, no
    // `origin` remote, etc.) — don't fail the whole gate over an
    // unresolvable diff range.
    return { ok: true, errors: [], skipped: true };
  }

  const changed = String(out)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const manifestTouched = changed.includes(MANIFEST_PATH);
  const skillsPaths = changed.filter((p) => SKILLS_RE.test(p));
  const templatePaths = changed.filter((p) => TEMPLATE_SPEC_RE.test(p));

  const errors = [];
  if (skillsPaths.length > 0 && !manifestTouched) {
    errors.push(
      `skills/ changed (${skillsPaths.length} path(s), e.g. ${skillsPaths
        .slice(0, 5)
        .join(', ')}) but ${MANIFEST_PATH} was not re-pinned in the same diff.`,
    );
  }
  if (templatePaths.length > 0 && !manifestTouched) {
    errors.push(
      `Template spec_NN.md changed (${templatePaths.length} path(s), e.g. ${templatePaths
        .slice(0, 5)
        .join(', ')}) but ${MANIFEST_PATH} was not re-pinned in the same diff.`,
    );
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { checkTagPinFreshness };
