/**
 * nn-video-script/scripts/scene-transition.mjs
 *
 * Pure resolver that turns a Scene's manifest `transition` descriptor into a GSAP
 * tween applied to the scene Sub-composition's inner wrapper (`#root`), NEVER to
 * the timed `.clip` host element (the HyperFrames contract forbids tweening
 * `display`/`visibility`/`autoAlpha` on a `.clip`).
 *
 * Supported: `fade`, `slide-left`, `slide-right`, `wipe`, `none`.
 */

export const SUPPORTED_TRANSITIONS = ['fade', 'slide-left', 'slide-right', 'wipe', 'none'];

/** Default easing when the manifest does not carry one (mirrors the compiler default). */
const DEFAULT_EASING = 'power2.out';

const roundMs = (seconds) => Math.round(seconds * 1000) / 1000;

/**
 * @param {{ type?: string, durationInFrames?: number, easing?: string } | null | undefined} transition
 * @param {number} [fps=30]
 * @returns {{ type: string, seconds: number, js: string } | null} null for `none`/absent/unknown.
 */
export function sceneTransitionFragment(transition, fps = 30) {
  const type = String(transition?.type || 'none').toLowerCase();
  if (type === 'none') return null;
  const fpsN = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const frames = Number(transition?.durationInFrames);
  const seconds = roundMs((Number.isFinite(frames) && frames > 0 ? frames : Math.round(fpsN * 0.5)) / fpsN);
  const ease = String(transition?.easing || DEFAULT_EASING);
  const target = '#root';

  switch (type) {
    case 'fade':
      return {
        type,
        seconds,
        js: `tl.fromTo('${target}', { opacity: 0 }, { opacity: 1, duration: ${seconds}, ease: '${ease}' }, 0);`,
      };
    case 'slide-left':
      return {
        type,
        seconds,
        js: `tl.fromTo('${target}', { xPercent: 8, opacity: 0.6 }, { xPercent: 0, opacity: 1, duration: ${seconds}, ease: '${ease}' }, 0);`,
      };
    case 'slide-right':
      return {
        type,
        seconds,
        js: `tl.fromTo('${target}', { xPercent: -8, opacity: 0.6 }, { xPercent: 0, opacity: 1, duration: ${seconds}, ease: '${ease}' }, 0);`,
      };
    case 'wipe':
      return {
        type,
        seconds,
        js: `tl.fromTo('${target}', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: ${seconds}, ease: '${ease}' }, 0);`,
      };
    default:
      return null;
  }
}
