/**
 * actioNN/scripts/lib/skills-commands.js
 *
 * Command implementations, consent gates, and state management for skills-manager.
 * Leverages shared libraries from scripts/lib: atomic-fs, github-client, yaml-parser.
 * Zero external dependencies — native Node.js execution.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawnSync } = require('child_process');
const readline = require('readline');

const {
  saveJsonAtomic,
  copyDirAtomic,
  replaceDirAtomic,
  extractTarball,
  copyDirRecursive,
  mirrorDir,
} = require('./atomic-fs.js');

const {
  isProjectableName,
  classifyProjection,
  hashTree,
} = require('../../skills/nn-preflight/scripts/lib/projection.js');

const {
  fetchString,
  fetchJson,
  downloadFile,
} = require('./github-client.js');

const {
  parseManifest,
} = require('./yaml-parser.js');

const { registerMcpAuto } = require('./mcp-config-adapter.js');

const DEFAULT_MANIFEST_URL = 'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/docs/use/manifest.md';
const DEFAULT_SKILLS_DIR = path.join(os.homedir(), '.agents', 'skills');
const DEFAULT_BLUEPRINTS_DIR = path.join(os.homedir(), '.agents', 'bluepriNNts');
const DEFAULT_MCP_DIR = path.join(os.homedir(), '.agents', 'mcp');
const DEFAULT_CONSOLE_DIR = path.join(os.homedir(), '.agents', 'console');
const DEFAULT_STATE_FILE = path.join(os.homedir(), '.agents', 'bootstrap-state.json');
const LEGACY_STATE_FILE = path.join(os.homedir(), '.agents', 'skills-state.json');

/**
 * Returns active manifest URL, respecting SM_MANIFEST_URL environment override.
 * @returns {string}
 */
function getManifestUrl() {
  return process.env.SM_MANIFEST_URL || DEFAULT_MANIFEST_URL;
}

/**
 * Pick the built-in client matching the URL protocol.
 * @param {string} url
 * @returns {typeof https.request | typeof http.request}
 */
function requestFor(url) {
  return url.startsWith('https:') ? https.request : http.request;
}

// ---------------------------------------------------------------------------
// State file (~/.agents/bootstrap-state.json)
// ---------------------------------------------------------------------------

/**
 * Initializes a new empty skill manager state structure.
 * @returns {{ manifest: string, skills: Record<string, any>, templates: Record<string, any>, mcp: Record<string, any>, console: Record<string, any>, projections: Record<string, any> }}
 */
function emptyState() {
  return { manifest: getManifestUrl(), skills: {}, templates: {}, mcp: {}, console: {}, projections: {} };
}

/**
  * Loads the current machine skill state from JSON file, supporting legacy migrations.
  * @param {string} file
  * @returns {{ manifest: string, skills: Record<string, any>, templates: Record<string, any>, mcp: Record<string, any>, console: Record<string, any>, projections: Record<string, any> }}
  */
function loadState(file) {
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '');
      const data = JSON.parse(raw);
      return {
        manifest: data.manifest || getManifestUrl(),
        skills: data.skills || {},
        templates: data.templates || {},
        mcp: data.mcp || {},
        console: data.console || {},
        projections: data.projections || {},
      };
    } catch (err) {
      return emptyState();
    }
  }

  // Legacy fallback migration: check sibling skills-state.json or LEGACY_STATE_FILE
  const siblingLegacy = path.join(path.dirname(file), 'skills-state.json');
  const legacyFileToUse = fs.existsSync(siblingLegacy) ? siblingLegacy : LEGACY_STATE_FILE;

  if (fs.existsSync(legacyFileToUse)) {
    try {
      const legacyRaw = fs.readFileSync(legacyFileToUse, 'utf-8').replace(/^\uFEFF/, '');
      const legacyData = JSON.parse(legacyRaw);
      const state = {
        manifest: legacyData.manifest || getManifestUrl(),
        skills: legacyData.skills || {},
        templates: {},
        mcp: {},
        console: {},
        projections: {},
      };
      saveState(file, state);
      return state;
    } catch (err) {
      return emptyState();
    }
  }

  return emptyState();
}

/**
 * Persists skill manager state atomically to disk.
 * @param {string} file
 * @param {object} state
 * @returns {void}
 */
function saveState(file, state) {
  saveJsonAtomic(file, state, 2);
}

// ---------------------------------------------------------------------------
// Tarball handling helpers
// ---------------------------------------------------------------------------

/**
 * Spawns tar command synchronously.
 * @param {string[]} args
 * @param {string} cwd
 * @returns {import('child_process').SpawnSyncReturns<string>}
 */
function runTar(args, cwd) {
  return spawnSync('tar', args, { cwd, encoding: 'utf-8' });
}

/**
 * Locates the single top-level directory unpacked inside an extracted tarball directory.
 * @param {string} extractDir
 * @returns {string}
 */
