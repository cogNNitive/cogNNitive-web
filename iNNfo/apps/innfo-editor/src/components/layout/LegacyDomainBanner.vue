<script setup lang="ts">
// legacy:nn-rename/editor-legacy-domain
import { ref } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'
import { useLegacyDomain } from '../../composables/useLegacyDomain'

const { isLegacyDomain, legacySignals, legacyHint } = useLegacyDomain()
const dismissed = ref(false)
</script>

<template>
  <div
    v-if="isLegacyDomain && !dismissed"
    class="legacy-domain-banner bg-amber-500/15 border-b border-amber-500/30 text-amber-950 dark:text-amber-200 px-4 py-3 flex items-center justify-between gap-4 text-sm z-10"
    data-testid="legacy-domain-banner"
  >
    <div class="flex items-center gap-3 min-w-0">
      <AlertTriangle class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div class="min-w-0">
        <p class="font-medium text-amber-900 dark:text-amber-100">
          Legacy workspace layout detected
        </p>
        <p class="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
          {{ legacyHint }}
        </p>
      </div>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <code class="px-2 py-1 rounded bg-amber-200/50 dark:bg-amber-900/40 text-xs font-mono font-semibold text-amber-950 dark:text-amber-200 select-all">
        nn-upgrade
      </code>
      <button
        type="button"
        class="p-1 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer transition-colors"
        aria-label="Dismiss legacy notice"
        @click="dismissed = true"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
