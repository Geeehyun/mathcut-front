<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useToolStore } from '@/stores/tool'
import { GRID_CONFIG, STYLE_COLORS, type Point } from '@/types'
import { FILL_NONE, FILL_PALETTE, STROKE_PALETTE, cmykTooltip } from '@/constants/colorPalette'
import { generateId } from '@/utils/geometry'

const props = defineProps<{
  x: number
  y: number
  target:
    | { kind: 'shape', shapeId: string }
    | { kind: 'guide', guideId: string }
    | { kind: 'shape-guide-item', shapeId: string, guideKey: 'length' | 'angle' | 'pointName' | 'height', itemIndex: number }
    | null
}>()

const emit = defineEmits<{
  close: []
}>()

const canvasStore = useCanvasStore()
const toolStore = useToolStore()
const menuRef = ref<HTMLElement | null>(null)
const expandedColorPanel = ref(false)
const expandedGuidePanel = ref(false)
const guideFontSizeDraft = ref(11)
const guideLineWidthDraft = ref(0.4)
const viewportPos = ref({ x: 0, y: 0 })
const DEFAULT_FILLED_STROKE_PT = 0.4
const DEFAULT_UNFILLED_STROKE_PT = 0.6
const STROKE_WIDTH_STEP_PT = 0.1
const STROKE_WIDTH_MIN_PT = 0.1
const STROKE_WIDTH_MAX_PT = 12
const GUIDE_LINE_WIDTH_STEP = 0.1
const GUIDE_LINE_WIDTH_MIN = 0.1
const GUIDE_LINE_WIDTH_MAX = 12
const GUIDE_LINE_WIDTH_DEFAULT = 0.4
const BLANK_WIDTH_STEP_MM = 0.5
const BLANK_WIDTH_MIN_MM = 3
const BLANK_WIDTH_MAX_MM = 50
const BLANK_WIDTH_DEFAULT_MM = 7
const LENGTH_CURVE_OFFSET_PX = 24

function updateViewportPosition() {
  const margin = 8
  const node = menuRef.value
  const menuWidth = node?.offsetWidth ?? 260
  const menuHeight = node?.offsetHeight ?? 320
  const vw = window.innerWidth
  const vh = window.innerHeight
  const x = Math.max(margin, Math.min(props.x, vw - menuWidth - margin))
  const y = Math.max(margin, Math.min(props.y, vh - menuHeight - margin))
  viewportPos.value = { x, y }
}

const menuStyle = computed(() => ({
  left: `${viewportPos.value.x}px`,
  top: `${viewportPos.value.y}px`
}))

const targetShape = computed(() => {
  const target = props.target
  if (!target) return null
  if (target.kind === 'shape' || target.kind === 'shape-guide-item') {
    return canvasStore.shapes.find((s) => s.id === target.shapeId) ?? null
  }
  return null
})

const targetGuide = computed(() => {
  const target = props.target
  if (!target || target.kind !== 'guide') return null
  return canvasStore.guides.find((g) => g.id === target.guideId) ?? null
})

const isShapeTarget = computed(() => props.target?.kind === 'shape')
const isGuideTarget = computed(() => props.target?.kind === 'guide')
const isShapeGuideItemTarget = computed(() => props.target?.kind === 'shape-guide-item')
const isStandalonePointTarget = computed(() => targetShape.value?.type === 'point' || targetShape.value?.type === 'point-on-object')
const isArrowTarget = computed(() => targetShape.value?.type === 'arrow' || targetShape.value?.type === 'arrow-curve')
const isLineTarget = computed(() => {
  const type = targetShape.value?.type
  return type === 'segment' || type === 'ray' || type === 'line'
})
const isAngleLineTarget = computed(() => targetShape.value?.type === 'angle-line')

const shapeTypeNames: Record<string, string> = {
  rectangle: '사각형',
  triangle: '삼각형',
  circle: '원',
  polygon: '다각형',
  point: '점',
  'point-on-object': '대상 위의 점',
  segment: '선분',
  ray: '반직선',
  line: '직선',
  'angle-line': '각도',
  'triangle-equilateral': '정삼각형',
  'triangle-right': '직각삼각형',
  'triangle-isosceles': '이등변삼각형',
  'triangle-free': '자유 삼각형',
  'rect-square': '정사각형',
  'rect-rectangle': '직사각형',
  'rect-trapezoid': '사다리꼴',
  'rect-rhombus': '마름모',
  'rect-parallelogram': '평행사변형',
  'rect-free': '자유 사각형',
  'polygon-regular': '정다각형',
  'free-shape': '자유 도형',
  arrow: '화살표(직선)',
  'arrow-curve': '화살표(곡선)',
  counter: '카운터'
}

const pointLabels = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
function getPointLabel(index: number): string {
  return pointLabels[index] ?? `점${index + 1}`
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

function getShapePointLabel(shapeId: string, pointIndex: number): string {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  const custom = shape?.pointLabels?.[pointIndex]
  if (custom) return custom
  return globalPointLabelMap.value[`${shapeId}-${pointIndex}`] ?? getPointLabel(pointIndex)
}

function getShapePointTuple(shapeId: string): string {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape) return ''
  return shape.points.map((_, i) => getShapePointLabel(shapeId, i)).join(',')
}

function getShapeDisplayName(shapeId: string): string {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape) return ''
  const baseName = shapeTypeNames[shape.type] ?? shape.type
  return `${baseName}(${getShapePointTuple(shapeId)})`
}

