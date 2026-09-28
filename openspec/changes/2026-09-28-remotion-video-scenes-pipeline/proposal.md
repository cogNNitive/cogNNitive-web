# SDD Proposal: Remotion Video Scenes & Parallax Motion Pipeline

## 1. Context & Motivation

In current video production workflows within the cogNNitive ecosystem (specifically **VidGeNN / Anydeo** scripts and video templates), visual effects for static images and scene transitions have traditionally relied on FFmpeg filtergraphs (`zoompan`, `drawtext`, `fade`).

### The Technical Problem
- **FFmpeg Temporal Aliasing (Blinking/Jitter):** The FFmpeg `zoompan` filter calculates camera coordinates on discrete integer grids without true subpixel antialiasing or bicubic frame-by-frame resampling. On detailed images, this causes severe pixel-snapping, shimmering edges, and noticeable blinking during motion.
- **Complex & Inflexible Text Styling:** FFmpeg's `drawtext` filter lacks modern typographic controls, responsive layouts, spring-physics easing, and dynamic multi-layer hierarchy.
- **Monolithic Render Scripts:** Generating long FFmpeg filter strings is error-prone, hard to debug, and disconnected from component-based UI design systems.

### The Solution: Remotion Scene Composition Engine
Remotion executes React components inside headless Chromium, providing:
1. **GPU-Accelerated Subpixel Interpolation:** Continuous floating-point transforms (`scale`, `translate3d`, `rotate`) with smooth bezier easing curves (`Easing.bezier`) and spring physics (`spring`), eliminating blinking completely.
2. **Editorial Chapter Transitions:** Elegant animated chapter cards with spring-scaled numbers, expanding divider lines, glowing nodes, and elevated typography.
3. **Cinematic Image Motion (Parallax Pan & Ken Burns):** Subpixel pan & zoom with optional multi-layer depth (foreground subject cutout + ambient background blur).
4. **Deterministic Multi-Track Synchronization:** Perfect frame-accurate alignment with interview voiceover audio tracks.

---

## 2. Scope & Boundaries

### Included (In Scope)
- **cogNNitive Repo:**
  - Update video template specs (`iNNfo/specs/templates/video/spec_NN.md`) and procedure guides (`procedures/_produccion_guiones_entrevista.md`, `generar_guion_anydeo_...`).
  - Standardize Remotion scene components: `ChapterTitle`, `ParallaxPanScene`, `ElementAnimationScene`.
  - Extend script markdown / JSON format to declare scene visual types and Remotion motion parameters.
- **VidGeNN Repo:**
  - Add Remotion scene renderer runner to Anydeo's video synthesis pipeline.
  - Settle responsibility: Remotion handles visual scene generation (MP4/frames); FFmpeg handles final audio-video multiplexing.

### Excluded (Out of Scope)
- Rewriting audio synthesis (TTS / ElevenLabs) — audio remains an input timing source.
- Altering core iNNfo metamodel grammar — properties are captured via existing field semantics (`image::`, `animation::`, `scene_type::`).

---

## 3. Success Criteria

1. **Zero Blinking:** Rendered image scenes exhibit smooth continuous motion with no temporal pixel jitter.
2. **Modular Scene Taxonomy:** Clean separation of `chapter_title`, `image_motion`, and `element_animation` scenes.
3. **Automated End-to-End Pipeline:** Scripts compiled by cogNNitive video templates can be rendered into full MP4 videos via Remotion CLI / VidGeNN runner.
