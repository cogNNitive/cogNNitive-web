<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ChevronDown,
  FileText,
  Sparkles,
  Check,
  HelpCircle,
} from 'lucide-vue-next'
import type { ValidationReport, ValidationCheck } from '../shared/validation-types'
import { useModelStore } from '../stores/modelStore'
import { useUiStore } from '../stores/uiStore'

const props = defineProps<{
  report: ValidationReport
}>()

const modelStore = useModelStore()
const uiStore = useUiStore()

const logFeedback = ref('')
const aiPromptFeedback = ref('')
let logTimer: ReturnType<typeof setTimeout> | undefined
let aiTimer: ReturnType<typeof setTimeout> | undefined

// ── Model Scope Selection ────────────────────────────────────────

const selectedModelId = ref<string>('all')

const availableModels = computed(() => {
  return modelStore.rootIds
    .filter((id) => !id.startsWith('spec:') && modelStore.getNode(id))
    .map((id) => {
      const node = modelStore.getNode(id)
      const path = node?.source?.path ?? ''
      const fileName = path.split('/').pop()?.split('\\').pop() || path || '(unsaved)'
      return {
        id,
        name: node?.name ?? '(unknown model)',
        fileName,
      }
    })
})

// watch availableModels to set default selection
watch(
  () => availableModels.value,
  (models) => {
    if (models.length === 1) {
      selectedModelId.value = models[0].id
    } else if (models.length > 1) {
      if (uiStore.activeModelId && models.some((m) => m.id === uiStore.activeModelId)) {
        selectedModelId.value = uiStore.activeModelId
      } else {
        selectedModelId.value = 'all'
      }
    } else {
      selectedModelId.value = 'all'
    }
  },
  { immediate: true }
)

// Sync with active UI model changes from sidebar if in multi-model mode
watch(
  () => uiStore.activeModelId,
  (newVal) => {
    if (newVal && availableModels.value.some((m) => m.id === newVal) && availableModels.value.length > 1) {
      selectedModelId.value = newVal
    }
  }
)

function isPathForModel(issuePath: string, modelPath: string): boolean {
  if (!issuePath || !modelPath) return false
  const p1 = issuePath.split('#')[0].replace(/\\/g, '/').toLowerCase()
  const p2 = modelPath.split('#')[0].replace(/\\/g, '/').toLowerCase()
  return p1 === p2 || p1.endsWith('/' + p2) || p2.endsWith('/' + p1)
}

// ── Root Node Metadata Extraction ────────────────────────────────

const selectedRootNode = computed(() => {
  const modelId = selectedModelId.value
  if (modelId && modelId !== 'all') {
    return modelStore.getNode(modelId) ?? null
  }
  const firstRootId = modelStore.rootIds.find((id) => !id.startsWith('spec:')) ?? modelStore.rootIds[0]
  return firstRootId ? modelStore.getNode(firstRootId) : null
})

const fileName = computed(() => {
  const path = selectedRootNode.value?.source?.path ?? ''
  return path.split('/').pop()?.split('\\').pop() || path || '(unsaved)'
})

const filePath = computed(() => selectedRootNode.value?.source?.path ?? '(unknown path)')

const modelName = computed(() => selectedRootNode.value?.name ?? '(unknown model)')

const modelVersion = computed(() => {
  const node = selectedRootNode.value
  return (node?.fields?.version?.value ?? node?.fields?.knowledge_version?.value ?? '—') as string
})

const getNestedName = (val: unknown): string | undefined =>
  val && typeof val === 'object' && 'name' in val && typeof (val as Record<string, unknown>).name === 'string'
    ? (val as Record<string, string>).name
    : undefined

const getNestedVersion = (val: unknown): string | undefined =>
  val && typeof val === 'object' && 'version' in val && typeof (val as Record<string, unknown>).version === 'string'
    ? (val as Record<string, string>).version
    : undefined

const formatVersion = computed(() => {
  const node = selectedRootNode.value
  return (node?.fields?.format_version?.value ??
    node?.fields?.spec_version?.value ??
    '0.1.0') as string
})

const templateName = computed(() => {
  const node = selectedRootNode.value
  return (node?.fields?.blueprint_name?.value ??
    getNestedName(node?.fields?.parent_spec?.value) ??
    '—') as string
})

