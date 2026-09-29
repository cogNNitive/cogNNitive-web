/**
 * scripts/manifest/lib/manifest-rules.js
 *
 * Domain validation rules for the agent-bootstrap manifest.
 * Enforces structural integrity, git ref & release provenance policies,
 * repository commit existence, path content presence, and dependency closures.
 *
 * Zero external dependencies — native Node.js execution.
 */

const { parseFocusedYaml, parseFrontmatter } = require('../../lib/yaml-parser.js');
const {
  apiRequest,
  fetchString,
  resolveRef,
  rateLimited,
  RATE_LIMIT_HINT,
} = require('../../lib/github-client.js');

const COMMIT_RE = /^[0-9a-f]{40}$/i;
const TAG_SHAPE_RE = /^[a-z][a-z0-9-]*-v\d+\.\d+\.\d+$/;

/**
 * Channel policy — data, not branching. Adding a channel is adding a table row.
 * @type {Record<string, {
 *   name: string,
 *   file: string,
 *   requiredRefKind: 'tag' | 'branch',
 *   requireTagShape: boolean,
 *   requireProvenance: boolean,
 * }>}
 */
const CHANNELS = {
  stable: {
    name: 'stable',
    file: 'docs/use/manifest.md',
    requiredRefKind: 'tag',
    requireTagShape: true,
    requireProvenance: true,
  },
  preview: {
    name: 'preview',
    file: 'docs/use/manifest-next.md',
    requiredRefKind: 'branch',
    requireTagShape: false,
    requireProvenance: false,
  },
};

/**
 * Checks if a tag shape conforms to repository snapshot conventions (e.g. 'skills-v1.0.0').
 * @param {{ name: string, ref?: string }} entry
 * @returns {string | null}
 */
function tagShapeViolation(entry) {
  if (!TAG_SHAPE_RE.test(entry.ref || '')) {
    return `${entry.name}: ref '${entry.ref}' does not match the repo-snapshot tag shape (expected e.g. 'skills-v1.0.0')`;
  }
  return null;
}

/**
 * Validates resolved ref kind against channel policy requirements.
 * @param {{ name: string, ref?: string }} entry
 * @param {'tag' | 'branch' | null} resolvedKind
 * @param {{ name: string, requiredRefKind: string }} policy
 * @returns {string | null}
 */
function refKindViolation(entry, resolvedKind, policy) {
  if (resolvedKind && resolvedKind !== policy.requiredRefKind) {
    return `${entry.name}: ref '${entry.ref}' resolves as a ${resolvedKind}, but the ${policy.name} channel requires a ${policy.requiredRefKind}`;
  }
  return null;
}

/**
 * Checks release provenance verifying commit reachability from main.
 * @param {string} repo
 * @param {string} commit
 * @returns {Promise<string | null>}
 */
async function checkReleaseProvenance(repo, commit) {
  const res = await apiRequest(`https://api.github.com/repos/${repo}/compare/main...${commit}`);
  if (res.status === 200 && res.data && res.data.status) {
    if (res.data.status === 'identical' || res.data.status === 'behind') return null;
    return `commit ${commit} in ${repo} is not reachable from main (compare status: '${res.data.status}') — orphan or unmerged tip cannot ship on the stable channel`;
  }
  if (rateLimited(res.status)) {
    return `rate limit hit checking release provenance for ${commit} in ${repo} (HTTP ${res.status}); ${RATE_LIMIT_HINT}`;
  }
  return `could not verify release provenance for ${commit} in ${repo} (HTTP ${res.status || res.error || 'network error'})`;
}

/**
 * Checks whether a ref resolves to the expected commit SHA in the declared repo.
 * @param {{ name: string, repo: string, ref: string, commit: string }} item
 * @returns {Promise<{ violation: string | null, kind: 'tag' | 'branch' | null }>}
 */
async function checkRefResolvesInDeclaredRepo(item) {
  const resolved = await resolveRef(item.repo, item.ref);
  if ('error' in resolved) return { violation: `${item.name}: ${resolved.error}`, kind: null };
  if (resolved.sha !== item.commit) {
    return {
      violation: `${item.name}: ref '${item.ref}' resolves to ${resolved.sha} in ${item.repo}, but manifest pins commit ${item.commit} (mismatch)`,
      kind: resolved.kind,
    };
  }
  return { violation: null, kind: resolved.kind };
}

/**
 * Evaluates release provenance and git ref constraints for a manifest entry against channel policy.
 * @param {{ name: string, repo: string, ref: string, commit: string }} item
 * @param {typeof CHANNELS[string]} policy
 * @returns {Promise<string[]>}
 */
