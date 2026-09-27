# Tasks: Video Asset & Programmatic Thumbnail Pipeline

- [x] 1. Core Tooling Implementation <!-- id: task-1 -->
  - [x] 1.1 Implement `skills/nn-video-script/scripts/render-thumbnail.mjs` with SVG templating and `sharp` composition engine. <!-- id: task-1.1 -->
  - [x] 1.2 Support CLI options: `--base`, `--title`, `--subtitle`, `--out`, `--badge`, `--width`, `--height`. <!-- id: task-1.2 -->
  - [x] 1.3 Add XML escaping, stroke, drop shadow, and aspect-ratio preserving logic. <!-- id: task-1.3 -->

- [x] 2. Unit Testing & Verification <!-- id: task-2 -->
  - [x] 2.1 Create `skills/nn-video-script/test/render-thumbnail.test.mjs`. <!-- id: task-2.1 -->
  - [x] 2.2 Test argument parsing, SVG generation, text escaping, and file output rendering. <!-- id: task-2.2 -->
  - [x] 2.3 Run test suite via `node skills/nn-video-script/test/render-thumbnail.test.mjs`. <!-- id: task-2.3 -->

- [x] 3. Skill & Reference Documentation <!-- id: task-3 -->
  - [x] 3.1 Create `skills/nn-video-script/references/thumbnail-and-asset-pipeline.md` detailing Empty Set First, Two-Phase Thumbnail, and asset naming conventions. <!-- id: task-3.1 -->
  - [x] 3.2 Update `skills/nn-video-script/SKILL.md` tooling reference table and workflow instructions. <!-- id: task-3.2 -->

- [x] 4. Video Procedure & Template Updates <!-- id: task-4 -->
  - [x] 4.1 Update `iNNfo/specs/templates/video/procedures/generate_anydeo_script_NN.md` to incorporate the Empty Set First precondition and Two-Phase Thumbnail workflow. <!-- id: task-4.1 -->
  - [x] 4.2 Validate model integrity and run `node scripts/verify.js`. <!-- id: task-4.2 -->
