<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useToolStore } from '@/stores/tool'
import { GRID_CONFIG, STYLE_COLORS, type Guide, type Point, type Shape } from '@/types'
import { generateId, calculateDistance } from '@/utils/geometry'
import { FILL_NONE, FILL_PALETTE, STROKE_PALETTE, cmykTooltip } from '@/constants/colorPalette'
import { OPEN_SHAPE_TYPES, isHeightDefaultVisibleType } from '@/constants/shapeRules'

const canvasStore = useCanvasStore()
const toolStore = useToolStore()

const rotateAngle = ref(90)
const DEFAULT_FILLED_STROKE_PT = 0.4
const DEFAULT_UNFILLED_STROKE_PT = 0.6
const STROKE_WIDTH_STEP_PT = 0.1
const STROKE_WIDTH_MIN_PT = 0.1
const STROKE_WIDTH_MAX_PT = 12
const MM_TO_PX = 96 / 25.4
const BLANK_BASE_HEIGHT_MM = 7
const BLANK_WIDTH_STEP_MM = 0.5
const BLANK_WIDTH_MIN_MM = 3
const BLANK_WIDTH_MAX_MM = 50
const BLANK_WIDTH_DEFAULT_MM = 7

const shapeTypeNames: Record<string, string> = {
  rectangle: '직사각형',
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
const selectedShape = computed(() => canvasStore.selectedShape)
const selectedGuide = computed(() => canvasStore.selectedGuide)
const hasShapeSelection = computed(() => !!selectedShape.value)
const hasGuideSelection = computed(() => !!selectedGuide.value)
const selectedTextGuide = computed<Guide | null>(() => {
  const guide = selectedGuide.value
  if (!guide || guide.type !== 'text') return null
  return guide
})
const hasTextGuideSelection = computed(() => !!selectedTextGuide.value)
const isBlankBoxGuideSelection = computed(() => selectedGuide.value?.type === 'blank-box')
const hasSelection = computed(() => hasShapeSelection.value || hasGuideSelection.value)
const isStandalonePointSelection = computed(() => selectedShape.value?.type === 'point' || selectedShape.value?.type === 'point-on-object')
const isArrowSelection = computed(() => selectedShape.value?.type === 'arrow' || selectedShape.value?.type === 'arrow-curve')
const isLineSelection = computed(() => {
  const type = selectedShape.value?.type
  return type === 'segment' || type === 'ray' || type === 'line'
})
const isAngleLineSelection = computed(() => selectedShape.value?.type === 'angle-line')
type GuideToggleKey = 'length' | 'radius' | 'angle' | 'pointName' | 'point' | 'height'
type GlobalGuideState = 'all' | 'none' | 'mixed'

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

function getShapePointLabel(shape: Shape, pointIndex: number): string {
  const custom = shape.pointLabels?.[pointIndex]
  if (custom) return custom
  return globalPointLabelMap.value[`${shape.id}-${pointIndex}`] ?? getPointLabel(pointIndex)
}

const selectedShapeTypeLabel = computed(() => {
  if (!selectedShape.value) return ''
  return shapeTypeNames[selectedShape.value.type] ?? selectedShape.value.type
})
const selectedGuideTypeLabel = computed(() => {
  if (!selectedGuide.value) return ''
  if (selectedGuide.value.type === 'text') return '텍스트 가이드'
  if (selectedGuide.value.type === 'length') return '길이 가이드'
  if (selectedGuide.value.type === 'blank-box') return '빈칸 박스'
  return '각도 가이드'
})

const selectedPointSummary = computed(() => {
  if (!selectedShape.value) return []
  return selectedShape.value.points.map((p, idx) => ({
    key: `${selectedShape.value!.id}-${idx}`,
    pointName: getShapePointLabel(selectedShape.value!, idx),
    x: (p.x / GRID_CONFIG.size).toFixed(1),
    y: (p.y / GRID_CONFIG.size).toFixed(1)
  }))
})

const selectedColorSummary = computed(() => {
  if (!selectedShape.value) {
    return { stroke: '#231815', fill: FILL_NONE, point: '#231815' }
  }
  const preset = STYLE_COLORS[selectedShape.value.style] || STYLE_COLORS.default
  const stroke = selectedShape.value.color?.stroke ?? preset.stroke
  const fill = selectedShape.value.color?.fill ?? preset.fill
  const point = selectedShape.value.color?.point
    ?? (stroke !== 'none' ? stroke : (preset.point ?? STYLE_COLORS.default.point))
  return { stroke, fill, point }
})

const selectedStroke = computed(() => selectedColorSummary.value.stroke)
const selectedFill = computed(() => selectedColorSummary.value.fill)
const selectedPoint = computed(() => selectedColorSummary.value.point)
const selectedGridLineColor = computed(() => toolStore.gridLineColor)
const selectedGridBackgroundColor = computed(() => toolStore.gridBackgroundColor)

function getDefaultStrokeWidthPt(shape: Shape): number {
  const isFilled = !OPEN_SHAPE_TYPES.has(shape.type) && shape.color?.fill !== FILL_NONE
  return isFilled ? DEFAULT_FILLED_STROKE_PT : DEFAULT_UNFILLED_STROKE_PT
}

const selectedStrokeWidthPt = computed(() => {
  if (!selectedShape.value) return DEFAULT_UNFILLED_STROKE_PT
  const raw = typeof selectedShape.value.strokeWidthPt === 'number'
    ? selectedShape.value.strokeWidthPt
    : getDefaultStrokeWidthPt(selectedShape.value)
  return Number(raw.toFixed(1))
})

function getColorChipTitle(value: string): string {
  if (value === FILL_NONE || value === 'none') return '없음'
  return value
}

const isHeightBaseConfigurable = computed(() => {
  if (!selectedShape.value) return false
  return selectedShape.value.type !== 'circle'
    && selectedShape.value.type !== 'triangle-right'
    && selectedShape.value.type !== 'rectangle'
    && selectedShape.value.type !== 'rect-rectangle'
    && selectedShape.value.type !== 'rect-square'
    && selectedShape.value.type !== 'rect-rhombus'
    && !OPEN_SHAPE_TYPES.has(selectedShape.value.type)
    && selectedShape.value.points.length >= 3
})

function getShapeBottomBaseEdgeIndex(shape: Shape): number {
  const n = shape.points.length
  if (n < 2) return 0
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

function getShapeHeightBaseEdgeIndex(shape: Shape): number {
  const custom = Number(shape.heightBaseEdgeIndex)
  if (Number.isInteger(custom) && custom >= 0 && custom < shape.points.length) return custom
  return getShapeBottomBaseEdgeIndex(shape)
}

const selectedHeightBaseLabel = computed(() => {
  if (!selectedShape.value || !isHeightBaseConfigurable.value) return ''
  const idx = getShapeHeightBaseEdgeIndex(selectedShape.value)
  const next = (idx + 1) % selectedShape.value.points.length
  return `${getShapePointLabel(selectedShape.value, idx)},${getShapePointLabel(selectedShape.value, next)}`
})

function isShapeHeightDefaultVisible(shape: Shape): boolean {
  return isHeightDefaultVisibleType(shape.type)
}

function isShapePointDefaultVisible(shape: Shape): boolean {
  return shape.type === 'point'
    || shape.type === 'point-on-object'
    || shape.type === 'segment'
    || shape.type === 'ray'
    || shape.type === 'line'
    || shape.type === 'angle-line'
    || shape.type === 'circle'
}

function isShapeGuideAvailable(shape: Shape | null, key: GuideToggleKey): boolean {
  if (!shape) return true
  if (key === 'length') {
    if (shape.type === 'segment' || shape.type === 'ray' || shape.type === 'line') return true
    return shape.type !== 'circle' && shape.type !== 'arrow' && shape.type !== 'arrow-curve' && shape.type !== 'angle-line'
  }
  if (key === 'radius') return shape.type === 'circle'
  if (key === 'pointName') return true
  if (key === 'point') return true
  if (key === 'angle') {
    if (shape.type === 'angle-line') return shape.points.length >= 3
    return shape.type !== 'circle' && !OPEN_SHAPE_TYPES.has(shape.type) && shape.points.length >= 3
  }
  if (key === 'height') {
    if (shape.type === 'circle' || OPEN_SHAPE_TYPES.has(shape.type)) return false
    if (shape.type === 'triangle-right') return false
    if (shape.type === 'rectangle' || shape.type === 'rect-rectangle' || shape.type === 'rect-square' || shape.type === 'rect-rhombus') return false
    return shape.points.length >= 3
  }
  return true
}

function getShapeGuideVisibleValue(shape: Shape, key: GuideToggleKey): boolean {
  if (key === 'radius') {
    if (shape.type !== 'circle') return false
    return shape.guideVisibility?.radius !== false
  }
  if (key === 'height') {
    if (typeof shape.guideVisibility?.height === 'boolean') return shape.guideVisibility.height
    return isShapeHeightDefaultVisible(shape)
  }
  if (key === 'point') {
    if (typeof shape.guideVisibility?.point === 'boolean') return shape.guideVisibility.point
    return isShapePointDefaultVisible(shape)
  }
  return shape.guideVisibility?.[key] !== false
}

const selectedPointVisible = computed(() => {
  if (!selectedShape.value) return false
  return getShapeGuideVisibleValue(selectedShape.value, 'point')
})
const selectedGuideColor = computed(() => selectedGuide.value?.color ?? '#231815')
const selectedGuideFontSize = computed(() => Math.max(8, Math.min(72, Number(selectedGuide.value?.fontSize ?? 11))))
const selectedGuideLineWidth = computed(() => {
  const raw = Number(selectedGuide.value?.lineWidth ?? 0.4)
  return Number(Math.max(0.1, Math.min(12, raw)).toFixed(1))
})
const selectedGuideBlankWidthMm = computed(() => {
  if (!selectedGuide.value || selectedGuide.value.type !== 'blank-box') return BLANK_WIDTH_DEFAULT_MM
  const raw = Number(selectedGuide.value.blankWidthMm)
  if (Number.isFinite(raw)) {
    const stepped = Math.round(raw / BLANK_WIDTH_STEP_MM) * BLANK_WIDTH_STEP_MM
    return Math.max(BLANK_WIDTH_MIN_MM, Math.min(BLANK_WIDTH_MAX_MM, stepped))
  }
  const widthPx = Math.abs((selectedGuide.value.points[1]?.x || 0) - (selectedGuide.value.points[0]?.x || 0))
  const widthMm = widthPx / MM_TO_PX
  const stepped = Math.round(widthMm / BLANK_WIDTH_STEP_MM) * BLANK_WIDTH_STEP_MM
  return Math.max(BLANK_WIDTH_MIN_MM, Math.min(BLANK_WIDTH_MAX_MM, stepped || BLANK_WIDTH_DEFAULT_MM))
})
const selectedGuideBlankUnitMode = computed<'none' | 'cm' | 'angle'>(() => {
  if (!selectedGuide.value || selectedGuide.value.type !== 'blank-box') return 'none'
  return selectedGuide.value.blankUnitMode === 'cm' || selectedGuide.value.blankUnitMode === 'angle'
    ? selectedGuide.value.blankUnitMode
    : 'none'
})

const selectedCircleMeasureMode = computed(() => {
  if (!selectedShape.value || selectedShape.value.type !== 'circle') return 'radius'
  return selectedShape.value.circleMeasureMode === 'diameter' ? 'diameter' : 'radius'
})

function setSelectedCircleMeasureMode(mode: 'radius' | 'diameter') {
  if (!selectedShape.value || selectedShape.value.type !== 'circle') return
  canvasStore.updateShape(selectedShape.value.id, (shape) => ({
    ...shape,
    circleMeasureMode: mode
  }))
}

function setSelectedShapeGuideVisible(key: GuideToggleKey, visible: boolean) {
  if (!selectedShape.value) return
  canvasStore.setShapeGuideVisibility(selectedShape.value.id, key, visible)
}

function getSelectedGuideIndicator(key: GuideToggleKey): string {
  if (!selectedShape.value) return ''
  return getShapeGuideVisibleValue(selectedShape.value, key) ? '●' : ''
}

function toggleSelectedGuide(key: GuideToggleKey) {
  if (!selectedShape.value) return
  const visible = getShapeGuideVisibleValue(selectedShape.value, key)
  setSelectedShapeGuideVisible(key, !visible)
}

function getGlobalGuideState(key: GuideToggleKey): GlobalGuideState {
  const applicable = canvasStore.shapes.filter((shape) => isShapeGuideAvailable(shape, key))
  if (applicable.length === 0) return 'none'
  const visibleCount = applicable.reduce((acc, shape) => acc + (getShapeGuideVisibleValue(shape, key) ? 1 : 0), 0)
  if (visibleCount === 0) return 'none'
  if (visibleCount === applicable.length) return 'all'
  return 'mixed'
}

function getGlobalGuideIndicator(key: GuideToggleKey): string {
  const state = getGlobalGuideState(key)
  if (state === 'all') return '●'
  if (state === 'mixed') return '◐'
  return ''
}

function hasGlobalApplicableShape(key: GuideToggleKey): boolean {
  return canvasStore.shapes.some((shape) => isShapeGuideAvailable(shape, key))
}

function setAllShapesGuideVisible(key: GuideToggleKey, visible: boolean) {
  const targets = canvasStore.shapes.filter((shape) => isShapeGuideAvailable(shape, key))
  if (!targets.length) return
  canvasStore.saveHistory()
  for (const shape of targets) {
    shape.guideVisibility = {
      ...(shape.guideVisibility || {}),
      [key]: visible
    } as any
  }
}

function toggleGlobalGuide(key: GuideToggleKey) {
  const state = getGlobalGuideState(key)
  setAllShapesGuideVisible(key, state !== 'all')
}

function getPolygonPerimeter(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    sum += calculateDistance(points[i], points[(i + 1) % points.length])
  }
  return sum
}

function getPolygonArea(points: Point[]): number {
  if (points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % points.length]
    sum += p1.x * p2.y - p2.x * p1.y
  }
  const areaPx = Math.abs(sum) / 2
  return areaPx / (GRID_CONFIG.size * GRID_CONFIG.size)
}

