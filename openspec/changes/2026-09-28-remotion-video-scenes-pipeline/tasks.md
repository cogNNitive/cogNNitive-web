# SDD Tasks: Remotion Video Scenes & Parallax Motion Pipeline

## Phase 1: Canonical Components & Architecture (Done)
- [x] **T-01:** Design and implement `ChapterTitle.tsx` Remotion component with spring scale, expanding lines, and subtitle elevation.
- [x] **T-02:** Design and implement `ParallaxPanScene.tsx` Remotion component with subpixel GPU transforms (anti-blinking) and typography overlay.
- [x] **T-03:** Build interactive multi-scene demonstration player in `temp/remotion/index.html`.
- [x] **T-04:** Document Remotion motion patterns in `procedures/_reference_remotion_animations.md`.

## Phase 2: Video Template & Script Procedures (`cogNNitive`) (Done)
- [x] **T-05:** Update `iNNfo/specs/templates/video/spec_NN.md` to specify Remotion scene types (`chapter_title`, `image_motion`, `element_animation`).
- [x] **T-06:** Update interview script generation procedure `procedures/_produccion_guiones_entrevista.md` to emit Remotion-ready scene descriptors with chapter title cards before each major section.
- [x] **T-07:** Update `procedures/generar_guion_anydeo_V_0-1-0_procedures_NN.md` to output Remotion scene manifests instead of legacy FFmpeg filter strings.

## Phase 3: VidGeNN / Anydeo Rendering Pipeline (`VidGeNN`) (Done)
- [x] **T-08:** Add Remotion scene compiler service in VidGeNN to map script descriptors into dynamic `<Sequence>` blocks.
- [x] **T-09:** Add CLI render command (`npx remotion render`) and schema properties.
- [x] **T-10:** Document multiplexer step in VidGeNN to stitch Remotion MP4 video stream with ElevenLabs/TTS audio tracks.

## Phase 4: Validation & End-to-End Verification (Done)
- [x] **T-11:** Run test interview render on `iNNtrevistas` model and verify 100% smooth, anti-blinking playback on sample video outputs (`temp/remotion/index.html`).
- [x] **T-12:** Verify unit test suites and regression gates across both repositories.

