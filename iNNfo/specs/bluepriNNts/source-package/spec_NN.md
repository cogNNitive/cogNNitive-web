---
spec_version: "V_0-7-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/source-package/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-7-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-7-0_NN.md"
blueprint_version: "V_0-4-1"
title: "Source Package App"
relationship_types:
  hierarchy:
    enabled: true
    via: index block
  evaluable_matrix:
    enabled: false
  graph_edge:
    enabled: false
  sequence:
    enabled: false
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.

# NN index

* [[Package]]
  * [[Transformation]]
* [[Channel]]

# NN Concept Definition

## NN Concept Definition: Package
icon:: package
type:: category
color:: blue
weight:: 100

## NN Concept Definition: Transformation
icon:: workflow
type:: list
color:: amber
weight:: 90

## NN Concept Definition: Channel
icon:: radio-tower
type:: category
color:: violet
weight:: 80

# NN Field Definition

## NN Field Definition: title
concept:: Package
type:: string
description:: Display title of the item as published by its origin, without the capture wrapper.

## NN Field Definition: canonical_url
concept:: Package
type:: url
description:: Permanent URL of the item at the outlet or platform that publishes it. For a workspace-copied item this is still the remote original, never the local path.

## NN Field Definition: source_link
concept:: Package
type:: url
description:: URL of the external artifact the item points to, when the captured item is a discussion or an aggregator entry rather than the artifact itself. Empty when the item is the artifact.

## NN Field Definition: outlet
concept:: Package
type:: string
description:: Publisher of record: outlet host, platform, subreddit or channel. Attribution, never a reference to a modelled entity.

## NN Field Definition: author
concept:: Package
type:: string
description:: Byline of the item when the source reports one. Left empty rather than inferred.

## NN Field Definition: published
concept:: Package
type:: string
description:: Publication timestamp as reported by the source, ISO-8601 with offset when available. Empty when the source reports none; never backfilled from the fetch time.

## NN Field Definition: language
concept:: Package
type:: select
options:: [es, en, pt, it, fr, de, gl, other]
description:: Primary language detected on the digested evidence, as a two-letter code. A property of the evidence, not of any consumer's audience.

## NN Field Definition: summary
concept:: Package
type:: markdown_inline
description:: Extractive summary of the primary evidence, produced by a deterministic method and labelled as such. Never abstractive, never interpretive: it must read the same regardless of who consumes the package.

## NN Field Definition: facts
concept:: Package
type:: markdown_inline
description:: Atomic, verifiable statements extracted from the evidence, each traceable to a passage. Neutral phrasing only: no angle, no judgement, no narrative ordering. Consumers select and sequence them; the package does not.

## NN Field Definition: quotes
concept:: Package
type:: markdown_inline
description:: Verbatim passages worth preserving, each with its speaker and its locator (heading anchor or timecode). Preserved because they are quotable, not because they suit a use: the package never decides which quote is the good one. Locators must resolve against the cited sidecar body.

## NN Field Definition: entities
concept:: Package
type:: string
description:: People, organizations and places appearing in the evidence, comma-separated in their in-evidence form. A reading aid, not a taxonomy.

## NN Field Definition: attribution
concept:: Package
type:: markdown_inline
description:: Usage note for downstream consumers: credit line, license or terms when known, and any restriction observed at capture time. Mandatory whenever the evidence is republished.

## NN Field Definition: content_hash
concept:: Package
type:: string
description:: SHA-256 of the primary evidence. It duplicates the primary sidecar's `sha256` on purpose: it is the one value a consumer compares to detect change without resolving the package's citations.

## NN Field Definition: package_path
concept:: Package
type:: string
description:: Workspace-relative path of the directory holding the digested files and their sidecars.

## NN Field Definition: captured_at
concept:: Package
type:: string
description:: Timestamp the channel reported for the capture event, when the channel reports one (a message date, a publication date). Empty for crawls and scans, which have no capture moment.

