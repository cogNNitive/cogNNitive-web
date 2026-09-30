import { describe, it, expect } from 'vitest'
import { applyLanguageMap, migrateContent, migratePath } from '../../src/legacy/language-map.js'

describe('language-map (Task 5.4)', () => {
  describe('migratePath', () => {
    it('migrates entrypoint workspace_NN.md -> domaiNN_NN.md', () => {
      expect(migratePath('workspace_NN.md')).toBe('domaiNN_NN.md')
      expect(migratePath('workspace.md')).toBe('domaiNN_NN.md')
      expect(migratePath('Ghostbusters_V_0-1-0_base_NN.md')).toBe('domaiNN_NN.md')
    })

    it('migrates kNNowledge/ -> kNNowledge/', () => {
      expect(migratePath('kNNowledge/core_NN.md')).toBe('kNNowledge/core_NN.md')
      expect(migratePath('kNNowledge/sub/item_NN.md')).toBe('kNNowledge/sub/item_NN.md')
    })

    it('migrates specs/bluepriNNts/ and templates/ -> specs/bluepriNNts/', () => {
      expect(migratePath('specs/bluepriNNts/base/spec_NN.md')).toBe('specs/bluepriNNts/base/spec_NN.md')
      expect(migratePath('templates/custom/spec_NN.md')).toBe('specs/bluepriNNts/custom/spec_NN.md')
    })

    it('preserves other paths', () => {
      expect(migratePath('docs/readme.md')).toBe('docs/readme.md')
      expect(migratePath('sources/data.json')).toBe('sources/data.json')
    })
  })

  describe('migrateContent', () => {
    it('renames frontmatter keys while keeping values unchanged', () => {
      const input = `---
knowledge_version: "0.3.1"
blueprint_version: "0.1.0"
template_name: "domaiNN"
models_dir: "models"
templates_dir: "specs/bluepriNNts"
target_blueprint: "base"
---
# Content
`
      const output = migrateContent(input, 'kNNowledge/test_NN.md')
      expect(output).toContain('knowledge_version: "0.3.1"')
      expect(output).not.toContain('knowledge_version:')
      expect(output).toContain('blueprint_version: "0.1.0"')
      expect(output).not.toContain('blueprint_version:')
      expect(output).toContain('blueprint_name: "domaiNN"')
      expect(output).not.toContain('template_name:')
      expect(output).toContain('knowledge_dir: "kNNowledge"')
      expect(output).not.toContain('models_dir:')
      expect(output).toContain('blueprints_dir: "specs/bluepriNNts"')
      expect(output).not.toContain('templates_dir:')
      expect(output).toContain('target_blueprint: "base"')
      expect(output).not.toContain('target_blueprint:')
    })

    it('migrates keyword type:: knowledge -> type:: knowledge', () => {
      const input = `# Concept\n- Field\n  - type:: knowledge\n`
      const output = migrateContent(input, 'specs/bluepriNNts/custom/spec_NN.md')
      expect(output).toContain('type:: knowledge')
      expect(output).not.toContain('type:: knowledge')
    })

    it('migrates headings and wikilinks: Workspace, Models, Templates -> domaiNN, kNNowledge, bluepriNNts', () => {
      const input = `# Workspace\n\nSee [[#Workspace]] and [[#Models]] and [[#Templates]].\n\n## Models\n\n## Templates\n`
      const output = migrateContent(input, 'workspace_NN.md')
      expect(output).toContain('# domaiNN')
      expect(output).toContain('## kNNowledge')
      expect(output).toContain('## bluepriNNts')
      expect(output).toContain('[[#domaiNN]]')
      expect(output).toContain('[[#kNNowledge]]')
      expect(output).toContain('[[#bluepriNNts]]')
    })

    it('migrates path:: and markdown relative links', () => {
      const input = `- Ref: path:: kNNowledge/core_NN.md\n- Spec: path:: specs/bluepriNNts/base/spec_NN.md\n- Link: [Core](./kNNowledge/core_NN.md)\n- Link2: [[kNNowledge/sub/core_NN.md]]\n- Entrypoint: path:: workspace_NN.md\n`
      const output = migrateContent(input, 'workspace_NN.md')
      expect(output).toContain('path:: kNNowledge/core_NN.md')
      expect(output).toContain('path:: specs/bluepriNNts/base/spec_NN.md')
      expect(output).toContain('[Core](./kNNowledge/core_NN.md)')
      expect(output).toContain('[[kNNowledge/sub/core_NN.md]]')
      expect(output).toContain('path:: domaiNN_NN.md')
    })

    it('migrates parent_spec and L1 parent URLs to canonical V_0-3-0 and bluepriNNts', () => {
      const input = `---
parent_spec:
  url: "https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/bluepriNNts/workspace/spec_NN.md"
parent: "https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/iNNfo_V_0-2-2_NN.md"
---
`
      const output = migrateContent(input, 'workspace_NN.md')
      expect(output).toContain('https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md')
      expect(output).toContain('https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md')
    })

    it('migrates JSON feedback and export-meta keys', () => {
      const feedbackJson = JSON.stringify({
        source_model: "Company",
        source_knowledge_version: "0.1.0",
        target_blueprint: "business",
        model: "Enterprise",
        knowledge_version: "0.2.0"
      }, null, 2)

      const output = migrateContent(feedbackJson, 'feedback.json')
      const parsed = JSON.parse(output)
      expect(parsed.source_knowledge).toBe("Company")
      expect(parsed.source_knowledge_version).toBe("0.1.0")
      expect(parsed.target_blueprint).toBe("business")
      expect(parsed.knowledge).toBe("Enterprise")
      expect(parsed.knowledge_version).toBe("0.2.0")
      expect(parsed.source_model).toBeUndefined()
    })
  })
})
