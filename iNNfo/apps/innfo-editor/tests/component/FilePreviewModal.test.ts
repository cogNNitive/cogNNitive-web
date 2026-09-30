import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FilePreviewModal from '../../src/components/editor/FilePreviewModal.vue'
import MermaidWidget from '../../src/shared/widgets/MermaidWidget.vue'
import { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { parseSourceRef } from '../../src/utils/sourceRef'
import { buildFakeTree, type FakeTree } from '../helpers/fakeFs'

const markdownWithFrontmatter = `---
source_file: "sources/original/clientA/report.docx"
sha256: "abc123"
size_bytes: 42
normalized_at: "2026-01-01T00:00:00Z"
---

Normalized content line 1.
`

const unitMd = [
  '# Overview', // 0
  '', // 1
  '## NN Person: Dr. Egon Spengler', // 2
  'compensation:: Equal partner share.', // 3
  '', // 4
].join('\n')

const unitCsv = ['cliente_id,mrr_usd', '101,45000', '104,78000', ''].join('\n')

describe('FilePreviewModal knowledge units', () => {
  let unitWrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    unitWrapper?.unmount()
    unitWrapper = null
  })

  async function mountWithContent(tree: FakeTree, props: Record<string, unknown>): Promise<void> {
    const handle = buildFakeTree('workspace', tree)
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = handle
    unitWrapper = mount(FilePreviewModal, {
      props: { isOpen: true, kind: 'source', ...props },
      attachTo: document.body,
    })
  }

  it('highlights a Markdown field line for a field pointer', async () => {
    await mountWithContent(
      { sources: { nn: { 'g.md': unitMd } } },
      {
        filePath: 'sources/nn/g.md',
        fileName: 'g.md',
        unit: {
          kind: 'header',
          level: 2,
          text: 'NN Person: Dr. Egon Spengler',
          slug: 'nn-person--dr-egon-spengler',
        },
        subunits: ['compensation'],
      },
    )
    await vi.waitFor(() => {
      const hits = [...document.body.querySelectorAll('.unit-targeted')]
      if (!hits.some((el) => el.textContent?.includes('compensation::'))) {
        throw new Error('field line not highlighted yet')
      }
    })
  })

  it('renders a CSV table with the targeted row highlighted', async () => {
    await mountWithContent(
      { sources: { nn: { 'm.csv': unitCsv } } },
      {
        filePath: 'sources/nn/m.csv',
        fileName: 'm.csv',
        unit: { kind: 'row', id: '104' },
        subunits: [],
      },
    )
    await vi.waitFor(() => {
      const row = document.body.querySelector('[data-csv-row="1"]')
      if (!row || !row.textContent?.includes('78000')) {
        throw new Error('csv row not rendered yet')
      }
    })
    const row = document.body.querySelector('[data-csv-row="1"]')!
    expect(row.className).toContain('unit-targeted')
  })

  it('highlights the targeted CSV cell', async () => {
    await mountWithContent(
      { sources: { nn: { 'm.csv': unitCsv } } },
      {
        filePath: 'sources/nn/m.csv',
        fileName: 'm.csv',
        unit: { kind: 'row', id: '104' },
        subunits: ['mrr_usd'],
      },
    )
    await vi.waitFor(() => {
      const cell = document.body.querySelector('[data-csv-cell="1:1"]')
      if (!cell) throw new Error('csv cell not rendered yet')
    })
    const cell = document.body.querySelector('[data-csv-cell="1:1"]')!
    expect(cell.textContent).toContain('78000')
    expect(cell.className).toContain('unit-targeted')
  })
})