const selectedMetrics = computed(() => {
  if (!selectedShape.value) return { perimeter: null as number | null, area: null as number | null }
  const shape = selectedShape.value
  if (shape.type === 'circle' && shape.points.length >= 2) {
    const r = calculateDistance(shape.points[0], shape.points[1])
    return {
      perimeter: 2 * Math.PI * r,
      area: Math.PI * r * r
    }
  }
  if (OPEN_SHAPE_TYPES.has(shape.type) || shape.points.length < 3) {
    return { perimeter: null, area: null }
  }
  return {
    perimeter: getPolygonPerimeter(shape.points),
    area: getPolygonArea(shape.points)
  }
})

function formatLength(value: number): string {
  return `${value.toFixed(1)} cm`
}

function formatArea(value: number): string {
  return `${value.toFixed(2)} cm²`
}

function toPoint(x: number, y: number): Point {
  return {
    x,
    y,
    gridX: x / GRID_CONFIG.size,
    gridY: y / GRID_CONFIG.size
  }
}

function duplicateSelected() {
  if (!selectedShape.value) return
  const newPoints = selectedShape.value.points.map((p) => toPoint(p.x + GRID_CONFIG.size, p.y + GRID_CONFIG.size))
  canvasStore.addShape({
    ...selectedShape.value,
    id: generateId(),
    points: newPoints
  })
}

