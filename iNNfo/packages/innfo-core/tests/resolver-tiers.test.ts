import { describe, it, expect } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import {
  getTemplateSearchPaths,
  resolveTemplatePath,
} from '../src/resolver.js'

describe('Task 7.4: Resolver Tiers and Canonical BluepriNNt Resolution', () => {
  it('searches specs/bluepriNNts, globalBlueprintsDir and skillsDir in precedence order and excludes templates/', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resolver-tiers-test-'))
    try {
      const workspaceDir = path.join(tmpDir, 'workspace')
      const globalBlueprintsDir = path.join(tmpDir, 'global-blueprints')
      const skillsDir = path.join(tmpDir, 'skills')

      await fs.mkdir(workspaceDir, { recursive: true })
      await fs.mkdir(globalBlueprintsDir, { recursive: true })
      await fs.mkdir(path.join(skillsDir, 'test-skill', 'bluepriNNts'), { recursive: true })

      // Create dummy blueprint in skill
      const skillBpPath = path.join(skillsDir, 'test-skill', 'bluepriNNts', 'projects_V_0-1-0_NN.md')
      await fs.writeFile(skillBpPath, '# NN Concept Definition\n', 'utf8')

      // Resolve blueprint present in skill
      const skillRes = await resolveTemplatePath('projects_V_0-1-0_NN.md', {
        workspaceDir,
        globalBlueprintsDir,
        skillsDir,
      })
      expect(skillRes).not.toBeNull()
      expect(skillRes?.source).toBe('skill')
      expect(skillRes?.filePath).toBe(skillBpPath)

      // Add blueprint to global blueprints dir (Tier 2 should beat Tier 3)
      const globalBpPath = path.join(globalBlueprintsDir, 'projects_V_0-1-0_NN.md')
      await fs.writeFile(globalBpPath, '# NN Concept Definition\n', 'utf8')

      const globalRes = await resolveTemplatePath('projects_V_0-1-0_NN.md', {
        workspaceDir,
        globalBlueprintsDir,
        skillsDir,
      })
      expect(globalRes).not.toBeNull()
      expect(globalRes?.source).toBe('global')
      expect(globalRes?.filePath).toBe(globalBpPath)

      // Add blueprint to domain specs/bluepriNNts (Tier 1 should beat Tier 2)
      const localBpDir = path.join(workspaceDir, 'specs', 'bluepriNNts')
      await fs.mkdir(localBpDir, { recursive: true })
      const localBpPath = path.join(localBpDir, 'projects_V_0-1-0_NN.md')
      await fs.writeFile(localBpPath, '# NN Concept Definition\n', 'utf8')

      const localRes = await resolveTemplatePath('projects_V_0-1-0_NN.md', {
        workspaceDir,
        globalBlueprintsDir,
        skillsDir,
      })
      expect(localRes).not.toBeNull()
      expect(localRes?.source).toBe('workspace')
      expect(localRes?.filePath).toBe(localBpPath)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('does NOT search retired templates/ or ~/.agents/templates/ directories', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resolver-retired-test-'))
    try {
      const workspaceDir = path.join(tmpDir, 'workspace')
      const legacyTemplatesDir = path.join(workspaceDir, 'bluepriNNts')
      await fs.mkdir(legacyTemplatesDir, { recursive: true })

      // Put blueprint only in retired templates/ folder
      const legacyBpPath = path.join(legacyTemplatesDir, 'legacy_spec_NN.md')
      await fs.writeFile(legacyBpPath, '# NN Concept Definition\n', 'utf8')

      const searchPaths = await getTemplateSearchPaths('legacy_spec_NN.md', {
        workspaceDir,
      })
      // Retired templates/ path should not be in search paths
      const hasRetiredTemplates = searchPaths.some((p) => p.includes(path.join('workspace', 'bluepriNNts')))
      expect(hasRetiredTemplates).toBe(false)

      const res = await resolveTemplatePath('legacy_spec_NN.md', {
        workspaceDir,
      })
      expect(res).toBeNull()
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})
