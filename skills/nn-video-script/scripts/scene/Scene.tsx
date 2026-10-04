/**
 * skills/nn-video-script/scripts/scene/Scene.tsx
 *
 * Renders one Remotion scene: background (image or color), narration audio, the
 * scene title, and any overlay components. Purely presentational — all timing and
 * geometry come from the manifest track the CLI passes through `inputProps`.
 */

import React from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import { LowerThird } from './overlays/LowerThird';
import { KineticTitle } from './overlays/KineticTitle';
import { ConceptCallout } from './overlays/ConceptCallout';
import { AvatarFrame } from './AvatarFrame';
import { pickLayerPrimitive, layerSource } from './layer-primitive.mjs';

type Overlay = {
  id: string;
  type: 'lowerThird' | 'kineticTitle' | 'conceptCallout';
  fromFrame: number;
  durationInFrames: number;
  config: Record<string, unknown>;
};

type AudioBinding = {
  id: string;
  assetPath: string;
  fromFrame: number;
  durationInFrames: number;
  volume?: number;
};

type SceneTrack = {
  id: string;
  fromFrame: number;
  durationInFrames: number;
  sceneType?: string;
  props?: Record<string, unknown>;
};

type Layer = Record<string, unknown>;

/**
 * Drawable layers in paint order: lower `layer_level` first, so a level-0 video
 * or image sits behind a level-50 avatar/title. Layers without an asset source
 * (e.g. pure `text`) are not drawn here — overlays handle text.
 */
function drawableLayers(props: Record<string, unknown>): Layer[] {
  const layers = (props.layers as Layer[]) || [];
  return layers
    .filter((l) => layerSource(l).length > 0)
    .sort((a, b) => Number(a.layer_level ?? 0) - Number(b.layer_level ?? 0));
}

export const Scene: React.FC<{
  scene: SceneTrack;
  audio?: AudioBinding[];
  overlays?: Overlay[];
}> = ({ scene, audio = [], overlays = [] }) => {
  const { fps } = useVideoConfig();
  const props = scene.props || {};

  const layers = drawableLayers(props);
  const title = (props.title as string) || '';

  return (
    <Sequence from={scene.fromFrame} durationInFrames={scene.durationInFrames}>
      <AbsoluteFill style={{ backgroundColor: '#0b0b0f' }}>
        {layers.map((layer, index) => (
          <React.Fragment key={`${scene.id}-layer-${index}`}>
            {renderLayer(layer)}
          </React.Fragment>
        ))}

        {scene.sceneType === 'chapter_title' && title ? (
          <AbsoluteFill
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              color: '#ffffff',
              fontFamily: 'sans-serif',
              fontSize: 96,
              fontWeight: 800,
              textAlign: 'center',
              padding: 80,
            }}
          >
            {title}
          </AbsoluteFill>
        ) : null}

        {audio.map((track) => (
          <Sequence key={track.id} from={track.fromFrame - scene.fromFrame} durationInFrames={track.durationInFrames}>
            <Audio src={staticFile(track.assetPath)} volume={track.volume ?? 1} />
          </Sequence>
        ))}

        {overlays.map((overlay) =>
          renderOverlay(overlay, overlay.fromFrame - scene.fromFrame, fps),
        )}
      </AbsoluteFill>
    </Sequence>
  );
};

/**
 * Draws one media layer with the Remotion primitive its `layer_type` maps to.
 * The manifest already holds a staged, bundle-relative name, so `staticFile()`
 * is the only path work here — the component stays presentational.
 */
function renderLayer(layer: Layer): React.ReactNode {
  const src = staticFile(layerSource(layer));
  switch (pickLayerPrimitive(layer.layer_type)) {
    case 'video':
      return (
        <AbsoluteFill>
          <OffthreadVideo src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      );
    case 'avatar':
      return <AvatarFrame src={src} />;
    default:
      return (
        <AbsoluteFill>
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      );
  }
}

function renderOverlay(overlay: Overlay, localFrom: number, fps: number): React.ReactNode {
  const common = { durationInFrames: overlay.durationInFrames };
  switch (overlay.type) {
    case 'lowerThird':
      return (
        <Sequence key={overlay.id} from={localFrom} {...common}>
          <LowerThird config={overlay.config} />
        </Sequence>
      );
    case 'kineticTitle':
      return (
        <Sequence key={overlay.id} from={localFrom} {...common}>
          <KineticTitle config={overlay.config} fps={fps} />
        </Sequence>
      );
    case 'conceptCallout':
      return (
        <Sequence key={overlay.id} from={localFrom} {...common}>
          <ConceptCallout config={overlay.config} />
        </Sequence>
      );
    default:
      return null;
  }
}
