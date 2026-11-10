/**
 * nn-conntent/scripts/lib/delivery.mjs
 *
 * Automatic delivery: assemble `deliveries/v<N>/` after QA, keep earlier versions
 * immutable, and never renumber on a non-reproducible re-encode (capability
 * conntent-delivery; design D-P6; tasks 3b-5.1/3b-5.2).
 *
 * Zero external dependencies. ESM module.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { canonicalJson } from './canonical.mjs'

export const DELIVERIES_DIR = 'deliveries'
export const DELIVERY_META = 'delivery.json'

const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

/** The declared outputs as `[{ name, sha256 }]`, sorted by name. */
export function outputHashes(outputs = []) {
  return [...outputs]
    .map((file) => ({ name: path.basename(file), sha256: sha256File(file) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** `sha256` over the canonical sorted `{name, sha256}` list. */
export function outputsHash(outputs = []) {
  return crypto
    .createHash('sha256')
    .update(canonicalJson(outputHashes(outputs)))
    .digest('hex')
}

/** The highest `deliveries/v<N>/delivery.json`, or null. */
export function latestDelivery(episodeDir) {
  const root = path.join(episodeDir, DELIVERIES_DIR)
  if (!fs.existsSync(root)) return null
  const versions = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
    .map((entry) => Number(entry.name.slice(1)))
    .sort((a, b) => b - a)
  for (const version of versions) {
    const metaPath = path.join(root, `v${version}`, DELIVERY_META)
    if (!fs.existsSync(metaPath)) continue
    try {
      return {
        version: `v${version}`,
        number: version,
        meta: JSON.parse(fs.readFileSync(metaPath, 'utf8')),
      }
    } catch {
      continue
    }
  }
  return null
}

/** Hard-link, or copy when the filesystem refuses the link (EXDEV/EPERM/...). */
function linkOrCopy(source, destination, linkFile) {
  try {
    linkFile(source, destination)
  } catch (err) {
    if (!['EXDEV', 'EPERM', 'EACCES', 'EMLINK', 'ENOTSUP'].includes(err?.code)) throw err
    fs.copyFileSync(source, destination)
  }
}

function episodeSlugOf(episodeDir, outputs = []) {
  try {
    const entries = fs.readdirSync(episodeDir)
    const doc = entries.find((e) => /_coNNtent_NN\.md$/i.test(e))
    if (doc) return doc.replace(/_coNNtent_NN\.md$/i, '')
  } catch {}
  for (const out of outputs) {
    const base = path.basename(out)
    const m = base.match(/^([a-z0-9-]+)(?:_\d+x\d+)?(?:\.[^.]+)?$/i)
    if (m && m[1]) return m[1].replace(/_thumbnail$/, '')
  }
  return path.basename(episodeDir)
}

function findDomainRoot(episodeDir) {
  let curr = path.resolve(episodeDir)
  while (curr && curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, 'domaiNN_NN.md'))) return curr
    curr = path.dirname(curr)
  }
  return null
}

function renderDeliveryHtml({ slug, version, outputs = [], createdAt }) {
  const videoFiles = outputs.filter((f) => path.basename(f).endsWith('.mp4'))
  const thumbFiles = outputs.filter((f) => /\.(png|jpe?g|webp)$/i.test(path.basename(f)))
  const playersHtml = videoFiles
    .map(
      (f) =>
        `  <div class="nn-visual-card nn-delivery-player-card">
    <video class="nn-delivery-player" controls preload="metadata" playsinline src="./${path.basename(f)}"></video>
    <div class="nn-visual-details">${path.basename(f)}</div>
  </div>`,
    )
    .join('\n')
  const thumbsHtml = thumbFiles
    .map(
      (f) =>
        `  <img class="nn-delivery-thumbnail" src="./${path.basename(f)}" alt="${path.basename(f)}" />`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${slug} — Delivery ${version}</title>
</head>
<body>
  <div class="nn-delivery-view" data-nn-delivery-view="">
    <div class="nn-episode-head nn-delivery-head">
      <h1>${slug} (${version})</h1>
      <span class="nn-badge nn-delivery-version-badge">${version}</span>
      <span class="nn-delivery-time">Delivered: ${createdAt}</span>
    </div>
    <div class="nn-conntent-body">
      <div class="nn-form-section">
        <span class="nn-section-label">Media</span>
        <div class="nn-delivery-players">
${playersHtml}
        </div>
        <div class="nn-delivery-thumbnails">
${thumbsHtml}
        </div>
      </div>
      <div class="nn-form-section">
        <span class="nn-section-label">Quality Assurance</span>
        <div class="nn-gate-cell" data-nn-gate-cell="qa">
          <strong>Automatic QA</strong>
          <span class="nn-badge nn-gate-state" data-nn-gate-state="passed">passed</span>
          <span class="nn-gate-protects">All overlay, duration and output checks passed</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}

/**
 * Deliver the current outputs. Returns `{ version, created, outputsHash, inputFingerprint }`.
 *
 * A new version is created only when BOTH the outputs hash and the input fingerprint
 * differ from the latest delivery; if either matches, the run is a no-op. The folder is
 * assembled in a temporary sibling and renamed into place, so a failure never exposes a
 * partial delivery.
 *
 * @param {{ episodeDir: string, outputs: string[], inputFingerprint: string,
 *   linkFile?: (source: string, destination: string) => void,
 *   now?: Date,
 *   writeConsole?: Function,
 *   rootDir?: string,
 *   slug?: string,
 *   model?: string,
 *   models?: string[] }} input
 */
export async function deliver(input) {
  const {
    episodeDir,
    outputs = [],
    inputFingerprint,
    linkFile = fs.linkSync,
    now = new Date(),
    writeConsole: customWriteConsole,
    rootDir: customRootDir,
    slug: customSlug,
    model: customModel,
    models: customModels,
  } = input
  const hash = outputsHash(outputs)
  const latest = latestDelivery(episodeDir)
  if (
    latest &&
    (latest.meta.outputs_hash === hash || latest.meta.input_fingerprint === inputFingerprint)
  ) {
    return { version: latest.version, created: false, outputsHash: hash, inputFingerprint }
  }

  const number = latest ? latest.number + 1 : 1
  const deliveriesDir = path.join(episodeDir, DELIVERIES_DIR)
  fs.mkdirSync(deliveriesDir, { recursive: true })
  const staging = path.join(deliveriesDir, `.tmp-v${number}`)
  const final = path.join(deliveriesDir, `v${number}`)
  if (fs.existsSync(final)) {
    throw new Error(`Delivery ${final} already exists and cannot be replaced`)
  }
  fs.rmSync(staging, { recursive: true, force: true })
  fs.mkdirSync(staging, { recursive: true })
  try {
    for (const file of outputs) {
      linkOrCopy(file, path.join(staging, path.basename(file)), linkFile)
    }

    const slug = customSlug || episodeSlugOf(episodeDir, outputs)
    const htmlName = `${slug}_delivery.html`
    const domainRoot = customRootDir || findDomainRoot(episodeDir)
    const relOutFile = domainRoot
      ? path.relative(domainRoot, path.join(final, htmlName)).replace(/\\/g, '/')
      : path.join('deliveries', `v${number}`, htmlName).replace(/\\/g, '/')

    let writeConsoleFn = typeof customWriteConsole === 'function' ? customWriteConsole : null
    if (!writeConsoleFn && domainRoot) {
      try {
        const mod = await import('../../../../../../../scripts/export-console.mjs')
        if (typeof mod.writeConsole === 'function') writeConsoleFn = mod.writeConsole
      } catch {}
    }

    let htmlWritten = false
    if (writeConsoleFn && domainRoot) {
      try {
        const modelName = customModel || (customModels && customModels[0]) || slug
        const res = await writeConsoleFn({
          rootDir: domainRoot,
          stagingDir: staging,
          scope: {
            view: 'conntent-delivery',
            readOnly: true,
            models: [modelName],
            outFile: relOutFile,
          },
          open: false,
        })
        if (res && res.status !== 'error') {
          htmlWritten = true
        }
      } catch {}
    }

    if (!htmlWritten) {
      const htmlContent = renderDeliveryHtml({
        slug,
        version: `v${number}`,
        outputs,
        createdAt: now.toISOString(),
      })
      fs.writeFileSync(path.join(staging, htmlName), htmlContent, 'utf8')
    }

    const files = outputHashes(outputs)
    const descFile = outputs.find((f) => path.basename(f).endsWith('_description.md'))
    const description =
      descFile && fs.existsSync(descFile) ? fs.readFileSync(descFile, 'utf8') : undefined

    fs.writeFileSync(
      path.join(staging, DELIVERY_META),
      JSON.stringify(
        {
          version: `v${number}`,
          outputs_hash: hash,
          input_fingerprint: inputFingerprint,
          created_at: now.toISOString(),
          files,
          html: htmlName,
          ...(description !== undefined ? { description } : {}),
        },
        null,
        2,
      ),
      'utf8',
    )
    fs.renameSync(staging, final)
  } catch (err) {
    fs.rmSync(staging, { recursive: true, force: true })
    throw err
  }

  return { version: `v${number}`, created: true, outputsHash: hash, inputFingerprint }
}
