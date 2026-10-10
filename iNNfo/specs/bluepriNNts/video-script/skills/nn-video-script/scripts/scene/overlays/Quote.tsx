/**
 * nn-video-script/scripts/scene/overlays/Quote.tsx
 *
 * Blockquote (`> quote: "..."`) overlay: the quoted line, optionally attributed.
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { resolveOverlayAnimation } from '../overlay-animation.mjs';

export const Quote: React.FC<{
  config: Record<string, unknown>;
  durationInFrames?: number;
  enterAnimation?: string;
  exitAnimation?: string;
}> = ({ config, durationInFrames = 0, enterAnimation, exitAnimation }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = width / 1920;
  const text = (config.text as string) || '';
  const source = (config.source as string) || '';
  const fontFamily = (config.fontFamily as string) || 'sans-serif';

  const motion = resolveOverlayAnimation({ frame, durationInFrames, enterAnimation, exitAnimation });

  if (!text) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: 96 * s,
        opacity: motion.opacity,
        transform: motion.transform,
      }}
    >
      <div
        style={{
          fontFamily,
          color: '#fff',
          fontSize: (height > width ? 52 : 64) * s,
          fontWeight: 600,
          fontStyle: 'italic',
          textAlign: 'center',
          maxWidth: height > width ? '90%' : '70%',
          textShadow: '2px 2px 0 rgba(0,0,0,0.6)',
        }}
      >
        {`\u201C${text}\u201D`}
        {source ? (
          <div style={{ fontSize: 28 * s, fontStyle: 'normal', opacity: 0.8, marginTop: 12 * s }}>
            {`\u2014 ${source}`}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