function findRepoRoot(extractDir) {
  const dirs = fs.readdirSync(extractDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
  if (dirs.length !== 1) {
    throw new Error(`unexpected tarball layout: expected one root directory, found ${dirs.length}`);
  }
  return path.join(extractDir, dirs[0]);
}

// ---------------------------------------------------------------------------
// Diff previews via GitHub compare API
// ---------------------------------------------------------------------------

/**
 * Fetches concise summary of files changed between installed commit and target commit.
 * @param {object} item
 * @param {string | undefined} installedCommit
 * @returns {Promise<string>}
 */
async function fetchCompareSummary(item, installedCommit) {
  if (!installedCommit) return '(no installed commit recorded)';
  try {
    const url = `https://api.github.com/repos/${item.repo}/compare/${installedCommit}...${item.commit}`;
    const data = await fetchJson(url);
    const prefix = item.path + '/';
    const files = (data.files || []).filter(f => f.filename && (f.filename.startsWith(prefix) || f.filename === item.path));
    if (files.length === 0) return `0 files changed under ${item.path}`;
    const first = files.slice(0, 3).map(f => f.filename);
    const more = files.length > 3 ? ` (+${files.length - 3} more)` : '';
    return `${files.length} files changed: ${first.join(', ')}${more}`;
  } catch (err) {
    return '(diff preview unavailable)';
  }
}

// ---------------------------------------------------------------------------
// Shared install/update routines
// ---------------------------------------------------------------------------

/**
 * Installs or updates a skill from GitHub tarball at specified commit.
 * @param {object} skill
 * @param {string} skillsDir
 * @param {object} state
 * @returns {Promise<void>}
 */
async function installSkillAtCommit(skill, skillsDir, state) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-skills-'));
  try {
    const tarball = path.join(tmpRoot, 'skill.tar.gz');
    const url = `https://codeload.github.com/${skill.repo}/tar.gz/${skill.commit}`;
    await downloadFile(url, tarball);

    const extractDir = path.join(tmpRoot, 'x');
    extractTarball(tarball, extractDir);
    const repoRoot = findRepoRoot(extractDir);

    const src = path.join(repoRoot, skill.path);
    if (!fs.existsSync(src)) {
      throw new Error(`path ${skill.path} not found in ${skill.repo} at ${skill.commit}`);
    }

    const dest = path.join(skillsDir, skill.name);
    fs.mkdirSync(skillsDir, { recursive: true });
    if (fs.existsSync(dest)) {
      replaceDirAtomic(src, dest);
    } else {
      copyDirAtomic(src, dest);
    }

    const pkgPath = path.join(dest, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = Object.keys(pkg.dependencies || {});
        const nodeModulesDir = path.join(dest, 'node_modules');
        const needsInstall =
          deps.length > 0 &&
          (!fs.existsSync(nodeModulesDir) ||
            deps.some((d) => !fs.existsSync(path.join(nodeModulesDir, d))));
        if (needsInstall) {
          try {
            spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
              cwd: dest,
              encoding: 'utf-8',
              shell: true,
              timeout: 60000,
            });
          } catch (_) {}
        }
      } catch (_) {}
    }

    state.skills[skill.name] = {
      commit: skill.commit,
      version: skill.version,
      updated_at: new Date().toISOString(),
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

/**
 * Installs or updates a template from GitHub at specified commit.
 * @param {object} template
 * @param {string} blueprintsDir
 * @param {object} state
 * @returns {Promise<void>}
 */
async function installBlueprintAtCommit(template, blueprintsDir, state) {
  const isMdFile = template.path.endsWith('.md') || template.path.endsWith('.markdown');
  const fileName = template.name.endsWith('.md') ? template.name : `${template.name}.md`;
  const flatDestPath = path.join(blueprintsDir, fileName);
  const pkgDestPath = path.join(blueprintsDir, template.name);

  fs.mkdirSync(blueprintsDir, { recursive: true });

  let recordedPath = isMdFile ? flatDestPath : pkgDestPath;

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-templates-'));
  try {
    const tarball = path.join(tmpRoot, 'tmpl.tar.gz');
    const url = `https://codeload.github.com/${template.repo}/tar.gz/${template.commit}`;
    await downloadFile(url, tarball);

    const extractDir = path.join(tmpRoot, 'x');
    extractTarball(tarball, extractDir);
    const repoRoot = findRepoRoot(extractDir);

    const src = path.join(repoRoot, template.path);
    if (!fs.existsSync(src)) {
      throw new Error(`template path ${template.path} not found in ${template.repo} at ${template.commit}`);
    }

    if (fs.statSync(src).isDirectory()) {
      if (fs.existsSync(pkgDestPath)) replaceDirAtomic(src, pkgDestPath);
      else copyDirAtomic(src, pkgDestPath);
      recordedPath = pkgDestPath;
    } else {
      const srcParentDir = path.dirname(src);
      const hasPackageSubdirs =
        fs.existsSync(path.join(srcParentDir, 'procedures')) ||
        fs.existsSync(path.join(srcParentDir, 'assets')) ||
        fs.existsSync(path.join(srcParentDir, 'samples')) ||
        path.basename(srcParentDir).toLowerCase() === template.name.toLowerCase();

      if (hasPackageSubdirs) {
        if (fs.existsSync(pkgDestPath)) replaceDirAtomic(srcParentDir, pkgDestPath);
        else copyDirAtomic(srcParentDir, pkgDestPath);
        try { fs.copyFileSync(src, flatDestPath); } catch (_) {}
        recordedPath = pkgDestPath;
      } else {
        fs.copyFileSync(src, flatDestPath);
        recordedPath = flatDestPath;
      }
    }
  } catch (err) {
    if (isMdFile) {
      const rawUrl = `https://raw.githubusercontent.com/${template.repo}/${template.commit}/${template.path}`;
      await downloadFile(rawUrl, flatDestPath);
      recordedPath = flatDestPath;
    } else {
      throw err;
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  state.templates[template.name] = {
    commit: template.commit,
    version: template.version,
    path: recordedPath,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Installs an MCP server bundle and its imported chunks from GitHub raw URL at specified commit.
 * @param {object} mcp
 * @param {string} mcpDir
 * @param {object} state
 * @returns {Promise<void>}
 */
async function installMcpAtCommit(mcp, mcpDir, state) {
  fs.mkdirSync(mcpDir, { recursive: true });
  const bundleDest = path.join(mcpDir, `${mcp.name}.bundle.js`);

  await downloadFile(mcp.url, bundleDest);

  if (fs.existsSync(bundleDest)) {
    const bundleContent = fs.readFileSync(bundleDest, 'utf-8');
    const chunkMatches = [...bundleContent.matchAll(/from\s*["']\.\/([^"']+\.js)["']/g)].map(m => m[1]);
    const baseUrl = mcp.url.substring(0, mcp.url.lastIndexOf('/'));

    for (const chunkFile of chunkMatches) {
      const chunkDest = path.join(mcpDir, chunkFile);
      const chunkUrl = `${baseUrl}/${chunkFile}`;
      try {
        await downloadFile(chunkUrl, chunkDest);
      } catch (err) {
        // Non-blocking for optional or conditional chunks
      }
    }
  }

  if (!state.mcp) state.mcp = {};
  state.mcp[mcp.name] = {
    commit: mcp.commit,
    version: mcp.version,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Installs a console asset bundle (innfo-console.bundle.js) from GitHub raw URL
 * at the pinned commit. The bundle is self-contained (runtime + renderers) and
 * lives in ~/.agents/console/ so generated artifacts can vendor it locally.
 * @param {object} asset
 * @param {string} consoleDir
 * @param {object} state
 * @returns {Promise<void>}
 */
async function installConsoleAssetAtCommit(asset, consoleDir, state) {
  fs.mkdirSync(consoleDir, { recursive: true });
  const fileName = path.basename(asset.file || asset.url);
  const dest = path.join(consoleDir, fileName);
  const url = asset.url || `https://raw.githubusercontent.com/${asset.repo}/${asset.commit}/${asset.file}`;
  await downloadFile(url, dest);
  if (!state.console) state.console = {};
  state.console[fileName] = {
    commit: asset.commit,
    version: asset.version,
    path: dest,
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Console helpers & Consent gate
// ---------------------------------------------------------------------------

/**
 * Prints formatted status table to console.
 * @param {Array<{ type: string, name: string, pinned: string, installed: string, status: string }>} rows
 * @returns {void}
 */
function printStatusTable(rows) {
  const headers = ['Type', 'Name', 'Pinned', 'Installed', 'Status'];
  const cells = [headers, ...rows.map(r => [r.type, r.name, r.pinned, r.installed, r.status])];
  const widths = headers.map((_, ci) => Math.max(...cells.map(r => r[ci].length)));
  const format = r => r.map((c, ci) => c.padEnd(widths[ci])).join(' | ');
  console.log(format(headers));
  console.log(headers.map((_, ci) => '-'.repeat(widths[ci])).join(' | '));
  for (const row of rows) console.log(format([row.type, row.name, row.pinned, row.installed, row.status]));
}

/**
 * Prompts user for interactive input via readline.
 * @param {string} promptText
 * @returns {Promise<string>}
 */
function promptChoice(promptText) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * Checks if user answer represents positive consent.
 * @param {string} answer
 * @returns {boolean}
 */
function isConsent(answer) {
  return ['a', 'y', 'yes'].includes(answer);
}

/**
 * Consent gate halting execution when non-interactive and unapproved.
 * @param {string} label
 * @param {string[]} names
 * @param {string} menu
 * @param {boolean} yes
 * @returns {Promise<boolean>}
 */
async function consentOrAbort(label, names, menu, yes) {
  if (names.length === 0) return false;
  if (yes) return true;
  if (!process.stdin.isTTY) {
    console.log(`needs decision: ${label}: ${names.join(', ')}`);
    process.exit(2);
  }
  console.log(menu);
  const choice = await promptChoice('> ');
  if (!isConsent(choice)) {
    console.log('Aborted. No changes applied.');
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Executes status command comparing installed commits against pinned commits.
 * @param {{ skillsDir: string, blueprintsDir: string, consoleDir?: string, stateFile: string }} args
 * @returns {Promise<void>}
 */
async function cmdStatus(args) {
  const manifestRaw = await fetchString(getManifestUrl());
  const { skills, templates, consoleAssets } = parseManifest(manifestRaw);
  const state = loadState(args.stateFile);

  const rows = [];
  const outdatedSkills = [];
  const outdatedBlueprints = [];
  const outdatedConsoleAssets = [];

  for (const skill of skills) {
    const dirPresent = fs.existsSync(path.join(args.skillsDir, skill.name));
    const entry = state.skills[skill.name];
    let status;
    if (dirPresent) {
      if (!entry) status = 'untracked';
      else if (entry.commit === skill.commit) status = 'up-to-date';
      else status = 'outdated';
    } else {
      status = entry ? 'dir-missing' : 'missing';
    }
    rows.push({
      type: 'skill',
      name: skill.name,
      pinned: skill.commit ? skill.commit.slice(0, 7) : '-',
      installed: entry ? entry.commit.slice(0, 7) : '-',
      status,
    });
    if (status === 'outdated') outdatedSkills.push(skill);
  }

  for (const template of templates) {
    const fileName = template.name.endsWith('.md') ? template.name : `${template.name}.md`;
    const pathPresent = fs.existsSync(path.join(args.blueprintsDir, fileName)) || fs.existsSync(path.join(args.blueprintsDir, template.name));
    const entry = state.templates[template.name];
    let status;
    if (pathPresent) {
      if (!entry) status = 'untracked';
      else if (entry.commit === template.commit) status = 'up-to-date';
      else status = 'outdated';
    } else {
      status = entry ? 'file-missing' : 'missing';
    }
    rows.push({
      type: 'template',
      name: template.name,
      pinned: template.commit ? template.commit.slice(0, 7) : '-',
      installed: entry ? entry.commit.slice(0, 7) : '-',
      status,
    });
    if (status === 'outdated') outdatedBlueprints.push(template);
  }

  const consoleDir = args.consoleDir || DEFAULT_CONSOLE_DIR;
  for (const asset of consoleAssets || []) {
    const fileName = path.basename(asset.file || asset.url);
    const pathPresent = fs.existsSync(path.join(consoleDir, fileName));
    const entry = state.console ? state.console[fileName] : null;
    let status;
    if (pathPresent) {
      if (!entry) status = 'untracked';
      else if (entry.commit === asset.commit) status = 'up-to-date';
      else status = 'outdated';
    } else {
      status = entry ? 'file-missing' : 'missing';
    }
    rows.push({
      type: 'console',
      name: fileName,
      pinned: asset.commit ? asset.commit.slice(0, 7) : '-',
      installed: entry ? entry.commit.slice(0, 7) : '-',
      status,
    });
    if (status === 'outdated') outdatedConsoleAssets.push(asset);
  }

  printStatusTable(rows);

  if (outdatedSkills.length > 0 || outdatedBlueprints.length > 0 || outdatedConsoleAssets.length > 0) {
    console.log('\nDiff previews for outdated items:');
    for (const skill of outdatedSkills) {
      const installed = state.skills[skill.name].commit;
      console.log(`  skill ${skill.name}: ${await fetchCompareSummary(skill, installed)}`);
    }
    for (const template of outdatedBlueprints) {
      const installed = state.templates[template.name].commit;
      console.log(`  template ${template.name}: ${await fetchCompareSummary(template, installed)}`);
    }
  }
}

/**
 * Executes install command installing missing skills and templates with consent.
 * @param {{ skillsDir: string, blueprintsDir: string, consoleDir?: string, stateFile: string, yes: boolean, agent?: string, scope?: string }} args
 * @returns {Promise<void>}
 */
async function cmdInstall(args) {
  const manifestRaw = await fetchString(getManifestUrl());
  const { skills, templates, consoleAssets } = parseManifest(manifestRaw);
  const state = loadState(args.stateFile);
  const consoleDir = args.consoleDir || DEFAULT_CONSOLE_DIR;

  const toInstallSkills = skills.filter(skill => !fs.existsSync(path.join(args.skillsDir, skill.name)));
  const toInstallBlueprints = templates.filter(template => {
    const fileName = template.name.endsWith('.md') ? template.name : `${template.name}.md`;
    return !fs.existsSync(path.join(args.blueprintsDir, fileName)) && !fs.existsSync(path.join(args.blueprintsDir, template.name));
  });
  const toInstallConsole = (consoleAssets || []).filter(asset => {
    const fileName = path.basename(asset.file || asset.url);
    return !fs.existsSync(path.join(consoleDir, fileName));
  });

  if (toInstallSkills.length === 0 && toInstallBlueprints.length === 0 && toInstallConsole.length === 0) {
    console.log('All skills, templates, and console assets present.');
    return;
  }

  const names = [
    ...toInstallSkills.map(s => `skill:${s.name}`),
    ...toInstallBlueprints.map(t => `template:${t.name}`),
    ...toInstallConsole.map(a => `console:${path.basename(a.file || a.url)}`),
  ];

  const menu = `The following items are missing:\n` +
    (toInstallSkills.length > 0 ? `Skills:\n  - ${toInstallSkills.map(s => `${s.name} (${s.version})`).join('\n  - ')}\n` : '') +
    (toInstallBlueprints.length > 0 ? `Templates:\n  - ${toInstallBlueprints.map(t => `${t.name} (${t.version})`).join('\n  - ')}\n` : '') +
    (toInstallConsole.length > 0 ? `Console assets:\n  - ${toInstallConsole.map(a => `${path.basename(a.file || a.url)} (${a.version})`).join('\n  - ')}\n` : '') +
    `\n[a] Install all missing (Recommended)\n[b] Skip\n`;

  const proceed = await consentOrAbort('install missing skills, templates, and console assets', names, menu, args.yes);
  if (!proceed) return;

  let failures = 0;

  for (const skill of toInstallSkills) {
    try {
      await installSkillAtCommit(skill, args.skillsDir, state);
      console.log(`  installed skill ${skill.name} (${skill.version}) @ ${skill.commit.slice(0, 7)}`);
    } catch (err) {
      failures++;
      console.error(`  FAIL skill ${skill.name}: ${err.message}`);
    }
  }

  for (const template of toInstallBlueprints) {
    try {
      await installBlueprintAtCommit(template, args.blueprintsDir, state);
      console.log(`  installed template ${template.name} (${template.version}) @ ${template.commit.slice(0, 7)}`);
    } catch (err) {
      failures++;
      console.error(`  FAIL template ${template.name}: ${err.message}`);
    }
  }

  for (const asset of toInstallConsole) {
    try {
      await installConsoleAssetAtCommit(asset, consoleDir, state);
      console.log(`  installed console ${path.basename(asset.file || asset.url)} (${asset.version}) @ ${asset.commit.slice(0, 7)}`);
    } catch (err) {
      failures++;
      console.error(`  FAIL console ${path.basename(asset.file || asset.url)}: ${err.message}`);
    }
  }

  projectSkillsToAgents({
    canonicalSkillsDir: args.skillsDir,
    targetAgent: args.agent,
    scope: args.scope,
    state,
    skillNames: toInstallSkills.map(s => s.name),
  });

  saveState(args.stateFile, state);

  if (failures > 0) {
    console.error(`\n${failures} item(s) failed to install.`);
    process.exit(1);
  }
  console.log(`\nInstalled ${toInstallSkills.length} skill(s), ${toInstallBlueprints.length} template(s), and ${toInstallConsole.length} console asset(s).`);
}

/**
 * Executes update command updating outdated skills and templates with consent.
 * @param {{ skillsDir: string, blueprintsDir: string, consoleDir?: string, stateFile: string, positional: string[], yes: boolean, agent?: string, scope?: string }} args
 * @returns {Promise<void>}
 */
async function cmdUpdate(args) {
  const manifestRaw = await fetchString(getManifestUrl());
  const { skills, templates, consoleAssets } = parseManifest(manifestRaw);
  const state = loadState(args.stateFile);
  const consoleDir = args.consoleDir || DEFAULT_CONSOLE_DIR;

  const isOutdatedSkill = (skill) => {
    const dirPresent = fs.existsSync(path.join(args.skillsDir, skill.name));
    const entry = state.skills[skill.name];
    return dirPresent && (!entry || entry.commit !== skill.commit);
  };

  const isOutdatedBlueprint = (template) => {
    const fileName = template.name.endsWith('.md') ? template.name : `${template.name}.md`;
    const pathPresent = fs.existsSync(path.join(args.blueprintsDir, fileName)) || fs.existsSync(path.join(args.blueprintsDir, template.name));
    const entry = state.templates[template.name];
    return pathPresent && (!entry || entry.commit !== template.commit);
  };

  const isOutdatedConsole = (asset) => {
    const fileName = path.basename(asset.file || asset.url);
    const pathPresent = fs.existsSync(path.join(consoleDir, fileName));
    const entry = state.console ? state.console[fileName] : null;
    return pathPresent && (!entry || entry.commit !== asset.commit);
  };

  let selectedSkills = skills.filter(isOutdatedSkill);
  let selectedBlueprints = templates.filter(isOutdatedBlueprint);
  let selectedConsole = (consoleAssets || []).filter(isOutdatedConsole);

  if (args.positional.length > 0) {
    selectedSkills = skills.filter(s => args.positional.includes(s.name) && isOutdatedSkill(s));
    selectedBlueprints = templates.filter(t => args.positional.includes(t.name) && isOutdatedBlueprint(t));
    selectedConsole = (consoleAssets || []).filter(a => args.positional.includes(path.basename(a.file || a.url)) && isOutdatedConsole(a));
  }

  if (selectedSkills.length === 0 && selectedBlueprints.length === 0 && selectedConsole.length === 0) {
    console.log('All skills, templates, and console assets up to date.');
    projectSkillsToAgents({
      canonicalSkillsDir: args.skillsDir,
      targetAgent: args.agent,
      scope: args.scope,
      state,
      skillNames: args.positional.length > 0 ? args.positional : undefined,
    });
    saveState(args.stateFile, state);
    return;
  }

  const names = [
    ...selectedSkills.map(s => `skill:${s.name}`),
    ...selectedBlueprints.map(t => `template:${t.name}`),
    ...selectedConsole.map(a => `console:${path.basename(a.file || a.url)}`),
  ];

  const proceed = await consentOrAbort(
    'update skills, templates, and console assets',
    names,
    `Updating ${selectedSkills.length} skill(s), ${selectedBlueprints.length} template(s), and ${selectedConsole.length} console asset(s).\n\n[a] Update all listed (Recommended)\n[b] Skip\n`,
    args.yes
  );
  if (!proceed) return;

  let failures = 0;

  for (const skill of selectedSkills) {
    try {
      await installSkillAtCommit(skill, args.skillsDir, state);
      console.log(`  updated skill ${skill.name} -> ${skill.version} (${skill.commit.slice(0, 7)})`);
    } catch (err) {
      failures++;
      console.error(`  FAIL skill ${skill.name}: ${err.message}`);
    }
  }

  for (const template of selectedBlueprints) {
    try {
      await installBlueprintAtCommit(template, args.blueprintsDir, state);
      console.log(`  updated template ${template.name} -> ${template.version} (${template.commit.slice(0, 7)})`);
    } catch (err) {
      failures++;
      console.error(`  FAIL template ${template.name}: ${err.message}`);
    }
  }

  for (const asset of selectedConsole) {
    try {
      await installConsoleAssetAtCommit(asset, consoleDir, state);
      console.log(`  updated console ${path.basename(asset.file || asset.url)} -> ${asset.version} (${asset.commit.slice(0, 7)})`);
    } catch (err) {
      failures++;
      console.error(`  FAIL console ${path.basename(asset.file || asset.url)}: ${err.message}`);
    }
  }

  projectSkillsToAgents({
    canonicalSkillsDir: args.skillsDir,
    targetAgent: args.agent,
    scope: args.scope,
    state,
    skillNames: args.positional.length > 0 ? args.positional : undefined,
  });

  saveState(args.stateFile, state);

  if (failures > 0) {
    console.error(`\n${failures} item(s) failed to update.`);
    process.exit(1);
  }
  console.log(`\nUpdated ${selectedSkills.length} skill(s), ${selectedBlueprints.length} template(s), and ${selectedConsole.length} console asset(s).`);
}

/**
 * Synchronizes skills between local repository and global agent directory.
 * @param {{ skillsDir: string, direction?: string, yes: boolean, localSkillsDir?: string }} args
 * @returns {Promise<void>}
 */
async function cmdSync(args) {
  const localSkillsDir = args.localSkillsDir || path.resolve(__dirname, '../../skills');
  const direction = args.direction || 'local-to-global';

  if (direction !== 'local-to-global' && direction !== 'global-to-local') {
    throw new Error(`Invalid sync direction: ${direction}. Expected local-to-global or global-to-local.`);
  }

  const srcDir = direction === 'local-to-global' ? localSkillsDir : args.skillsDir;
  const destDir = direction === 'local-to-global' ? args.skillsDir : localSkillsDir;

  console.log(`Sync direction: ${direction}`);
  console.log(`Source:      ${srcDir}`);
  console.log(`Destination: ${destDir}\n`);

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source directory does not exist: ${srcDir}`);
  }

  const skillsToSync = fs.readdirSync(localSkillsDir).filter(name => {
    return fs.statSync(path.join(localSkillsDir, name)).isDirectory() && !name.startsWith('.');
  });

  const proceed = await consentOrAbort(
    'synchronize skills',
    skillsToSync,
    `This will synchronize the following skills:\n${skillsToSync.map(s => `  - ${s}`).join('\n')}\n\n[a] Proceed with sync\n[b] Skip\n`,
    args.yes
  );
  if (!proceed) return;

  for (const skill of skillsToSync) {
    const srcSkill = path.join(srcDir, skill);
    const destSkill = path.join(destDir, skill);

    if (fs.existsSync(srcSkill)) {
      console.log(`Syncing ${skill}...`);
      copyDirRecursive(srcSkill, destSkill);
    }
  }
  console.log('\nSync completed successfully.');
}

/**
 * Executes complete, deterministic bootstrap:
 * 1. Installs/updates all manifest skills
 * 2. Installs/updates all manifest templates (all 10 Level 2 templates)
 * 3. Downloads all MCP bundles (e.g. innfo-mcp) and their imported chunks
 * 4. Registers MCP server in the target agent's config (OpenCode, Claude, Antigravity, or auto)
 * 5. Saves state file cleanly without BOM
 * 6. Displays clean summary with available workflows
 *
 * @param {{
 *   skillsDir: string,
 *   blueprintsDir: string,
 *   mcpDir?: string,
 *   consoleDir?: string,
 *   stateFile: string,
 *   agent?: string,
 *   scope?: string,
 *   yes: boolean,
 *   manifestUrl?: string,
 * }} args
 * @returns {Promise<void>}
 */
async function cmdBootstrap(args) {
  const url = args.manifestUrl || getManifestUrl();
  console.log('=== cogNNitive Bootstrap ===');
  console.log(`Fetching manifest from: ${url}`);
  const manifestRaw = await fetchString(url);
  const manifest = parseManifest(manifestRaw);
  const state = loadState(args.stateFile);

  const mcpDir = args.mcpDir || DEFAULT_MCP_DIR;
  const consoleDir = args.consoleDir || DEFAULT_CONSOLE_DIR;
  fs.mkdirSync(args.skillsDir, { recursive: true });
  fs.mkdirSync(args.blueprintsDir, { recursive: true });
  fs.mkdirSync(mcpDir, { recursive: true });
  fs.mkdirSync(consoleDir, { recursive: true });

  const names = [
    ...manifest.skills.map(s => `skill:${s.name}`),
    ...manifest.templates.map(t => `template:${t.name}`),
    ...(manifest.consoleAssets || []).map(a => `console:${path.basename(a.file || a.url)}`),
  ];

  const proceed = await consentOrAbort(
    'bootstrap cogNNitive ecosystem',
    names,
    `Bootstrapping ${manifest.skills.length} skills, ${manifest.templates.length} templates, MCP servers, and console assets.\n\n[a] Bootstrap now (Recommended)\n[b] Cancel\n`,
    args.yes
  );
  if (!proceed) return;

  // 1. Skills
  console.log(`\nInstalling/verifying ${manifest.skills.length} skill(s)...`);
  for (const skill of manifest.skills) {
    const entry = state.skills[skill.name];
    const dirPresent = fs.existsSync(path.join(args.skillsDir, skill.name));
    if (!dirPresent || !entry || entry.commit !== skill.commit) {
      await installSkillAtCommit(skill, args.skillsDir, state);
      console.log(`  ✓ skill ${skill.name} (${skill.version}) @ ${skill.commit.slice(0, 7)}`);
    } else {
      console.log(`  ✓ skill ${skill.name} (${skill.version}) up-to-date`);
    }
  }

  // 2. Templates
  console.log(`\nInstalling/verifying ${manifest.templates.length} template(s)...`);
  for (const tmpl of manifest.templates) {
    const fileName = tmpl.name.endsWith('.md') ? tmpl.name : `${tmpl.name}.md`;
    const tmplPresent = fs.existsSync(path.join(args.blueprintsDir, fileName)) || fs.existsSync(path.join(args.blueprintsDir, tmpl.name));
    const entry = state.templates[tmpl.name];
    if (!tmplPresent || !entry || entry.commit !== tmpl.commit) {
      await installBlueprintAtCommit(tmpl, args.blueprintsDir, state);
      console.log(`  ✓ template ${tmpl.name} (${tmpl.version}) @ ${tmpl.commit.slice(0, 7)}`);
    } else {
      console.log(`  ✓ template ${tmpl.name} (${tmpl.version}) up-to-date`);
    }
  }

  // 3. MCP servers declared in skills or manifest
  const mcpList = [];
  for (const skill of manifest.skills) {
    if (Array.isArray(skill.mcp)) {
      mcpList.push(...skill.mcp);
    }
  }
  if (Array.isArray(manifest.mcp)) {
    mcpList.push(...manifest.mcp);
  }

  if (mcpList.length > 0) {
    console.log(`\nInstalling/verifying ${mcpList.length} MCP server(s)...`);
    for (const mcp of mcpList) {
      const bundleDest = path.join(mcpDir, `${mcp.name}.bundle.js`);
      const entry = state.mcp ? state.mcp[mcp.name] : null;
      if (!fs.existsSync(bundleDest) || !entry || entry.commit !== mcp.commit) {
        await installMcpAtCommit(mcp, mcpDir, state);
        console.log(`  ✓ bundle ${mcp.name} (${mcp.version}) @ ${mcp.commit.slice(0, 7)}`);
      } else {
        console.log(`  ✓ bundle ${mcp.name} (${mcp.version}) up-to-date`);
      }

      // 4. Auto-register in agent config
      const mcpRegistrations = registerMcpAuto({
        bundlePath: bundleDest,
        serverName: mcp.name,
        targetAgent: args.agent,
      });

      for (const reg of mcpRegistrations) {
        console.log(`  ✓ MCP registered for ${reg.agent}: ${reg.file} (${reg.updated ? 'configured' : 'already configured'})`);
      }
    }
  }

  // 5. Console assets
  if (manifest.consoleAssets && manifest.consoleAssets.length > 0) {
    console.log(`\nInstalling/verifying ${manifest.consoleAssets.length} console asset(s)...`);
    for (const asset of manifest.consoleAssets) {
      const fileName = path.basename(asset.file || asset.url);
      const dest = path.join(consoleDir, fileName);
      const entry = state.console ? state.console[fileName] : null;
      if (!fs.existsSync(dest) || !entry || entry.commit !== asset.commit) {
        await installConsoleAssetAtCommit(asset, consoleDir, state);
        console.log(`  ✓ console ${fileName} (${asset.version}) @ ${asset.commit.slice(0, 7)}`);
      } else {
        console.log(`  ✓ console ${fileName} (${asset.version}) up-to-date`);
      }
    }
  }

  // 6. Project skills to agent directories (OpenCode, Claude Code, Antigravity)
  projectSkillsToAgents({
    canonicalSkillsDir: args.skillsDir,
    targetAgent: args.agent,
    scope: args.scope,
    state,
  });

  // 7. Save state
  saveState(args.stateFile, state);

  // 8. Summary and workflows
  console.log(`\nBootstrap completed successfully! All components up-to-date.`);
  if (manifest.workflows && manifest.workflows.length > 0) {
    console.log(`\nAvailable workflows:`);
    manifest.workflows.forEach((wf, idx) => {
      console.log(`  ${idx + 1}. ${wf.label} (${wf.skill}) — ${wf.description}`);
    });
  }
}

/**
 * Projects installed skills from canonical ~/.agents/skills/ into specific agent skill directories.
 * Target agents:
 * - OpenCode: ~/.config/opencode/skills/
 * - Claude Code: ~/.claude/skills/
 * - Antigravity: ~/.gemini/config/skills/
 *
 * @param {{
 *   canonicalSkillsDir: string,
 *   homedir?: string,
 *   targetAgent?: string,
 *   silent?: boolean,
 *   state?: Record<string, any>,
 *   scope?: string,
 *   skillNames?: string[],
 * }} options
 * @returns {Array<{ agent: string, targetDir: string, skill: string, method: 'symlink' | 'copy', action: 'create' | 'adopt' | 'replace' | 'mirror' | 'skip' }>}
 */
function projectSkillsToAgents({
  canonicalSkillsDir,
  homedir = os.homedir(),
  targetAgent = 'auto',
  silent = false,
  state = null,
  scope = 'global',
  skillNames = null,
}) {
  if (scope === 'workspace') {
    if (!silent) {
      console.log(`\nSkipping skill projection: workspace scope does not project to global editor directories.`);
    }
    return [];
  }

  if (!fs.existsSync(canonicalSkillsDir)) return [];

  let skillEntries = [];
  try {
    const diskDirs = fs.readdirSync(canonicalSkillsDir).filter(name => {
      return isProjectableName(name) && fs.statSync(path.join(canonicalSkillsDir, name)).isDirectory();
    });
    if (skillNames && skillNames.length > 0) {
      skillEntries = diskDirs.filter(name => skillNames.includes(name));
    } else if (state && state.skills && Object.keys(state.skills).length > 0) {
      skillEntries = diskDirs.filter(name => state.skills[name]);
    } else {
      skillEntries = diskDirs;
    }
  } catch {
    return [];
  }

  if (skillEntries.length === 0) return [];

  const normalizedAgent = (targetAgent || 'auto').toLowerCase();
  /** @type {Array<{ agent: string, targetDir: string, skill: string, method: 'symlink' | 'copy', action: 'create' | 'adopt' | 'replace' | 'mirror' | 'skip' }>} */
  const projections = [];

  const agentTargets = [];
  const opencodeSkillsDir = path.join(homedir, '.config', 'opencode', 'skills');
  const claudeSkillsDir = path.join(homedir, '.claude', 'skills');
  const geminiSkillsDir = path.join(homedir, '.gemini', 'config', 'skills');

  if (normalizedAgent === 'opencode' || normalizedAgent === 'all') {
    agentTargets.push({ agent: 'opencode', dir: opencodeSkillsDir });
  }
  if (normalizedAgent === 'claude' || normalizedAgent === 'all') {
    agentTargets.push({ agent: 'claude', dir: claudeSkillsDir });
  }
  if (normalizedAgent === 'antigravity' || normalizedAgent === 'all') {
    agentTargets.push({ agent: 'antigravity', dir: geminiSkillsDir });
  }

  if (normalizedAgent === 'auto') {
    if (fs.existsSync(path.join(homedir, '.config', 'opencode')) || process.env.OPENCODE_SESSION_ID || process.env.OPENCODE_RUN_ID) {
      agentTargets.push({ agent: 'opencode', dir: opencodeSkillsDir });
    }
    if (fs.existsSync(path.join(homedir, '.claude')) || fs.existsSync(path.join(homedir, '.claude.json')) || process.env.CLAUDE_CODE || process.env.CLAUDE_PROJECT_DIR) {
      agentTargets.push({ agent: 'claude', dir: claudeSkillsDir });
    }
    if (fs.existsSync(path.join(homedir, '.gemini')) || process.env.ANTIGRAVITY || process.env.GEMINI_CLI) {
      agentTargets.push({ agent: 'antigravity', dir: geminiSkillsDir });
    }
    if (agentTargets.length === 0) {
      agentTargets.push({ agent: 'opencode', dir: opencodeSkillsDir });
      agentTargets.push({ agent: 'claude', dir: claudeSkillsDir });
      agentTargets.push({ agent: 'antigravity', dir: geminiSkillsDir });
    }
  }

  if (state) {
    state.projections = state.projections || {};
  }

  for (const target of agentTargets) {
    fs.mkdirSync(target.dir, { recursive: true });
    if (state) {
      state.projections[target.agent] = state.projections[target.agent] || { dir: target.dir, skills: {} };
      state.projections[target.agent].dir = target.dir;
      state.projections[target.agent].skills = state.projections[target.agent].skills || {};
    }

    for (const skill of skillEntries) {
      const src = path.join(canonicalSkillsDir, skill);
      const dest = path.join(target.dir, skill);

      if (path.resolve(src).toLowerCase() === path.resolve(dest).toLowerCase()) continue;

      const classification = classifyProjection(dest, src);
      const recorded = state && state.projections[target.agent] && state.projections[target.agent].skills[skill];

      const recordState = (method) => {
        if (state) {
          state.projections[target.agent].skills[skill] = {
            method,
            source: path.resolve(src),
            projected_at: new Date().toISOString(),
          };
        }
      };

      if (classification === 'absent') {
        /** @type {'symlink' | 'copy'} */
        let method = 'symlink';
        /** @type {'create' | 'adopt' | 'replace' | 'mirror' | 'skip'} */
        let action = 'create';
        let symlinkSuccess = false;
        try {
          const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
          fs.symlinkSync(src, dest, symlinkType);
          symlinkSuccess = true;
        } catch {
          symlinkSuccess = false;
        }

        if (!symlinkSuccess) {
          mirrorDir(src, dest, isProjectableName);
          method = /** @type {'symlink' | 'copy'} */ ('copy');
        }
        recordState(method);
        projections.push({ agent: target.agent, targetDir: target.dir, skill, method, action });
      } else if (classification === 'link-ok') {
        /** @type {'symlink' | 'copy'} */
        const method = 'symlink';
        /** @type {'create' | 'adopt' | 'replace' | 'mirror' | 'skip'} */
        const action = 'adopt';
        recordState(method);
        projections.push({ agent: target.agent, targetDir: target.dir, skill, method, action });
      } else if (classification === 'link-wrong' || classification === 'link-dangling') {
        if (recorded) {
          try {
            fs.unlinkSync(dest);
          } catch {
            fs.rmSync(dest, { force: true });
          }

          /** @type {'symlink' | 'copy'} */
          let method = 'symlink';
          /** @type {'create' | 'adopt' | 'replace' | 'mirror' | 'skip'} */
          let action = 'replace';
          let symlinkSuccess = false;
          try {
            const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
            fs.symlinkSync(src, dest, symlinkType);
            symlinkSuccess = true;
          } catch {
            symlinkSuccess = false;
          }

          if (!symlinkSuccess) {
            mirrorDir(src, dest, isProjectableName);
            method = /** @type {'symlink' | 'copy'} */ ('copy');
          }
          recordState(method);
          projections.push({ agent: target.agent, targetDir: target.dir, skill, method, action });
        } else {
          projections.push({ agent: target.agent, targetDir: target.dir, skill, method: 'symlink', action: 'skip' });
        }
      } else if (classification === 'dir') {
        if (recorded && recorded.method === 'copy') {
          mirrorDir(src, dest, isProjectableName);
          recordState('copy');
          projections.push({ agent: target.agent, targetDir: target.dir, skill, method: 'copy', action: 'mirror' });
        } else if (!recorded) {
          const srcHash = hashTree(src, isProjectableName);
          const destHash = hashTree(dest, isProjectableName);
          if (srcHash && destHash && srcHash === destHash) {
            recordState('copy');
            projections.push({ agent: target.agent, targetDir: target.dir, skill, method: 'copy', action: 'adopt' });
          } else {
            projections.push({ agent: target.agent, targetDir: target.dir, skill, method: 'copy', action: 'skip' });
          }
        } else {
          projections.push({ agent: target.agent, targetDir: target.dir, skill, method: 'copy', action: 'skip' });
        }
      }
    }
  }

  if (!silent && projections.length > 0) {
    console.log(`\nProjected skills to agent directories:`);
    const grouped = {};
    for (const p of projections) {
      if (!grouped[p.agent]) grouped[p.agent] = [];
      grouped[p.agent].push(p);
    }
    for (const [agent, list] of Object.entries(grouped)) {
      const active = list.filter(p => p.action !== 'skip');
      const symlinks = active.filter(p => p.method === 'symlink').length;
      const copies = active.filter(p => p.method === 'copy').length;
      const skipped = list.filter(p => p.action === 'skip').length;

      const parts = [];
      if (symlinks > 0) parts.push(`${symlinks} symlink`);
      if (copies > 0) parts.push(`${copies} copy`);

      if (active.length > 0) {
        console.log(`  ✓ ${agent}: ${active.length} skill(s) synchronized (${parts.join(', ')})`);
      }
      if (skipped > 0) {
        console.log(`  ⚠️ ${agent}: ${skipped} unmanaged skill(s) skipped`);
      }
    }
  }

  return projections;
}

module.exports = {
  get MANIFEST_URL() {
    return getManifestUrl();
  },
  DEFAULT_MANIFEST_URL,
  DEFAULT_SKILLS_DIR,
  DEFAULT_BLUEPRINTS_DIR,
  DEFAULT_MCP_DIR,
  DEFAULT_CONSOLE_DIR,
  DEFAULT_STATE_FILE,
  LEGACY_STATE_FILE,
  getManifestUrl,
  requestFor,
  fetchString,
  fetchJson,
  downloadFile,
  parseManifest,
  emptyState,
  loadState,
  saveState,
  runTar,
  extractTarball,
  findRepoRoot,
  copyDirAtomic,
  replaceDirAtomic,
  copyDirRecursive,
  fetchCompareSummary,
  installSkillAtCommit,
  installBlueprintAtCommit,
  installMcpAtCommit,
  installConsoleAssetAtCommit,
  projectSkillsToAgents,
  printStatusTable,
  promptChoice,
  isConsent,
  consentOrAbort,
  cmdStatus,
  cmdInstall,
  cmdUpdate,
  cmdSync,
  cmdBootstrap,
};
