import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { SHIPPED_TEMPLATE_VERSIONS } from '../../src/config/samples'
import {
  compareVersions,
  parseVersionedFilename,
} from '../../src/composables/useTemplateVersionNotice'

/**
 * Disk-integrity guard for design.md D3 / O3: the bundled
 * `SHIPPED_TEMPLATE_VERSIONS` fallback map MUST stay in lock-step with the
 * `blueprint_version` frontmatter of the files actually shipped under
 * `specs/bluepriNNts/{slug}/`. Templates now use canonical unversioned filenames
 * (`spec_NN.md`), so the authoritative version is the frontmatter, never the
 * filename. The root `workspace_spec_NN.md` is deliberately out of scope — this
 * guard only walks `{slug}/` subdirectories.
 */
const templatesDir = join(import.meta.dirname!, '..', '..', '..', '..', 'specs', 'bluepriNNts')

function frontmatterTemplateVersion(absPath: string): string | null {
  const text = readFileSync(absPath, 'utf-8')
  const match = text.match(/^blueprint_version:\s*"?(V_\d+-\d+-\d+)"?\s*$/m)
  return match ? match[1] : null
}

function versionedFilesForSlug(slug: string): string[] {
  return readdirSync(join(templatesDir, slug)).filter(
    (name) =>
      name === 'spec_NN.md' || parseVersionedFilename(name)?.slug === slug,
  )
}

function maxTemplateVersionOnDisk(slug: string): string | null {
  const versions = versionedFilesForSlug(slug)
    .map((name) => frontmatterTemplateVersion(join(templatesDir, slug, name)))
    .filter((v): v is string => v !== null)
  if (versions.length === 0) return null
  return versions.reduce((best, v) => (compareVersions(v, best) > 0 ? v : best))
}

const onDiskVersionedSlugs = readdirSync(templatesDir)
  .filter((entry) => statSync(join(templatesDir, entry)).isDirectory())
  .filter((slug) => versionedFilesForSlug(slug).length > 0)

describe('SHIPPED_TEMPLATE_VERSIONS — disk integrity (D3 / O3)', () => {
  it('each map value equals the highest blueprint_version shipped on disk for that slug', () => {
    for (const [slug, mapped] of Object.entries(SHIPPED_TEMPLATE_VERSIONS)) {
      expect(maxTemplateVersionOnDisk(slug), `highest on-disk blueprint_version for "${slug}"`).toBe(
        mapped,
      )
    }
  })

  it('every on-disk template slug with a versioned filename is a map key', () => {
    const missing = onDiskVersionedSlugs.filter((slug) => !(slug in SHIPPED_TEMPLATE_VERSIONS))
    expect(missing).toEqual([])
  })
})
