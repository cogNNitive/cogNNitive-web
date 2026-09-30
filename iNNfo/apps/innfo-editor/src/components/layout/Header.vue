<template>
  <header
    class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-6 py-3 shrink-0"
  >
    <!-- Left Section: Logo and Versions (Spec, Template, Model) -->
    <div class="flex items-center gap-4 flex-1 min-w-0 mr-4">
      <!-- Home Button -->
      <button
        @click="$emit('close-workspace')"
        class="p-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer mr-1 shrink-0"
        title="Close Workspace and return Home"
        data-testid="header-home-button"
      >
        <Home class="w-4 h-4" />
      </button>

      <div class="flex items-center gap-2 shrink-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 800 600"
          class="w-6 h-6 shrink-0 text-primary"
          aria-label="iNNfo Logo"
        >
          <path
            d="M 160 490 L 160 295 Q 160 270 180 285 L 330 475 Q 350 490 350 470 L 350 235 Q 350 210 370 225 L 530 415 Q 550 430 550 410 L 550 90 L 495 145 L 550 90 L 605 145"
            fill="none"
            stroke="currentColor"
            stroke-width="82"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="font-mono text-lg font-black text-primary select-none leading-none">NN</span>
        <h1 class="text-sm font-semibold tracking-tight">iNNfo Modeler</h1>
        <span
          class="font-mono text-xs text-slate-400 dark:text-slate-500 font-normal select-none cursor-default ml-0.5"
          :title="commitDate ? `Commit date: ${commitDate}` : `Version ${appVersion}`"
          data-testid="header-version-badge"
        >
          v{{ appVersion }}<template v-if="commitDate"> ({{ commitDate }})</template>
        </span>
      </div>

      <!-- Actions Section (Reload, Info, Validation) -->
      <div
        v-if="hasRootNode"
        class="flex items-center gap-2 text-2xs text-slate-500 dark:text-slate-400 shrink-0 mr-auto"
      >
        <!-- Reload from Disk Button -->
        <button
          @click="handleReload"
          :disabled="workspaceStore.isParsing"
          class="p-1 rounded text-slate-400 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          :class="workspaceStore.isParsing ? 'text-primary bg-primary/5' : ''"
          :title="workspaceStore.isParsing ? 'Reloading…' : 'Reload model from disk'"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': workspaceStore.isParsing }" />
        </button>

        <!-- Details Info Trigger Button -->
        <button
          @click="uiStore.setActiveView('info')"
          class="p-1 rounded text-slate-400 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
          :class="uiStore.activeView === 'info' ? 'text-primary bg-primary/5' : ''"
          title="View Model Info"
          data-testid="header-info-button"
        >
          <Info class="w-4 h-4" />
        </button>

        <!-- Validation Status Badge/Link -->
        <button
          v-if="hasRootNode"
          @click="openValidationReport"
          class="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold transition-all cursor-pointer rounded-md border border-transparent"
          :class="[
            statusClass,
            isBlinking
              ? 'animate-header-blink ring-2 ring-amber-400/80 dark:ring-amber-500/80 shadow-md scale-105'
              : '',
          ]"
          :title="statusTitle"
        >
          <component :is="statusIcon" class="w-4 h-4" />
          <span v-if="statusText" class="font-mono text-2xs font-bold">{{ statusText }}</span>
        </button>
      </div>
    </div>

    <!-- Primary Workspace View Switcher -->
    <div
      v-if="hasRootNode"
      class="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shrink-0 mr-4"
      data-testid="header-view-switcher"
    >
      <button
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer capitalize border border-transparent"
        :class="
          uiStore.activeView === 'editor'
            ? 'bg-white dark:bg-slate-700 text-primary shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        "
        @click="uiStore.setActiveView('editor')"
        data-testid="header-view-editor"
        title="Editor View"
      >
        <FileText class="w-3.5 h-3.5 shrink-0" />
        <span>Editor</span>
      </button>

      <button
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer capitalize border border-transparent"
        :class="
          uiStore.activeView === 'graph'
            ? 'bg-white dark:bg-slate-700 text-primary shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        "
        @click="uiStore.setActiveView('graph')"
        data-testid="header-view-graph"
        title="Graph View"
      >
        <LayoutDashboard class="w-3.5 h-3.5 shrink-0" />
        <span>Graph</span>
      </button>

      <button
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer capitalize border border-transparent"
        :class="
          uiStore.activeView === 'consoles'
            ? 'bg-white dark:bg-slate-700 text-primary shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        "
        @click="uiStore.setActiveView('consoles')"
        data-testid="header-view-consoles"
        title="Workspace Consoles & Hub"
      >
        <Layers class="w-3.5 h-3.5 shrink-0" />
        <span>Consoles</span>
      </button>
    </div>

    <!-- Right Section Actions -->
    <div class="flex items-center gap-2.5 shrink-0">
      <!-- Search Button & Floating Search Popup Wrapper -->
      <div v-if="hasRootNode" class="relative" ref="searchContainerRef">
        <button
          @click="uiStore.toggleSearchOpen()"
          class="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/70"
          :class="uiStore.isSearchOpen ? 'bg-primary/10 text-primary ring-1 ring-primary/20 border-primary/30' : ''"
          title="Buscar conceptos o elementos"
          data-testid="header-search-button"
        >
          <Search
            class="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400"
            :class="{ 'text-primary': uiStore.isSearchOpen }"
          />

          <!-- Concepts status badge -->
          <span
            class="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-semibold"
            :class="
              uiStore.isAllConceptsSelected
                ? 'bg-slate-200/70 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'
                : 'bg-primary/15 text-primary dark:text-primary-300 ring-1 ring-primary/25'
            "
            data-testid="header-concept-status-badge"
          >
            {{ conceptStatusText }}
          </span>

          <!-- Workspace primary tags badges (shown only if not all tags are selected) -->
          <template v-if="!isAllTagsSelected && selectedPrimaryTags.length > 0">
            <span
              v-for="tag in selectedPrimaryTags"
              :key="tag.name"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono font-medium border shrink-0"
              :style="
                tag.color
                  ? {
                      borderColor: tag.color,
                      color: tag.color,
                      backgroundColor: `${tag.color}18`,
                    }
                  : {
                      borderColor: 'var(--slate-300, #cbd5e1)',
                      backgroundColor: 'rgba(148, 163, 184, 0.1)',
                    }
              "
              :title="tag.description || `Etiqueta primaria: ${tag.name}`"
              data-testid="header-primary-tag-badge"
            >
              <IconRenderer :icon="tag.icon || 'tag'" custom-class="w-3 h-3 shrink-0" />
              <span>{{ tag.name }}</span>
            </span>
          </template>

          <!-- Tags status badge -->
          <span
            class="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-semibold"
            :class="
              isAllTagsSelected
                ? 'bg-slate-200/70 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'
                : 'bg-primary/15 text-primary dark:text-primary-300 ring-1 ring-primary/25'
            "
            data-testid="header-tag-status-badge"
          >
            {{ tagStatusText }}
          </span>
        </button>

        <!-- Floating Search Popup Dropdown over Header -->
        <div
          v-if="uiStore.isSearchOpen"
          class="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-xl p-3 z-[100] text-xs flex flex-col gap-2.5"
          data-testid="header-search-popup"
        >
          <!-- Top Row: Input + Clear + Close -->
          <div
            class="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/60 rounded-lg px-2.5 py-1.5 border border-slate-200/80 dark:border-slate-700/80"
          >
            <Search class="w-4 h-4 text-slate-400 shrink-0" />
            <input
              :value="uiStore.searchQuery"
              @input="(e) => uiStore.setSearchQuery((e.target as HTMLInputElement).value)"
              type="text"
              placeholder="Buscar concepto, elemento o texto..."
              class="bg-transparent border-none text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none flex-1 min-w-0"
              data-testid="header-search-input"
            />
            <button
              v-if="uiStore.searchQuery || !uiStore.isAllConceptsSelected"
              @click="uiStore.clearSearch()"
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer shrink-0"
              title="Limpiar búsqueda"
            >
              <X class="w-3.5 h-3.5" />
            </button>
            <button
              @click="uiStore.toggleSearchOpen()"
              class="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer shrink-0 ml-0.5"
              title="Cerrar búsqueda"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Tabs Header: Conceptos vs Etiquetas -->
          <div class="flex items-center border-b border-slate-200 dark:border-slate-700/80 mb-2">
            <button
              type="button"
              @click="uiStore.setSearchFilterTab('concepts')"
              class="flex-1 py-1.5 text-center font-bold text-2xs uppercase tracking-wider transition-all border-b-2 cursor-pointer"
              :class="
                uiStore.searchFilterTab === 'concepts'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              "
              data-testid="tab-concepts"
            >
              Conceptos ({{ selectedConceptCount }}/{{ availableConcepts.length }})
            </button>
            <button
              type="button"
              @click="uiStore.setSearchFilterTab('tags')"
              class="flex-1 py-1.5 text-center font-bold text-2xs uppercase tracking-wider transition-all border-b-2 cursor-pointer"
              :class="
                uiStore.searchFilterTab === 'tags'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              "
              data-testid="tab-tags"
            >
              Etiquetas ({{ selectedTagCount }}/{{ availableTags.length }})
            </button>
          </div>

          <!-- TAB 1: Conceptos -->
          <template v-if="uiStore.searchFilterTab === 'concepts'">
            <!-- Concept Picklist Header: Title + Select All / Deselect All -->
            <div
              v-if="availableConcepts.length > 0"
              class="flex items-center justify-between px-0.5"
            >
              <span
                class="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
              >
                Filtro por Concepto
              </span>
              <div class="flex items-center gap-1.5">
                <button
                  @click="uiStore.selectAllConcepts()"
                  class="text-2xs font-bold text-primary hover:underline px-1.5 py-0.5 rounded bg-primary/10 transition-colors cursor-pointer"
                  title="Seleccionar todos los conceptos"
                  data-testid="select-all-concepts-button"
                >
                  Todas
                </button>
                <button
                  @click="uiStore.deselectAllConcepts()"
                  class="text-2xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Deseleccionar todos los conceptos"
                  data-testid="deselect-all-concepts-button"
                >
                  Ninguna
                </button>
              </div>
            </div>

            <!-- Vertical scrollable list of Pills -->
            <div
              v-if="availableConcepts.length > 0"
              class="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1 text-xs scrollbar-thin border-t border-slate-100 dark:border-slate-700/60 pt-2"
              data-testid="header-concept-picklist"
            >
              <div
                v-for="concept in availableConcepts"
                :key="concept"
                class="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                @click="uiStore.toggleConceptFilter(concept, availableConcepts)"
              >
                <input
                  type="checkbox"
                  :checked="uiStore.isConceptSelected(concept)"
                  class="w-3.5 h-3.5 rounded text-primary border-slate-300 focus:ring-primary cursor-pointer shrink-0"
                  @click.stop="uiStore.toggleConceptFilter(concept, availableConcepts)"
                />
                <Pill
                  :name="concept"
                  :concept-type="concept"
                  kind="concept"
                  :node-id="conceptMetaMap[concept]?.nodeId"
                  :icon="conceptMetaMap[concept]?.icon"
                  :color="conceptMetaMap[concept]?.color"
                  :interactive="false"
                  :selected="uiStore.isConceptSelected(concept)"
                  class="pointer-events-none flex-1 min-w-0"
                  :class="{
                    'opacity-40 grayscale': !uiStore.isConceptSelected(concept),
                  }"
                />
              </div>
            </div>
          </template>

          <!-- TAB 2: Etiquetas -->
          <template v-else-if="uiStore.searchFilterTab === 'tags'">
            <!-- Tag Picklist Header: Title + Select All / Deselect All -->
            <div v-if="availableTags.length > 0" class="flex items-center justify-between px-0.5">
              <span
                class="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
              >
                Filtro por Etiqueta
              </span>
              <div class="flex items-center gap-1.5">
                <button
                  @click="uiStore.selectAllTags(availableTags)"
                  class="text-2xs font-bold text-primary hover:underline px-1.5 py-0.5 rounded bg-primary/10 transition-colors cursor-pointer"
                  title="Seleccionar todas las etiquetas"
                  data-testid="select-all-tags-button"
                >
                  Todas
                </button>
                <button
                  @click="uiStore.deselectAllTags()"
                  class="text-2xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Deseleccionar todas las etiquetas"
                  data-testid="deselect-all-tags-button"
                >
                  Ninguna
                </button>
              </div>
            </div>

            <!-- Empty state if no tags -->
            <div
              v-if="availableTags.length === 0"
              class="text-center py-6 text-slate-400 dark:text-slate-500 italic text-xs"
            >
              No hay etiquetas en este modelo ni workspace.
            </div>

            <!-- Vertical scrollable list of Tags -->
            <div
              v-else
              class="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1 text-xs scrollbar-thin border-t border-slate-100 dark:border-slate-700/60 pt-2"
              data-testid="header-tag-picklist"
            >
              <div
                v-for="tag in availableTags"
                :key="tag"
                class="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                @click="uiStore.toggleTagFilter(tag)"
                :title="tagMetaMap[tag]?.description || `Etiqueta: ${tag}`"
              >
                <input
                  type="checkbox"
                  :checked="uiStore.isTagSelected(tag)"
                  class="w-3.5 h-3.5 rounded text-primary border-slate-300 focus:ring-primary cursor-pointer shrink-0"
                  @click.stop="uiStore.toggleTagFilter(tag)"
                />
                <div
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border flex-1 min-w-0 transition-opacity"
                  :class="{
                    'opacity-40 grayscale': !uiStore.isTagSelected(tag),
                  }"
                  :style="
                    tagMetaMap[tag]?.color
                      ? {
                          borderColor: tagMetaMap[tag]!.color,
                          color: tagMetaMap[tag]!.color,
                          backgroundColor: `${tagMetaMap[tag]!.color}18`,
                        }
                      : {
                          borderColor: 'var(--slate-300, #cbd5e1)',
                          backgroundColor: 'rgba(148, 163, 184, 0.1)',
                        }
                  "
                >
                  <IconRenderer
                    :icon="tagMetaMap[tag]?.icon || 'tag'"
                    custom-class="w-3.5 h-3.5 shrink-0"
                  />
                  <span class="truncate font-mono text-2xs">{{ tag }}</span>
                  <span
                    v-if="tagMetaMap[tag]?.description"
                    class="text-2xs text-slate-400 dark:text-slate-500 font-sans truncate ml-auto pl-1 max-w-[120px]"
                  >
                    {{ tagMetaMap[tag]!.description }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Use AI Button — opens unified modal -->
      <button
        @click="uiStore.setActiveView(uiStore.activeView === 'ai-guide' ? 'editor' : 'ai-guide')"
        class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-all cursor-pointer"
        :class="
          uiStore.activeView === 'ai-guide'
            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 ring-purple-500 shadow-xs'
            : 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 ring-purple-300 dark:ring-purple-700/50 hover:bg-purple-50 dark:hover:bg-purple-950/30'
        "
        :title="uiStore.activeView === 'ai-guide' ? 'Exit AI Guide and return to Editor' : 'Use AI to edit models'"
        data-testid="header-use-ai-button"
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>Use AI</span>
      </button>

      <!-- Read-only live preview indicator -->
      <span
        v-if="workspaceStore.previewReadOnly"
        class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-700"
        title="Live preview of the agent's edits — read-only"
        data-testid="header-readonly-badge"
      >
        <Eye class="w-3.5 h-3.5" />
        <span>Read-only</span>
      </span>

      <!-- Save Button with integrated Saved status -->
      <div v-if="!workspaceStore.previewReadOnly" class="relative" ref="saveDropdownRef">
        <div class="relative inline-flex rounded-md shadow-xs">
          <button
            @click="handleSave"
            :disabled="!shouldShowSave"
            class="inline-flex items-center gap-1.5 rounded-l-md px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-all cursor-pointer"
            :class="
              shouldShowSave
                ? 'bg-primary text-primary-foreground ring-primary/20 hover:bg-primary/90'
                : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20 cursor-default'
            "
          >
            <component :is="shouldShowSave ? Save : CheckCircle" class="w-3.5 h-3.5" />
            <span>{{ shouldShowSave ? 'Save' : 'Saved' }}</span>
          </button>
          <button
            @click="toggleSaveDropdown"
            class="inline-flex items-center rounded-r-md px-2 py-1.5 text-xs font-semibold ring-1 ring-inset transition-all cursor-pointer border-l"
            :class="
              shouldShowSave
                ? 'bg-primary text-primary-foreground ring-primary/20 border-primary-foreground/10 hover:bg-primary/90'
                : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20 border-emerald-250 dark:border-emerald-850 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40'
            "
          >
            <ChevronDown class="w-3.5 h-3.5" />
          </button>

          <!-- Save Dropdown -->
          <div
            v-if="saveDropdownOpen"
            class="absolute right-0 top-full mt-1.5 w-80 rounded-lg bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-600 py-2.5 z-50"
          >
            <div class="px-3.5 pt-0.5">
              <div
                v-if="activeModelName"
                class="mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-700/60"
              >
                <span
                  class="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5"
                  >Target Model</span
                >
                <span
                  class="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 break-all select-all block leading-snug"
                  :title="activeModelName"
                  >{{ activeModelName }}</span
                >
              </div>
              <div class="flex items-center justify-between mb-2">
                <span
                  class="flex items-center gap-1 text-2xs font-bold text-slate-400 dark:text-slate-505 uppercase tracking-wider"
                >
                  Current Version
                </span>
                <span class="font-mono text-xs font-extrabold text-primary">{{
                  modelVersion
                }}</span>
              </div>
              <p
                v-if="bumpError"
                class="text-2xs text-red-650 dark:text-red-400 mb-1.5 leading-tight"
              >
                {{ bumpError }}
              </p>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="lvl in ['major', 'minor', 'patch'] as const"
                  :key="lvl"
                  @click="bumpVersion(lvl)"
                  class="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-1.5 text-2xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer capitalize"
                >
                  {{ lvl }}
                </button>
              </div>
              <p class="text-2xs text-slate-400 dark:text-slate-505 mt-1.5 leading-tight">
                Saves a new versioned file, keeping the current one.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- External links -->
      <div class="flex items-center gap-0.5 pl-1.5">
        <a
          href="https://cognnitive.com"
          target="_blank"
          rel="noopener noreferrer"
          class="px-2 py-1 rounded text-xs font-medium text-slate-400 dark:text-slate-505 hover:text-primary hover:bg-primary/5 transition-colors"
          >Web</a
        >
        <a
          href="https://innfo.cognnitive.com/documentation"
          target="_blank"
          rel="noopener noreferrer"
          class="px-2 py-1 rounded text-xs font-medium text-slate-400 dark:text-slate-505 hover:text-primary hover:bg-primary/5 transition-colors"
          >Docs</a
        >
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Home,
  Save,
  ChevronDown,
  Info,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Sparkles,
  Search,
  X,
  FileText,
  LayoutDashboard,
  Layers,
  Eye,
} from 'lucide-vue-next'

