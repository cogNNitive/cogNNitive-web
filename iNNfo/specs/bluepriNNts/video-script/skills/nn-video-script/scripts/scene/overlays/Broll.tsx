/**
 * nn-video-script/scripts/scene/overlays/Broll.tsx
 *
 * Blockquote (`> broll: <path> [source="..."]`) overlay: draws the media path
 * carried in the event payload, honoring `fit` and `position` from the manifest.
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
  const { width, height } = useVideoConfig();
  const s = width / 1920;
  const assetPath = (config.assetPath as string) || '';
  const fit = (config.fit as string) || 'cover';
  const position = (config.position as string) || 'bottom';
  const source = (config.source as string) || '';

  const motion = resolveOverlayAnimation({ frame, durationInFrames, enterAnimation, exitAnimation });

  if (!assetPath) return null;

  return (
    <AbsoluteFill style={{ opacity: motion.opacity, transform: motion.transform }}>
      <AbsoluteFill style={POSITION[position] || POSITION.bottom}>
        <Img src={staticFile(assetPath)} style={{ width: '100%', height: '100%', objectFit: fit as 'cover' | 'contain' }} />
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
