/**
 * nn-video-script/scripts/remotion-entry.tsx
 *
 * Remotion entry point. `@remotion/bundler` bundles this file; the renderer then
 * resolves the composition registered here by id. Loaded only when the Remotion
 * runtime is installed (see ensure-engine.mjs) — it is never imported at parse time.
 */

import { registerRoot } from 'remotion';
import { ScriptRoot } from './ScriptRoot';

registerRoot(ScriptRoot);