const templateVersion = computed(() => {
  const node = selectedRootNode.value
  return (node?.fields?.blueprint_version?.value ??
    getNestedVersion(node?.fields?.parent?.value) ??
    '—') as string
})

// ── Checks & Categories ──────────────────────────────────────────

const categories = [
  { key: 'parser', label: 'Model Load & Parser' },
  { key: 'frontmatter', label: 'Frontmatter' },
  { key: 'body', label: 'Body Syntax' },
  { key: 'convention', label: 'Conventions' },
  { key: 'governance', label: 'Governance & Freshness' },
] as const

const collapsed = ref<Record<string, boolean>>({
  parser: false,
  frontmatter: false,
  body: false,
  convention: false,
  governance: false,
})

function toggle(cat: string) {
  collapsed.value[cat] = !collapsed.value[cat]
}

const currentReport = computed<ValidationReport>(() => {
  const modelId = selectedModelId.value
  if (modelId && modelId !== 'all') {
    return modelStore.validationReports[modelId] || props.report
  }
  return props.report
})

const allChecks = computed(() => {
  const list = [...currentReport.value.checks]

  // Add virtual parser checks
  if (selectedModelId.value === 'all') {
    if (modelStore.parseIssues.length === 0) {
      list.push({
        id: 'parser-load-ok',
        label: 'Model Structure & Load',
        description: 'No duplicates or structural parsing errors detected during model file load.',
        category: 'parser',
        severity: 'info',
        passed: true,
      })
    } else {
      modelStore.parseIssues.forEach((issue, idx) => {
        list.push({
          id: `parser-issue-${idx}`,
          label: `Structure warning in ${issue.path.split('/').pop() || issue.path}`,
          description: issue.message,
          category: 'parser',
          severity: (issue.severity === 'error' || issue.severity === 'info' ? issue.severity : 'warning'),
          passed: false,
          message: issue.message,
        })
      })
    }
  } else {
    const modelNode = selectedRootNode.value
    const modelPath = modelNode?.source?.path ?? ''
    const relevantIssues = modelStore.parseIssues.filter((i) => isPathForModel(i.path, modelPath))
    
    if (relevantIssues.length === 0) {
      list.push({
        id: `parser-load-ok-${selectedModelId.value}`,
        label: 'Model Structure & Load',
        description: 'No duplicates or structural parsing errors detected for this model.',
        category: 'parser',
        severity: 'info',
        passed: true,
      })
    } else {
      relevantIssues.forEach((issue, idx) => {
        list.push({
          id: `parser-issue-${selectedModelId.value}-${idx}`,
          label: `Structure warning in ${issue.path.split('/').pop() || issue.path}`,
          description: issue.message,
          category: 'parser',
          severity: (issue.severity === 'error' || issue.severity === 'info' ? issue.severity : 'warning'),
          passed: false,
          message: issue.message,
        })
      })
    }
  }

  return list
})

const checksByCategory = computed(() => {
  const grouped: Record<string, ValidationCheck[]> = {}
  for (const check of allChecks.value) {
    if (!grouped[check.category]) grouped[check.category] = []
    grouped[check.category].push(check)
  }
  return grouped
})

const passedCountByCategory = computed(() => {
  const counts: Record<string, number> = {}
  for (const check of allChecks.value) {
    if (check.passed) {
      counts[check.category] = (counts[check.category] || 0) + 1
    }
  }
  return counts
})

const categoriesWithIssues = computed(() => {
  const withIssues = new Set<string>()
  for (const check of allChecks.value) {
    if (!check.passed) withIssues.add(check.category)
  }
  return withIssues
})

const totalChecks = computed(() => allChecks.value.length)
const totalPassed = computed(() => allChecks.value.filter((c) => c.passed).length)
const totalErrors = computed(
  () => allChecks.value.filter((c) => !c.passed && c.severity === 'error').length,
)
const totalWarnings = computed(
  () => allChecks.value.filter((c) => !c.passed && c.severity === 'warning').length,
)

