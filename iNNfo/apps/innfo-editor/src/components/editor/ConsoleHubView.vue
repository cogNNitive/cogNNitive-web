<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUiStore } from '../../stores/uiStore'
import { resolveFileHandleForRead } from '../../services/WorkspacePersistenceService'
import {
  Layers,
  ExternalLink,
  RefreshCw,
  FileText,
  AlertCircle,
  Terminal,
} from 'lucide-vue-next'

const knowledgeStore = useKnowledgeStore()
const workspaceStore = useWorkspaceStore()
const uiStore = useUiStore()

const iframeKey = ref(0)
const isFrameLoading = ref(false)
const htmlContent = ref<string | null>(null)
const loadState = ref<'loading' | 'ready' | 'not_found'>('loading')
const resolvedUrl = ref<string | null>(null)

interface DynamicConsoleTarget {
  id: string
  name: string
  template?: string
  consolePath: string
}
const dynamicConsoles = ref<DynamicConsoleTarget[]>([])

function normalizeSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Discovered models from knowledgeStore (domain models only; exclude specs and workspace manifest)
const discoveredModels = computed(() => {
  return knowledgeStore.rootIds
    .filter((rootId) => !rootId.startsWith('spec:') && !rootId.startsWith('template:'))
    .filter((rootId) => {
      const node = knowledgeStore.getNode(rootId)
      if (!node) return false

      const templateName =
        (typeof node.fields?.['template']?.value === 'string' ? node.fields['template'].value : null) ||
        (node.fields?.['parent_spec']?.value as any)?.name ||
        node.type ||
        ''
      const normalizedTemplate = String(templateName).toLowerCase().replace(/_v_.*$/, '').replace(/_spec.*$/, '')
      if (normalizedTemplate === 'workspace' || node.type === 'workspace') {
        return false
      }

      const sourcePath = (node.source?.path || '').toLowerCase()
      if (sourcePath.endsWith('domaiNN_NN.md') || sourcePath.endsWith('index.md')) {
        return false
      }

      return true
    })
    .map((rootId) => {
      const node = knowledgeStore.getNode(rootId)
      const rawTitle =
        (typeof node?.fields?.['title']?.value === 'string' ? node.fields['title'].value : null) ||
        (typeof node?.fields?.['name']?.value === 'string' ? node.fields['name'].value : null)
      const fileBasename = node?.source?.path
        ? node.source.path.split('/').pop()?.replace(/_NN\.md$/i, '')
        : null
      const name = rawTitle || fileBasename || node?.name || rootId

      const templateName =
        (typeof node?.fields?.['template']?.value === 'string' ? node.fields['template'].value : null) ||
        (node?.fields?.['parent_spec']?.value as any)?.name ||
        node?.type ||
        'business'
      const version =
        (typeof node?.fields?.['knowledge_version']?.value === 'string' ? node.fields['knowledge_version'].value : null) ||
        (node as any)?.version ||
        '1.0.0'
      const desc =
        node?.rawSections?.description ||
        (typeof node?.fields?.['description']?.value === 'string' ? node.fields['description'].value : '') ||
        ''

      const explicitConsole = typeof node?.fields?.['console']?.value === 'string' ? node.fields['console'].value : undefined
      const normalizedTemplate = String(templateName).toLowerCase().replace(/_v_.*$/, '').replace(/_spec.*$/, '')
      const defaultConsolePath = explicitConsole || `artifacts/${normalizedTemplate}_console.html`

      return {
        id: rootId,
        name,
        template: normalizedTemplate,
        version,
        description: desc,
        consolePath: defaultConsolePath,
        explicitConsole,
        sourcePath: node?.source?.path || `models/${name}_NN.md`,
      }
    })
})

const allModelTargets = computed(() => {
  const list = [...discoveredModels.value]
  for (const dyn of dynamicConsoles.value) {
    if (!list.some((m) => m.id === dyn.id)) {
      list.push({
        id: dyn.id,
        name: dyn.name,
        template: dyn.template || 'model',
        version: '1.0.0',
        description: '',
        consolePath: dyn.consolePath,
        explicitConsole: dyn.consolePath,
        sourcePath: '',
      })
    }
  }
  return list
})

const selectedConsoleTarget = ref<string>('hub')

