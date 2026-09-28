import type { Component } from 'vue'
import TextWidget from './TextWidget.vue'
import WeightWidget from './WeightWidget.vue'
import CategoryWidget from './CategoryWidget.vue'
import FieldString from './FieldString.vue'
import FieldModel from './FieldModel.vue'
import FieldNumber from './FieldNumber.vue'
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
import InnovationVisual from './InnovationVisual.vue'
import { UNIFIED_WIDGET_REGISTRY } from './registry'

export { default as FallbackWidget } from './FallbackWidget.vue'
export {
  TextWidget,
  WeightWidget,
  CategoryWidget,
  FieldString,
  FieldModel,
  FieldNumber,
  FieldAsset,
  DateWidget,
  UrlWidget,
  ColorWidget,
  MultiSelectWidget,
  TagsWidget,
  RatingWidget,
  ScaleWidget,
  ToggleGroupWidget,
  CycleWidget,
  CodeWidget,
  MermaidWidget,
  DiagramWidget,
  TimestampWidget,
  MarkdownWidget,
  MarkdownFieldEditor,
  InnovationVisual,
}
export { UNIFIED_WIDGET_REGISTRY }
export type { WidgetType } from './registry'

/**
 * Resolves a widget type to its ported Vue component, or `undefined` if the
 * type has no registered widget (caller should render FallbackWidget).
 *
 * Reads from the UNIFIED_WIDGET_REGISTRY which merges concept-type widgets
 * (text, weight, category) with field-type widgets (string, boolean, number,
 * select, reference) and asset widgets (image, file, video, audio).
 */
export function resolveWidgetComponent(widgetType: string): Component | undefined {
  return UNIFIED_WIDGET_REGISTRY[widgetType]
}
