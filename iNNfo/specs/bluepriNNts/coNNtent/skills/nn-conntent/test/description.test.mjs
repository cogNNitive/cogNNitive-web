#!/usr/bin/env node

/**
 * nn-conntent/test/description.test.mjs
 *
 * Tests for publication description generation and delivery inclusion (Tasks 3b-5.6 / 3b-5.8):
 * - Chapters block with <!-- chapters:start --> and <!-- chapters:end --> markers.
 * - Atomic write replacing only between markers, preserving existing prose.
 * - Included in delivery outputs and delivery.json metadata.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  CHAPTERS_END,
  CHAPTERS_START,
  buildChapters,
  chapterLines,
  formatTimecode,
  renderChapterBlock,
  updateDescriptionText,
  writeDescriptionFile,
} from '../scripts/lib/description.mjs'
import { deliver } from '../scripts/lib/delivery.mjs'

test('formatTimecode formats MM:SS and H:MM:SS', () => {
  assert.equal(formatTimecode(0), '00:00')
  assert.equal(formatTimecode(59), '00:59')
  assert.equal(formatTimecode(60), '01:00')
  assert.equal(formatTimecode(3665), '1:01:05')
})

test('buildChapters computes timecodes from manifest fromFrame and fps', () => {
  const manifest = {
    fps: 30,
    tracks: {
      scenes: [
        { id: 's1', slug: 'one', fromFrame: 0, props: { title: 'Intro' } },
        { id: 's2', slug: 'two', fromFrame: 900, props: { title: 'Middle' } },
        { id: 's3', slug: 'three', fromFrame: 2700, props: { title: 'Outro' } },
      ],
    },
  }
  const chapters = buildChapters(manifest)
  assert.deepEqual(chapters, [
    { startSeconds: 0, timecode: '00:00', title: 'Intro' },
    { startSeconds: 30, timecode: '00:30', title: 'Middle' },
    { startSeconds: 90, timecode: '01:30', title: 'Outro' },
  ])
  assert.deepEqual(chapterLines(manifest), ['00:00 Intro', '00:30 Middle', '01:30 Outro'])
})

test('renderChapterBlock wraps lines in standard markers', () => {
  const manifest = {
    fps: 30,
    tracks: {
      scenes: [{ id: 's1', fromFrame: 0, props: { title: 'Scene 1' } }],
    },
  }
  const block = renderChapterBlock(manifest)
  assert.equal(block, `${CHAPTERS_START}\n00:00 Scene 1\n${CHAPTERS_END}`)
})

test('updateDescriptionText seeds markers when absent and preserves prose', () => {
  const manifest = {
    fps: 30,
    tracks: {
      scenes: [
        { id: 's1', fromFrame: 0, props: { title: 'Scene 1' } },
        { id: 's2', fromFrame: 300, props: { title: 'Scene 2' } },
      ],
    },
  }

  // When no existing file/text:
  const fresh = updateDescriptionText('', manifest)
  assert.equal(fresh, `${CHAPTERS_START}\n00:00 Scene 1\n00:10 Scene 2\n${CHAPTERS_END}\n`)

  // When existing prose exists without markers:
  const prose = '# Episode Title\n\nThis is the episode summary.\n\n## Sources\n- source 1'
  const updated = updateDescriptionText(prose, manifest)
  assert.ok(updated.startsWith(prose))
  assert.ok(updated.includes(CHAPTERS_START))
  assert.ok(updated.includes(CHAPTERS_END))
})

test('updateDescriptionText replaces only bytes between markers, preserving surrounding text', () => {
  const header = '# My Title\n\nIntro summary\n\n'
  const oldChapters = `${CHAPTERS_START}\n00:00 Old 1\n${CHAPTERS_END}`
  const footer = '\n\n## Attribution\nSome credits here.\n'
  const existing = header + oldChapters + footer

  const newManifest = {
    fps: 30,
    tracks: {
      scenes: [
        { id: 's1', fromFrame: 0, props: { title: 'New 1' } },
        { id: 's2', fromFrame: 60, props: { title: 'New 2' } },
      ],
    },
  }

  const updated = updateDescriptionText(existing, newManifest)
  assert.ok(updated.startsWith(header))
  assert.ok(updated.endsWith(footer))
  assert.ok(updated.includes('00:00 New 1\n00:02 New 2'))
  assert.ok(!updated.includes('Old 1'))
})

test('writeDescriptionFile writes file atomically and delivers full description in delivery.json', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-desc-test-'))
  try {
    const descPath = path.join(tmp, 'probe_description.md')
    fs.writeFileSync(descPath, '# Authored Header\n\nSummary prose.\n', 'utf8')

    const manifest = {
      fps: 30,
      tracks: {
        scenes: [{ id: 's1', fromFrame: 0, props: { title: 'Start' } }],
      },
    }

    writeDescriptionFile(descPath, manifest)
    const content = fs.readFileSync(descPath, 'utf8')
    assert.ok(content.includes('# Authored Header'))
    assert.ok(content.includes('00:00 Start'))

    // Deliver with this description file
    const master = path.join(tmp, 'probe.mp4')
    fs.writeFileSync(master, 'dummy-video')

    const delRes = await deliver({
      episodeDir: tmp,
      outputs: [master, descPath],
      inputFingerprint: 'dummy-fp',
    })

    assert.equal(delRes.version, 'v1')
    const metaPath = path.join(tmp, 'deliveries', 'v1', 'delivery.json')
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))

    // Full description in delivery.json
    assert.equal(typeof meta.description, 'string')
    assert.equal(meta.description, content)
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {}
  }
})
