export const CANONICAL_KNOWLEDGE_DIR = 'kNNowledge'
export const CANONICAL_BLUEPRINTS_DIR = 'specs/bluepriNNts'
export const CANONICAL_DOMAIN_ENTRYPOINT = 'domaiNN_NN.md'
export const CANONICAL_GLOBAL_BLUEPRINTS_DIR = '~/.agents/bluepriNNts'

export function isExactKnowledgeDir(name: string): boolean {
  return name === CANONICAL_KNOWLEDGE_DIR
}

export function isExactBlueprintsDir(name: string): boolean {
  return name === 'bluepriNNts'
}

export function isExactDomainEntrypoint(name: string): boolean {
  return name === CANONICAL_DOMAIN_ENTRYPOINT
}

export function verifyCaseExactLayout(entries: string[]): { ok: boolean; errors: string[] } {
  const errors: string[] = []

  for (const entry of entries) {
    if (entry.toLowerCase() === 'domaiNN_NN.md'.toLowerCase() && entry !== CANONICAL_DOMAIN_ENTRYPOINT) {
      errors.push(`Entrypoint '${entry}' has invalid casing (expected '${CANONICAL_DOMAIN_ENTRYPOINT}')`)
    }
    if (/^k?n*owledge$/i.test(entry) && entry !== CANONICAL_KNOWLEDGE_DIR && entry !== 'models') {
      errors.push(`Directory '${entry}' has invalid casing (expected '${CANONICAL_KNOWLEDGE_DIR}')`)
    }
    if (/^bluepri*n*ts$/i.test(entry) && entry !== 'bluepriNNts' && entry !== 'templates') {
      errors.push(`Directory '${entry}' has invalid casing (expected 'bluepriNNts')`)
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}