// Helper methods for rendering grouped model view
function getChecksForModel(modelId: string): ValidationCheck[] {
  const report = modelStore.validationReports[modelId]
  if (!report) return []
  const list = [...report.checks]
  
  const node = modelStore.getNode(modelId)
  if (node) {
    const modelPath = node.source?.path ?? ''
    const relevantIssues = modelStore.parseIssues.filter((i) => isPathForModel(i.path, modelPath))
    if (relevantIssues.length === 0) {
      list.push({
        id: `parser-load-ok-${modelId}`,
        label: 'Model Structure & Load',
        description: 'No duplicates or structural parsing errors detected for this model.',
        category: 'parser',
        severity: 'info',
        passed: true,
      })
    } else {
      relevantIssues.forEach((issue, idx) => {
        list.push({
          id: `parser-issue-${modelId}-${idx}`,
          label: `Structure warning in ${issue.path.split('/').pop() || issue.path}`,
          description: issue.message,
          category: 'parser',
          severity: 'warning',
          passed: false,
          message: issue.message,
        })
      })
    }
  }
  
  return list
}

function getChecksForModelAndCategory(modelId: string, category: string): ValidationCheck[] {
  return getChecksForModel(modelId).filter((c) => c.category === category)
}

function getModelErrors(modelId: string): number {
  return getChecksForModel(modelId).filter((c) => !c.passed && c.severity === 'error').length
}

function getModelWarnings(modelId: string): number {
  return getChecksForModel(modelId).filter((c) => !c.passed && c.severity === 'warning').length
}

// ── Log Formatting ──────────────────────────────────────────────

function formatLog(): string {
  const lines: string[] = []
  const now = new Date()
  
  if (selectedModelId.value !== 'all' || availableModels.value.length <= 1) {
    // Single model report
    lines.push('VALIDATION REPORT')
    lines.push('='.repeat(60))
    lines.push(`Date:     ${now.toISOString().slice(0, 19).replace('T', ' ')}`)
    lines.push(`File:     ${fileName.value}`)
    lines.push(`Path:     ${filePath.value}`)
    lines.push(`Model:    ${modelName.value} (v${modelVersion.value})`)
    lines.push(`Spec:     iNNfo v${formatVersion.value}`)
    lines.push(`App:     ${templateName.value} (v${templateVersion.value})`)
    lines.push('')
    lines.push(
      `Summary: ${totalPassed.value}/${totalChecks.value} passed — ${totalErrors.value} error${totalErrors.value !== 1 ? 's' : ''}, ${totalWarnings.value} warning${totalWarnings.value !== 1 ? 's' : ''}`,
    )
    lines.push('')

    const grouped = checksByCategory.value
    for (const cat of categories) {
      const checks = grouped[cat.key]
      if (!checks || checks.length === 0) continue
      lines.push(`── ${cat.label} ──`)
      for (const check of checks) {
        const status = check.passed ? 'PASS' : check.severity === 'error' ? 'ERROR' : 'WARN'
        const icon = check.passed ? '[✓]' : check.severity === 'error' ? '[✗]' : '[!]'
        lines.push(`  ${icon} [${status}] ${check.label}`)
        if (check.description) lines.push(`       ${check.description}`)
        if (!check.passed && check.message) lines.push(`       > ${check.message}`)
      }
      lines.push('')
    }
  } else {
    // Combined report for all models
    lines.push('VALIDATION REPORT - ALL LOADED MODELS')
    lines.push('============================================================')
    lines.push(`Date:     ${now.toISOString().slice(0, 19).replace('T', ' ')}`)
    lines.push(`Models:   ${availableModels.value.length}`)
    lines.push(`Summary:  ${totalPassed.value}/${totalChecks.value} passed — ${totalErrors.value} error${totalErrors.value !== 1 ? 's' : ''}, ${totalWarnings.value} warning${totalWarnings.value !== 1 ? 's' : ''}`)
    lines.push('')

    for (const m of availableModels.value) {
      const node = modelStore.getNode(m.id)
      const report = modelStore.validationReports[m.id]
      if (!node || !report) continue

      const path = node.source?.path ?? ''
      const mVersion = (node.fields?.version?.value ?? node.fields?.knowledge_version?.value ?? '—') as string
      const fVersion = (node.fields?.format_version?.value ?? node.fields?.spec_version?.value ?? '0.1.0') as string
      const tName = (node.fields?.blueprint_name?.value ?? getNestedName(node.fields?.parent_spec?.value) ?? '—') as string
      const tVersion = (node.fields?.blueprint_version?.value ?? getNestedVersion(node.fields?.parent?.value) ?? '—') as string

      lines.push(`## Model: ${m.name} (v${mVersion})`)
      lines.push(`   File:     ${m.fileName}`)
      lines.push(`   Path:     ${path}`)
      lines.push(`   Spec:     iNNfo v${fVersion}`)
      lines.push(`   App:      ${tName} (v${tVersion})`)
      
      const mErrors = report.checks.filter((c) => !c.passed && c.severity === 'error').length
      const mWarnings = report.checks.filter((c) => !c.passed && c.severity === 'warning').length
      const mPassed = report.checks.filter((c) => c.passed).length
      lines.push(`   Summary:  ${mPassed}/${report.checks.length} passed — ${mErrors} error${mErrors !== 1 ? 's' : ''}, ${mWarnings} warning${mWarnings !== 1 ? 's' : ''}`)
      lines.push('')

      const grouped: Record<string, ValidationCheck[]> = {}
      
      const modelChecks = [...report.checks]
      const modelPath = node.source?.path ?? ''
      const parserIssues = modelStore.parseIssues.filter((i) => isPathForModel(i.path, modelPath))
      if (parserIssues.length > 0) {
        parserIssues.forEach((issue, idx) => {
          modelChecks.push({
            id: `parser-issue-${node.id}-${idx}`,
            label: `Structure warning in ${issue.path.split('/').pop() || issue.path}`,
            description: issue.message,
            category: 'parser',
            severity: 'warning',
            passed: false,
            message: issue.message,
          })
        })
      } else {
        modelChecks.push({
          id: `parser-load-ok-${node.id}`,
          label: 'Model Structure & Load',
          description: 'No duplicates or structural parsing errors detected for this model.',
          category: 'parser',
          severity: 'info',
          passed: true,
        })
      }

      for (const check of modelChecks) {
        if (!grouped[check.category]) grouped[check.category] = []
        grouped[check.category].push(check)
      }

      for (const cat of categories) {
        const checks = grouped[cat.key]
        if (!checks || checks.length === 0) continue
        lines.push(`   [${cat.label}]`)
        for (const check of checks) {
          const status = check.passed ? 'PASS' : check.severity === 'error' ? 'ERROR' : 'WARN'
          const icon = check.passed ? '[✓]' : check.severity === 'error' ? '[✗]' : '[!]'
          lines.push(`     ${icon} [${status}] ${check.label}`)
          if (check.description) lines.push(`          ${check.description}`)
          if (!check.passed && check.message) lines.push(`          > ${check.message}`)
        }
      }
      lines.push('-'.repeat(60))
      lines.push('')
    }
  }

  return lines.join('\n')
}