function deleteSelected() {
  if (selectedShape.value) {
    canvasStore.removeShape(selectedShape.value.id)
    return
  }
  if (selectedGuide.value) {
    canvasStore.removeGuide(selectedGuide.value.id)
    canvasStore.selectGuide(null)
  }
}

function flip(axis: 'horizontal' | 'vertical') {
  if (!selectedShape.value) return
  const cx = selectedShape.value.points.reduce((sum, p) => sum + p.x, 0) / selectedShape.value.points.length
  const cy = selectedShape.value.points.reduce((sum, p) => sum + p.y, 0) / selectedShape.value.points.length
  canvasStore.updateShape(selectedShape.value.id, (shape) => ({
    ...shape,
    points: shape.points.map((p) => {
      if (axis === 'horizontal') return toPoint(2 * cx - p.x, p.y)
      return toPoint(p.x, 2 * cy - p.y)
    })
  }))
}

function rotate(direction: 'cw' | 'ccw') {
  if (!selectedShape.value) return
  const angle = Math.abs(rotateAngle.value || 0) * (direction === 'cw' ? 1 : -1)
  const rad = (angle * Math.PI) / 180
  const cx = selectedShape.value.points.reduce((sum, p) => sum + p.x, 0) / selectedShape.value.points.length
  const cy = selectedShape.value.points.reduce((sum, p) => sum + p.y, 0) / selectedShape.value.points.length

  canvasStore.updateShape(selectedShape.value.id, (shape) => ({
    ...shape,
    points: shape.points.map((p) => {
      const dx = p.x - cx
      const dy = p.y - cy
      return toPoint(
        cx + dx * Math.cos(rad) - dy * Math.sin(rad),
        cy + dx * Math.sin(rad) + dy * Math.cos(rad)
      )
    })
  }))
}

