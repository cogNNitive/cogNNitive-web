#!/usr/bin/env node

/**
 * scripts/manifest/check-parity.js
 *
 * Deterministic workspace parity guard.
 * Validates local workspace files (skills, templates, MCP) against manifest/source.yaml.
 * Ensures zero drift between working tree and manifest before tagging or deploying.
 *
 * Usage:
 *   node scripts/manifest/check-parity.js [repo-root]
 *
 * Zero dependencies. Requires Node >= 18. Strictly < 200 lines.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseFocusedYaml, parseFrontmatter } = require('../lib/yaml-parser.js');

/**
 * Validates workspace file versions against manifest/source.yaml.
 * @param {string} repoRoot
 * @returns {{ ok: boolean, errors: string[], stats: { skillsCount: number, blueprintsCount: number, mcpCount: number } }}
 */
function checkWorkspaceParity(repoRoot = process.cwd()) {
  const sourcePath = path.join(repoRoot, 'manifest', 'source.yaml');
  if (!fs.existsSync(sourcePath)) {
    return { ok: false, errors: [`manifest/source.yaml not found at ${sourcePath}`], stats: { skillsCount: 0, blueprintsCount: 0, mcpCount: 0 } };
  }

  const source = parseFocusedYaml(fs.readFileSync(sourcePath, 'utf8'));
  const errors = [];
  let skillsCount = 0;
  let blueprintsCount = 0;
  let mcpCount = 0;

  // 1. Check skills (presence only — version comparison dissolved in favor of sync-versions.mjs generator)
  for (const skill of (source.skills || [])) {
    skillsCount++;
    const skillMdPath = path.join(repoRoot, skill.path, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      errors.push(`Skill '${skill.name}': file not found at ${skillMdPath}`);
      continue;
    }

    // Check nested MCP if declared on skill (bundle file presence only)
    for (const mcp of (skill.mcp || [])) {
      mcpCount++;
      const bundlePath = path.join(repoRoot, mcp.path);
      if (!fs.existsSync(bundlePath)) {
        errors.push(`MCP '${mcp.name}': bundle file not found at ${bundlePath}`);
      }
    }

    // Check external_specs if declared on skill
    if (Array.isArray(skill.external_specs)) {
      let skillMeta = {};
      try {
        skillMeta = parseFocusedYaml(parseFrontmatter(fs.readFileSync(skillMdPath, 'utf8')));
      } catch {}
      for (const spec of skill.external_specs) {
        const pinKey = `${spec.name}_spec`;
        const localPin = skillMeta[pinKey];
        if (!localPin || String(localPin.version) !== String(spec.version) || String(localPin.sha256) !== String(spec.sha256)) {
          errors.push(`Skill '${skill.name}': external_spec '${spec.name}' mismatch between manifest and SKILL.md`);
        }
        if (!/^packages\/core\/specs\/V_\d+-\d+-\d+\.json$/.test(spec.path || '')) {
          errors.push(`Skill '${skill.name}': external_spec '${spec.name}' path '${spec.path}' must match ^packages/core/specs/V_\\d+-\\d+-\\d+\\.json$`);
        }
        if (path.posix.basename(spec.path || '') !== `${spec.version}.json`) {
          errors.push(`Skill '${skill.name}': external_spec '${spec.name}' basename '${path.posix.basename(spec.path || '')}' does not match '${spec.version}.json'`);
        }
        const vidgennRoot = process.env.VIDGENN_ROOT;
        if (vidgennRoot && fs.existsSync(vidgennRoot)) {
          const specFilePath = path.join(vidgennRoot, spec.path);
          if (fs.existsSync(specFilePath)) {
            const raw = fs.readFileSync(specFilePath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
            const hash = crypto.createHash('sha256').update(raw).digest('hex');
            if (hash !== spec.sha256) {
              errors.push(`Skill '${skill.name}': external_spec '${spec.name}' sha256 mismatch with local file at ${specFilePath}`);
            }
            try {
              const parsed = JSON.parse(raw);
              if (parsed.info && parsed.info.version && parsed.info.version !== spec.version) {
                errors.push(`Skill '${skill.name}': external_spec '${spec.name}' version mismatch with local file at ${specFilePath}`);
              }
            } catch {}
          } else {
            errors.push(`Skill '${skill.name}': external_spec file not found at ${specFilePath}`);
          }
        }
      }
    }
  }

  // 2. Check top-level blueprints
  for (const blueprint of (source.blueprints || [])) {
    blueprintsCount++;
    const tmplPath = path.join(repoRoot, blueprint.path);
    if (!fs.existsSync(tmplPath)) {
      errors.push(`Blueprint '${blueprint.name}': file not found at ${tmplPath}`);
      continue;
    }
    const text = fs.readFileSync(tmplPath, 'utf8');
    let declared = null;
    try {
      const meta = parseFocusedYaml(parseFrontmatter(text));
      // Deliberately NOT `blueprint_version`: manifest/source.yaml's `version`
      // tracks the Level-1 spec a blueprint conforms to, and the release-time
      // validator (manifest/lib/manifest-rules.js checkVersionParity) reads the
      // same fields. Preferring `blueprint_version` here makes the local check
      // pass while stable-manifest validation fails on main.
      declared = meta.version !== undefined ? meta.version : (meta.spec_version !== undefined ? meta.spec_version : (meta.metadata && meta.metadata.version));
    } catch {
      // ignore
    }
    if (declared === undefined || declared === null) {
      const fnMatch = path.basename(tmplPath).match(/V_\d+-\d+-\d+/i);
      if (fnMatch) declared = fnMatch[0];
    }
    if (declared === undefined || declared === null) {
      errors.push(`Blueprint '${blueprint.name}': no version declared in ${tmplPath}`);
    } else if (String(declared) !== String(blueprint.version)) {
      errors.push(`Blueprint '${blueprint.name}': version mismatch — manifest '${blueprint.version}' vs blueprint '${declared}'`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    stats: { skillsCount, blueprintsCount, mcpCount },
  };
}

/**
 * CLI execution entrypoint.
 */
function main() {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  console.log(`🔍 [check-parity] Validating workspace against manifest/source.yaml...`);
  const { ok, errors, stats } = checkWorkspaceParity(targetDir);

  if (!ok) {
    console.error(`\n❌ [check-parity] Parity check failed (${errors.length} errors):`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log(`✅ [check-parity] All ${stats.skillsCount} skills, ${stats.blueprintsCount} blueprints, and ${stats.mcpCount} mcp bundles in sync.`);
}

module.exports = { checkWorkspaceParity, main };

if (require.main === module) {
  main();
}