import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useKnowledgeStore } from '../../stores/knowledgeStore'
import { useUiStore } from '../../stores/uiStore'
import { useToast } from '../../shared/useToast'
import Pill from '../editor/Pill.vue'
import TagInput from '../ui/TagInput.vue'
import IconRenderer from '../editor/IconRenderer.vue'
import { getConceptMeta } from '../../composables/useConceptVisuals'

import { DEFAULT_INNFO_VERSION } from '../../utils/constants'

const workspaceStore = useWorkspaceStore()
const knowledgeStore = useKnowledgeStore()
const uiStore = useUiStore()
const { show } = useToast()

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'
const commitDate = typeof __COMMIT_DATE__ !== 'undefined' ? __COMMIT_DATE__ : ''

const hasErrors = computed(() => (knowledgeStore.validationReport?.summary.errors ?? 0) > 0)
const hasWarnings = computed(
  () =>
    (knowledgeStore.validationReport?.summary.warnings ?? 0) > 0 || knowledgeStore.parseIssues.length > 0,
)
const totalErrors = computed(() => knowledgeStore.validationReport?.summary.errors ?? 0)
const totalWarnings = computed(
  () => (knowledgeStore.validationReport?.summary.warnings ?? 0) + knowledgeStore.parseIssues.length,
)

