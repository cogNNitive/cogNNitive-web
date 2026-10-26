# Agent skills overview

An **agent skill** is a self-contained instruction package that extends an AI coding agent with a
cogNNitive workflow. A skill is a directory with a `SKILL.md` file — Markdown with YAML
frontmatter — plus any scripts, packaged bluepriNNts, and reference material the workflow needs. The agent
loads a skill on demand (by trigger phrase or by explicit invocation) and follows it like an
operating procedure.

Skills are the interface between a plain coding agent and the cogNNitive ecosystem. They do not
reimplement the engine: they drive the deterministic tools — the `nn-mcp` server and the CLI
scripts — and keep the agent inside the consent and provenance rules of the platform.

## How the ecosystem is composed

A skill package has three parts:

1. **`SKILL.md`** — the instructions. The frontmatter declares the skill `name`, a `description`
   (which doubles as its activation trigger list), and metadata such as `requires`, `mcp`, and
   `bundled_blueprints`.
2. **Scripts** — deterministic helpers under the skill folder (for example the source scanner in
   `nn-sources/scripts/index.js`, or the skill manager in `nn-skills-lifecycle/scripts/`).
3. **Reference material** — presets, reference sheets, and any bluepriNNts the skill ships.

Skills compose through declared dependencies. The `requires` list in the distribution manifest
names the skills a skill depends on, and `nn-preflight` is the common dependency because it owns
the activation gate every skill delegates to. See [Interaction flows](interaction-flows.md) for
the full hand-off map.

## Skills

The catalog below is generated from `manifest/source.yaml`, so it lists exactly the skills the ecosystem distributes, with their pinned versions.

<!-- generated:skills-catalog (source: manifest/source.yaml; run node scripts/generate-docs-facts.mjs) -->
**8** skills

| Skill | Version | Description |
|-------|---------|-------------|
| [`nn`](nn.md) | `V_3-4-3` | Primary Front Controller, ecosystem entry point, job loop menu ([s] Sources, [m] Models, [r] Review/Artifacts, [p] Procedures, [h] Help, [x] Cancel), system governance, and preflight readiness gate. Triggers: /nn, NN, nn, cognnitive, cognitive, start, router. |
| [`nn-sources`](nn-sources.md) | `V_3-5-4` | Ingest documents (PDF, DOCX, XLSX), normalize them into citable sources with mandatory sidecar provenance, and keep source lineage in sync. |
| [`nn-innfo`](nn-innfo.md) | `V_0-5-13` | Author, edit, and validate iNNfo knowledge with built-in step-by-step Model Creation Wizard. |
| [`nn-preflight`](nn-preflight.md) | `V_0-2-5` | Environment readiness gate (Tier 1/Tier 2/Tier 3) and canonical skill-location reference. |
| [`nn-upgrade`](nn-upgrade.md) | `V_0-4-2` | Guided, consent-gated migration of a domaiNN to the latest adopted iNNfo Level-2 blueprints. |
| [`nn-site-generator`](nn-site-generator.md) | `V_0-2-0` | Create or edit websites, add analytics, add contact forms. |
| [`nn-design-presets`](nn-design-presets.md) | `V_1-4-0` | cogNNitive visual design presets — palettes, typography, spacing. |
| [`nn-skills-lifecycle`](nn-skills-lifecycle.md) | `V_1-3-1` | Audit, update, and maintain cogNNitive skills. |
<!-- /generated:skills-catalog -->

A skill may also be **embedded** inside a bluepriNNt package under `skills/<name>/SKILL.md`, or
**referenced** as an opt-in third-party skill pinned to a commit and a tree digest. Embedded and
referenced skills are discovered through the parent chain rather than installed from the manifest;
see [nn-skills-lifecycle](nn-skills-lifecycle.md) for the difference.

## Installing and bootstrapping skills

Skills are distributed from the cogNNitive repository and pinned by commit in a bootstrap
manifest. The manifest is the **desired state**; what is actually installed on a machine is
recorded locally per skill in `~/.agents/bootstrap-state.json` (the "installed state"). The two
must agree — a skill is only up to date when its installed commit matches the pinned commit.

To install or update the manifest-pinned skills, use [nn-skills-lifecycle](nn-skills-lifecycle.md),
which wraps the bundled, zero-dependency manager:

```bash
node scripts/skills-manager.js status    # compare installed commits against the pins
node scripts/skills-manager.js install   # install missing skills at their pinned commit
node scripts/skills-manager.js update    # update outdated skills at their pinned commit
```

Every mutating command requires explicit consent; without a TTY and without `--yes`, the manager
prints `needs decision: ...` and exits without applying anything. The bootstrap manifest also
declares the `nn-mcp` bundle, which is downloaded into the agent's MCP directory and registered in
the agent's MCP configuration. For a full walkthrough, see
[Install and connect an AI agent](../how-to/install-agent.md).

> [!NOTE]
> Skills never link or symlink back to their source. Every install, update, and sync is a plain
> copy, so an installed skill cannot be edited by accident.

## Activation and the `nn` entry point

Every cogNNitive skill executes the same **canonical activation gate**, owned by
[nn-preflight](nn-preflight.md): a session greeting banner followed by a deterministic integrity
check. A consumer skill delegates to that protocol instead of duplicating it, and skips the check
when `nn` already ran it in the same session.

The ecosystem entry point is [nn](nn.md). It activates on `/nn`, `/start`, or any mention of
`cognnitive`/`cogNNitive`, runs the domain probe, and presents the job-loop menu
(`[s] Sources`, `[m] Models`, `[r] Review/Artifacts`, `[p] Procedures`, `[h] Help`, `[x] Cancel`).
From there it routes the user's intent to the owning skill. Most users only ever need to start
`nn`; the specialized skills are reached through it.

## See also

- [Interaction flows](interaction-flows.md) — how the skills hand off to one another from `nn`.
- [Install and connect an AI agent](../how-to/install-agent.md) — register the MCP server and download the skills.
- [Ecosystem architecture](../concepts/ecosystem.md) — where skills sit among the engine, MCP server, and console.