## NN Field Definition: ingested_at
concept:: Package
type:: string
description:: Timestamp of the ingestion run that produced the package, in UTC as YYYY-MM-DD HH:MM:SS. One value per run, shared by every package produced by that run, whatever the channel.

## NN Field Definition: channel
concept:: Package
type:: reference
target_concepts:: [Channel]
description:: The acquisition channel through which the item entered: NNews, traNNscriptions, dowNNloads, scaNN or a future one. It records how the item arrived, never what it is for.

## NN Field Definition: step
concept:: Transformation
type:: string
description:: Canonical step identifier, kebab-case and reusable across channels: parse, media-fetch, normalize, asr, ocr, summarize, extract, cache-asset. A step is a verb applied to evidence, never a destination.

## NN Field Definition: procedure
concept:: Transformation
type:: string
description:: Path of the procedure document that defines this step, under procedures/. The procedure is the executable definition; the Transformation element records one run of it.

## NN Field Definition: outputs
concept:: Transformation
type:: string
description:: Comma-separated workspace-relative paths this step produced. Each must exist with its own sidecar, which is what makes the chain walkable through the lineage projection.

## NN Field Definition: tool
concept:: Transformation
type:: string
description:: Executor of the step: yt-dlp, ffmpeg, faster-whisper, nn-sources CLI, an OCR engine, or the agent for the deterministic extractions. Mirrors the produced sidecar's `normalized_by`.

## NN Field Definition: input_hash
concept:: Transformation
type:: string
description:: SHA-256 of the inputs consumed, or of the single input file. Together with `step` it forms the idempotency key: an unchanged input never re-runs an expensive step.

## NN Field Definition: output_hash
concept:: Transformation
type:: string
description:: SHA-256 of the produced bytes, when the output is a single file. Must agree with the produced sidecar's `sha256`.

## NN Field Definition: ran_at
concept:: Transformation
type:: string
description:: Timestamp at which the step executed, ISO-8601 UTC. It orders the chain and shows how long a cached output has been reused.

## NN Field Definition: outcome
concept:: Transformation
type:: select
options:: [ok, cached, failed, skipped]
description:: Result of the run: ok when new bytes were produced, cached when the idempotency key matched an existing output and the step was not re-executed, failed on error, skipped when a precondition was unmet. A failed step never registers outputs.

## NN Field Definition: name
concept:: Channel
type:: string
description:: Human-readable channel name.

## NN Field Definition: mechanism
concept:: Channel
type:: select
options:: [message_feed, rss, agent_research, crawl, scanner, upload, manual]
description:: How the channel discovers and brings material in. It deliberately excludes processing steps such as transcription, which are Transformations applied after acquisition, not channels.

## NN Field Definition: origin
concept:: Channel
type:: string
description:: Where the channel draws its material from: a feed list, a watch-root path, a recorder inbox or a query.

## NN Field Definition: procedure
concept:: Channel
type:: string
description:: Path of the procedure that runs this channel's acquisition, under procedures/ and following the procedures blueprint.

## NN Field Definition: status
concept:: Channel
type:: select
options:: [active, paused, retired]
description:: Lifecycle state of the channel itself. Not to be confused with the triage state of a captured item, which lives in that channel's own model.

## NN Field Definition: cadence
concept:: Channel
type:: select
options:: [manual, daily, weekly, monthly]
description:: How often the channel is expected to run. Manual means on demand only.

# Source Package App

## A level-2 template for the neutral, complete handoff artifact an intake domain delivers to consumer domains

## Philosophy

Digestion happens once; consumption happens many times. An intake domain captures material from several channels, normalizes it, and hands it over as a package any consumer can read without redoing the acquisition. The value of the package is not that it is optimized for a consumer — an optimized artifact is by definition specific, and therefore usable once. The value is that it is **neutral and complete**: it contains everything needed to derive any use, and nothing that presupposes one.

