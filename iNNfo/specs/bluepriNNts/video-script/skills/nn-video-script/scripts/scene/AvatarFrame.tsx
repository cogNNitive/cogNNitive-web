/**
 * nn-video-script/scripts/scene/AvatarFrame.tsx
 *
 * Distinct visual treatment for a `talking_avatar` layer: a still avatar image
 * presented as a framed portrait (contained, centered, with a border and a soft
 * vignette) rather than the full-bleed `object-fit: cover` generic image path.
 * Narration audio is bound by the parent `Scene`; this component is purely the
 * avatar's visual.
 */

import React from 'react';
import { AbsoluteFill, Img } from 'remotion';

export const AvatarFrame: React.FC<{ src: string }> = ({ src }) => {
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          width: '46%',
          aspectRatio: '3 / 4',
          border: '6px solid rgba(255,255,255,0.85)',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          background: '#12121a',
        }}
      >
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </AbsoluteFill>
  );
};