const statusClass = computed(() => {
  if (hasErrors.value) {
    return 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
  }
  if (hasWarnings.value) {
    return 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
  }
  return 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
})

const statusIcon = computed(() => {
  if (hasErrors.value) return XCircle
  if (hasWarnings.value) return AlertTriangle
  return CheckCircle
})

const statusText = computed(() => {
  if (hasErrors.value) return `${totalErrors.value}`
  if (hasWarnings.value) return `${totalWarnings.value}`
  return ''
})

const statusTitle = computed(() => {
  if (hasErrors.value) return 'Model is incorrect: click to view validation errors'
  if (hasWarnings.value) return 'Model loaded with warnings: click to view details'
  return 'Model is valid: click to view full report'
})

function openValidationReport(): void {
  uiStore.setActiveView('editor')
  uiStore.setShowValidationReport(true)
}

const isBlinking = ref(false)
let blinkTimer: ReturnType<typeof setTimeout> | undefined

function triggerBlink(): void {
  if (hasErrors.value || hasWarnings.value) {
    isBlinking.value = true
    if (blinkTimer) clearTimeout(blinkTimer)
    blinkTimer = setTimeout(() => {
      isBlinking.value = false
    }, 5000)
  } else {
    isBlinking.value = false
  }
}

watch(
  () => [workspaceStore.parseCount, knowledgeStore.validationReport, knowledgeStore.parseIssues.length],
  () => {
    triggerBlink()
  },
  { immediate: true },
)

