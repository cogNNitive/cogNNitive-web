<template>
  <div class="space-y-4">
    <div
      class="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700"
    >
      <h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        Dynamic Relational Matrices Definitions
      </h3>
      <button
        @click="addMatrixRow"
        class="bg-primary hover:bg-primary/90 text-white text-xs px-2.5 py-1.5 rounded font-semibold cursor-pointer"
      >
        + Add New Matrix Config
      </button>
    </div>

    <!-- Table definition matrix -->
    <div
      class="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-2xs"
    >
      <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead class="bg-slate-50 dark:bg-slate-900/60">
          <tr>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Matrix Name
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Source
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Target
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Label (relaci&oacute;n)
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Widget
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Values (; separated)
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Parameters
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Widget config (JSON)
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Description
            </th>
            <th
              class="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
          <tr v-for="(row, index) in matrixDefs" :key="index">
            <td class="px-4 py-2.5">
              <input
                v-model="row.name"
                @input="saveDefs"
                class="border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-800 dark:text-slate-300"
              />
            </td>
            <td class="px-4 py-2.5">
              <select
                v-model="row.source"
                @change="saveDefs"
                class="border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-800 dark:text-slate-300"
              >
                <option v-for="c in instantiableTypes" :key="c" :value="c">{{ c }}</option>
              </select>
            </td>
            <td class="px-4 py-2.5">
              <select
                v-model="row.target"
                @change="saveDefs"
                class="border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-800 dark:text-slate-300"
              >
                <option v-for="c in allTypes" :key="c" :value="c">{{ c }}</option>
              </select>
            </td>
            <td class="px-4 py-2.5">
              <input
                v-model="row.label"
                @input="saveDefs"
                placeholder="e.g. impacts, belongs to"
                class="border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-800 dark:text-slate-300"
              />
            </td>
            <td class="px-4 py-2.5">
              <select
                v-model="row.widgetType"
                @change="saveDefs"
                class="border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="boolean">Boolean Checkbox</option>
                <option value="cycle">Options Cycle Button</option>
                <option value="scale">Rating Scale Input</option>
                <option value="set">Custom Selection Set</option>
                <option value="text">Free Text</option>
              </select>
            </td>
            <td class="px-4 py-2.5">
              <input
                :value="(row.values ?? []).join('; ')"
                @input="onValuesInput(row, ($event.target as HTMLInputElement).value)"
                placeholder="e.g. Max; High; Low"
                class="border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-800 dark:text-slate-300"
              />
            </td>
            <td class="px-4 py-2.5">
              <input
                v-model="row.params"
                @input="saveDefs"
                placeholder="e.g. colWidth:140"
                class="border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-800 dark:text-slate-300"
              />
            </td>
            <td class="px-4 py-2.5">
              <input
                :value="widgetConfigText(row)"
                @change="onWidgetConfigInput(row, ($event.target as HTMLInputElement).value)"
                :placeholder="widgetConfigPlaceholder(row.widgetType)"
                class="border rounded px-2 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-800 dark:text-slate-300"
                :class="
                  widgetConfigError(row)
                    ? 'border-rose-400 dark:border-rose-600'
                    : 'border-slate-200 dark:border-slate-600'
                "
              />
            </td>
            <td class="px-4 py-2.5">
              <input
                v-model="row.description"
                @input="saveDefs"
                placeholder="Brief explanation of what the matrix represents"
                class="border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs w-full outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-800 dark:text-slate-300"
              />
            </td>
            <td class="px-4 py-2.5 text-right">
              <button
                @click="removeMatrixRow(index)"
                class="text-xs bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 font-semibold px-2 py-1 rounded border border-rose-200 dark:border-rose-800 cursor-pointer flex items-center gap-1.5 ml-auto"
              >
                <Trash2 class="w-3 h-3 text-rose-700 dark:text-rose-300" />
                Remove
              </button>
            </td>
          </tr>
          <tr v-if="!matrixDefs.length">
            <td
              colspan="10"
              class="text-center text-slate-400 dark:text-slate-500 text-xs italic py-6"
            >
              No relational matrices configured. Click "+ Add New Matrix Config" to define one.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { commitFieldValue } from '../../shared/editAttribution'
