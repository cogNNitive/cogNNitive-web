/**
 * skills/nn-video-script/scripts/ScriptRoot.tsx
 *
 * Remotion composition root. Registers a single `<Composition>` whose `id` is the
 * stable `COMPOSITION_ID` the CLI passes to `selectComposition({ serveUrl, id, inputProps })`.
 * Timing comes from the manifest at render time through `inputProps`; `calculateMetadata`
 * is intentionally not used (the scene compiler already computes `totalDurationInFrames`).
 */

import React from 'react';
import { Composition } from 'remotion';
import { Scene } from './scene/Scene';

/** Must match the id passed to selectComposition from video-engine-cli.mjs. */
export const COMPOSITION_ID = 'script-composition';

const FALLBACK_FPS = 30;
const FALLBACK_WIDTH = 1920;
const FALLBACK_HEIGHT = 1080;
const FALLBACK_FRAMES = 1;

export const ScriptRoot: React.FC = () => {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={SceneTimeline as unknown as React.FC<Record<string, unknown>>}
      fps={FALLBACK_FPS}
      width={FALLBACK_WIDTH}
      height={FALLBACK_HEIGHT}
      durationInFrames={FALLBACK_FRAMES}
      calculateMetadata={({ props }) => {
        const manifest = props as Record<string, unknown>;
        return {
          durationInFrames: Number(manifest.totalDurationInFrames) || FALLBACK_FRAMES,
          fps: Number(manifest.fps) || FALLBACK_FPS,
          width: Number(manifest.width) || FALLBACK_WIDTH,
          height: Number(manifest.height) || FALLBACK_HEIGHT,
        };
      }}
    />
  );
};

/**
 * Renders every scene track in order. Each `Scene` positions itself at its
 * `fromFrame` with its own `durationInFrames` via a `<Sequence>`.
 */
const SceneTimeline: React.FC<Record<string, unknown>> = (props) => {
  const tracks = (props.tracks as { scenes?: unknown[] }) || {};
  const scenes = Array.isArray(tracks.scenes) ? tracks.scenes : [];
  const audio = (tracks as { audio?: Record<string, unknown>[] }).audio || [];
  const overlays = (tracks as { overlays?: Record<string, unknown>[] }).overlays || [];

  return (
    <>
      {scenes.map((scene, index) => {
        const sceneObj = scene as Record<string, unknown>;
        const from = (sceneObj.fromFrame as number) ?? 0;
        const dur = (sceneObj.durationInFrames as number) ?? 0;
        return (
          <Scene
            key={`${(sceneObj.id as string) || index}`}
            scene={sceneObj}
            audio={audio.filter((a) => a.sceneId === sceneObj.id)}
            overlays={overlays.filter((o) => from <= ((o.fromFrame as number) ?? 0) && ((o.fromFrame as number) ?? 0) < from + dur)}
          />
        );
      })}
    </>
  );
};
