# Workspace Console Hub

The Workspace Console Hub is the entry point to every model console in a
workspace: one aggregated portal listing each domain model and linking to its
compiled console. This page covers **how you reach it** and **how it stays
visually consistent with the editor**.

---

## Two layers, one experience

The hub is not a single component. It is two cooperating layers:

| Layer | What it is | Where it lives |
| :--- | :--- | :--- |
| **Editor host** | The `ConsoleHubView` in the iNNfo editor: title, console switcher tabs, actions | `iNNfo/apps/innfo-editor/src/components/editor/ConsoleHubView.vue` |
| **Hub artifact** | The generated, `file://`-standalone HTML portal | `iNNfo/specs/bluepriNNts/workspace/assets/workspace_hub.html` |

In the editor the artifact is embedded in a sandboxed `<iframe srcdoc>`. Opened
by double-click, the same artifact runs standalone with no host at all.

## Generating the consoles

Consoles are **generated deliverables**, produced by running compilation
procedures. To rebuild them without memorizing paths, use the
**Regenerate Consoles** action:

1. Open the Consoles view. If no console exists yet, the editor shows a
   **Build interactive consoles for this workspace** panel with the discovered
   models listed as pending.
2. Click **Generate Consoles with AI**. This opens a modal with a ready prompt.
3. Click **Copy Prompt** and paste it into your AI agent.

The generated prompt names, for each model, its compilation procedure and target
artifact, then instructs the agent to validate the models, regenerate each
console into `artifacts/`, recompile `artifacts/workspace_hub.html`, and verify
offline rendering.

> The action is reachable **before** the artifact exists — in the editor header
> and in the empty-state panel. Inside a compiled hub, the artifact carries its
> own **Regenerate Consoles** button with the same behavior. This matters:
> previously the only entry point lived inside the generated artifact, so it was
> invisible exactly when a workspace had no consoles yet.

### Procedure paths

The prompt maps each blueprint to its procedure under the current repository
layout, `iNNfo/specs/bluepriNNts/<blueprint>/procedures/...`. The mapping lives
in one shared module for the editor
(`iNNfo/apps/innfo-editor/src/services/consolePrompt.ts`) and is mirrored inline
in the artifact (it must stay dependency-free for `file://`). A drift test keeps
the two in agreement.

## Visual consistency with the app

The embedded hub must look like part of the editor, not a foreign panel. Two
mechanisms achieve that:

- **Host tokens in, artifact tokens out.** When embedding, the editor reads its
  own semantic design tokens (the `--primary` family) from the live document and
  injects them as a `:root` block into the sandbox. The artifact resolves its
  accent surfaces from `var(--nn-accent …)` with a brand-purple fallback, so the
  same artifact renders with the app palette when embedded and with its own
  defaults when opened standalone.
- **Single header.** In embedded mode the artifact's own `<header>` is hidden so
  the editor's Console Hub header is the only chrome. Standalone, the artifact
  header returns.

## Related reading

- [Offline Consoles](offline-consoles) — how a console boots from `file://`.
- [Console UI Kit](console-ui-kit) — the shared render primitives.
- [Console Needs & Visuals](console-needs-and-visuals) — the `needs[]` contract.
