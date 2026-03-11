<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import katex from 'katex'

interface PositionedState {
  rawX: number
  rawY: number
}

const props = defineProps<{
  zoomScale: number
  viewportOffset: { x: number, y: number }
  textInputState: PositionedState | null
  textInputValue: string
  textInputUseLatex: boolean
  pointLabelEditState: PositionedState | null
  pointLabelValue: string
  pointLabelUseLatex: boolean
  textGuideEditState: PositionedState | null
  textGuideValue: string
  textGuideUseLatex: boolean
}>()

const emit = defineEmits<{
  'update:textInputValue': [value: string]
  'update:textInputUseLatex': [value: boolean]
  'update:pointLabelValue': [value: string]
  'update:pointLabelUseLatex': [value: boolean]
  'update:textGuideValue': [value: string]
  'update:textGuideUseLatex': [value: boolean]
  confirmTextInput: []
  cancelTextInput: []
  confirmPointLabelEdit: []
  cancelPointLabelEdit: []
  confirmTextGuideEdit: []
  cancelTextGuideEdit: []
}>()

const textInputRef = ref<HTMLInputElement | null>(null)
const textInputPanelRef = ref<HTMLElement | null>(null)
const pointLabelInputRef = ref<HTMLInputElement | null>(null)
const pointLabelPanelRef = ref<HTMLElement | null>(null)
const textGuideInputRef = ref<HTMLInputElement | null>(null)
const textGuidePanelRef = ref<HTMLElement | null>(null)

watch(() => props.textInputState, async (state) => {
  if (!state) return
  await nextTick()
  textInputRef.value?.focus()
}, { deep: true })

watch(() => props.pointLabelEditState, async (state) => {
  if (!state) return
  await nextTick()
  pointLabelInputRef.value?.focus()
  pointLabelInputRef.value?.select()
}, { deep: true })

watch(() => props.textGuideEditState, async (state) => {
  if (!state) return
  await nextTick()
  textGuideInputRef.value?.focus()
  textGuideInputRef.value?.select()
}, { deep: true })

function renderLatexHtml(input: string): string {
  return katex.renderToString(input || '', {
    throwOnError: false,
    displayMode: false
  })
}

const textInputPreviewHtml = computed(() =>
  props.textInputUseLatex && props.textInputValue.trim() ? renderLatexHtml(props.textInputValue) : ''
)
const pointLabelPreviewHtml = computed(() =>
  props.pointLabelUseLatex && props.pointLabelValue.trim() ? renderLatexHtml(props.pointLabelValue) : ''
)
const textGuidePreviewHtml = computed(() =>
  props.textGuideUseLatex && props.textGuideValue.trim() ? renderLatexHtml(props.textGuideValue) : ''
)

function handleTextInputBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (next && textInputPanelRef.value?.contains(next)) return
  emit('confirmTextInput')
}

function handlePointLabelInputBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (next && pointLabelPanelRef.value?.contains(next)) return
  emit('confirmPointLabelEdit')
}

function handleTextGuideInputBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (next && textGuidePanelRef.value?.contains(next)) return
  emit('confirmTextGuideEdit')
}
</script>

