import { describe, it, expect } from 'vitest'
import {
  recursiveParse,
  computeModelDagTopology,
  buildWorkspaceIndex,
  MAX_DEPTH,
} from '../src/index'
import type { DirectoryHandleLike, FileHandleLike } from '../src/fs-types'

function createFakeDirectoryHandle(files: Record<string, string>): DirectoryHandleLike {
  const fileHandles = new Map<string, FileHandleLike>()
  for (const [path, content] of Object.entries(files)) {
    const handle: FileHandleLike = {
      kind: 'file',
      name: path.split('/').pop()!,
      getFile: async () => ({ text: async () => content }) as File,
    }
    fileHandles.set(path, handle)
  }

  const handle: DirectoryHandleLike = {
    kind: 'directory',
    name: 'root',
    async getFileHandle(name: string) {
      if (fileHandles.has(name)) return fileHandles.get(name)!
      throw Object.assign(new Error(`file not found: ${name}`), { name: 'NotFoundError' })
    },
    async getDirectoryHandle(name: string) {
      const prefix = name + '/'
      const subFiles: Record<string, string> = {}
      let found = false
      for (const [k, v] of Object.entries(files)) {
        if (k.startsWith(prefix)) {
          found = true
          subFiles[k.slice(prefix.length)] = v
        }
      }
      if (found) return createFakeDirectoryHandle(subFiles)
      throw Object.assign(new Error(`directory not found: ${name}`), { name: 'NotFoundError' })
    },
    async *entries() {
      for (const [name] of Object.entries(files)) {
        if (!name.includes('/')) {
          yield [name, { kind: 'file', name }] as [string, FileHandleLike]
        }
      }
    },
  }
  return handle
}

