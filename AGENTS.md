<!-- gentle-ai:session-start-skill -->
## Session Start: Load nn-dev-development (MANDATORY)

At the very start of every session in this repository, before any repository
operation, load the `nn-dev-development` skill via the `skill` tool and follow it:

- Skill name: `nn-dev-development`
- Path: `.agents/skills/nn-dev-development/SKILL.md`

It runs the concurrency scan against the shared working tree and enforces the
branch-first consent gate before any repo write. Do not skip it, even for
read-only or "quick" work — it also detects concurrent agents holding the tree.
<!-- /gentle-ai:session-start-skill -->

`.atl/skill-registry.md` is machine-generated and untracked (each machine
regenerates it with different absolute paths). If it is missing locally, run
`gentle-ai skill-registry refresh --force` to regenerate it.

**Two-tier skill resolution.** The canonical content for `nn-dev-development`,
`nn-dev-release`, and `nn-dev-check-integrity` lives only under
`.agents/skills/<name>/SKILL.md` — that convention belongs to the
"Agent Teams Lite" / gentle-ai orchestrator layer, not to Claude Code's native
`Skill` tool. Claude Code's native `Skill` tool only resolves skills placed
under `.claude/skills/<name>/SKILL.md` (project-scoped) or the user's global
`~/.claude/skills/<name>/SKILL.md`. To make these maintainer-only skills
resolvable by name there too, thin pointer stubs exist at
`.claude/skills/<name>/SKILL.md` for all three — each one just tells the
agent to go read the real file under `.agents/skills/`. If the `Skill` tool
ever again reports "Unknown skill" for one of the `nn-dev-*` skills, do not
block the session on it: read `.agents/skills/<name>/SKILL.md` directly with
Read/Glob as a fallback and proceed.

## Blocked git commands

`.claude/settings.json` registers a PreToolUse hook
(`.claude/hooks/block-dangerous-git.mjs`) that refuses git commands whose blast
radius is the whole working tree: `reset --hard`, `clean`, `stash`,
`branch -D`, `checkout`/`restore` of `.`, `add -A`, `add .` and `commit -a`.

This checkout is routinely shared by concurrent agent sessions, so it may hold
uncommitted work the current session did not author. None of those commands can
be scoped to a pathspec, which makes "only touch your own files" impossible to
honour once they run — one of them destroyed 58 uncommitted foreign changes on
2026-09-21.

Safe substitutes: `git reset --soft HEAD~1` to drop a commit while keeping the
tree, `git checkout HEAD -- <explicit/path>` to revert one file, and
`git worktree add --detach <tmp> <sha>` when you need a clean tree for a build
or a release rehearsal. `git push` is deliberately NOT blocked — it carries its
own pre-push typecheck hook.

The hook matches on the command text, so a command that merely quotes one of
those patterns is refused too. Verify the rules with
`node .claude/hooks/block-dangerous-git.test.mjs`.

## Canonical Vocabulary & Ubiquitous Language

All agents MUST adhere to the canonical iNNfo level nomenclature and vocabulary:
- **Level 0**: `defiNNition` (meta-specification language)
- **Level 1**: `iNNfo` (concrete specification meta-template) & `meta-bluepriNNt`
- **Level 2**: `bluepriNNt` (domain schema; `template` and `app` are deprecated aliases)
- **Level 3**: `kNNowledge` (domain data model; uncountable noun, e.g. "N kNNowledge documents")
- **Container**: `domaiNN` (workspace container; a domaiNN is itself a kNNowledge document)

Authoritative sources:
- Machine-readable dictionary: [`iNNfo/specs/vocabulary.json`](iNNfo/specs/vocabulary.json)
- Rendered vocabulary & alias guide: [`docs/innfo/documentation/vocabulary.md`](docs/innfo/documentation/vocabulary.md)

## Legacy Quarantine & Ledger Contract

Temporary legacy migration debt is quarantined and tracked 1:1 via `legacy-ledger.yaml`:
- Every piece of temporary legacy code MUST carry a marker formatted as `legacy:<namespace>/<id>` (e.g. `legacy:nn-rename/<id>`).
- Every marker MUST correspond 1:1 to an entry in `legacy-ledger.yaml` declaring `id`, `what`, `paths`, `why`, `removal`, and `owner`.
- Verified deterministically via `node scripts/lib/legacy-ledger-guard.js` on every run of `scripts/verify.js` and `scripts/check-integrity.js`.
- Permanent history (`_V_` specs, frozen CDN bundles, git tags, archived changes) is NEVER ledgered.