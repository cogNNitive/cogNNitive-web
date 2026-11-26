/**
 * nn-conntent/test/reference-catalog-anchor.test.mjs
 *
 * The reference catalog used to be resolved as four directories above `scripts/lib/catalog.mjs`.
 * That is the blueprint-package layout only: installed at `~/.config/opencode/skills/nn-conntent/`
 * it resolves to `~/.config/opencode/catalog/model-catalog_coNNtent_NN.md`, which does not exist.
 *
 * Resolution is now anchored explicitly (env, then the domaiNN that vendors the blueprint,
 * then the packaged layout) and a catalog that cannot be read or declares no Model is a named
 * error instead of a run against nothing — an empty catalog means no credential and no price
 * for anything, which used to surface as synthesized silence and unpriced models.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  CatalogError,
  REFERENCE_CATALOG,
  REFERENCE_CATALOG_ENV,
  REFERENCE_CATALOG_FILENAME,
  loadMergedCatalog,
  resolveReferenceCatalog,
} from '../scripts/lib/catalog.mjs'

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix))

/** A minimal catalog that parses to one Model. */
const MINIMAL = `---
level: 3
title: "Model Catalog"
---

# NN Model

## NN Model: demo-tts
slug:: demo-tts
provider:: demo
api_id:: demo/tts
capability:: tts
price:: 0.01
price_unit:: per_1k_chars
price_date:: 2026-11-02
status:: active
`

function withEnv(value, fn) {
  const before = process.env[REFERENCE_CATALOG_ENV]
  if (value === undefined) delete process.env[REFERENCE_CATALOG_ENV]
  else process.env[REFERENCE_CATALOG_ENV] = value
  try {
    return fn()
  } finally {
    if (before === undefined) delete process.env[REFERENCE_CATALOG_ENV]
    else process.env[REFERENCE_CATALOG_ENV] = before
  }
}

test('the explicit anchor wins and does not depend on the current directory', () => {
  const root = tmp('nn-cat-env-')
  const elsewhere = tmp('nn-cat-cwd-')
  const anchor = path.join(root, 'catalog.md')
  fs.writeFileSync(anchor, MINIMAL, 'utf8')
  const before = process.cwd()
  try {
    process.chdir(elsewhere)
    withEnv(anchor, () => {
      assert.equal(resolveReferenceCatalog(), anchor)
    })
  } finally {
    process.chdir(before)
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(elsewhere, { recursive: true, force: true })
  }
})

test('a domaiNN that vendors the blueprint resolves its own catalog copy', () => {
  const domainRoot = tmp('nn-cat-domain-')
  const vendored = path.join(
    domainRoot,
    'specs',
    'bluepriNNts',
    'coNNtent',
    'catalog',
    REFERENCE_CATALOG_FILENAME,
  )
  fs.mkdirSync(path.dirname(vendored), { recursive: true })
  fs.writeFileSync(vendored, MINIMAL, 'utf8')
  try {
    withEnv(undefined, () => {
      assert.equal(resolveReferenceCatalog({ domainRoot }), vendored)
      // And the merged catalog is built from it, not from wherever the package happens to sit.
      assert.ok(loadMergedCatalog({ domainRoot }).models['demo-tts'])
    })
  } finally {
    fs.rmSync(domainRoot, { recursive: true, force: true })
  }
})

test('a missing reference catalog is a named error, never an empty catalog', () => {
  const root = tmp('nn-cat-missing-')
  const missing = path.join(root, 'nope.md')
  try {
    assert.throws(
      () => loadMergedCatalog({ referencePath: missing }),
      (err) =>
        err instanceof CatalogError &&
        err.code === 'reference-catalog-missing' &&
        err.message.includes(missing),
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('a catalog that declares no Model is refused instead of authorizing nothing', () => {
  const root = tmp('nn-cat-empty-')
  const empty = path.join(root, 'empty.md')
  fs.writeFileSync(empty, '---\nlevel: 3\ntitle: "Empty"\n---\n\n# NN Model\n', 'utf8')
  try {
    assert.throws(
      () => loadMergedCatalog({ referencePath: empty }),
      (err) => err instanceof CatalogError && err.code === 'reference-catalog-empty',
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('the packaged layout still resolves in this repository', () => {
  withEnv(undefined, () => {
    assert.equal(resolveReferenceCatalog(), REFERENCE_CATALOG)
    assert.ok(fs.existsSync(REFERENCE_CATALOG))
  })
})
