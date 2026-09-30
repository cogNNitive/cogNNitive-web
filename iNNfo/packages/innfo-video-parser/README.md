# @cognnitive/innfo-video-parser

VUS (video script) parser, semantic validator and the vendored, hash-pinned VUS spec.

```ts
import { parse, validate, VUS_SPEC } from '@cognnitive/innfo-video-parser'

const { project, issues } = parse(scriptText) // parse + semantic validation issues
const more = validate(project) // re-run the semantic rules on a Project
VUS_SPEC.version // "V_0-3-3"
VUS_SPEC.sha256 // sha256 of specs/V_0-3-3.json, LF-normalized
```

## Provenance

Ported from the upstream parser at commit `4c05a58`. The grammar (`src/parser/vus.peggy`)
is verbatim. `src/parser/vus_parser.js` is the upstream generated file, byte for byte
(LF-normalized), NOT a fresh `npm run build:grammar` output: the upstream committed
parser is stale against its own grammar (it matches the `//ANYDEO_SPEC:` header with a
length of 13 instead of 12), and regenerating it changes parse output for scripts that
carry that header. Regenerate only as a deliberate, reviewed behaviour change.

## Vendored spec

`specs/V_0-3-3.json` is write-once and hash-pinned (`.gitattributes` marks it `-text`,
`.prettierignore` skips it). A new spec version means vendoring a new file, never editing
this one.

## Consumers

`skills/nn-video-script/scripts/vus-parse.mjs` runs the TypeScript source under the `tsx`
loader; `skills/nn-video-script/scripts/vus-spec.mjs` reads and verifies the spec file.
