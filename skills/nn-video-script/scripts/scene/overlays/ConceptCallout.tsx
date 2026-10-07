/**
 * skills/nn-video-script/scripts/scene/overlays/ConceptCallout.tsx
 *
 * Labeled callout box with a highlight accent, anchored top-left.
 */

import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';

export const ConceptCallout: React.FC<{ config: Record<string, unknown> }> = ({ config }) => {
  const { width, height } = useVideoConfig();
  const s = width / 1920;
  const label = (config.label as string) || '';
  const description = (config.description as string) || '';
  const highlight = (config.highlightColor as string) || '#eab308';
  const fontFamily = (config.fontFamily as string) || 'sans-serif';
  const fontSize = Number(config.fontSize) || 34;

  return (
    <AbsoluteFill style={{ padding: 64 * s, justifyContent: 'flex-start', alignItems: 'flex-start' }}>
      <div
        style={{
          background: 'rgba(10,10,15,0.85)',
          borderTop: `${Math.max(4, 6 * s)}px solid ${highlight}`,
          padding: `${20 * s}px ${28 * s}px`,
          color: '#fff',
          fontFamily,
          maxWidth: height > width ? '90%' : '55%',
        }}
      >
        <div style={{ fontSize: fontSize * s, fontWeight: 700, color: highlight, textTransform: 'uppercase', letterSpacing: 2 * s }}>
          {label}
        </div>
        {description ? <div style={{ fontSize: 28 * s, marginTop: 8 * s }}>{description}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
