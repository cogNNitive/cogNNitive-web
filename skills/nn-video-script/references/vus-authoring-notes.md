# VUS Authoring Notes

Syntax quirks distilled from building the iNNtrevistas series by hand, before this skill
existed. These are structural/mechanical notes —
never a source of voice IDs, model names, or other spec facts. For anything
version-specific, always run `node scripts/vus-spec.mjs voices` or
`node scripts/vus-spec.mjs props <scope>` against the pinned spec. Do not
trust a value here or anywhere else in this skill's prose over the pinned
spec's own content.

## The compliance header is load-bearing

`//ANYDEO_SPEC: <version>` MUST be the very first line of `script.md`, with
zero leading blank lines or whitespace. The parser branches on the first
non-empty line's shape (`# video`, `- `, `@`, or `//ANYDEO_SPEC`) to decide
whether to run the formal grammar at all. A missing or misplaced header line
does not raise a hard error by itself, but it silently routes the script
through the wrong parsing path — this is exactly the kind of failure
`scripts/check-script.mjs`'s header check exists to catch before that
ambiguity reaches the VUS parser.

## Prefer `![alt](path)` over a hand-written `layer_asset_source:` line

Visual/audio asset sources resolve through the Markdown image/media syntax:

```
![label](assets/background_loop.mp4)
```

Do not hand-write `- layer_asset_source: <path>` as a property line — the
canonical authoring path is the Markdown media reference, and the parser
maps it internally. Writing the property line directly bypasses that mapping
and is a common source of "why didn't this asset show up" confusion when
porting scripts by hand.

## `scene_duration_mode`-style behavioral switches

Some scene-level properties are not raw content, but a *mode selector* that
changes how another value (e.g. scene duration) is computed — for example,
whether duration follows the narration length or the underlying media's own
length. These selector properties and their exact allowed values live in the
pinned spec, scoped to `scene` — run
`node scripts/vus-spec.mjs props scene` to see the current set rather than
assuming a name or value from memory or from an older script you've seen.

## Property scoping is strict

Every property belongs to exactly one scope (video-level, section-level,
scene-level, or layer-level — see `node scripts/vus-spec.mjs props <scope>`
for the authoritative list per scope). Placing a property in the wrong scope
(e.g. a global setting inside a scene block) does not necessarily throw a
parse error; it can silently fail to apply. When something you set does not
seem to take effect, the first thing to check is whether it was declared in
the scope the spec actually expects.

## Narration is plain text only

Whatever text appears directly under a scene header (after any property
lines) is treated as narration content. Markdown headers (`#`, `##`) inside
that text are not just stylistically wrong — they can break downstream
text-to-speech processing. Keep narration to plain prose.
