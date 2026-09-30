import { describe, it, expect } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// RED phase for task 1.2 (Activation Gate) + amendment 1.6: the gate probe
// helpers must be exported by the extended verify.harness.js (fail as RED until
// shipped), the gate opens ONLY when runtime pins reachable AND file:// smoke
// passes AND the `charts` capability is registered (third criterion), and the
// procedure must document the gate with an inline-canonical rule (doc-level
// assertions go GREEN when create_timeline_NN.md carries its gate step).
const here = dirname(fileURLToPath(import.meta.url))
const harnessPath = join(
  here,
  '..',
  '..',
  '..',
  'specs',
  'bluepriNNts',
  'metrics',
  'scripts',
  'verify.harness.js',
)
const procedurePath = join(
  here,
  '..',
  '..',
  '..',
  'specs',
  'bluepriNNts',
  'metrics',
  'procedures',
  'create_timeline_NN.md',
)
const nodeRequire = createRequire(import.meta.url)

interface GateApi {
  evaluateGate(probe: {
    runtimeReachable: boolean
    fileSmokePassed: boolean
    chartsRegistered: boolean
  }): 'open' | 'closed'
  thinDecision(gate: 'open' | 'closed'): 'thin' | 'keep-inline'
}

function loadGate(): GateApi {
  return nodeRequire(harnessPath) as GateApi
}

describe('activation gate: probe open/closed paths (incl. charts registered)', () => {
  const gate = loadGate()

  it('is OPEN only when runtime reachable AND file:// smoke passed AND charts registered', () => {
    expect(
      gate.evaluateGate({ runtimeReachable: true, fileSmokePassed: true, chartsRegistered: true }),
    ).toBe('open')
  })

  it('is CLOSED when the runtime pin does not resolve (Pages/jsDelivr down)', () => {
    expect(
      gate.evaluateGate({ runtimeReachable: false, fileSmokePassed: true, chartsRegistered: true }),
    ).toBe('closed')
  })

  it('is CLOSED when the file:// smoke fails even if the CDN pin resolves', () => {
    expect(
      gate.evaluateGate({ runtimeReachable: true, fileSmokePassed: false, chartsRegistered: true }),
    ).toBe('closed')
  })

  it('is CLOSED when charts is NOT registered even with runtime + smoke green', () => {
    expect(
      gate.evaluateGate({ runtimeReachable: true, fileSmokePassed: true, chartsRegistered: false }),
    ).toBe('closed')
  })

  it('is CLOSED when neither probe criterion holds', () => {
    expect(
      gate.evaluateGate({ runtimeReachable: false, fileSmokePassed: false, chartsRegistered: false }),
    ).toBe('closed')
  })
})

describe('activation gate: inline stays canonical while gated', () => {
  it('keeps the inline dashboard canonical when the gate is closed', () => {
    expect(loadGate().thinDecision('closed')).toBe('keep-inline')
  })

  it('only thins after the gate opens', () => {
    expect(loadGate().thinDecision('open')).toBe('thin')
  })
})

describe('activation gate: procedure encodes the gate as a pre-step', () => {
  it('documents an Activation Gate step before any console generation', () => {
    const procedure = readFileSync(procedurePath, 'utf8')
    expect(procedure.toLowerCase()).toContain('activation gate')
  })

  it('states the inline dashboard stays canonical while the gate is closed', () => {
    const procedure = readFileSync(procedurePath, 'utf8')
    expect(procedure.toLowerCase()).toMatch(/inline[^.]*canonical|canonical[^.]*inline/)
    expect(procedure.toLowerCase()).toMatch(/gate\s+(is\s+)?closed/)
  })

  it('does not produce a console when the gate is closed', () => {
    const procedure = readFileSync(procedurePath, 'utf8')
    expect(procedure.toLowerCase()).toContain('no `*_console.html`')
  })

  it('requires the charts capability to be registered before thinning', () => {
    const procedure = readFileSync(procedurePath, 'utf8')
    expect(procedure.toLowerCase()).toContain('charts')
    expect(procedure.toLowerCase()).toContain('needs-registry.json')
  })
})