# Video Folder Contract

Normative source: capability `video-folder-contract`. This file is the
authoring-facing summary an agent reads while drafting a script or finalizing an
episode; it does not redefine the contract, only restates its shape close to the
tools that enforce it.

## Canonical layout

```
<domain>/
  domaiNN_NN.md  video-defaults_NN.md  video-guard.json  .gitignore
  .cognnitive/{cache/video/{tts,images,temp}, video-ledger.jsonl, pending-predictions.jsonl, locks/}
  sounds/  components/  frames/  procedures/  assets/<library>/     # optional, plus any other domaiNN content
  series/<s>/
    <s>_scope_NN.md                        # the only series anchor (frontmatter `scope: true`)
    shared/<kind>/  sounds/  components/  frames/  procedures/      # optional
    assets/<slug>/
      <slug>_video-script_<s>_NN.md        # the Video record and its script
      draft.json  reviewed.json  review_console.html  draft_thumbs/
      media/  animations/<project>/
      asset_plan.md  asset_plan.approved.json
      description.md                        # the publication body
      <slug>_1920x1920.mp4                  # the master
      <slug>_1080x1920.mp4 <slug>_1920x1080.mp4 <slug>_1080x1080.mp4   # derived
      <slug>_thumbnail_2560x1440.png  <slug>_thumbnail_1080x1920.png
      build/                                # engine output, gitignored
        .nn-build  manifest.json  render.tmp.mp4
        hyperframes/{index.html, compositions/, components/, authored/, assets/, .nn-emit.json, .hyperframes/}
```

Three naming classes, and nothing outside them:

| Class | Rule |
|---|---|
| Domain-indexed documents (`_NN.md`) | `<stem>_<blueprint-or-role>_NN.md` with a domain-unique kebab-case stem |
| Working files inside an episode | fixed `snake_case` role names, no slug, no `V_` |
| Deliverables that leave the episode | `<slug>_<what>_<W>x<H>.<ext>` by TRUE dimensions; blur adds `_blur` |

Folders are lowercase, plural when they hold many items (`assets`, `sounds`,
`components`, `frames`, `animations`, `procedures`) and singular for mass nouns
(`media`, `shared`, `build`). Every name the contract produces is English.

## Three-level asset scoping

- **Domain** — shared by every series, at the domain root (`sounds/`,
  `components/`, `frames/`, `assets/<library>/`).
- **Series** — shared by the episodes of one series: `series/<s>/shared/<kind>/`,
  `series/<s>/sounds/`, `components/`, `frames/`. The series level of the cascade
  comes from the scope document; a legacy `series_NN.md`, `series_rules.md` or
  `script_template.md` anchors nothing.
- **Episode** — owned by one video, in `series/<s>/assets/<slug>/`.

## The no-upward-escape rule

Every relative asset path inside a script MUST resolve inside that episode's
series tree (`series/<series-slug>/`). A path that climbs above it — reaching
another series or the domain root — is invalid, even if the file exists.

- `../../shared/x.mp4` (staying inside the series) — **allowed**.
- `../../../../assets/x.mp4` (escaping the series folder) — **rejected**.
- `http(s)://...` — **allowed**.
- `file://...`, an absolute path, or `asset://...` — **rejected outright**.

The engine applies this as a pre-compile guard; never assume a path is fine
because it "looks relative".

## Engine output lives only under build/

`build/` holds every file the engine generates: `.nn-build`, `manifest.json`,
`render.tmp.mp4` during a render, and the emitted `hyperframes/` project (whose
`assets/` IS the staging layer, so nothing is copied twice). `asset_plan.approved.json`
stays at the episode root: it is a tracked governance file that survives deleting
`build/`.

The episode `.gitignore` block is `**/build/`, `**/draft_thumbs/` and
`.cognnitive/cache/`. `audio/` is NOT ignored: real episodes hold authored audio
there.

## One master, derived delivery files

The only master is `<slug>_1920x1920.mp4`, whose size is declared in the domain
Video Defaults (`master_resolution:: 1920x1920`). Everything else is a pure
function of it: the vertical and horizontal files are the central 1080 crops of
the Open Gate safe square, and the square file is a lanczos scale. No format is
rendered on its own; there is no `--format`, no 9:16 recompile and no separate
vertical master.

## Finalize

`scripts/finalize-video.mjs <episode-dir> [--formats …] [--fill crop|blur] [--force] [--dry-run]`
reads the master and `build/manifest.json`, derives the delivery files, prints the
`description.md` chapters and the `master::`/`thumbnail::` values. It copies
nothing, writes no model, and refuses a manifest that came from another script or
is older than the script.

## Cost-approval artifact

Next to the script, `asset_plan.md` carries a `plan_hash` and
`asset_plan.approved.json` records the approval `compile` requires before any
billable synthesis. Neither is part of finalize. The `video-guard.json`,
`.cognnitive/video-ledger.jsonl` and `.cognnitive/cache/video/` live at the domain
root, not in a series or episode folder. See `cost-guardrails.md`.
