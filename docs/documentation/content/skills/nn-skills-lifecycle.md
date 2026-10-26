# nn-skills-lifecycle

`nn-skills-lifecycle` is the single entry point for the cogNNitive **skill ecosystem**. It installs,
updates, audits, and maintains skills, and it reconciles what is installed on a machine with what
the distribution manifest pins. It is invoked explicitly with `/nn-skills-lifecycle`.

It classifies a request into one of four branches: **Install / Update / Sync**, **Create**,
**Audit**, and **Maintenance**.

## Manifest pinning and lockfile agreement

The skill manages two records that must agree:

- **Desired state (source of truth)** — the bootstrap manifest. Its frontmatter declares an
  `agent-bootstrap.skills` list, and each entry pins:
  - `name` — the skill directory name.
  - `repo` — the GitHub `owner/repo` to fetch from.
  - `commit` — a full 40-character SHA; the integrity anchor.
  - `version` — a display string that must match the target `SKILL.md` frontmatter.
  - `path` — the path to the skill inside that repo.
  - `requires` (optional) — the names of other manifest skills this one depends on.

- **Installed state (local record)** — `~/.agents/bootstrap-state.json`, one entry per skill
  (`{ commit, version, updated_at }`). This file is **never authoritative** for what *should* be
  installed; it only records what *is* installed on this machine.

A skill is up to date only when its installed commit matches the pinned commit. The pair of records
behaves like a lockfile: the manifest pins the desired revision, and the state file records the
resolved one. Skills install into `~/.agents/skills/{name}/` by default (override with
`--skills-dir`).

## Commands

Run the bundled, zero-dependency manager from this skill's folder
(`node scripts/skills-manager.js <command>`), or from anywhere via its installed path:

| Command | Behavior |
|---|---|
| `status` | Compares installed vs. pinned commits; prints a table plus a file-count diff preview for anything outdated. |
| `install` | Installs skills missing from the skills directory, at their pinned commit. |
| `install-external --name <n> --repo <owner/repo> --path <skills/x> --commit <40-hex> [--sha256 <64-hex>]` | **Opt-in.** Installs a referenced third-party skill from its upstream repo at the pinned commit, verifying the tree digest when given. Never invoked by `install`/`update`/`sync`. |
| `update [skill ...]` | Updates outdated skills — or a given subset, auto-pulling any outdated `requires` — at their pinned commit. |
| `sync [--direction local-to-global\|global-to-local]` | **Maintainer / repo-only.** Recursively copies skill directories between a repo checkout's `skills/` and `--skills-dir`. |

Install and update both fetch a tarball from
`https://codeload.github.com/{repo}/tar.gz/{commit}`, extract it, and swap the pinned `path` into
the skills directory with an atomic rename (backup-and-rollback on failure). `sync` is a plain
recursive copy in either direction and does not touch the manifest or the state file.

**Consent is mandatory** for every mutating command (`install`, `install-external`, `update`,
`sync`): `--yes` skips the interactive prompt; without a TTY and without `--yes`, the script prints
`needs decision: ...` and exits `2` without applying anything.

## Referenced external skills

A bluepriNNt may *recommend* a third-party skill by declaring it in its frontmatter `skills:` array,
pinned to a `commit` and a `sha256` tree digest with an SPDX `license`. Such a skill is
**referenced**, never vendored into the repo, and carries a deliberately bounded guarantee:
reproducible (pinned commit), unmodified since the pin (digest verified at install), and
license-declared. cogNNitive does not vouch for its author. A referenced skill never enters the
manifest and installs only through the explicit `install-external` subcommand.

This is distinct from an **embedded** skill, which is curated under `skills/` and shipped inside a
package at `skills/<name>/SKILL.md`.

## Create, audit, and maintenance

- **Create** — delegates to a sub-skill: `skill-creator` (with evaluation) or a simple scaffold.
  The skill never loads these sub-skills in the same context; it chooses one.
- **Audit** — delegates quality review to `skill-improver`, structure/layout to `nnskills-organizer`,
  and origin metadata to `skill-origin-guard`, passing exact `SKILL.md` paths.
- **Maintenance (maintainer / repo-only)** — requires a repository checkout. It reads the manifest
  and installed skills, identifies orphaned or unused skills, checks frontmatter compliance, verifies
  manifest/documentation parity, delegates fixes, and runs `npm run check:versions` or
  `npm run sync:versions` to maintain version parity.

## Hard rules

- Never load alongside `skill-creator`, `skill-improver`, or `nnskills-organizer` in the same context.
- Always update `manifest/source.yaml` and sync version documentation after any create, move,
  rename, or delete.
- Never modify a `SKILL.md` directly — delegate to the specialist.

Nothing here links, junctions, or symlinks a skill directory back to its source: every install,
update, and sync is a copy. The separate, manual-only junction/symlink reference some maintainers
use for live-linking lives in [nn-preflight](nn-preflight.md)'s `reference/skill-locations.md`.

## See also

- [Agent skills overview](README.md) — what a skill is and how the ecosystem is composed.
- [nn-preflight](nn-preflight.md) — the activation gate and skill-location reference.
- [Install and connect an AI agent](../how-to/install-agent.md) — the bootstrap walkthrough.