The frontier is the whole design. A package may **summarize** and may **extract verbatim**, because both are deterministic and reader-independent. A package may not **interpret**: the moment it records an angle, a priority, a production state or a chosen recipient, it has answered a question only a consumer can ask, and every other consumer must now work around that answer.

Two consequences follow. First, the expensive transformations — transcription, extraction, asset caching, hashing — are paid once per item and never again per consumer. Second, the package has no triage state: its existence *is* its readiness. Candidates that were never digested stay in the channel's own model as intake records; only a promoted item earns a package.

This template deliberately adds **nothing new for provenance**. Digested files are made citable by the canonical `sidecar` blueprint through the `cognitivize` operation, and the upstream edge of every file is the sidecar's own `sources` frontmatter key, from which the lineage projection derives `derived_from`. An element of this blueprint never declares `sources::`: L3 validation rejects it (`"sources::" is banned on L3; provenance is the applied change's evidence`), so an element's own provenance is the evidence of the changeset that created it. This template only adds what did not exist: the neutral handoff record, the transformation-run record with an idempotency key, and the channel register.

## Objectives

- Define one neutral, complete handoff shape shared by every acquisition channel.
- Separate acquisition (where material comes from) from transformation (what is done to it), so steps can chain and be added without touching the package shape.
- Separate expensive digestion (once, at promotion) from cheap capture (many, at intake).
- Make N consumers read one artifact instead of N copies, and detect source change from one hash.
- Reuse `sidecar`, `sources`, `changes`, `procedures` and `artifacts` as they are; add no parallel provenance mechanism, and never declare `sources::` on an element.
- State the frontier explicitly, so interpretation never leaks into the package.

## Specification

### Concepts

| Concept | Type | Purpose |
|---|---|---|
| **Package** | `category` | One digested item, ready for consumption |
| **Transformation** | `list` | The steps executed to produce its files, in chain order |
| **Channel** | `category` | The acquisition mechanism that produced packages of this shape |

### Fields

| Concept | Field | Type | Purpose |
|---|---|---|---|
| Package | `title` | string | Display title as published |
| Package | `canonical_url` | url | Permanent URL at the publisher of record |
| Package | `source_link` | url | External artifact the item points to, when any |
| Package | `outlet` | string | Publisher of record |
| Package | `author` | string | Byline when reported |
| Package | `published` | string | Publication timestamp, ISO-8601 |
| Package | `language` | select | Detected language of the evidence |
| Package | `summary` | markdown_inline | Extractive, labelled summary |
| Package | `facts` | markdown_inline | Atomic verifiable statements |
| Package | `quotes` | markdown_inline | Verbatim passages with locators |
| Package | `entities` | string | People, organizations, places |
| Package | `attribution` | markdown_inline | Credit line, license, restrictions |
| Package | `content_hash` | string | SHA-256 of the primary evidence |
| Package | `package_path` | string | Package directory |
| Package | `captured_at` | string | Channel-reported capture moment |
| Package | `ingested_at` | string | Ingestion run timestamp |
| Package | `channel` | reference | Acquisition channel |
| Transformation | `step` | string | Canonical step id |
| Transformation | `procedure` | string | Procedure that defines the step |
| Transformation | `outputs` | string | Files produced, each with a sidecar |
| Transformation | `tool` | string | Executor |
| Transformation | `input_hash` | string | Idempotency key with `step` |
| Transformation | `output_hash` | string | Hash of the produced bytes |
| Transformation | `ran_at` | string | Execution timestamp |
| Transformation | `outcome` | select | ok / cached / failed / skipped |
| Channel | `name` | string | Channel name |
| Channel | `mechanism` | select | message_feed / rss / agent_research / crawl / scanner / upload / manual |
| Channel | `origin` | string | Where the material comes from |
| Channel | `procedure` | string | Procedure that runs the acquisition |
| Channel | `status` | select | active / paused / retired |
| Channel | `cadence` | select | manual / daily / weekly / monthly |

### The frontier

A package **must not** carry any of the following. Each is a question only a consumer can answer, and recording it here forces every other consumer to work around it:

| Forbidden in a package | Why | Where it belongs |
|---|---|---|
| Production state (`scripted`, `published`, `shot`) | Describes a consumer's pipeline | The consumer's own model |
| Consumer identifiers (`video_slug`, `page_id`, `ticket_id`) | They name a destination | The consumer's own model |
| Editorial angle, tone, framing | Interpretation | The consumer's own model |
| Priority, score, ranking | Relative to a goal | The consumer's own model |
| "Best quote", "key takeaway" | Selection | The consumer's own model |
| Triage state (`inbox`, `approved`, `discarded`) | The package's existence is its readiness | The channel's intake model |

### Acceptance test

One question decides whether a field belongs in the package:

> **Would this field change if a new consumer domain appeared tomorrow?**

If yes, it is derivation and stays out. If no, it is a property of the evidence and belongs in.

### Evidence: no new concept

A package's files are not modelled by an element of this blueprint. They are **sidecars**, produced by `cognitivize` under the canonical `sidecar` blueprint, which already records `source_file`, `sha256`, `size_bytes`, `source_format`, `normalized_at` and `normalized_by`, and whose body carries the normalized Markdown for binary subjects.

Two rules keep the chain coherent without inventing anything:

- **The upstream edge is the sidecar's `sources`.** A sidecar declares no `derived_from`; it cites its upstream in its `sources` frontmatter key, and the lineage projection derives `derived_from` from it. Chains are therefore expressed with the mechanism cogNNitive already has.
- **The file's role is a sidecar metadata key.** `role:: primary | discussion | transcript | subtitle | asset` is written by the normalizer as its own key in the sidecar frontmatter, which the sidecar blueprint explicitly permits and preserves on refresh. No new concept, no extra element.

### Chaining transformations

A channel brings one thing in. A package may be the product of several steps in sequence, and the shape does not change as the chain grows: every step reads files or an origin and writes files with sidecars, and every step is recorded as a `Transformation` with its outputs and hashes.

Two rules make the chain work:

- **Files point backwards through their sidecar's `sources`.** Each sidecar cites its upstream in its frontmatter: the origin URI for the first step, the parent file for every later one. Walking backwards from any file reconstructs the chain to the world.
- **The idempotency key is `step` + `input_hash`.** An unchanged input never re-runs an expensive step: the existing output is reused and the run is recorded with `outcome:: cached`. This is what makes deep chains affordable.

Adding a transformation type is a local change: one procedure document and one new `step` identifier. Package, Channel, sidecars and consumers are untouched. If the step produces a role the convention already knows, nothing else changes at all.

Worked chain — a YouTube URL supplied by hand:

| # | step | upstream (sidecar `sources`) | outputs | tool | outcome |
|---|---|---|---|---|---|
| 1 | `parse` | the URL | `source.json` | agent | ok |
| 2 | `media-fetch` | `source.json` | `media.m4a` | yt-dlp | ok |
| 3 | `normalize` | `media.m4a` | `media.16k-mono.m4a` | ffmpeg | ok |
| 4 | `asr` | `media.16k-mono.m4a` | `transcript.txt`, `subtitle.srt` | faster-whisper | ok |
| 5 | `summarize` | `transcript.txt` | `summary` on the Package | deterministic extractor | ok |

Re-running the same URL the next day stops at step 1: `source.json` hashes identically, so steps 2 to 5 record `cached` and nothing expensive executes. Escalating transcript quality changes only `asr`'s `input_hash`, leaving steps 1 and 2 untouched.

Note what the chain does **not** contain: a decision about what the transcript is for. A consumer wanting an episode reads `transcript.txt` and `subtitle.srt` and derives its own scene plan. The chain stops at evidence.

### Reserved Properties

`sources::` is reserved by iNNfo and **banned on every L3 element**, including `Package` and `Transformation`: validation reports `"sources::" is banned on L3; provenance is the applied change's evidence`. Provenance therefore lives in two places that already exist:

