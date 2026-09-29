# Tasks: Skills Manager node_modules Preservation and Dependency Self-Healing

- [x] 1.1 Update `replaceDirAtomic` in `scripts/lib/atomic-fs.js` to preserve `backup/node_modules` into `dest/node_modules` across atomic swaps.
- [x] 1.2 Update `installSkillAtCommit` in `scripts/lib/skills-commands.js` to verify dependency presence and run `npm install --omit=dev` if dependencies are missing.
- [x] 1.3 Add unit test in `scripts/lib/shared-libs.test.js` verifying that `replaceDirAtomic` preserves `node_modules`.
- [x] 1.4 Validate full test suites across `shared-libs.test.js`, `skills-manager.test.js`, and `preflight-check.test.js`.