function setStrokeColor(stroke: string) {
  if (!selectedShape.value) return
  canvasStore.setShapeColor(selectedShape.value.id, {
    stroke,
    fill: selectedColorSummary.value.fill,
    point: selectedColorSummary.value.point
  })
}

function setFillColor(fill: string) {
  if (!selectedShape.value) return
  canvasStore.setShapeColor(selectedShape.value.id, {
    stroke: selectedColorSummary.value.stroke,
    fill,
    point: selectedColorSummary.value.point
  })
}

function setPointColor(point: string) {
  if (!selectedShape.value) return
  canvasStore.setShapeColor(selectedShape.value.id, {
    stroke: selectedColorSummary.value.stroke,
    fill: selectedColorSummary.value.fill,
    point
  })
}

function setSelectedGuideColor(color: string) {
  if (!selectedGuide.value) return
  canvasStore.updateGuide(selectedGuide.value.id, (guide) => ({
    ...guide,
    color
  }))
}

function setSelectedGuideFontSize(fontSize: number) {
  if (!selectedGuide.value) return
  const clamped = Math.max(8, Math.min(72, Math.round(fontSize)))
  canvasStore.updateGuide(selectedGuide.value.id, (guide) => ({
    ...guide,
    fontSize: clamped
  }))
}

function setSelectedGuideLineWidth(lineWidth: number) {
  if (!selectedGuide.value || selectedGuide.value.type === 'text') return
  const clamped = Number(Math.max(0.1, Math.min(12, lineWidth)).toFixed(1))
  canvasStore.updateGuide(selectedGuide.value.id, (guide) => ({
    ...guide,
    lineWidth: clamped
  }))
}

function setSelectedGuideBlankWidthMm(widthMm: number) {
  if (!selectedGuide.value || selectedGuide.value.type !== 'blank-box' || selectedGuide.value.points.length < 2) return
  const clampedMm = Math.max(BLANK_WIDTH_MIN_MM, Math.min(BLANK_WIDTH_MAX_MM, Number(widthMm.toFixed(1))))
  const widthPx = clampedMm * MM_TO_PX
  const heightPx = BLANK_BASE_HEIGHT_MM * MM_TO_PX
  const p1 = selectedGuide.value.points[0]
  const p2 = selectedGuide.value.points[1]
  const centerX = (p1.x + p2.x) / 2
  const centerY = (p1.y + p2.y) / 2

  canvasStore.updateGuide(selectedGuide.value.id, (guide) => ({
    ...guide,
    blankWidthMm: clampedMm,
    points: [
      {
        x: centerX - widthPx / 2,
        y: centerY - heightPx / 2,
        gridX: (centerX - widthPx / 2) / GRID_CONFIG.size,
        gridY: (centerY - heightPx / 2) / GRID_CONFIG.size
      },
      {
        x: centerX + widthPx / 2,
        y: centerY + heightPx / 2,
        gridX: (centerX + widthPx / 2) / GRID_CONFIG.size,
        gridY: (centerY + heightPx / 2) / GRID_CONFIG.size
      }
    ]
  }))
}