function getLengthPair(shapeId: string, edgeIndex: number): string {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape || shape.points.length === 0) return ''
  const from = getShapePointLabel(shapeId, edgeIndex)
  const to = getShapePointLabel(shapeId, (edgeIndex + 1) % shape.points.length)
  return `${from},${to}`
}

function getAngleTriple(shapeId: string, vertexIndex: number): string {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape || shape.points.length === 0) return ''
  const n = shape.points.length
  const prev = getShapePointLabel(shapeId, (vertexIndex - 1 + n) % n)
  const cur = getShapePointLabel(shapeId, vertexIndex)
  const next = getShapePointLabel(shapeId, (vertexIndex + 1) % n)
  return `${prev},${cur},${next}`
}

const targetShapeLabel = computed(() => {
  if (!targetShape.value) return ''
  return getShapeDisplayName(targetShape.value.id)
})

const targetGuideLabel = computed(() => {
  if (targetGuide.value) {
    return targetGuide.value.type === 'length'
      ? '길이 가이드'
      : targetGuide.value.type === 'text'
        ? '텍스트 가이드'
        : '각도 가이드'
  }
  if (props.target?.kind === 'shape-guide-item') {
    const target = props.target
    const shape = canvasStore.shapes.find((s) => s.id === target.shapeId)
    if (target.guideKey === 'pointName') {
      return `점(${getShapePointLabel(target.shapeId, target.itemIndex)})`
    }
    if (target.guideKey === 'length') {
      if (shape?.type === 'circle') {
        const koMeasureLabel = shape.circleMeasureMode === 'diameter' ? '지름' : '반지름'
        const center = getShapePointLabel(target.shapeId, 0)
        const edge = getShapePointLabel(target.shapeId, 1)
        const opposite = getShapePointLabel(target.shapeId, 2)
        if (shape.circleMeasureMode === 'diameter') {
          return `${koMeasureLabel}(${center},${edge},${opposite})`
        }
        return `${koMeasureLabel}(${center},${edge})`
      }
      return `길이(${getLengthPair(target.shapeId, target.itemIndex)})`
    }
    if (target.guideKey === 'height') {
      return '높이'
    }
    return `각도(${getAngleTriple(target.shapeId, target.itemIndex)})`
  }
  return ''
})


const canUndo = computed(() => canvasStore.canUndo)
const canRedo = computed(() => canvasStore.canRedo)

const selectedStroke = computed(() => {
  if (!targetShape.value) return '#231815'
  if (targetShape.value.color?.stroke) return targetShape.value.color.stroke
  const preset = STYLE_COLORS[targetShape.value.style]
  return preset?.stroke ?? STYLE_COLORS.default.stroke
})

const selectedFill = computed(() => {
  if (!targetShape.value) return FILL_NONE
  if (targetShape.value.color?.fill) return targetShape.value.color.fill
  const preset = STYLE_COLORS[targetShape.value.style]
  return preset?.fill ?? STYLE_COLORS.default.fill
})

const selectedPoint = computed(() => {
  if (!targetShape.value) return '#231815'
  if (targetShape.value.color?.point) return targetShape.value.color.point
  if (targetShape.value.color?.stroke && targetShape.value.color.stroke !== 'none') return targetShape.value.color.stroke
  const preset = STYLE_COLORS[targetShape.value.style]
  return preset?.point ?? STYLE_COLORS.default.point
})

function getDefaultStrokeWidthPt(): number {
  if (!targetShape.value) return DEFAULT_UNFILLED_STROKE_PT
  const isOpen = ['segment', 'ray', 'line', 'angle-line', 'arrow', 'arrow-curve'].includes(targetShape.value.type)
  const isFilled = !isOpen && targetShape.value.color?.fill !== FILL_NONE
  return isFilled ? DEFAULT_FILLED_STROKE_PT : DEFAULT_UNFILLED_STROKE_PT
}

const selectedStrokeWidthPt = computed(() => {
  const raw = typeof targetShape.value?.strokeWidthPt === 'number'
    ? targetShape.value.strokeWidthPt
    : getDefaultStrokeWidthPt()
  return Number(raw.toFixed(1))
})

const shapeGuideVisibility = computed(() => ({
  length: targetShape.value?.type === 'circle' || targetShape.value?.type === 'arrow' || targetShape.value?.type === 'arrow-curve' || targetShape.value?.type === 'angle-line'
    ? false
    : targetShape.value?.guideVisibility?.length !== false,
  radius: targetShape.value?.type === 'circle'
    ? targetShape.value?.guideVisibility?.radius !== false
    : false,
  angle: targetShape.value?.guideVisibility?.angle !== false,
  pointName: targetShape.value?.guideVisibility?.pointName !== false,
  point: typeof targetShape.value?.guideVisibility?.point === 'boolean'
    ? targetShape.value?.guideVisibility?.point === true
    : (
      targetShape.value?.type === 'point'
      || targetShape.value?.type === 'point-on-object'
      || targetShape.value?.type === 'segment'
      || targetShape.value?.type === 'ray'
      || targetShape.value?.type === 'line'
      || targetShape.value?.type === 'angle-line'
      || targetShape.value?.type === 'circle'
    ),
  height: typeof targetShape.value?.guideVisibility?.height === 'boolean'
    ? targetShape.value?.guideVisibility?.height === true
    : (
      targetShape.value?.type === 'triangle'
      || targetShape.value?.type === 'triangle-free'
      || targetShape.value?.type === 'triangle-equilateral'
      || targetShape.value?.type === 'triangle-isosceles'
      || targetShape.value?.type === 'rect-trapezoid'
      || targetShape.value?.type === 'rect-rhombus'
      || targetShape.value?.type === 'rect-parallelogram'
    )
}))