const saveDropdownOpen = ref(false)
const saveDropdownRef = ref<HTMLElement | null>(null)
const bumpError = ref('')

// ── Root node frontmatter extraction ────────────────────────────

const rootNode = computed(() => {
  const activeId =
    (uiStore.activeModelId && knowledgeStore.nodes[uiStore.activeModelId]
      ? uiStore.activeModelId
      : undefined) ??
    knowledgeStore.rootIds.find((id) => !id.startsWith('spec:')) ??
    knowledgeStore.rootIds[0]
  if (!activeId) return null
  return knowledgeStore.getNode(activeId) ?? null
})

const hasRootNode = computed(() => rootNode.value !== null)

const availableConcepts = computed(() => {
  const concepts = new Set<string>()
  for (const node of Object.values(knowledgeStore.nodes)) {
    const conceptName =
      node.conceptBinding?.name || (node.kind === 'concept' ? node.name : node.type)
    if (conceptName && conceptName !== 'root') {
      concepts.add(conceptName)
    }
  }
  return Array.from(concepts).sort()
})

const conceptMetaMap = computed(() => {
  const map: Record<string, { icon?: string; color?: string; nodeId?: string }> = {}
  for (const concept of availableConcepts.value) {
    const meta = getConceptMeta(concept)
    const conceptNode = Object.values(knowledgeStore.nodes).find(
      (n) => n.name === concept || n.conceptBinding?.name === concept,
    )
    map[concept] = {
      icon: meta.icon,
      color: meta.color,
      nodeId: conceptNode?.id,
    }
  }
  return map
})

