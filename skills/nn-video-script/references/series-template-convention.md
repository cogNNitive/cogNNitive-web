# Series Template Convention

Defines the `{{slot}}` placeholder convention used by a Series'
`script_template.md`, and the shape of the separate series-wide rules
document. See spec `series-script-templates` for the normative requirements;
this file is the authoring-facing "how", not a restatement of the spec.

## The `{{slot}}` placeholder

A series script template marks every piece of author-fillable content with a
`{{slot}}` placeholder:

```
{{hook_line}}
```

This is a **visual convention for the authoring agent only** — no templating
runtime (Handlebars or otherwise) ever resolves it. Opened as plain text, the
file reads exactly as written, placeholder markers included. The only thing
that ever resolves a `{{slot}}` is an authoring agent replacing it with real
content while drafting `script.md` from the template.

## Inline fill-in instructions travel with the slot

Every `{{slot}}` carries its own fill-in instruction as an HTML comment
immediately after it, so an authoring agent never has to consult a separate
index to know what belongs there:

```
{{hook_line}}<!-- One sentence, present tense, names the innovation -->
```

When authoring, replace the whole `{{slot}}<!-- ... -->` pair with the real
content — both the placeholder and its instruction comment must be gone from
the emitted `script.md`. A leftover instruction comment with no placeholder
in front of it is still a bug: it means the slot was filled without removing
its own instructions, and `scripts/check-script.mjs`'s leftover-comment check
exists specifically to catch that half-finished state.

## Why the gate runs before the VUS parser

An unresolved `{{...}}` is invisible to VUS's own grammar: `vus.peggy`
happily accepts it as ordinary narration content and raises no parse error.
That is precisely why `scripts/check-script.mjs` (the placeholder gate) MUST
run before or alongside `scripts/vus-parse.mjs` (the VUS parser check) — the
parser can never catch this class of bug on its own.

## The series-wide rules document

A series has exactly one separate document — conventionally
`series_rules.md`, alongside `script_template.md` — holding rules that apply
to every video in the series: tone, sound-tag conventions, and similar
cross-cutting decisions. Per-slot instructions MUST NOT restate a series-wide
rule; if every scene in the series should share a tone, that tone lives once
in `series_rules.md`, not copy-pasted into every `{{slot}}` comment that
happens to touch tone.

## Shape of `script_template.md` and `series_rules.md`

Both are plain Markdown, versioned alongside the rest of the Series folder
(see `folder-contract.md`). `script_template.md` is the file an authoring
agent drafts `script.md` FROM (never edited in place per-video — copy it,
then fill it in). `series_rules.md` is read once per authoring session, the
same way any other shared reference is read, and its guidance applies
silently to every slot without needing to be repeated.