const isHeightGuideToggleVisible = computed(() => {
  if (!targetShape.value) return false
  return targetShape.value.type !== 'circle' && targetShape.value.type !== 'segment' && targetShape.value.type !== 'triangle-right'
})

const openShapeTypes = new Set(['segment', 'ray', 'line', 'angle-line', 'arrow', 'arrow-curve'])

const isHeightBaseConfigurable = computed(() => {
  if (!targetShape.value) return false
  return targetShape.value.type !== 'circle'
    && targetShape.value.type !== 'triangle-right'
    && !openShapeTypes.has(targetShape.value.type)
    && targetShape.value.points.length >= 3
})

function getShapeBottomBaseEdgeIndex(shapeId: string): number {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape || shape.points.length < 2) return 0
  const n = shape.points.length
  let bestIndex = 0
  let bestAvgY = -Infinity
  for (let i = 0; i < n; i++) {
    const p1 = shape.points[i]
    const p2 = shape.points[(i + 1) % n]
    const avgY = (p1.y + p2.y) / 2
    if (avgY > bestAvgY) {
      bestAvgY = avgY
      bestIndex = i
    }
  }
  return bestIndex
}

function getShapeHeightBaseEdgeIndex(shapeId: string): number {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape || shape.points.length < 2) return 0
  const custom = Number(shape.heightBaseEdgeIndex)
  if (Number.isInteger(custom) && custom >= 0 && custom < shape.points.length) return custom
  return getShapeBottomBaseEdgeIndex(shapeId)
}

const heightBaseLabel = computed(() => {
  if (!targetShape.value || !isHeightBaseConfigurable.value) return ''
  const idx = getShapeHeightBaseEdgeIndex(targetShape.value.id)
  return getLengthPair(targetShape.value.id, idx)
})

const selectedCircleMeasureMode = computed(() => {
  if (!targetShape.value || targetShape.value.type !== 'circle') return 'radius'
  return targetShape.value.circleMeasureMode === 'diameter' ? 'diameter' : 'radius'
})

function setCircleMeasureMode(mode: 'radius' | 'diameter') {
  if (!targetShape.value || targetShape.value.type !== 'circle') return
  canvasStore.updateShape(targetShape.value.id, (shape) => ({
    ...shape,
    circleMeasureMode: mode
  }))
}

function closeMenu() {
  emit('close')
}

function toPoint(x: number, y: number): Point {
  return {
    x,
    y,
    gridX: x / GRID_CONFIG.size,
    gridY: y / GRID_CONFIG.size
  }
}

function duplicateShape() {
  if (!targetShape.value) return
  const duplicated = {
    ...targetShape.value,
    id: generateId(),
    points: targetShape.value.points.map((p) => toPoint(p.x + GRID_CONFIG.size, p.y + GRID_CONFIG.size))
  }
  canvasStore.addShape(duplicated)
  closeMenu()
}

function deleteShape() {
  if (!targetShape.value) return
  canvasStore.removeShape(targetShape.value.id)
  closeMenu()
}

function reorder(direction: 'up' | 'down' | 'front' | 'back') {
  if (!targetShape.value) return
  canvasStore.reorderShape(targetShape.value.id, direction)
  closeMenu()
}

function updateColor(partial: { stroke?: string, fill?: string, point?: string }) {
  if (!targetShape.value) return
  canvasStore.setShapeColor(targetShape.value.id, {
    stroke: partial.stroke ?? selectedStroke.value,
    fill: partial.fill ?? selectedFill.value,
    point: partial.point ?? selectedPoint.value
  })
}

function setShapeStrokeWidthPt(widthPt: number) {
  if (!targetShape.value) return
  const clamped = Number(Math.max(STROKE_WIDTH_MIN_PT, Math.min(STROKE_WIDTH_MAX_PT, widthPt)).toFixed(1))
  canvasStore.updateShape(targetShape.value.id, (shape) => ({
    ...shape,
    strokeWidthPt: clamped
  }))
}

function setShapeGuideVisible(key: 'length' | 'radius' | 'angle' | 'pointName' | 'height' | 'point', visible: boolean) {
  if (!targetShape.value) return
  canvasStore.updateShape(targetShape.value.id, (shape) => {
    const nextVisibility = { ...(shape.guideVisibility || {}), [key]: visible }
    if (visible) {
      if (key === 'length' || key === 'radius') {
        nextVisibility.lengthHiddenIndices = []
      } else if (key === 'angle') {
        nextVisibility.angleHiddenIndices = []
      } else if (key === 'pointName') {
        nextVisibility.pointNameHiddenIndices = []
      } else if (key === 'height') {
        nextVisibility.heightHiddenIndices = []
      }
    }
    return {
      ...shape,
      guideVisibility: nextVisibility
    }
  })
}

function cycleHeightBaseEdge(step: -1 | 1) {
  if (!targetShape.value || !isHeightBaseConfigurable.value) return
  const n = targetShape.value.points.length
  const current = getShapeHeightBaseEdgeIndex(targetShape.value.id)
  const next = (current + step + n) % n
  canvasStore.updateShape(targetShape.value.id, (shape) => ({
    ...shape,
    heightBaseEdgeIndex: next,
    guideVisibility: {
      ...(shape.guideVisibility || {}),
      height: true
    }
  }))
}

