# Video Production Hierarchy Specification

## Purpose

Defines the four-level production hierarchy — Workspace → Subject → Series → Video — and how each level is represented in an iNNfo workspace.

## Design Decision: Subject and Series Representation

**Series is implemented as a Level-3 model of the existing `video` template, reused rather than duplicated as a new template.** A Series is one `series/{series-slug}/{Name}_V_x-y-z_video_NN.md` file: its frontmatter carries an added `series:` block (the procedure it extends, its script-template path, its shared-assets path), and the same file contains that Series's own Video Elements. This introduces no new Level-2 template, no new `template_version` axis, and no new spec pin for "Series" as its own concept — it reuses the `video` template's existing shape and versioning instead of inventing bespoke registry machinery, because `{modelDir}/assets/{slug}/` resolution (the mechanism that gives each Video Element its own asset folder) only applies to real iNNfo model files, not to an arbitrary config/registry file.

**Subject stays workspace-custom.** This change does not ship a new cogNNitive-owned Subject template. Subject content (facts and sources) is genuinely domain-specific per workspace — iNNtrevistas already models it as a bespoke historical-innovation template — and standardizing it now would force a premature, generic shape onto content that varies per project. Video references its Subject generically, the same way it already references `sources::`, without requiring any particular Subject template.

**Naming**: "Project" is avoided because `iNNfo/specs/templates/projects/spec_NN.md` already owns that name for an unrelated Project/Phases/Milestone/critical-path template. "Subject" is used instead for the content concept, to avoid colliding with users of either template.

## Requirements

### Requirement: Four-Level Hierarchy

The system MUST recognize four production levels: Workspace, Subject, Series, and Video. Subject MUST represent the content (facts and sources). Series MUST represent the production format: one procedure extending the generic script-generation procedure, one script template, and shared series assets. Video MUST combine exactly one Subject with exactly one Series.

#### Scenario: A Video declares its Subject and Series
- GIVEN a Video Element being authored
- WHEN it is registered
- THEN it references exactly one Subject and exactly one Series, and neither reference is optional

#### Scenario: Subject and Series vary independently
- GIVEN one Subject already produced under Series A
- WHEN a new Video is authored for the same Subject under Series B
- THEN the Subject content is reused unchanged and no coupling to Series A is required

### Requirement: Series Represented as a Reused Video-Template Model

A Series MUST be represented as a Level-3 model of the existing `video` template — not a new Level-2 template — located at `series/{series-slug}/{Name}_V_x-y-z_video_NN.md`. Its frontmatter MUST declare a `series:` block naming, at minimum: the procedure it extends, the path to its script template, and the path to its shared series-assets folder. This representation MUST NOT introduce a new iNNfo Concept/Field Definition template, a new `template_version` axis, or a new spec pin for Series as its own concept.

#### Scenario: Video resolves its Series registry
- GIVEN a Video referencing Series `X`
- WHEN the owning procedure runs
- THEN it locates `X`'s `video`-template model file and reads the procedure, script-template, and assets-folder entries from its `series:` frontmatter block

### Requirement: Subject Referenced Generically, Not Standardized

Video MUST reference its Subject through a generic, reserved-property-style link (analogous to `sources::`) that accepts any workspace document or Element. This change MUST NOT add a new cogNNitive-owned Subject template to `manifest/source.yaml`.

#### Scenario: Video links to a workspace-custom Subject
- GIVEN a workspace-defined Subject template (e.g. iNNtrevistas' historical-innovation model)
- WHEN a Video is registered against one of its Elements
- THEN the link resolves without requiring that Element to conform to any cogNNitive-shipped Subject template

#### Scenario: No new Subject template ships
- GIVEN this change's `manifest/source.yaml` diff
- WHEN inspected
- THEN no new Subject template entry is present
