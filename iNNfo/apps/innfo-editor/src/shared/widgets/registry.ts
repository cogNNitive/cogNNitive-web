import type { Component } from 'vue'
import TextWidget from './TextWidget.vue'
import WeightWidget from './WeightWidget.vue'
import CategoryWidget from './CategoryWidget.vue'
import FieldString from './FieldString.vue'
import FieldBoolean from './FieldBoolean.vue'
import FieldNumber from './FieldNumber.vue'
import FieldSelect from './FieldSelect.vue'
import FieldReference from './FieldReference.vue'
import FieldKnowledge from './FieldKnowledge.vue'
import FieldAsset from './FieldAsset.vue'
import DateWidget from './DateWidget.vue'
import UrlWidget from './UrlWidget.vue'
import ColorWidget from './ColorWidget.vue'
import MultiSelectWidget from './MultiSelectWidget.vue'
import TagsWidget from './TagsWidget.vue'
import RatingWidget from './RatingWidget.vue'
import ScaleWidget from './ScaleWidget.vue'
import ToggleGroupWidget from './ToggleGroupWidget.vue'
import CycleWidget from './CycleWidget.vue'
import CodeWidget from './CodeWidget.vue'
import MermaidWidget from './MermaidWidget.vue'
import DiagramWidget from './DiagramWidget.vue'
import TimestampWidget from './TimestampWidget.vue'
import MarkdownWidget from './MarkdownWidget.vue'
import MarkdownFieldEditor from './MarkdownFieldEditor.vue'

/**
 * All supported widget type identifiers.
 * Merges concept-type keys (text, weight, category) with field-type keys
 * (string, boolean, number, select, reference) and asset types
 * (image, file, video, audio) and legacy-port widgets
 * (date, url, color, multiselect, tags, rating, scale, togglegroup,
 *  cycle, code, mermaid, diagram, timestamp, markdown).
 */
export type WidgetType =
  | 'text'
  | 'weight'
  | 'category'
  | 'string'
  | 'boolean'
  | 'number'
  | 'select'
  | 'reference'
  | 'model'
  | 'image'
  | 'file'
  | 'video'
  | 'audio'
  | 'date'
  | 'url'
  | 'color'
  | 'multiselect'
  | 'tags'
  | 'rating'
  | 'scale'
  | 'togglegroup'
  | 'cycle'
  | 'code'
  | 'mermaid'
  | 'diagram'
  | 'timestamp'
  | 'markdown'
  | 'markdown_inline'
  | 'markdown_file'

/**
 * UNIFIED_WIDGET_REGISTRY merges concept-type widgets (from format-editor's
 * original registry) with field-type widgets (ported from file-format).
 *
 * Dispatch key resolution:
 *   - Field-level:  field.type from the concept's fields[] array
 *   - Concept-level: concept.type from the concept declaration
 *
 * Any type not present in this registry will render FallbackWidget
 * (read-only display of raw value + type badge).
 */
export const UNIFIED_WIDGET_REGISTRY: Record<string, Component> = {
  // concept-type widgets (from format-editor)
  text: TextWidget,
  weight: WeightWidget,
  category: CategoryWidget,
  // field-type widgets (ported from file-format, v-model contract)
  string: FieldString,
  boolean: FieldBoolean,
  number: FieldNumber,
  select: FieldSelect,
  reference: FieldReference,
  model: FieldKnowledge,
  // asset field-type widgets (FR-003)
  image: FieldAsset,
  image_url: FieldAsset,
  asset: FieldAsset,
  file: FieldAsset,
  video: FieldAsset,
  audio: FieldAsset,
  // legacy-port widgets (Phase C — widgets 1-14)
  date: DateWidget,
  url: UrlWidget,
  color: ColorWidget,
  multiselect: MultiSelectWidget,
  tags: TagsWidget,
  rating: RatingWidget,
  scale: ScaleWidget,
  togglegroup: ToggleGroupWidget,
  cycle: CycleWidget,
  code: CodeWidget,
  mermaid: MermaidWidget,
  diagram: DiagramWidget,
  timestamp: TimestampWidget,
  markdown: MarkdownWidget,
  // dual-mode markdown fields: inline vs file
  markdown_inline: MarkdownFieldEditor,
  markdown_file: MarkdownFieldEditor,
}
