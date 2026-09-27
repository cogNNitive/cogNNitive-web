# Design: Skills Manager node_modules Preservation and Dependency Self-Healing

## Architecture Overview

### 1. `replaceDirAtomic` node_modules Preservation

In `scripts/lib/atomic-fs.js`:
When replacing `dest` directory:
1. `src` is copied to `.name.new-<id>`.
2. Existing `dest` is renamed to `.name.bak-<id>`.
3. Staged new directory is renamed to `dest`.
4. If `backup/node_modules` exists and `dest/node_modules` does not:
   - Rename/move `backup/node_modules` into `dest/node_modules` (falling back to copy if cross-device).
5. Remove `backup` directory safely.

### 2. Dependency Self-Healing in `installSkillAtCommit`

In `scripts/lib/skills-commands.js`:
After swapping/copying the skill into `dest`:
- Check if `dest/package.json` exists.
- If `dependencies` are declared in `package.json`:
  - Check whether `dest/node_modules` exists and contains each declared dependency.
  - If any dependencies are missing, spawn `npm install --omit=dev --no-audit --no-fund` in `dest`.
- Ensures zero manual interventions for end users.
