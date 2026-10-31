# Thumbnail and Visual Asset Preproduction Pipeline

Guidelines and architectural principles for visual asset generation, identity preservation, and deterministic thumbnail rendering in video production workflows.

---

## 1. Empty Set First (Decoupled Background Environment)

Generative diffusion models suffer from stochastic contamination: if asked to generate a populated set or interview scene in a single prompt, they often hallucinate extraneous people, distorted furniture, or unwanted extras.

### Two-Step Sequential Protocol
1. **Paso 1 · Background Environment (`set_[scene].jpeg`)**:
   - Generate the room/set strictly empty.
   - **Negative Prompt Directives**: `strictly no people, empty chairs, unoccupied room, empty background, clean set, no humans`.
   - Validate lighting, atmosphere, and camera framing before proceeding.
2. **Paso 2 · Avatar / Character In-Painting (`avatar_[role]_[scene].jpeg`)**:
   - In-paint the required character or speaker onto the validated empty set using image-editing models (e.g. SDXL In-Painting / FLUX Fill / Midjourney Vary Region) with reference facial anchors.

---

## 2. Multi-Reference Identity Anchoring

To ensure character visual fidelity across multiple scenes and episodes:
1. **Canonical Neutral Portrait (`avatar_[character]_base_white.jpeg`)**:
   - Generate and maintain an isolated high-resolution portrait on a neutral/white studio background.
   - Use this single image as the primary image-prompt reference whenever placing the character into custom poses or sets.
2. **Double-Reference Composition (Interviews / Duos)**:
   - For two-person formats (e.g., interviewer and historical creator), provide both canonical portrait references explicitly to the multi-image composition model.

---

## 3. Two-Phase Thumbnail Pipeline

Direct generative diffusion of typography produces distorted, illegible text and broken brand styling. Thumbnails must decouple visual background generation from typography.

### Phase A: Clean Visual Base (16:9)
- Output: `thumbnail_[topic]_base.jpeg`
- Aspect Ratio: 16:9 (e.g. 2560x1440 or 1920x1080).
- Prompt directive: **STRICTLY NO TEXT, NO LETTERS, NO TYPOGRAPHY, NO LOGOS, NO WATERMARKS**.
- Focus purely on strong facial emotion, high-contrast character lighting, and dramatic composition.

### Phase B: Programmatic Typography Overlay
- Output: `thumbnail_[topic].jpeg`
- Tool: `node ~/.agents/skills/nn-video-script/scripts/render-thumbnail.mjs`
- Composes deterministic SVG typography over the clean base:
  - **High-impact bold headline** with heavy outer stroke (`#000000`) and drop-shadow for 100% legibility on mobile feeds.
  - **Subtitle / Metadata line** for creator, year, or episode number.
  - **Brand badge pill** (e.g. `iNNtrevistas`) anchored in the safe margin.
  - Safe-area compliance avoiding YouTube's bottom-right timestamp badge.

### CLI Usage Example
```bash
node ~/.agents/skills/nn-video-script/scripts/render-thumbnail.mjs \
  --base series/inntrevistas/assets/la-rueda/thumbnail_rueda_base.jpeg \
  --title "LA RUEDA" \
  --subtitle "Mesopotamia · 3500 a.C." \
  --badge "iNNtrevistas" \
  --out series/inntrevistas/assets/la-rueda/thumbnail_rueda.jpeg
```

---

## 4. Multi-Platform Geometry & Safe Zone (Open Gate Protocol)

To produce single-source assets reusable across horizontal (16:9), vertical (9:16), and square (1:1) formats without lossy blur-fills or microscopic text:

### Geometric Invariants
- **Common Safe Area (1080×1080)**: All critical narrative focus (speaker's face, key data visualization, web snapshot core) MUST sit inside the central 1080×1080 square. The peripheral 420 px margins serve as context bleed that crops safely according to the delivery aspect ratio.
- **Presenter Headroom Anchoring**: Human avatar portrait assets (768×1024 / 896×1200) naturally place the face in the upper third. The video engine automatically anchors presenter layers at `object-position: center 12%` in horizontal widescreen (16:9) to maintain cinematic headroom without facial decapitation, while vertical viewports (9:16) cover full-body framing.
- **Decoupled Overlays**: Never bake text, kinetic titles, or captions into raw media assets. Overlays remain responsive HTML/CSS layers rendered natively by HyperFrames per target resolution.
- **AI Media Generation Directive**: All prompts for background or subject generation should specify: `"aspect ratio 1:1, subject centered within 55% safe area, generous background padding for multi-aspect framing"`.


---

## 5. Canonical Asset Naming Convention

| File Name Pattern | Purpose |
|---|---|
| `avatar_[character]_base_white.jpeg` | Canonical isolated portrait identity anchor |
| `set_[scene].jpeg` | Unoccupied environment / set |
| `avatar_[role]_[scene].jpeg` | Character positioned within scene |
| `thumbnail_[topic]_base.jpeg` | Clean 16:9 generative base (text-free) |
| `thumbnail_[topic].jpeg` | Final composite thumbnail with programmatic typography |
| `asset_plan.md` | Generation plan, model providers, and estimated cost budget |
