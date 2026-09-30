import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ConsoleHubView from '../../src/components/editor/ConsoleHubView.vue'
import { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { useModelStore } from '../../src/stores/modelStore'
import { buildFakeTree } from '../helpers/fakeFs'

describe('ConsoleHubView — Open External (F-16)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resolves through the file handle (Blob URL) when a local folder handle is active', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = buildFakeTree('workspace', {
      artifacts: {
        'workspace_hub.html': '<html><body>Hub</body></html>',
      },
    })

    const wrapper = mount(ConsoleHubView)
    await flushPromises()

    const link = wrapper.find('a[title="Open in external browser window"]')
    expect(link.exists()).toBe(true)
    // A bare relative path resolves against the app origin and 404s for a
    // local folder opened via the File System Access API — it must be a
    // Blob URL built from the already-read file content instead.
    expect(link.attributes('href')).toMatch(/^blob:/)

    wrapper.unmount()
  })

  it('keeps the plain relative/URL path when no folder handle is active (hosted/sample mode)', async () => {
    const wrapper = mount(ConsoleHubView)
    await flushPromises()

    const link = wrapper.find('a[title="Open in external browser window"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).not.toMatch(/^blob:/)

    wrapper.unmount()
  })

  it('selects and loads a model console when receiving innfo:select-console message', async () => {
    const workspaceStore = useWorkspaceStore()
    const modelStore = useModelStore()
    workspaceStore.handle = buildFakeTree('workspace', {
      artifacts: {
        'workspace_hub.html': '<html><body>Hub</body></html>',
        'business_console.html': '<html><body>Business Console Content</body></html>',
      },
    })
    modelStore.setGraph(
      {
        Business: {
          id: 'Business',
          name: 'Business',
          parentId: null,
          childIds: [],
          storageMode: 'FILE',
          type: 'business',
          fields: {
            template: { value: 'business' },
          },
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'models/Business_NN.md' },
        },
      },
      ['Business']
    )

    const wrapper = mount(ConsoleHubView)
    await flushPromises()

    // Dispatch message from child iframe
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'innfo:select-console',
          modelId: 'Business',
          title: 'Business',
          consolePath: 'artifacts/business_console.html',
        },
      })
    )
    await flushPromises()

    expect(wrapper.text()).toContain('Business Console')
    wrapper.unmount()
  })

  it('adapts legacy dark hub HTML to light mode and registers unmapped consoles dynamically', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = buildFakeTree('workspace', {
      artifacts: {
        'workspace_hub.html': '<html class="h-full bg-slate-900 text-slate-100"><body class="bg-slate-950"><div class="bg-slate-900/90 text-white border-slate-800">Legacy Hub</div></body></html>',
      },
      export: {
        iNNtrevistas_V_0_1_0_console: {
          'iNNtrevistas_V_0_1_0_console.html': '<html><body>iNNtrevistas Console Content</body></html>',
        },
      },
    })

    const wrapper = mount(ConsoleHubView)
    await flushPromises()

    // Dispatch message for a model not registered in modelStore (e.g. from legacy hub launch click)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'innfo:select-console',
          modelId: 'iNNtrevistas',
          title: 'iNNtrevistas - Innovaciones y Creadores',
          consolePath: 'export/iNNtrevistas_V_0_1_0_console/iNNtrevistas_V_0_1_0_console.html',
        },
      })
    )
    await flushPromises()

    expect(wrapper.text()).toContain('iNNtrevistas - Innovaciones y Creadores Console')
    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('srcdoc')).toContain('iNNtrevistas Console Content')

    wrapper.unmount()
  })

  it('resolves console path with leading ../ and casing/separator variations via flexible resolver', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = buildFakeTree('workspace', {
      artifacts: {
        'workspace_hub.html': '<html><body>Hub</body></html>',
      },
      export: {
        'iNNtrevistas_V_0-1-0_console': {
          'iNNtrevistas_V_0-1-0_console.html': '<html><body>iNNtrevistas Resolved Content</body></html>',
        },
      },
    })

    const wrapper = mount(ConsoleHubView)
    await flushPromises()

    // Dispatch message with leading ../
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'innfo:select-console',
          modelId: 'iNNtrevistas',
          title: 'iNNtrevistas',
          consolePath: '../export/iNNtrevistas_V_0-1-0_console/iNNtrevistas_V_0-1-0_console.html',
        },
      })
    )
    await flushPromises()

    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('srcdoc')).toContain('iNNtrevistas Resolved Content')

    wrapper.unmount()
  })

  it('inlines relative and vendored console runtime scripts into iframe srcdoc for offline execution', async () => {
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = buildFakeTree('workspace', {
      artifacts: {
        'workspace_hub.html': '<html><body>Hub</body></html>',
      },
      export: {
        'iNNtrevistas_V_0-1-0_console': {
          'iNNtrevistas_V_0-1-0_console.html': `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="./custom-style.css">
</head>
<body>
  <div id="app-root">Model Content</div>
  <script src="https://cdn.jsdelivr.net/gh/cogNNitive/cogNNitive@innfo-console-v0.1.0/iNNfo/specs/bluepriNNts/console/render-model-viewer.js"></script>
  <script src="https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/console/render-model-viewer.js"></script>
  <script src="./render-model-viewer.js"></script>
</body>
</html>`,
          'render-model-viewer.js': 'window.InnfoModelViewer = { init: () => "OK" };',
          'custom-style.css': 'body { background: red; }',
        },
      },
    })

    const wrapper = mount(ConsoleHubView)
    await flushPromises()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'innfo:select-console',
          modelId: 'iNNtrevistas',
          title: 'iNNtrevistas',
          consolePath: 'export/iNNtrevistas_V_0-1-0_console/iNNtrevistas_V_0-1-0_console.html',
        },
      })
    )
    await flushPromises()

    const iframe = wrapper.find('iframe')
    expect(iframe.exists()).toBe(true)
    const srcdoc = iframe.attributes('srcdoc') || ''
    
    // Check that script was inlined
    expect(srcdoc).toContain('window.InnfoModelViewer = { init: () => "OK" };')
    expect(srcdoc).toContain('/* Inlined: render-model-viewer.js */')

    // Check that style was inlined
    expect(srcdoc).toContain('/* Inlined: custom-style.css */')
    expect(srcdoc).toContain('body { background: red; }')

    // Check that redundant fallback tags were cleaned up to avoid CORS / 404 console noise
    expect(srcdoc).toContain('<!-- [Inlined render-model-viewer.js earlier] -->')

    wrapper.unmount()
  })

  it('filters out spec nodes and workspace root manifests from model console switcher tabs', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        'workspace-root': {
          id: 'workspace-root',
          name: 'INNTrevistas Workspace',
          parentId: null,
          childIds: [],
          storageMode: 'FILE',
          type: 'workspace',
          fields: {
            title: { value: 'INNTrevistas Workspace' },
            template: { value: 'workspace' },
          },
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'workspace_NN.md' },
        },
        'spec:workspace': {
          id: 'spec:workspace',
          name: 'Spec:Workspace',
          parentId: null,
          childIds: [],
          storageMode: 'FILE',
          type: 'spec',
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'iNNfo/specs/workspace_spec_NN.md' },
        },
        'spec:business': {
          id: 'spec:business',
          name: 'Spec:Business',
          parentId: null,
          childIds: [],
          storageMode: 'FILE',
          type: 'spec',
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'iNNfo/specs/business_spec_NN.md' },
        },
        'business-model': {
          id: 'business-model',
          name: 'INNTrevistas - Innovaciones Y Creadores De La Historia',
          parentId: null,
          childIds: [],
          storageMode: 'FILE',
          type: 'business',
          fields: {
            title: { value: 'INNTrevistas - Innovaciones Y Creadores De La Historia' },
            template: { value: 'business' },
          },
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'models/INNTrevistas - Innovaciones Y Creadores De La Historia_NN.md' },
        },
      },
      ['workspace-root', 'spec:workspace', 'spec:business', 'business-model']
    )

    const wrapper = mount(ConsoleHubView)
    await flushPromises()

    const text = wrapper.text()
    // Workspace Hub button is present
    expect(text).toContain('Workspace Hub')
    // Domain model console tab is present
    expect(text).toContain('INNTrevistas - Innovaciones Y Creadores De La Historia')
    // Internal specs are excluded
    expect(text).not.toContain('Spec:Workspace')
    expect(text).not.toContain('Spec:Business')
    // Duplicate workspace manifest tab is excluded (since Workspace Hub covers it)
    expect(text).not.toContain('INNTrevistas Workspace')

    wrapper.unmount()
  })
})

