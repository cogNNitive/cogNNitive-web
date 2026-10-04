/**
 * skills/nn-video-script/scripts/scene/overlays/ConceptCallout.tsx
 *
 * Labeled callout box with a highlight accent, anchored top-left.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';

export const ConceptCallout: React.FC<{ config: Record<string, unknown> }> = ({ config }) => {
  const label = (config.label as string) || '';
  const description = (config.description as string) || '';
  const highlight = (config.highlightColor as string) || '#eab308';

  return (
    <AbsoluteFill style={{ padding: 64, justifyContent: 'flex-start', alignItems: 'flex-start' }}>
      <div
        style={{
          background: 'rgba(10,10,15,0.85)',
          borderTop: `6px solid ${highlight}`,
          padding: '20px 28px',
          color: '#fff',
          fontFamily: 'sans-serif',
          maxWidth: '55%',
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 700, color: highlight, textTransform: 'uppercase', letterSpacing: 2 }}>
          {label}
        </div>
        {description ? <div style={{ fontSize: 28, marginTop: 8 }}>{description}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
