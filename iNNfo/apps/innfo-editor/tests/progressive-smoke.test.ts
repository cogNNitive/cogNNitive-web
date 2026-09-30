/**
 * tests/progressive-smoke.test.ts
 *
 * PRUEBAS PROGRESIVAS — de lo más simple a lo más completo.
 * Cada grupo asume que el anterior funciona. Si un paso falla,
 * no avances al siguiente hasta entender por qué.
 *
 * How to run:
 *   cd apps/format-editor
 *   npm test
 *   npx vitest run tests/progressive-smoke.test.ts
 *   npx vitest run tests/progressive-smoke.test.ts --reporter=verbose
 *
 * Models are defined inline using fakeFs (no external files needed).
 * Also includes tests that load real fixtures from tests/fixtures/.
 *
 * @group progressive
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

import { useModelStore } from '../src/stores/modelStore'
import { useWorkspaceStore } from '../src/stores/workspaceStore'
import { routes } from '../src/router/index'
import { recursiveParse } from '../src/model/recursiveParser'
import { buildFakeTree, type FakeTree } from './helpers/fakeFs'

// ── Fixtures ────────────────────────────────────────────────────

const SINGLE_FILE_MODEL = `---
spec_version: "V_0-1-1"
spec_url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
level: 3
parent:
  name: "business_V_0-1-1"
  url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
knowledge_version: "V_0-0-1"
title: "Mi Primer Modelo"
---

# NN Business summary

Un modelo mínimo para pruebas progresivas.

# NN Problems

## NN Problems: Problema Uno
La primera descripción del problema.
## NN Problems: Problema Dos
La segunda descripción del problema.
`

const INDEX_MD = `---
spec_version: "V_0-1-2"
level: 0
title: "Workspace Index"
---

# NN index

* [[MiModelo_NN.md]]
`

// ────────────────────────────────────────────────────────────────
// PASO 1: La aplicación carga
// ────────────────────────────────────────────────────────────────

describe('Paso 1 — La aplicación carga', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('1a: Pinia se inicializa sin errores', () => {
    const store = useModelStore()
    expect(store).toBeDefined()
    expect(store.nodes).toEqual({})
    expect(store.rootIds).toEqual([])
  })

  it('1b: Router se crea con las rutas esperadas', () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    expect(router).toBeDefined()

    const homeRoute = router.getRoutes().find((r) => r.name === 'home')
    const workspaceRoute = router.getRoutes().find((r) => r.name === 'workspace')

    expect(homeRoute).toBeDefined()
    expect(homeRoute!.path).toBe('/')
    expect(workspaceRoute).toBeDefined()
    expect(workspaceRoute!.path).toBe('/workspace')
  })

  it('1c: fake-indexeddb está disponible (necesario para workspaceStore)', () => {
    expect(() => indexedDB.open('test-db', 1)).not.toThrow()
  })

  it('1d: Helper buildFakeTree crea un handle sin errores', () => {
    const handle = buildFakeTree('test', { 'archivo.md': '# contenido' })
    expect(handle).toBeDefined()
    expect(handle.name).toBe('test')
    expect(handle.kind).toBe('directory')
  })
})

// ────────────────────────────────────────────────────────────────
// PASO 2: Cargar un modelo (single-file con index.md)
// ────────────────────────────────────────────────────────────────

describe('Paso 2 — Cargar modelo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('2a: parsea un workspace con index.md y produce exactamente 1 root', async () => {
    const tree: FakeTree = {
      'index.md': INDEX_MD,
      'MiModelo_NN.md': SINGLE_FILE_MODEL,
    }
    const handle = buildFakeTree('workspace', tree)
    const result = await recursiveParse(handle)

    expect(result.issues).toHaveLength(0)
    expect(result.rootIds).toHaveLength(1)
  })

  it('2b: el modelo tiene el nombre correcto', async () => {
    const tree: FakeTree = {
      'index.md': INDEX_MD,
      'MiModelo_NN.md': SINGLE_FILE_MODEL,
    }
    const handle = buildFakeTree('workspace', tree)
    const result = await recursiveParse(handle)

    const rootNode = Object.values(result.nodes).find((n) => n.parentId === null)
    expect(rootNode).toBeDefined()
    expect(rootNode!.name).toBe('MiModelo')
  })

  it('2c: el modelo contiene el root y los elementos inline declarados', async () => {
    const tree: FakeTree = {
      'index.md': INDEX_MD,
      'MiModelo_NN.md': SINGLE_FILE_MODEL,
    }
    const handle = buildFakeTree('workspace', tree)
    const result = await recursiveParse(handle)

    const rootNode = Object.values(result.nodes).find((n) => n.parentId === null)
    expect(rootNode).toBeDefined()
    expect(rootNode!.name).toBe('MiModelo')

    const nombres = Object.values(result.nodes).map((n) => n.name)
    expect(nombres).toContain('Problema Uno')
    expect(nombres).toContain('Problema Dos')
    expect(Object.keys(result.nodes).length).toBe(3) // root + 2 elementos
  })

  it('2d: carga un modelo real desde la carpeta fixtures/models', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const ghostbustersContent = readFileSync(
      join(import.meta.dirname!, 'fixtures', 'models', 'Ghostbusters_V_0-1-1_business_F.md'),
      'utf-8',
    )

    const ghostbustersIndex = `---
spec_version: "V_0-1-2"
level: 0
title: "Workspace Index"
---

# NN index

* [[Ghostbusters_NN.md]]
`

    const tree: FakeTree = {
      'index.md': ghostbustersIndex,
      'Ghostbusters_NN.md': ghostbustersContent,
    }
    const handle = buildFakeTree('workspace', tree)
    const result = await recursiveParse(handle)

    expect(result.issues).toHaveLength(0)

    const rootNode = Object.values(result.nodes).find((n) => n.parentId === null)
    expect(rootNode).toBeDefined()
    expect(Object.keys(result.nodes).length).toBeGreaterThan(1)
  })
})

// ────────────────────────────────────────────────────────────────
// PASO 3: workspaceStore abre un modelo
// ────────────────────────────────────────────────────────────────

describe('Paso 3 — workspaceStore abre un modelo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('3a: workspaceStore abre un workspace y modelStore tiene los nodos', async () => {
    const workspaceStore = useWorkspaceStore()
    const modelStore = useModelStore()
    const tree: FakeTree = {
      'index.md': INDEX_MD,
      'MiModelo_NN.md': SINGLE_FILE_MODEL,
    }
    const handle = buildFakeTree('workspace', tree)

    await workspaceStore.open(handle)

    expect(workspaceStore.hasParsed).toBe(true)
    expect(workspaceStore.parseCount).toBe(1)
    expect(Object.keys(modelStore.nodes).length).toBeGreaterThan(0)
    expect(modelStore.rootIds.filter((id) => !id.startsWith('spec:'))).toHaveLength(1)
  })

  it('3b: workspaceStore no re-parsea si se llama open() dos veces', async () => {
    const workspaceStore = useWorkspaceStore()
    const tree: FakeTree = {
      'index.md': INDEX_MD,
      'MiModelo_NN.md': SINGLE_FILE_MODEL,
    }
    const handle = buildFakeTree('workspace', tree)

    await workspaceStore.open(handle)
    await workspaceStore.open(handle)

    expect(workspaceStore.parseCount).toBe(1)
  })
})

// ────────────────────────────────────────────────────────────────
// PASO 4: Carga los fixtures REALES desde tests/fixtures/
// ────────────────────────────────────────────────────────────────

describe('Paso 4 — Fixtures reales desde tests/fixtures/ en la raíz', () => {
  it('4a: carga el modelo FILE real de tests/fixtures/file-model_F.md', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const content = readFileSync(
      join(import.meta.dirname!, '..', '..', '..', 'tests', 'fixtures', 'file-model_F.md'),
      'utf-8',
    )

    const indexMd = `---
spec_version: "V_0-1-2"
level: 0
title: "Workspace Index"
---

# _NN index

* [[file-model_NN.md]]
`

    const tree: FakeTree = { 'index.md': indexMd, 'file-model_NN.md': content }
    const handle = buildFakeTree('workspace', tree)
    const result = await recursiveParse(handle)

    expect(result.issues).toHaveLength(0)
    expect(result.rootIds).toHaveLength(1)

    const nombres = Object.values(result.nodes).map((n) => n.name)
    expect(nombres).toContain('file-model')
    expect(nombres).toContain('Baja adopción')
    expect(nombres).toContain('Costes elevados')
    expect(nombres).toContain('Competencia agresiva')
    expect(nombres).toContain('Onboarding exprés')
    expect(nombres).toContain('Infraestructura optimizada')
    expect(Object.keys(result.nodes).length).toBe(6) // root + 5 elementos
  })
})