describe('FilePreviewModal', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const originalCreateObjectURL = URL.createObjectURL

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.restoreAllMocks()
    URL.createObjectURL = originalCreateObjectURL
  })

  it('does not render any sourceId badge (no synthetic id in the header)', async () => {
    const tree: FakeTree = {
      sources: {
        nn: {
          'report.md': markdownWithFrontmatter,
        },
      },
    }
    const handle = buildFakeTree('workspace', tree)
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = handle

    const parsed = parseSourceRef('sources/nn/report.md')
    wrapper = mount(FilePreviewModal, {
      props: { isOpen: true, kind: 'source', filePath: parsed.filePath, fileName: parsed.fileName },
      attachTo: document.body,
    })

    // loadSourceContent() is async (handle traversal + frontmatter parse); wait for the
    // resolved source_file value, not just the always-present "Archivo Original" label.
    await vi.waitFor(() => {
      expect(document.body.textContent ?? '').toContain('sources/original/clientA/report.docx')
    })

    const bodyText = document.body.textContent ?? ''
    expect(bodyText).not.toContain('src-ref')
    expect(bodyText).toContain('Archivo Original')
  })

  it('opens the original file via the workspace handle when the "open original" button is clicked', async () => {
    const tree: FakeTree = {
      sources: {
        original: {
          clientA: {
            'report.docx': 'binary-ish content',
          },
        },
        nn: {
          'report.md': markdownWithFrontmatter,
        },
      },
    }
    const handle = buildFakeTree('workspace', tree)
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = handle

    const createObjectURLSpy = vi.fn().mockReturnValue('blob:fake-url')
    // happy-dom does not implement URL.createObjectURL; stub it directly rather than spyOn.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(URL as any).createObjectURL = createObjectURLSpy
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const parsed = parseSourceRef('sources/nn/report.md')
    wrapper = mount(FilePreviewModal, {
      props: { isOpen: true, kind: 'source', filePath: parsed.filePath, fileName: parsed.fileName },
      attachTo: document.body,
    })

    // Wait for loadSourceContent() to resolve frontmatter metadata and render the button.
    const openButton = await vi.waitFor(() => {
      const el = document.body.querySelector(
        'button[title="Abrir archivo original en una pestaña nueva"]',
      )
      if (!el) throw new Error('open-original button not yet rendered')
      return el as HTMLElement
    })

    openButton.click()

    await vi.waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled()
    })
    // The third argument isolates the opened tab from window.opener.
    expect(openSpy).toHaveBeenCalledWith('blob:fake-url', '_blank', 'noopener,noreferrer')
  })

  it('switches to the lineage view and renders the mermaid graph with upstream and downstream nodes', async () => {
    const tree: FakeTree = {
      sources: {
        nn: {
          'report.md': markdownWithFrontmatter,
        },
      },
    }
    const handle = buildFakeTree('workspace', tree)
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = handle

    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.nodes['CaseStudy/Intro'] = {
      id: 'CaseStudy/Intro',
      name: 'Intro',
      parentId: 'CaseStudy',
      childIds: [],
      type: 'Section',
      fields: {},
      markers: {},
      relationships: [
        { targetId: 'CaseStudy/Conclusion', label: 'references', origin: 'metamodel' },
      ],
      rawSections: {},
      source: { path: 'kNNowledge/casestudy_V_0-1-0_business_NN.md' },
      sources: [
        {
          filePath: 'sources/nn/report.md',
          fileName: 'report.md',
          kind: 'source',
          raw: 'sources/nn/report.md',
        },
      ],
    } as any

    const parsed = parseSourceRef('sources/nn/report.md')
    wrapper = mount(FilePreviewModal, {
      props: { isOpen: true, kind: 'source', filePath: parsed.filePath, fileName: parsed.fileName },
      attachTo: document.body,
    })

    // Wait for loadSourceContent() to resolve frontmatter so the upstream node is available.
    await vi.waitFor(() => {
      expect(document.body.textContent ?? '').toContain('sources/original/clientA/report.docx')
    })

    const lineageButton = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Linaje'),
    )
    expect(lineageButton).toBeTruthy()

    lineageButton!.click()
    await vi.waitFor(() => {
      expect(document.body.querySelector('.widget-mermaid')).toBeTruthy()
    })

    // The lineage graph must render the Mermaid widget and the downstream/upstream nodes, not the empty state.
    expect(document.body.textContent ?? '').not.toContain('No hay información de linaje')
    const mermaidWidget = wrapper.findComponent(MermaidWidget)
    if (mermaidWidget.exists()) {
      const code = mermaidWidget.props('modelValue') as string
      expect(code).toContain('FOCAL')
      expect(code).toContain('UP -->|normalizado| FOCAL')
      expect(code).toContain('Intro')
    }
  })

  it('renders the lineage graph at natural size, top-down', async () => {
    const tree: FakeTree = {
      sources: {
        nn: {
          'report.md': markdownWithFrontmatter,
        },
      },
    }
    const handle = buildFakeTree('workspace', tree)
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = handle

    const parsed = parseSourceRef('sources/nn/report.md')
    wrapper = mount(FilePreviewModal, {
      props: { isOpen: true, kind: 'source', filePath: parsed.filePath, fileName: parsed.fileName },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(document.body.textContent ?? '').toContain('sources/original/clientA/report.docx')
    })

    const lineageButton = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Linaje'),
    )
    lineageButton!.click()

    await vi.waitFor(() => {
      expect(document.body.querySelector('.widget-mermaid')).toBeTruthy()
    })

    const mermaidWidget = wrapper.findComponent(MermaidWidget)
    const code = mermaidWidget.props('modelValue') as string
    expect(code.startsWith('%%{init: {"flowchart": {"useMaxWidth": false}}}%%\ngraph TD')).toBe(
      true,
    )
  })

  it('collapses the 4th-level outgoing relationships by default and expands them via the toggle', async () => {
    const tree: FakeTree = {
      sources: {
        nn: {
          'report.md': markdownWithFrontmatter,
        },
      },
    }
    const handle = buildFakeTree('workspace', tree)
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = handle

    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.nodes['Rel/A'] = { id: 'Rel/A', name: 'A', type: 'Section' } as any
    knowledgeStore.nodes['Rel/B'] = { id: 'Rel/B', name: 'B', type: 'Section' } as any
    knowledgeStore.nodes['Rel/C'] = { id: 'Rel/C', name: 'C', type: 'Section' } as any
    knowledgeStore.nodes['Rel/D'] = { id: 'Rel/D', name: 'D', type: 'Section' } as any
    knowledgeStore.nodes['Rel/E'] = { id: 'Rel/E', name: 'E', type: 'Section' } as any
    knowledgeStore.nodes['CaseStudy/Intro'] = {
      id: 'CaseStudy/Intro',
      name: 'Intro',
      parentId: 'CaseStudy',
      childIds: [],
      type: 'Section',
      fields: {},
      markers: {},
      relationships: [
        { targetId: 'Rel/A', label: 'references', origin: 'metamodel' },
        { targetId: 'Rel/B', label: 'references', origin: 'metamodel' },
        { targetId: 'Rel/C', label: 'references', origin: 'metamodel' },
        { targetId: 'Rel/D', label: 'references', origin: 'metamodel' },
        { targetId: 'Rel/E', label: 'references', origin: 'metamodel' },
      ],
      rawSections: {},
      source: { path: 'kNNowledge/casestudy_V_0-1-0_business_NN.md' },
      sources: [
        {
          filePath: 'sources/nn/report.md',
          fileName: 'report.md',
          kind: 'source',
          raw: 'sources/nn/report.md',
        },
      ],
    } as any

    const parsed = parseSourceRef('sources/nn/report.md')
    wrapper = mount(FilePreviewModal, {
      props: { isOpen: true, kind: 'source', filePath: parsed.filePath, fileName: parsed.fileName },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(document.body.textContent ?? '').toContain('sources/original/clientA/report.docx')
    })

    const lineageButton = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Linaje'),
    )
    lineageButton!.click()

    await vi.waitFor(() => {
      expect(document.body.querySelector('.widget-mermaid')).toBeTruthy()
    })

    const mermaidWidget = wrapper.findComponent(MermaidWidget)

    // Collapsed by default: no R_x_y nodes, a "+5 hidden" node instead.
    await vi.waitFor(() => {
      const code = mermaidWidget.props('modelValue') as string
      if (!code.includes('+5 hidden')) throw new Error('not collapsed yet')
    })
    let code = mermaidWidget.props('modelValue') as string
    expect(code).toContain('+5 hidden')
    expect(code).not.toMatch(/R_0_\d+\[/)

    const toggleButton = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('hidden'),
    )
    expect(toggleButton).toBeTruthy()

    toggleButton!.click()

    await vi.waitFor(() => {
      code = mermaidWidget.props('modelValue') as string
      if (!code.includes('R_0_0[')) throw new Error('not expanded yet')
    })
    code = mermaidWidget.props('modelValue') as string
    expect(code).toContain('R_0_0[')
    expect(code).toContain('R_0_1[')
    expect(code).toContain('R_0_2[')
    expect(code).toContain('+2 hidden')
    expect(code).not.toContain('+5 hidden')
  })

  it('shows no collapse toggle when the deepest outgoing chain is only 3 levels', async () => {
    const tree: FakeTree = {
      sources: {
        nn: {
          'report.md': markdownWithFrontmatter,
        },
      },
    }
    const handle = buildFakeTree('workspace', tree)
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = handle

    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.nodes['CaseStudy/Intro'] = {
      id: 'CaseStudy/Intro',
      name: 'Intro',
      parentId: 'CaseStudy',
      childIds: [],
      type: 'Section',
      fields: {},
      markers: {},
      // No outgoing relationships: the chain stops at UP -> FOCAL -> citing node
      // (3 levels), so there is no 4th level to collapse.
      relationships: [],
      rawSections: {},
      source: { path: 'kNNowledge/casestudy_V_0-1-0_business_NN.md' },
      sources: [
        {
          filePath: 'sources/nn/report.md',
          fileName: 'report.md',
          kind: 'source',
          raw: 'sources/nn/report.md',
        },
      ],
    } as any

    const parsed = parseSourceRef('sources/nn/report.md')
    wrapper = mount(FilePreviewModal, {
      props: { isOpen: true, kind: 'source', filePath: parsed.filePath, fileName: parsed.fileName },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(document.body.textContent ?? '').toContain('sources/original/clientA/report.docx')
    })

    const lineageButton = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Linaje'),
    )
    lineageButton!.click()

    await vi.waitFor(() => {
      expect(document.body.querySelector('.widget-mermaid')).toBeTruthy()
    })

    const toggleButton = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('hidden'),
    )
    expect(toggleButton).toBeUndefined()
  })
})
