import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const hubPath = join(here, '..', '..', '..', 'specs', 'bluepriNNts', 'workspace', 'assets', 'workspace_hub.html')
const procedurePath = join(here, '..', '..', '..', 'specs', 'bluepriNNts', 'workspace', 'procedures', 'compile_workspace_hub_NN.md')

function readHub(): string {
  return readFileSync(hubPath, 'utf8')
}

describe('workspace_hub.html (Workspace Console Hub)', () => {
  it('exists as a standalone file:// document', () => {
    expect(existsSync(hubPath)).toBe(true)
    expect(readHub().toLowerCase()).toContain('<!doctype html>')
  })

  it('declares the innfo-workspace-data slot', () => {
    const html = readHub()
    expect(html).toContain('id="innfo-workspace-data"')
    expect(html).toContain('"workspace"')
    expect(html).toContain('"models"')
  })

  it('contains the prompt generation button and modal elements', () => {
    const html = readHub()
    expect(html).toContain('id="open-prompt-btn"')
    expect(html).toContain('id="prompt-modal"')
    expect(html).toContain('id="prompt-text-content"')
    expect(html).toContain('id="copy-prompt-btn"')
    expect(html).toContain('id="copy-status"')
    expect(html).toContain('Regenerate Consoles')
  })

  it('maintains strict offline file:// hygiene (no fetch, no modules)', () => {
    const html = readHub()
    expect(html).not.toContain('fetch(')
    expect(html).not.toContain('type="module"')
    expect(html).not.toContain('XMLHttpRequest')
  })

  it('includes prompt synthesis logic with template-to-procedure mapping', () => {
    const html = readHub()
    expect(html).toContain('generateAgentPrompt')
    expect(html).toContain('templateProcedureMap')
    expect(html).toContain('compile_business_console_NN.md')
    expect(html).toContain('compile_workspace_hub_NN.md')
  })
})

describe('compile_workspace_hub_NN.md (Procedure Spec)', () => {
  it('exists and documents the prompt generator deliverable', () => {
    expect(existsSync(procedurePath)).toBe(true)
    const proc = readFileSync(procedurePath, 'utf8')
    expect(proc).toContain('Compile Workspace Console Hub Procedure')
    expect(proc).toContain('prompt generator')
  })
})
