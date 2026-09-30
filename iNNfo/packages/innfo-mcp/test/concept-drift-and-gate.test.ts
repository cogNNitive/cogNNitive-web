import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile } from 'node:fs/promises'
import { validateKnowledge } from '../src/tools/validate.js'

const rootDir = join(import.meta.dirname!, '..', 'temp-test-drift-and-gate')

describe('Phase 2 Hard-Gate & Concept Drift Diagnostics (innfo-validation-resilience)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(join(rootDir, 'models'), { recursive: true })
    await mkdir(join(rootDir, 'specs'), { recursive: true })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(rootDir, { recursive: true, force: true })
  })

  describe('Phase 2 Hard-Gate & Error Suppression', () => {
    it('emits PARENT_RESOLUTION_FAILED and suppresses downstream errors when parent_spec cannot be resolved', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('offline network'))

      const unresolvableModel = `---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: "unknown_custom_spec_xyz"
  url: "https://unknown.invalid/specs/nonexistent_spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Unresolvable Parent Model"
---

# NN UnknownConcept

## NN UnknownConcept: BrokenElement
nonexistent_field:: value
dangling_ref:: [[DoesNotExist]]
`
      const modelPath = join(rootDir, 'models', 'Broken_V_0-1-0_NN.md')
      await writeFile(modelPath, unresolvableModel, 'utf-8')

      const result = await validateKnowledge(rootDir, 'Broken_V_0-1-0_NN', undefined, undefined, false)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      const parentError = result.errors.find(
        (e) => e.code === 'PARENT_RESOLUTION_FAILED' || e.code === 'PARENT_SPEC_UNRESOLVABLE',
      )
      expect(parentError).toBeDefined()
      expect(parentError?.message).toContain('https://unknown.invalid/specs/nonexistent_spec_NN.md')
      expect(parentError?.message).toContain('searched')

      // Ensure downstream cascading errors (like field type errors, matrix errors) were suppressed
      const secondaryErrors = result.errors.filter(
        (e) => e.code !== 'PARENT_RESOLUTION_FAILED' && e.code !== 'PARENT_SPEC_UNRESOLVABLE',
      )
      expect(secondaryErrors).toHaveLength(0)
    })
  })

  describe('Phase 3 Concept Drift Diagnostics', () => {
    it('detects typos with Levenshtein distance and suggests the canonical concept name', async () => {
      const businessModelWithTypo = `---
spec_version: "V_0-2-0"
level: 3
parent_spec:
  name: "business"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/business_V_0-2-0_NN.md"
knowledge_version: "V_0-1-0"
title: "Typo Model"
---

# NN Stakeholder

## NN Stakeholder: Acme Corp
importance:: high
`
      const modelPath = join(rootDir, 'models', 'Typo_V_0-1-0_NN.md')
      await writeFile(modelPath, businessModelWithTypo, 'utf-8')

      const result = await validateKnowledge(rootDir, 'Typo_V_0-1-0_NN', undefined, undefined, false)

      const driftWarning = result.warnings.find(
        (w) =>
          w.code === 'CONCEPT_DRIFT_WARNING' ||
          w.message.toLowerCase().includes('did you mean "stakeholders"'),
      )
      expect(driftWarning).toBeDefined()
      expect(driftWarning?.message).toMatch(/stakeholders/i)
      expect(result.valid).toBe(true)
    })

    it('detects cross-template concepts and suggests composition via includes', async () => {
      const businessModelWithProcedures = `---
spec_version: "V_0-2-0"
level: 3
parent_spec:
  name: "business"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/business_V_0-2-0_NN.md"
knowledge_version: "V_0-1-0"
title: "Cross Template Model"
---

# NN Work

## NN Work: Customer Onboarding
output_status:: pending
`
      const modelPath = join(rootDir, 'models', 'Cross_V_0-1-0_NN.md')
      await writeFile(modelPath, businessModelWithProcedures, 'utf-8')

      const result = await validateKnowledge(rootDir, 'Cross_V_0-1-0_NN', undefined, undefined, false)

      const crossWarning = result.warnings.find(
        (w) =>
          w.code === 'CONCEPT_DRIFT_WARNING' &&
          (w.message.includes('procedures') || w.message.includes('Work')),
      )
      expect(crossWarning).toBeDefined()
      expect(crossWarning?.message).toMatch(/procedures/i)
      expect(crossWarning?.message).toMatch(/includes/i)
      expect(result.valid).toBe(true)
    })

    it('suggests creating a specialization for novel unknown concepts', async () => {
      const businessModelWithNovelConcept = `---
spec_version: "V_0-2-0"
level: 3
parent_spec:
  name: "business"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/business_V_0-2-0_NN.md"
knowledge_version: "V_0-1-0"
title: "Novel Concept Model"
---

# NN QuantumTeleportationMatrix

## NN QuantumTeleportationMatrix: Qubit1
`
      const modelPath = join(rootDir, 'models', 'Novel_V_0-1-0_NN.md')
      await writeFile(modelPath, businessModelWithNovelConcept, 'utf-8')

      const result = await validateKnowledge(rootDir, 'Novel_V_0-1-0_NN', undefined, undefined, false)

      const novelWarning = result.warnings.find(
        (w) =>
          w.code === 'CONCEPT_DRIFT_WARNING' &&
          w.message.includes('QuantumTeleportationMatrix'),
      )
      expect(novelWarning).toBeDefined()
      expect(novelWarning?.message).toMatch(/specialization/i)
      expect(result.valid).toBe(true)
    })

    it('exempts reserved structural headings from concept drift warnings', async () => {
      const validBusinessModelWithStructuralSections = `---
spec_version: "V_0-2-0"
level: 3
parent_spec:
  name: "business"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/business_V_0-2-0_NN.md"
knowledge_version: "V_0-1-0"
title: "Structural Sections Model"
---

# NN index
* [[Stakeholders]]
* [[Offerings]]

# NN Stakeholders
## NN Stakeholders: Enterprise Customer
relationship_model:: B2B

# NN Offerings
## NN Offerings: Core Platform

# NN matrices: stakeholders-offerings matrix
| Stakeholders \\ Offerings | Core Platform |
| :--- | :---: |
| Enterprise Customer | X |

## NN External Watch Roots:
sources:: [sources/nn/watch.md]

## NN Agent Modification: test-mod
rationale:: Added core platform
author:: Antigravity
`
      const modelPath = join(rootDir, 'models', 'Structural_V_0-1-0_NN.md')
      await writeFile(modelPath, validBusinessModelWithStructuralSections, 'utf-8')

      const result = await validateKnowledge(rootDir, 'Structural_V_0-1-0_NN', undefined, undefined, false)

      // None of index, matrices, External Watch Roots, or Agent Modification should trigger CONCEPT_DRIFT_WARNING
      const driftWarnings = result.warnings.filter((w) => w.code === 'CONCEPT_DRIFT_WARNING')
      expect(driftWarnings).toHaveLength(0)
      expect(result.valid).toBe(true)
    })
  })

  describe('UTF-8 BOM Ingestion Resilience', () => {
    it('transparently parses and validates a model payload with leading UTF-8 BOM', async () => {
      const bomContent = `\uFEFF---
spec_version: "V_0-2-0"
level: 3
parent_spec:
  name: "business"
  url: "business"
knowledge_version: "V_0-1-0"
title: "BOM Model"
---

# NN Stakeholders

## NN Stakeholders: Partner
relationship_model:: B2B
`
      const modelPath = join(rootDir, 'models', 'BOM_V_0-1-0_NN.md')
      await writeFile(modelPath, bomContent, 'utf-8')

      const result = await validateKnowledge(rootDir, 'BOM_V_0-1-0_NN', undefined, undefined, false)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})
