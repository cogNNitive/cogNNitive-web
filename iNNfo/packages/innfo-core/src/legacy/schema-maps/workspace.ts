// legacy:nn-rename/schema-maps

import type { SchemaMap } from './types.js'

export const workspaceSchemaMap: SchemaMap = {
  blueprint: 'workspace',
  from: {
    versions: ['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.5.0'],
    canonicalConcepts: ['Workspace', 'Models', 'Templates'],
  },
  to: {
    name: 'domaiNN',
    version: '0.1.0',
  },
  concepts: {
    rename: {
      Workspace: 'domaiNN',
      Models: 'kNNowledge',
      Templates: 'bluepriNNts',
    },
  },
  fields: {
    rename: {
      template_version: 'blueprint_version',
      template_name: 'blueprint_name',
      models_dir: 'knowledge_dir',
      templates_dir: 'blueprints_dir',
      model_version: 'knowledge_version',
      target_template: 'target_blueprint',
    },
  },
  knowledgeBump: 'minor',
}