function setGuideVisible(visible: boolean) {
  if (!targetGuide.value) return
  canvasStore.setGuideVisible(targetGuide.value.id, visible)
}

function setGuideColor(color: string) {
  if (!targetGuide.value) return
  canvasStore.updateGuide(targetGuide.value.id, (guide) => ({ ...guide, color }))
}

function setGuideFontSize(fontSize: number) {
  if (!targetGuide.value) return
  canvasStore.updateGuide(targetGuide.value.id, (guide) => ({ ...guide, fontSize: Math.max(8, Math.min(72, fontSize)) }))
}

function setGuideLineWidth(lineWidth: number) {
  if (!targetGuide.value) return
  const clamped = Number(Math.max(GUIDE_LINE_WIDTH_MIN, Math.min(GUIDE_LINE_WIDTH_MAX, lineWidth)).toFixed(1))
  canvasStore.updateGuide(targetGuide.value.id, (guide) => ({ ...guide, lineWidth: clamped }))
}

function removeGuide() {
  if (!targetGuide.value) return
  canvasStore.removeGuide(targetGuide.value.id)
  closeMenu()
}

function getShapeGuideItemStyle() {
  if (!targetShape.value || props.target?.kind !== 'shape-guide-item') return {}
  return targetShape.value.guideStyleMap?.[props.target.guideKey]?.[props.target.itemIndex] || {}
}

function isShapeGuideItemBlank() {
  return (getShapeGuideItemStyle() as any).textMode === 'blank'
}

function isShapeGuideItemVisible() {
  if (!targetShape.value || props.target?.kind !== 'shape-guide-item') return true
  const v = targetShape.value.guideVisibility
  if (props.target.guideKey === 'length') return !v?.lengthHiddenIndices?.includes(props.target.itemIndex)
  if (props.target.guideKey === 'angle') return !v?.angleHiddenIndices?.includes(props.target.itemIndex)
  if (props.target.guideKey === 'height') return !v?.heightHiddenIndices?.includes(props.target.itemIndex)
  return !v?.pointNameHiddenIndices?.includes(props.target.itemIndex)
}

function patchShapeGuideItemStyle(patch: {
  color?: string
  textColor?: string
  lineColor?: string
  curveSide?: 1 | -1
  heightLineColor?: string
  measureLineColor?: string
  textMode?: 'normal' | 'blank'
  blankWidthMm?: number
  blankSizeMm?: number
  fontSize?: number
  lineWidth?: number
  heightLineWidth?: number
  measureLineWidth?: number
}) {
  if (!targetShape.value || props.target?.kind !== 'shape-guide-item') return
  const { guideKey, itemIndex } = props.target
  canvasStore.updateShape(targetShape.value.id, (shape) => {
    const map = { ...(shape.guideStyleMap || {}) }
    const byKey = { ...(map[guideKey] || {}) }
    const prev = { ...(byKey[itemIndex] || {}) }
    byKey[itemIndex] = { ...prev, ...patch }
    map[guideKey] = byKey
    return { ...shape, guideStyleMap: map }
  })
}

function getShapeGuideItemBlankSizeMm(): number {
  const style = getShapeGuideItemStyle() as any
  const raw = Number(style.blankWidthMm ?? style.blankSizeMm)
  if (!Number.isFinite(raw)) return BLANK_WIDTH_DEFAULT_MM
  const stepped = Math.round(raw / BLANK_WIDTH_STEP_MM) * BLANK_WIDTH_STEP_MM
  return Math.max(BLANK_WIDTH_MIN_MM, Math.min(BLANK_WIDTH_MAX_MM, stepped))
}

const shapeGuideItemKey = computed(() => props.target?.kind === 'shape-guide-item' ? props.target.guideKey : null)
const shapeGuideItemTypeLabel = computed(() => {
  if (shapeGuideItemKey.value === 'length') return '길이'
  if (shapeGuideItemKey.value === 'angle') return '각도'
  if (shapeGuideItemKey.value === 'pointName') return '점 이름'
  if (shapeGuideItemKey.value === 'height') return '높이'
  return ''
})

function toggleShapeGuideItemVisible() {
  if (!targetShape.value || props.target?.kind !== 'shape-guide-item') return
  const visible = isShapeGuideItemVisible()
  canvasStore.setShapeGuideItemVisible(
    targetShape.value.id,
    props.target.guideKey,
    props.target.itemIndex,
    !visible
  )
}

function toggleShapeGuideItemBlank() {
  if (!targetShape.value || props.target?.kind !== 'shape-guide-item') return
  patchShapeGuideItemStyle({ textMode: isShapeGuideItemBlank() ? 'normal' : 'blank' })
}