import {
  MATRIX_DEFS_KEY,
  extractMatrixDefs,
  type MatrixDef,
} from '../../composables/useMatrixDefinitions'

const knowledgeStore = useKnowledgeStore()

const rootNode = computed(() => {
  const nonSpecId = knowledgeStore.rootIds.find((id) => !id.startsWith('spec:'))
  if (!nonSpecId) return null
  return knowledgeStore.getNode(nonSpecId)
})

const matrixDefs = computed<MatrixDef[]>({
  get() {
    return extractMatrixDefs(rootNode.value) as MatrixDef[]
  },
  set(_val) {
    // Write-through via saveDefs()
  },
})

// Derive concept types from actual nodes
const allTypes = computed(() => {
  const types = new Set<string>()
  for (const node of Object.values(knowledgeStore.nodes)) {
    if (node.type) types.add(node.type)
  }
  return [...types].sort()
})

const instantiableTypes = computed(() => allTypes.value)

function saveDefs() {
  const root = rootNode.value
  if (!root) return
  // Read current defs from the reactive computed
  const raw = matrixDefs.value
  if (raw) {
    commitFieldValue(knowledgeStore, root.id, MATRIX_DEFS_KEY, raw, { kind: 'user', id: 'anonymous' })
  }
}

function onValuesInput(row: MatrixDef, rawValue: string): void {
  row.values = rawValue
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  saveDefs()
}

// ── widget_config (bounded inline JSON object, keys fixed per widget) ──
const widgetConfigErrors = new WeakMap<MatrixDef, boolean>()

function widgetConfigText(row: MatrixDef): string {
  const cfg = row.widgetConfig
  return cfg && Object.keys(cfg).length > 0 ? JSON.stringify(cfg) : ''
}

function widgetConfigError(row: MatrixDef): boolean {
  return widgetConfigErrors.get(row) ?? false
}

function widgetConfigPlaceholder(widget?: string): string {
  switch (widget) {
    case 'scale':
      return '{"min":1,"max":10,"step":1}'
    case 'cycle':
      return '{"order":["a","b","c"]}'
    case 'set':
      return '{"max_selections":2}'
    case 'text':
      return '{"max_length":120}'
    default:
      return '(no config)'
  }
}

function onWidgetConfigInput(row: MatrixDef, raw: string): void {
  const trimmed = raw.trim()
  if (!trimmed) {
    delete row.widgetConfig
    widgetConfigErrors.delete(row)
    saveDefs()
    return
  }
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      row.widgetConfig = parsed as Record<string, unknown>
      widgetConfigErrors.delete(row)
      saveDefs()
      return
    }
    widgetConfigErrors.set(row, true)
  } catch {
    widgetConfigErrors.set(row, true)
  }
}

function addMatrixRow() {
  const root = rootNode.value
  if (!root) return
  const current = matrixDefs.value ? [...matrixDefs.value] : []
  const newDef: MatrixDef = {
    name: `New Matrix ${current.length + 1}`,
    source: instantiableTypes.value[0] || '',
    target: allTypes.value[0] || '',
    widgetType: 'boolean',
    params: '',
    label: '',
  }
  current.push(newDef)
  commitFieldValue(knowledgeStore, root.id, MATRIX_DEFS_KEY, current, { kind: 'user', id: 'anonymous' })
}

function removeMatrixRow(index: number) {
  const root = rootNode.value
  if (!root) return
  const current = matrixDefs.value ? [...matrixDefs.value] : []
  current.splice(index, 1)
  commitFieldValue(knowledgeStore, root.id, MATRIX_DEFS_KEY, current, { kind: 'user', id: 'anonymous' })
}
</script>
