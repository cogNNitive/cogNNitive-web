/**
 * nn-video-script/scripts/scene/overlays/Broll.tsx
 *
 * B-roll overlay: draws the media path carried in the manifest, honoring `fit`
 * and `position`. Images get a subtle Ken-Burns zoom-in over the overlay's life.
 * With `fit: contain` the whole asset is shown with a margin, presented as a
 * modern "card" (rounded corners + drop shadow) so it floats over the scene.
 * The manifest already holds a staged, bundle-relative name, so `staticFile()` is
 * the only path work here — the component stays presentational.
 */

import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { resolveOverlayAnimation } from '../overlay-animation.mjs';

const POSITION: Record<string, React.CSSProperties> = {
  bottom: { justifyContent: 'flex-end' },
  top: { justifyContent: 'flex-start' },
  center: { justifyContent: 'center' },
};

export const Broll: React.FC<{
  config: Record<string, unknown>;
  durationInFrames?: number;
  enterAnimation?: string;
  exitAnimation?: string;
}> = ({ config, durationInFrames = 0, enterAnimation, exitAnimation }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const s = width / 1920;
  const assetPath = (config.assetPath as string) || '';
  const fit = (config.fit as string) || 'cover';
  const position = (config.position as string) || 'bottom';
  const source = (config.source as string) || '';
  const zoomIn = config.zoomIn === undefined ? true : config.zoomIn !== false;

  const motion = resolveOverlayAnimation({ frame, durationInFrames, enterAnimation, exitAnimation });

  if (!assetPath) return null;

  const isContain = fit === 'contain';
  // Subtle Ken-Burns zoom-in across the overlay's life (disabled with `zoomIn: false`).
  const progress = durationInFrames > 0 ? Math.min(1, frame / durationInFrames) : 0;
  const zoom = zoomIn ? 1 + 0.08 * progress : 1;

  const card: React.CSSProperties = isContain
    ? {
        borderRadius: 28 * s,
        overflow: 'hidden',
        boxShadow: '0 30px 70px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.45)',
        border: `${Math.max(2, 3 * s)}px solid rgba(255,255,255,0.14)`,
        background: 'rgba(255,255,255,0.04)',
      }
    : {};

  return (
    <AbsoluteFill style={{ opacity: motion.opacity, transform: motion.transform }}>
      <AbsoluteFill
        style={{ ...(POSITION[position] || POSITION.bottom), padding: isContain ? 64 * s : 0 }}
      >
        <div style={{ width: '100%', height: '100%', ...card }}>
          <Img
            src={staticFile(assetPath)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: fit as 'cover' | 'contain',
              transform: `scale(${zoom})`,
            }}
          />
        </div>
      </AbsoluteFill>
      {source ? (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-end', padding: 32 * s }}>
          <div
            style={{
              background: 'rgba(10,10,15,0.75)',
              color: '#fff',
              fontFamily: 'sans-serif',
              fontSize: 24 * s,
              padding: `${8 * s}px ${16 * s}px`,
            }}
          >
            {source}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