function getDefaultLengthCurveSide(shape: any, itemIndex: number): 1 | -1 {
  if (shape.type === 'circle') return 1
  const p1 = shape.points[itemIndex]
  const p2 = shape.points[(itemIndex + 1) % shape.points.length]
  if (!p1 || !p2) return 1
  const mx = (p1.x + p2.x) / 2
  const my = (p1.y + p2.y) / 2
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const a = { x: mx + nx * LENGTH_CURVE_OFFSET_PX, y: my + ny * LENGTH_CURVE_OFFSET_PX }
  const b = { x: mx - nx * LENGTH_CURVE_OFFSET_PX, y: my - ny * LENGTH_CURVE_OFFSET_PX }
  const center = shape.points.reduce((acc: any, p: any) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  center.x /= Math.max(1, shape.points.length)
  center.y /= Math.max(1, shape.points.length)
  const da = Math.hypot(a.x - center.x, a.y - center.y)
  const db = Math.hypot(b.x - center.x, b.y - center.y)
  return da >= db ? 1 : -1
}

function getCurrentGuideCurveSide(shape: any, guideKey: 'length' | 'height', itemIndex: number): 1 | -1 {
  const style = getShapeGuideItemStyle() as any
  if (style.curveSide === 1 || style.curveSide === -1) return style.curveSide
  if (guideKey === 'height') return 1
  return getDefaultLengthCurveSide(shape, itemIndex)
}

function toggleGuideCurveSide() {
  if (!targetShape.value || props.target?.kind !== 'shape-guide-item') return
  if (props.target.guideKey !== 'length' && props.target.guideKey !== 'height') return
  const guideKey = props.target.guideKey
  const style = getShapeGuideItemStyle() as any
  const current = style.curveSide === 1 || style.curveSide === -1
    ? style.curveSide
    : getCurrentGuideCurveSide(targetShape.value, guideKey, props.target.itemIndex)
  patchShapeGuideItemStyle({ curveSide: current === 1 ? -1 : 1 })
}

function selectAllShapes() {
  toolStore.setMode('select')
  const topShape = canvasStore.shapes[canvasStore.shapes.length - 1]
  canvasStore.selectShape(topShape?.id ?? null)
  closeMenu()
}

function handleUndo() {
  if (!canUndo.value) return
  canvasStore.undo()
  closeMenu()
}

function handleRedo() {
  if (!canRedo.value) return
  canvasStore.redo()
  closeMenu()
}

function clearAll() {
  canvasStore.clearAll()
  closeMenu()
}

function cycleGridMode() {
  toolStore.cycleGridMode()
  closeMenu()
}

function onWindowPointerDown(e: MouseEvent) {
  const node = menuRef.value
  if (!node) return
  if (e.target instanceof Node && !node.contains(e.target)) {
    closeMenu()
  }
}

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeMenu()
  }
}

function onWindowResizeOrScroll() {
  updateViewportPosition()
}

onMounted(() => {
  window.addEventListener('mousedown', onWindowPointerDown)
  window.addEventListener('keydown', onWindowKeydown)
  window.addEventListener('resize', onWindowResizeOrScroll)
  window.addEventListener('scroll', onWindowResizeOrScroll, true)
  nextTick(() => updateViewportPosition())
})

watch(targetGuide, (guide) => {
  guideFontSizeDraft.value = guide?.fontSize || 11
  guideLineWidthDraft.value = Number((guide?.lineWidth || GUIDE_LINE_WIDTH_DEFAULT).toFixed(1))
}, { immediate: true })

watch(
  () => [props.x, props.y, props.target, expandedColorPanel.value, expandedGuidePanel.value],
  () => nextTick(() => updateViewportPosition()),
  { deep: true }
)

