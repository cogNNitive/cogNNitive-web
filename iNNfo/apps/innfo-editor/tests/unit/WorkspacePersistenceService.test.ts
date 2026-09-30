import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { useUiStore } from '../../src/stores/uiStore'
import { saveActiveFile } from '../../src/services/WorkspacePersistenceService'
import { buildFakeTree } from '../helpers/fakeFs'

describe('WorkspacePersistenceService — Collision Detection & Auto-Merge', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('automatically merges disk changes (e.g. added by agent) with memory edits on save', async () => {
    const domainContent = `---
spec_version: "V_0-3-0"
level: 1
title: "Filmography Domain"
---

# NN index

* [[kNNowledge/model_NN.md]]
`

    const initialContent = `---
spec_version: "V_0-3-0"
level: 3
knowledge_version: "V_0-0-1"
title: "Filmography"
---

# NN Movies

## NN Movies: Casablanca
  year:: 1942

# NN Scenes

## NN Scenes: Airport Farewell
  movie:: [[Casablanca]]
`

    const fakeTree = buildFakeTree('workspace', {
      'domaiNN_NN.md': domainContent,
      kNNowledge: {
        'model_NN.md': initialContent,
      },
    })

    const knowledgeStore = useKnowledgeStore()
    const uiStore = useUiStore()

    // 1. Open workspace into memory
    await knowledgeStore.parseFromHandle(fakeTree)
    const rootId = knowledgeStore.rootIds[0]
    expect(rootId).toBeDefined()

    // 2. User edits field in memory (e.g. adds director in UI)
    const movieNode = Object.values(knowledgeStore.nodes).find((n) => n.name === 'Casablanca')
    expect(movieNode).toBeDefined()
    movieNode!.fields = {
      ...movieNode!.fields,
      director: { value: 'Michael Curtiz', type: 'string' } as any,
    }
    knowledgeStore.markDirty(movieNode!.id)

    // 3. Concurrently, an AI agent modifies the file on disk (adds a new scene)
    const diskContentWithAgentScene = `---
spec_version: "V_0-3-0"
level: 3
knowledge_version: "V_0-0-1"
title: "Filmography"
---

# NN Movies

## NN Movies: Casablanca
  year:: 1942

# NN Scenes

## NN Scenes: Airport Farewell
  movie:: [[Casablanca]]

## NN Scenes: Rick's Cafe Piano
  movie:: [[Casablanca]]
`
    const knowledgeDir = (await fakeTree.getDirectoryHandle('kNNowledge')) as any
    const fileHandle = await knowledgeDir.getFileHandle('model_NN.md')
    const writable = await fileHandle.createWritable()
    await writable.write(diskContentWithAgentScene)
    await writable.close()

    // 4. User triggers save
    await saveActiveFile(fakeTree, null, knowledgeStore, uiStore, false)

    // 5. Read back saved content from disk
    const savedHandle = await knowledgeDir.getFileHandle('model_NN.md')
    const savedFile = await savedHandle.getFile()
    const savedText = await savedFile.text()

    // Assert: BOTH changes are present!
    expect(savedText).toContain('Michael Curtiz')
    expect(savedText).toContain('Rick\'s Cafe Piano')
  })
})
