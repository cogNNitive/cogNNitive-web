import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SPEC_URL = new URL('../specs/V_0-3-3.json', import.meta.url)

/** Pinned digest of the vendored spec (line endings normalized to LF). */
const PINNED_SHA256 = 'd617aadcc85ad5816ca0b447e28032b14c1fc64bac65f550fa4149bd4f7cedda'

function normalizedSha256(): string {
  let text = readFileSync(fileURLToPath(SPEC_URL), 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex')
}

describe('vendored VUS spec', () => {
  it('hashes to the pinned digest', () => {
    expect(normalizedSha256()).toBe(PINNED_SHA256)
  })

  it('declares the pinned version', () => {
    const spec = JSON.parse(readFileSync(fileURLToPath(SPEC_URL), 'utf8'))
    expect(spec.info.version).toBe('V_0-3-3')
  })

  it('is stored with LF line endings so the raw bytes hash identically', () => {
    const raw = readFileSync(fileURLToPath(SPEC_URL))
    expect(raw.includes(0x0d)).toBe(false)
    expect(createHash('sha256').update(raw).digest('hex')).toBe(PINNED_SHA256)
  })
})
