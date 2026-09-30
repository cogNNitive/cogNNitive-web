---
title: "nn-video-script — cogNNitive-video VUS Script Authoring"
description: "Forked, iNNfo-aware authoring of cogNNitive-video VUS (Video Universal Specification) scripts inside a workspace's Series/Video production hierarchy."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn-video-script
generator: https://cognnitive.com/skills/nn-design-presets
---

# nn-video-script

**Skill**: `nn-video-script` · **Role**: Video Script Authoring & Validation

Authors cogNNitive-video VUS scripts inside an iNNfo workspace's Series/Video
production hierarchy. The VUS parser and the pinned VUS spec ship in this
repository (`@cognnitive/innfo-video-parser`), so validation runs with no
external checkout or environment variable.

---

## Canonical Activation Gate Protocol (MANDATORY)

Delegates to `nn-preflight` (session greeting + deterministic preflight
integrity check), same as every other cogNNitive skill.

---

## Workflow

1. **Author** `script.md` from the Series' `script_template.md`, following
   the `{{slot}}` script-template convention and the folder-contract
   escape rule.
2. **Validate**, in order: the placeholder/escape gate
   (`scripts/check-script.mjs`), then the real VUS parser
   (`scripts/vus-parse.mjs`).
3. **Finalize**, once the cogNNitive-video engine has rendered the script: promote
   `master`/`thumbnail`/`voiceover` out of the render folder into the
   video's own folder (`scripts/finalize-video.mjs`).
4. **Closing retrospective**: proactively offer to analyze the authoring
   session for concrete improvements to Series rules or templates.

## Core Rules

- Never restates VUS voice IDs, property names, or other syntax facts as
  prose — every such fact is resolved at run time via `scripts/vus-spec.mjs`
  against the pinned, hash-verified spec.
- The placeholder gate (`check-script.mjs`) MUST pass before the VUS parser
  runs — an unresolved `{{...}}` placeholder is invisible to VUS grammar.
- Three-level asset scoping (workspace / series / video) with a
  no-upward-escape rule; assets never reference outside their own folder.