- **File provenance** — each digested file's sidecar cites its upstream in its own `sources` frontmatter key (the origin URI for the first step, the parent file for every later one). A `Package` reaches its files through `package_path`, and a `Transformation` names what it produced in `outputs`; walking the sidecars of those files reconstructs the chain.
- **Element provenance** — a `Package` or `Transformation` element is created by an applied changeset whose `evidence` cites the files it was derived from. That evidence is the element's provenance; the element repeats none of it.

The package never cites a consumer.

## Template

### Level 3 Model Template (Lightweight)

```yaml
---
level: 3
parent_spec:
  name: "source-package"
  url: "specs/bluepriNNts/source-package/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "<Package Catalog Name>"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.

# NN Package

## NN Package: <Item Title>
slug:: <item-slug>
title:: <Item Title>
canonical_url:: https://example.com/item
source_link:: https://example.com/original-article
outlet:: example.com
author:: <byline>
published:: 2026-01-01T00:00:00+00:00
language:: en
summary:: <extractive summary, labelled as such>
facts:: <atomic statement>
quotes:: <verbatim passage — ## Heading anchor>
entities:: <Person>, <Organization>, <Place>
attribution:: <outlet credit line; license when known>
content_hash:: <sha256 of the primary evidence>
package_path:: sources/import/<channel>/<item-slug>
captured_at:: 2026-01-01T00:00:00+00:00
ingested_at:: 2026-01-01 00:00:00
channel:: @nnews

# NN Transformation

## NN Transformation: normalize article
slug:: normalize-article
step:: normalize
procedure:: procedures/normalize_source_procedures_NN.md
outputs:: sources/import/<channel>/<item-slug>/article.md
tool:: nn-sources CLI
input_hash:: <sha256 of the fetched bytes>
output_hash:: <sha256>
ran_at:: 2026-01-01T00:00:00Z
outcome:: ok

# NN Channel

## NN Channel: NNews
slug:: nnews
name:: NNews
mechanism:: rss
origin:: <feed list>
procedure:: procedures/nnews_acquire_procedures_NN.md
status:: active
cadence:: manual
```

