#!/usr/bin/env node

/**
 * actioNN/scripts/skills-manager.js
 *
 * Lockfile-lite manager for cogNNitive skills and Level 2 templates.
 * Lean CLI orchestrator handling argument parsing, usage help, and command dispatch.
 * Delegates core command logic, state management, and atomic FS to modular libraries.
 *
 * Zero dependencies. Requires Node >= 18.
 */

const path = require('path');
const commands = require('./lib/skills-commands.js');

/**
 * Parses CLI command line arguments into structured SkillManagerArgs.
 * @param {string[]} argv
 * @returns {{ positional: string[], skillsDir: string | null, blueprintsDir: string | null, mcpDir: string | null, consoleDir: string | null, state: string | null, stateFile: string | null, yes: boolean, direction: string, agent: string, scope: string }}
 */
function parseArgs(argv) {
  const args = {
    positional: [],
    skillsDir: null,
    blueprintsDir: null,
    mcpDir: null,
    consoleDir: null,
    state: null,
    stateFile: null,
    yes: false,
    direction: 'local-to-global',
    agent: 'auto',
    scope: 'global',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '-y') {
      args.yes = true;
    } else if (arg === '--direction') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Option ${arg} requires a value`);
      }
      args.direction = value;
      i++;
    } else if (arg === '--agent') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Option ${arg} requires a value`);
      }
      args.agent = value;
      i++;
    } else if (arg === '--scope') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Option ${arg} requires a value`);
      }
      args.scope = value;
      i++;
    } else if (arg === '--skills-dir' || arg === '--templates-dir' || arg === '--mcp-dir' || arg === '--console-dir' || arg === '--state') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Option ${arg} requires a value`);
      }
      if (arg === '--skills-dir') args.skillsDir = value;
      else if (arg === '--templates-dir') args.blueprintsDir = value;
      else if (arg === '--mcp-dir') args.mcpDir = value;
      else if (arg === '--console-dir') args.consoleDir = value;
      else args.state = value;
      i++;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      args.positional.push(arg);
    }
  }
  return args;
}

/**
 * Displays usage and flag manual to console.
 * @returns {void}
 */
function usage() {
  console.log(`Usage:
  node scripts/skills-manager.js bootstrap [--scope <global|workspace>] [--agent <auto|opencode|claude|antigravity>] [--yes]
  node scripts/skills-manager.js status    [--skills-dir <dir>] [--templates-dir <dir>] [--state <file>]
  node scripts/skills-manager.js install   [--skills-dir <dir>] [--templates-dir <dir>] [--state <file>] [--yes]
  node scripts/skills-manager.js update    [item ...] [--skills-dir <dir>] [--templates-dir <dir>] [--state <file>] [--yes]
  node scripts/skills-manager.js sync      [--skills-dir <dir>] [--templates-dir <dir>] [--direction <local-to-global|global-to-local>] [--yes]

Commands:
  bootstrap Full zero-touch ecosystem setup: skills, templates, MCP bundles, and agent registration.
  status    Compare installed commits (state file) against manifest pins.
  install   Install missing skills and templates at their pinned commit.
  update    Update outdated skills and templates at their pinned commit.
  sync      Synchronize skill and template files between local repository and global agent directory.

Flags:
  --scope <scope>        Installation scope: global (default, ~/.agents/) or workspace (./.agents/)
  --agent <agent>        Target agent for MCP/Skills: auto (default), all, opencode, claude, antigravity
  --skills-dir <dir>     Skills directory (default: ~/.agents/skills)
  --templates-dir <dir>  Templates directory (default: ~/.agents/templates)
  --mcp-dir <dir>        MCP bundle directory (default: ~/.agents/mcp)
  --console-dir <dir>    Console bundle directory (default: ~/.agents/console)
  --state <file>         State file (default: ~/.agents/bootstrap-state.json)
  --direction <dir>      Sync direction: local-to-global (default) or global-to-local
  --yes, -y              Skip the interactive consent prompt.

Consent is mandatory. Without a TTY and without --yes, the script prints
"needs decision: ..." and exits 2 without applying anything.`);
}

/**
 * Main execution entry point for skills manager.
 * @returns {Promise<void>}
 */
async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`skills-manager: ${err.message}`);
    process.exit(1);
  }

  const command = args.positional.shift();
  if (!command || !['bootstrap', 'status', 'install', 'update', 'sync'].includes(command)) {
    usage();
    process.exit(1);
  }

  const isWorkspaceScope = args.scope === 'workspace';
  const defaultSkills = isWorkspaceScope ? './.agents/skills' : commands.DEFAULT_SKILLS_DIR;
  const defaultTemplates = isWorkspaceScope ? './specs/bluepriNNts' : commands.DEFAULT_BLUEPRINTS_DIR;
  const defaultMcp = isWorkspaceScope ? './.agents/mcp' : commands.DEFAULT_MCP_DIR;
  const defaultConsole = isWorkspaceScope ? './.agents/console' : commands.DEFAULT_CONSOLE_DIR;
  const defaultState = isWorkspaceScope ? './.agents/bootstrap-state.json' : commands.DEFAULT_STATE_FILE;

  const resolvedArgs = {
    positional: args.positional,
    skillsDir: path.resolve(args.skillsDir || defaultSkills),
    blueprintsDir: path.resolve(args.blueprintsDir || defaultTemplates),
    mcpDir: path.resolve(args.mcpDir || defaultMcp),
    consoleDir: path.resolve(args.consoleDir || defaultConsole),
    stateFile: path.resolve(args.state || defaultState),
    yes: args.yes,
    direction: args.direction,
    agent: args.agent,
    scope: args.scope,
  };

  try {
    if (command === 'bootstrap') await commands.cmdBootstrap(resolvedArgs);
    else if (command === 'status') await commands.cmdStatus(resolvedArgs);
    else if (command === 'install') await commands.cmdInstall(resolvedArgs);
    else if (command === 'update') await commands.cmdUpdate(resolvedArgs);
    else await commands.cmdSync(resolvedArgs);
  } catch (err) {
    console.error(`skills-manager: ${err.message}`);
    process.exit(1);
  }
}

module.exports = Object.defineProperties({
  ...commands,
  parseArgs,
  usage,
  main,
}, {
  MANIFEST_URL: {
    get() { return commands.getManifestUrl(); },
    enumerable: true,
  },
});

if (require.main === module) {
  main();
}
