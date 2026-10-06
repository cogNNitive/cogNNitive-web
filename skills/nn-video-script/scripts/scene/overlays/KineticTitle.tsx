/**
 * skills/nn-video-script/scripts/scene/overlays/KineticTitle.tsx
 *
 * Centered heading/subheading with a simple scale-up entrance. Motion is kept
 * minimal on purpose (no spring choreography in this change).
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { resolveKineticTitleLayout } from '../kinetic-title-layout.mjs';

const THEME: Record<string, { color: string; background: string }> = {
  dark: { color: '#ffffff', background: 'rgba(0,0,0,0.55)' },
  light: { color: '#111111', background: 'rgba(255,255,255,0.85)' },
  accent: { color: '#ffffff', background: 'rgba(59,130,246,0.85)' },
};

export const KineticTitle: React.FC<{ config: Record<string, unknown>; fps?: number }> = ({ config }) => {
  const frame = useCurrentFrame();
  const heading = (config.heading as string) || '';
  const subheading = (config.subheading as string) || '';
  const theme = THEME[(config.theme as string) || 'dark'] || THEME.dark;
  const fontFamily = (config.fontFamily as string) || 'sans-serif';
  const fontSize = Number(config.fontSize) || 88;
  const fontWeight = Number(config.fontWeight) || 800;
  const stroke = config.textStroke as string | undefined;

  const layout = resolveKineticTitleLayout(config);

  const scale = interpolate(frame, [0, 12], [0.85, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: layout.justifyContent, alignItems: 'center', padding: layout.big ? '48px 0' : 0 }}>
      <div
        style={{
          transform: `scale(${scale})`,
          background: theme.background,
          color: theme.color,
          fontFamily,
          ...(stroke ? { WebkitTextStroke: `1px ${stroke}` } : {}),
          padding: '32px 56px',
          textAlign: 'center',
          maxWidth: layout.maxWidth,
          textShadow: layout.textShadow,
          textWrap: layout.textWrap,
        }}
      >
<        <div style={{ fontSize: layout.big ? layout.headingSize : fontSize, fontWeight: fontWeight, lineHeight: layout.big ? 1.08 : undefined }}>{heading}</div>
        {subheading ? <div style={{ fontSize: layout.subheadingSize, opacity: 0.85 }}>{subheading}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
