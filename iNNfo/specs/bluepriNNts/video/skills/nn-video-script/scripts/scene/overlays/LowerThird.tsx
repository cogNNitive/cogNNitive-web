/**
 * nn-video-script/scripts/scene/overlays/LowerThird.tsx
 *
 * Simple lower-third name/label graphic anchored to a corner.
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { resolveOverlayAnimation } from '../overlay-animation.mjs';

const POSITION: Record<string, React.CSSProperties> = {
  'bottom-left': { justifyContent: 'flex-end', alignItems: 'flex-start' },
  'bottom-right': { justifyContent: 'flex-end', alignItems: 'flex-end' },
  'bottom-center': { justifyContent: 'flex-end', alignItems: 'center' },
};

export const LowerThird: React.FC<
  {
    config: Record<string, unknown>;
    durationInFrames?: number;
    enterAnimation?: string;
    exitAnimation?: string;
  }
> = ({ config, durationInFrames = 0, enterAnimation, exitAnimation }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = width / 1920;
  const title = (config.title as string) || '';
  const subtitle = (config.subtitle as string) || '';
  const accent = (config.accentColor as string) || '#3b82f6';
  const position = (config.position as string) || 'bottom-left';
  const fontFamily = (config.fontFamily as string) || 'sans-serif';
  const fontSize = Number(config.fontSize) || 40;
  const stroke = config.textStroke as string | undefined;

  const motion = resolveOverlayAnimation({ frame, durationInFrames, enterAnimation, exitAnimation });

  return (
    <AbsoluteFill
      style={{
        padding: 64 * s,
        opacity: motion.opacity,
        transform: motion.transform,
        ...(POSITION[position] || POSITION['bottom-left']),
      }}
    >
      <div
        style={{
          background: 'rgba(10,10,15,0.82)',
          borderLeft: `${Math.max(4, 8 * s)}px solid ${accent}`,
          padding: `${18 * s}px ${28 * s}px`,
          color: '#fff',
          fontFamily,
          ...(stroke ? { WebkitTextStroke: `1px ${stroke}` } : {}),
          maxWidth: height > width ? '90%' : '60%',
        }}
      >
        <div style={{ fontSize: fontSize * s, fontWeight: 700 }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 26 * s, opacity: 0.8 }}>{subtitle}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
