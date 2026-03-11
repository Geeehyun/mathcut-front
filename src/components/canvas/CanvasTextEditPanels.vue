<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { renderLatexLikeHtml } from '@/utils/latexText'

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
  shapeGuideValueEditState: PositionedState | null
  shapeGuideValue: string
  shapeGuideValueLabel: string
  shapeGuideApplyToGeometry: boolean
}>()

const emit = defineEmits<{
  'update:textInputValue': [value: string]
  'update:textInputUseLatex': [value: boolean]
  'update:pointLabelValue': [value: string]
  'update:pointLabelUseLatex': [value: boolean]
  'update:textGuideValue': [value: string]
  'update:textGuideUseLatex': [value: boolean]
  'update:shapeGuideValue': [value: string]
  'update:shapeGuideApplyToGeometry': [value: boolean]
  confirmTextInput: []
  cancelTextInput: []
  confirmPointLabelEdit: []
  cancelPointLabelEdit: []
  confirmTextGuideEdit: []
  cancelTextGuideEdit: []
  confirmShapeGuideValueEdit: []
  cancelShapeGuideValueEdit: []
  resetShapeGuideValueEdit: []
}>()

const textInputRef = ref<HTMLInputElement | null>(null)
const textInputPanelRef = ref<HTMLElement | null>(null)
const pointLabelInputRef = ref<HTMLInputElement | null>(null)
const pointLabelPanelRef = ref<HTMLElement | null>(null)
const textGuideInputRef = ref<HTMLInputElement | null>(null)
const textGuidePanelRef = ref<HTMLElement | null>(null)
const shapeGuideValueInputRef = ref<HTMLInputElement | null>(null)
const shapeGuideValuePanelRef = ref<HTMLElement | null>(null)

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

watch(() => props.shapeGuideValueEditState, async (state) => {
  if (!state) return
  await nextTick()
  shapeGuideValueInputRef.value?.focus()
  shapeGuideValueInputRef.value?.select()
}, { deep: true })

const textInputPreviewHtml = computed(() =>
  props.textInputValue.trim() ? renderLatexLikeHtml(props.textInputValue, true) : ''
)
const pointLabelPreviewHtml = computed(() =>
  props.pointLabelValue.trim() ? renderLatexLikeHtml(props.pointLabelValue, true) : ''
)
const textGuidePreviewHtml = computed(() =>
  props.textGuideValue.trim() ? renderLatexLikeHtml(props.textGuideValue, true) : ''
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

function handleShapeGuideValueInputBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (next && shapeGuideValuePanelRef.value?.contains(next)) return
  emit('confirmShapeGuideValueEdit')
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
    <p class="mt-2 text-xs text-gray-600">LaTeX 문법 사용 가능. 일반 텍스트도 그대로 입력할 수 있습니다.</p>
    <div class="mt-1 text-[11px] text-gray-600">
      <span>미리보기:</span>
      <div class="mt-1 min-h-[36px] p-1.5 bg-gray-50 border border-gray-200 rounded overflow-x-auto whitespace-normal break-all" v-html="textInputPreviewHtml"></div>
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
    <p class="mt-2 text-xs text-gray-600">LaTeX 문법 사용 가능. 일반 텍스트도 그대로 입력할 수 있습니다.</p>
    <div class="mt-1 text-[11px] text-gray-600">
      <span>미리보기:</span>
      <div class="mt-1 min-h-[36px] p-1.5 bg-gray-50 border border-gray-200 rounded overflow-x-auto whitespace-normal break-all" v-html="pointLabelPreviewHtml"></div>
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
    <p class="mt-2 text-xs text-gray-600">LaTeX 문법 사용 가능. 일반 텍스트도 그대로 입력할 수 있습니다.</p>
    <div class="mt-1 text-[11px] text-gray-600">
      <span>미리보기:</span>
      <div class="mt-1 min-h-[36px] p-1.5 bg-gray-50 border border-gray-200 rounded overflow-x-auto whitespace-normal break-all" v-html="textGuidePreviewHtml"></div>
    </div>
  </div>

  <div
    v-if="props.shapeGuideValueEditState"
    ref="shapeGuideValuePanelRef"
    class="absolute z-20 bg-white/95 border border-emerald-300 rounded-lg px-2 py-2 shadow max-w-[240px] min-w-[180px]"
    :style="{
      left: `${props.shapeGuideValueEditState.rawX * props.zoomScale + props.viewportOffset.x}px`,
      top: `${props.shapeGuideValueEditState.rawY * props.zoomScale + props.viewportOffset.y}px`
    }"
  >
    <div class="flex items-center gap-2">
      <input
        ref="shapeGuideValueInputRef"
        :value="props.shapeGuideValue"
        type="text"
        inputmode="decimal"
        class="min-w-0 flex-1 border border-emerald-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
        :placeholder="`${props.shapeGuideValueLabel} 값`"
        @input="emit('update:shapeGuideValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('confirmShapeGuideValueEdit')"
        @keydown.esc.prevent="emit('cancelShapeGuideValueEdit')"
        @blur="handleShapeGuideValueInputBlur"
      />
      <button
        type="button"
        class="shrink-0 rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700 transition hover:bg-emerald-50"
        @mousedown.prevent
        @click="emit('resetShapeGuideValueEdit')"
      >
        초기화
      </button>
    </div>
    <p class="mt-2 text-xs text-gray-600">숫자만 입력하면 도형이 함께 조정됩니다.</p>
    <label class="mt-2 flex items-center gap-1.5 text-xs text-gray-700">
      <input
        :checked="props.shapeGuideApplyToGeometry"
        type="checkbox"
        tabindex="0"
        @change="emit('update:shapeGuideApplyToGeometry', ($event.target as HTMLInputElement).checked)"
      >
      <span>수정된 수치로 도형 사이즈 함께 조정</span>
    </label>
  </div>
</template>
