import { computed, ref } from 'vue'
import type { Point, Shape, ShapeGuideItemStyle } from '@/types'
import type { useCanvasStore } from '@/stores/canvas'
import type { useToolStore } from '@/stores/tool'
import { renderLatexLikeHtml, toTextGuideLatex } from '@/utils/latexText'

interface TextInputState {
  point: Point
  rawX: number
  rawY: number
}

interface PointLabelEditState {
  shapeId: string
  pointIndex: number
  rawX: number
  rawY: number
}

interface TextGuideEditState {
  guideId: string
  rawX: number
  rawY: number
}

interface UseCanvasTextEditingOptions {
  canvasStore: ReturnType<typeof useCanvasStore>
  toolStore: ReturnType<typeof useToolStore>
  defaultTextFontSize: number
  createTextGuide: (point: Point, text: string, useLatex?: boolean) => void
  getTextGuideAnchor: (guide: { points: Point[] }) => { x: number, y: number }
  getTextGuideFontSize: (guide: { fontSize?: number }) => number
  getTextGuideRotation: (guide: { rotation?: number }) => number
  isShapeGuideVisible: (shape: Shape, key: 'pointName') => boolean
  isShapeGuideItemVisible: (shape: Shape, key: 'pointName', index: number) => boolean
  isShapeGuideItemBlank: (shape: Shape, key: 'pointName', index: number) => boolean
  getShapePointNameTextPos: (shape: Shape, index: number) => { x: number, y: number }
  getShapeGuideItemStyle: (shape: Shape, key: 'pointName', index: number) => ShapeGuideItemStyle
}