describe('DAG Topology Scanner & Root Discovery (innfo-core)', () => {
  it('computes model in-degrees and discovers top-level root model (in_degree === 0)', async () => {
    const files: Record<string, string> = {
      'workspace_NN.md': `---
level: 3
parent_spec:
  name: workspace
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/workspace_spec_NN.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models
## NN Models: Primary Business
path:: models/business_NN.md

# NN Sources
## NN Sources: Sources Catalog
path:: sources_NN.md

# NN Procedures
## NN Procedures: Procedures Catalog
path:: procedures_NN.md

# NN Artifacts
## NN Artifacts: Artifacts Catalog
path:: artifacts_NN.md
`,
      'sources_NN.md': `---
level: 3
parent_spec:
  name: sources
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/sources/spec_NN.md
knowledge_version: V_0-1-0
title: Sources Catalog
---
# NN Source
## NN Source: Market Report
type:: local_file
format:: md
summary:: Comprehensive NYC market analysis.
source_model:: sources/nn/market_report_NN.md
`,
      'sources/nn/market_report_NN.md': `---
sha256: 1234567890abcdef
raw_path: sources/original/market.pdf
---
# NYC Market Report
Evidence content.
`,
      'procedures_NN.md': `---
level: 3
parent_spec:
  name: procedures
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md
knowledge_version: V_0-1-0
title: Procedures Catalog
---
# NN Procedure
## NN Procedure: Ingest Pipeline
summary:: Automated ingestion pipeline.
procedure_model:: procedures/ingest_pipeline_NN.md
`,
      'procedures/ingest_pipeline_NN.md': `---
level: 3
parent_spec:
  name: procedures
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md
knowledge_version: V_0-1-0
title: Ingest Pipeline Stepper
---
# NN Work
## NN Work: Step 1
next:: Step 2
`,
      'artifacts_NN.md': `---
level: 3
parent_spec:
  name: artifacts
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/artifacts/spec_NN.md
knowledge_version: V_0-1-0
title: Artifacts Catalog
---
# NN Artifact
## NN Artifact: Executive Summary
format:: model
summary:: Executive deliverable summary.
artifact_model:: artifacts/models/exec_summary_NN.md
`,
      'artifacts/models/exec_summary_NN.md': `---
level: 3
parent_spec:
  name: business
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/spec_NN.md
knowledge_version: V_0-1-0
title: Executive Summary Model
---
# NN Section
Content.
`,
      'models/business_NN.md': `---
level: 3
parent_spec:
  name: business
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/spec_NN.md
knowledge_version: V_0-1-0
title: Business Model
---
# NN Value Proposition
## NN Value Proposition: Core Service
description:: Elimination services.
`,
    }

    const root = createFakeDirectoryHandle(files)
    const result = await recursiveParse(root)

    expect(result.topology).toBeDefined()
    const topo = result.topology!

    // workspace_NN.md is the root with in-degree 0
    const wsNode = Object.values(result.nodes).find(
      (n) => n.kind === 'root' && n.source?.path === 'workspace_NN.md',
    )
    expect(wsNode).toBeDefined()
    expect(topo.inDegree[wsNode!.id]).toBe(0)
    expect(topo.rootIds).toContain(wsNode!.id)
    expect(topo.primaryRootId).toBe(wsNode!.id)

    // Submodels have in-degree >= 1
    const bizNode = Object.values(result.nodes).find(
      (n) => n.kind === 'root' && n.source?.path === 'models/business_NN.md',
    )
    expect(bizNode).toBeDefined()
    expect(topo.inDegree[bizNode!.id]).toBeGreaterThanOrEqual(1)

    const sourcesNode = Object.values(result.nodes).find(
      (n) => n.kind === 'root' && n.source?.path === 'sources_NN.md',
    )
    expect(sourcesNode).toBeDefined()
    expect(topo.inDegree[sourcesNode!.id]).toBeGreaterThanOrEqual(1)

    // Verify index attaches topology
    const index = buildWorkspaceIndex(result)
    expect(index.topology).toBeDefined()
    expect(index.topology?.primaryRootId).toBe(wsNode!.id)
  })

  it('detects cycles and halts recursive expansion gracefully with cycle issue', async () => {
    const files: Record<string, string> = {
      'workspace_NN.md': `---
level: 3
parent_spec:
  name: workspace
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/workspace_spec_NN.md
knowledge_version: V_0-1-0
title: Root
---
# NN Models
## NN Models: Model A
path:: models/a_NN.md
`,
      'models/a_NN.md': `---
level: 3
parent_spec:
  name: business
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/spec_NN.md
knowledge_version: V_0-1-0
title: Model A
---
# NN Submodels
## NN Submodels: Back To Root
path:: ../workspace_NN.md
`,
    }

    const root = createFakeDirectoryHandle(files)
    const result = await recursiveParse(root)

    const cycleIssue = result.issues.find((i) => i.code === 'CYCLE_DETECTED')
    expect(cycleIssue).toBeDefined()
    expect(cycleIssue?.message).toContain('Cycle detected')
  })

  it('enforces MAX_DEPTH = 10 recursion guard', async () => {
    const files: Record<string, string> = {
      'workspace_NN.md': `---
level: 3
parent_spec:
  name: workspace
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/workspace_spec_NN.md
knowledge_version: V_0-1-0
title: Depth 0
---
# NN Models
## NN Models: D1
path:: depth1.md
`,
    }

    for (let i = 1; i <= 12; i++) {
      files[`depth${i}.md`] = `---
level: 3
parent_spec:
  name: business
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/spec_NN.md
knowledge_version: V_0-1-0
title: Depth ${i}
---
# NN Models
## NN Models: Next
path:: depth${i + 1}.md
`
    }

    const root = createFakeDirectoryHandle(files)
    const result = await recursiveParse(root)

    const depthIssue = result.issues.find((i) => i.code === 'DEPTH_LIMIT')
    expect(depthIssue).toBeDefined()
    expect(depthIssue?.message).toContain(`MAX_DEPTH = ${MAX_DEPTH}`)
  })
})
