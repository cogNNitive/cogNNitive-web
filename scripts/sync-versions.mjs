#!/usr/bin/env node

/**
 * scripts/sync-versions.mjs
 *
 * Single Source of Truth synchronization and drift validation for:
 *   - Template versions (spec_NN.md -> samples.ts & manifest/source.yaml)
 *   - Skill versions (skills/<name>/SKILL.md -> manifest/source.yaml)
 *   - MCP package version (innfo-mcp/package.json -> source.yaml, innfo-core, dep range)
 *
 * Usage:
 *   node scripts/sync-versions.mjs          # writes all generated targets
 *   node scripts/sync-versions.mjs --check  # verifies zero drift (exit 1 on drift)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_TEMPLATES_DIR = path.join(REPO_ROOT, 'iNNfo', 'specs', 'bluepriNNts');
const DEFAULT_SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const DEFAULT_SAMPLES_TS_PATH = path.join(
  REPO_ROOT, 'iNNfo', 'apps', 'innfo-editor', 'src', 'config', 'samples.ts'
);
const DEFAULT_SOURCE_YAML_PATH = path.join(REPO_ROOT, 'manifest', 'source.yaml');
const DEFAULT_MCP_PKG_PATH = path.join(REPO_ROOT, 'iNNfo', 'packages', 'innfo-mcp', 'package.json');
const DEFAULT_CORE_PKG_PATH = path.join(REPO_ROOT, 'iNNfo', 'packages', 'innfo-core', 'package.json');

const GENERATED_HEADER = [
  '// GENERATED — DO NOT EDIT. Source: iNNfo/specs/bluepriNNts/*/spec_NN.md and',
  '// iNNfo/specs/bluepriNNts/workspace_spec_NN.md.',
  '// Regenerate with `npm run sync:versions` (scripts/sync-versions.mjs).',
].join('\n');

const FRONTMATTER_VERSION_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const TEMPLATE_VERSION_RE = /^template_version:\s*"?([^"\r\n]+?)"?\s*$/m;
const SPEC_VERSION_RE = /^spec_version:\s*"?([^"\r\n]+?)"?\s*$/m;
const SKILL_VERSION_RE = /^version:\s*"?([^"\r\n]+?)"?\s*$/m;

/**
 * Reads a version field from a file's YAML frontmatter.
 * Returns undefined if no parseable frontmatter or matching field.
 */
function readFrontmatterVersion(filePath, fieldRe) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fmMatch = content.match(FRONTMATTER_VERSION_RE);
  if (!fmMatch) return undefined;
  const versionMatch = fmMatch[1].match(fieldRe);
  return versionMatch ? versionMatch[1].trim() : undefined;
}

/** Reads `template_version` -- the template's OWN version. */
function readTemplateVersion(filePath) {
  return readFrontmatterVersion(filePath, TEMPLATE_VERSION_RE);
}

/**
 * Reads `spec_version` -- the Level-1 iNNfo meta-spec the template conforms to.
 */
function readSpecVersion(filePath) {
  return readFrontmatterVersion(filePath, SPEC_VERSION_RE);
}

/**
 * Walks `templatesDir` for `<slug>/spec_NN.md` files plus the root
 * `workspace_spec_NN.md`, returning a map of slug -> template_version.
 * @param {string} templatesDir
 * @param {(filePath: string) => string | undefined} read
 * @returns {Record<string, string>}
 */
function collectVersions(templatesDir, read) {
  /** @type {Record<string, string>} */
  const versions = {};
  if (!fs.existsSync(templatesDir)) return versions;

  const workspaceSpecPath = path.join(templatesDir, 'workspace_spec_NN.md');
  if (fs.existsSync(workspaceSpecPath)) {
    const v = read(workspaceSpecPath);
    if (v) versions.workspace = v;
  }

  const entries = fs.readdirSync(templatesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const specPath = path.join(templatesDir, entry.name, 'spec_NN.md');
    if (!fs.existsSync(specPath)) continue;
    const v = read(specPath);
    if (v) versions[entry.name] = v;
  }

  return versions;
}

export function collectTemplateVersions(templatesDir = DEFAULT_TEMPLATES_DIR) {
  return collectVersions(templatesDir, readTemplateVersion);
}

export function collectSpecVersions(templatesDir = DEFAULT_TEMPLATES_DIR) {
  return collectVersions(templatesDir, readSpecVersion);
}

/**
 * Collects frontmatter `version` from each `SKILL.md` under `skillsDir`.
 * @param {string} [skillsDir]
 * @returns {Record<string, string>} map of skillName -> version.
 */
export function collectSkillVersions(skillsDir = DEFAULT_SKILLS_DIR) {
  /** @type {Record<string, string>} */
  const versions = {};
  if (!fs.existsSync(skillsDir)) return versions;

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    const v = readFrontmatterVersion(skillPath, SKILL_VERSION_RE);
    if (!v) {
      throw new Error(`SKILL.md in ${skillPath} has no parseable frontmatter version`);
    }
    versions[entry.name] = v;
  }

  return versions;
}

