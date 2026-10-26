---
name: nn-skills-lifecycle
description: Install, create, audit, and maintain cogNNitive skills. Entry point for the skill ecosystem. Invoke with /nn-skills-lifecycle.
disable-model-invocation: true
version: "V_1-3-1"
last_updated: 2026-10-20
metadata:
  source: actioNN
  audience: maintainer
  workflow: skills
license: MIT
compatibility: opencode
bundled_blueprints: []
---

# nn Skills Lifecycle

## 0. Activation Gate
Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check).

---

Single entry point for the skill ecosystem. Classify the request into one branch below.

---

## Branches

### Install / Update / Sync — manifest-pinned skills

Manages the skills tracked in the bootstrap manifest, installed into the
user-level skills directory by `scripts/skills-manager.js` — a bundled,
zero-dependency, lockfile-lite manager that ships inside this skill folder (the counterpart of lazy.nvim's `lazy-lock.json`).

**Desired state (source of truth)**: the bootstrap manifest at
`docs/use/manifest.md`, fetched from
`https://cognnitive.com/use/manifest.md`
(override via `SM_MANIFEST_URL`, used for local testing). Its YAML frontmatter
declares an `agent-bootstrap.skills` list; each entry pins:

- `name` — skill directory name
- `repo` — GitHub `owner/repo` to fetch from
- `commit` — full 40-char SHA, the integrity anchor
- `version` — display string that MUST match the target `SKILL.md` frontmatter
- `path` — path to the skill inside that repo
- `requires` (optional) — names of other manifest skills this one depends on

**Installed state (local record)**: `~/.agents/bootstrap-state.json`, one entry per
skill (`{ commit, version, updated_at }`). This file is never authoritative for
what *should* be installed — only for what *is* installed on this machine.
Skills install into `~/.agents/skills/{name}/` by default (override with
`--skills-dir`).

**Commands** — run the bundled script from this skill's folder
(`node scripts/skills-manager.js <command>`, or from anywhere:
`node ~/.agents/skills/nn-skills-lifecycle/scripts/skills-manager.js <command>`;
see [`nn-preflight/reference/skill-locations.md`](../nn-preflight/reference/skill-locations.md)
for installed locations):

| Command | Behavior |
|---|---|
| `status` | Compares installed vs. pinned commits; prints a table, plus a file-count diff preview (via the GitHub compare API) for anything outdated. |
| `install` | Installs skills missing from the skills directory, at their pinned commit. |
| `install-external --name <n> --repo <owner/repo> --path <skills/x> --commit <40-hex> [--sha256 <64-hex>]` | **Opt-in.** Installs a *referenced* external (third-party) skill from its upstream repo at the pinned commit, verifying the `sha256` tree digest when given. Never invoked by `install`/`update`/`sync`. |
| `update [skill ...]` | Updates outdated skills — or a given subset, auto-pulling in any outdated `requires` — at their pinned commit. |
| `sync [--direction local-to-global\|global-to-local]` | **Maintainer / repo-only.** Recursively copies skill directories between a repo checkout's `skills/` and `--skills-dir` (default `~/.agents/skills`). It resolves the repo `skills/` folder relative to the script, so it is not meant for installed copies. |

Install and update both fetch a tarball from
`https://codeload.github.com/{repo}/tar.gz/{commit}`, extract it, and swap the
pinned `path` into `~/.agents/skills/{name}/` with an atomic rename
(backup-and-rollback on failure). `sync` is a plain recursive file copy in
either direction — it does not touch the manifest or the state file.

**Referenced external skills (opt-in).** A bluepriNNt may *recommend* a
third-party skill by declaring it in its frontmatter `skills:` array, pinned to a
`commit` with an SPDX `license`. Such a skill is `referenced`, never vendored
into the repo, and carries a deliberately **bounded** guarantee — reproducible
(pinned commit) and license-declared; cogNNitive does not vouch for its author.
Unlike the `embedded` skills curated under `skills/`, a referenced skill never
enters the manifest and is never fetched by `install`/`update`/`sync`: it
installs only through the explicit `install-external` subcommand. See the
guarantee tiers in [`docs/innfo/template-package-spec.md`](../../docs/innfo/template-package-spec.md).

**Talking to the user before installing a third-party skill.** The consent
prompt is the last step, not the first. When an external skill becomes relevant —
usually because a task needs a capability the ecosystem does not cover yet —
raise it in the conversation first, briefly and without alarm, tailored to that
skill and that task:

- One line on what the skill would do *for the user's current work* (the reason
  it came up), not a generic description.
- State that it is third-party: cogNNitive did not review it and does not vouch
  for its author.
- Recommend having a security skill check it first — routine hygiene, not a
  warning. The install notice prints the link to
  [Installing Third-Party Skills](https://cognnitive.com/skills/documentation/#/skills/installing-third-party-skills),
  which carries the how and the why.
- Offer to proceed either way, and make "not now" as easy as "yes".

Never recite a list of attack types at the user, and never raise this at
bootstrap — it belongs to the moment an external skill is actually proposed.

Example (match the user's language):

> I need to read that scanned PDF, and the skill that does it isn't from
> cogNNitive (it's maintained by <author>), so we haven't reviewed it. I'd
> suggest the security skill checks it first — quick and routine. Want me to
> install it, or would you rather review it first? You can see it here: <link>.

**Consent is mandatory** for every mutating command (`install`,
`install-external`, `update`, `sync`): `--yes` skips the interactive prompt;
without a TTY and without `--yes`, the script prints `needs decision: ...` and
exits `2` without applying anything.

Nothing here links, junctions, or symlinks a skill directory back to its
source — every install, update, and sync is a copy. See
[`nn-preflight/reference/skill-locations.md`](../nn-preflight/reference/skill-locations.md)
for the (separate, manual-only) Junction/SymbolicLink reference some
maintainers use to live-link a repo-local skill folder for editing — that is
not part of this flow and is not automated by `skills-manager.js`.

After any operation, re-render the status table.

---

### Create — new skill

Delegate to the appropriate sub-skill:
- With evaluation → `skill-creator`
- Simple scaffold → `write-a-skill` (mattpocock/skills)

Do NOT load these sub-skills in the same context. Choose one and delegate.

---

### Audit — review and improve

Delegate to:
- Quality audit → `skill-improver`
- Structure / layout → `nnskills-organizer`
- Origin metadata → `skill-origin-guard`

Pass exact SKILL.md paths.

---

### Maintenance — full review (maintainer / repo-only)

Requires a cogNNitive repository checkout; not runnable from an installed skill.

1. Read `manifest/source.yaml` and installed skills
2. Identify orphaned or unused skills
3. Check frontmatter compliance across all skills
4. Verify manifest and documentation parity
5. Delegate fixes to the appropriate sub-skills
6. Run `npm run check:versions` or `npm run sync:versions` (repo root) to maintain parity
7. Report summary: what was done, new count, remaining items

---

## Hard Rules

- Never load alongside `skill-creator`, `skill-improver`, or `nnskills-organizer` in the same context
- Always update `manifest/source.yaml` and sync version documentation after any create, move, rename, or delete
- Never modify a `SKILL.md` directly — delegate to the specialist
