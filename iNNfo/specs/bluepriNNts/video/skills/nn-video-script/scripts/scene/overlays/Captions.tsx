/**
 * nn-video-script/scripts/scene/overlays/Captions.tsx
 *
 * TikTok-style word-level captions. The manifest carries plain narration text;
 * this component splits it into evenly-timed tokens across its own duration
 * (word-accurate timings arrive via a future captions.json staticFile).
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { resolveOverlayAnimation } from '../overlay-animation.mjs';

export const Captions: React.FC<{
  config: Record<string, unknown>;
  durationInFrames: number;
  enterAnimation?: string;
  exitAnimation?: string;
}> = ({ config, durationInFrames, enterAnimation, exitAnimation }) => {
  const frame = useCurrentFrame();
  const text = ((config.text as string) || '').trim();
  const size = Number(config.size) || 80;
  const highlight = (config.highlight as string) || '#39E508';
  const fontFamily = (config.fontFamily as string) || 'sans-serif';

  const words = text ? text.split(/\s+/) : [];
  const activeIdx = words.length
    ? Math.min(words.length - 1, Math.floor((frame / Math.max(1, durationInFrames)) * words.length))
    : -1;
  const enter = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  const motion = resolveOverlayAnimation({ frame, durationInFrames, enterAnimation, exitAnimation });
  const opacity = enter * motion.opacity;

  if (!words.length) return null;

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 120, opacity }}>
      <div
        style={{
          fontSize: size,
          fontWeight: 800,
          fontFamily,
          textAlign: 'center',
          color: '#fff',
          maxWidth: '90%',
          textShadow: '3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
          lineHeight: 1.2,
        }}
      >
        {words.map((w, i) => (
          <span key={i} style={{ color: i === activeIdx ? highlight : '#fff' }}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