function getCandidatePaths(target: string): string[] {
  if (target === 'hub') {
    const candidates = [
      'artifacts/workspace_hub.html',
      'export/workspace_hub/workspace_hub.html',
      'export/workspace_hub/master.html',
      'export/workspace_hub.html',
      'artifacts/workspace_console.html',
      'export/workspace_console/workspace_console.html',
      'export/workspace_console.html',
      'innfo/artifacts/workspace_hub.html',
      'innfo/export/workspace_hub/workspace_hub.html',
      'innfo/export/workspace_hub.html',
    ]

    // Check registered artifacts in knowledgeStore
    for (const node of Object.values(knowledgeStore.nodes)) {
      const isArtifact = node.type === 'Artifacts' || node.conceptBinding?.name === 'Artifacts'
      const ref = typeof node.fields?.['artifact_ref']?.value === 'string' ? node.fields['artifact_ref'].value : ''
      if (isArtifact && ref.endsWith('.html') && (ref.includes('workspace') || ref.includes('hub'))) {
        candidates.unshift(ref)
      }
    }

    return Array.from(new Set(candidates))
  }

  // Check dynamic targets first
  const dyn = dynamicConsoles.value.find((d) => d.id === target)
  if (dyn) {
    const candidates = [dyn.consolePath]
    if (!dyn.consolePath.startsWith('innfo/')) candidates.push(`innfo/${dyn.consolePath}`)
    if (dyn.consolePath.startsWith('innfo/')) candidates.push(dyn.consolePath.replace(/^innfo\//, ''))
    return Array.from(new Set(candidates))
  }

  const model = allModelTargets.value.find((m) => m.id === target)
  if (!model) {
    // If target itself looks like a direct file path
    if (target.endsWith('.html') || target.includes('/')) {
      const directCandidates = [target]
      if (!target.startsWith('innfo/')) directCandidates.push(`innfo/${target}`)
      if (target.startsWith('innfo/')) directCandidates.push(target.replace(/^innfo\//, ''))
      return Array.from(new Set(directCandidates))
    }
    return ['artifacts/workspace_hub.html']
  }

  const candidates: string[] = []

  // 1. Explicit console if specified on node
  if (model.explicitConsole) {
    candidates.push(model.explicitConsole)
    if (!model.explicitConsole.startsWith('innfo/')) {
      candidates.push(`innfo/${model.explicitConsole}`)
    }
  }

  const modelName = model.name
  const modelSlug = normalizeSlug(modelName)
  const sourceBasename = model.sourcePath
    ? model.sourcePath.split('/').pop()?.replace(/_NN\.md$/i, '') || ''
    : ''
  const sourceSlug = normalizeSlug(sourceBasename)

  // 2. Scan registered artifact references in graph
  for (const node of Object.values(knowledgeStore.nodes)) {
    const isArtifact = node.type === 'Artifacts' || node.conceptBinding?.name === 'Artifacts'
    const ref = typeof node.fields?.['artifact_ref']?.value === 'string' ? node.fields['artifact_ref'].value : ''
    if (isArtifact && ref.endsWith('.html')) {
      const lowerRef = ref.toLowerCase()
      if (
        (modelSlug && lowerRef.includes(modelSlug)) ||
        (sourceSlug && lowerRef.includes(sourceSlug)) ||
        (sourceBasename && lowerRef.includes(sourceBasename.toLowerCase()))
      ) {
        candidates.push(ref)
      }
    }
  }

  // 3. Known exported console structures
  if (sourceBasename) {
    candidates.push(`export/${sourceBasename}_console/${sourceBasename}_console.html`)
    candidates.push(`export/${sourceBasename}_console/master.html`)
    candidates.push(`export/${sourceBasename}/${sourceBasename}.html`)
    candidates.push(`export/${sourceBasename}/master.html`)
    candidates.push(`artifacts/exports/${sourceBasename}.html`)
    candidates.push(`artifacts/exports/${sourceBasename}_Strategic_Master_V_0-1-0.html`)
    candidates.push(`innfo/export/${sourceBasename}_console/${sourceBasename}_console.html`)
    candidates.push(`innfo/export/${sourceBasename}_console/master.html`)
    candidates.push(`innfo/export/${sourceBasename}/${sourceBasename}.html`)
    candidates.push(`innfo/artifacts/exports/${sourceBasename}.html`)
  }

  if (sourceSlug && sourceSlug !== sourceBasename) {
    candidates.push(`export/${sourceSlug}_console/${sourceSlug}_console.html`)
    candidates.push(`export/${sourceSlug}_console/master.html`)
    candidates.push(`export/${sourceSlug}/${sourceSlug}.html`)
    candidates.push(`export/${sourceSlug}/master.html`)
    candidates.push(`artifacts/exports/${sourceSlug}.html`)
    candidates.push(`innfo/export/${sourceSlug}_console/${sourceSlug}_console.html`)
    candidates.push(`innfo/export/${sourceSlug}/${sourceSlug}.html`)
  }

  if (modelSlug) {
    candidates.push(`export/${modelSlug}_console/${modelSlug}_console.html`)
    candidates.push(`export/${modelSlug}_console/master.html`)
    candidates.push(`export/${modelSlug}/${modelSlug}.html`)
    candidates.push(`artifacts/exports/${modelSlug}.html`)
    candidates.push(`artifacts/${modelSlug}_console.html`)
    candidates.push(`innfo/export/${modelSlug}_console/${modelSlug}_console.html`)
    candidates.push(`innfo/export/${modelSlug}/${modelSlug}.html`)
    candidates.push(`innfo/artifacts/${modelSlug}_console.html`)
  }

  // 4. Canonical template locations
  candidates.push(`artifacts/${model.template}_console.html`)
  candidates.push(`artifacts/${modelName}_console.html`)
  candidates.push(`innfo/artifacts/${model.template}_console.html`)
  candidates.push(`innfo/artifacts/${modelName}_console.html`)

  return Array.from(new Set(candidates))
}

const currentFrameUrl = computed<string>(() => {
  if (resolvedUrl.value) return resolvedUrl.value
  const candidates = getCandidatePaths(selectedConsoleTarget.value)
  return candidates[0] || 'artifacts/workspace_hub.html'
})

const currentConsoleTitle = computed<string>(() => {
  if (selectedConsoleTarget.value === 'hub') {
    return 'Workspace Console Hub'
  }
  const targetModel = allModelTargets.value.find((m) => m.id === selectedConsoleTarget.value)
  return targetModel ? `${targetModel.name} Console` : 'Model Console'
})

const currentTargetModel = computed(() => {
  if (selectedConsoleTarget.value === 'hub') return null
  return allModelTargets.value.find((m) => m.id === selectedConsoleTarget.value) || null
})

async function findFileHandleCaseInsensitive(
  dir: any,
  targetName: string,
): Promise<any | null> {
  try {
    const direct = await dir.getFileHandle(targetName)
    if (direct) return direct
  } catch {
    // fallback to entry scan
  }

  const lower = targetName.toLowerCase()
  try {
    for await (const [name, handle] of dir.entries()) {
      if (name.toLowerCase() === lower && handle.kind === 'file') {
        return handle
      }
    }
  } catch {
    // ignore
  }
  return null
}

async function findDirHandleCaseInsensitive(
  dir: any,
  targetName: string,
): Promise<any | null> {
  try {
    const direct = await dir.getDirectoryHandle(targetName)
    if (direct) return direct
  } catch {
    // fallback to entry scan
  }

  const lower = targetName.toLowerCase()
  try {
    for await (const [name, handle] of dir.entries()) {
      if (name.toLowerCase() === lower && handle.kind === 'directory') {
        return handle
      }
    }
  } catch {
    // ignore
  }
  return null
}

async function findFileHandleDeep(
  dir: any,
  targetFilename: string,
  depth = 0,
): Promise<any | null> {
  if (depth > 4) return null
  const lower = targetFilename.toLowerCase()

  try {
    const subdirs: any[] = []
    for await (const [name, handle] of dir.entries()) {
      if (name.toLowerCase() === lower && handle.kind === 'file') {
        return handle
      }
      if (handle.kind === 'directory' && !name.startsWith('.') && name !== 'node_modules') {
        subdirs.push(handle)
      }
    }

    for (const subdir of subdirs) {
      const found = await findFileHandleDeep(subdir, targetFilename, depth + 1)
      if (found) return found
    }
  } catch {
    // ignore
  }
  return null
}

async function resolveFlexibleFileHandle(
  root: any,
  refPath: string,
): Promise<any | null> {
  const normalized = refPath
    .replace(/\\/g, '/')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '')

  const filename = normalized.split('/').pop() || ''
  const variations = [
    normalized,
    normalized.replace(/^innfo\//i, ''),
    `innfo/${normalized}`,
    filename ? `artifacts/${filename}` : '',
    filename ? `export/${filename}` : '',
    filename ? `innfo/artifacts/${filename}` : '',
    filename ? `innfo/export/${filename}` : '',
  ].filter(Boolean)

  const uniquePaths = Array.from(new Set(variations))

  for (const p of uniquePaths) {
    const segments = p.split('/').filter((s) => s && s !== '.' && s !== '..')
    if (segments.length === 0) continue

    let current: any = root
    let failed = false

    for (let i = 0; i < segments.length - 1; i++) {
      const nextDir = await findDirHandleCaseInsensitive(current, segments[i])
      if (!nextDir) {
        failed = true
        break
      }
      current = nextDir
    }

    if (!failed) {
      const file = await findFileHandleCaseInsensitive(current, segments[segments.length - 1])
      if (file) return file
    }
  }

  // Deep recursive search for filename as ultimate fallback
  if (filename && filename.endsWith('.html')) {
    const deepFound = await findFileHandleDeep(root, filename)
    if (deepFound) return deepFound
  }

  return null
}

async function inlineConsoleResources(
  rawHtml: string,
  consolePath: string,
  rootHandle: any,
): Promise<string> {
  if (!rawHtml) return rawHtml
  let result = rawHtml

  const normalizedPath = consolePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\.\.\//, '')
  const consoleDir = normalizedPath.includes('/')
    ? normalizedPath.substring(0, normalizedPath.lastIndexOf('/'))
    : ''

  const inlinedScripts = new Set<string>()

  // 1. Process <script ... src="..."> tags
  const scriptRegex = /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>(?:\s*<\/script>)?/gi
  const scriptMatches: Array<{ fullMatch: string; src: string; isModule: boolean }> = []

  let match: RegExpExecArray | null
  while ((match = scriptRegex.exec(rawHtml)) !== null) {
    const fullMatch = match[0]
    const attrs = `${match[1]} ${match[3]}`
    const src = match[2]
    const isModule = /type=["']module["']/i.test(attrs)
    scriptMatches.push({ fullMatch, src, isModule })
  }

  for (const { fullMatch, src, isModule } of scriptMatches) {
    const cleanSrc = src.split('?')[0].split('#')[0]
    const filename = cleanSrc.split('/').pop() || ''
    if (!filename || !filename.endsWith('.js')) continue

    if (inlinedScripts.has(filename)) {
      result = result.replace(fullMatch, `<!-- [Inlined ${filename} earlier] -->`)
      continue
    }

    let scriptContent: string | null = null

    // A. Try loading from workspace filesystem
    if (rootHandle) {
      const candidatePaths = [
        consoleDir ? `${consoleDir}/${filename}` : '',
        filename,
        `export/${filename}`,
        `artifacts/${filename}`,
        `specs/bluepriNNts/console/${filename}`,
        `innfo/specs/bluepriNNts/console/${filename}`,
      ].filter(Boolean)

      for (const candidate of candidatePaths) {
        try {
          const handle = await resolveFlexibleFileHandle(rootHandle, candidate)
          if (handle && handle.kind === 'file') {
            const f = await handle.getFile()
            const text = await f.text()
            if (text && !text.includes('/src/main.ts') && !text.includes('id="app"')) {
              scriptContent = text
              break
            }
          }
        } catch {
          // ignore
        }
      }
    }

    // B. Fallback: Try fetching via local specs endpoint or relative URL
    if (!scriptContent) {
      const fetchUrls = [
        `/specs/bluepriNNts/console/${filename}`,
        `/innfo/specs/bluepriNNts/console/${filename}`,
        src.startsWith('http') ? null : src,
      ].filter(Boolean) as string[]

      for (const url of fetchUrls) {
        try {
          const res = await fetch(url)
          if (res.ok) {
            const text = await res.text()
            if (
              text &&
              !text.includes('/src/main.ts') &&
              !text.includes('@vite/client') &&
              !text.includes('id="app"')
            ) {
              scriptContent = text
              break
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (scriptContent) {
      inlinedScripts.add(filename)
      const moduleAttr = isModule ? ' type="module"' : ''
      const inlinedTag = `<script${moduleAttr}>\n/* Inlined: ${filename} */\n${scriptContent}\n<\/script>`
      result = result.replace(fullMatch, inlinedTag)
    }
  }

  // 2. Process <link rel="stylesheet" ...> tags with relative hrefs
  const linkRegex = /<link\b([^>]*)\bhref=["']([^"']+)["']([^>]*)\/?>/gi
  const linkMatches: Array<{ fullMatch: string; href: string }> = []
  while ((match = linkRegex.exec(rawHtml)) !== null) {
    const fullMatch = match[0]
    const attrs = `${match[1]} ${match[3]}`
    if (/rel=["']stylesheet["']/i.test(attrs)) {
      linkMatches.push({ fullMatch, href: match[2] })
    }
  }

  for (const { fullMatch, href } of linkMatches) {
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      continue
    }
    const cleanHref = href.split('?')[0].split('#')[0]
    const filename = cleanHref.split('/').pop() || ''
    if (!filename || !filename.endsWith('.css')) continue

    let cssContent: string | null = null
    if (rootHandle) {
      const candidatePaths = [
        consoleDir ? `${consoleDir}/${filename}` : '',
        filename,
        `artifacts/${filename}`,
        `export/${filename}`,
      ].filter(Boolean)
      for (const candidate of candidatePaths) {
        try {
          const handle = await resolveFlexibleFileHandle(rootHandle, candidate)
          if (handle && handle.kind === 'file') {
            const f = await handle.getFile()
            cssContent = await f.text()
            if (cssContent) break
          }
        } catch {
          // ignore
        }
      }
    }

    if (!cssContent) {
      try {
        const res = await fetch(href)
        if (res.ok) {
          const text = await res.text()
          if (!text.includes('/src/main.ts') && !text.includes('id="app"')) {
            cssContent = text
          }
        }
      } catch {
        // ignore
      }
    }

    if (cssContent) {
      const inlinedStyle = `<style>\n/* Inlined: ${filename} */\n${cssContent}\n</style>`
      result = result.replace(fullMatch, inlinedStyle)
    }
  }

  return result
}

async function loadConsole() {
  loadState.value = 'loading'
  isFrameLoading.value = true
  const candidates = getCandidatePaths(selectedConsoleTarget.value)

  try {
    if (workspaceStore.handle) {
      for (const candidate of candidates) {
        try {
          const fileHandle = await resolveFlexibleFileHandle(workspaceStore.handle, candidate)
          if (fileHandle) {
            const file = await fileHandle.getFile()
            const text = await file.text()
            const inlined = await inlineConsoleResources(text, candidate, workspaceStore.handle)
            htmlContent.value = inlined
            resolvedUrl.value = candidate
            loadState.value = 'ready'
            return
          }
        } catch {
          // continue checking next candidate
        }
      }
    } else {
      // Fallback: only when NO folder handle is active (hosted/sample mode)
      for (const candidate of candidates) {
        try {
          const res = await fetch(candidate)
          if (res.ok) {
            const text = await res.text()
            // Guard against Vite returning SPA index.html
            if (!text.includes('/src/main.ts') && !text.includes('@vite/client') && !text.includes('id="app"')) {
              const inlined = await inlineConsoleResources(text, candidate, null)
              htmlContent.value = inlined
              resolvedUrl.value = candidate
              loadState.value = 'ready'
              return
            }
          }
        } catch {
          // continue
        }
      }
    }

    htmlContent.value = null
    resolvedUrl.value = candidates[0] || null
    loadState.value = 'not_found'
  } catch {
    htmlContent.value = null
    resolvedUrl.value = candidates[0] || null
    loadState.value = 'not_found'
  } finally {
    isFrameLoading.value = false
  }
}

function reloadIframe() {
  iframeKey.value++
  loadConsole()
}

function selectTarget(target: string) {
  selectedConsoleTarget.value = target
  resolvedUrl.value = null
}

function onWindowMessage(event: MessageEvent) {
  if (event.data?.type === 'innfo:select-console' || event.data?.type === 'innfo:launch-console') {
    const { modelId, title, consolePath } = event.data

    // 1. Try to match an existing discovered model
    let match = discoveredModels.value.find(
      (m) =>
        (modelId && (m.id === modelId || m.name === modelId || normalizeSlug(m.name) === normalizeSlug(modelId))) ||
        (title && (m.name === title || normalizeSlug(m.name) === normalizeSlug(title)))
    )

    if (!match && consolePath) {
      match = discoveredModels.value.find((m) => {
        const candidates = getCandidatePaths(m.id)
        return candidates.some((c) => c === consolePath || c.endsWith(consolePath) || consolePath.endsWith(c))
      })
    }

    if (match) {
      selectTarget(match.id)
      return
    }

    // 2. If not in discoveredModels, register as dynamic console tab and select it
    if (consolePath) {
      const targetId = modelId || consolePath
      const displayName = title || modelId || consolePath.split('/').pop()?.replace(/\.html$/i, '') || 'Console'

      const existing = dynamicConsoles.value.find((d) => d.id === targetId || d.consolePath === consolePath)
      if (!existing) {
        dynamicConsoles.value.push({
          id: targetId,
          name: displayName,
          consolePath,
        })
      }
      selectTarget(targetId)
    }
  }
}

watch([selectedConsoleTarget, () => workspaceStore.handle, iframeKey], () => {
  loadConsole()
})

const processedHtmlContent = computed<string | null>(() => {
  if (!htmlContent.value) return null
  let content = htmlContent.value

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  if (selectedConsoleTarget.value === 'hub') {
    const injectedStyle = isDark
      ? `<style>
          #preview-panel { display: none !important; }
        </style>`
      : `<style>
          html, body {
            background-color: #f8fafc !important;
            color: #0f172a !important;
          }
          header {
            background-color: rgba(255, 255, 255, 0.9) !important;
            border-color: #e2e8f0 !important;
          }
          .bg-slate-900, .bg-slate-950, [class*="bg-slate-900"], [class*="bg-slate-950"] {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #e2e8f0 !important;
          }
          .text-white {
            color: #0f172a !important;
          }
          .text-slate-400 {
            color: #64748b !important;
          }
          .border-slate-800, .border-slate-700 {
            border-color: #e2e8f0 !important;
          }
          input {
            background-color: #ffffff !important;
            color: #0f172a !important;
            border-color: #e2e8f0 !important;
          }
          #preview-panel {
            display: none !important;
          }
        </style>`

    const bridgeScript = `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.launch-btn') || e.target.closest('[data-launch]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      var launchPath = btn.getAttribute('data-launch');
      var title = btn.getAttribute('data-title') || btn.getAttribute('data-model-id') || 'Console';
      var modelId = btn.getAttribute('data-model-id') || title;
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'innfo:select-console',
          modelId: modelId,
          title: title,
          consolePath: launchPath
        }, '*');
      }
    }
  }, true);
})();
<\/script>
`

    if (content.includes('</head>')) {
      content = content.replace('</head>', `${injectedStyle}</head>`)
    } else {
      content = injectedStyle + content
    }

    if (content.includes('</body>')) {
      content = content.replace('</body>', `${bridgeScript}</body>`)
    } else {
      content = content + bridgeScript
    }
  }

  return content
})

// "Open External" (F-16): `currentFrameUrl` is a path relative to the user's
// folder, which is meaningless once resolved against the app's own origin —
// that's what makes the link 404 for a local folder opened via the File
// System Access API. When a folder handle is active, `loadConsole()` has
// already read the file content into `htmlContent`; build a Blob URL from
// it so the external link works for that primary flow too. Hosted/sample
// mode has no handle, so it keeps using the plain relative/absolute URL.
const externalBlobUrl = ref<string | null>(null)

function revokeExternalBlobUrl(): void {
  if (externalBlobUrl.value) {
    URL.revokeObjectURL(externalBlobUrl.value)
    externalBlobUrl.value = null
  }
}

watch([htmlContent, () => workspaceStore.handle], ([content, handle]) => {
  revokeExternalBlobUrl()
  if (handle && content) {
    const blob = new Blob([content], { type: 'text/html' })
    externalBlobUrl.value = URL.createObjectURL(blob)
  }
})

const externalHref = computed<string>(() => externalBlobUrl.value ?? currentFrameUrl.value)

onMounted(() => {
  window.addEventListener('message', onWindowMessage)
  loadConsole()
})

onUnmounted(() => {
  window.removeEventListener('message', onWindowMessage)
  revokeExternalBlobUrl()
})
</script>

<template>
  <div class="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
    <!-- Top Bar: Spacious 2-Tier Header Layout -->
    <header class="flex flex-col gap-2.5 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-2xs">
      <!-- Upper Tier: Title, Badge & Global Actions -->
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3 min-w-0">
          <div class="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 shrink-0 shadow-2xs">
            <Layers class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {{ currentConsoleTitle }}
              </h2>
              <span class="px-2 py-0.5 text-2xs font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                Sandboxed View
              </span>
              <span
                v-if="resolvedUrl && loadState === 'ready'"
                class="px-2 py-0.5 text-2xs font-mono rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0 truncate max-w-xs"
                :title="resolvedUrl"
              >
                {{ resolvedUrl }}
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
              Interactive deliverables & aggregated workspace console portal
            </p>
          </div>
        </div>

        <!-- Actions: Refresh & Open in New Window -->
        <div class="flex items-center gap-2 shrink-0 ml-auto">
          <button
            @click="reloadIframe"
            class="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700"
            title="Reload Console"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isFrameLoading }" />
            <span>Reload</span>
          </button>
          <a
            :href="externalHref"
            target="_blank"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xs"
            title="Open in external browser window"
          >
            <span>Open External</span>
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <!-- Lower Tier: Scrollable Console Switcher Tabs -->
      <div class="flex items-center gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto scrollbar-none">
        <button
          @click="selectTarget('hub')"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          :class="
            selectedConsoleTarget === 'hub'
              ? 'bg-white dark:bg-slate-700 text-primary shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          "
        >
          <Layers class="w-3.5 h-3.5" />
          <span>Workspace Hub</span>
        </button>

        <button
          v-for="model in allModelTargets"
          :key="model.id"
          @click="selectTarget(model.id)"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 capitalize shrink-0"
          :class="
            selectedConsoleTarget === model.id
              ? 'bg-white dark:bg-slate-700 text-primary shadow-xs font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          "
          :title="`Launch ${model.name} Console`"
        >
          <FileText class="w-3.5 h-3.5" />
          <span>{{ model.name }}</span>
        </button>
      </div>
    </header>

    <!-- Main Content: Embedded Iframe or Clean Actionable Empty State -->
    <div class="flex-1 relative overflow-hidden bg-slate-100/70 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
      <!-- Loading State -->
      <div v-if="loadState === 'loading'" class="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
        <RefreshCw class="w-6 h-6 animate-spin text-blue-500" />
        <span class="text-xs font-mono">Loading console artifact...</span>
      </div>

      <!-- Ready State: Mount HTML with srcdoc -->
      <iframe
        v-else-if="loadState === 'ready' && processedHtmlContent"
        :key="iframeKey"
        :srcdoc="processedHtmlContent"
        class="w-full h-full border-none bg-white dark:bg-slate-950 rounded-xl shadow-xs"
        sandbox="allow-scripts allow-forms allow-popups"
      ></iframe>

      <!-- Not Found / Pending Build Empty State -->
      <div
        v-else
        class="max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl flex flex-col gap-5 text-center items-center"
      >
        <div class="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl">
          <AlertCircle class="w-6 h-6" />
        </div>

        <div>
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-2xs font-mono font-medium mb-2">
            Artifact Pending Compilation
          </div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">
            Console Deliverable Not Found
          </h3>
          <p class="text-xs font-mono text-slate-500 dark:text-slate-400">
            {{ currentFrameUrl }}
          </p>
        </div>

        <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
          This workspace does not have a compiled console HTML file at this location yet. In iNNfo, interactive consoles are generated deliverables produced by running model compilation procedures.
        </p>

        <div class="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-left flex flex-col gap-2 font-mono text-xs">
          <div class="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-2xs uppercase tracking-wider">
            <Terminal class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span>How to compile this console</span>
          </div>
          <p v-if="selectedConsoleTarget === 'hub'" class="text-slate-600 dark:text-slate-400 text-2xs">
            Run procedure: <span class="text-indigo-600 dark:text-indigo-400 font-semibold">compile_workspace_hub_NN.md</span> to aggregate all workspace models into <span class="text-emerald-600 dark:text-emerald-400">artifacts/workspace_hub.html</span>.
          </p>
          <p v-else class="text-slate-600 dark:text-slate-400 text-2xs">
            Run template procedure for <span class="text-indigo-600 dark:text-indigo-400 font-semibold">{{ currentTargetModel?.template || 'model' }}</span>: <span class="text-blue-600 dark:text-blue-400">compile_{{ currentTargetModel?.template }}_console_NN.md</span>.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            @click="reloadIframe"
            class="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw class="w-3.5 h-3.5" />
            <span>Re-check Artifact</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
