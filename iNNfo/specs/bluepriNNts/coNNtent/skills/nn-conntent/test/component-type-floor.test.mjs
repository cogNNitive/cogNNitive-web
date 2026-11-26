/**
 * nn-conntent/test/component-type-floor.test.mjs
 *
 * The output checkpoint runs `hyperframes check` on every emitted format project, and its
 * craft check enforces a 28px type floor as an ERROR (`text_below_floor`). A component the
 * blueprint ships must pass the gate the blueprint enforces: lower-third shipped at 22px and
 * every episode using it failed QA before delivery, caption shipped at 26px and watermark at
 * 20px with the same problem waiting.
 *
 * The floor is mirrored here on purpose: the CLI is not installed in this repository's test
 * environment (and installing it in a test would be a network call), so this is the local
 * statement of the same number. Raise it here when the CLI raises it there.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE = path.resolve(SKILL, '..', '..')
/** The `hyperframes check` craft floor, in CSS pixels. */
const TYPE_FLOOR_PX = 28

/** Every component the pipeline can stage: the library portfolio and the packaged slots. */
function shippedComponents() {
  const libraryDir = path.join(PACKAGE, 'library', 'components')
  const library = fs
    .readdirSync(libraryDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [
      `library/components/${entry.name}`,
      path.join(libraryDir, entry.name, 'index.html'),
    ])
    .filter(([, file]) => fs.existsSync(file))
  const slotsDir = path.join(SKILL, 'slots')
  const slots = fs
    .readdirSync(slotsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.html$/i.test(entry.name))
    .map((entry) => [`slots/${entry.name}`, path.join(slotsDir, entry.name)])
  return [...library, ...slots]
}

test('every shipped component declares text at or above the 28px craft floor', () => {
  const offenders = []
  for (const [label, file] of shippedComponents()) {
    const html = fs.readFileSync(file, 'utf8')
    for (const match of html.matchAll(/font-size:\s*([0-9.]+)px/g)) {
      const px = Number(match[1])
      if (Number.isFinite(px) && px < TYPE_FLOOR_PX)
        offenders.push(`${label}: ${px}px < ${TYPE_FLOOR_PX}px`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `components the pipeline would reject:\n  ${offenders.join('\n  ')}`,
  )
})

test('the lower third keeps its copy clear of the bottom-centre watermark band', () => {
  const html = fs.readFileSync(
    path.join(PACKAGE, 'library', 'components', 'lower-third', 'index.html'),
    'utf8',
  )
  // The overlay sits at 12% above the safe area's bottom edge; the watermark's band is 3%
  // tall plus one line of its own type. At the floor the two do not overlap on any canvas,
  // so the fix is not "raise the type until it clears" but "keep both bands apart".
  const bottom = Number(/\.nn-lower-third\s*\{[^}]*bottom:\s*([0-9.]+)%/.exec(html)?.[1])
  assert.ok(Number.isFinite(bottom), 'the lower third declares a percentage bottom')
  const watermark = fs.readFileSync(
    path.join(PACKAGE, 'library', 'components', 'watermark', 'index.html'),
    'utf8',
  )
  const band = Number(/\.nn-watermark\s*\{[^}]*bottom:\s*([0-9.]+)%/.exec(watermark)?.[1])
  const lineHeightPx = Number(/font-size:\s*([0-9.]+)px/.exec(watermark)?.[1]) * 1.2
  for (const height of [1080, 720]) {
    const lowerThirdPx = (bottom / 100) * height
    const watermarkTopPx = (band / 100) * height + lineHeightPx
    assert.ok(
      lowerThirdPx > watermarkTopPx,
      `${height}p: lower third bottom ${lowerThirdPx}px must clear the watermark band (${watermarkTopPx}px)`,
    )
  }
})