export function readMcpPackageVersion(mcpPkgPath = DEFAULT_MCP_PKG_PATH) {
  if (!fs.existsSync(mcpPkgPath)) return undefined;
  const content = fs.readFileSync(mcpPkgPath, 'utf8');
  const pkg = JSON.parse(content);
  return pkg.version ? String(pkg.version).trim() : undefined;
}

function renderSamplesObjectBody(versions) {
  const slugs = Object.keys(versions)
    .filter((slug) => slug !== 'workspace')
    .sort();
  return slugs.map((slug) => {
    const key = /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(slug) && !slug.includes('-')
      ? slug
      : `'${slug}'`;
    return `  ${key}: '${versions[slug]}',`;
  }).join('\n');
}

const SAMPLES_BLOCK_RE = /export const SHIPPED_TEMPLATE_VERSIONS: Record<string, string> = \{[\s\S]*?\n\}/;

function syncSamplesTs({ versions, samplesTsPath, check }) {
  if (!fs.existsSync(samplesTsPath)) {
    return { ok: false, error: `Missing samples.ts file: ${samplesTsPath}` };
  }

  const current = fs.readFileSync(samplesTsPath, 'utf8');
  if (!SAMPLES_BLOCK_RE.test(current)) {
    return { ok: false, error: `Could not find SHIPPED_TEMPLATE_VERSIONS block in ${samplesTsPath}` };
  }

  const body = renderSamplesObjectBody(versions);
  const replacement = `${GENERATED_HEADER}\nexport const SHIPPED_TEMPLATE_VERSIONS: Record<string, string> = {\n${body}\n}`;
  const updated = current.replace(new RegExp(`(?:${GENERATED_HEADER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n)?${SAMPLES_BLOCK_RE.source}`), replacement);

  if (check) {
    if (updated !== current) {
      return {
        ok: false,
        drift: true,
      };
    }
    return { ok: true };
  }

  if (updated !== current) {
    fs.writeFileSync(samplesTsPath, updated, 'utf8');
  }
  return { ok: true, changed: updated !== current };
}

function syncSourceYaml({ sectionMaps, sourceYamlPath, check }) {
  if (!fs.existsSync(sourceYamlPath)) {
    return { ok: false, error: `Missing manifest source file: ${sourceYamlPath}` };
  }

  const current = fs.readFileSync(sourceYamlPath, 'utf8');
  const lines = current.split('\n');

  let currentSection = null;
  let currentSlug = null;
  const perSlugDrift = [];

  const updatedLines = lines.map((line) => {
    if (/^\S/.test(line)) {
      const match = line.match(/^(\S+):/);
      const secName = match ? match[1] : null;
      if (secName && /^(blueprints|frozen_blueprints|skills)$/.test(secName)) {
        currentSection = secName;
      } else {
        currentSection = null;
      }
      currentSlug = null;
      return line;
    }

    if (!currentSection) return line;

    const nameMatch = line.match(/^\s*- name:\s*(\S+)\s*$/);
    if (nameMatch) {
      currentSlug = nameMatch[1];
      return line;
    }

    const versionMatch = line.match(/^(\s*version:\s*)"([^"]*)"\s*$/);
    if (versionMatch && currentSlug && currentSection && sectionMaps[currentSection] && sectionMaps[currentSection][currentSlug] !== undefined) {
      const expected = sectionMaps[currentSection][currentSlug];
      if (versionMatch[2] !== expected) {
        perSlugDrift.push({ section: currentSection, slug: currentSlug, expected, actual: versionMatch[2] });
      }
      return `${versionMatch[1]}"${expected}"`;
    }

    return line;
  });

  if (check) {
    if (perSlugDrift.length > 0) {
      return { ok: false, drift: perSlugDrift };
    }
    return { ok: true };
  }

  const updated = updatedLines.join('\n');
  if (updated !== current) {
    fs.writeFileSync(sourceYamlPath, updated, 'utf8');
  }
  return { ok: true, changed: updated !== current };
}

function syncCorePkg({ mcpVersion, corePkgPath, check }) {
  if (!fs.existsSync(corePkgPath)) {
    return { ok: false, error: `Missing core package.json: ${corePkgPath}` };
  }
  const content = fs.readFileSync(corePkgPath, 'utf8');
  let currentVersion;
  try {
    const pkg = JSON.parse(content);
    currentVersion = pkg.version;
  } catch (err) {
    return { ok: false, error: `Failed to parse ${corePkgPath}: ${err.message}` };
  }

  const updated = content.replace(
    /^(\s*"version":\s*)"[^"]*"(,?)$/m,
    `$1"${mcpVersion}"$2`,
  );

  if (check) {
    if (currentVersion !== mcpVersion || updated !== content) {
      return { ok: false, drift: { expected: mcpVersion, actual: currentVersion } };
    }
    return { ok: true };
  }

  if (updated !== content) {
    fs.writeFileSync(corePkgPath, updated, 'utf8');
  }
  return { ok: true, changed: updated !== content };
}

