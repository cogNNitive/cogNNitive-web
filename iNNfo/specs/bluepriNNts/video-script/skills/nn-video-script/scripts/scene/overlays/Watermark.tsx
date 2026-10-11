/**
 * nn-video-script/scripts/scene/overlays/Watermark.tsx
 *
 * Small persistent text notice (e.g. an AI-disclosure line) anchored to an edge.
 * Purely presentational: configuration and timing come from the manifest overlay.
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { resolveOverlayAnimation } from '../overlay-animation.mjs';

const POSITION: Record<string, React.CSSProperties> = {
  top: { justifyContent: 'flex-start', alignItems: 'center' },
  center: { justifyContent: 'center', alignItems: 'center' },
  bottom: { justifyContent: 'flex-end', alignItems: 'center' },
  'bottom-left': { justifyContent: 'flex-end', alignItems: 'flex-start' },
  'bottom-right': { justifyContent: 'flex-end', alignItems: 'flex-end' },
};

export const Watermark: React.FC<
  {
    config: Record<string, unknown>;
    durationInFrames?: number;
    enterAnimation?: string;
    exitAnimation?: string;
  }
> = ({ config, durationInFrames = 0, enterAnimation, exitAnimation }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const s = width / 1920;
  const text = (config.text as string) || '';
  const position = (config.position as string) || 'bottom';

  const motion = resolveOverlayAnimation({ frame, durationInFrames, enterAnimation, exitAnimation });

  return (
    <AbsoluteFill
      style={{
        padding: 40 * s,
        opacity: motion.opacity,
        transform: motion.transform,
        ...(POSITION[position] || POSITION.bottom),
      }}
    >
      <div
        style={{
          background: 'rgba(11,15,25,0.6)',
          borderRadius: 8 * s,
          padding: `${10 * s}px ${20 * s}px`,
          color: '#ffffff',
          fontFamily: 'sans-serif',
          fontSize: 24 * s,
          letterSpacing: 0.5,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