function setSelectedGuideBlankUnitMode(mode: 'none' | 'cm' | 'angle') {
  if (!selectedGuide.value || selectedGuide.value.type !== 'blank-box') return
  canvasStore.updateGuide(selectedGuide.value.id, (guide) => ({
    ...guide,
    blankUnitMode: mode
  }))
}

function setGridLineColor(color: string) {
  toolStore.setGridLineColor(color)
}

function setGridBackgroundColor(color: string) {
  toolStore.setGridBackgroundColor(color)
}

function setStrokeWidthPt(widthPt: number) {
  if (!selectedShape.value) return
  const clamped = Number(Math.max(STROKE_WIDTH_MIN_PT, Math.min(STROKE_WIDTH_MAX_PT, widthPt)).toFixed(1))
  canvasStore.updateShape(selectedShape.value.id, (shape) => ({
    ...shape,
    strokeWidthPt: clamped
  }))
}

function cycleSelectedHeightBase(step: -1 | 1) {
  if (!selectedShape.value || !isHeightBaseConfigurable.value) return
  const n = selectedShape.value.points.length
  const current = getShapeHeightBaseEdgeIndex(selectedShape.value)
  const next = (current + step + n) % n
  canvasStore.updateShape(selectedShape.value.id, (shape) => ({
    ...shape,
    heightBaseEdgeIndex: next,
    guideVisibility: {
      ...(shape.guideVisibility || {}),
      height: true
    }
  }))
}

function reorderLayer(direction: 'up' | 'down' | 'front' | 'back') {
  if (!selectedShape.value) return
  canvasStore.reorderShape(selectedShape.value.id, direction)
}
</script>