export function useCanvasTextEditing(options: UseCanvasTextEditingOptions) {
  const {
    canvasStore,
    toolStore,
    defaultTextFontSize,
    createTextGuide,
    getTextGuideAnchor,
    getTextGuideFontSize,
    getTextGuideRotation,
    isShapeGuideVisible,
    isShapeGuideItemVisible,
    isShapeGuideItemBlank,
    getShapePointNameTextPos,
    getShapeGuideItemStyle,
  } = options

  const shapeMap = computed(() => new Map(canvasStore.shapes.map((shape) => [shape.id, shape])))

  const textInputState = ref<TextInputState | null>(null)
  const textInputValue = ref('')
  const textInputUseLatex = ref(false)
  const pointLabelEditState = ref<PointLabelEditState | null>(null)
  const pointLabelValue = ref('')
  const pointLabelUseLatex = ref(false)

  const textGuideEditState = ref<TextGuideEditState | null>(null)
  const textGuideValue = ref('')
  const textGuideUseLatex = ref(false)

  const pointLabels = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

  function getPointLabel(index: number): string {
    if (index < pointLabels.length) return pointLabels[index]
    return `점${index + 1}`
  }

  const globalPointLabelMap = computed(() => {
    const map: Record<string, string> = {}
    let globalIndex = 0
    for (const shape of canvasStore.shapes) {
      for (let pointIndex = 0; pointIndex < shape.points.length; pointIndex++) {
        map[`${shape.id}-${pointIndex}`] = getPointLabel(globalIndex)
        globalIndex++
      }
    }
    return map
  })

  function getGlobalPointLabel(shapeId: string, pointIndex: number): string {
    const shape = shapeMap.value.get(shapeId)
    const custom = shape?.pointLabels?.[pointIndex]
    if (custom) return custom
    return globalPointLabelMap.value[`${shapeId}-${pointIndex}`] ?? getPointLabel(pointIndex)
  }

  function openTextInput(point: Point, rawX: number, rawY: number) {
    textInputState.value = { point, rawX, rawY }
    textInputValue.value = ''
    textInputUseLatex.value = true
  }

  function confirmTextInput() {
    if (!textInputState.value) return
    createTextGuide(textInputState.value.point, textInputValue.value.trim() || 'A', true)
    textInputState.value = null
    textInputValue.value = ''
    textInputUseLatex.value = true
  }

  function cancelTextInput() {
    textInputState.value = null
    textInputValue.value = ''
    textInputUseLatex.value = true
  }

  function startTextGuideEdit(guideId: string) {
    const guide = canvasStore.guides.find((target) => target.id === guideId)
    if (!guide || guide.type !== 'text') return
    const anchor = getTextGuideAnchor(guide)
    textGuideEditState.value = {
      guideId,
      rawX: anchor.x + 6,
      rawY: anchor.y + 6
    }
    textGuideValue.value = guide.text || 'A'
    textGuideUseLatex.value = true
  }

  function confirmTextGuideEdit() {
    const state = textGuideEditState.value
    if (!state) return
    const value = textGuideValue.value.trim()
    canvasStore.updateGuide(state.guideId, (guide) => ({
      ...guide,
      text: value || 'A',
      useLatex: true
    }))
    textGuideEditState.value = null
    textGuideValue.value = ''
    textGuideUseLatex.value = true
  }

  function cancelTextGuideEdit() {
    textGuideEditState.value = null
    textGuideValue.value = ''
    textGuideUseLatex.value = true
  }

  function startPointLabelEdit(shape: Shape, pointIndex: number) {
    const point = shape.points[pointIndex]
    if (!point) return
    pointLabelEditState.value = {
      shapeId: shape.id,
      pointIndex,
      rawX: point.x + 6,
      rawY: point.y + 6
    }
    pointLabelValue.value = shape.pointLabels?.[pointIndex] ?? getGlobalPointLabel(shape.id, pointIndex)
    pointLabelUseLatex.value = true
  }

  function confirmPointLabelEdit() {
    const state = pointLabelEditState.value
    if (!state) return
    const value = pointLabelValue.value.trim()
    canvasStore.updateShape(state.shapeId, (shape) => {
      const nextLabels = [...(shape.pointLabels ?? [])]
      const nextLatex = [...(shape.pointLabelLatex ?? [])]
      nextLabels[state.pointIndex] = value || getGlobalPointLabel(shape.id, state.pointIndex)
      nextLatex[state.pointIndex] = true
      return {
        ...shape,
        pointLabels: nextLabels,
        pointLabelLatex: nextLatex
      }
    })
    pointLabelEditState.value = null
    pointLabelValue.value = ''
    pointLabelUseLatex.value = true
  }

  function cancelPointLabelEdit() {
    pointLabelEditState.value = null
    pointLabelValue.value = ''
    pointLabelUseLatex.value = true
  }

  function handlePointLabelDblClick(shape: Shape, pointIndex: number, e: { cancelBubble: boolean }) {
    e.cancelBubble = true
    startPointLabelEdit(shape, pointIndex)
  }

  function handleLatexPointOverlayDblClick(shapeId: string, pointIndex: number) {
    const shape = shapeMap.value.get(shapeId)
    if (!shape) return
    startPointLabelEdit(shape, pointIndex)
  }

  const latexPointLabelOverlays = computed(() => {
    if (!toolStore.showPointName) return []
    const overlays: Array<{
      key: string
      x: number
      y: number
      html: string
      shapeId: string
      pointIndex: number
      color: string
      fontSize: number
    }> = []
    for (const shape of canvasStore.shapes) {
      if (!isShapeGuideVisible(shape, 'pointName')) continue
      for (let i = 0; i < shape.points.length; i++) {
        if (!isShapeGuideItemVisible(shape, 'pointName', i)) continue
        if (isShapeGuideItemBlank(shape, 'pointName', i)) continue
        const textPos = getShapePointNameTextPos(shape, i)
        overlays.push({
          key: `${shape.id}-${i}`,
          x: textPos.x,
          y: textPos.y,
          html: renderLatexLikeHtml(getGlobalPointLabel(shape.id, i), !!shape.pointLabelLatex?.[i]),
          shapeId: shape.id,
          pointIndex: i,
          color: getShapeGuideItemStyle(shape, 'pointName', i).color || '#222',
          fontSize: getShapeGuideItemStyle(shape, 'pointName', i).fontSize || defaultTextFontSize
        })
      }
    }
    return overlays
  })

  const latexTextGuideOverlays = computed(() => {
    const overlays: Array<{
      key: string
      x: number
      y: number
      html: string
      guideId: string
      color: string
      fontSize: number
      rotation: number
      centerAlign: boolean
    }> = []
    for (const guide of canvasStore.guides) {
      if (guide.type !== 'text' || guide.visible === false) continue
      const anchor = getTextGuideAnchor(guide)
      overlays.push({
        key: guide.id,
        x: anchor.x,
        y: anchor.y,
        html: renderLatexLikeHtml(toTextGuideLatex(guide.text || '', !!guide.useLatex), !!guide.useLatex),
        guideId: guide.id,
        color: guide.color || '#231815',
        fontSize: getTextGuideFontSize(guide),
        rotation: getTextGuideRotation(guide),
        centerAlign: true
      })
    }
    return overlays
  })

  return {
    textInputState,
    textInputValue,
    textInputUseLatex,
    pointLabelEditState,
    pointLabelValue,
    pointLabelUseLatex,
    textGuideEditState,
    textGuideValue,
    textGuideUseLatex,
    openTextInput,
    confirmTextInput,
    cancelTextInput,
    startTextGuideEdit,
    confirmTextGuideEdit,
    cancelTextGuideEdit,
    startPointLabelEdit,
    confirmPointLabelEdit,
    cancelPointLabelEdit,
    handlePointLabelDblClick,
    handleLatexPointOverlayDblClick,
    getGlobalPointLabel,
    latexPointLabelOverlays,
    latexTextGuideOverlays,
  }
}