const selectedConceptCount = computed(() => {
  if (uiStore.isAllConceptsSelected) return availableConcepts.value.length
  return availableConcepts.value.filter((c) => uiStore.isConceptSelected(c)).length
})

const availableTags = computed(() => {
  return knowledgeStore.allTags
})

const tagMetaMap = computed(() => {
  return knowledgeStore.workspaceTagsMap
})

const selectedTagCount = computed(() => {
  return uiStore.selectedTagFilters.length
})

const isAllTagsSelected = computed(() => {
  return availableTags.value.length > 0 && selectedTagCount.value === availableTags.value.length
})

const selectedPrimaryTags = computed<
  Array<{ name: string; icon?: string; color?: string; description?: string }>
>(() => {
  const wsMap = knowledgeStore.workspaceTagsMap
  if (!wsMap || isAllTagsSelected.value) return []
  const result: Array<{ name: string; icon?: string; color?: string; description?: string }> = []
  for (const tag of uiStore.selectedTagFilters) {
    const key = tag.toLowerCase().trim()
    const meta = wsMap[key] || wsMap[tag]
    if (meta) {
      result.push({
        name: meta.name || tag,
        icon: meta.icon,
        color: meta.color,
        description: meta.description,
      })
    }
  }
  return result
})

const conceptStatusText = computed(() => {
  if (uiStore.isAllConceptsSelected) {
    return 'Concepts All'
  }
  return `${selectedConceptCount.value} Concepts`
})