<template>
  <div class="space-y-4">
    <div class="pb-2 border-b border-gray-200">
      <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">속성 패널</h3>
      <p class="text-xs text-gray-400 mt-1">
        {{ hasShapeSelection ? `선택됨: ${selectedShapeTypeLabel}` : hasGuideSelection ? `선택됨: ${selectedGuideTypeLabel}` : '도형을 클릭해 선택하세요' }}
      </p>
    </div>

    <section v-if="hasShapeSelection" class="panel-section">
      <h4 class="panel-title">선택 도형 정보</h4>
      <div class="space-y-1.5 mb-2">
        <div class="info-row"><span class="info-key">타입</span><span class="info-value">{{ selectedShapeTypeLabel }}</span></div>
        <div v-if="selectedMetrics.perimeter !== null" class="info-row"><span class="info-key">둘레</span><span class="info-value">{{ formatLength(selectedMetrics.perimeter) }}</span></div>
        <div v-if="selectedMetrics.area !== null" class="info-row"><span class="info-key">넓이</span><span class="info-value">{{ formatArea(selectedMetrics.area) }}</span></div>
        <div v-if="!isStandalonePointSelection" class="info-row"><span class="info-key">테두리</span><span class="color-chip" :title="getColorChipTitle(selectedStroke)" :style="{ backgroundColor: selectedStroke === 'none' ? 'transparent' : selectedStroke }"></span></div>
        <div v-if="!isStandalonePointSelection && !isLineSelection && !isAngleLineSelection" class="info-row"><span class="info-key">배경색</span><span class="color-chip" :title="getColorChipTitle(selectedFill)" :style="{ backgroundColor: selectedFill === FILL_NONE ? 'transparent' : selectedFill }"></span></div>
        <div class="info-row"><span class="info-key">점</span><span class="color-chip" :title="getColorChipTitle(selectedPoint)" :style="{ backgroundColor: selectedPoint }"></span></div>
      </div>
      <div class="space-y-1.5 max-h-28 overflow-y-auto">
        <div v-for="item in selectedPointSummary" :key="item.key" class="point-row">
          <span class="point-name-chip">점 {{ item.pointName }}</span>
          <span class="info-value">({{ item.x }}, {{ item.y }})</span>
        </div>
      </div>
    </section>

    <section v-else-if="hasGuideSelection" class="panel-section">
      <h4 class="panel-title">선택 가이드 정보</h4>
      <div class="space-y-1.5 mb-2">
        <div class="info-row"><span class="info-key">타입</span><span class="info-value">{{ selectedGuideTypeLabel }}</span></div>
        <div v-if="selectedGuide?.type === 'text'" class="info-row"><span class="info-key">텍스트</span><span class="info-value">{{ selectedGuide?.text || '(빈 텍스트)' }}</span></div>
        <div v-if="selectedGuide?.type === 'text'" class="info-row"><span class="info-key">표기</span><span class="info-value">{{ selectedGuide?.useLatex ? 'LaTeX' : '일반 텍스트' }}</span></div>
        <div class="info-row"><span class="info-key">색상</span><span class="color-chip" :title="getColorChipTitle(selectedGuideColor)" :style="{ backgroundColor: selectedGuideColor }"></span></div>
      </div>
    </section>

    <section class="panel-section">
      <h4 class="panel-title">선택</h4>
      <div class="grid grid-cols-2 gap-2">
        <button class="action-btn col-span-2" :class="{ active: toolStore.mode === 'select' }" @click="toolStore.setMode('select')">선택/이동 모드</button>
        <button class="action-btn" :disabled="!hasShapeSelection" @click="duplicateSelected">복제</button>
        <button class="action-btn danger" :disabled="!hasSelection" @click="deleteSelected">삭제</button>
      </div>
      <p class="text-[11px] text-gray-500 mt-2">도형 선택·수정 | Space + 드래그로 화면 이동</p>
    </section>

    <section v-if="hasShapeSelection" class="panel-section">
      <h4 class="panel-title">회전/대칭</h4>
      <p class="text-[11px] text-gray-500">도형 회전은 캔버스에서 마우스 드래그로도 조절 가능합니다</p>
      <div class="flex items-center gap-2 mt-2">
        <input v-model.number="rotateAngle" type="number" min="1" class="input-sm w-20">
        <span class="text-xs text-gray-400">도</span>
      </div>
      <div class="grid grid-cols-4 gap-2 mt-2">
        <button class="icon-action-btn" title="시계 방향 회전" @click="rotate('cw')">시계</button>
        <button class="icon-action-btn" title="반시계 방향 회전" @click="rotate('ccw')">반시계</button>
        <button class="icon-action-btn" title="좌우 뒤집기" @click="flip('horizontal')">좌우</button>
        <button class="icon-action-btn" title="상하 뒤집기" @click="flip('vertical')">상하</button>
      </div>
    </section>

    <section class="panel-section">
      <h4 class="panel-title">색상 변경</h4>
      <div v-if="hasShapeSelection" class="space-y-2">
        <div v-if="!isArrowSelection && (selectedPointVisible || isLineSelection || isAngleLineSelection)">
          <p class="text-xs text-gray-500 mb-1">점 색상</p>
          <div class="flex items-center flex-wrap gap-1.5">
            <button v-for="color in STROKE_PALETTE" :key="`point-${color.id}`" class="w-5 h-5 rounded-full border hover:scale-110 transition" :class="selectedPoint === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="setPointColor(color.hex)"></button>
          </div>
        </div>
        <div v-if="!isStandalonePointSelection">
          <p class="text-xs text-gray-500 mb-1">선 색상</p>
          <div class="flex items-center flex-wrap gap-1.5">
            <button v-for="color in STROKE_PALETTE" :key="color.id" class="w-5 h-5 rounded-full border hover:scale-110 transition" :class="selectedStroke === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="setStrokeColor(color.hex)"></button>
            <button class="action-btn text-xs px-2 py-1" :class="{ active: selectedStroke === 'none' }" @click="setStrokeColor('none')">없음</button>
          </div>
        </div>
        <div v-if="!isStandalonePointSelection && !isArrowSelection && !isLineSelection && !isAngleLineSelection">
          <p class="text-xs text-gray-500 mb-1">채우기 색상</p>
          <div class="flex items-center flex-wrap gap-1.5">
            <button v-for="color in FILL_PALETTE" :key="color.id" class="w-5 h-5 rounded-full border hover:scale-110 transition" :class="selectedFill === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="setFillColor(color.hex)"></button>
            <button class="action-btn text-xs px-2 py-1" :class="{ active: selectedFill === FILL_NONE }" @click="setFillColor(FILL_NONE)">없음</button>
          </div>
        </div>
        <div v-if="!isStandalonePointSelection">
          <p class="text-xs text-gray-500 mb-1">테두리 두께 (pt)</p>
          <div class="flex items-center gap-1">
            <button class="step-btn" @click="setStrokeWidthPt(selectedStrokeWidthPt - STROKE_WIDTH_STEP_PT)">-</button>
            <span class="text-xs w-12 text-center">{{ selectedStrokeWidthPt.toFixed(1) }}</span>
            <button class="step-btn" @click="setStrokeWidthPt(selectedStrokeWidthPt + STROKE_WIDTH_STEP_PT)">+</button>
          </div>
        </div>
      </div>
      <div v-else-if="hasGuideSelection" class="space-y-2">
        <p v-if="selectedGuide?.type === 'blank-box'" class="text-[11px] text-gray-500">타입: 빈칸</p>
        <div>
          <p class="text-xs text-gray-500 mb-1">{{ selectedGuide?.type === 'text' ? '텍스트 색상' : '가이드 색상' }}</p>
          <div class="flex items-center flex-wrap gap-1.5">
            <button v-for="color in STROKE_PALETTE" :key="`guide-text-${color.id}`" class="w-5 h-5 rounded-full border hover:scale-110 transition" :class="selectedGuideColor === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="setSelectedGuideColor(color.hex)"></button>
          </div>
        </div>
        <div v-if="selectedGuide?.type === 'blank-box'">
          <p class="text-xs text-gray-500 mb-1">빈칸 폭 (mm)</p>
          <div class="flex items-center gap-1">
            <button class="step-btn" @click="setSelectedGuideBlankWidthMm(selectedGuideBlankWidthMm - BLANK_WIDTH_STEP_MM)">-</button>
            <span class="text-xs w-12 text-center">{{ selectedGuideBlankWidthMm.toFixed(1) }}</span>
            <button class="step-btn" @click="setSelectedGuideBlankWidthMm(selectedGuideBlankWidthMm + BLANK_WIDTH_STEP_MM)">+</button>
          </div>
        </div>
        <div v-if="selectedGuide?.type === 'blank-box'">
          <p class="text-xs text-gray-500 mb-1">단위 표시</p>
          <div class="grid grid-cols-3 gap-2">
            <button class="action-btn text-xs px-2 py-0.5 min-h-0" :class="{ active: selectedGuideBlankUnitMode === 'none' }" @click="setSelectedGuideBlankUnitMode('none')">공란</button>
            <button class="action-btn text-xs px-2 py-0.5 min-h-0" :class="{ active: selectedGuideBlankUnitMode === 'cm' }" @click="setSelectedGuideBlankUnitMode('cm')">cm</button>
            <button class="action-btn text-xs px-2 py-0.5 min-h-0" :class="{ active: selectedGuideBlankUnitMode === 'angle' }" @click="setSelectedGuideBlankUnitMode('angle')">각도기호</button>
          </div>
        </div>
        <div v-if="selectedGuide?.type === 'text'">
          <p class="text-xs text-gray-500 mb-1">글자 크기</p>
          <div class="flex items-center gap-1">
            <button class="step-btn" @click="setSelectedGuideFontSize(selectedGuideFontSize - 1)">-</button>
            <span class="text-xs w-12 text-center">{{ selectedGuideFontSize }}</span>
            <button class="step-btn" @click="setSelectedGuideFontSize(selectedGuideFontSize + 1)">+</button>
          </div>
        </div>
        <div v-if="selectedGuide?.type !== 'text'">
          <p class="text-xs text-gray-500 mb-1">선 굵기 (pt)</p>
          <div class="flex items-center gap-1">
            <button class="step-btn" @click="setSelectedGuideLineWidth(selectedGuideLineWidth - 0.1)">-</button>
            <span class="text-xs w-12 text-center">{{ selectedGuideLineWidth.toFixed(1) }}</span>
            <button class="step-btn" @click="setSelectedGuideLineWidth(selectedGuideLineWidth + 0.1)">+</button>
          </div>
        </div>
      </div>
      <div v-else class="space-y-2">
        <div>
          <p class="text-xs text-gray-500 mb-1">모눈/점판 색상</p>
          <div class="flex items-center flex-wrap gap-1.5">
            <button v-for="color in STROKE_PALETTE" :key="`grid-line-${color.id}`" class="w-5 h-5 rounded-full border hover:scale-110 transition" :class="selectedGridLineColor === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="setGridLineColor(color.hex)"></button>
          </div>
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1">배경 색상</p>
          <div class="flex items-center flex-wrap gap-1.5">
            <button v-for="color in FILL_PALETTE" :key="`grid-bg-${color.id}`" class="w-5 h-5 rounded-full border hover:scale-110 transition" :class="selectedGridBackgroundColor === color.hex ? 'ring-2 ring-blue-500 border-white' : 'border-gray-300'" :style="{ backgroundColor: color.hex }" :title="cmykTooltip(color)" @click="setGridBackgroundColor(color.hex)"></button>
            <button class="action-btn text-xs px-2 py-1" :class="{ active: selectedGridBackgroundColor === '#FFFFFF' }" @click="setGridBackgroundColor('#FFFFFF')">기본</button>
          </div>
        </div>
      </div>
    </section>

    <section v-if="hasShapeSelection" class="panel-section">
      <h4 class="panel-title">레이어 순서</h4>
      <div class="grid grid-cols-4 gap-2">
        <button class="layer-icon-btn" title="앞으로" @click="reorderLayer('up')">앞</button>
        <button class="layer-icon-btn" title="뒤로" @click="reorderLayer('down')">뒤</button>
        <button class="layer-icon-btn" title="맨 앞으로" @click="reorderLayer('front')">맨앞</button>
        <button class="layer-icon-btn" title="맨 뒤로" @click="reorderLayer('back')">맨뒤</button>
      </div>
    </section>

    <section v-if="!hasTextGuideSelection && !isBlankBoxGuideSelection" class="panel-section">
      <h4 class="panel-title">가이드</h4>
      <div class="space-y-2">
        <label v-if="isShapeGuideAvailable(selectedShape, 'length')" class="toggle-row"><span>길이</span><button class="guide-toggle-btn" @click="hasSelection ? toggleSelectedGuide('length') : toggleGlobalGuide('length')">{{ hasSelection ? getSelectedGuideIndicator('length') : getGlobalGuideIndicator('length') }}</button></label>
        <label v-if="isShapeGuideAvailable(selectedShape, 'radius')" class="toggle-row"><span>반지름/지름</span><button class="guide-toggle-btn" @click="hasSelection ? toggleSelectedGuide('radius') : toggleGlobalGuide('radius')">{{ hasSelection ? getSelectedGuideIndicator('radius') : getGlobalGuideIndicator('radius') }}</button></label>
        <div v-if="hasSelection && selectedShape?.type === 'circle'" class="grid grid-cols-2 gap-2">
          <button class="action-btn text-xs px-2 py-1" :class="{ active: selectedCircleMeasureMode === 'radius' }" @click="setSelectedCircleMeasureMode('radius')">반지름</button>
          <button class="action-btn text-xs px-2 py-1" :class="{ active: selectedCircleMeasureMode === 'diameter' }" @click="setSelectedCircleMeasureMode('diameter')">지름</button>
        </div>
        <label v-if="isShapeGuideAvailable(selectedShape, 'angle')" class="toggle-row"><span>각도</span><button class="guide-toggle-btn" @click="hasSelection ? toggleSelectedGuide('angle') : toggleGlobalGuide('angle')">{{ hasSelection ? getSelectedGuideIndicator('angle') : getGlobalGuideIndicator('angle') }}</button></label>
        <div v-if="isShapeGuideAvailable(selectedShape, 'angle') && !isAngleLineSelection" class="text-xs text-gray-500">각도 자동 표시</div>
        <div v-if="isShapeGuideAvailable(selectedShape, 'angle') && !isAngleLineSelection" class="grid grid-cols-2 gap-2">
          <button class="action-btn text-xs px-2 py-1" :class="{ active: toolStore.angleDisplayMode === 'right' }" @click="toolStore.setAngleDisplayMode('right')">직각만</button>
          <button class="action-btn text-xs px-2 py-1" :class="{ active: toolStore.angleDisplayMode === 'all' }" @click="toolStore.setAngleDisplayMode('all')">모든 각</button>
        </div>
        <label v-if="isShapeGuideAvailable(selectedShape, 'pointName')" class="toggle-row"><span>점 이름</span><button class="guide-toggle-btn" @click="hasSelection ? toggleSelectedGuide('pointName') : toggleGlobalGuide('pointName')">{{ hasSelection ? getSelectedGuideIndicator('pointName') : getGlobalGuideIndicator('pointName') }}</button></label>
        <label v-if="hasSelection && isShapeGuideAvailable(selectedShape, 'point')" class="toggle-row"><span>점</span><button class="guide-toggle-btn" @click="toggleSelectedGuide('point')">{{ getSelectedGuideIndicator('point') }}</button></label>
        <label v-else-if="!hasSelection && hasGlobalApplicableShape('point')" class="toggle-row"><span>점</span><button class="guide-toggle-btn" @click="toggleGlobalGuide('point')">{{ getGlobalGuideIndicator('point') }}</button></label>
        <label v-if="hasSelection && isShapeGuideAvailable(selectedShape, 'height')" class="toggle-row"><span>높이</span><button class="guide-toggle-btn" @click="toggleSelectedGuide('height')">{{ getSelectedGuideIndicator('height') }}</button></label>
        <div v-if="hasSelection && isHeightBaseConfigurable" class="pt-1 border-t border-gray-200">
          <div class="text-xs text-gray-500 mb-1">높이 기준변: {{ selectedHeightBaseLabel }}</div>
          <div class="grid grid-cols-2 gap-2">
            <button class="action-btn text-xs px-2 py-1" @click="cycleSelectedHeightBase(-1)">이전 변</button>
            <button class="action-btn text-xs px-2 py-1" @click="cycleSelectedHeightBase(1)">다음 변</button>
          </div>
        </div>
        <label v-if="!isArrowSelection" class="toggle-row"><span>단위 표시 (cm)</span><button class="guide-toggle-btn" @click="toolStore.setShowGuideUnit(!toolStore.showGuideUnit)">{{ toolStore.showGuideUnit ? '●' : '' }}</button></label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.panel-section {
  @apply bg-gray-50 rounded-xl p-3;
}
.panel-title {
  @apply text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2;
}
.action-btn {
  @apply px-2 py-1.5 rounded-lg text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed;
}
.action-btn.active {
  @apply border-blue-500 bg-blue-50 text-blue-700;
}
.action-btn.danger {
  @apply border-red-200 text-red-600 hover:bg-red-50;
}
.icon-action-btn {
  @apply h-9 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed;
}
.layer-icon-btn {
  @apply h-9 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 transition;
}
.input-sm {
  @apply px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400;
}
.step-btn {
  @apply px-2 py-0.5 border border-gray-300 rounded bg-white hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed;
}
.toggle-row {
  @apply flex items-center justify-between text-sm text-gray-700;
}
.guide-toggle-btn {
  @apply w-5 h-5 rounded border border-gray-300 bg-white text-xs font-semibold leading-none flex items-center justify-center hover:bg-gray-50 transition;
}
.info-row {
  @apply flex items-center justify-between text-sm;
}
.info-key {
  @apply text-gray-500;
}
.info-value {
  @apply text-gray-700 font-medium;
}
.point-row {
  @apply flex items-center justify-between gap-2 text-sm;
}
.point-name-chip {
  @apply inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-gray-700;
}
.color-chip {
  @apply inline-block w-5 h-5 rounded border border-gray-300 bg-transparent cursor-help;
  background-image: linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb),
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb);
  background-position: 0 0, 6px 6px;
  background-size: 12px 12px;
}
</style>
