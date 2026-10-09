/**
 * nn-video-script/scripts/scene/overlay-animation.mjs
 *
 * Pure resolver for the enter/exit motion an overlay track declares
 * (`enterAnimation` / `exitAnimation`). Components stay presentational: they call
 * this with the current frame and apply the returned opacity/transform.
 *
 * Supported names: `fade-in`/`fade-out`, `slide-in-left|right`, `slide-out-left|right`,
 * `zoom-in`/`zoom-out`. Unknown names degrade to a fade.
 */

const ENTER_FRAMES = 12;
const EXIT_FRAMES = 10;
const SLIDE_DISTANCE_PX = 60;
const ZOOM_DELTA = 0.15;

/**
 * @param {{ frame: number, durationInFrames: number, enterAnimation?: string, exitAnimation?: string }} params
 * @returns {{ opacity: number, transform: string }}
 */
export function resolveOverlayAnimation({ frame, durationInFrames, enterAnimation, exitAnimation }) {
  const total = Math.max(1, durationInFrames);
  const enterFrames = Math.min(ENTER_FRAMES, total);
  const exitFrames = Math.min(EXIT_FRAMES, total);

  let opacity = 1;
  let translateX = 0;
  let scale = 1;

  const enter = String(enterAnimation || '').toLowerCase();
  if (frame < enterFrames) {
    const t = 1 - frame / enterFrames;
    opacity *= 1 - t;
    if (enter.includes('slide')) {
      translateX = (enter.includes('right') ? 1 : -1) * SLIDE_DISTANCE_PX * t;
    } else if (enter.includes('zoom')) {
      scale = 1 - ZOOM_DELTA * t;
    }
  }

  const exit = String(exitAnimation || '').toLowerCase();
  const exitStart = Math.max(enterFrames, total - exitFrames);
  if (frame >= exitStart) {
    const span = Math.max(1, total - exitStart);
    const t = Math.min(1, (frame - exitStart) / span);
    opacity *= 1 - t;
    if (exit.includes('slide')) {
      translateX = (exit.includes('right') ? 1 : -1) * SLIDE_DISTANCE_PX * t;
    } else if (exit.includes('zoom')) {
      scale = 1 + ZOOM_DELTA * t;
    }
  }

  return {
    opacity: Math.max(0, Math.min(1, opacity)),
    transform: `translate(${translateX}px, 0px) scale(${scale})`,
  };
}
