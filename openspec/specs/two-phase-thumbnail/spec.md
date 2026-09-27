# Spec: Two-Phase Thumbnail Pipeline & Programmatic Renderer

## Purpose

Defines the two-phase generation process for video thumbnails, separating visual diffusion generation from deterministic typography and branding composition to guarantee readability at small scale (YouTube / mobile feeds).

## Requirements

### REQ-1: Two-Phase Separation
1. **Phase A (Base Visual)**: The base thumbnail (`thumbnail_[topic]_base.jpeg`) MUST be generated as a 16:9 visual composition without text. The prompt MUST strictly forbid generative text, typography, letters, and watermarks. Multi-face reference anchoring is applied here.
2. **Phase B (Programmatic Composition)**: Final typography and branding overlays MUST be rendered programmatically via the `render-thumbnail.mjs` CLI tool over the clean Phase A base image.

### REQ-2: Programmatic Typography Tool (`scripts/render-thumbnail.mjs`)
The `render-thumbnail.mjs` tool MUST:
1. Accept input parameters via CLI:
   - `--base <path>` (Required): Path to clean base image.
   - `--title <string>` (Required): Primary headline (e.g. `LA BRÚJULA` or `THE COMPASS`).
   - `--subtitle <string>` (Optional): Secondary line, author, or year (e.g. `Shen Kuo · 1086`).
   - `--out <path>` (Required): Target output path for the composed image.
   - `--badge <string>` (Optional): Brand pill label (e.g. `iNNtrevistas`).
   - `--width <number>` (Optional, default: 2560): Target canvas width.
   - `--height <number>` (Optional, default: 1440): Target canvas height.
2. Render high-impact typography with:
   - Bold sans-serif styling.
   - High-contrast text stroke / outer contour (dark stroke on light text, or drop shadow) ensuring readability across bright and dark backgrounds.
   - Translucent brand pill badge styling.
3. Use SVG vector templating composed over the base image via `sharp` for 100% deterministic pixel output.
4. Scale and fit the base image without distortion (cover/fit mode preserving 16:9 aspect ratio).
5. Output valid JPEG / PNG formatted files matching the `--out` extension.
