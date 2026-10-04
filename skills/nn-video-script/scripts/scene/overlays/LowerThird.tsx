/**
 * skills/nn-video-script/scripts/scene/overlays/LowerThird.tsx
 *
 * Simple lower-third name/label graphic anchored to a corner.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';

const POSITION: Record<string, React.CSSProperties> = {
  'bottom-left': { justifyContent: 'flex-end', alignItems: 'flex-start' },
  'bottom-right': { justifyContent: 'flex-end', alignItems: 'flex-end' },
  'bottom-center': { justifyContent: 'flex-end', alignItems: 'center' },
};

export const LowerThird: React.FC<{ config: Record<string, unknown> }> = ({ config }) => {
  const title = (config.title as string) || '';
  const subtitle = (config.subtitle as string) || '';
  const accent = (config.accentColor as string) || '#3b82f6';
  const position = (config.position as string) || 'bottom-left';

  return (
    <AbsoluteFill style={{ padding: 64, ...(POSITION[position] || POSITION['bottom-left']) }}>
      <div
        style={{
          background: 'rgba(10,10,15,0.82)',
          borderLeft: `8px solid ${accent}`,
          padding: '18px 28px',
          color: '#fff',
          fontFamily: 'sans-serif',
          maxWidth: '60%',
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700 }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 26, opacity: 0.8 }}>{subtitle}</div> : null}
      </div>
    </AbsoluteFill>
  );
};
