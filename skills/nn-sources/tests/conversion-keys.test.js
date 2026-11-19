const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const os = require('os')

const scanner = require('../scripts/scanner')
const { conversionMetadata } = require('../scripts/lib/normalizer')

test('conversionMetadata names the backend and states the extraction quality per format', () => {
  assert.deepEqual(conversionMetadata('.pdf'), {
    backend: 'pdf-parse',
    backend_reason: 'text layer only; scanned pages produce no text',
    quality: 'good',
  })
  assert.deepEqual(conversionMetadata('.docx'), { backend: 'mammoth', quality: 'good' })
  assert.deepEqual(conversionMetadata('.xlsx'), { backend: 'xlsx', quality: 'good' })
  assert.deepEqual(conversionMetadata('srt'), {
    backend: 'subtitles-to-markdown',
    quality: 'good',
  })

  // A partial extraction is never silent: `fair` plus the extractor's own reason.
  assert.deepEqual(conversionMetadata('.html', { partial: true, note: 'content wall detected' }), {
    backend: 'html-to-text',
    backend_reason: 'structural tags stripped; no layout or reading order',
    quality: 'fair',
    quality_reason: 'content wall detected',
  })

  // No converter ran, so nothing is asserted about the subject.
  assert.deepEqual(conversionMetadata('.md'), {})
  assert.deepEqual(conversionMetadata('.csv'), {})
  assert.deepEqual(conversionMetadata('.json'), {})
})

test('scan writes the conversion keys only where a converter produced the body', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-convkeys-'))

  try {
    const projDir = path.join(tmp, 'Proj')
    const importDir = path.join(projDir, 'sources', 'import')
    fs.mkdirSync(importDir, { recursive: true })
    fs.writeFileSync(path.join(importDir, 'call.txt'), 'hola mundo', 'utf8')
    fs.writeFileSync(path.join(importDir, 'note.md'), '---\ntitle: N\n---\n\n# N\n', 'utf8')

    await scanner.scanAndProcess(projDir, { autoAcceptPrompt: true })

    const txtSidecar = fs.readFileSync(path.join(importDir, 'call.txt_sidecar_NN.md'), 'utf8')
    assert.match(txtSidecar, /^backend: text-reflow$/m)
    assert.match(txtSidecar, /^quality: good$/m)

    const mdSidecar = fs.readFileSync(path.join(importDir, 'note.md_sidecar_NN.md'), 'utf8')
    assert.doesNotMatch(mdSidecar, /^backend:/m)
    assert.doesNotMatch(mdSidecar, /^quality:/m)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