# Concept Guidance Documentation

## Package

### Summary

One digested item, neutral and complete, ready for any consumer domain.

### Description

Each `Package` element is one item that passed intake and was digested once: the parsed outlet, the publication timestamp, the detected language, an extractive summary, the atomic facts, the verbatim quotes with locators, the entities, the attribution note and the hash of the primary evidence. It references the `Channel` that brought it in and locates its digested files through `package_path`; each of those files carries its own sidecar, whose `sources` key cites its upstream. The element itself declares no `sources::`: its provenance is the evidence of the changeset that created it.

A package is created at **promotion**, not at capture. A candidate that has not been promoted is an intake record in the channel's model; it has no package, because digesting it would spend the expensive transformations on something no consumer asked for.

### Methodologies

- Produce a package only for a promoted item, never for a candidate.
- Summarize extractively and label it: an abstractive summary is interpretation wearing a different hat.
- Keep facts atomic and neutral: the package states, the consumer sequences.
- Quote verbatim with resolvable locators, and include every quotable passage rather than the best one.
- Record attribution even when the evidence will not be republished; the cost of forgetting it is paid later.
- Stamp `ingested_at` once per run and share the value across the whole batch.

### Prompts

- "List the files of the package for `<item>` and their sidecars."
- "Rewrite the summary as an extractive one; the current text reads as an interpretation."
- "Which packages were produced in the ingest run of `<timestamp>`?"

## Transformation

### Summary

One executed step that turned inputs into files, recorded so the chain can be walked and the cost reused.

### Description

A `Transformation` element is the record of one run of one step: what it produced (`outputs`), which tool did it, the hash of its input, the hash of its output, when it ran and how it ended. Its upstream is expressed by the sidecars of its `outputs`, whose `sources` key cites what the step consumed, so the lineage projection derives the chain without a parallel mechanism. The element declares no `sources::`; the changeset that records the run carries the evidence.

