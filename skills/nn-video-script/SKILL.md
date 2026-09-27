---
name: nn-video-script
description: |
  Forked, iNNfo-aware skill for authoring Anydeo VUS (Video Universal Specification) scripts inside a cogNNitive workspace's Series/Video hierarchy. Understands Series registries, the {{slot}} script-template convention, the folder-contract escape rule, and the check-script/vus-parse validation gates. Never restates VUS voice IDs, property names, or other syntax facts as prose — always resolves them at run time via scripts/vus-spec.mjs against the pinned spec. Triggers: video script, anydeo script, VUS, series script, nn-video-script, {{slot}}, script_template.md, finalize video, render video script.
version: "V_0-1-0"
last_updated: 2026-09-26
license: MIT
metadata:
  source_type: "fork"
  source: "innV0/VidGeNN/.agent/skills/anydeo-script-builder"
  dependency_direction: "cogNNitive -> VidGeNN only (read-only reference; VidGeNN MUST NOT reference or depend on this fork)"
vus_spec:
  version: "V_0-3-3"
  sha256: "72630624f8fb35e6ca6124249663f4e58c2f4772474ed2162007a09eb2013642"
---

# nn-video-script Skill

Forked from VidGeNN's `anydeo-script-builder`, adapted to author Anydeo VUS
scripts inside an iNNfo workspace's Series/Video production hierarchy
(`video-production-hierarchy`). Replaces the video template's previously
dangling reference to a skill that only ever existed in VidGeNN.

## 0. Activation Gate

Execute the canonical activation gate defined in `nn-preflight` (session
greeting + deterministic preflight integrity check), same as every other
cogNNitive skill.

## 1. Machine-Checkable VUS Spec Pin (No-Prose-Copy)

This skill's own documentation and prompts **never** restate voice IDs,
property names/scopes, or any other VUS-syntax fact as literal prose. Every
such fact is resolved by reading the pinned spec file at run time:

```
node scripts/vus-spec.mjs voices          # the full pinned voice list
node scripts/vus-spec.mjs props scene     # every scene-scoped property
node scripts/vus-spec.mjs props layer     # every layer-scoped property
```

The pin itself lives in this file's own frontmatter (`vus_spec.version`,
`vus_spec.sha256`) and points exclusively at
`VidGeNN/packages/core/specs/<version>.json` — never the stale
`.agent/skills/anydeo-script-builder/specs/` copy. `scripts/vus-spec.mjs`
verifies the pinned hash against the canonical file before answering any
query, and refuses to answer (loudly) on drift. This is the fix for the
`English_Deep-VoicedGentleman`-class bug: a voice ID or property name
restated in prose can silently drift from what the pinned spec actually
allows; a value resolved live from the pinned spec cannot.

When `VIDGENN_ROOT` is not set, `vus-spec.mjs` prints an explicit skip line
and exits 0 — it never probes a default path.

## 2. Scope of This Skill in the Authoring Workflow

This skill owns **authoring, gating, and finalizing** one video's
`script.md` inside a Series folder. The generic script-generation procedure
that sequences Frame → Author → Validate → Register Script → Plan Assets & Costs (`asset_plan.md`) → Render → Finalize
lives in the video template's own procedure document
(`iNNfo/specs/templates/video/procedures/generate_anydeo_script_NN.md`) —
this skill is what that procedure delegates to for the authoring and
validation steps:

1. **Author** `script.md` from the Series' `script_template.md`, following
   the `{{slot}}` convention (`references/series-template-convention.md`)
   and this file's syntax notes (`references/vus-authoring-notes.md`).
2. **Validate**, in order:
   ```
   node scripts/check-script.mjs <script.md> --series-root <series-dir>
   node scripts/vus-parse.mjs <script.md>
   ```
   `check-script.mjs` MUST pass before `vus-parse.mjs` runs — an unresolved
   `{{...}}` placeholder is invisible to the VUS grammar (it parses as
   ordinary narration), so the placeholder gate is the only thing that
   catches it.
3. **Finalize**, once VidGeNN has rendered the script:
   ```
   node scripts/finalize-video.mjs --video-dir <video-dir> [--ref <r>] [--force-thumbnail]
   ```
   Prints the exact field values (`master::`, `thumbnail::`, `voiceover::`)
   to hand to the model-writing tool (innfo-mcp). This script never edits
   the model file itself.

## 3. Script Structure (order matters)

1. `//ANYDEO_SPEC: <pinned-version>` — compliance header, MUST be the very
   first line. See `references/vus-authoring-notes.md` for why this is
   load-bearing beyond just documentation.
2. Optional reusable property bundles and templates, declared before the
   global video-level block.
3. The global video-level block (project-wide settings).
4. Scenes (`@`), grouped under section headers, each optionally carrying
   visual/audio layers (`@@`).

Property names are always scope-checked against the pinned spec
(`node scripts/vus-spec.mjs props <scope>`) — never assumed from memory or
copied from an older script.

## 4. Folder Contract (D4)

Three-level asset scoping (workspace / series / video), the no-upward-escape
rule, and the ephemeral `renders/` / `.anydeo/` directories are all detailed
in `references/folder-contract.md`. `scripts/check-script.mjs`'s asset-escape
check is the mechanical enforcement of the escape rule — read that file
before authoring a script that references any asset outside its own folder.

## 5. Series/Video Registration

A Video's owning Series is a Level-3 `video` model file carrying a `series:`
frontmatter block (AD1) — Series is not a separate template, and this skill
does not ship one (`video-production-hierarchy`). A Video's Subject is
referenced generically through the model's `sources::` field (AD2); this
skill does not standardize Subject content and never assumes a particular
Subject template shape.

## 6. Tooling Reference

| Script | Purpose |
|---|---|
| `scripts/check-script.mjs` | Zero-Unresolved-Placeholder Gate + No-Upward-Escape Rule. Exits 1 with `line:col` findings on the first failing category. |
| `scripts/vus-parse.mjs` | Runs the real `ScriptParser` (via `npx tsx` against `$VIDGENN_ROOT`) and requires zero issues. Skips explicitly (exit 0) when `VIDGENN_ROOT` is unset. |
| `scripts/vus-spec.mjs` | The only place this skill reads VUS-syntax facts. `voices` / `props <scope>` queries against the pinned, hash-verified spec. |
| `scripts/finalize-video.mjs` | Promotes rendered `master`/`thumbnail`/`voiceover` out of `renders/<ref>/` into the video's own folder. |

Run any script with no arguments (or a bad one) to see its usage banner.

## 7. VidGeNN Stays Unaware of This Fork

The dependency direction is cogNNitive → VidGeNN only. VidGeNN is read-only
reference material: this skill reads its `packages/core/specs/*.json` (via
`VIDGENN_ROOT`) and, only during local development/spike work, its
TypeScript parser source for `vus-parse.mjs`. Nothing in VidGeNN ever
references this skill, and nothing this skill writes touches the VidGeNN
checkout.
