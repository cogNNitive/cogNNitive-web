# Video Folder Contract (D4)

Normative source: spec `video-folder-contract`. This file is the
authoring-facing summary an agent reads while drafting a script or running
the finalize step; it does not redefine the contract, only restates its
shape close to the tools that enforce it.

## Three-level asset scoping

Assets are scoped at exactly three levels:

- **Workspace scope** — shared across every series in the workspace. Never
  referenced directly from a `script.md`; if a workspace-level asset is
  needed by a series, it is staged into that series' own `shared/` folder
  first (a copy, not a live reference — see AD3/AD1 in `design.md`).
- **Series scope** — shared across every video in one series
  (`series/<series-slug>/shared/`, plus the series' own registry model,
  `script_template.md`, and `series_rules.md`).
- **Video scope** — owned by exactly one video. Because Series is
  implemented as a Level-3 `video` model file (AD1), `{modelDir}` resolution
  is unchanged, so a video's own folder resolves to
  `series/<series-slug>/assets/<video-slug>/` — the standard iNNfo
  `{modelDir}/assets/{slug}/` rule, applied where the Series model happens to
  live.

```
<workspace>/
  series/<series-slug>/
    <SeriesName>_V_x-y-z_video_NN.md   # Series registry + Video Elements (modelDir)
    script_template.md                  # {{slot}} template (series-template-convention.md)
    series_rules.md                     # series-wide rules only
    shared/                              # series scope
    assets/<video-slug>/                 # video scope = Element-owned folder
      script.md  asset_plan.md  master.mp4  thumbnail.png  voiceover.<ext>  media/
      renders/<ref>/  .anydeo/           # ephemeral — see below
```

## The no-upward-escape rule

Every relative asset path inside a `script.md` MUST resolve inside that
video's own Series folder tree (`series/<series-slug>/`). A path that climbs
above it — reaching another series, or the workspace root — is invalid, even
if the target file happens to exist there.

- `../../shared/x.mp4` (staying inside the series) — **allowed**.
- `../../../../assets/x.mp4` (escaping the series folder) — **rejected**.
- `http(s)://...` — **allowed** (external references are not a folder-escape
  concern).
- `file://...`, an absolute path, or `asset://...` — **rejected outright**,
  regardless of what they resolve to.

`scripts/check-script.mjs` enforces this mechanically as the last of its four
checks (after the placeholder gate, the leftover-comment gate, and the
header check) — never assume a path is fine because it "looks relative"; run
the check.

## Ephemeral engine directories are not Artifacts

`renders/` and `.anydeo/` — wherever they occur inside a video or series
folder — are gitignored, transient engine output. They are never treated as
iNNfo Artifacts, never scanned as knowledge inputs or sources, and never
referenced by a Video Element's own fields once finalize has run. The
generic procedure (and this skill's own tooling) is responsible for ensuring
`.gitignore` covers `**/renders/` and `**/.anydeo/` in any workspace that
produces videos.

## The finalize/register step

`scripts/finalize-video.mjs` is the mechanical promotion step: it copies
`master`, `thumbnail`, and `voiceover` out of a render's `renders/<ref>/`
directory into the video's own folder, using a temp-file-then-rename copy so
a partially-written file is never mistaken for a finished one. It never
writes to the model file itself — that stays a single-writer responsibility
(innfo-mcp applies the field values the script prints). See the script's own
usage banner for the exact CLI contract (`--video-dir`, `--ref`,
`--force-thumbnail`).
