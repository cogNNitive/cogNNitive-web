# bluepriNNts catalog

A **bluepriNNt** is a Level-2 (L2) domain schema: a specification file that declares the concepts, elements, fields, and matrices a domaiNN's kNNowledge documents must conform to. A kNNowledge document names its bluepriNNt in its `parent_spec`, and the validator resolves the schema from there. For the full abstraction chain, see [The four levels](../concepts/levels.md).

The catalog below is distributed with the ecosystem and is the authoritative list at [`iNNfo/specs/bluepriNNts/catalog.json`](../../../../iNNfo/specs/bluepriNNts/catalog.json). Each entry's **adopted** column is the `blueprint_version` currently published; the **tier** column is the distribution tier (`core` or `free`).

## Distributed bluepriNNts

| bluepriNNt | Adopted version | Tier |
|---|---|---|
| `analysis` | `V_0-4-0` | free |
| `artifacts` | `V_0-5-0` | core |
| `blank` | `V_0-4-0` | core |
| `business` | `V_0-5-0` | free |
| `business-model` | `V_0-4-0` | free |
| `changes` | `V_0-5-2` | core |
| `design-presets` | `V_0-4-0` | free |
| `documentation` | `V_0-4-0` | free |
| `domaiNN` | `V_0-4-0` | core |
| `innovation` | `V_0-4-0` | free |
| `metrics` | `V_0-5-0` | free |
| `organization` | `V_0-4-0` | free |
| `procedures` | `V_0-5-0` | core |
| `projects` | `V_0-4-0` | free |
| `repository` | `V_0-3-0` | free |
| `sidecar` | `V_0-1-1` | core |
| `sources` | `V_0-3-0` | core |
| `video-script` | `V_0-2-2` | free |
| `visual-catalog` | `V_0-3-0` | free |

## Frozen bluepriNNts

Two bluepriNNts are **frozen**: they are pinned to a fixed version and no longer receive new releases, because they define structural identities the rest of the ecosystem depends on.

| bluepriNNt | Adopted version | Notes |
|---|---|---|
| `cogNNitive` | `V_0-5-0` | The root blueprint every other blueprint and kNNowledge document ultimately traces to. |
| `workspace` | `V_0-10-0` | Frozen legacy blueprint for the domaiNN container. The container concept is now named `domaiNN`; the frozen `workspace` identifier is retained for legacy resolution only. |

## See also

- [The four levels](../concepts/levels.md)
- [The specification chain](../concepts/specifications.md)
- [MCP tools](mcp-tools.md)
