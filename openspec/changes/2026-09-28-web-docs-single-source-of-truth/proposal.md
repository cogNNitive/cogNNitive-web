# Proposal: Web and Docs Single Source of Truth

## Intent

cognnitive.com and both Docsify sites were written for the old two-repo era (actioNN + iNNfo). The same facts are now typed by hand in several places, and each copy has drifted:

| Fact | Canonical source | Drifted copies |
|------|------------------|----------------|
| MCP tool count | `TOOL_REGISTRY` / `TOOL_COUNT` in `iNNfo/packages/innfo-mcp/src/server.ts` (17) | `docs/innfo/about.md` (7), `docs/innfo/documentation/innfo-mcp.md` (9) |
| Skill name/version | `manifest/source.yaml` | `docs/skills/documentation/documentation_NN.md` (`nn-router`, 3 stale versions, `nn-video-script` missing) |
| Install steps | none | `docs/skills/index.html` (OpenCode only), `installing-ai-agents.md`, `docs/skills/documentation/README.md` |
| Repo map | the tree itself | `README.md` (`docs/actionn/`, `actioNN/`) |
| About page | none | `docs/innfo/about.md` + `about.html` |

**Goal:** remove the whole class of bug. Every published fact has exactly one editable source, and every other copy is generated or linked. Correcting the numbers once is not enough. Look and feel stays the same.

## Scope

### In Scope
- The MCP tool count and list come from the innfo-mcp registry at docs-build time.
- The skills catalog comes from `manifest/source.yaml`, so only released skills are listed.
- One multi-agent install guide (Claude Code, Cursor, Antigravity, Codex, OpenCode Desktop, ...) that recommends OpenCode Desktop. Other install copies become links. Change "for OpenCode" / "Built for OpenCode" to multi-agent wording.
- One canonical About page. The duplicate is either generated from it or removed.
- Fix the `README.md` repo map.
- Delete `marketing/storyboard/`. Nothing links to it and it isn't published.
- A drift guard in `scripts/verify.js`: stale generated docs or a reappearing hand-typed fact fail CI.

### Out of Scope
- Visual redesign, CSS, or layout changes.
- `docs/actionn/index.html` (the redirect stub stays as is).
- Pinned historical CDN bundles (`docs/innfo/cdn/innfo-mcp-v0.2.1.bundle.js`).
- Registering `nn-workspace-git`. The release process owns that (see `monorepo-release-manifest`).
- Editing published `specs/**/_V_x-y-z_` files.

## Capabilities

### New Capabilities
- `docs-derived-facts`: MCP tool count/list and the skill catalog are generated from their canonical sources, deterministically, and CI detects drift.
- `docs-install-guide`: a single canonical multi-agent install guide that recommends OpenCode Desktop.
- `docs-content-hygiene`: an accurate README repo map, one About page, no orphaned unpublished marketing content.

### Modified Capabilities
- `monorepo-release-manifest`: change the `nn-workspace-git` registration path from `actioNN/skills/...` to `skills/nn-workspace-git`.

## Approach

Deliver as sequential work-unit commits on `dev`. Each commit must pass the build and `verify.js` on its own:

1. `docs(readme)`: fix the repo map.
2. `feat(docs)`: derive the MCP tool facts from the registry and remove the hand-typed counts.
3. `feat(docs)`: derive the skills catalog from `source.yaml`.
4. `docs(install)`: consolidate the install guide and branding.
5. `docs(about)`: keep one About page.
6. `chore(marketing)`: delete the storyboard.
7. `ci(verify)`: add the drift guard. It could instead ship inside units 2 and 3.

Open questions for **sdd-design**:
- How `documentation_NN.md` (an iNNfo model) gets its skill data from `source.yaml`. Options: the generator cross-reads both files, an include/reference syntax in the model, or a generated section inside the model.
- How the docs read the tool facts: import the built `innfo-mcp` dist (the build already runs before docs generation), parse `server.ts` statically, or emit a JSON artifact.
- About: which format is canonical (md or html), and whether the other is generated or dropped.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `README.md` | Modified | Repo map |
| `docs/innfo/about.md`, `about.html` | Modified/Removed | Keep one About page |
| `docs/innfo/documentation/innfo-mcp.md`, `installing-ai-agents.md` | Modified | Generated facts; the canonical install guide |
| `docs/skills/index.html`, `docs/skills/documentation/{documentation_NN.md,README.md}` | Modified | Generated catalog; install becomes a link; branding |
| `scripts/build-docs.mjs`, `scripts/generate-docsify-suite.mjs`, `scripts/verify.js` | Modified | Derivation and drift guard |
| `iNNfo/packages/innfo-mcp` | Read-only | `toolDefinitions` / `TOOL_COUNT` consumed by the docs build |
| `manifest/source.yaml` | Read-only | Skill catalog source |
| `marketing/storyboard/` | Removed | Orphaned |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Uncommitted WIP in `docs/innfo/documentation/` (`_sidebar.md`, `specifications.md`, `templates.md`, `template-video.md`, `assets/`) overlaps this scope | High | The maintainer attributes it before apply. Never stage it. |
| Generated output isn't deterministic, so `verify` byte-checks go red | Med | No timestamps or counters (same lesson as the manifest frontmatter) |
| The catalog drops `nn-workspace-git` because it isn't in `source.yaml` | Certain | Intended. Registration happens at release. |
| Build order: docs generation runs before the MCP dist exists | Low | `build-docs.mjs` already builds the MCP first; design confirms the seam |

## Rollback Plan

One commit per work unit on `dev`. Roll back with `git revert <sha>` on `dev` before the batched merge to `main`. Nothing gets published until that merge.

## Dependencies

- `npm run build:docs` pipeline and `scripts/verify.js`.

## Success Criteria

- [ ] Changing `TOOL_REGISTRY` or `source.yaml` and rebuilding updates every published surface with no manual edits.
- [ ] No hand-typed MCP tool count or skill version remains in docs sources.
- [ ] CI fails when generated docs are stale.
- [ ] Every path in the `README.md` repo map exists.
- [ ] One install guide. "for OpenCode"-only wording is gone.
- [ ] No CSS/layout diff. `/actionn/` still redirects.

## Proposal question round

Assumptions for user review. Answer, correct, or ask for a second round:

1. **About page:** is `about.html` the page linked from cognnitive.com? *Assumed: `about.html` is canonical, and `about.md` is generated from it or dropped.*
2. **Catalog visibility:** should the public catalog list only released skills, or everything under `skills/`? *Assumed: released only (`source.yaml`).*
3. **MCP docs depth:** just the count, or the full tool list with descriptions? *Assumed: the full generated list, with the count derived from it.*
4. **Landing install:** should `docs/skills/index.html` keep a short install snippet or only link to the guide? *Assumed: an "OpenCode Desktop recommended" call to action plus a link.*
5. **Storyboard:** delete it, or move it into an archive? *Assumed: delete it. Git history is the archive.*
