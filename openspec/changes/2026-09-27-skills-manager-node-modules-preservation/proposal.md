# Proposal: Skills Manager node_modules Preservation and Dependency Self-Healing

## Why

**Issue #92**: `skills-manager update --yes` replaces each skill directory atomically via `replaceDirAtomic`. Because GitHub tarballs do not contain `node_modules`, the atomic directory swap discarded the existing `node_modules` directory in the installed skill (such as `~/.agents/skills/nn-trannsform/node_modules`). As a consequence, running `skills-manager update` resulted in `nn-preflight` failing with exit code 1 due to missing dependencies until the user manually discovered and ran `npm install` inside each skill directory.

## What Changes

- **Preserve `node_modules` Across Directory Swaps**: Update `replaceDirAtomic` in `scripts/lib/atomic-fs.js` to preserve the existing `backup/node_modules` into `dest/node_modules` when the newly staged skill directory does not already have one.
- **Automatic Skill Dependency Self-Healing**: Update `installSkillAtCommit` in `scripts/lib/skills-commands.js` to inspect `package.json` in the installed skill and automatically execute `npm install --omit=dev --no-audit --no-fund` if any required dependencies are absent.
- **Preflight Actionable Diagnostics**: Verify `nn-preflight` explicitly reports missing skill dependencies with clear remediation instructions.

## Capabilities

### Modified Capabilities
- `atomic-fs`: `node_modules` preservation during atomic directory replacements.
- `skills-lifecycle`: Automatic dependency self-healing during skill installs and updates.

## Impact

- Running `skills-manager update --yes` no longer drops installed dependencies.
- `nn-preflight` remains green (exit code 0) after skill updates without requiring manual `npm install` interventions.