async function checkReleaseAndRefPolicy(item, policy) {
  const violations = [];

  const { violation: refViolation, kind: resolvedKind } = await checkRefResolvesInDeclaredRepo(item);
  if (refViolation) violations.push(refViolation);

  const kindViolation = refKindViolation(item, resolvedKind, policy);
  if (kindViolation) violations.push(kindViolation);

  if (policy.requireTagShape) {
    const shapeViolation = tagShapeViolation(item);
    if (shapeViolation) violations.push(shapeViolation);
  }

  if (policy.requireProvenance) {
    const provenanceViolation = await checkReleaseProvenance(item.repo, item.commit);
    if (provenanceViolation) violations.push(`${item.name}: ${provenanceViolation}`);
  }

  return violations;
}

/**
 * Validates presence of required fields and commit SHA formatting.
 * @param {Record<string, any>} item
 * @returns {string[]}
 */
function structuralViolations(item) {
  const violations = [];
  for (const field of ['name', 'repo', 'path', 'version', 'ref', 'commit']) {
    if (!item[field]) violations.push(`${item.name || '(unnamed item)'}: missing field '${field}'`);
  }
  if (item.commit && !COMMIT_RE.test(item.commit)) {
    violations.push(`${item.name}: commit '${item.commit}' is not a 40-char hex sha`);
  }
  return violations;
}

/**
 * Checks if the pinned commit exists in declared repository.
 * @param {{ name: string, repo: string, commit: string }} item
 * @returns {Promise<string | null>}
 */
async function checkCommitExists(item) {
  const res = await apiRequest(`https://api.github.com/repos/${item.repo}/commits/${item.commit}`);
  if (res.status === 200) return null;
  if (rateLimited(res.status)) {
    return `${item.name}: GitHub API rate limit hit (HTTP ${res.status}) while checking commit; ${RATE_LIMIT_HINT}.`;
  }
  if (res.status === 422) {
    // GitHub returns 422 when the SHA is well-formed but does not resolve within
    // this repo — the signature of a commit that belongs to a different repo in
    // the same fork network.
    return `${item.name}: commit ${item.commit} does not belong to declared repo ${item.repo} (HTTP 422 — wrong repo)`;
  }
  return `${item.name}: commit ${item.commit} does not exist in ${item.repo} (HTTP ${res.status || res.error || 'network error'})`;
}

/**
 * Checks if SKILL.md exists in repo at path for the given commit.
 * @param {{ name: string, repo: string, path: string, commit: string }} skill
 * @returns {Promise<string | null>}
 */
async function checkPathAtCommit(skill) {
  const url = `https://api.github.com/repos/${skill.repo}/contents/${skill.path}?ref=${skill.commit}`;
  const res = await apiRequest(url);
  if (res.status === 200) {
    if (Array.isArray(res.data) && res.data.some(entry => entry.name === 'SKILL.md')) return null;
    return `${skill.name}: ${skill.path} at ${skill.commit} has no SKILL.md entry`;
  }
  if (rateLimited(res.status)) {
    return `${skill.name}: GitHub API rate limit hit (HTTP ${res.status}) while checking path; ${RATE_LIMIT_HINT}.`;
  }
  return `${skill.name}: path ${skill.path} not found at ${skill.commit} (HTTP ${res.status || res.error || 'network error'})`;
}

/**
 * Verifies version parity between manifest and remote SKILL.md frontmatter.
 * @param {{ name: string, repo: string, path: string, commit: string, version: string }} skill
 * @returns {Promise<string | { bundled_templates: any[] }>}
 */
async function checkVersionParity(skill) {
  const url = `https://raw.githubusercontent.com/${skill.repo}/${skill.commit}/${skill.path}/SKILL.md`;
  let text;
  try {
    text = await fetchString(url);
  } catch (err) {
    return `${skill.name}: could not fetch SKILL.md at ${skill.commit} (${err.message})`;
  }
  const meta = parseFocusedYaml(parseFrontmatter(text));
  const declared = meta.version !== undefined ? meta.version : (meta.metadata && meta.metadata.version);
  if (declared === undefined || declared === null) {
    return `${skill.name}: SKILL.md at ${skill.commit} declares no version`;
  }
  if (String(declared) !== String(skill.version)) {
    return `${skill.name}: version mismatch — manifest '${skill.version}' vs SKILL.md '${declared}'`;
  }
  return { bundled_templates: meta.bundled_templates || [] };
}

/**
 * Strips a leading UTF-8 BOM and converts CRLF to LF. Zero dependencies.
 * @param {string} text
 * @returns {string}
 */