const tagStatusText = computed(() => {
  if (isAllTagsSelected.value) {
    return 'Tags All'
  }
  if (selectedPrimaryTags.value.length > 0) {
    return 'Tags some'
  }
  return `${selectedTagCount.value} Tags`
})

const searchContainerRef = ref<HTMLElement | null>(null)

const filePath = computed(() => {
  const node = rootNode.value
  if (!node?.source?.path) return ''
  return node.source.path
})

const formatVersion = computed(() => {
  const node = rootNode.value
  return (node?.fields?.format_version?.value ??
    node?.fields?.spec_version?.value ??
    DEFAULT_INNFO_VERSION) as string
})

const modelFileName = computed(() => {
  const path = filePath.value || ''
  if (!path) return 'model.md'
  return path.split('/').pop()?.split('\\').pop() || path
})

const specFileName = computed(() => {
  return `iNNfo_${formatVersion.value}_NN.md`
})

const modelVersion = computed(() => {
  const node = rootNode.value
  return (node?.fields?.version?.value ?? node?.fields?.knowledge_version?.value ?? '—') as string
})

const activeModelName = computed(() => {
  const node = rootNode.value
  if (!node) return ''
  return node.name || (node.fields?.title?.value as string) || 'Model'
})

const unsavedChanges = computed(() => knowledgeStore.dirtyIds.size > 0)
const shouldShowSave = computed(() => unsavedChanges.value || !workspaceStore.hasHandle)

