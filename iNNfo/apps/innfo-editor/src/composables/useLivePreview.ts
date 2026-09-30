/**
 * useLivePreview — read-only live consumer for the MCP preview stream.
 *
 * When the editor is opened with the live parameters (`models`, `live`,
 * `token`), it subscribes to the MCP's SSE change stream and re-fetches the
 * affected model on every `model-changed` event, preserving the current view
 * and selected node. The workspace is flagged read-only so no human edit can
 * be lost when a mutation event replaces the graph.
 *
 * The preview tab is a mirror of the agent's work, never a second editor.
 */
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { useUiStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useUrlDocLoader } from './useUrlDocLoader'

export interface LivePreviewParams {
  /** SSE base origin, e.g. `http://127.0.0.1:54321`. */
  live: string
  /** Per-session access token from the mutating tool envelope. */
  token: string
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`
}

/**
 * Composable that consumes the MCP preview change stream and refreshes the
 * graph in place. `start()` subscribes; `stop()` tears the subscription down.
 */
export function useLivePreview() {
  let source: EventSource | null = null

  /** Loopback URL serving the canonical Markdown of one previewed model. */
  function modelUrlFor(params: LivePreviewParams, modelId: string): string {
    return joinUrl(params.live, `/model/${encodeURIComponent(modelId)}?token=${encodeURIComponent(params.token)}`)
  }

  /**
   * Re-fetch one model from the preview endpoint and splice it into the graph,
   * leaving other models untouched. Preserves the selected node when it still
   * exists after the refresh.
   */
  async function applyModelChanged(modelId: string, params: LivePreviewParams): Promise<void> {
    const knowledgeStore = useKnowledgeStore()
    const uiStore = useUiStore()
    const { fetch } = useUrlDocLoader()

    const result = await fetch(modelUrlFor(params, modelId))
    if (result.error) return

    const merged: typeof knowledgeStore.nodes = {}
    for (const [id, node] of Object.entries(knowledgeStore.nodes)) {
      if (knowledgeStore.getKnowledgeRootForNode(id) !== modelId) merged[id] = node
    }
    Object.assign(merged, result.nodes)

    const roots = knowledgeStore.rootIds.filter((id) => id !== modelId)
    for (const id of result.rootIds) {
      if (!roots.includes(id)) roots.push(id)
    }
    knowledgeStore.setGraph(merged, roots)

    const selected = uiStore.selectedNodeId
    if (selected && !merged[selected]) {
      uiStore.selectNode(roots[0] ?? null)
    }
  }

  /** Subscribe to the change stream and enter read-only live mode. */
  function start(params: LivePreviewParams): void {
    stop()
    useWorkspaceStore().setPreviewReadOnly(true)
    if (typeof EventSource === 'undefined') return

    source = new EventSource(joinUrl(params.live, `/events?token=${encodeURIComponent(params.token)}`))
    source.addEventListener('model-changed', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { model?: string }
        if (data.model) void applyModelChanged(data.model, params)
      } catch {
        // A malformed frame is ignored; the next event still refreshes.
      }
    })
  }

  /** Tear down the change-stream subscription. */
  function stop(): void {
    source?.close()
    source = null
  }

  return { start, stop, applyModelChanged, modelUrlFor }
}