onUnmounted(() => {
  window.removeEventListener('mousedown', onWindowPointerDown)
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('resize', onWindowResizeOrScroll)
  window.removeEventListener('scroll', onWindowResizeOrScroll, true)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuRef"
      class="fixed z-[9999] min-w-[220px] max-h-[calc(100vh-16px)] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200 p-1.5 text-sm"
      :style="menuStyle"
    >
      <template v-if="isShapeTarget">
        <div class="px-2.5 py-1 text-xs text-gray-500">
          도형 <span class="font-medium text-gray-700">{{ targetShapeLabel }}</span>
        </div>
        <div class="menu-sep"></div>

        <button class="menu-btn" @click="duplicateShape">복제</button>
        <button class="menu-btn text-red-600 hover:bg-red-50" @click="deleteShape">삭제</button>

        <div class="menu-sep"></div>

        <button class="menu-btn flex justify-between items-center" @click="expandedColorPanel = !expandedColorPanel">
          <span>색상 변경</span>
          <span class="text-xs text-gray-500">{{ expandedColorPanel ? '▼' : '▶' }}</span>
        </button>

        <div v-if="expandedColorPanel" class="px-2 py-2 space-y-2">
          <template v-if="isStandalonePointTarget">
            <div>
              <p class="text-xs text-gray-500 mb-1">점 색상</p>
              <div class="flex items-center flex-wrap gap-1.5">
                <button v-for="color in STROKE_PALETTE" :key="`point-${color.id}`" class="w-5 h-5 rounded-full border transition hover:scale-110" :class="selectedPoint === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="updateColor({ point: color.hex })"></button>
              </div>
            </div>
          </template>
          <template v-else-if="isArrowTarget">
            <div>
              <p class="text-xs text-gray-500 mb-1">선 색상</p>
              <div class="flex items-center flex-wrap gap-1.5">
                <button v-for="color in STROKE_PALETTE" :key="color.id" class="w-5 h-5 rounded-full border transition hover:scale-110" :class="selectedStroke === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="updateColor({ stroke: color.hex })"></button>
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">선 굵기 (pt)</p>
              <div class="flex items-center gap-1">
                <button class="px-2 py-0.5 border rounded" @click="setShapeStrokeWidthPt(selectedStrokeWidthPt - STROKE_WIDTH_STEP_PT)">-</button>
                <span class="text-xs w-10 text-center">{{ selectedStrokeWidthPt.toFixed(1) }}</span>
                <button class="px-2 py-0.5 border rounded" @click="setShapeStrokeWidthPt(selectedStrokeWidthPt + STROKE_WIDTH_STEP_PT)">+</button>
              </div>
            </div>
          </template>
          <template v-else-if="isLineTarget || isAngleLineTarget">
            <div>
              <p class="text-xs text-gray-500 mb-1">선 색상</p>
              <div class="flex items-center flex-wrap gap-1.5">
                <button v-for="color in STROKE_PALETTE" :key="color.id" class="w-5 h-5 rounded-full border transition hover:scale-110" :class="selectedStroke === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="updateColor({ stroke: color.hex })"></button>
                <button class="px-1.5 py-0.5 text-xs rounded border border-gray-300 hover:bg-gray-50" :class="selectedStroke === 'none' ? 'ring-2 ring-blue-500' : ''" title="선 없음" @click="updateColor({ stroke: 'none' })">없음</button>
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">점 색상</p>
              <div class="flex items-center flex-wrap gap-1.5">
                <button v-for="color in STROKE_PALETTE" :key="`point-${color.id}`" class="w-5 h-5 rounded-full border transition hover:scale-110" :class="selectedPoint === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="updateColor({ point: color.hex })"></button>
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">선 굵기 (pt)</p>
              <div class="flex items-center gap-1">
                <button class="px-2 py-0.5 border rounded" @click="setShapeStrokeWidthPt(selectedStrokeWidthPt - STROKE_WIDTH_STEP_PT)">-</button>
                <span class="text-xs w-10 text-center">{{ selectedStrokeWidthPt.toFixed(1) }}</span>
                <button class="px-2 py-0.5 border rounded" @click="setShapeStrokeWidthPt(selectedStrokeWidthPt + STROKE_WIDTH_STEP_PT)">+</button>
              </div>
            </div>
          </template>
          <template v-else>
            <div>
              <p class="text-xs text-gray-500 mb-1">선 색상</p>
              <div class="flex items-center flex-wrap gap-1.5">
                <button v-for="color in STROKE_PALETTE" :key="color.id" class="w-5 h-5 rounded-full border transition hover:scale-110" :class="selectedStroke === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="updateColor({ stroke: color.hex })"></button>
                <button class="px-1.5 py-0.5 text-xs rounded border border-gray-300 hover:bg-gray-50" :class="selectedStroke === 'none' ? 'ring-2 ring-blue-500' : ''" title="선 없음" @click="updateColor({ stroke: 'none' })">없음</button>
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">선 굵기 (pt)</p>
              <div class="flex items-center gap-1">
                <button class="px-2 py-0.5 border rounded" @click="setShapeStrokeWidthPt(selectedStrokeWidthPt - STROKE_WIDTH_STEP_PT)">-</button>
                <span class="text-xs w-10 text-center">{{ selectedStrokeWidthPt.toFixed(1) }}</span>
                <button class="px-2 py-0.5 border rounded" @click="setShapeStrokeWidthPt(selectedStrokeWidthPt + STROKE_WIDTH_STEP_PT)">+</button>
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">채우기 색상</p>
              <div class="flex items-center flex-wrap gap-1.5">
                <button v-for="color in FILL_PALETTE" :key="color.id" class="w-5 h-5 rounded-full border transition hover:scale-110" :class="selectedFill === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="updateColor({ fill: color.hex })"></button>
                <button class="px-1.5 py-0.5 text-xs rounded border border-gray-300 hover:bg-gray-50" :class="selectedFill === FILL_NONE ? 'ring-2 ring-blue-500' : ''" title="채우기 없음" @click="updateColor({ fill: FILL_NONE })">없음</button>
              </div>
            </div>
            <div>
              <p class="text-xs text-gray-500 mb-1">점 색상</p>
              <div class="flex items-center flex-wrap gap-1.5">
                <button v-for="color in STROKE_PALETTE" :key="`point-${color.id}`" class="w-5 h-5 rounded-full border transition hover:scale-110" :class="selectedPoint === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="updateColor({ point: color.hex })"></button>
              </div>
            </div>
          </template>
        </div>

        <div class="menu-sep"></div>

        <button class="menu-btn flex justify-between items-center" @click="expandedGuidePanel = !expandedGuidePanel">
          <span>가이드 개별 표시</span>
          <span class="text-xs text-gray-500">{{ expandedGuidePanel ? '▼' : '▶' }}</span>
        </button>

        <div v-if="expandedGuidePanel" class="px-2 py-2 space-y-1.5">
          <div v-if="!isStandalonePointTarget && (isLineTarget || (!isAngleLineTarget && targetShape?.type !== 'circle' && targetShape?.type !== 'arrow' && targetShape?.type !== 'arrow-curve'))" class="flex items-center justify-between text-xs">
            <span class="text-gray-600">길이</span>
            <button class="eye-btn" @click="setShapeGuideVisible('length', !shapeGuideVisibility.length)">{{ shapeGuideVisibility.length ? '숨김' : '표시' }}</button>
          </div>
          <div v-else-if="!isStandalonePointTarget && targetShape?.type === 'circle'" class="flex items-center justify-between text-xs">
            <span class="text-gray-600">반지름/지름 길이</span>
            <button class="eye-btn" @click="setShapeGuideVisible('radius', !shapeGuideVisibility.radius)">{{ shapeGuideVisibility.radius ? '숨김' : '표시' }}</button>
          </div>
          <div v-if="!isStandalonePointTarget && targetShape?.type === 'circle'" class="grid grid-cols-2 gap-1">
            <button class="px-2 py-0.5 border rounded text-xs" :class="selectedCircleMeasureMode === 'radius' ? 'bg-blue-50 border-blue-400 text-blue-700' : ''" @click="setCircleMeasureMode('radius')">반지름</button>
            <button class="px-2 py-0.5 border rounded text-xs" :class="selectedCircleMeasureMode === 'diameter' ? 'bg-blue-50 border-blue-400 text-blue-700' : ''" @click="setCircleMeasureMode('diameter')">지름</button>
          </div>
          <div v-if="!isStandalonePointTarget && (isAngleLineTarget || (targetShape?.type !== 'arrow' && targetShape?.type !== 'arrow-curve' && targetShape?.type !== 'circle' && !isLineTarget))" class="flex items-center justify-between text-xs">
            <span class="text-gray-600">각도</span>
            <button class="eye-btn" @click="setShapeGuideVisible('angle', !shapeGuideVisibility.angle)">{{ shapeGuideVisibility.angle ? '숨김' : '표시' }}</button>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-600">점 이름</span>
            <button class="eye-btn" @click="setShapeGuideVisible('pointName', !shapeGuideVisibility.pointName)">{{ shapeGuideVisibility.pointName ? '숨김' : '표시' }}</button>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-600">점</span>
            <button class="eye-btn" @click="setShapeGuideVisible('point', !shapeGuideVisibility.point)">{{ shapeGuideVisibility.point ? '숨김' : '표시' }}</button>
          </div>
          <div v-if="!isStandalonePointTarget && !isLineTarget && !isAngleLineTarget && targetShape?.type !== 'arrow' && targetShape?.type !== 'arrow-curve' && isHeightGuideToggleVisible" class="flex items-center justify-between text-xs">
            <span class="text-gray-600">높이</span>
            <button class="eye-btn" @click="setShapeGuideVisible('height', !shapeGuideVisibility.height)">{{ shapeGuideVisibility.height ? '숨김' : '표시' }}</button>
          </div>
          <div v-if="!isStandalonePointTarget && isHeightBaseConfigurable" class="pt-1 border-t border-gray-100">
            <p class="text-[11px] text-gray-500 mb-1">높이 기준변: {{ heightBaseLabel }}</p>
            <div class="flex items-center gap-1">
              <button class="px-2 py-0.5 border rounded" @click="cycleHeightBaseEdge(-1)">이전 기준변</button>
              <button class="px-2 py-0.5 border rounded" @click="cycleHeightBaseEdge(1)">다음 기준변</button>
            </div>
          </div>
        </div>

        <div class="menu-sep"></div>

        <button class="menu-btn" @click="reorder('up')">한 단계 앞으로</button>
        <button class="menu-btn" @click="reorder('down')">한 단계 뒤로</button>
        <button class="menu-btn" @click="reorder('front')">맨 앞으로</button>
        <button class="menu-btn" @click="reorder('back')">맨 뒤로</button>
      </template>

      <template v-else-if="isGuideTarget">
        <div class="px-2.5 py-1 text-xs text-gray-500">가이드 <span class="font-medium text-gray-700">{{ targetGuideLabel }}</span></div>
        <div class="menu-sep"></div>

        <div class="px-2 py-2 space-y-2">
          <div>
            <p class="text-xs text-gray-500 mb-1">색상</p>
            <div class="flex items-center flex-wrap gap-1.5">
              <button v-for="color in STROKE_PALETTE" :key="`guide-color-${color.id}`" class="w-5 h-5 rounded-full border transition hover:scale-110" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="setGuideColor(color.hex)"></button>
            </div>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">글자 크기</p>
            <div class="flex items-center gap-1">
              <button class="px-2 py-0.5 border rounded" @click="guideFontSizeDraft = Math.max(8, guideFontSizeDraft - 1); setGuideFontSize(guideFontSizeDraft)">-</button>
              <span class="text-xs w-10 text-center">{{ guideFontSizeDraft }}</span>
              <button class="px-2 py-0.5 border rounded" @click="guideFontSizeDraft = Math.min(72, guideFontSizeDraft + 1); setGuideFontSize(guideFontSizeDraft)">+</button>
            </div>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">선 굵기</p>
            <div class="flex items-center gap-1">
              <button class="px-2 py-0.5 border rounded" @click="guideLineWidthDraft = Number(Math.max(GUIDE_LINE_WIDTH_MIN, guideLineWidthDraft - GUIDE_LINE_WIDTH_STEP).toFixed(1)); setGuideLineWidth(guideLineWidthDraft)">-</button>
              <span class="text-xs w-10 text-center">{{ guideLineWidthDraft.toFixed(1) }}</span>
              <button class="px-2 py-0.5 border rounded" @click="guideLineWidthDraft = Number(Math.min(GUIDE_LINE_WIDTH_MAX, guideLineWidthDraft + GUIDE_LINE_WIDTH_STEP).toFixed(1)); setGuideLineWidth(guideLineWidthDraft)">+</button>
            </div>
          </div>
        </div>

        <div class="menu-sep"></div>
        <button class="menu-btn" @click="setGuideVisible(targetGuide?.visible === false)">표시/숨김</button>
        <button class="menu-btn text-red-600 hover:bg-red-50" @click="removeGuide">가이드 삭제</button>
      </template>

      <template v-else-if="isShapeGuideItemTarget">
        <div class="px-2.5 py-1 text-xs text-gray-500">항목 <span class="font-medium text-gray-700">{{ targetGuideLabel }}</span></div>
        <div class="menu-sep"></div>

        <div class="px-2 py-2 space-y-2">
          <p v-if="shapeGuideItemTypeLabel" class="text-[11px] text-gray-500">타입: {{ shapeGuideItemTypeLabel }}</p>
          <div
            v-if="shapeGuideItemKey === 'length' && targetShape?.type === 'circle'"
            class="pt-1 border-t border-gray-100"
          >
            <button
              class="px-2 py-1 border rounded text-xs hover:bg-gray-50"
              @click="setCircleMeasureMode(selectedCircleMeasureMode === 'diameter' ? 'radius' : 'diameter')"
            >
              {{ selectedCircleMeasureMode === 'diameter' ? '반지름으로 변경' : '지름으로 변경' }}
            </button>
          </div>
          <div
            v-if="shapeGuideItemKey === 'length' || shapeGuideItemKey === 'height'"
            class="pt-1 border-t border-gray-100"
          >
            <button
              class="px-2 py-1 border rounded text-xs hover:bg-gray-50"
              @click="toggleGuideCurveSide"
            >
              보조선 뒤집기
            </button>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">색상</p>
            <div class="flex items-center flex-wrap gap-1.5">
              <button v-for="color in STROKE_PALETTE" :key="`item-color-${color.id}`" class="w-5 h-5 rounded-full border transition hover:scale-110" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="patchShapeGuideItemStyle({ color: color.hex })"></button>
            </div>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">글자 크기</p>
            <div class="flex items-center gap-1">
              <button class="px-2 py-0.5 border rounded" @click="patchShapeGuideItemStyle({ fontSize: Math.max(8, Number(getShapeGuideItemStyle().fontSize || 11) - 1) })">-</button>
              <span class="text-xs w-10 text-center">{{ Number(getShapeGuideItemStyle().fontSize || 11) }}</span>
              <button class="px-2 py-0.5 border rounded" @click="patchShapeGuideItemStyle({ fontSize: Math.min(72, Number(getShapeGuideItemStyle().fontSize || 11) + 1) })">+</button>
            </div>
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1">선 굵기</p>
            <div class="flex items-center gap-1">
              <button class="px-2 py-0.5 border rounded" @click="patchShapeGuideItemStyle({ lineWidth: Number(Math.max(GUIDE_LINE_WIDTH_MIN, Number(getShapeGuideItemStyle().lineWidth || GUIDE_LINE_WIDTH_DEFAULT) - GUIDE_LINE_WIDTH_STEP).toFixed(1)) })">-</button>
              <span class="text-xs w-10 text-center">{{ Number(getShapeGuideItemStyle().lineWidth || GUIDE_LINE_WIDTH_DEFAULT).toFixed(1) }}</span>
              <button class="px-2 py-0.5 border rounded" @click="patchShapeGuideItemStyle({ lineWidth: Number(Math.min(GUIDE_LINE_WIDTH_MAX, Number(getShapeGuideItemStyle().lineWidth || GUIDE_LINE_WIDTH_DEFAULT) + GUIDE_LINE_WIDTH_STEP).toFixed(1)) })">+</button>
            </div>
          </div>
          <div v-if="isShapeGuideItemBlank()">
            <p class="text-xs text-gray-500 mb-1">빈칸 폭 (mm)</p>
            <div class="flex items-center gap-1">
              <button class="px-2 py-0.5 border rounded" @click="patchShapeGuideItemStyle({ blankWidthMm: Number(Math.max(BLANK_WIDTH_MIN_MM, getShapeGuideItemBlankSizeMm() - BLANK_WIDTH_STEP_MM).toFixed(1)) })">-</button>
              <span class="text-xs w-12 text-center">{{ getShapeGuideItemBlankSizeMm().toFixed(1) }}</span>
              <button class="px-2 py-0.5 border rounded" @click="patchShapeGuideItemStyle({ blankWidthMm: Number(Math.min(BLANK_WIDTH_MAX_MM, getShapeGuideItemBlankSizeMm() + BLANK_WIDTH_STEP_MM).toFixed(1)) })">+</button>
            </div>
          </div>
        </div>

        <div class="menu-sep"></div>
        <button class="menu-btn" @click="toggleShapeGuideItemBlank">{{ isShapeGuideItemBlank() ? '일반 텍스트로 변경' : '빈칸형으로 변경' }}</button>
        <button class="menu-btn" @click="toggleShapeGuideItemVisible">표시/숨김</button>
      </template>

      <template v-else>
        <button class="menu-btn" @click="selectAllShapes">전체 선택</button>
        <button class="menu-btn" :class="{ 'opacity-40 cursor-not-allowed': !canUndo }" @click="handleUndo">실행 취소</button>
        <button class="menu-btn" :class="{ 'opacity-40 cursor-not-allowed': !canRedo }" @click="handleRedo">다시 실행</button>
        <div class="menu-sep"></div>
        <button class="menu-btn text-red-600 hover:bg-red-50" @click="clearAll">전체 삭제</button>
        <div class="menu-sep"></div>
        <button class="menu-btn" @click="cycleGridMode">모눈/점판 전환</button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.menu-btn {
  @apply w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition;
}
.menu-sep {
  @apply h-px bg-gray-200 my-1;
}
.eye-btn {
  @apply px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-50;
}
</style>



