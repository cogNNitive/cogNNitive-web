# Docs Install Guide Specification

## Purpose

There MUST be exactly one canonical, multi-agent install guide. Every other
mention of installation MUST link to it instead of duplicating its steps, and
its wording MUST recommend OpenCode Desktop without implying the ecosystem
only supports OpenCode.

## Requirements

### Requirement: Single Canonical Install Guide

The system MUST maintain exactly one document that is the canonical source
of install steps for all supported agents (at minimum: Claude Code, Cursor,
Antigravity, Codex, OpenCode Desktop). Every other docs surface that
currently duplicates install steps MUST instead link to this document.

#### Scenario: Canonical guide covers all supported agents

- GIVEN the canonical install guide
- WHEN a reader looks for install steps for any supported agent
- THEN that agent's steps are present in the canonical guide

#### Scenario: Other surfaces link instead of duplicating

- GIVEN `docs/skills/documentation/README.md` or any other former install-copy location
- WHEN its install section is inspected after the change
- THEN it contains a link to the canonical guide and no duplicated step-by-step install instructions

### Requirement: OpenCode Desktop Recommendation Without Single-Agent Wording

The canonical install guide and any short install CTA (e.g. on
`docs/skills/index.html`) MUST present OpenCode Desktop as the recommended
agent while making clear other agents are supported. Wording MUST NOT read
"for OpenCode" or "Built for OpenCode" as if it were the only supported agent.

#### Scenario: Landing page CTA

- GIVEN `docs/skills/index.html`
- WHEN its install section renders
- THEN it shows a short "OpenCode Desktop recommended" call to action plus a link to the canonical guide
- AND it does not present install steps for OpenCode only

#### Scenario: No single-agent-only wording remains

- GIVEN any docs source file that previously read "for OpenCode" or "Built for OpenCode" as an exclusive claim
- WHEN the change is applied
- THEN that wording is replaced with multi-agent wording that still names OpenCode Desktop as recommended

### Requirement: Install Guide Location Is Stable For Linking

The canonical install guide MUST live at a single, stable path so every
linking surface can reference it without duplication drift re-appearing later.

#### Scenario: Multiple surfaces link to the same target

- GIVEN two or more docs surfaces that reference installation
- WHEN their install links are inspected
- THEN they resolve to the same canonical guide path