<template>
  <div
    v-if="props.textInputState"
    ref="textInputPanelRef"
    class="absolute z-20 bg-white/95 border border-orange-300 rounded-lg px-2 py-2 shadow max-w-[360px] min-w-[220px]"
    :style="{
      left: `${props.textInputState.rawX * props.zoomScale + props.viewportOffset.x}px`,
      top: `${props.textInputState.rawY * props.zoomScale + props.viewportOffset.y}px`
    }"
  >
    <input
      ref="textInputRef"
      :value="props.textInputValue"
      type="text"
      class="w-full border border-orange-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
      placeholder="텍스트"
      @input="emit('update:textInputValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter.prevent="emit('confirmTextInput')"
      @keydown.esc.prevent="emit('cancelTextInput')"
      @blur="handleTextInputBlur"
    />
    <label class="mt-2 flex items-center gap-1.5 text-xs text-gray-700">
      <input
        :checked="props.textInputUseLatex"
        type="checkbox"
        tabindex="0"
        @change="emit('update:textInputUseLatex', ($event.target as HTMLInputElement).checked)"
      >
      <span>LaTeX 사용</span>
    </label>
    <div v-if="textInputPreviewHtml" class="mt-1 text-[11px] text-gray-600">
      <span>미리보기:</span>
      <div class="mt-1 p-1.5 bg-gray-50 border border-gray-200 rounded overflow-x-auto whitespace-normal break-all" v-html="textInputPreviewHtml"></div>
    </div>
  </div>

  <div
    v-if="props.pointLabelEditState"
    ref="pointLabelPanelRef"
    class="absolute z-20 bg-white/95 border border-blue-300 rounded-lg px-2 py-2 shadow max-w-[320px] min-w-[200px]"
    :style="{
      left: `${props.pointLabelEditState.rawX * props.zoomScale + props.viewportOffset.x}px`,
      top: `${props.pointLabelEditState.rawY * props.zoomScale + props.viewportOffset.y}px`
    }"
  >
    <input
      ref="pointLabelInputRef"
      :value="props.pointLabelValue"
      type="text"
      class="w-full border border-blue-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
      placeholder="점 이름"
      @input="emit('update:pointLabelValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter.prevent="emit('confirmPointLabelEdit')"
      @keydown.esc.prevent="emit('cancelPointLabelEdit')"
      @blur="handlePointLabelInputBlur"
    />
    <label class="mt-2 flex items-center gap-1.5 text-xs text-gray-700">
      <input
        :checked="props.pointLabelUseLatex"
        type="checkbox"
        tabindex="0"
        @change="emit('update:pointLabelUseLatex', ($event.target as HTMLInputElement).checked)"
      >
      <span>LaTeX 사용</span>
    </label>
    <div v-if="pointLabelPreviewHtml" class="mt-1 text-[11px] text-gray-600">
      <span>미리보기:</span>
      <div class="mt-1 p-1.5 bg-gray-50 border border-gray-200 rounded overflow-x-auto whitespace-normal break-all" v-html="pointLabelPreviewHtml"></div>
    </div>
  </div>

  <div
    v-if="props.textGuideEditState"
    ref="textGuidePanelRef"
    class="absolute z-20 bg-white/95 border border-orange-300 rounded-lg px-2 py-2 shadow max-w-[360px] min-w-[220px]"
    :style="{
      left: `${props.textGuideEditState.rawX * props.zoomScale + props.viewportOffset.x}px`,
      top: `${props.textGuideEditState.rawY * props.zoomScale + props.viewportOffset.y}px`
    }"
  >
    <input
      ref="textGuideInputRef"
      :value="props.textGuideValue"
      type="text"
      class="w-full border border-orange-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
      placeholder="텍스트"
      @input="emit('update:textGuideValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter.prevent="emit('confirmTextGuideEdit')"
      @keydown.esc.prevent="emit('cancelTextGuideEdit')"
      @blur="handleTextGuideInputBlur"
    />
    <label class="mt-2 flex items-center gap-1.5 text-xs text-gray-700">
      <input
        :checked="props.textGuideUseLatex"
        type="checkbox"
        tabindex="0"
        @change="emit('update:textGuideUseLatex', ($event.target as HTMLInputElement).checked)"
      >
      <span>LaTeX 사용</span>
    </label>
    <div v-if="textGuidePreviewHtml" class="mt-1 text-[11px] text-gray-600">
      <span>미리보기:</span>
      <div class="mt-1 p-1.5 bg-gray-50 border border-gray-200 rounded overflow-x-auto whitespace-normal break-all" v-html="textGuidePreviewHtml"></div>
    </div>
  </div>
</template>