function syncMcpDepRange({ mcpVersion, mcpPkgPath, check }) {
  if (!fs.existsSync(mcpPkgPath)) {
    return { ok: false, error: `Missing mcp package.json: ${mcpPkgPath}` };
  }
  const content = fs.readFileSync(mcpPkgPath, 'utf8');
  let currentDep;
  try {
    const pkg = JSON.parse(content);
    currentDep = pkg.dependencies && pkg.dependencies['@cognnitive/innfo-core'];
  } catch (err) {
    return { ok: false, error: `Failed to parse ${mcpPkgPath}: ${err.message}` };
  }

  const expectedDep = `^${mcpVersion}`;
  const updated = content.replace(
    /^(\s*"@cognnitive\/innfo-core":\s*)"[^"]*"(,?)$/m,
    `$1"${expectedDep}"$2`,
  );

  if (check) {
    if (currentDep !== expectedDep || updated !== content) {
      return { ok: false, drift: { expected: expectedDep, actual: currentDep } };
    }
    return { ok: true };
  }

  if (updated !== content) {
    fs.writeFileSync(mcpPkgPath, updated, 'utf8');
  }
  return { ok: true, changed: updated !== content };
}

export function syncVersions({
  check = false,
  templatesDir = DEFAULT_TEMPLATES_DIR,
  skillsDir = DEFAULT_SKILLS_DIR,
  samplesTsPath = DEFAULT_SAMPLES_TS_PATH,
  sourceYamlPath = DEFAULT_SOURCE_YAML_PATH,
  mcpPkgPath = DEFAULT_MCP_PKG_PATH,
  corePkgPath = DEFAULT_CORE_PKG_PATH,
} = {}) {
  const versions = collectTemplateVersions(templatesDir);
  const specVersions = collectSpecVersions(templatesDir);
  /** @type {Record<string, string>} */
  let skillVersions = {};
  const errors = [];

  try {
    skillVersions = collectSkillVersions(skillsDir);
  } catch (err) {
    errors.push(err.message);
  }

  const mcpVersion = readMcpPackageVersion(mcpPkgPath);
  if (mcpVersion) {
    skillVersions['innfo-mcp'] = mcpVersion;
  }

  const samplesResult = syncSamplesTs({ versions, samplesTsPath, check });
  if (!samplesResult.ok) {
    if (samplesResult.drift) {
      errors.push(
        `SHIPPED_TEMPLATE_VERSIONS in ${samplesTsPath} is stale. ` +
        `Run \`npm run sync:versions\` to regenerate it.`
      );
    } else {
      errors.push(samplesResult.error);
    }
  }

  const sectionMaps = {
    blueprints: specVersions,
    frozen_blueprints: specVersions,
    skills: skillVersions,
  };

  const sourceResult = syncSourceYaml({ sectionMaps, sourceYamlPath, check });
  if (!sourceResult.ok) {
    if (sourceResult.drift) {
      for (const d of sourceResult.drift) {
        errors.push(
          `${d.section} entry '${d.slug}' version drift in ${sourceYamlPath}: ` +
          `expected "${d.expected}", found "${d.actual}". ` +
          `Run \`npm run sync:versions\` to fix it.`
        );
      }
    } else {
      errors.push(sourceResult.error);
    }
  }

  if (mcpVersion && fs.existsSync(corePkgPath)) {
    const coreResult = syncCorePkg({ mcpVersion, corePkgPath, check });
    if (!coreResult.ok) {
      if (coreResult.drift) {
        errors.push(
          `innfo-core package.json version drift in ${corePkgPath}: ` +
          `expected "${coreResult.drift.expected}" (from innfo-mcp), found "${coreResult.drift.actual}". ` +
          `Run \`npm run sync:versions\` to fix it.`
        );
      } else {
        errors.push(coreResult.error);
      }
    }
  }

  if (mcpVersion && fs.existsSync(mcpPkgPath)) {
    const depResult = syncMcpDepRange({ mcpVersion, mcpPkgPath, check });
    if (!depResult.ok) {
      if (depResult.drift) {
        errors.push(
          `innfo-mcp dependency @cognnitive/innfo-core drift in ${mcpPkgPath}: ` +
          `expected "${depResult.drift.expected}", found "${depResult.drift.actual}". ` +
          `Run \`npm run sync:versions\` to fix it.`
        );
      } else {
        errors.push(depResult.error);
      }
    }
  }

  return { ok: errors.length === 0, errors, versions, skillVersions };
}

// Backward-compatibility alias
export const syncTemplateVersions = syncVersions;

// Direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const isCheck = process.argv.includes('--check');

  if (isCheck) {
    console.log('🔍 Checking version parity (specs & skills & mcp <-> samples.ts <-> manifest/source.yaml)...');
    const res = syncVersions({ check: true });
    if (!res.ok) {
      console.error('❌ Version drift detected:');
      for (const err of res.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    console.log('✅ All versions are in sync.');
  } else {
    console.log('📦 Syncing versions from specs & skills & mcp into samples.ts, manifest/source.yaml, and packages...');
    const res = syncVersions({ check: false });
    if (!res.ok) {
      console.error('❌ Failed to sync versions:');
      for (const err of res.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    console.log('🎉 Successfully synchronized all versions.');
  }
}