function normalizeTemplateText(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

/**
 * Builds a fetch-failure violation for one side of the pin<->main comparison,
 * appending RATE_LIMIT_HINT when the error carries a rate-limit status.
 * @param {{ name: string, path: string }} template
 * @param {string} revision - 'main' or the pinned commit.
 * @param {string} message - The underlying error message.
 * @returns {string}
 */
function coherenceFetchViolation(template, revision, message) {
  let violation = `${template.name}: could not fetch ${template.path} at ${revision} (${message})`;
  if (/status:\s*(403|429)/.test(message)) violation += `; ${RATE_LIMIT_HINT}`;
  return violation;
}

/**
 * Compares a template's content at its pinned commit with the same path on main.
 * Coherence means the normalized texts are equal; drift in either direction and
 * fetch failures become violations — the rule never throws (fail closed).
 * @param {{ name: string, repo: string, path: string, commit: string, ref?: string }} template
 * @returns {Promise<string[]>} empty array = pinned content is coherent with main
 */
async function checkTemplateMainCoherence(template) {
  const violations = [];
  const pinUrl = `https://raw.githubusercontent.com/${template.repo}/${template.commit}/${template.path}`;
  const mainUrl = `https://raw.githubusercontent.com/${template.repo}/main/${template.path}`;

  let pinnedText = null;
  try {
    pinnedText = await fetchString(pinUrl);
  } catch (err) {
    violations.push(coherenceFetchViolation(template, template.commit, err.message));
  }

  let mainText = null;
  try {
    mainText = await fetchString(mainUrl);
  } catch (err) {
    violations.push(coherenceFetchViolation(template, 'main', err.message));
  }

  if (pinnedText !== null && mainText !== null &&
      normalizeTemplateText(pinnedText) !== normalizeTemplateText(mainText)) {
    violations.push(
      `${template.name}: content at ${template.path} differs between pinned commit ${template.commit} and main in ${template.repo} — pin is not coherent with main (reconcile the release with main before shipping)`
    );
  }

  return violations;
}

/**
 * Checks that an MCP bundle URL is pinned to its commit SHA rather than floating on main.
 * @param {{ name: string, commit?: string, url?: string }} entry
 * @returns {Promise<string | null>}
 */
async function checkMcpUrlPinned(entry) {
  if (!entry.commit || !COMMIT_RE.test(entry.commit)) return null; // structural check already caught this
  if (/\/main\//.test(entry.url || '')) {
    return `${entry.name}: mcp url references a branch ('/main/') instead of a pinned commit`;
  }
  if (!entry.url || !entry.url.includes(`/${entry.commit}/`)) {
    return `${entry.name}: mcp url is not pinned to its resolved commit (expected to contain '/${entry.commit}/')`;
  }
  return null;
}

/**
 * Validates an MCP server bundle entry against structural, existence, and channel policies.
 * @param {{ name: string, repo: string, path: string, version: string, ref: string, commit: string, url?: string }} entry
 * @param {typeof CHANNELS[string]} policy
 * @returns {Promise<string[]>}
 */
async function validateMcp(entry, policy) {
  const violations = structuralViolations(entry);
  if (violations.length > 0) return violations;

  const commitViolation = await checkCommitExists(entry);
  if (commitViolation) violations.push(commitViolation);

  violations.push(...await checkReleaseAndRefPolicy(entry, policy));

  const urlViolation = await checkMcpUrlPinned(entry);
  if (urlViolation) violations.push(urlViolation);

  const url = `https://api.github.com/repos/${entry.repo}/contents/${entry.path}?ref=${entry.commit}`;
  const res = await apiRequest(url);
  if (res.status !== 200) {
    if (rateLimited(res.status)) {
      violations.push(`${entry.name}: GitHub API rate limit hit (HTTP ${res.status}) while checking path; ${RATE_LIMIT_HINT}.`);
    } else {
      violations.push(`${entry.name}: path ${entry.path} not found at ${entry.commit} (HTTP ${res.status || res.error || 'network error'})`);
    }
  }

  return violations;
}

/**
 * Validates a console asset bundle entry (innfo-console.bundle.js) against
 * structural, existence, and channel policies. Mirrors validateMcp: the asset
 * is a committed JS bundle pinned by commit + version + ref.
 * @param {{ file: string, repo: string, version: string, ref: string, commit: string, url?: string, path?: string }} entry
 * @param {typeof CHANNELS[string]} policy
 * @returns {Promise<string[]>}
 */
async function validateConsoleAsset(entry, policy) {
  // Normalize the console-assets shape (file/url) to the structural entry shape
  // (name/repo/path) so structuralViolations and the shared checks apply.
  const normalized = {
    name: String(entry.file || entry.url || '').split('/').pop() || 'console-asset',
    repo: entry.repo || 'cogNNitive/cogNNitive',
    path: entry.file || entry.path,
    version: entry.version,
    ref: entry.ref,
    commit: entry.commit,
    url: entry.url,
  };
  const violations = structuralViolations(normalized);
  if (violations.length > 0) return violations;

  const commitViolation = await checkCommitExists(normalized);
  if (commitViolation) violations.push(commitViolation);

  violations.push(...await checkReleaseAndRefPolicy(normalized, policy));

  if (normalized.url) {
    const urlViolation = await checkMcpUrlPinned(normalized);
    if (urlViolation) violations.push(urlViolation);
  }

  const url = `https://api.github.com/repos/${normalized.repo}/contents/${normalized.path}?ref=${normalized.commit}`;
  const res = await apiRequest(url);
  if (res.status !== 200) {
    if (rateLimited(res.status)) {
      violations.push(`${normalized.path}: GitHub API rate limit hit (HTTP ${res.status}) while checking path; ${RATE_LIMIT_HINT}.`);
    } else {
      violations.push(`${normalized.path}: path ${normalized.path} not found at ${normalized.commit} (HTTP ${res.status || res.error || 'network error'})`);
    }
  }

  return violations;
}

/**
 * Validates a skill entry including structure, commit existence, ref policies, path, and version.
 * @param {{
 *   name: string,
 *   repo: string,
 *   path: string,
 *   version: string,
 *   ref: string,
 *   commit: string,
 *   mcp?: any[],
 *   requires?: string[],
 *   templates?: string[],
 * }} skill
 * @param {typeof CHANNELS[string]} policy
 * @returns {Promise<{ violations: string[], bundled_templates: any[] }>}
 */
async function validateSkill(skill, policy) {
  const violations = structuralViolations(skill);
  let bundled_templates = [];
  if (violations.length > 0) return { violations, bundled_templates };

  const commitViolation = await checkCommitExists(skill);
  if (commitViolation) violations.push(commitViolation);

  violations.push(...await checkReleaseAndRefPolicy(skill, policy));

  const pathViolation = await checkPathAtCommit(skill);
  if (pathViolation) violations.push(pathViolation);

  const versionResult = await checkVersionParity(skill);
  if (typeof versionResult === 'string') {
    violations.push(versionResult);
  } else if (versionResult && versionResult.bundled_templates) {
    bundled_templates = versionResult.bundled_templates;
  }

  for (const mcp of (skill.mcp || [])) {
    violations.push(...await validateMcp(mcp, policy));
  }

  return { violations, bundled_templates };
}

/**
 * Validates a template entry against manifest policy rules and remote repo content.
 * @param {{ name: string, repo: string, path: string, version: string, ref: string, commit: string }} template
 * @param {typeof CHANNELS[string]} policy
 * @returns {Promise<string[]>}
 */
async function validateTemplate(template, policy) {
  const violations = structuralViolations(template);
  if (violations.length > 0) return violations;

  const commitViolation = await checkCommitExists(template);
  if (commitViolation) violations.push(commitViolation);

  violations.push(...await checkReleaseAndRefPolicy(template, policy));

  const url = `https://api.github.com/repos/${template.repo}/contents/${template.path}?ref=${template.commit}`;
  const res = await apiRequest(url);
  if (res.status !== 200) {
    if (rateLimited(res.status)) {
      violations.push(`${template.name}: GitHub API rate limit hit (HTTP ${res.status}) while checking path; ${RATE_LIMIT_HINT}.`);
    } else {
      violations.push(`${template.name}: path ${template.path} not found at ${template.commit} (HTTP ${res.status || res.error || 'network error'})`);
    }
  }

  const rawUrl = `https://raw.githubusercontent.com/${template.repo}/${template.commit}/${template.path}`;
  try {
    const text = await fetchString(rawUrl);
    let declared = null;
    try {
      const meta = parseFocusedYaml(parseFrontmatter(text));
      declared = meta.version !== undefined ? meta.version : (meta.spec_version !== undefined ? meta.spec_version : (meta.metadata && meta.metadata.version));
    } catch {
      const versionMatch = text.match(/V_\d+-\d+-\d+/i) || text.match(/version:\s*["']?([^"'\r\n]+)/i);
      if (versionMatch) declared = versionMatch[1] || versionMatch[0];
    }
    if (declared === undefined || declared === null) {
      violations.push(`${template.name}: template at ${template.commit} declares no version`);
    } else if (String(declared) !== String(template.version)) {
      violations.push(`${template.name}: version mismatch — manifest '${template.version}' vs template '${declared}'`);
    }
  } catch (err) {
    violations.push(`${template.name}: could not fetch template at ${template.commit} (${err.message})`);
  }

  // Stable-channel templates must stay coherent with main: the content pinned by
  // the release must equal the content at the same path on main (normalized).
  // preview pins main and is gated out by requireProvenance === false.
  if (policy.requireProvenance) {
    violations.push(...await checkTemplateMainCoherence(template));
  }

  return violations;
}

/**
 * Checks skill dependency closure (requires) and blueprint closure across skills and workflows.
 * @param {{
 *   skills?: any[],
 *   blueprints?: any[],
 *   workflows?: any[],
 * }} manifestData
 * @param {Iterable<string>} [bundledBlueprintNames=[]]
 * @returns {string[]}
 */
function checkClosureViolations(manifestData, bundledBlueprintNames = []) {
  const { skills = [], blueprints = [], workflows = [] } = manifestData;
  const violations = [];
  const knownSkills = new Set(skills.map(s => s.name));
  const knownBlueprints = new Set([...blueprints.map(t => t.name), ...bundledBlueprintNames]);

  // Skill dependency closure (requires)
  for (const skill of skills) {
    for (const req of (skill.requires || [])) {
      if (!knownSkills.has(req)) {
        violations.push(`${skill.name}: requires '${req}' which is not in the manifest`);
      }
    }
    for (const bp of (skill.blueprints || [])) {
      if (!knownBlueprints.has(bp)) {
        violations.push(`${skill.name}: references blueprint '${bp}' which is not declared in top-level blueprints or bundled`);
      }
    }
  }

  // Workflow blueprint dependency closure
  for (const wf of workflows) {
    if (wf.blueprint && !knownBlueprints.has(wf.blueprint)) {
      violations.push(`workflow '${wf.id || wf.label}': references blueprint '${wf.blueprint}' which is not declared in top-level blueprints or bundled`);
    }
  }

  return violations;
}

/**
 * Validates all skills, blueprints, mcp entries, and dependency closures of a manifest against a policy.
 * @param {{
 *   version?: string,
 *   entrypoint?: string,
 *   skills?: any[],
 *   blueprints?: any[],
 *   workflows?: any[],
 *   mcp?: any[],
 *   consoleAssets?: any[],
 * }} manifestData
 * @param {typeof CHANNELS[string]} policy
 * @returns {Promise<{
 *   violations: string[],
 *   stats: { skillsCount: number, blueprintsCount: number, mcpCount: number, consoleCount: number },
 * }>}
 */
async function validateManifest(manifestData, policy) {
  const { skills = [], blueprints = [], workflows = [], mcp = [], consoleAssets = [] } = manifestData;
  const mcpCount = mcp.length + skills.reduce((n, s) => n + ((s.mcp || []).length), 0);
  const violations = [];
  const knownSkillBundledTemplates = new Set();

  for (const skill of skills) {
    const { violations: skillViolations, bundled_templates } = await validateSkill(skill, policy);
    violations.push(...skillViolations);
    for (const bt of bundled_templates) {
      const name = typeof bt === 'string' ? bt : (bt && bt.name);
      if (name) knownSkillBundledTemplates.add(name);
    }
  }

  for (const blueprint of blueprints) {
    violations.push(...await validateTemplate(blueprint, policy));
  }

  for (const mcpEntry of mcp) {
    violations.push(...await validateMcp(mcpEntry, policy));
  }

  for (const asset of consoleAssets) {
    violations.push(...await validateConsoleAsset(asset, policy));
  }

  const closureViolations = checkClosureViolations(manifestData, knownSkillBundledTemplates);
  violations.push(...closureViolations);

  return {
    violations,
    stats: {
      skillsCount: skills.length,
      blueprintsCount: blueprints.length,
      mcpCount,
      consoleCount: consoleAssets.length,
    },
  };
}

module.exports = {
  COMMIT_RE,
  TAG_SHAPE_RE,
  CHANNELS,
  tagShapeViolation,
  refKindViolation,
  checkReleaseProvenance,
  checkRefResolvesInDeclaredRepo,
  checkReleaseAndRefPolicy,
  structuralViolations,
  checkCommitExists,
  checkPathAtCommit,
  checkVersionParity,
  checkMcpUrlPinned,
  checkTemplateMainCoherence,
  validateMcp,
  validateConsoleAsset,
  validateSkill,
  validateTemplate,
  checkClosureViolations,
  validateManifest,
};