// ── Save flow ───────────────────────────────────────────────────

async function handleSave(): Promise<void> {
  if (!hasRootNode.value) return
  if (!workspaceStore.hasHandle) {
    uiStore.setShowSaveWorkspaceModal(true)
    saveDropdownOpen.value = false
    return
  }
  try {
    await workspaceStore.saveActiveFile()
    saveDropdownOpen.value = false
  } catch (err) {
    bumpError.value = err instanceof Error ? err.message : 'Save failed'
  }
}

async function handleReload(): Promise<void> {
  if (workspaceStore.isParsing) return
  if (knowledgeStore.dirtyIds.size > 0) {
    const ok = confirm(
      'Tenés cambios sin guardar. Al recargar desde el archivo se van a perder.\n¿Estás seguro?',
    )
    if (!ok) return
  }
  try {
    await workspaceStore.reloadWorkspace()
    show('Modelo recargado desde el archivo.', 'success')
  } catch (err) {
    show(err instanceof Error ? err.message : 'Error al recargar', 'error')
  }
}

async function bumpVersion(level: 'major' | 'minor' | 'patch'): Promise<void> {
  bumpError.value = ''
  if (!hasRootNode.value) return
  if (!workspaceStore.hasHandle) {
    uiStore.setShowSaveWorkspaceModal(true)
    saveDropdownOpen.value = false
    return
  }
  try {
    await workspaceStore.saveActiveFileWithVersionBump(level, rootNode.value?.id)
    saveDropdownOpen.value = false
  } catch (err) {
    bumpError.value = err instanceof Error ? err.message : 'Version bump failed'
  }
}

// ── Dropdown ────────────────────────────────────────────────────

function toggleSaveDropdown(): void {
  bumpError.value = ''
  saveDropdownOpen.value = !saveDropdownOpen.value
}

function closeDropdown(e: MouseEvent): void {
  if (saveDropdownRef.value && !saveDropdownRef.value.contains(e.target as Node)) {
    saveDropdownOpen.value = false
  }
  if (
    uiStore.isSearchOpen &&
    searchContainerRef.value &&
    !searchContainerRef.value.contains(e.target as Node)
  ) {
    uiStore.setSearchOpen(false)
  }
}

onMounted(() => {
  window.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  if (blinkTimer) clearTimeout(blinkTimer)
  window.removeEventListener('click', closeDropdown)
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes scale-in {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-scale-in {
  animation: scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes header-blink {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.3;
    transform: scale(1.12);
  }
}

.animate-header-blink {
  animation: header-blink 0.8s ease-in-out infinite;
}
</style>