function copyLog(): void {
  logFeedback.value = 'Log Copied!'
  clearTimeout(logTimer)
  logTimer = setTimeout(() => {
    logFeedback.value = ''
  }, 2500)

  const text = formatLog()
  copyToClipboard(text)
}

// ── AI Prompt Formatting ─────────────────────────────────────────

function formatAiPrompt(): string {
  const lines: string[] = []
  lines.push('# iNNfo Model Validation & Fix Request')
  lines.push('')
  
  if (selectedModelId.value !== 'all' || availableModels.value.length <= 1) {
    lines.push('## Workspace Metadata')
    lines.push(`- **File Name:** \`${fileName.value}\``)
    lines.push(`- **File Path:** \`${filePath.value}\``)
    lines.push(`- **Model Name:** \`${modelName.value}\``)
    lines.push(`- **Model Version:** \`${modelVersion.value}\``)
    lines.push(`- **Format Version (spec_version):** \`${formatVersion.value}\``)
    lines.push(`- **App:** \`${templateName.value}\` (v${templateVersion.value})`)
    lines.push(`- **Report Timestamp:** ${new Date().toISOString()}`)
    lines.push('')
    lines.push('## Validation Summary')
    lines.push(`- **Total Checks Executed:** ${totalChecks.value}`)
    lines.push(`- **Passed Checks:** ${totalPassed.value}`)
    lines.push(`- **Errors:** ${totalErrors.value}`)
    lines.push(`- **Warnings:** ${totalWarnings.value}`)
    lines.push('')

    const failedChecks = allChecks.value.filter((c) => !c.passed)
    if (failedChecks.length > 0) {
      lines.push('## Detected Defects & Warnings')
      lines.push('')
      failedChecks.forEach((check, i) => {
        const type = check.severity === 'error' ? 'ERROR ❌' : 'WARNING ⚠️'
        lines.push(`### ${i + 1}. [${type}] ${check.label} (Category: \`${check.category}\`)`)
        if (check.description) lines.push(`- **Description:** ${check.description}`)
        if (check.message) lines.push(`- **Details / Message:** \`${check.message}\``)
        if (check.promptHint) lines.push(`- **Remediation Hint:** ${check.promptHint}`)
        lines.push('')
      })
    } else {
      lines.push('## Status')
      lines.push('No errors or warnings detected. Model is compliant with iNNfo specifications.')
      lines.push('')
    }
  } else {
    lines.push('## Workspace Metadata (Multiple Models)')
    lines.push(`- **Total Models Loaded:** ${availableModels.value.length}`)
    lines.push(`- **Report Timestamp:** ${new Date().toISOString()}`)
    lines.push('')
    lines.push('## Validation Summary')
    lines.push(`- **Total Checks Executed:** ${totalChecks.value}`)
    lines.push(`- **Passed Checks:** ${totalPassed.value}`)
    lines.push(`- **Errors:** ${totalErrors.value}`)
    lines.push(`- **Warnings:** ${totalWarnings.value}`)
    lines.push('')

    let count = 1
    for (const m of availableModels.value) {
      const node = modelStore.getNode(m.id)
      const report = modelStore.validationReports[m.id]
      if (!node || !report) continue

      const path = node.source?.path ?? ''
      const mVersion = (node.fields?.version?.value ?? node.fields?.knowledge_version?.value ?? '—') as string

      const modelChecks = [...report.checks]
      const modelPath = node.source?.path ?? ''
      const parserIssues = modelStore.parseIssues.filter((i) => isPathForModel(i.path, modelPath))
      if (parserIssues.length > 0) {
        parserIssues.forEach((issue, idx) => {
          modelChecks.push({
            id: `parser-issue-${node.id}-${idx}`,
            label: `Structure warning in ${issue.path.split('/').pop() || issue.path}`,
            description: issue.message,
            category: 'parser',
            severity: 'warning',
            passed: false,
            message: issue.message,
          })
        })
      }

      const failedChecks = modelChecks.filter((c) => !c.passed)
      if (failedChecks.length > 0) {
        lines.push(`### Model: ${m.name} (File: \`${m.fileName}\`, Path: \`${path}\`, Version: \`${mVersion}\`)`)
        lines.push('')
        failedChecks.forEach((check) => {
          const type = check.severity === 'error' ? 'ERROR ❌' : 'WARNING ⚠️'
          lines.push(`#### ${count++}. [${type}] ${check.label} (Category: \`${check.category}\`)`)
          if (check.description) lines.push(`- **Description:** ${check.description}`)
          if (check.message) lines.push(`- **Details / Message:** \`${check.message}\``)
          if (check.promptHint) lines.push(`- **Remediation Hint:** ${check.promptHint}`)
          lines.push('')
        })
      }
    }
    
    if (count === 1) {
      lines.push('## Status')
      lines.push('No errors or warnings detected in any of the loaded models. All are compliant with iNNfo specifications.')
      lines.push('')
    }
  }

  lines.push('## AI Task & Instructions')
  lines.push(
    'Please analyze the workspace metadata and the detected defects above. Provide exact file updates or step-by-step code/frontmatter fixes to resolve all errors and warnings in this iNNfo Markdown model file, adhering strictly to the iNNfo format specification.',
  )

  return lines.join('\n')
}