It is deliberately not a `Channel`: a channel is where material is discovered, a transformation is what is done to it afterwards. Conflating the two is what makes chaining unmodellable, because a step cannot then be inserted between two other steps.

The `outcome:: cached` value is the point of the record. It says the step did not re-execute because `step` + `input_hash` were already known, which is how a deep chain stays affordable when only its tail changes.

### Methodologies

- One `Transformation` element per executed step, ordered by `ran_at`.
- Keep `step` identifiers canonical and reusable across channels; a step is a verb, not an integration.
- Record the `tool` honestly, matching the produced sidecar's `normalized_by`.
- Never register `outputs` for a step with `outcome:: failed`; a failed step leaves the package exactly as it was.
- Re-run a step only when its `input_hash` changes; otherwise record `cached` and move on.
- Add a new transformation by writing its procedure and reusing existing sidecar roles.

### Prompts

- "Show the transformation chain that produced `<file>`."
- "Which steps ran `cached` in the last ingest of `<channel>`?"
- "Re-run only `asr` for `<package>` with the higher-quality profile."

## Channel

### Summary

An acquisition mechanism that produces packages of this shape.

### Description

A `Channel` is how material arrives: a message feed, an RSS batch, a recorder inbox, a web crawl or a scanner. Channels differ in three things only — how they discover candidates, how they deduplicate, and what they enrich. Everything downstream (normalization, sidecars, package shape, hashing, handoff) is shared, which is why a new channel costs an adapter and not a pipeline.

The channel's `status` is the channel's own lifecycle. It is unrelated to the triage state of captured items, which lives in that channel's intake model.

### Methodologies

- One `Channel` element per mechanism instance, not per source-list variation.
- Bind every package to the channel that brought it in; the channel is provenance, not a destination.
- Add a channel by writing an adapter procedure, never by forking the package shape.
- Keep the channel's procedure in `procedures/`, following the `procedures` blueprint.

### Prompts

- "Which channels are active and when did each last run?"
- "Which packages came in through `traNNscriptions` rather than `NNews`?"

# Worked Handoffs

## One news item, two consumers

| Element | Where it lives | Derived or neutral |
|---|---|---|
| `title`, `canonical_url`, `outlet`, `published` | package | neutral |
| `facts`, `quotes`, `summary`, `attribution` | package | neutral |
| `article.md`, `comments.md` as sidecars | package files (sidecars under `package_path`) | neutral |
| Epicene angle, Celedonio framing | video domain's news model | derived |
| `status:: scripted`, `video_slug` | video domain's news model | derived |
| Post intro, keyword choice, publish state | web domain's model | derived |

The video domain selects three facts out of five and orders them; the web domain selects the same three in a different order plus the attribution. Neither ever re-fetches the article, and neither may write back into the package.

## One recording, two consumers

| Element | Where it lives | Derived or neutral |
|---|---|---|
| audio reference, `.txt`, `.srt` with timecodes | package files (sidecars under `package_path`) | neutral |
| extractive summary, verbatim quotes with timecode locators | package | neutral |
| "these are the decisions and commitments" | business domain's model | derived |
| "these 28 seconds are clip-worthy" | video domain's model | derived |

The timecodes are the generic asset: the chain produces them once, and both consumers read them for different reasons. Without them, each consumer would re-transcribe the same audio.

## One downloaded page, two consumers

| Element | Where it lives | Derived or neutral |
|---|---|---|
| normalized body markdown, `sha256`, `captured_at` | package files (sidecars under `package_path`) | neutral |
| local assets with their own sidecars | package files (sidecars under `package_path`) | neutral |
| `summary`, attribution and license note | package | neutral |
| Citation in a knowledge model element | documentation domain's model | derived |
| Digest republication, staleness flag from `sha256` | content domain's model | derived |

The hash is what lets two consumers learn that the source changed without either performing its own download — the same economy as the shared timecodes and the shared article.
