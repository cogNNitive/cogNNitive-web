// legacy:nn-rename/editor-legacy-domain

import { computed } from 'vue'
import { detectLegacy, type DetectLegacyResult, type DomainReader, type LegacySignal } from '@cognnitive/innfo-core/legacy'
import { useKnowledgeStore } from '../stores/knowledgeStore'

export function useLegacyDomain() {
  const knowledgeStore = useKnowledgeStore()

  const legacyIssue = computed(() => {
    return knowledgeStore.parseIssues.find((issue) => issue.code === 'LEGACY_DOMAIN')
  })

  const isLegacyDomain = computed(() => {
    return !!legacyIssue.value
  })

  const legacySignals = computed<LegacySignal[]>(() => {
    return (legacyIssue.value as any)?.signals ?? []
  })

  const legacyHint = computed(() => {
    return (
      legacyIssue.value?.message ||
      'This workspace uses a legacy layout. Run `nn-upgrade` to migrate to the canonical domaiNN format.'
    )
  })

  return {
    isLegacyDomain,
    legacySignals,
    legacyHint,
    legacyIssue,
  }
}