function copyAiPrompt(): void {
  aiPromptFeedback.value = 'AI Prompt Copied!'
  clearTimeout(aiTimer)
  aiTimer = setTimeout(() => {
    aiPromptFeedback.value = ''
  }, 2500)

  const text = formatAiPrompt()
  copyToClipboard(text)
}

const copiedPromptCheckId = ref<string | null>(null)
let promptCheckTimer: ReturnType<typeof setTimeout> | undefined

function copyPromptHint(checkId: string, promptHint: string): void {
  copiedPromptCheckId.value = checkId
  clearTimeout(promptCheckTimer)
  promptCheckTimer = setTimeout(() => {
    copiedPromptCheckId.value = null
  }, 2000)
  copyToClipboard(promptHint)
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  })
}
</script>

<template>
  <div class="space-y-6 pt-2">
    <!-- ── Model Scope Selector (shown only if multiple models exist) ── -->
    <div
      v-if="availableModels.length > 1"
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30"
    >
      <div class="space-y-0.5">
        <h4 class="text-xs font-semibold text-slate-800 dark:text-slate-200">Validation Scope</h4>
        <p class="text-2xs text-slate-500 dark:text-slate-400">Select which model's validation checks to view.</p>
      </div>
      <div class="relative min-w-48 sm:min-w-64">
        <select
          v-model="selectedModelId"
          class="w-full appearance-none pr-9 pl-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition-colors focus:outline-hidden cursor-pointer shadow-3xs"
        >
          <option value="all">All Loaded Models (Combined)</option>
          <option v-for="m in availableModels" :key="m.id" :value="m.id">
            {{ m.name }} ({{ m.fileName }})
          </option>
        </select>
        <ChevronDown class="w-4 h-4 text-slate-400 dark:text-slate-505 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>

    <!-- ── Summary Bar & Actions ── -->
    <div
      class="rounded-xl border p-4 transition-all shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      :class="{
        'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200':
          totalErrors === 0 && totalWarnings === 0,
        'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200':
          totalErrors === 0 && totalWarnings > 0,
        'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-800/60 text-red-900 dark:text-red-200':
          totalErrors > 0,
      }"
    >
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-white/70 dark:bg-slate-900/50 backdrop-blur-xs">
          <CheckCircle2 v-if="totalErrors === 0 && totalWarnings === 0" class="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          <AlertTriangle v-else-if="totalErrors === 0 && totalWarnings > 0" class="w-6 h-6 text-amber-600 dark:text-amber-400" />
          <XCircle v-else class="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h4 class="font-semibold text-sm leading-snug">
            Validation Summary:
            <span class="font-mono">{{ totalPassed }}/{{ totalChecks }}</span> passed
          </h4>
          <p class="text-xs opacity-90 mt-0.5">
            <template v-if="totalErrors === 0 && totalWarnings === 0">
              Model fully satisfies format specifications.
            </template>
            <template v-else>
              Found
              <span v-if="totalErrors" class="font-bold underline">{{ totalErrors }} error{{ totalErrors !== 1 ? 's' : '' }}</span>
              <template v-if="totalErrors && totalWarnings"> and </template>
              <span v-if="totalWarnings" class="font-bold underline">{{ totalWarnings }} warning{{ totalWarnings !== 1 ? 's' : '' }}</span>.
            </template>
          </p>
        </div>
      </div>

      <!-- Action Buttons (Copy Log & Copy Prompt for AI) -->
      <div class="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
        <!-- Copy Log Button -->
        <button
          @click="copyLog"
          class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs active:scale-95 flex-1 sm:flex-none"
          title="Copy raw validation report log to clipboard"
          data-testid="copy-log-button"
        >
          <template v-if="logFeedback">
            <Check class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span class="text-emerald-600 dark:text-emerald-400 font-bold">{{ logFeedback }}</span>
          </template>
          <template v-else>
            <FileText class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Copy Log</span>
          </template>
        </button>

        <!-- Copy Prompt for AI Button -->
        <button
          @click="copyAiPrompt"
          class="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-purple-300 dark:border-purple-700/60 bg-purple-600 dark:bg-purple-600 text-white hover:bg-purple-700 dark:hover:bg-purple-500 transition-all cursor-pointer shadow-xs active:scale-95 flex-1 sm:flex-none"
          title="Copy markdown prompt with workspace metadata & defects formatted for AI"
          data-testid="copy-ai-prompt-button"
        >
          <template v-if="aiPromptFeedback">
            <Check class="w-3.5 h-3.5 text-emerald-200" />
            <span class="font-bold text-emerald-100">{{ aiPromptFeedback }}</span>
          </template>
          <template v-else>
            <Sparkles class="w-3.5 h-3.5 text-purple-200" />
            <span>Copy Prompt for AI</span>
          </template>
        </button>
      </div>
    </div>

    <!-- ── Grouped Models View (When "All Models" is selected in a multi-model environment) ── -->
    <div v-if="selectedModelId === 'all' && availableModels.length > 1" class="space-y-4">
      <div
        v-for="m in availableModels"
        :key="m.id"
        class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs"
      >
        <!-- Model Group Header -->
        <div
          class="flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800"
        >
          <div class="flex items-center gap-2">
            <FileText class="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span class="font-bold text-sm text-slate-800 dark:text-slate-100">{{ m.name }}</span>
            <span class="text-xs text-slate-400 dark:text-slate-505 font-mono">({{ m.fileName }})</span>
          </div>
          
          <div class="flex items-center gap-2">
            <span
              v-if="getModelErrors(m.id) > 0"
              class="px-2 py-0.5 text-3xs font-extrabold rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40"
            >
              {{ getModelErrors(m.id) }} error{{ getModelErrors(m.id) !== 1 ? 's' : '' }}
            </span>
            <span
              v-if="getModelWarnings(m.id) > 0"
              class="px-2 py-0.5 text-3xs font-extrabold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40"
            >
              {{ getModelWarnings(m.id) }} warning{{ getModelWarnings(m.id) !== 1 ? 's' : '' }}
            </span>
            <span
              v-if="getModelErrors(m.id) === 0 && getModelWarnings(m.id) === 0"
              class="px-2 py-0.5 text-3xs font-extrabold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
            >
              Passed
            </span>
            
            <button
              @click="selectedModelId = m.id"
              class="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
            >
              View details
            </button>
          </div>
        </div>

        <!-- Model Group Content (Category Breakdown for this model) -->
        <div class="p-4 space-y-3 bg-white dark:bg-slate-900">
          <div v-for="cat in categories" :key="cat.key" class="space-y-2">
            <div 
              v-if="getChecksForModelAndCategory(m.id, cat.key).length > 0"
              class="space-y-2"
            >
              <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
                <span>{{ cat.label }}</span>
                <span class="h-px bg-slate-200 dark:bg-slate-800 flex-1"></span>
              </div>
              <div
                v-for="check in getChecksForModelAndCategory(m.id, cat.key)"
                :key="check.id"
                class="flex items-start gap-3 p-3 rounded-lg border text-xs transition-colors"
                :class="{
                  'bg-emerald-50/30 dark:bg-emerald-950/5 border-emerald-200/50 dark:border-emerald-900/20 text-slate-650 dark:text-slate-400':
                    check.passed,
                  'bg-amber-50/50 dark:bg-amber-950/10 border-amber-250/60 dark:border-amber-800/40 text-amber-950 dark:text-amber-200':
                    !check.passed && check.severity === 'warning',
                  'bg-red-50/50 dark:bg-red-950/10 border-red-250/60 dark:border-red-800/40 text-red-950 dark:text-red-200':
                    !check.passed && check.severity === 'error',
                }"
              >
                <div class="shrink-0 mt-0.5">
                  <CheckCircle2 v-if="check.passed" class="w-3.5 h-3.5 text-emerald-500" />
                  <AlertTriangle v-else-if="check.severity === 'warning'" class="w-3.5 h-3.5 text-amber-500" />
                  <XCircle v-else class="w-3.5 h-3.5 text-red-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-slate-850 dark:text-slate-200">{{ check.label }}</div>
                  <p v-if="check.description" class="text-slate-500 dark:text-slate-400 mt-0.5 text-2xs leading-relaxed">
                    {{ check.description }}
                  </p>
                  <div
                    v-if="!check.passed && check.message"
                    class="mt-1.5 p-2 rounded-md font-mono text-2xs bg-slate-900 dark:bg-slate-950 text-red-300 border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all"
                  >
                    {{ check.message }}
                  </div>
                  <div
                    v-if="!check.passed && check.promptHint"
                    class="mt-2 flex items-center gap-2"
                  >
                    <button
                      type="button"
                      data-testid="copy-prompt-hint-button"
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs font-semibold rounded-md border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                      @click="copyPromptHint(check.id, check.promptHint)"
                    >
                      <Sparkles class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>{{ copiedPromptCheckId === check.id ? 'Copied!' : 'Copy prompt for AI Agent' }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Single Model Category Breakdown (Shown when a specific model is selected or single-model mode) ── -->
    <div v-else class="space-y-3">
      <div
        v-for="cat in categories"
        :key="cat.key"
        class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs"
      >
        <!-- Category Header -->
        <button
          class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer select-none"
          :class="{
            'border-b border-slate-200 dark:border-slate-800': !collapsed[cat.key],
          }"
          @click="toggle(cat.key)"
        >
          <div class="flex items-center gap-2.5">
            <ChevronRight
              class="w-4 h-4 text-slate-400 dark:text-slate-505 transition-transform duration-200"
              :class="{ 'rotate-90': !collapsed[cat.key] }"
            />
            <span class="font-semibold text-sm text-slate-800 dark:text-slate-100">{{ cat.label }}</span>
            <span
              v-if="categoriesWithIssues.has(cat.key)"
              class="px-2 py-0.5 text-2xs font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
            >
              Issues found
            </span>
          </div>
          <span class="font-mono text-xs font-medium text-slate-500 dark:text-slate-400">
            {{ passedCountByCategory[cat.key] ?? 0 }}/{{ checksByCategory[cat.key]?.length ?? 0 }} passed
          </span>
        </button>

        <!-- Category Body -->
        <div v-if="!collapsed[cat.key]" class="p-3 space-y-2.5 bg-white dark:bg-slate-900">
          <div
            v-for="check in checksByCategory[cat.key] || []"
            :key="check.id"
            class="flex items-start gap-3 p-3 rounded-lg border text-xs transition-colors"
            :class="{
              'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/60 dark:border-emerald-900/30 text-slate-700 dark:text-slate-300':
                check.passed,
              'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300/70 dark:border-amber-800/50 text-amber-950 dark:text-amber-200':
                !check.passed && check.severity === 'warning',
              'bg-red-50/70 dark:bg-red-950/20 border-red-300/70 dark:border-red-800/50 text-red-950 dark:text-red-200':
                !check.passed && check.severity === 'error',
            }"
          >
            <div class="shrink-0 mt-0.5">
              <CheckCircle2 v-if="check.passed" class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTriangle v-else-if="check.severity === 'warning'" class="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <XCircle v-else class="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{{ check.label }}</span>
              </div>
              <p v-if="check.description" class="text-slate-600 dark:text-slate-400 mt-0.5 text-xs leading-relaxed">
                {{ check.description }}
              </p>
              <div
                v-if="!check.passed && check.message"
                class="mt-2 p-2.5 rounded-md font-mono text-xs bg-slate-900 dark:bg-slate-950 text-red-300 border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all"
              >
                {{ check.message }}
              </div>
              <div
                v-if="!check.passed && check.promptHint"
                class="mt-2.5 flex items-center gap-2"
              >
                <button
                  type="button"
                  data-testid="copy-prompt-hint-button"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                  @click="copyPromptHint(check.id, check.promptHint)"
                >
                  <Sparkles class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{{ copiedPromptCheckId === check.id ? 'Copied!' : 'Copy prompt for AI Agent' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Educational & Guide Panel ── -->
    <div
      class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5 space-y-3"
    >
      <div class="flex items-center gap-2 text-slate-800 dark:text-slate-200">
        <HelpCircle class="w-4 h-4 text-primary" />
        <h4 class="font-semibold text-sm">How to understand iNNfo Models & Validation</h4>
      </div>
      <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        iNNfo models are defined using Markdown files with a YAML frontmatter. This validation
        report checks if your model conforms to the iNNfo format specifications:
      </p>
      <ul class="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc pl-5">
        <li>
          <strong class="text-slate-800 dark:text-slate-200">Model Load & Parser:</strong> Ensures files are read correctly and elements have unique names. Duplicated elements in different files are flagged as warnings to prevent collision.
        </li>
        <li>
          <strong class="text-slate-800 dark:text-slate-200">Frontmatter:</strong> Checks basic metadata like <code>level</code>, <code>version</code>, and <code>parent_spec</code> links.
        </li>
        <li>
          <strong class="text-slate-800 dark:text-slate-200">Body Syntax:</strong> Validates elements and relationships against the declared app.
        </li>
        <li>
          <strong class="text-slate-800 dark:text-slate-200">Conventions:</strong> Checks naming conventions and clean file structure.
        </li>
      </ul>
      <div
        class="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed"
      >
        <strong>Tip:</strong> If a warning is displayed, your model will still load, but you should resolve it to avoid unexpected behaviors or naming collisions. If an error is shown, you must fix it, as it indicates a critical format violation. You can use <strong>Copy Prompt for AI</strong> to generate a complete contextual prompt to paste directly into an AI assistant.
      </div>
    </div>
  </div>
</template>
