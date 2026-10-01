# Interactive Architecture Showcase & Pipeline

Use this component to transform static marketing/docs pages into living, interactive product demonstrations inspired by Quadratic (`https://www.quadratichq.com/`).

It solves the "boring screenshot / wall of text" anti-pattern by showing the continuous flow of value in real time.

---

## 1. Anatomy of the Component

The showcase consists of two coordinated visual blocks:

1. **The Living Pipeline (Hero Canvas)**:
   - 3-stage flow: `[Sources Ingested]` ➔ `[AI / Engine Processing]` ➔ `[Living Output Artifact]`.
   - Connected by responsive animated SVG connectors with flowing dashes (`dash-flow-anim`).
   - Ambient layered backdrop: subtle radial mesh gradient + 16px dot-grid texture overlay.
   - High-contrast white floating cards with soft border strokes and deep elevation shadows.

2. **The Paradigm Shift Comparison ("Old Way" vs "New Way")**:
   - Side-by-side comparative cards with status badges (Red for pain point, Brand/Green for solution).
   - Code/syntax boxes illustrating the visceral difference between legacy fragility and structured reality.

---

## 2. CSS Stylesheet (Tokens & Animations)

Add to the site's stylesheet (adapt color variables to active `nn-design-presets` theme):

```css
/* --- Quadratic-Inspired Interactive Showcase --- */
.showcase-section {
  padding: 80px 0;
}

.badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px;
  border-radius: 9999px;
  background: var(--brand-subtle);
  border: 1px solid rgba(77, 14, 78, 0.15);
  color: var(--brand);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.flow-canvas {
  position: relative;
  border-radius: 28px;
  border: 1px solid rgba(226, 232, 240, 0.85);
  overflow: hidden;
  box-shadow: 0 30px 80px -25px rgba(0, 0, 0, 0.08), 0 20px 40px -20px rgba(0, 0, 0, 0.04);
  background: linear-gradient(135deg, var(--brand-subtle) 0%, #FAF0FA 40%, #EDE9FE 100%);
}

.flow-canvas-bg {
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(ellipse 70% 55% at 15% 15%, rgba(77, 14, 78, 0.18), transparent 60%),
    radial-gradient(ellipse 65% 50% at 85% 85%, rgba(139, 92, 246, 0.20), transparent 60%),
    radial-gradient(ellipse 50% 45% at 85% 15%, rgba(6, 182, 212, 0.15), transparent 55%);
  pointer-events: none;
}

.flow-canvas-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(17, 24, 39, 0.08) 1px, transparent 1px);
  background-size: 16px 16px;
  opacity: 0.7;
  pointer-events: none;
}

.flow-canvas-inner {
  position: relative;
  padding: 40px 32px;
  z-index: 1;
}

.flow-pipeline-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: stretch;
  gap: 0;
}

@media (max-width: 960px) {
  .flow-pipeline-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .flow-connector {
    transform: rotate(90deg);
    margin: 10px auto;
  }
}

.flow-card {
  background: #FFFFFF;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 20px;
  box-shadow: 0 10px 30px -15px rgba(17, 24, 39, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.flow-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 36px -12px rgba(77, 14, 78, 0.15);
}

.flow-card-preview {
  height: 180px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #FAFAFC;
  border-bottom: 1px solid #F2F2F7;
  position: relative;
}

.flow-card-body {
  padding: 22px 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.flow-card-body h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 6px;
}

.flow-card-body p {
  font-size: 14px;
  color: var(--ink-muted);
  line-height: 1.5;
}

.flow-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
}

.flow-connector svg {
  width: 70px;
  height: 24px;
  color: var(--brand);
}

.dash-flow-anim {
  stroke-dasharray: 4 6;
  animation: dashFlow 1.2s linear infinite;
}

@keyframes dashFlow {
  from { stroke-dashoffset: 20; }
  to { stroke-dashoffset: 0; }
}

.pulse-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: var(--brand);
  margin-left: 4px;
  vertical-align: middle;
  animation: blinkCursor 0.9s infinite;
}

@keyframes blinkCursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.metrics-bar-group {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 32px;
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px dashed #E5E7EB;
}

.metric-bar {
  flex: 1;
  background: linear-gradient(180deg, var(--brand-light, #8B5CF6), var(--brand, #4D0E4E));
  border-radius: 2px 2px 0 0;
}

/* Comparison Cards */
.compare-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 24px;
}

@media (max-width: 768px) {
  .compare-container {
    grid-template-columns: 1fr;
  }
}

.compare-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 18px;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.compare-card.highlight {
  border-color: rgba(77, 14, 78, 0.35);
  background: var(--brand-subtle, #FCF9FC);
}

.compare-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.compare-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.compare-badge.bad { background: #FEE2E2; color: #991B1B; }
.compare-badge.good { background: #DCFCE7; color: #166534; }

.compare-code {
  background: #1E1E24;
  color: #E2E8F0;
  padding: 14px;
  border-radius: 10px;
  font-family: var(--mono, monospace);
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  margin-bottom: 16px;
  flex: 1;
}

.compare-footer {
  font-size: 13px;
  color: var(--ink-muted);
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
```

---

## 3. Placement Strategy

1. **Inside Hero (Recommended)**: Place `<div class="flow-canvas">` immediately after `.hero-actions` inside the Hero container. This provides an above-the-fold interactive hook without pushing visitors to scroll.
2. **Bottom Paradigm Contrast**: Place `<div class="compare-container">` in a closing section right above the footer to reinforce why the legacy way is failing and drive final CTA conversion.
