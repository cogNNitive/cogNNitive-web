# nn

`nn` is the **primary front controller** of the cogNNitive ecosystem — the single interactive entry
point that most users start from. It activates on `/nn`, `/start`, or any mention of `cognnitive`
or `cogNNitive`, and it organizes domaiNN work into a continuous, job-oriented loop rather than a
flat command list.

## Activation contract

`nn` activates when the user types `/nn` or `/start`, mentions `cognnitive`/`cogNNitive`, or
begins an interactive session inside a cogNNitive domaiNN. On activation it prints the session
greeting banner and then runs the environment readiness gate.

## Environment readiness gate

`nn` is the **sole gate owner** for the session: it runs the fast local domain probe and surfaces
the result before showing the menu.

```bash
node skills/nn-preflight/scripts/domain-probe.js --workspace-dir . --json
```

The probe returns:

- **Preflight status** — Node.js version, `nn-mcp` availability, and domaiNN integrity. Exit
  code `1` signals non-blocking, actionable warnings that are shown without halting the session.
- **Domain state counts** — pending raw files in `sources/import/`, active kNNowledge documents,
  and available executable procedures (domain and blueprint scopes).

Because the probe is deterministic, the menu can recommend the right stage instead of asking the
user to guess.

## Job-loop menu

The menu expresses work as a loop: ingest sources, model them, review the results, then run
procedures — and around again.

```text
[s] (Recommended) Sources — Ingest, scan, normalize, or refresh sources (<N> pending)
[m] Model — Create, author, validate, or audit kNNowledge models (<N> models)
[r] Review & Deliverables — Generate/preview dashboards, sites, consoles, reports
[p] Procedures — Discover and execute domain & blueprint SOP procedures (<N> available)
[h] Help & Documentation — Explore blueprints catalog, specs, guides, and the capabilities catalog
[x] Cancel / Exit
```

The `(Recommended)` tag is assigned dynamically to the first actionable stage:

1. If `sources.pending_count > 0` → `[s] (Recommended)`
2. Else if `knowledge.count > 0` → `[m] (Recommended)`
3. Else (empty workspace) → `[s] (Recommended)`

The `[s][m][r][p][h][x]` shape and the recommended selection are fixed. Contextual capabilities —
such as external watch roots — appear *inside* a stage, never as a new top-level letter.

### Sources sub-option and watch digest

When the domain declares external watch roots, `[s] Sources` offers **Scan external watch roots**
(an on-demand scan) instead of **Declare a watch root**. After the activation gate, `nn` also runs
the read-only session-start digest and presents each pending item for a per-item decision
(`ignore` / `postpone` / `import`). The digest never writes to `sources/`, and if it is
unavailable it is swallowed so it can never block the session.

## Routing and the procedure catalog

`nn` aggregates executable procedures from three scopes before presenting them:

1. **Model scope** — procedures declared inline or attached to active kNNowledge documents.
2. **Blueprint scope** — SOPs declared in the parent bluepriNNt's `procedures/` folder.
3. **Domain scope** — global domaiNN procedures under `procedures/`.

When the same procedure name appears in more than one scope, precedence is
**model > blueprint > domain**, and each option displays its origin badge (for example
`[p1] Extract Key Risks [blueprint:business]`).

`nn` does not execute procedure steps from its own text. It routes the selected procedure to the
canonical **Procedure Execution Protocol** owned by [nn-innfo](nn-innfo.md).

## System governance

`nn` enforces the shared governance and UX protocol for the whole ecosystem:

- **Zero unilateral mutation (consent first)** — never move, rename, delete, or restructure user
  files without explicit confirmation.
- **Recommended option first** — the computed default carries the `(Recommended)` tag and is
  presented first.
- **Conversations as reference** — allocate the session transcript in `conversations/` at start and
  auto-promote it at close (the user may opt out); transcripts are retained unconditionally.
- **Optimistic execution and reversibility** — proceed immediately on safe, standard, reversible
  actions, and reserve explicit confirmation for destructive ones.
- **Session language coherence** — keep the user's active conversation language across prompts,
  responses, and menus.
- **Business-user abstraction guard** — suppress internal engine plumbing (AST roles, raw hashes,
  line-ending warnings) and communicate in terms of domain value.

## Help

The `[h] Help` stage lists the platform capabilities — including **watched folders**, which ingest
new or evolved files from external directories without daemons — and points at the bluepriNNts
catalog, specifications, and guides.

## See also

- [nn-preflight](nn-preflight.md) — the readiness gate `nn` delegates to.
- [nn-sources](nn-sources.md) — the owner of the `[s] Sources` stage.
- [nn-innfo](nn-innfo.md) — the owner of the `[m] Model` stage and procedure execution.
- [Interaction flows](interaction-flows.md) — the full hand-off map.
