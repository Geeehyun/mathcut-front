<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, watchEffect } from 'vue'
import Konva from 'konva'
import { useToolStore } from '@/stores/tool'
import { useCanvasStore } from '@/stores/canvas'
import { useShape } from '@/composables/useShape'
import { useGuide } from '@/composables/useGuide'
import {
  snapToGrid,
  snapToSubGrid,
  calculateDistance,
  calculateDistancePixels,
  getRightAngleMarkerPoints,
  getLengthGuideControlPoint,
  createQuadraticCurvePoints,
  distancePointToPolyline,
  formatRoundedValue,
  formatAngleDegrees,
  isRightAngleByThreePoints,
  getRightAngleGuideMarkerPoints,
  computeEquilateralTriangle,
  computeIsoscelesApex,
  computeRightTriangleThirdPoint,
  computeSquare,
  computeRectangle,
  computeRhombus,
  computeParallelogram,
  computeTrapezoidFromThreePoints,
  computeRegularPolygon
} from '@/utils/geometry'
import { GRID_CONFIG, STYLE_COLORS } from '@/types'
import type { Point, Shape, ShapeGuideItemStyle } from '@/types'
import type { KonvaEventObject } from 'konva/lib/Node'
import { formatMathText } from '@/utils/mathText'
import { formatTextGuideDisplayText, renderLatexLikeHtml, toAngleLatex, toBlankAngleLatex, toBlankBoxSuffixLatex, toBlankUnitLatex, toLengthLatex } from '@/utils/latexText'
import { createLatexCanvasSprite } from '@/utils/latexCanvas'
import { useCanvasExport } from '@/composables/useCanvasExport'
import { useCanvasInteraction } from '@/composables/useCanvasInteraction'
import { useCanvasTextEditing } from '@/composables/useCanvasTextEditing'
import { useCanvasTransformPreview } from '@/composables/useCanvasTransformPreview'
import CanvasLatexOverlays from '@/components/canvas/CanvasLatexOverlays.vue'
import CanvasTextEditPanels from '@/components/canvas/CanvasTextEditPanels.vue'
import { MAGENTA_100_HEX } from '@/constants/colorPalette'
import { GUIDE_CONTEXT_THRESHOLD_PX, OPEN_SHAPE_TYPES, isHeightDefaultVisibleType } from '@/constants/shapeRules'
import {
  clipSegmentToRect,
  getGuideBlankRect as getSharedGuideBlankRect,
  getGuideBlankTextPos,
  getGuideBlankWidthMm as getSharedGuideBlankWidthMm,
  getLengthBlankGuideRectWithUnitRect,
  getPolylineLength,
  getLengthGuideCurvePoints as getSharedLengthGuideCurvePoints,
  getLengthGuideLabelPos as getSharedLengthGuideLabelPos,
  getLengthGuideTextRect as getSharedLengthGuideTextRect,
  getLengthGuideTextRects as getSharedLengthGuideTextRects,
  getLengthMainOffsetFromAnchor as getSharedLengthMainOffsetFromAnchor,
  getLengthUnitXFromAnchor as getSharedLengthUnitXFromAnchor,
  segmentIntersectsRect,
  splitPolylineByDistance,
  getShapeAngleTriplet,
  getShapeAutoAngleIndices,
  getShapeAutoLengthIndices,
  getShapeHeightBaseEdgeIndex as getSharedShapeHeightBaseIndex,
  getShapeHeightGuide as getSharedShapeHeightGuide,
  getShapeInteriorAngleInfo,
  getShapeAngleLabelPos as getSharedShapeAngleLabelPos,
  getCircleLengthLabelPos as getSharedCircleLengthLabelPos,
  getShapeHeightLabelPos as getSharedShapeHeightLabelPos,
  getShapeHeightRightAngleMarkerPoints as getSharedShapeHeightRightAngleMarkerPoints,
  getShapeLengthLabelPos as getSharedShapeLengthLabelPos,
  interpolateOnPolyline,
  getPointNameDefaultPos,
  getShapeCentroid,
  getUnitVisualRectFromTopLeft as getSharedUnitVisualRectFromTopLeft
} from '@/utils/shapeGuideLayout'

const toolStore = useToolStore()
const canvasStore = useCanvasStore()
const LENGTH_GUIDE_DEFAULT_COLOR = '#009FE3'
const ANGLE_GUIDE_DEFAULT_COLOR = '#E6007E'
const HEIGHT_GUIDE_DEFAULT_COLOR = '#231815'
const DEFAULT_TEXT_COLOR = '#231815'
const DEFAULT_TEXT_FONT_SIZE = 11
const DEFAULT_TEXT_FONT_FAMILY = 'KaTeX_Main, Batang, Nanum Myeongjo, Noto Serif KR, Times New Roman, serif'
const PT_TO_PX = 96 / 72
const DEFAULT_FILLED_STROKE_PT = 0.4
const DEFAULT_UNFILLED_STROKE_PT = 0.6
const DEFAULT_GUIDE_LINE_PT = 0.4
const DEFAULT_GUIDE_LINE_PX = DEFAULT_GUIDE_LINE_PT * PT_TO_PX
const DEFAULT_HEIGHT_GUIDE_LINE_PT = 0.5
const DEFAULT_HEIGHT_GUIDE_LINE_PX = DEFAULT_HEIGHT_GUIDE_LINE_PT * PT_TO_PX
const GUIDE_DASH_PATTERN = [2, 2]
const LENGTH_CURVE_OFFSET_PX = 24
const CIRCLE_LENGTH_CURVE_OFFSET_PX = LENGTH_CURVE_OFFSET_PX
const HEIGHT_LENGTH_CURVE_OFFSET_PX = 30
const ANGLE_ARC_RADIUS = 20
const ANGLE_LABEL_OUTER_GAP_PX = 5
const RIGHT_ANGLE_LABEL_DIST_MULTIPLIER = 3
const ANGLE_LABEL_EDGE_PADDING_PX = 4
const NON_RIGHT_ANGLE_LABEL_EXTRA_GAP_PX = 4
const ANGLE_LABEL_BASELINE_COMPENSATION_RATIO = 0.09
const NON_RIGHT_ANGLE_BASELINE_LIFT_PX = 4
const OBTUSE_ANGLE_START_DEG = 100
const OBTUSE_ANGLE_GAP_REDUCE_MAX_PX = 3
const OBTUSE_ANGLE_LIFT_REDUCE_MAX_PX = 2
const RIGHT_ANGLE_LABEL_QUADRANT_X_RATIO = 0.56
const RIGHT_ANGLE_LABEL_VERTICAL_BASE_RATIO = -0.27
const RIGHT_ANGLE_LABEL_VERTICAL_QUADRANT_RATIO = -0.36
const HEIGHT_LABEL_HORIZONTAL_OFFSET_PX = 8
const BASE_LABEL_VERTICAL_BIAS_PX = 8
const RIGHT_ANGLE_MARKER_SIZE = 9
const GUIDE_RIGHT_ANGLE_MARKER_SIZE = 10
const POINT_VISIBLE_DEFAULT_TYPES = new Set(['segment', 'ray', 'line', 'angle-line'])
const MM_TO_PX = 96 / 25.4
const BLANK_BASE_HEIGHT_MM = 7
const BLANK_BASE_WIDTH_MM = 7
const BLANK_WIDTH_STEP_MM = 0.5
const BLANK_WIDTH_MIN_MM = 3
const BLANK_WIDTH_MAX_MM = 50
const BLANK_BORDER_COLOR = '#333333' // K80
const BLANK_BORDER_WIDTH_PX = 0.5 * PT_TO_PX
const GRID_MINOR_OPACITY = 0.45
const GRID_MAJOR_OPACITY = 0.8
const GRID_MINOR_LINE_WIDTH = 1
const GRID_MAJOR_LINE_WIDTH = 1.5
const GRID_DOT_OPACITY = 0.85
const GRID_DOT_RADIUS = 2
const { handlePointClick: handleShapeClick } = useShape()
const {
  handleCanvasClick,
  startLengthGuideDrag,
  updateLengthGuideDrag,
  finishLengthGuideDrag,
  lengthGuidePreview,
  createTextGuide
} = useGuide()
const props = withDefaults(defineProps<{
  interactionLocked?: boolean
}>(), {
  interactionLocked: false
})

// Base canvas size (used as minimum stage size)
const canvasWidth = GRID_CONFIG.size * GRID_CONFIG.width
const canvasHeight = GRID_CONFIG.size * GRID_CONFIG.height
const stageRef = ref<any>(null)
const zoomScale = computed(() => toolStore.zoom / 100)

// Track container size (for responsive stage sizing)
const containerRef = ref<HTMLDivElement | null>(null)
const containerSize = ref({ width: canvasWidth, height: canvasHeight })
let resizeObserver: ResizeObserver | null = null

function getTargetPixelRatio() {
  // Math.ceil로 소수 DPR(Windows 125%/150% 배율)을 정수로 올림 → pixel 경계 정렬
  return Math.min(Math.ceil(window.devicePixelRatio || 1), 2)
}

function snapTextValue(value: number) {
  const step = 1 / getTargetPixelRatio()
  return Math.round(value / step) * step
}

function snapTextPoint(point: { x: number, y: number }) {
  return {
    x: snapTextValue(point.x),
    y: snapTextValue(point.y)
  }
}

function applyStagePixelRatio() {
  const stage = stageRef.value?.getNode?.()
  if (!stage) return
  const pixelRatio = getTargetPixelRatio()
  Konva.pixelRatio = pixelRatio
  for (const layer of stage.getLayers()) {
    layer.getCanvas().setPixelRatio(pixelRatio)
    layer.batchDraw()
  }
}

onMounted(() => {
  if (containerRef.value) {
    const update = () => {
      if (containerRef.value) {
        containerSize.value = {
          width: containerRef.value.clientWidth,
          height: containerRef.value.clientHeight
        }
      }
    }
    update()
    resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(containerRef.value)
  }
  applyStagePixelRatio()
  window.addEventListener('resize', applyStagePixelRatio)
  window.addEventListener('keydown', handleWindowKeydown)
  window.addEventListener('keyup', handleWindowKeyup)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', applyStagePixelRatio)
  window.removeEventListener('keydown', handleWindowKeydown)
  window.removeEventListener('keyup', handleWindowKeyup)
})

function handleWindowKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (e.code === 'Space') {
    isSpacePressed.value = true
    if (toolStore.mode === 'select' && toolStore.zoom > 100) {
      e.preventDefault()
    }
  }
}

function handleWindowKeyup(e: KeyboardEvent) {
  if (e.code === 'Space') {
    isSpacePressed.value = false
  }
}

function handleWheel(e: WheelEvent) {
  const isZoomGesture = e.ctrlKey || e.metaKey
  if (!isZoomGesture) return
  e.preventDefault()
  const step = e.deltaY < 0 ? 10 : -10
  toolStore.setZoom(toolStore.zoom + step)
}

// Rendered stage size: fill container while keeping minimum canvas size
const stageWidth = computed(() => Math.max(canvasWidth, containerSize.value.width))
const stageHeight = computed(() => Math.max(canvasHeight, containerSize.value.height))
const gridShapeRenderKey = computed(
  () => `${toolStore.gridMode}:${toolStore.gridLineColor}:${stageWidth.value}x${stageHeight.value}`
)
const shapeMap = computed(() => new Map(canvasStore.shapes.map((shape) => [shape.id, shape])))
const guideMap = computed(() => new Map(canvasStore.guides.map((guide) => [guide.id, guide])))
const topLevelRenderItems = computed(() => {
  return canvasStore.topLevelOrder
    .map((itemKey) => {
      if (itemKey.startsWith('shape:')) {
        const shape = shapeMap.value.get(itemKey.slice(6))
        return shape ? { kind: 'shape' as const, shape } : null
      }
      if (itemKey.startsWith('guide:')) {
        const guide = guideMap.value.get(itemKey.slice(6))
        return guide && !guide.shapeId ? { kind: 'guide' as const, guide } : null
      }
      return null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
})
const selectedTextGuideId = ref<string | null>(null)
const shapeGuideValueEditState = ref<{
  shapeId: string
  guideKey: 'length' | 'angle' | 'height'
  itemIndex: number
  rawX: number
  rawY: number
} | null>(null)
const shapeGuideValue = ref('')
const shapeGuideValueLabel = ref<'길이' | '각도' | '높이'>('길이')
const shapeGuideApplyToGeometry = ref(false)

const emit = defineEmits<{
  mouseMove: [pos: { x: number; y: number } | null]
  contextmenu: [payload: {
    x: number
    y: number
    target:
      | { kind: 'shape', shapeId: string }
      | { kind: 'guide', guideId: string }
      | { kind: 'shape-guide-item', shapeId: string, guideKey: 'length' | 'angle' | 'pointName' | 'height', itemIndex: number }
      | null
  }]
}>()

const {
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
  confirmPointLabelEdit,
  cancelPointLabelEdit,
  handlePointLabelDblClick,
  handleLatexPointOverlayDblClick,
  getGlobalPointLabel,
  latexPointLabelOverlays,
  latexTextGuideOverlays,
} = useCanvasTextEditing({
  canvasStore,
  toolStore,
  defaultTextFontSize: DEFAULT_TEXT_FONT_SIZE,
  createTextGuide,
  getTextGuideAnchor,
  getTextGuideFontSize,
  getTextGuideRotation,
  isShapeGuideVisible,
  isShapeGuideItemVisible,
  isShapeGuideItemBlank,
  getShapePointNameTextPos,
  getShapeGuideItemStyle,
})

const {
  hoveredShapeId,
  suppressCanvasClick,
  suppressNativeContextMenu,
  mousePos,
  isSpacePressed,
  panDrag,
  viewportOffset,
  shapeDrag,
  vertexDrag,
  transformDrag,
  guideTextDrag,
  hoveredTextGuideId,
  hoveredBlankBoxGuideId,
  textGuideDrag,
  blankBoxGuideDrag,
  textGuideTransformDrag,
  hoveredVertex,
  hoveredVertexKey,
  hoveredGuideTextKey,
  clampViewportOffset,
  getLogicalPointerPos,
  handleMouseDown,
  handleMouseLeave,
  handleMouseMove,
  handleMouseUp,
  handleShapeNodeClick,
  handleShapeNodeMouseDown,
  handleTextGuideMouseEnter,
  handleTextGuideMouseLeave,
  handleBlankBoxGuideMouseEnter,
  handleBlankBoxGuideMouseLeave,
  handleTextGuideClick,
  handleTextGuideMouseDown,
  handleBlankBoxGuideClick,
  handleBlankBoxGuideMouseDown,
  handleTextGuideDblClick,
  handleTextGuideOverlayMouseDown,
  handleVertexHandleMouseDown,
  handleVertexHandleClick,
  getVertexKey,
  handleVertexMouseEnter,
  handleVertexMouseLeave,
  getGuideTextKey,
  handleGuideTextMouseEnter,
  handleGuideTextMouseLeave,
  handleScaleHandleMouseDown,
  handleTextGuideScaleHandleMouseDown,
  handleShapeGuideTextMouseDown,
  handleLatexPointLabelMouseDown,
  handleLatexShapeGuideMouseDown,
  handleLatexOverlayMouseUp,
  handleRotateHandleMouseDown,
  handleTextGuideRotateHandleMouseDown,
  handleShapeNodeMouseEnter,
  handleShapeNodeMouseLeave,
} = useCanvasInteraction({
  interactionLocked: computed(() => props.interactionLocked),
  stageRef,
  toolStore,
  canvasStore,
  zoomScale,
  stageWidth,
  stageHeight,
  containerSize,
  selectedTextGuideId,
  emitMouseMove: (pos) => emit('mouseMove', pos),
  cancelTextInput,
  startLengthGuideDrag,
  updateLengthGuideDrag,
  finishLengthGuideDrag,
  logAngleGuidePlacement,
  startTextGuideEdit,
  getShapeCentroid,
  getTextGuideAnchor,
  getTextGuideFontSize,
  getTextGuideRotation,
  getShapeGuideItemOffset,
})

watch(
  () => canvasStore.selectedGuide,
  (guide) => {
    selectedTextGuideId.value = guide?.type === 'text' ? guide.id : null
  },
  { immediate: true }
)
// Set cursor style directly on Konva container DOM.
watchEffect(() => {
  const stage = stageRef.value?.getNode?.()
  if (!stage) return
  const container = stage.container()
  const isDraggingDraggable = !!shapeDrag.value
    || !!guideTextDrag.value
    || !!textGuideDrag.value
    || !!blankBoxGuideDrag.value
  const isHoveringDraggable = !!hoveredShapeId.value
    || !!hoveredGuideTextKey.value
    || !!hoveredTextGuideId.value
    || !!hoveredBlankBoxGuideId.value
  if (toolStore.mode === 'select' && toolStore.zoom > 100 && panDrag.value) {
    container.style.cursor = 'grabbing'
    return
  }
  if (toolStore.mode === 'select' && toolStore.zoom > 100 && isSpacePressed.value) {
    container.style.cursor = 'grab'
    return
  }
  if (toolStore.mode === 'select') {
    if (vertexDrag.value) {
      container.style.cursor = 'grabbing'
    } else if (hoveredVertex.value) {
      container.style.cursor = 'pointer'
    } else if (isDraggingDraggable) {
      container.style.cursor = 'grabbing'
    } else if (isHoveringDraggable) {
      container.style.cursor = 'grab'
    } else {
      container.style.cursor = 'default'
    }
  } else {
    container.style.cursor = 'crosshair'
  }
})
watchEffect(() => {
  const clamped = clampViewportOffset(viewportOffset.value.x, viewportOffset.value.y)
  if (clamped.x !== viewportOffset.value.x || clamped.y !== viewportOffset.value.y) {
    viewportOffset.value = clamped
  }
})

watchEffect(() => {
  stageRef.value
  containerSize.value.width
  containerSize.value.height
  toolStore.zoom
  applyStagePixelRatio()
})

function drawGridLines(context: any, shape: any) {
  const numCols = Math.ceil(stageWidth.value / GRID_CONFIG.size)
  const numRows = Math.ceil(stageHeight.value / GRID_CONFIG.size)

  // minor lines
  context.beginPath()
  for (let i = 0; i <= numCols; i++) {
    if (i % GRID_CONFIG.majorInterval === 0) continue
    const x = Math.round(i * GRID_CONFIG.size) + 0.5
    context.moveTo(x, 0)
    context.lineTo(x, stageHeight.value)
  }
  for (let i = 0; i <= numRows; i++) {
    if (i % GRID_CONFIG.majorInterval === 0) continue
    const y = Math.round(i * GRID_CONFIG.size) + 0.5
    context.moveTo(0, y)
    context.lineTo(stageWidth.value, y)
  }
  context.strokeStyle = toolStore.gridLineColor
  context.globalAlpha = GRID_MINOR_OPACITY
  context.lineWidth = GRID_MINOR_LINE_WIDTH
  context.stroke()

  // major lines
  context.beginPath()
  for (let i = 0; i <= numCols; i++) {
    if (i % GRID_CONFIG.majorInterval !== 0) continue
    const x = Math.round(i * GRID_CONFIG.size) + 0.5
    context.moveTo(x, 0)
    context.lineTo(x, stageHeight.value)
  }
  for (let i = 0; i <= numRows; i++) {
    if (i % GRID_CONFIG.majorInterval !== 0) continue
    const y = Math.round(i * GRID_CONFIG.size) + 0.5
    context.moveTo(0, y)
    context.lineTo(stageWidth.value, y)
  }
  context.strokeStyle = toolStore.gridLineColor
  context.globalAlpha = GRID_MAJOR_OPACITY
  context.lineWidth = GRID_MAJOR_LINE_WIDTH
  context.stroke()
  context.globalAlpha = 1

  context.fillStrokeShape(shape)
}

function drawMainGridDots(context: any, shape: any) {
  const numCols = Math.ceil(stageWidth.value / GRID_CONFIG.size)
  const numRows = Math.ceil(stageHeight.value / GRID_CONFIG.size)

  context.beginPath()
  for (let gx = 0; gx <= numCols; gx++) {
    for (let gy = 0; gy <= numRows; gy++) {
      const x = gx * GRID_CONFIG.size
      const y = gy * GRID_CONFIG.size
      context.moveTo(x + GRID_DOT_RADIUS, y)
      context.arc(x, y, GRID_DOT_RADIUS, 0, Math.PI * 2)
    }
  }
  context.fillStyle = toolStore.gridLineColor
  context.globalAlpha = GRID_DOT_OPACITY
  context.fill()
  context.globalAlpha = 1
  context.fillStrokeShape(shape)
}

// Canvas click handler
function handleClick(e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  // Ignore non-left clicks while drawing.
  if (e.evt.button !== 0) return

  if (suppressCanvasClick.value) {
    suppressCanvasClick.value = false
    return
  }

  const stage = e.target.getStage()
  if (!stage) return

  const pos = getLogicalPointerPos(stage)
  if (!pos) return

  const useSubGrid =
    (toolStore.mode === 'shape' && (
      toolStore.shapeType === 'point-on-object'
      || toolStore.shapeType === 'arrow'
      || toolStore.shapeType === 'arrow-curve'
    ))
    || (toolStore.mode === 'guide' && (
      toolStore.guideType === 'text'
      || toolStore.guideType === 'blank-box'
    ))
  const point = useSubGrid ? snapToSubGrid(pos.x, pos.y) : snapToGrid(pos.x, pos.y)

  if (toolStore.mode === 'select') {
    canvasStore.selectShape(null)
    canvasStore.selectGuide(null)
    selectedTextGuideId.value = null
  } else if (toolStore.mode === 'shape') {
    handleShapeClick(point)
  } else {
    if (toolStore.guideType === 'text') {
      openTextInput(point, pos.x, pos.y)
      return
    }
    handleCanvasClick(point, pos)
  }
}

function getTextGuideAnchor(guide: { points: Point[] }): { x: number, y: number } {
  const p = guide.points[0]
  return {
    x: p?.x ?? 0,
    y: (p?.y ?? 0) - 20
  }
}

function getTextGuideFontSize(guide: { fontSize?: number }): number {
  return guide.fontSize || DEFAULT_TEXT_FONT_SIZE
}

function getBlankBoxRect(guide: { points: Point[] }) {
  const p1 = guide.points[0]
  const p2 = guide.points[1]
  if (!p1 || !p2) {
    const width = BLANK_BASE_WIDTH_MM * MM_TO_PX
    const height = BLANK_BASE_HEIGHT_MM * MM_TO_PX
    return { x: 0, y: 0, width, height, cornerRadius: Math.min(height * 0.22, 8) }
  }
  const centerX = (p1.x + p2.x) / 2
  const centerY = (p1.y + p2.y) / 2
  const widthMm = Number((guide as any).blankWidthMm)
  const width = Math.max(8, (Number.isFinite(widthMm) ? widthMm : BLANK_BASE_WIDTH_MM) * MM_TO_PX)
  const height = BLANK_BASE_HEIGHT_MM * MM_TO_PX
  const x = centerX - width / 2
  const y = centerY - height / 2
  return { x, y, width, height, cornerRadius: Math.min(height * 0.22, 8) }
}

function getBlankBoxUnitMode(guide: { blankUnitMode?: 'none' | 'cm' | 'angle' }): 'none' | 'cm' | 'angle' {
  return guide.blankUnitMode === 'cm' || guide.blankUnitMode === 'angle' ? guide.blankUnitMode : 'none'
}

function getBlankBoxSuffixText(guide: { blankUnitMode?: 'none' | 'cm' | 'angle' }): string {
  const mode = getBlankBoxUnitMode(guide)
  if (mode === 'cm') return 'cm'
  if (mode === 'angle') return '°'
  return ''
}

function getBlankBoxSuffixPos(guide: { points: Point[], fontSize?: number, blankUnitMode?: 'none' | 'cm' | 'angle' }): { x: number, y: number } {
  const rect = getBlankBoxRect(guide)
  const fontSize = guide.fontSize || DEFAULT_TEXT_FONT_SIZE
  return getGuideBlankTextPos(rect, fontSize, getBlankBoxUnitMode(guide) === 'cm' ? GRID_CONFIG.size / 2 : 4)
}

function getBlankBoxSuffixLatexPos(guide: { points: Point[], fontSize?: number, blankUnitMode?: 'none' | 'cm' | 'angle' }): { x: number, y: number } {
  const pos = getBlankBoxSuffixPos(guide)
  if (getBlankBoxUnitMode(guide) === 'angle') {
    return {
      x: pos.x - 3,
      y: pos.y - 3
    }
  }
  return pos
}

function getTextGuideRotation(guide: { rotation?: number }): number {
  return Number.isFinite(guide.rotation) ? Number(guide.rotation) : 0
}

function isTextGuideHighlighted(guideId: string): boolean {
  return hoveredTextGuideId.value === guideId || selectedTextGuideId.value === guideId
}

function isBlankBoxGuideHighlighted(guideId: string): boolean {
  return hoveredBlankBoxGuideId.value === guideId || canvasStore.selectedGuideId === guideId
}

function getBlankGuideHighlightConfig(highlighted: boolean) {
  return {
    stroke: highlighted ? '#38BDF8' : BLANK_BORDER_COLOR,
    strokeWidth: highlighted ? BLANK_BORDER_WIDTH_PX + 1 : BLANK_BORDER_WIDTH_PX,
    shadowColor: highlighted ? '#0EA5E9' : 'transparent',
    shadowBlur: highlighted ? 10 : 0,
    shadowOpacity: highlighted ? 0.45 : 0
  }
}

function handleTextGuideOverlayContextMenu(guideId: string, e: MouseEvent) {
  e.preventDefault()
  suppressNativeContextMenu.value = true
  emit('contextmenu', {
    x: e.clientX,
    y: e.clientY,
    target: { kind: 'guide', guideId }
  })
}

function isShapeHovered(shapeId: string): boolean {
  return toolStore.mode === 'select' && hoveredShapeId.value === shapeId
}

function isShapeSelected(shapeId: string): boolean {
  return canvasStore.selectedShapeId === shapeId
}

function getShapeShadowConfig(shapeId: string): { color: string, blur: number, opacity: number } {
  const shape = shapeMap.value.get(shapeId)
  const strokeColor = shape ? getColors(shape).stroke : '#111827'
  // If stroke is none(transparent), use neutral dark color for hover/selection affordance.
  const shadowColor = strokeColor === 'transparent' ? '#111827' : strokeColor
  if (isShapeSelected(shapeId)) {
    // selection: clearer and tighter
    return { color: shadowColor, blur: 14, opacity: 0.5 }
  }
  if (isShapeHovered(shapeId)) {
    // hover: lighter than selection
    return { color: shadowColor, blur: 9, opacity: 0.34 }
  }
  return { color: 'transparent', blur: 0, opacity: 0 }
}

function isVertexHovered(shapeId: string, pointIndex: number): boolean {
  return hoveredVertexKey.value === getVertexKey(shapeId, pointIndex)
}

function isGuideTextHighlighted(shapeId: string, guideKey: 'length' | 'angle' | 'pointName' | 'height', itemIndex: number): boolean {
  const key = getGuideTextKey(shapeId, guideKey, itemIndex)
  const dragging = !!guideTextDrag.value
    && guideTextDrag.value.shapeId === shapeId
    && guideTextDrag.value.guideKey === guideKey
    && guideTextDrag.value.itemIndex === itemIndex
  return dragging || hoveredGuideTextKey.value === key
}

function isTextGuideDragging(guideId: string): boolean {
  return textGuideDrag.value?.guideId === guideId
}

function isPointGuideDragging(shapeId: string, pointIndex: number): boolean {
  return guideTextDrag.value?.shapeId === shapeId
    && guideTextDrag.value?.guideKey === 'pointName'
    && guideTextDrag.value?.itemIndex === pointIndex
}

function isShapeGuideDragging(shapeId: string, guideKey: 'length' | 'angle' | 'height', itemIndex: number): boolean {
  return guideTextDrag.value?.shapeId === shapeId
    && guideTextDrag.value?.guideKey === guideKey
    && guideTextDrag.value?.itemIndex === itemIndex
}

function handleGuideContextMenu(guideId: string, e: KonvaEventObject<PointerEvent>) {
  e.evt.preventDefault()
  e.cancelBubble = true
  suppressNativeContextMenu.value = true
  const guide = canvasStore.guides.find((g) => g.id === guideId)
  if (guide) {
    canvasStore.selectGuide(guideId)
    if (guide.type === 'text') {
      selectedTextGuideId.value = guideId
    }
  }
  emit('contextmenu', {
    x: e.evt.clientX,
    y: e.evt.clientY,
    target: { kind: 'guide', guideId }
  })
}

function handleShapeGuideItemContextMenu(
  shapeId: string,
  guideKey: 'length' | 'angle' | 'pointName' | 'height',
  itemIndex: number,
  e: KonvaEventObject<PointerEvent>
) {
  e.evt.preventDefault()
  e.cancelBubble = true
  suppressNativeContextMenu.value = true
  emit('contextmenu', {
    x: e.evt.clientX,
    y: e.evt.clientY,
    target: { kind: 'shape-guide-item', shapeId, guideKey, itemIndex }
  })
}

function getShapeIdFromNode(node: any): string | null {
  let current = node
  while (current) {
    const name = typeof current.name === 'function' ? current.name() : ''
    if (typeof name === 'string' && name.startsWith('shape-hit-')) {
      return name.replace('shape-hit-', '')
    }
    current = typeof current.getParent === 'function' ? current.getParent() : null
  }
  return null
}

function getGuideIdFromNode(node: any): string | null {
  let current = node
  while (current) {
    const name = typeof current.name === 'function' ? current.name() : ''
    if (typeof name === 'string' && name.startsWith('guide-hit-')) {
      return name.replace('guide-hit-', '')
    }
    current = typeof current.getParent === 'function' ? current.getParent() : null
  }
  return null
}

function findGuideIdFromRawPoint(raw: { x: number, y: number }): string | null {
  const threshold = GUIDE_CONTEXT_THRESHOLD_PX
  let bestId: string | null = null
  let bestDist = Infinity
  const distPoint = (x: number, y: number) => Math.hypot(raw.x - x, raw.y - y)

  for (const guide of canvasStore.guides) {
    if (guide.visible === false) continue

    let d = Infinity
    if (guide.type === 'length' && toolStore.showLength) {
      d = distancePointToPolyline(raw, getLengthGuideCurvePoints(guide))
      const labelPos = getLengthGuideLabelPos(guide)
      d = Math.min(d, distPoint(labelPos.x, labelPos.y - 16))
    } else if (guide.type === 'text') {
      const anchor = getTextGuideAnchor(guide)
      d = distPoint(anchor.x, anchor.y)
    } else if (guide.type === 'blank-box' && guide.points.length >= 2) {
      const rect = getBlankBoxRect(guide)
      const centerX = rect.x + rect.width / 2
      const centerY = rect.y + rect.height / 2
      d = Math.hypot(raw.x - centerX, raw.y - centerY)
    } else if (guide.type === 'angle' && toolStore.showAngle) {
      if (isRightAngleGuide(guide.points)) {
        const marker = getRightAngleGuideMarkerPoints(guide.points[0], guide.points[1], guide.points[2], GUIDE_RIGHT_ANGLE_MARKER_SIZE)
        d = distancePointToPolyline(raw, [marker.p1.x, marker.p1.y, marker.corner.x, marker.corner.y, marker.p2.x, marker.p2.y])
      } else {
        d = distancePointToPolyline(raw, getAngleArcPoints(guide.points))
      }
      d = Math.min(d, distPoint(guide.points[1].x + 24, guide.points[1].y - 18))
    }

    if (d < threshold && d < bestDist) {
      bestDist = d
      bestId = guide.id
    }
  }

  return bestId
}

function handleShapeContextMenu(id: string, e: KonvaEventObject<PointerEvent>) {
  e.evt.preventDefault()
  e.cancelBubble = true
  suppressNativeContextMenu.value = true
  canvasStore.selectShape(id)
  emit('contextmenu', {
    x: e.evt.clientX,
    y: e.evt.clientY,
    target: { kind: 'shape', shapeId: id }
  })
}

function handleNativeContextMenu(e: MouseEvent) {
  e.preventDefault()
  if (suppressNativeContextMenu.value) {
    suppressNativeContextMenu.value = false
    return
  }

  // Right-click works like ESC: cancel current drawing state.
  if (toolStore.tempPoints.length > 0 || textInputState.value || pointLabelEditState.value) {
    toolStore.clearTempPoints()
    canvasStore.selectShape(null)
    cancelTextInput()
    cancelPointLabelEdit()
    cancelTextGuideEdit()
  }
  shapeDrag.value = null
  vertexDrag.value = null
  transformDrag.value = null
  guideTextDrag.value = null
  textGuideDrag.value = null
  textGuideTransformDrag.value = null

  const stage = stageRef.value?.getNode?.()
  let target: { kind: 'guide', guideId: string } | { kind: 'shape', shapeId: string } | null = null
  if (stage) {
    stage.setPointersPositions(e)
    const pos = getLogicalPointerPos(stage)
    if (pos) {
      const node = stage.getIntersection(pos)
      const guideIdFromNode = getGuideIdFromNode(node)
      if (guideIdFromNode) {
        target = { kind: 'guide', guideId: guideIdFromNode }
      } else {
        const guideId = findGuideIdFromRawPoint(pos)
        if (guideId) {
          target = { kind: 'guide', guideId }
        } else {
          const shapeId = getShapeIdFromNode(node) ?? null
          if (shapeId) target = { kind: 'shape', shapeId }
        }
      }
      if (!target) {
        const shapeId = getShapeIdFromNode(node) ?? null
        if (shapeId) target = { kind: 'shape', shapeId }
      }
    }
  }
  emit('contextmenu', {
    x: e.clientX,
    y: e.clientY,
    target
  })
  if (target?.kind === 'guide') {
    const guide = canvasStore.guides.find((g) => g.id === target.guideId)
    if (guide) {
      canvasStore.selectGuide(guide.id)
      if (guide.type === 'text') {
        selectedTextGuideId.value = guide.id
      }
    }
  }
}

// Guide node name for native context-menu fallback hit testing
function getGuideNodeName(guideId: string) {
  return `guide-hit-${guideId}`
}

// Convert point objects to flat polygon points array
function getPolygonPoints(points: { x: number, y: number }[]): number[] {
  return points.flatMap(p => [p.x, p.y])
}

// style color resolved with custom override first
function getColors(shape: Shape) {
  const circleDefaultPointColor = MAGENTA_100_HEX
  if (shape.color) {
    const base = STYLE_COLORS[shape.style] || STYLE_COLORS.default
    const stroke = shape.color.stroke === 'none' ? 'transparent' : shape.color.stroke
    const fill = shape.color.fill === 'none' ? undefined : shape.color.fill
    const defaultPoint = shape.type === 'circle' ? circleDefaultPointColor : base.point
    const point = shape.color.point
      || (stroke === 'transparent' ? defaultPoint : stroke)
    return {
      stroke,
      fill,
      point,
      // Keep guide default colors style-based even when shape stroke changes.
      label: base.label,
      rightAngle: base.rightAngle
    }
  }
  const base = STYLE_COLORS[shape.style] || STYLE_COLORS.default
  return shape.type === 'circle'
    ? { ...base, point: circleDefaultPointColor }
    : base
}

function getShapeDefaultStrokeWidthPt(shape: Shape): number {
  const isFilled = !OPEN_SHAPE_TYPES.has(shape.type) && shape.color?.fill !== 'none'
  return isFilled ? DEFAULT_FILLED_STROKE_PT : DEFAULT_UNFILLED_STROKE_PT
}

function getShapeStrokeWidthPx(shape: Shape): number {
  const strokeWidthPt = typeof shape.strokeWidthPt === 'number'
    ? Math.max(0.1, Math.min(12, shape.strokeWidthPt))
    : getShapeDefaultStrokeWidthPt(shape)
  return strokeWidthPt * PT_TO_PX
}

function isShapeHeightDefaultVisible(shape: Shape): boolean {
  return isHeightDefaultVisibleType(shape.type)
}

function isShapePointDefaultVisible(shape: Shape, _pointIndex: number): boolean {
  if (shape.type === 'point' || shape.type === 'point-on-object') return true
  if (shape.type === 'circle') return true
  return POINT_VISIBLE_DEFAULT_TYPES.has(shape.type)
}

function isShapePointVisible(shape: Shape, pointIndex: number): boolean {
  if (shape.type === 'circle') {
    const visible = typeof shape.guideVisibility?.point === 'boolean'
      ? shape.guideVisibility.point
      : isShapePointDefaultVisible(shape, pointIndex)
    return visible && pointIndex === 0
  }
  if (typeof shape.guideVisibility?.point === 'boolean') {
    return shape.guideVisibility.point
  }
  return isShapePointDefaultVisible(shape, pointIndex)
}

function getCircleMeasureMode(shape: Shape): 'radius' | 'diameter' {
  return shape.circleMeasureMode === 'diameter' ? 'diameter' : 'radius'
}

function isShapeGuideVisible(shape: Shape, key: 'length' | 'radius' | 'angle' | 'pointName' | 'height' | 'point'): boolean {
  if (key === 'point') {
    return isShapePointVisible(shape, 0)
  }
  if (key === 'radius') {
    if (shape.type !== 'circle') return false
    return shape.guideVisibility?.radius !== false
  }
  if (key === 'length' && shape.type === 'circle') {
    return false
  }
  if (key === 'height') {
    if (typeof shape.guideVisibility?.height === 'boolean') {
      return shape.guideVisibility.height
    }
    return isShapeHeightDefaultVisible(shape)
  }
  return shape.guideVisibility?.[key] !== false
}

function isShapeGuideItemVisible(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number): boolean {
  if (key === 'length') {
    return !shape.guideVisibility?.lengthHiddenIndices?.includes(index)
  }
  if (key === 'angle') {
    return !shape.guideVisibility?.angleHiddenIndices?.includes(index)
  }
  if (key === 'height') {
    return !shape.guideVisibility?.heightHiddenIndices?.includes(index)
  }
  if (shape.type === 'circle') {
    return index === 0 && !shape.guideVisibility?.pointNameHiddenIndices?.includes(index)
  }
  return !shape.guideVisibility?.pointNameHiddenIndices?.includes(index)
}

function getShapeGuideItemStyle(
  shape: Shape,
  key: 'length' | 'angle' | 'pointName' | 'height',
  index: number
): ShapeGuideItemStyle {
  return shape.guideStyleMap?.[key]?.[index] ?? {}
}

function makePoint(x: number, y: number): Point {
  return {
    x,
    y,
    gridX: x / GRID_CONFIG.size,
    gridY: y / GRID_CONFIG.size,
  }
}

function parseNumericGuideValue(raw: string): number | null {
  const normalized = raw.replace(/cm/gi, '').replace(/°/g, '').trim()
  if (!normalized) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function clearShapeGuideCustomText(
  shape: Shape,
  key: 'length' | 'angle' | 'height',
  index: number
): Shape {
  if (key === 'height') return shape
  const map = { ...(shape.guideStyleMap || {}) }
  const byKey = { ...(map[key] || {}) }
  const prev = { ...(byKey[index] || {}) }
  delete prev.customText
  if (Object.keys(prev).length > 0) {
    byKey[index] = prev
  } else {
    delete byKey[index]
  }
  if (Object.keys(byKey).length > 0) {
    map[key] = byKey
  } else {
    delete map[key]
  }
  return {
    ...shape,
    guideStyleMap: Object.keys(map).length > 0 ? map : undefined,
  }
}

function setShapeGuideCustomText(
  shape: Shape,
  key: 'length' | 'angle' | 'height',
  index: number,
  text: string
): Shape {
  const map = { ...(shape.guideStyleMap || {}) }
  const byKey = { ...(map[key] || {}) }
  const prev = { ...(byKey[index] || {}) }
  byKey[index] = {
    ...prev,
    customText: text,
  }
  map[key] = byKey
  return {
    ...shape,
    guideStyleMap: map,
  }
}

function scaleShapePoints(points: Point[], center: Point, factor: number): Point[] {
  return points.map((point) => makePoint(
    center.x + (point.x - center.x) * factor,
    center.y + (point.y - center.y) * factor,
  ))
}

function updateShapeLengthByRatio(shape: Shape, itemIndex: number, targetValue: number): Shape {
  if (shape.type === 'circle') {
    const center = shape.points[0]
    const edge = shape.points[1]
    if (!center || !edge) return shape
    const currentRadius = calculateDistance(center, edge)
    const currentValue = shape.circleMeasureMode === 'diameter' ? currentRadius * 2 : currentRadius
    if (currentValue <= 1e-6) return shape
    const factor = targetValue / currentValue
    const nextEdge = makePoint(
      center.x + (edge.x - center.x) * factor,
      center.y + (edge.y - center.y) * factor,
    )
    return clearShapeGuideCustomText({
      ...shape,
      points: [center, nextEdge],
    }, 'length', 0)
  }

  const p1 = shape.points[itemIndex]
  const p2 = shape.points[(itemIndex + 1) % shape.points.length]
  if (!p1 || !p2) return shape
  const currentLength = calculateDistance(p1, p2)
  if (currentLength <= 1e-6) return shape
  const factor = targetValue / currentLength
  const center = shape.type === 'segment' || shape.type === 'ray' || shape.type === 'line' || shape.type === 'angle-line'
    ? makePoint(
      shape.points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, shape.points.length),
      shape.points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, shape.points.length),
    )
    : makePoint(
      shape.points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, shape.points.length),
      shape.points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, shape.points.length),
    )
  return clearShapeGuideCustomText({
    ...shape,
    points: scaleShapePoints(shape.points, center, factor),
  }, 'length', itemIndex)
}

function updateShapeHeightByRatio(shape: Shape, targetValue: number): Shape {
  const heightGuide = getShapeHeightGuide(shape)
  if (!heightGuide) return shape
  const currentHeight = calculateDistance(heightGuide.apex, heightGuide.foot)
  if (currentHeight <= 1e-6) return shape
  const factor = targetValue / currentHeight
  const baseIndex = getSharedShapeHeightBaseIndex(shape)
  const baseAIndex = baseIndex
  const baseBIndex = (baseIndex + 1) % shape.points.length
  const baseA = shape.points[baseAIndex]
  const baseB = shape.points[baseBIndex]
  if (!baseA || !baseB) return shape

  const dx = baseB.x - baseA.x
  const dy = baseB.y - baseA.y
  const lenSq = dx * dx + dy * dy
  if (lenSq <= 1e-6) return shape

  const nextPoints = shape.points.map((point, index) => {
    if (index === baseAIndex || index === baseBIndex) return point
    const t = ((point.x - baseA.x) * dx + (point.y - baseA.y) * dy) / lenSq
    const projX = baseA.x + dx * t
    const projY = baseA.y + dy * t
    const offX = point.x - projX
    const offY = point.y - projY
    return makePoint(projX + offX * factor, projY + offY * factor)
  })

  return {
    ...shape,
    points: nextPoints,
  }
}

function normalizeAngleDeltaRadians(radians: number): number {
  let next = radians
  while (next <= -Math.PI) next += Math.PI * 2
  while (next > Math.PI) next -= Math.PI * 2
  return next
}

function updateShapeAngleByValue(shape: Shape, itemIndex: number, targetValue: number): Shape {
  const pointCount = shape.points.length
  if (pointCount < 3) return shape
  const prevIndex = (itemIndex - 1 + pointCount) % pointCount
  const nextIndex = (itemIndex + 1) % pointCount
  const prev = shape.points[prevIndex]
  const vertex = shape.points[itemIndex]
  const next = shape.points[nextIndex]
  if (!prev || !vertex || !next) return shape

  const prevAngle = Math.atan2(prev.y - vertex.y, prev.x - vertex.x)
  const nextAngle = Math.atan2(next.y - vertex.y, next.x - vertex.x)
  const currentDiff = normalizeAngleDeltaRadians(nextAngle - prevAngle)
  const currentSign = currentDiff >= 0 ? 1 : -1
  const targetRadians = Math.min(179.9, Math.max(0.1, targetValue)) * (Math.PI / 180)
  const targetDiff = currentSign * targetRadians
  const delta = normalizeAngleDeltaRadians((prevAngle + targetDiff) - nextAngle)

  const indicesToRotate: number[] = []
  if (shape.type === 'angle-line') {
    indicesToRotate.push(nextIndex)
  } else {
    let cursor = nextIndex
    while (cursor !== prevIndex) {
      indicesToRotate.push(cursor)
      cursor = (cursor + 1) % pointCount
      if (cursor === itemIndex) break
    }
  }

  const nextPoints = shape.points.map((point, index) => {
    if (!indicesToRotate.includes(index)) return point
    const dx = point.x - vertex.x
    const dy = point.y - vertex.y
    const cos = Math.cos(delta)
    const sin = Math.sin(delta)
    return makePoint(
      vertex.x + (dx * cos) - (dy * sin),
      vertex.y + (dx * sin) + (dy * cos),
    )
  })

  return clearShapeGuideCustomText({
    ...shape,
    points: nextPoints,
  }, 'angle', itemIndex)
}

function startShapeGuideValueEdit(shape: Shape, key: 'length' | 'angle' | 'height', itemIndex: number) {
  const anchor = getShapeGuideLabelWorldPos(shape, key, itemIndex)
  shapeGuideValueEditState.value = {
    shapeId: shape.id,
    guideKey: key,
    itemIndex,
    rawX: anchor.x + 6,
    rawY: anchor.y + 6,
  }
  shapeGuideValueLabel.value = key === 'angle' ? '각도' : key === 'height' ? '높이' : '길이'
  shapeGuideApplyToGeometry.value = false
  shapeGuideValue.value = key === 'angle'
    ? getShapeAngleValueText(shape, itemIndex).replace(/°$/, '').trim()
    : key === 'height'
      ? getShapeHeightValueText(shape).replace(/cm$/i, '').trim()
      : getShapeLengthValueText(shape, itemIndex).replace(/cm$/i, '').trim()
}

function cancelShapeGuideValueEdit() {
  shapeGuideValueEditState.value = null
  shapeGuideValue.value = ''
  shapeGuideApplyToGeometry.value = false
}

function getActualShapeGuideNumericValue(shape: Shape, key: 'length' | 'angle' | 'height', itemIndex: number): string {
  if (key === 'angle') {
    const interiorInfo = getShapeInteriorAngleInfo(shape, itemIndex)
    if (!interiorInfo) return ''
    return formatRoundedValue(interiorInfo.degrees)
  }
  if (key === 'height') {
    const heightGuide = getShapeHeightGuide(shape)
    if (!heightGuide) return ''
    return formatRoundedValue(calculateDistance(heightGuide.apex, heightGuide.foot))
  }
  if (shape.type === 'circle') {
    const center = shape.points[0]
    const edge = shape.points[1]
    if (!center || !edge) return ''
    const radius = calculateDistance(center, edge)
    return formatRoundedValue(shape.circleMeasureMode === 'diameter' ? radius * 2 : radius)
  }
  const p1 = shape.points[itemIndex]
  const p2 = shape.points[(itemIndex + 1) % shape.points.length]
  if (!p1 || !p2) return ''
  return formatRoundedValue(calculateDistance(p1, p2))
}

function resetShapeGuideValueEdit() {
  const state = shapeGuideValueEditState.value
  if (!state) return
  const shape = shapeMap.value.get(state.shapeId)
  if (!shape) return
  shapeGuideValue.value = getActualShapeGuideNumericValue(shape, state.guideKey, state.itemIndex)
}

function confirmShapeGuideValueEdit() {
  const state = shapeGuideValueEditState.value
  if (!state) return
  const numericValue = parseNumericGuideValue(shapeGuideValue.value)
  if (numericValue === null) {
    cancelShapeGuideValueEdit()
    return
  }
  canvasStore.updateShape(state.shapeId, (shape) => {
    if (!shapeGuideApplyToGeometry.value) {
      const displayText = state.guideKey === 'angle'
        ? `${formatRoundedValue(numericValue)}°`
        : formatRoundedValue(numericValue)
      return setShapeGuideCustomText(shape, state.guideKey, state.itemIndex, displayText)
    }
    if (state.guideKey === 'length') {
      return updateShapeLengthByRatio(shape, state.itemIndex, numericValue)
    }
    if (state.guideKey === 'height') {
      return updateShapeHeightByRatio(shape, numericValue)
    }
    return updateShapeAngleByValue(shape, state.itemIndex, numericValue)
  })
  cancelShapeGuideValueEdit()
}

function handleShapeGuideValueDblClick(
  shape: Shape,
  key: 'length' | 'angle' | 'height',
  itemIndex: number,
  e: { cancelBubble: boolean }
) {
  e.cancelBubble = true
  startShapeGuideValueEdit(shape, key, itemIndex)
}

function isShapeGuideItemBlank(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number): boolean {
  return getShapeGuideItemStyle(shape, key, index).textMode === 'blank'
}

function getShapeGuideTextColor(
  shape: Shape,
  key: 'length' | 'angle' | 'pointName' | 'height',
  index: number,
  fallback: string
): string {
  const style = getShapeGuideItemStyle(shape, key, index)
  return style.textColor || style.color || fallback
}

function getShapeGuideFallbackTextColor(
  shape: Shape,
  key: 'length' | 'angle' | 'pointName' | 'height',
  _index: number
): string {
  if (key === 'pointName') {
    return getColors(shape).label || DEFAULT_TEXT_COLOR
  }
  return DEFAULT_TEXT_COLOR
}

function getShapeGuideItemOffset(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number): { x: number, y: number } {
  const style = getShapeGuideItemStyle(shape, key, index)
  return {
    x: Number(style.offsetX || 0),
    y: Number(style.offsetY || 0)
  }
}

function isDetachedShapeGuideItem(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number): boolean {
  return getShapeGuideItemStyle(shape, key, index).detached === true
}

function getLengthGuideCurvePoints(guide: { points: { x: number, y: number }[] }): number[] {
  return getSharedLengthGuideCurvePoints(guide)
}

function getLengthGuideLabelPos(guide: { points: { x: number, y: number }[] }): { x: number, y: number } {
  return snapTextPoint(getSharedLengthGuideLabelPos(guide))
}

function getShapePointNameDefaultPos(shape: Shape, index: number): { x: number, y: number } {
  if (shouldPlaceCircleCenterPointNameBelow(shape, index)) {
    const point = shape.points[index]
    if (point) {
      return {
        x: point.x - 4,
        y: point.y + 8
      }
    }
  }
  return getPointNameDefaultPos(shape.type, shape.points, index)
}

function getShapePointNameTextPos(shape: Shape, index: number): { x: number, y: number } {
  const base = getShapePointNameDefaultPos(shape, index)
  const offset = getShapeGuideItemOffset(shape, 'pointName', index)
  return { x: base.x + offset.x, y: base.y + offset.y }
}

function shouldPlaceCircleCenterPointNameBelow(shape: Shape, index: number): boolean {
  if (shape.type !== 'circle' || index !== 0) return false
  if (!toolStore.showLength) return false
  if (!isShapeGuideVisible(shape, 'radius')) return false
  if (!isShapeGuideItemVisible(shape, 'length', 0)) return false

  const { p1, p2 } = getCircleLengthEndpoints(shape)
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  const verticality = Math.abs(dy) / len
  return verticality >= 0.85
}

function getShapeAngleValueText(shape: Shape, index: number): string {
  const customText = getShapeGuideItemStyle(shape, 'angle', index).customText?.trim()
  if (customText) return customText
  const interiorInfo = getShapeInteriorAngleInfo(shape, index)
  if (!interiorInfo) return ''
  return formatAngleDegrees(interiorInfo.degrees)
}

function getShapeAngleLabelPos(shape: Shape, index: number): { x: number, y: number } {
  const angleText = getShapeAngleValueText(shape, index)
  const fontSize = getShapeGuideItemStyle(shape, 'angle', index).fontSize || DEFAULT_TEXT_FONT_SIZE
  return snapTextPoint(getSharedShapeAngleLabelPos(
    shape,
    index,
    getTextWidthPx(angleText, fontSize),
    fontSize,
    {
      arcRadius: ANGLE_ARC_RADIUS,
      guideLineWidth: DEFAULT_GUIDE_LINE_PX,
      rightAngleMarkerSize: RIGHT_ANGLE_MARKER_SIZE,
      outerGapPx: ANGLE_LABEL_OUTER_GAP_PX,
      rightAngleDistMultiplier: RIGHT_ANGLE_LABEL_DIST_MULTIPLIER,
      edgePaddingPx: ANGLE_LABEL_EDGE_PADDING_PX,
      nonRightAngleExtraGapPx: NON_RIGHT_ANGLE_LABEL_EXTRA_GAP_PX,
      baselineCompensationRatio: ANGLE_LABEL_BASELINE_COMPENSATION_RATIO,
      nonRightAngleBaselineLiftPx: NON_RIGHT_ANGLE_BASELINE_LIFT_PX,
      obtuseAngleStartDeg: OBTUSE_ANGLE_START_DEG,
      obtuseGapReduceMaxPx: OBTUSE_ANGLE_GAP_REDUCE_MAX_PX,
      obtuseLiftReduceMaxPx: OBTUSE_ANGLE_LIFT_REDUCE_MAX_PX,
      rightAngleQuadrantXRatio: RIGHT_ANGLE_LABEL_QUADRANT_X_RATIO,
      rightAngleVerticalBaseRatio: RIGHT_ANGLE_LABEL_VERTICAL_BASE_RATIO,
      rightAngleVerticalQuadrantRatio: RIGHT_ANGLE_LABEL_VERTICAL_QUADRANT_RATIO
    }
  ))
}

function getShapeAngleTextOffsetX(_shape: Shape, _index: number, text: string, fontSize: number): number {
  return snapTextValue(getTextWidthPx(text, fontSize) * 0.5)
}

function getShapeAngleTextOffsetY(_shape: Shape, _index: number, fontSize: number): number {
  return snapTextValue(fontSize * 0.1)
}

function logAngleGuidePlacement(shapeId: string, angleIndex: number) {
  const shape = shapeMap.value.get(shapeId)
  if (!shape) return
  getShapeAngleLabelPos(shape, angleIndex)
}

function getShapeAngleArcPolyline(shape: Shape, index: number): number[] {
  const triplet = getShapeAngleTriplet(shape, index)
  if (!triplet) return []
  const interiorInfo = getShapeInteriorAngleInfo(shape, index)
  return getAngleArcPoints([triplet.prev, triplet.vertex, triplet.next], {
    reflex: interiorInfo?.isReflex === true
  })
}

function isRightAngleAt(shape: Shape, index: number): boolean {
  const interiorInfo = getShapeInteriorAngleInfo(shape, index)
  if (!interiorInfo) return false
  return Math.abs(interiorInfo.degrees - 90) < 0.05
}

function shouldRenderShapeAngleText(shape: Shape, index: number, mode: 'right' | 'all'): boolean {
  if (isShapeGuideItemBlank(shape, 'angle', index)) return false
  if (mode === 'all' || shape.type === 'angle-line') return true
  return !isRightAngleAt(shape, index)
}

function getShapeLengthCurveSide(shape: Shape, index: number): 1 | -1 | undefined {
  const side = getShapeGuideItemStyle(shape, 'length', index).curveSide
  return side === -1 ? -1 : side === 1 ? 1 : undefined
}

function getEdgeLengthBendPoint(
  p1: { x: number, y: number },
  p2: { x: number, y: number },
  center: { x: number, y: number },
  offset = LENGTH_CURVE_OFFSET_PX,
  curveSide?: 1 | -1
): { x: number, y: number } {
  const mx = (p1.x + p2.x) / 2
  const my = (p1.y + p2.y) / 2
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  if (curveSide === 1 || curveSide === -1) {
    return { x: mx + nx * offset * curveSide, y: my + ny * offset * curveSide }
  }
  const a = { x: mx + nx * offset, y: my + ny * offset }
  const b = { x: mx - nx * offset, y: my - ny * offset }
  const da = Math.hypot(a.x - center.x, a.y - center.y)
  const db = Math.hypot(b.x - center.x, b.y - center.y)
  return da >= db ? a : b
}

function getShapeLengthCurvePoints(shape: Shape, index: number): number[] {
  const p1 = shape.points[index]
  const p2 = shape.points[(index + 1) % shape.points.length]
  if (!p1 || !p2) return []
  const center = getShapeCentroid(shape.points)
  const curveSide = getShapeLengthCurveSide(shape, index)
  const bendRef = getEdgeLengthBendPoint(p1, p2, center, LENGTH_CURVE_OFFSET_PX, curveSide)
  const cp = getLengthGuideControlPoint(p1, p2, bendRef)
  return createQuadraticCurvePoints(p1, cp, p2)
}

function getLengthGuideSegments(
  curvePoints: number[],
  gapPx: number,
  aroundPoint?: { x: number, y: number },
  fontSize: number = DEFAULT_TEXT_FONT_SIZE,
  aroundRect?: { left: number, right: number, top: number, bottom: number },
  aroundRects?: Array<{ left: number, right: number, top: number, bottom: number }>
): number[][] {
  if (curvePoints.length < 4) return [curvePoints]
  const total = getPolylineLength(curvePoints)
  const cutGapPx = Math.max(14, gapPx * 0.62)
  if (total <= cutGapPx + 8) return [curvePoints]

  if (aroundPoint) {
    const sideMargin = Math.max(0.9, fontSize * 0.08)
    const rects = aroundRects && aroundRects.length > 0
      ? aroundRects.map((r) => ({
        left: r.left - sideMargin,
        right: r.right + sideMargin,
        top: r.top - sideMargin,
        bottom: r.bottom + sideMargin
      }))
      : aroundRect
        ? [{
          left: aroundRect.left - sideMargin,
          right: aroundRect.right + sideMargin,
          top: aroundRect.top - sideMargin,
          bottom: aroundRect.bottom + sideMargin
        }]
        : [(() => {
          // Use the same margin for both axes: text box + equal padding.
          const textHalfW = Math.max(6.2, gapPx * 0.42 - 8.5)
          const textHalfH = Math.max(3.6, fontSize * 0.62)
          const halfW = textHalfW + sideMargin
          const halfH = textHalfH + sideMargin
          const centerX = aroundPoint.x
          const centerY = aroundPoint.y
          return {
            left: centerX - halfW,
            right: centerX + halfW,
            top: centerY - halfH,
            bottom: centerY + halfH
          }
        })()]
    let overlapStart = Number.POSITIVE_INFINITY
    let overlapEnd = Number.NEGATIVE_INFINITY
    let overlaps = false
    let walked = 0
    const maxSeg = Math.floor(curvePoints.length / 2) - 1
    for (let i = 0; i < maxSeg; i++) {
      const x1 = curvePoints[i * 2]
      const y1 = curvePoints[i * 2 + 1]
      const x2 = curvePoints[(i + 1) * 2]
      const y2 = curvePoints[(i + 1) * 2 + 1]
      const segLen = Math.hypot(x2 - x1, y2 - y1)
      if (segLen <= 1e-6) {
        walked += segLen
        continue
      }
      for (const rect of rects) {
        if (segmentIntersectsRect(x1, y1, x2, y2, rect)) {
          overlaps = true
          const clip = clipSegmentToRect(x1, y1, x2, y2, rect)
          if (clip) {
            overlapStart = Math.min(overlapStart, walked + segLen * clip.t0)
            overlapEnd = Math.max(overlapEnd, walked + segLen * clip.t1)
          }
        }
      }
      walked += segLen
    }
    if (!overlaps) {
      return [curvePoints]
    }
    if (Number.isFinite(overlapStart) && Number.isFinite(overlapEnd) && overlapEnd > overlapStart) {
      const pad = sideMargin
      const startDist = Math.max(0, overlapStart - pad)
      const endDist = Math.min(total, overlapEnd + pad)
      return splitPolylineByDistance(curvePoints, startDist, endDist)
    }
  }

  let centerDist = total / 2
  const startDist = Math.max(0, centerDist - cutGapPx / 2)
  const endDist = Math.min(total, centerDist + cutGapPx / 2)
  return splitPolylineByDistance(curvePoints, startDist, endDist)
}

function getGuideBlankWidthMm(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number): number {
  return getSharedGuideBlankWidthMm(
    getShapeGuideItemStyle(shape, key, index),
    BLANK_BASE_WIDTH_MM,
    BLANK_WIDTH_STEP_MM,
    BLANK_WIDTH_MIN_MM,
    BLANK_WIDTH_MAX_MM
  )
}

function getShapeGuideLabelWorldPos(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number): { x: number, y: number } {
  if (key === 'length') {
    const base = shape.type === 'circle'
      ? getCircleLengthLabelPos(shape)
      : getShapeLengthLabelPos(shape, index)
    const offset = getShapeGuideItemOffset(shape, 'length', index)
    return { x: base.x + offset.x, y: base.y + offset.y }
  }
  if (key === 'angle') {
    const base = getShapeAngleLabelPos(shape, index)
    const offset = getShapeGuideItemOffset(shape, 'angle', index)
    return { x: base.x + offset.x, y: base.y + offset.y }
  }
  if (key === 'pointName') {
    const textPos = getShapePointNameTextPos(shape, index)
    return { x: textPos.x + 7, y: textPos.y - 3 }
  }
  const base = getShapeHeightLabelPos(shape)
  const offset = getShapeGuideItemOffset(shape, 'height', 0)
  return { x: base.x + offset.x, y: base.y + offset.y }
}

function getShapeGuideBlankCenter(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number): { x: number, y: number } {
  if (key === 'pointName') {
    const textPos = getShapePointNameTextPos(shape, index)
    return { x: textPos.x + 7, y: textPos.y - 3 }
  }
  return getShapeGuideLabelWorldPos(shape, key, index)
}

function getShapeGuideBlankRect(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number) {
  return getSharedGuideBlankRect(
    getShapeGuideBlankCenter(shape, key, index),
    getGuideBlankWidthMm(shape, key, index),
    MM_TO_PX,
    BLANK_BASE_HEIGHT_MM
  )
}

function getShapeGuideBlankUnitPos(shape: Shape, key: 'length' | 'height', index: number): { x: number, y: number } {
  const rect = getShapeGuideBlankRect(shape, key, index)
  const fontSize = getShapeGuideItemStyle(shape, key, index).fontSize || DEFAULT_TEXT_FONT_SIZE
  return getGuideBlankTextPos(rect, fontSize, GRID_CONFIG.size / 2)
}

function getShapeGuideBlankSuffixPos(shape: Shape, key: 'length' | 'angle' | 'height', index: number): { x: number, y: number } {
  const rect = getShapeGuideBlankRect(shape, key, index)
  const fontSize = getShapeGuideItemStyle(shape, key, index).fontSize || DEFAULT_TEXT_FONT_SIZE
  return getGuideBlankTextPos(rect, fontSize, 4)
}

function getShapeGuideBlankTextPos(
  shape: Shape,
  key: 'length' | 'angle' | 'height',
  index: number,
  kind: 'unit' | 'suffix'
): { x: number, y: number } {
  const pos = kind === 'unit'
    ? getShapeGuideBlankUnitPos(shape, key === 'angle' ? 'length' : key, index)
    : getShapeGuideBlankSuffixPos(shape, key, index)
  return pos
}

function formatLengthValue(value: number): string {
  const base = formatRoundedValue(value)
  return toolStore.showGuideUnit ? `${base}cm` : base
}

function stripGuideUnit(text: string): string {
  return text.replace(/cm$/i, '').replace(/°$/, '').trim()
}

function getLengthMainText(text: string): string {
  return stripGuideUnit(text)
}

function getLengthLatexText(text: string): string {
  return toLengthLatex(text, toolStore.showGuideUnit)
}

const textMeasureCanvas = ref<HTMLCanvasElement | null>(null)
function getTextWidthPx(text: string, fontSize: number): number {
  if (!text) return 0
  if (typeof document === 'undefined') return text.length * fontSize * 0.6
  if (!textMeasureCanvas.value) {
    textMeasureCanvas.value = document.createElement('canvas')
  }
  const ctx = textMeasureCanvas.value.getContext('2d')
  if (!ctx) return text.length * fontSize * 0.6
  ctx.font = `${fontSize}px ${DEFAULT_TEXT_FONT_FAMILY}`
  return ctx.measureText(text).width
}

function getUnitYFromCenteredText(centerY: number, fontSize: number): number {
  return snapTextValue(centerY - (fontSize * 0.45))
}

function getLengthUnitGapPx(): number {
  return GRID_CONFIG.size * 0.5
}

function getLengthMainOffsetFromAnchor(
  mainText: string,
  fontSize: number,
  withUnit: boolean,
  align: 'center' | 'left' | 'right'
): number {
  const mainWidth = getTextWidthPx(mainText, fontSize)
  const unitWidth = withUnit ? getTextWidthPx('cm', fontSize) : 0
  const gap = withUnit ? getLengthUnitGapPx() : 0
  return getSharedLengthMainOffsetFromAnchor(mainWidth, unitWidth, gap, align)
}

function getLengthUnitXFromAnchor(
  anchorX: number,
  mainText: string,
  fontSize: number,
  withUnit: boolean,
  align: 'center' | 'left' | 'right'
): number {
  if (!withUnit) return snapTextValue(anchorX)
  const mainWidth = getTextWidthPx(mainText, fontSize)
  const unitWidth = getTextWidthPx('cm', fontSize)
  return snapTextValue(getSharedLengthUnitXFromAnchor(anchorX, mainWidth, unitWidth, getLengthUnitGapPx(), align))
}

function getUnitVisualRectFromTopLeft(
  x: number,
  y: number,
  fontSize: number,
  unitText: string = 'cm'
): { left: number, right: number, top: number, bottom: number } {
  return getSharedUnitVisualRectFromTopLeft(x, y, getTextWidthPx(unitText, fontSize), fontSize)
}

function getLengthGuideTextRect(
  centerX: number,
  centerY: number,
  mainText: string,
  fontSize: number,
  withUnit: boolean,
  align: 'center' | 'left' | 'right' = 'center'
): { left: number, right: number, top: number, bottom: number } {
  const mainWidth = getTextWidthPx(mainText, fontSize)
  const unitWidth = withUnit ? getTextWidthPx('cm', fontSize) : 0
  const gap = withUnit ? getLengthUnitGapPx() : 0
  return getSharedLengthGuideTextRect(centerX, centerY, mainWidth, fontSize, unitWidth, gap, align)
}

function getLengthGuideTextRects(
  centerX: number,
  centerY: number,
  mainText: string,
  fontSize: number,
  withUnit: boolean,
  align: 'center' | 'left' | 'right' = 'center'
): Array<{ left: number, right: number, top: number, bottom: number }> {
  const mainWidth = getTextWidthPx(mainText, fontSize)
  const unitWidth = withUnit ? getTextWidthPx('cm', fontSize) : 0
  const gap = withUnit ? getLengthUnitGapPx() : 0
  return getSharedLengthGuideTextRects(centerX, centerY, mainWidth, fontSize, unitWidth, gap, align)
}

function getLengthBlankGuideRectWithUnit(
  blankRect: { x: number, y: number, width: number, height: number },
  unitPos: { x: number, y: number },
  fontSize: number
): { left: number, right: number, top: number, bottom: number } {
  const unitRect = getUnitVisualRectFromTopLeft(unitPos.x, unitPos.y, fontSize, 'cm')
  return getLengthBlankGuideRectWithUnitRect(blankRect, unitRect)
}

function getShapeLengthValueText(shape: Shape, index: number): string {
  const customText = getShapeGuideItemStyle(shape, 'length', index).customText?.trim()
  if (customText) return customText
  const p1 = shape.points[index]
  const p2 = shape.points[(index + 1) % shape.points.length]
  if (!p1 || !p2) return ''
  return formatLengthValue(calculateDistance(p1, p2))
}

function getCircleLengthValueText(shape: Shape): string {
  const center = shape.points[0]
  const edge = shape.points[1]
  if (!center || !edge) return ''
  const radius = calculateDistance(center, edge)
  const mode = getCircleMeasureMode(shape)
  const value = mode === 'diameter' ? radius * 2 : radius
  return formatLengthValue(value)
}

function getCircleLengthEndpoints(shape: Shape): { p1: { x: number, y: number }, p2: { x: number, y: number } } {
  const center = shape.points[0]
  const edge = shape.points[1]
  if (!center || !edge) {
    return { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } }
  }
  if (getCircleMeasureMode(shape) === 'radius') {
    return { p1: center, p2: edge }
  }
  const opposite = {
    x: center.x * 2 - edge.x,
    y: center.y * 2 - edge.y
  }
  return { p1: edge, p2: opposite }
}

function getCircleLengthLabelPos(shape: Shape): { x: number, y: number } {
  const { p1, p2 } = getCircleLengthEndpoints(shape)
  const center = shape.points[0]
  const edge = shape.points[1]
  const fontSize = getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE
  const mainText = getLengthMainText(getCircleLengthValueText(shape))
  const mainWidth = getTextWidthPx(mainText, fontSize)
  const unitWidth = toolStore.showGuideUnit ? getTextWidthPx('cm', fontSize) : 0
  const initialLabelPos = getSharedCircleLengthLabelPos(
    shape,
    { ...p1, gridX: p1.x / GRID_CONFIG.size, gridY: p1.y / GRID_CONFIG.size },
    { ...p2, gridX: p2.x / GRID_CONFIG.size, gridY: p2.y / GRID_CONFIG.size },
    mainWidth,
    fontSize,
    unitWidth,
    toolStore.showGuideUnit ? getLengthUnitGapPx() : 0,
    shape.points[0],
    getShapeLengthCurveSide(shape, 0)
  )
  const resolvedSide = getResolvedCircleLengthCurveSide(shape, p1, p2, initialLabelPos)
  const side = resolvedSide === -1 ? -1 : 1
  const curve = getTwoPointLengthCurvePoints(p1, p2, resolvedSide, CIRCLE_LENGTH_CURVE_OFFSET_PX)
  const midpoint = interpolateOnPolyline(curve, getPolylineLength(curve) / 2)
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const verticality = Math.abs(dy) / len
  const radius = center && edge ? calculateDistance(center, edge) : 0
  const baseLift = Math.max(3.5, fontSize * 0.32)
  const textSpan = mainWidth + (toolStore.showGuideUnit ? unitWidth + getLengthUnitGapPx() : 0)
  const visualTextSpan = textSpan * 1.18 + fontSize * 0.45
  const verticalClearance = (visualTextSpan * 0.5 + 6) * verticality
  const desiredLift = Math.max(
    baseLift * (1 + verticality * 1.8),
    verticalClearance
  )
  const minRadiusForLift = fontSize * 2.2
  const maxLift = Math.max(0, radius - minRadiusForLift)
  let lift = Math.min(desiredLift, maxLift)
  let candidate = {
    x: midpoint.x + nx * side * lift,
    y: midpoint.y + ny * side * lift
  }

  const step = Math.max(2, fontSize * 0.18)
  while (lift < maxLift) {
    const rect = getLengthGuideTextRect(candidate.x, candidate.y, mainText, fontSize, toolStore.showGuideUnit)
    const clearancePadding = Math.min(
      Math.max(0, maxLift),
      Math.max(fontSize * 0.1, 1.5) + verticality * Math.max(fontSize * 0.9, 10)
    )
    const clearanceRect = {
      left: rect.left - clearancePadding,
      right: rect.right + clearancePadding,
      top: rect.top - clearancePadding,
      bottom: rect.bottom + clearancePadding
    }
    if (!segmentIntersectsRect(p1.x, p1.y, p2.x, p2.y, clearanceRect)) break
    lift = Math.min(maxLift, lift + step)
    candidate = {
      x: midpoint.x + nx * side * lift,
      y: midpoint.y + ny * side * lift
    }
  }

  const lineMidX = (p1.x + p2.x) / 2
  const lineMidY = (p1.y + p2.y) / 2
  const actualNormalSeparation = Math.abs((candidate.x - lineMidX) * nx + (candidate.y - lineMidY) * ny)
  const requiredNormalSeparation = Math.min(
    maxLift,
    baseLift + verticality * ((visualTextSpan * 0.5) + fontSize * 1.0 + 10)
  )
  if (requiredNormalSeparation > actualNormalSeparation) {
    lift = Math.min(maxLift, lift + (requiredNormalSeparation - actualNormalSeparation))
    candidate = {
      x: midpoint.x + nx * side * lift,
      y: midpoint.y + ny * side * lift
    }
  }

  return snapTextPoint(candidate)
}

function getCircleLengthLabelWorldPos(shape: Shape): { x: number, y: number } {
  return getShapeGuideLabelWorldPos(shape, 'length', 0)
}

function getResolvedCircleLengthCurveSide(
  shape: Shape,
  p1: { x: number, y: number },
  p2: { x: number, y: number },
  labelCenter: { x: number, y: number }
): 1 | -1 | undefined {
  const explicitSide = getShapeLengthCurveSide(shape, 0)
  if (explicitSide === 1 || explicitSide === -1) return explicitSide

  const midX = (p1.x + p2.x) / 2
  const midY = (p1.y + p2.y) / 2
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const dot = (labelCenter.x - midX) * nx + (labelCenter.y - midY) * ny
  return dot >= 0 ? 1 : -1
}

function getCircleLengthCurveSegments(shape: Shape): number[][] {
  const { p1, p2 } = getCircleLengthEndpoints(shape)
  const text = getCircleLengthValueText(shape)
  const fontSize = getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE
  const isBlank = isShapeGuideItemBlank(shape, 'length', 0)
  const labelCenter = getCircleLengthLabelWorldPos(shape)
  const curve = getTwoPointLengthCurvePoints(
    p1,
    p2,
    getResolvedCircleLengthCurveSide(shape, p1, p2, labelCenter),
    CIRCLE_LENGTH_CURVE_OFFSET_PX
  )
  const aroundRect = isBlank
    ? (() => {
      const blankRect = getShapeGuideBlankRect(shape, 'length', 0)
      if (!toolStore.showGuideUnit) {
        return {
          left: blankRect.x,
          right: blankRect.x + blankRect.width,
          top: blankRect.y,
          bottom: blankRect.y + blankRect.height
        }
      }
      return getLengthBlankGuideRectWithUnit(
        blankRect,
        getShapeGuideBlankUnitPos(shape, 'length', 0),
        fontSize
      )
    })()
    : getLengthGuideTextRect(
      labelCenter.x,
      labelCenter.y,
      getLengthMainText(text),
      fontSize,
      toolStore.showGuideUnit
    )
  const aroundRects = isBlank
    ? (() => {
      if (!toolStore.showGuideUnit) return [aroundRect]
      const blankRect = getShapeGuideBlankRect(shape, 'length', 0)
      const unitPos = getShapeGuideBlankUnitPos(shape, 'length', 0)
      return [
        {
          left: blankRect.x,
          right: blankRect.x + blankRect.width,
          top: blankRect.y,
          bottom: blankRect.y + blankRect.height
        },
        getUnitVisualRectFromTopLeft(unitPos.x, unitPos.y, fontSize, 'cm')
      ]
    })()
    : getLengthGuideTextRects(
      labelCenter.x,
      labelCenter.y,
      getLengthMainText(text),
      fontSize,
      toolStore.showGuideUnit
    )
  const gapPx = Math.max(
    14,
    aroundRect.right - aroundRect.left + 6
  )
  return getLengthGuideSegments(curve, gapPx, labelCenter, fontSize, aroundRect, aroundRects)
}

function getCircleGuideMainLineColor(shape: Shape): string {
  const style = getShapeGuideItemStyle(shape, 'length', 0)
  return style.lineColor || style.color || DEFAULT_TEXT_COLOR
}

function getCircleGuideMeasureLineColor(shape: Shape): string {
  const style = getShapeGuideItemStyle(shape, 'length', 0)
  return style.measureLineColor || style.lineColor || style.color || LENGTH_GUIDE_DEFAULT_COLOR
}

function getCircleGuideMainLineWidth(shape: Shape): number {
  const style = getShapeGuideItemStyle(shape, 'length', 0)
  return style.lineWidth || DEFAULT_GUIDE_LINE_PX
}

function getCircleGuideMeasureLineWidth(shape: Shape): number {
  const style = getShapeGuideItemStyle(shape, 'length', 0)
  return style.measureLineWidth || style.lineWidth || DEFAULT_GUIDE_LINE_PX
}

function getShapeHeightValueText(shape: Shape): string {
  const customText = getShapeGuideItemStyle(shape, 'height', 0).customText?.trim()
  if (customText) return customText
  const h = getShapeHeightGuide(shape)
  if (!h) return ''
  return formatLengthValue(calculateDistance(h.apex, h.foot))
}

function getShapeHeightLabelPos(shape: Shape): { x: number, y: number } {
  const h = getShapeHeightGuide(shape)
  if (!h) return { x: 0, y: 0 }
  const fontSize = getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE
  const mainWidth = getTextWidthPx(getLengthMainText(getShapeHeightValueText(shape)), fontSize)
  const unitWidth = toolStore.showGuideUnit ? getTextWidthPx('cm', fontSize) : 0
  return snapTextPoint(getSharedShapeHeightLabelPos(
    shape,
    h,
    mainWidth,
    fontSize,
    unitWidth,
    toolStore.showGuideUnit ? getLengthUnitGapPx() : 0,
    HEIGHT_LABEL_HORIZONTAL_OFFSET_PX
  ))
}

function getShapeHeightLabelWorldPos(shape: Shape): { x: number, y: number } {
  return getShapeGuideLabelWorldPos(shape, 'height', 0)
}

function getShapeHeightLengthGuideSegments(shape: Shape): number[][] {
  const h = getShapeHeightGuide(shape)
  if (!h) return []
  const style = getShapeGuideItemStyle(shape, 'height', 0)
  const fontSize = style.fontSize || DEFAULT_TEXT_FONT_SIZE
  const isBlank = isShapeGuideItemBlank(shape, 'height', 0)
  const labelCenter = getShapeHeightLabelWorldPos(shape)
  const curve = getTwoPointLengthCurvePoints(
    h.apex,
    h.foot,
    getResolvedShapeHeightCurveSide(shape, h, labelCenter),
    HEIGHT_LENGTH_CURVE_OFFSET_PX
  )
  const mainText = getLengthMainText(getShapeHeightValueText(shape))
  const aroundRect = isBlank
    ? (() => {
      const blankRect = getShapeGuideBlankRect(shape, 'height', 0)
      if (!toolStore.showGuideUnit) {
        return {
          left: blankRect.x,
          right: blankRect.x + blankRect.width,
          top: blankRect.y,
          bottom: blankRect.y + blankRect.height
        }
      }
      return getLengthBlankGuideRectWithUnit(
        blankRect,
        getShapeGuideBlankUnitPos(shape, 'height', 0),
        fontSize
      )
    })()
    : getLengthGuideTextRect(labelCenter.x, labelCenter.y, mainText, fontSize, toolStore.showGuideUnit)
  const aroundRects = isBlank
    ? (() => {
      if (!toolStore.showGuideUnit) return [aroundRect]
      const blankRect = getShapeGuideBlankRect(shape, 'height', 0)
      const unitPos = getShapeGuideBlankUnitPos(shape, 'height', 0)
      return [
        {
          left: blankRect.x,
          right: blankRect.x + blankRect.width,
          top: blankRect.y,
          bottom: blankRect.y + blankRect.height
        },
        getUnitVisualRectFromTopLeft(unitPos.x, unitPos.y, fontSize, 'cm')
      ]
    })()
    : getLengthGuideTextRects(labelCenter.x, labelCenter.y, mainText, fontSize, toolStore.showGuideUnit)
  const gapPx = Math.max(14, aroundRect.right - aroundRect.left + 6)
  return getLengthGuideSegments(curve, gapPx, labelCenter, fontSize, aroundRect, aroundRects)
}

function getShapeHeightMainLineColor(shape: Shape): string {
  const style = getShapeGuideItemStyle(shape, 'height', 0)
  return style.heightLineColor || style.lineColor || style.color || HEIGHT_GUIDE_DEFAULT_COLOR
}

function getShapeHeightMeasureLineColor(shape: Shape): string {
  const style = getShapeGuideItemStyle(shape, 'height', 0)
  return style.measureLineColor || style.lineColor || style.color || LENGTH_GUIDE_DEFAULT_COLOR
}

function getShapeHeightMainLineWidth(shape: Shape): number {
  const style = getShapeGuideItemStyle(shape, 'height', 0)
  return style.heightLineWidth || style.lineWidth || DEFAULT_HEIGHT_GUIDE_LINE_PX
}

function getShapeHeightMeasureLineWidth(shape: Shape): number {
  const style = getShapeGuideItemStyle(shape, 'height', 0)
  return style.measureLineWidth || style.lineWidth || DEFAULT_GUIDE_LINE_PX
}

function getShapeHeightCurveSide(shape: Shape): 1 | -1 | undefined {
  const side = getShapeGuideItemStyle(shape, 'height', 0).curveSide
  return side === -1 ? -1 : side === 1 ? 1 : undefined
}

function getResolvedShapeHeightCurveSide(
  shape: Shape,
  heightGuide: { apex: Point, foot: Point },
  labelCenter: { x: number, y: number }
): 1 | -1 | undefined {
  const explicitSide = getShapeHeightCurveSide(shape)
  if (explicitSide === 1 || explicitSide === -1) return explicitSide

  const midX = (heightGuide.apex.x + heightGuide.foot.x) / 2
  const midY = (heightGuide.apex.y + heightGuide.foot.y) / 2
  const dx = heightGuide.foot.x - heightGuide.apex.x
  const dy = heightGuide.foot.y - heightGuide.apex.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const dot = (labelCenter.x - midX) * nx + (labelCenter.y - midY) * ny
  return dot >= 0 ? 1 : -1
}

function formatLengthGuideText(raw: string | undefined): string {
  const text = (raw || '').trim()
  if (!text) return ''
  const numeric = Number(text.replace(/cm/gi, '').trim())
  if (!Number.isFinite(numeric)) return text
  return formatLengthValue(numeric)
}

function getShapeLengthLabelWorldPos(shape: Shape, index: number): { x: number, y: number } {
  return getShapeGuideLabelWorldPos(shape, 'length', index)
}

function getShapeLengthCurveSegments(shape: Shape, index: number): number[][] {
  const curve = getShapeLengthCurvePoints(shape, index)
  const isBlank = isShapeGuideItemBlank(shape, 'length', index)
  const text = getShapeLengthValueText(shape, index)
  const fontSize = getShapeGuideItemStyle(shape, 'length', index).fontSize || DEFAULT_TEXT_FONT_SIZE
  const labelCenter = getShapeLengthLabelWorldPos(shape, index)
  const mainText = getLengthMainText(text)
  const align = getShapeLengthTextAnchorMode(shape, index)
  const aroundRect = isBlank
    ? (() => {
      const blankRect = getShapeGuideBlankRect(shape, 'length', index)
      if (!toolStore.showGuideUnit) {
        return {
          left: blankRect.x,
          right: blankRect.x + blankRect.width,
          top: blankRect.y,
          bottom: blankRect.y + blankRect.height
        }
      }
      return getLengthBlankGuideRectWithUnit(
        blankRect,
        getShapeGuideBlankUnitPos(shape, 'length', index),
        fontSize
      )
    })()
    : getLengthGuideTextRect(labelCenter.x, labelCenter.y, mainText, fontSize, toolStore.showGuideUnit, align)
  const aroundRects = isBlank
    ? (() => {
      if (!toolStore.showGuideUnit) return [aroundRect]
      const blankRect = getShapeGuideBlankRect(shape, 'length', index)
      const unitPos = getShapeGuideBlankUnitPos(shape, 'length', index)
      return [
        {
          left: blankRect.x,
          right: blankRect.x + blankRect.width,
          top: blankRect.y,
          bottom: blankRect.y + blankRect.height
        },
        getUnitVisualRectFromTopLeft(unitPos.x, unitPos.y, fontSize, 'cm')
      ]
    })()
    : getLengthGuideTextRects(labelCenter.x, labelCenter.y, mainText, fontSize, toolStore.showGuideUnit, align)
  const gapPx = Math.max(14, aroundRect.right - aroundRect.left + 6)
  return getLengthGuideSegments(curve, gapPx, labelCenter, fontSize, aroundRect, aroundRects)
}

function getShapeLengthLabelPos(shape: Shape, index: number): { x: number, y: number } {
  const curveSide = getShapeLengthCurveSide(shape, index)
  const fontSize = getShapeGuideItemStyle(shape, 'length', index).fontSize || DEFAULT_TEXT_FONT_SIZE
  const mainText = getLengthMainText(getShapeLengthValueText(shape, index))
  const mainWidth = getTextWidthPx(mainText, fontSize)
  const unitWidth = toolStore.showGuideUnit ? getTextWidthPx('cm', fontSize) : 0
  return snapTextPoint(getSharedShapeLengthLabelPos(
    shape,
    index,
    mainWidth,
    fontSize,
    unitWidth,
    toolStore.showGuideUnit ? getLengthUnitGapPx() : 0,
    getShapeCentroid(shape.points),
    curveSide,
    getShapeHeightGuide(shape),
    BASE_LABEL_VERTICAL_BIAS_PX
  ))
}

function getShapeLengthTextAnchorMode(_shape: Shape, _index: number): 'center' | 'left' | 'right' {
  return 'center'
}

function getShapeLengthTextOffsetX(shape: Shape, index: number, text: string, fontSize: number, withUnit: boolean): number {
  const mode = getShapeLengthTextAnchorMode(shape, index)
  return snapTextValue(getLengthMainOffsetFromAnchor(text, fontSize, withUnit, mode))
}

function getShapeLengthUnitX(shape: Shape, index: number, anchorX: number, mainText: string, fontSize: number, withUnit: boolean): number {
  const mode = getShapeLengthTextAnchorMode(shape, index)
  return getLengthUnitXFromAnchor(anchorX, mainText, fontSize, withUnit, mode)
}

function getShapeHeightGuide(shape: Shape): { apex: Point, foot: Point, baseA: Point, baseB: Point, t: number } | null {
  return getSharedShapeHeightGuide(shape)
}

function getShapeHeightRightAngleMarkerPoints(shape: Shape): number[] {
  return getSharedShapeHeightRightAngleMarkerPoints(shape, RIGHT_ANGLE_MARKER_SIZE)
}

function getTwoPointLengthCurvePoints(p1: { x: number, y: number }, p2: { x: number, y: number }, curveSide?: 1 | -1, offset: number = 16): number[] {
  const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  const bendRef = getEdgeLengthBendPoint(p1, p2, center, offset, curveSide)
  const cp = getLengthGuideControlPoint(p1, p2, bendRef)
  return createQuadraticCurvePoints(p1, cp, p2)
}

function getAngleArcPoints(points: { x: number, y: number }[], options?: { reflex?: boolean }): number[] {
  const p1 = points[0]
  const vertex = points[1]
  const p2 = points[2]
  const radius = ANGLE_ARC_RADIUS

  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x)
  const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x)
  let delta = a2 - a1
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  if (options?.reflex) {
    delta = delta > 0 ? delta - (Math.PI * 2) : delta + (Math.PI * 2)
  }

  const steps = 18
  const pts: number[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = a1 + delta * t
    pts.push(vertex.x + Math.cos(a) * radius, vertex.y + Math.sin(a) * radius)
  }
  return pts
}

function isRightAngleGuide(points: { x: number, y: number }[]): boolean {
  if (points.length < 3) return false
  return isRightAngleByThreePoints(points[0], points[1], points[2])
}

function getExtendedLinePoints(points: Point[]): number[] {
  if (points.length < 2) return getPolygonPoints(points)
  const [a, b] = points
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return [a.x, a.y, b.x, b.y]

  const intersections: { x: number, y: number, t: number }[] = []
  const maxX = stageWidth.value
  const maxY = stageHeight.value

  if (dx !== 0) {
    const tLeft = (0 - a.x) / dx
    const yLeft = a.y + tLeft * dy
    if (yLeft >= 0 && yLeft <= maxY) intersections.push({ x: 0, y: yLeft, t: tLeft })

    const tRight = (maxX - a.x) / dx
    const yRight = a.y + tRight * dy
    if (yRight >= 0 && yRight <= maxY) intersections.push({ x: maxX, y: yRight, t: tRight })
  }

  if (dy !== 0) {
    const tTop = (0 - a.y) / dy
    const xTop = a.x + tTop * dx
    if (xTop >= 0 && xTop <= maxX) intersections.push({ x: xTop, y: 0, t: tTop })

    const tBottom = (maxY - a.y) / dy
    const xBottom = a.x + tBottom * dx
    if (xBottom >= 0 && xBottom <= maxX) intersections.push({ x: xBottom, y: maxY, t: tBottom })
  }

  const deduped: { x: number, y: number, t: number }[] = []
  for (const p of intersections) {
    const exists = deduped.some((q) => Math.abs(q.x - p.x) < 0.1 && Math.abs(q.y - p.y) < 0.1)
    if (!exists) deduped.push(p)
  }

  if (deduped.length < 2) return [a.x, a.y, b.x, b.y]
  deduped.sort((p1, p2) => p1.t - p2.t)
  const start = deduped[0]
  const end = deduped[deduped.length - 1]
  return [start.x, start.y, end.x, end.y]
}

function getExtendedRayPoints(points: Point[]): number[] {
  if (points.length < 2) return getPolygonPoints(points)
  const [start, through] = points
  const full = getExtendedLinePoints(points)
  if (full.length < 4) return [start.x, start.y, through.x, through.y]

  const p1 = { x: full[0], y: full[1] }
  const p2 = { x: full[2], y: full[3] }
  const dir = { x: through.x - start.x, y: through.y - start.y }
  const dot1 = (p1.x - start.x) * dir.x + (p1.y - start.y) * dir.y
  const dot2 = (p2.x - start.x) * dir.x + (p2.y - start.y) * dir.y
  const end = dot1 > dot2 ? p1 : p2
  return [start.x, start.y, end.x, end.y]
}

function getRenderedShapePoints(shape: Shape): number[] {
  if (shape.type === 'line') return getExtendedLinePoints(shape.points)
  if (shape.type === 'ray') return getExtendedRayPoints(shape.points)
  return getPolygonPoints(shape.points)
}

function getCurvedArrowControl(start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const bend = Math.max(14, Math.min(40, len * 0.28))
  return {
    x: (start.x + end.x) / 2 + nx * bend,
    y: (start.y + end.y) / 2 + ny * bend,
    gridX: 0,
    gridY: 0
  }
}

function getArrowHeadPointsByTangent(from: { x: number, y: number }, tip: { x: number, y: number }): number[] {
  const vx = tip.x - from.x
  const vy = tip.y - from.y
  const len = Math.hypot(vx, vy)
  if (len < 0.001) return []
  const ux = vx / len
  const uy = vy / len
  const px = -uy
  const py = ux
  const headLength = 15
  const headHalfWidth = 7
  const notchDepth = 6
  const left = {
    x: tip.x - ux * headLength + px * headHalfWidth,
    y: tip.y - uy * headLength + py * headHalfWidth
  }
  const right = {
    x: tip.x - ux * headLength - px * headHalfWidth,
    y: tip.y - uy * headLength - py * headHalfWidth
  }
  const notch = {
    x: tip.x - ux * (headLength - notchDepth),
    y: tip.y - uy * (headLength - notchDepth)
  }
  // Concave polygon: tip -> left -> notch -> right
  return [tip.x, tip.y, left.x, left.y, notch.x, notch.y, right.x, right.y]
}

function getArrowShaftPoints(shape: Shape): number[] {
  if (!shape.points[0] || !shape.points[1]) return []
  const start = shape.points[0]
  const end = shape.points[1]
  if (shape.type === 'arrow-curve') {
    const control = getCurvedArrowControl(start, end)
    return createQuadraticCurvePoints(start, control, end)
  }
  return [start.x, start.y, end.x, end.y]
}

function getArrowHeadPoints(shape: Shape): number[] {
  if (!shape.points[0] || !shape.points[1]) return []
  const start = shape.points[0]
  const end = shape.points[1]
  const tangentFrom = shape.type === 'arrow-curve'
    ? getCurvedArrowControl(start, end)
    : start
  return getArrowHeadPointsByTangent(tangentFrom, end)
}

function getArrowPreviewShaftPoints(): number[] {
  const start = toolStore.tempPoints[0]
  const end = mousePos.value
  if (!start || !end) return []
  if (toolStore.shapeType === 'arrow-curve') {
    const control = getCurvedArrowControl(start, end)
    return createQuadraticCurvePoints(start, control, end)
  }
  return [start.x, start.y, end.x, end.y]
}

function getArrowPreviewHeadPoints(): number[] {
  const start = toolStore.tempPoints[0]
  const end = mousePos.value
  if (!start || !end) return []
  const tangentFrom = toolStore.shapeType === 'arrow-curve'
    ? getCurvedArrowControl(start, end)
    : start
  return getArrowHeadPointsByTangent(tangentFrom, end)
}
const {
  selectedShapeTransformUI,
  selectedTextGuideTransformUI,
  getPreviewPoints,
} = useCanvasTransformPreview({
  toolStore,
  canvasStore,
  mousePos,
  selectedTextGuideId,
  getTextGuideAnchor,
  calculateDistancePixels,
  computeEquilateralTriangle,
  computeRightTriangleThirdPoint,
  computeIsoscelesApex,
  computeSquare,
  computeRectangle,
  computeRhombus,
  computeParallelogram,
  computeTrapezoidFromThreePoints,
  computeRegularPolygon,
})

function handleLatexPointOverlayContextMenu(
  shapeId: string,
  pointIndex: number,
  e: MouseEvent
) {
  e.preventDefault()
  emit('contextmenu', {
    x: e.clientX,
    y: e.clientY,
    target: { kind: 'shape-guide-item', shapeId, guideKey: 'pointName', itemIndex: pointIndex }
  })
}

function handleLatexShapeGuideOverlayDblClick(
  shapeId: string,
  guideKey: 'length' | 'angle' | 'height',
  itemIndex: number
) {
  const shape = shapeMap.value.get(shapeId)
  if (!shape) return
  startShapeGuideValueEdit(shape, guideKey, itemIndex)
}

function handleLatexShapeGuideOverlayContextMenu(
  shapeId: string,
  guideKey: 'length' | 'angle' | 'height',
  itemIndex: number,
  e: MouseEvent
) {
  e.preventDefault()
  emit('contextmenu', {
    x: e.clientX,
    y: e.clientY,
    target: { kind: 'shape-guide-item', shapeId, guideKey, itemIndex }
  })
}

function getShapeGuideLatexTopLeft(shape: Shape, key: 'length' | 'angle' | 'height', itemIndex: number): { x: number, y: number } {
  const anchor = getShapeGuideLabelWorldPos(shape, key, itemIndex)
  const fontSize = getShapeGuideItemStyle(shape, key, itemIndex).fontSize || DEFAULT_TEXT_FONT_SIZE
  if (key === 'angle') {
    const text = getShapeAngleValueText(shape, itemIndex)
    return {
      x: snapTextValue(anchor.x - (getTextWidthPx(text.replace(/°$/, '') + ' °', fontSize) * 0.5)),
      y: snapTextValue(anchor.y - getShapeAngleTextOffsetY(shape, itemIndex, fontSize))
    }
  }
  const mainText = key === 'height'
    ? getShapeHeightValueText(shape)
    : shape.type === 'circle'
      ? getCircleLengthValueText(shape)
      : getShapeLengthValueText(shape, itemIndex)
  const displayText = toolStore.showGuideUnit ? `${getLengthMainText(mainText)} cm` : getLengthMainText(mainText)
  const offsetX = getTextWidthPx(displayText, fontSize) * 0.5
  return {
    x: snapTextValue(anchor.x - offsetX),
    y: snapTextValue(anchor.y - (fontSize * 0.45))
  }
}

function getShapeGuideLatexAnchorX(shape: Shape, key: 'length' | 'angle' | 'height', itemIndex: number): number {
  return getShapeGuideLabelWorldPos(shape, key, itemIndex).x
}

const latexShapeGuideOverlays = computed(() => {
  const overlays: Array<{
    key: string
    x: number
    y: number
    html: string
    shapeId: string
    guideKey: 'length' | 'angle' | 'height'
    itemIndex: number
    color: string
    fontSize: number
    interactive?: boolean
    centerAlign?: boolean
  }> = []

  for (const shape of canvasStore.shapes) {
    if (shape.visible === false) continue

    if (toolStore.showLength && (shape.type === 'circle' ? isShapeGuideVisible(shape, 'radius') : isShapeGuideVisible(shape, 'length'))) {
      const indices = shape.type === 'circle' ? [0] : getShapeAutoLengthIndices(shape)
      for (const itemIndex of indices) {
        if (!isShapeGuideItemVisible(shape, 'length', itemIndex)) continue
        if (isShapeGuideItemBlank(shape, 'length', itemIndex)) {
          if (toolStore.showGuideUnit) {
            const pos = getShapeGuideBlankTextPos(shape, 'length', itemIndex, 'unit')
            overlays.push({
              key: `${shape.id}-length-${itemIndex}-blank-unit`,
              x: pos.x,
              y: pos.y,
              html: renderLatexLikeHtml(toBlankUnitLatex(), true),
              shapeId: shape.id,
              guideKey: 'length',
              itemIndex,
              color: getShapeGuideTextColor(shape, 'length', itemIndex, DEFAULT_TEXT_COLOR),
              fontSize: getShapeGuideItemStyle(shape, 'length', itemIndex).fontSize || DEFAULT_TEXT_FONT_SIZE
            })
          }
          continue
        }
        const text = shape.type === 'circle'
          ? getLengthLatexText(getCircleLengthValueText(shape))
          : getLengthLatexText(getShapeLengthValueText(shape, itemIndex))
        if (!text) continue
        const pos = getShapeGuideLatexTopLeft(shape, 'length', itemIndex)
        overlays.push({
          key: `${shape.id}-length-${itemIndex}`,
          x: getShapeGuideLatexAnchorX(shape, 'length', itemIndex),
          y: pos.y,
          html: renderLatexLikeHtml(text, true),
          shapeId: shape.id,
          guideKey: 'length',
          itemIndex,
          color: getShapeGuideTextColor(shape, 'length', itemIndex, DEFAULT_TEXT_COLOR),
          fontSize: getShapeGuideItemStyle(shape, 'length', itemIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
          centerAlign: true
        })
      }
    }

    if (toolStore.showHeight && isShapeGuideVisible(shape, 'height') && isShapeGuideItemVisible(shape, 'height', 0) && getShapeHeightGuide(shape)) {
      if (isShapeGuideItemBlank(shape, 'height', 0)) {
        if (toolStore.showGuideUnit) {
          const pos = getShapeGuideBlankTextPos(shape, 'height', 0, 'unit')
          overlays.push({
            key: `${shape.id}-height-0-blank-unit`,
            x: pos.x,
            y: pos.y,
            html: renderLatexLikeHtml(toBlankUnitLatex(), true),
            shapeId: shape.id,
            guideKey: 'height',
            itemIndex: 0,
            color: getShapeGuideTextColor(shape, 'height', 0, DEFAULT_TEXT_COLOR),
            fontSize: getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE
          })
        }
      } else {
        const text = getLengthLatexText(getShapeHeightValueText(shape))
        if (text) {
          const pos = getShapeGuideLatexTopLeft(shape, 'height', 0)
          overlays.push({
            key: `${shape.id}-height-0`,
            x: getShapeGuideLatexAnchorX(shape, 'height', 0),
            y: pos.y,
            html: renderLatexLikeHtml(text, true),
            shapeId: shape.id,
            guideKey: 'height',
            itemIndex: 0,
            color: getShapeGuideTextColor(shape, 'height', 0, DEFAULT_TEXT_COLOR),
            fontSize: getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
            centerAlign: true
          })
        }
      }
    }

    if (toolStore.showAngle && isShapeGuideVisible(shape, 'angle')) {
      for (const itemIndex of getShapeAutoAngleIndices(shape, toolStore.angleDisplayMode)) {
        if (!isShapeGuideItemVisible(shape, 'angle', itemIndex)) continue
        if (isShapeGuideItemBlank(shape, 'angle', itemIndex)) {
          const pos = getShapeGuideBlankTextPos(shape, 'angle', itemIndex, 'suffix')
          overlays.push({
            key: `${shape.id}-angle-${itemIndex}-blank-suffix`,
            x: pos.x - 3,
            y: pos.y - 3,
            html: renderLatexLikeHtml(toBlankAngleLatex(), true),
            shapeId: shape.id,
            guideKey: 'angle',
            itemIndex,
            color: getShapeGuideTextColor(shape, 'angle', itemIndex, DEFAULT_TEXT_COLOR),
            fontSize: getShapeGuideItemStyle(shape, 'angle', itemIndex).fontSize || DEFAULT_TEXT_FONT_SIZE
          })
          continue
        }
        if (!shouldRenderShapeAngleText(shape, itemIndex, toolStore.angleDisplayMode)) continue
        const text = getShapeAngleValueText(shape, itemIndex)
        if (!text) continue
        const pos = getShapeGuideLatexTopLeft(shape, 'angle', itemIndex)
        overlays.push({
          key: `${shape.id}-angle-${itemIndex}`,
          x: getShapeGuideLatexAnchorX(shape, 'angle', itemIndex),
          y: pos.y,
          html: renderLatexLikeHtml(toAngleLatex(text), true),
          shapeId: shape.id,
          guideKey: 'angle',
          itemIndex,
          color: getShapeGuideTextColor(shape, 'angle', itemIndex, DEFAULT_TEXT_COLOR),
          fontSize: getShapeGuideItemStyle(shape, 'angle', itemIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
          centerAlign: true
        })
      }
    }
  }

  return overlays
})

const latexBlankBoxGuideOverlays = computed(() => {
  const overlays: Array<{
    key: string
    x: number
    y: number
    html: string
    guideId: string
    color: string
    fontSize: number
  }> = []

  for (const guide of canvasStore.guides) {
    if (guide.type !== 'blank-box' || guide.visible === false) continue
    const unitMode = getBlankBoxUnitMode(guide)
    const html = toBlankBoxSuffixLatex(unitMode)
    if (!html) continue
    const pos = getBlankBoxSuffixLatexPos(guide)
    overlays.push({
      key: `${guide.id}-suffix`,
      x: pos.x,
      y: pos.y,
      html: renderLatexLikeHtml(html, true),
      guideId: guide.id,
      color: DEFAULT_TEXT_COLOR,
      fontSize: guide.fontSize || DEFAULT_TEXT_FONT_SIZE
    })
  }

  return overlays
})

type RuntimeLatexSpriteState = Awaited<ReturnType<typeof createLatexCanvasSprite>> & {
  signature: string
}

type RuntimeLatexCanvasEntry = {
  key: string
  html: string
  color: string
  fontSize: number
  fontFamily: string
}

const runtimeShapeLatexEntries = computed<RuntimeLatexCanvasEntry[]>(() => [
  ...latexTextGuideOverlays.value.map((overlay) => ({
    key: `text:${overlay.key}`,
    html: overlay.html,
    color: overlay.color,
    fontSize: overlay.fontSize,
    fontFamily: DEFAULT_TEXT_FONT_FAMILY
  })),
  ...latexPointLabelOverlays.value.map((overlay) => ({
    key: `point:${overlay.key}`,
    html: overlay.html,
    color: overlay.color,
    fontSize: overlay.fontSize,
    fontFamily: DEFAULT_TEXT_FONT_FAMILY
  })),
  ...latexShapeGuideOverlays.value.map((overlay) => ({
    key: `shape:${overlay.key}`,
    html: overlay.html,
    color: overlay.color,
    fontSize: overlay.fontSize,
    fontFamily: DEFAULT_TEXT_FONT_FAMILY
  })),
  ...latexBlankBoxGuideOverlays.value.map((overlay) => ({
    key: `guide:${overlay.key}`,
    html: overlay.html,
    color: overlay.color,
    fontSize: overlay.fontSize,
    fontFamily: DEFAULT_TEXT_FONT_FAMILY
  }))
])

const runtimeShapeLatexSprites = ref<Record<string, RuntimeLatexSpriteState>>({})

watch(runtimeShapeLatexEntries, (entries) => {
  const activeKeys = new Set(entries.map((entry) => entry.key))
  const nextSprites: Record<string, RuntimeLatexSpriteState> = {}
  for (const [key, sprite] of Object.entries(runtimeShapeLatexSprites.value)) {
    if (activeKeys.has(key)) nextSprites[key] = sprite
  }
  runtimeShapeLatexSprites.value = nextSprites

  for (const entry of entries) {
    const signature = JSON.stringify([entry.html, entry.color, entry.fontSize, entry.fontFamily])
    if (runtimeShapeLatexSprites.value[entry.key]?.signature === signature) continue
    createLatexCanvasSprite({
      html: entry.html,
      color: entry.color,
      fontSize: entry.fontSize,
      fontFamily: entry.fontFamily
    }).then((sprite) => {
      const stillActive = runtimeShapeLatexEntries.value.some((target) => target.key === entry.key)
      if (!stillActive) return
      runtimeShapeLatexSprites.value = {
        ...runtimeShapeLatexSprites.value,
        [entry.key]: { ...sprite, signature }
      }
      const stage = stageRef.value?.getNode?.()
      stage?.batchDraw?.()
    }).catch(() => {
      // Ignore sprite generation failures and keep the canvas fallback empty.
    })
  }
}, { immediate: true })

const latexPointLabelOverlayMap = computed(() => {
  return new Map(latexPointLabelOverlays.value.map((overlay) => [overlay.key, overlay]))
})

const latexTextGuideOverlayMap = computed(() => {
  return new Map(latexTextGuideOverlays.value.map((overlay) => [overlay.key, overlay]))
})

const latexShapeGuideOverlayMap = computed(() => {
  return new Map(latexShapeGuideOverlays.value.map((overlay) => [overlay.key, overlay]))
})

const latexBlankBoxGuideOverlayMap = computed(() => {
  return new Map(latexBlankBoxGuideOverlays.value.map((overlay) => [overlay.key, overlay]))
})

function getRuntimeTextGuideLatexSprite(guideId: string) {
  const overlay = latexTextGuideOverlayMap.value.get(guideId)
  const sprite = runtimeShapeLatexSprites.value[`text:${guideId}`]
  if (!overlay || !sprite) return null
  return {
    overlay,
    sprite
  }
}

function getRuntimePointLatexSprite(shapeId: string, pointIndex: number) {
  const overlay = latexPointLabelOverlayMap.value.get(`${shapeId}-${pointIndex}`)
  const sprite = runtimeShapeLatexSprites.value[`point:${shapeId}-${pointIndex}`]
  if (!overlay || !sprite) return null
  return {
    overlay,
    sprite
  }
}

function getRuntimeShapeGuideLatexSprite(overlayKey: string) {
  const overlay = latexShapeGuideOverlayMap.value.get(overlayKey)
  const sprite = runtimeShapeLatexSprites.value[`shape:${overlayKey}`]
  if (!overlay || !sprite) return null
  return {
    overlay,
    sprite
  }
}

function getRuntimeBlankBoxGuideLatexSprite(guideId: string) {
  const overlay = latexBlankBoxGuideOverlayMap.value.get(`${guideId}-suffix`)
  const sprite = runtimeShapeLatexSprites.value[`guide:${guideId}-suffix`]
  if (!overlay || !sprite) return null
  return {
    overlay,
    sprite
  }
}

function getRuntimeLatexImageX(
  overlay: { x: number, centerAlign?: boolean },
  sprite: { insetX: number, contentWidth: number }
): number {
  return snapTextValue((overlay.centerAlign ? overlay.x - (sprite.contentWidth * 0.5) : overlay.x) - sprite.insetX)
}

function getRuntimeLatexImageY(
  overlay: { y: number },
  sprite: { insetY: number }
): number {
  return snapTextValue(overlay.y - sprite.insetY)
}

function getRuntimeTextGuideImageConfig(guideId: string) {
  const runtime = getRuntimeTextGuideLatexSprite(guideId)
  if (!runtime) return null
  const { overlay, sprite } = runtime
  const x = snapTextValue(overlay.x)
  const y = snapTextValue(overlay.y - (overlay.fontSize * 0.45))
  return {
    image: sprite.image,
    x,
    y,
    width: sprite.width,
    height: sprite.height,
    offsetX: snapTextValue((sprite.contentWidth * 0.5) + sprite.insetX),
    offsetY: snapTextValue((overlay.fontSize * 0.45) + sprite.insetY),
    rotation: overlay.rotation
  }
}

function getTextGuideDisplayText(text: string): string {
  return formatTextGuideDisplayText(text)
}

function shouldRenderCanvasTextGuide(): boolean {
  return true
}

// ── 진짜 벡터 SVG 내보내기 ───────────────────────────────────────────
const { exportImage, createPngDataUrl } = useCanvasExport({
  stageRef,
  canvasWidth,
  canvasHeight,
  svg: {
    stageWidth,
    stageHeight,
    gridMinorOpacity: GRID_MINOR_OPACITY,
    gridMajorOpacity: GRID_MAJOR_OPACITY,
    gridMinorLineWidth: GRID_MINOR_LINE_WIDTH,
    gridMajorLineWidth: GRID_MAJOR_LINE_WIDTH,
    gridDotOpacity: GRID_DOT_OPACITY,
    gridDotRadius: GRID_DOT_RADIUS,
    defaultTextFontFamily: DEFAULT_TEXT_FONT_FAMILY,
    defaultTextFontSize: DEFAULT_TEXT_FONT_SIZE,
    defaultTextColor: DEFAULT_TEXT_COLOR,
    lengthGuideDefaultColor: LENGTH_GUIDE_DEFAULT_COLOR,
    angleGuideDefaultColor: ANGLE_GUIDE_DEFAULT_COLOR,
    heightGuideDefaultColor: HEIGHT_GUIDE_DEFAULT_COLOR,
    defaultGuideLinePx: DEFAULT_GUIDE_LINE_PX,
    defaultHeightGuideLinePx: DEFAULT_HEIGHT_GUIDE_LINE_PX,
    blankBorderColor: BLANK_BORDER_COLOR,
    blankBorderWidthPx: BLANK_BORDER_WIDTH_PX,
    guideRightAngleMarkerSize: GUIDE_RIGHT_ANGLE_MARKER_SIZE,
    ptToPx: PT_TO_PX,
    getColors,
    getShapeStrokeWidthPx,
    calculateDistancePixels,
    getArrowShaftPoints,
    getArrowHeadPoints,
    getExtendedRayPoints,
    getArrowHeadPointsByTangent,
    getRenderedShapePoints,
    isShapePointVisible,
    isShapeGuideVisible,
    getShapeAutoLengthIndices,
    isShapeGuideItemVisible,
    getShapeGuideItemStyle,
    getShapeLengthCurveSegments,
    isShapeGuideItemBlank,
    getShapeGuideLabelWorldPos,
    getShapeLengthValueText,
    getShapeLengthTextOffsetX,
    getShapeLengthUnitX,
    getShapeGuideTextColor,
    getShapeGuideFallbackTextColor,
    getShapeGuideBlankTextPos,
    getShapeGuideBlankRect,
    getCircleLengthEndpoints,
    getCircleLengthCurveSegments,
    getCircleLengthLabelWorldPos,
    getCircleLengthValueText,
    getShapeHeightGuide,
    getShapeHeightRightAngleMarkerPoints,
    getShapeHeightLengthGuideSegments,
    getShapeHeightValueText,
    getShapeAutoAngleIndices,
    isRightAngleAt,
    getRightAngleMarkerPoints,
    getShapeAngleArcPolyline,
    getShapeAngleValueText,
    shouldRenderShapeAngleText,
    getShapeAngleTextOffsetX,
    getShapeAngleTextOffsetY,
    getShapePointNameTextPos,
    getShapeGuideItemOffset,
    getGlobalPointLabel,
    getLengthGuideCurvePoints,
    getLengthGuideLabelPos,
    isRightAngleGuide,
    getRightAngleGuideMarkerPoints,
    getAngleArcPoints,
    stripGuideUnit,
    getLengthUnitGapPx,
    getTextWidthPx,
    getUnitYFromCenteredText,
    getTextGuideAnchor,
    getTextGuideFontSize,
    getTextGuideRotation,
    formatMathText,
    formatLengthGuideText,
  },
  alertRenderFailure: () => {
    alert('이미지 렌더링에 실패했습니다. 해상도를 낮추거나 이미지 크기를 줄여 다시 시도해 주세요.')
  }
})

defineExpose({ exportImage, createPngDataUrl })
</script>

<template>
  <div
    ref="containerRef"
    class="w-full h-full bg-white overflow-hidden relative"
    @mouseleave="handleMouseLeave"
    @wheel="handleWheel"
    @contextmenu.prevent="handleNativeContextMenu"
  >
    <v-stage
      ref="stageRef"
      :config="{ width: containerSize.width, height: containerSize.height, scaleX: zoomScale, scaleY: zoomScale, x: viewportOffset.x, y: viewportOffset.y }"
      @click="handleClick"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
    >
      <!-- Grid layer -->
      <v-layer :config="{ listening: false }">
        <v-rect :config="{ name: 'export-bg', x: 0, y: 0, width: stageWidth, height: stageHeight, fill: toolStore.gridBackgroundColor }" />
        <!-- gridMode === 'grid': show grid lines -->
        <template v-if="toolStore.gridMode === 'grid'">
          <v-shape :key="`grid-${gridShapeRenderKey}`" :config="{ sceneFunc: drawGridLines, listening: false }" />
        </template>

        <!-- gridMode === 'dots': show main dots only -->
        <template v-else-if="toolStore.gridMode === 'dots'">
          <v-shape :key="`dots-${gridShapeRenderKey}`" :config="{ sceneFunc: drawMainGridDots, listening: false }" />
        </template>

        <!-- gridMode === 'none': render background only -->
      </v-layer>

      <!-- Shape layer -->
      <v-layer>
        <!-- Top-level items -->
        <template v-for="item in topLevelRenderItems" :key="item.kind === 'shape' ? item.shape.id : item.guide.id">
          <template v-if="item.kind === 'shape' && item.shape.visible !== false">
            <template v-for="shape in [item.shape]" :key="shape.id">
          <template v-if="shape.type === 'point' || shape.type === 'point-on-object'">
            <v-circle
              @click="handleShapeNodeClick(shape.id, $event)"
              @mousedown="handleShapeNodeMouseDown(shape.id, $event)"
              @mouseenter="handleShapeNodeMouseEnter(shape.id)"
              @mouseleave="handleShapeNodeMouseLeave(shape.id)"
              @contextmenu="handleShapeContextMenu(shape.id, $event)"
              :config="{
                name: `shape-hit-${shape.id}`,
                x: shape.points[0]?.x ?? 0,
                y: shape.points[0]?.y ?? 0,
                radius: 3,
                fill: getColors(shape).point,
                shadowColor: getShapeShadowConfig(shape.id).color,
                shadowBlur: getShapeShadowConfig(shape.id).blur,
                shadowOpacity: getShapeShadowConfig(shape.id).opacity
              }"
            />
            <v-rect
              v-if="toolStore.showPointName && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 0) && isShapeGuideItemBlank(shape, 'pointName', 0)"
              @dblclick="handlePointLabelDblClick(shape, 0, $event)"
              :config="{
                x: getShapeGuideBlankRect(shape, 'pointName', 0).x,
                y: getShapeGuideBlankRect(shape, 'pointName', 0).y,
                    width: getShapeGuideBlankRect(shape, 'pointName', 0).width,
                    height: getShapeGuideBlankRect(shape, 'pointName', 0).height,
                    cornerRadius: getShapeGuideBlankRect(shape, 'pointName', 0).cornerRadius,
                    fill: '#FFFFFF',
                    listening: true,
                    ...getBlankGuideHighlightConfig(isGuideTextHighlighted(shape.id, 'pointName', 0))
                  }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', 0)"
              @mouseleave="handleGuideTextMouseLeave"
              @mousedown="handleShapeGuideTextMouseDown(shape.id, 'pointName', 0, $event)"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', 0, $event)"
            />
            <v-image
              v-if="getRuntimePointLatexSprite(shape.id, 0) && toolStore.showPointName && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 0) && !isShapeGuideItemBlank(shape, 'pointName', 0)"
              @dblclick="handlePointLabelDblClick(shape, 0, $event)"
              :config="{
                image: getRuntimePointLatexSprite(shape.id, 0)!.sprite.image,
                x: getRuntimeLatexImageX(getRuntimePointLatexSprite(shape.id, 0)!.overlay, getRuntimePointLatexSprite(shape.id, 0)!.sprite),
                y: getRuntimeLatexImageY(getRuntimePointLatexSprite(shape.id, 0)!.overlay, getRuntimePointLatexSprite(shape.id, 0)!.sprite),
                width: getRuntimePointLatexSprite(shape.id, 0)!.sprite.width,
                height: getRuntimePointLatexSprite(shape.id, 0)!.sprite.height,
                listening: true,
                shadowColor: isGuideTextHighlighted(shape.id, 'pointName', 0) ? '#38BDF8' : 'transparent',
                shadowBlur: isGuideTextHighlighted(shape.id, 'pointName', 0) ? 8 : 0,
                shadowOpacity: isGuideTextHighlighted(shape.id, 'pointName', 0) ? 0.45 : 0
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', 0)"
              @mouseleave="handleGuideTextMouseLeave"
              @mousedown="handleShapeGuideTextMouseDown(shape.id, 'pointName', 0, $event)"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', 0, $event)"
            />
          </template>

          <!-- Non-circle shapes -->
          <template v-else-if="shape.type !== 'circle'">
            <template v-if="shape.type === 'arrow' || shape.type === 'arrow-curve'">
              <v-line
                @click="handleShapeNodeClick(shape.id, $event)"
                @mousedown="handleShapeNodeMouseDown(shape.id, $event)"
                @mouseenter="handleShapeNodeMouseEnter(shape.id)"
                @mouseleave="handleShapeNodeMouseLeave(shape.id)"
                @contextmenu="handleShapeContextMenu(shape.id, $event)"
                :config="{
                  name: `shape-hit-${shape.id}`,
                  points: getArrowShaftPoints(shape),
                  stroke: isShapeHovered(shape.id) ? '#38BDF8' : getColors(shape).stroke,
                  strokeWidth: isShapeHovered(shape.id)
                    ? Math.max(getShapeStrokeWidthPx(shape) + 1.8, 2.6)
                    : getShapeStrokeWidthPx(shape),
                  shadowColor: getShapeShadowConfig(shape.id).color,
                  shadowBlur: getShapeShadowConfig(shape.id).blur,
                  shadowOpacity: getShapeShadowConfig(shape.id).opacity,
                  lineCap: 'round',
                  lineJoin: 'round',
                  hitStrokeWidth: 14
                }"
              />
              <v-line
                @click="handleShapeNodeClick(shape.id, $event)"
                @mousedown="handleShapeNodeMouseDown(shape.id, $event)"
                @mouseenter="handleShapeNodeMouseEnter(shape.id)"
                @mouseleave="handleShapeNodeMouseLeave(shape.id)"
                @contextmenu="handleShapeContextMenu(shape.id, $event)"
                :config="{
                  name: `shape-hit-${shape.id}`,
                  points: getArrowHeadPoints(shape),
                  stroke: isShapeHovered(shape.id) ? '#38BDF8' : getColors(shape).stroke,
                  fill: isShapeHovered(shape.id) ? '#38BDF8' : getColors(shape).stroke,
                  closed: true,
                  strokeWidth: isShapeHovered(shape.id)
                    ? Math.max(getShapeStrokeWidthPx(shape) + 1.8, 2.6)
                    : getShapeStrokeWidthPx(shape),
                  lineCap: 'round',
                  lineJoin: 'round',
                  hitStrokeWidth: 14
                }"
              />
            </template>
            <template v-else-if="shape.type === 'ray'">
              <v-arrow
                @click="handleShapeNodeClick(shape.id, $event)"
                @mousedown="handleShapeNodeMouseDown(shape.id, $event)"
                @mouseenter="handleShapeNodeMouseEnter(shape.id)"
                @mouseleave="handleShapeNodeMouseLeave(shape.id)"
                @contextmenu="handleShapeContextMenu(shape.id, $event)"
                :config="{
                  name: `shape-hit-${shape.id}`,
                  points: getExtendedRayPoints(shape.points),
                  stroke: isShapeHovered(shape.id) ? '#38BDF8' : getColors(shape).stroke,
                  fill: isShapeHovered(shape.id) ? '#38BDF8' : getColors(shape).stroke,
                  strokeWidth: isShapeHovered(shape.id)
                    ? Math.max(getShapeStrokeWidthPx(shape) + 1.8, 2.6)
                    : getShapeStrokeWidthPx(shape),
                  shadowColor: getShapeShadowConfig(shape.id).color,
                  shadowBlur: getShapeShadowConfig(shape.id).blur,
                  shadowOpacity: getShapeShadowConfig(shape.id).opacity,
                  pointerLength: 14,
                  pointerWidth: 7,
                  lineCap: 'round',
                  lineJoin: 'round',
                  hitStrokeWidth: 14
                }"
              />
            </template>
            <template v-else>
              <v-line
                @click="handleShapeNodeClick(shape.id, $event)"
                @mousedown="handleShapeNodeMouseDown(shape.id, $event)"
                @mouseenter="handleShapeNodeMouseEnter(shape.id)"
                @mouseleave="handleShapeNodeMouseLeave(shape.id)"
                @contextmenu="handleShapeContextMenu(shape.id, $event)"
                :config="{
                  name: `shape-hit-${shape.id}`,
                  points: getRenderedShapePoints(shape),
                  closed: !OPEN_SHAPE_TYPES.has(shape.type),
                  fill: OPEN_SHAPE_TYPES.has(shape.type) ? undefined : getColors(shape).fill,
                  stroke: isShapeHovered(shape.id) ? '#38BDF8' : getColors(shape).stroke,
                  strokeWidth: isShapeHovered(shape.id)
                    ? Math.max(getShapeStrokeWidthPx(shape) + 1.8, 2.6)
                    : getShapeStrokeWidthPx(shape),
                  shadowColor: getShapeShadowConfig(shape.id).color,
                  shadowBlur: getShapeShadowConfig(shape.id).blur,
                  shadowOpacity: getShapeShadowConfig(shape.id).opacity,
                  hitStrokeWidth: 14
                }"
              />
            </template>
            <!-- Shape points -->
            <template v-for="(point, pIndex) in shape.points" :key="`${shape.id}-point-${pIndex}`">
              <v-circle
                v-if="isShapePointVisible(shape, pIndex)"
                :config="{
                  x: point.x,
                  y: point.y,
                  radius: 3,
                  fill: getColors(shape).point,
                  listening: false
                }"
              />
              <v-circle
                :config="{
                  x: point.x,
                  y: point.y,
                  radius: 9,
                  fill: 'rgba(0,0,0,0)',
                  stroke: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? '#38BDF8' : 'transparent',
                  strokeWidth: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? 1.8 : 0,
                  shadowColor: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? 0.45 : 0,
                  hitStrokeWidth: 16
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', pIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', pIndex, $event)"
              />
            </template>
            <v-circle
              v-if="false && toolStore.mode === 'select' && canvasStore.selectedShapeId === shape.id"
              v-for="(point, pIndex) in shape.points"
              :key="`${shape.id}-vertex-handle-${pIndex}`"
              @mousedown="handleVertexHandleMouseDown(shape.id, pIndex, $event)"
              @click="handleVertexHandleClick(shape.id, $event)"
              @mouseenter="handleVertexMouseEnter(shape.id, pIndex)"
              @mouseleave="handleVertexMouseLeave"
              :config="{
                x: point.x,
                y: point.y,
                radius: isVertexHovered(shape.id, pIndex) ? 7 : 6,
                fill: isVertexHovered(shape.id, pIndex) ? '#DBEAFE' : '#ffffff',
                stroke: isVertexHovered(shape.id, pIndex) ? '#1D4ED8' : '#2563EB',
                strokeWidth: isVertexHovered(shape.id, pIndex) ? 2.5 : 2,
                shadowColor: isVertexHovered(shape.id, pIndex) ? '#60A5FA' : 'transparent',
                shadowBlur: isVertexHovered(shape.id, pIndex) ? 10 : 0,
                shadowOpacity: isVertexHovered(shape.id, pIndex) ? 0.45 : 0,
                hitStrokeWidth: 14
              }"
            />
            <!-- 변 길이: 점-점 점선 곡선 + 길이 텍스트 -->
            <template
              v-if="toolStore.showLength && isShapeGuideVisible(shape, 'length')"
              v-for="pIndex in getShapeAutoLengthIndices(shape)"
              :key="`${shape.id}-length-${pIndex}`"
            >
              <v-line
                v-for="(segmentPoints, segIdx) in getShapeLengthCurveSegments(shape, pIndex)"
                v-if="isShapeGuideItemVisible(shape, 'length', pIndex)"
                :key="`${shape.id}-length-seg-${pIndex}-${segIdx}`"
                :config="{
                  points: segmentPoints,
                  stroke: isGuideTextHighlighted(shape.id, 'length', pIndex)
                    ? '#38BDF8'
                    : (getShapeGuideItemStyle(shape, 'length', pIndex).lineColor || getShapeGuideItemStyle(shape, 'length', pIndex).color || LENGTH_GUIDE_DEFAULT_COLOR),
                  strokeWidth: isGuideTextHighlighted(shape.id, 'length', pIndex)
                    ? (getShapeGuideItemStyle(shape, 'length', pIndex).lineWidth || DEFAULT_GUIDE_LINE_PX) + 1.6
                    : (getShapeGuideItemStyle(shape, 'length', pIndex).lineWidth || DEFAULT_GUIDE_LINE_PX),
                  dash: GUIDE_DASH_PATTERN,
                  hitStrokeWidth: 18,
                  shadowColor: isGuideTextHighlighted(shape.id, 'length', pIndex) ? '#0EA5E9' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'length', pIndex) ? 14 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'length', pIndex) ? 0.85 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'length', pIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'length', pIndex, $event)"
              />
              <v-rect
                v-if="isShapeGuideItemBlank(shape, 'length', pIndex) && isShapeGuideItemVisible(shape, 'length', pIndex)"
                :config="{
                  x: getShapeGuideBlankRect(shape, 'length', pIndex).x,
                  y: getShapeGuideBlankRect(shape, 'length', pIndex).y,
                  width: getShapeGuideBlankRect(shape, 'length', pIndex).width,
                  height: getShapeGuideBlankRect(shape, 'length', pIndex).height,
                  cornerRadius: getShapeGuideBlankRect(shape, 'length', pIndex).cornerRadius,
                  fill: '#FFFFFF',
                  listening: true,
                  ...getBlankGuideHighlightConfig(isGuideTextHighlighted(shape.id, 'length', pIndex))
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'length', pIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'length', pIndex, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'length', pIndex, $event)"
              />
              <v-image
                v-if="getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}-blank-unit`) && isShapeGuideItemBlank(shape, 'length', pIndex) && isShapeGuideItemVisible(shape, 'length', pIndex) && toolStore.showGuideUnit"
                :config="{
                  image: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}-blank-unit`)!.sprite.image,
                  x: getRuntimeLatexImageX(getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}-blank-unit`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}-blank-unit`)!.sprite),
                  y: getRuntimeLatexImageY(getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}-blank-unit`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}-blank-unit`)!.sprite),
                  width: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}-blank-unit`)!.sprite.width,
                  height: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}-blank-unit`)!.sprite.height,
                  listening: false
                }"
              />
            <v-image
                v-if="getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}`) && !isShapeGuideItemBlank(shape, 'length', pIndex) && isShapeGuideItemVisible(shape, 'length', pIndex)"
                :config="{
                  image: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}`)!.sprite.image,
                  x: getRuntimeLatexImageX(getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}`)!.sprite),
                  y: getRuntimeLatexImageY(getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}`)!.sprite),
                  width: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}`)!.sprite.width,
                  height: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-${pIndex}`)!.sprite.height,
                  listening: true,
                  shadowColor: isGuideTextHighlighted(shape.id, 'length', pIndex) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'length', pIndex) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'length', pIndex) ? 0.45 : 0
                }"
                @dblclick="handleShapeGuideValueDblClick(shape, 'length', pIndex, $event)"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'length', pIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'length', pIndex, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'length', pIndex, $event)"
              />
            </template>
            <template v-if="toolStore.showHeight && isShapeGuideVisible(shape, 'height') && isShapeGuideItemVisible(shape, 'height', 0)">
              <v-line
                v-if="getShapeHeightGuide(shape)"
                :config="{
                  points: (() => {
                    const h = getShapeHeightGuide(shape)!
                    return [h.apex.x, h.apex.y, h.foot.x, h.foot.y]
                  })(),
                  stroke: getShapeHeightMainLineColor(shape),
                  strokeWidth: isGuideTextHighlighted(shape.id, 'height', 0)
                    ? getShapeHeightMainLineWidth(shape) + 1.6
                    : getShapeHeightMainLineWidth(shape),
                  dash: GUIDE_DASH_PATTERN,
                  hitStrokeWidth: 18,
                  shadowColor: isGuideTextHighlighted(shape.id, 'height', 0) ? '#0EA5E9' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'height', 0) ? 14 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'height', 0) ? 0.85 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'height', 0)"
                @mouseleave="handleGuideTextMouseLeave"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'height', 0, $event)"
              />
              <v-line
                v-if="getShapeHeightRightAngleMarkerPoints(shape).length"
                :config="{
                  points: getShapeHeightRightAngleMarkerPoints(shape),
                  stroke: isGuideTextHighlighted(shape.id, 'height', 0) ? '#38BDF8' : ANGLE_GUIDE_DEFAULT_COLOR,
                  strokeWidth: isGuideTextHighlighted(shape.id, 'height', 0) ? DEFAULT_GUIDE_LINE_PX + 1.6 : DEFAULT_GUIDE_LINE_PX,
                  hitStrokeWidth: 18,
                  shadowColor: isGuideTextHighlighted(shape.id, 'height', 0) ? '#0EA5E9' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'height', 0) ? 14 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'height', 0) ? 0.85 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'height', 0)"
                @mouseleave="handleGuideTextMouseLeave"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'height', 0, $event)"
              />
              <v-line
                v-for="(segmentPoints, segIdx) in getShapeHeightLengthGuideSegments(shape)"
                :key="`${shape.id}-height-length-seg-${segIdx}`"
                :config="{
                  points: segmentPoints,
                  stroke: isGuideTextHighlighted(shape.id, 'height', 0) ? '#38BDF8' : getShapeHeightMeasureLineColor(shape),
                  strokeWidth: isGuideTextHighlighted(shape.id, 'height', 0)
                    ? getShapeHeightMeasureLineWidth(shape) + 1.6
                    : getShapeHeightMeasureLineWidth(shape),
                  dash: GUIDE_DASH_PATTERN,
                  hitStrokeWidth: 18,
                  shadowColor: isGuideTextHighlighted(shape.id, 'height', 0) ? '#0EA5E9' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'height', 0) ? 14 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'height', 0) ? 0.85 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'height', 0)"
                @mouseleave="handleGuideTextMouseLeave"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'height', 0, $event)"
              />
              <v-line
                v-if="getShapeHeightGuide(shape) && (getShapeHeightGuide(shape)!.t < 0 || getShapeHeightGuide(shape)!.t > 1)"
                :config="{
                  points: (() => {
                    const h = getShapeHeightGuide(shape)!
                    const anchor = h.t < 0 ? h.baseA : h.baseB
                    return [anchor.x, anchor.y, h.foot.x, h.foot.y]
                  })(),
                  stroke: getShapeHeightMainLineColor(shape),
                  strokeWidth: isGuideTextHighlighted(shape.id, 'height', 0)
                    ? getShapeHeightMainLineWidth(shape) + 1.6
                    : getShapeHeightMainLineWidth(shape),
                  dash: GUIDE_DASH_PATTERN,
                  hitStrokeWidth: 18,
                  shadowColor: isGuideTextHighlighted(shape.id, 'height', 0) ? '#0EA5E9' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'height', 0) ? 14 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'height', 0) ? 0.85 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'height', 0)"
                @mouseleave="handleGuideTextMouseLeave"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'height', 0, $event)"
              />
              <v-rect
                v-if="getShapeHeightGuide(shape) && isShapeGuideItemBlank(shape, 'height', 0)"
                :config="{
                  x: getShapeGuideBlankRect(shape, 'height', 0).x,
                  y: getShapeGuideBlankRect(shape, 'height', 0).y,
                  width: getShapeGuideBlankRect(shape, 'height', 0).width,
                  height: getShapeGuideBlankRect(shape, 'height', 0).height,
                  cornerRadius: getShapeGuideBlankRect(shape, 'height', 0).cornerRadius,
                  fill: '#FFFFFF',
                  listening: true,
                  ...getBlankGuideHighlightConfig(isGuideTextHighlighted(shape.id, 'height', 0))
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'height', 0)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'height', 0, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'height', 0, $event)"
              />
              <v-image
                v-if="getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0-blank-unit`) && getShapeHeightGuide(shape) && isShapeGuideItemBlank(shape, 'height', 0) && toolStore.showGuideUnit"
                :config="{
                  image: getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0-blank-unit`)!.sprite.image,
                  x: getRuntimeLatexImageX(getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0-blank-unit`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0-blank-unit`)!.sprite),
                  y: getRuntimeLatexImageY(getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0-blank-unit`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0-blank-unit`)!.sprite),
                  width: getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0-blank-unit`)!.sprite.width,
                  height: getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0-blank-unit`)!.sprite.height,
                  listening: false
                }"
              />
              <v-image
                v-if="getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0`) && getShapeHeightGuide(shape) && !isShapeGuideItemBlank(shape, 'height', 0)"
                :config="{
                  image: getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0`)!.sprite.image,
                  x: getRuntimeLatexImageX(getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0`)!.sprite),
                  y: getRuntimeLatexImageY(getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0`)!.sprite),
                  width: getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0`)!.sprite.width,
                  height: getRuntimeShapeGuideLatexSprite(`${shape.id}-height-0`)!.sprite.height,
                  listening: true
                }"
                @dblclick="handleShapeGuideValueDblClick(shape, 'height', 0, $event)"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'height', 0)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'height', 0, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'height', 0, $event)"
              />
            </template>
            <template v-for="angleIndex in getShapeAutoAngleIndices(shape, toolStore.angleDisplayMode)" :key="`${shape.id}-angle-${angleIndex}`">
              <v-line
                v-if="toolStore.showAngle && isShapeGuideVisible(shape, 'angle') && isShapeGuideItemVisible(shape, 'angle', angleIndex) && isRightAngleAt(shape, angleIndex)"
                :config="{
                  points: (() => {
                    const marker = getRightAngleMarkerPoints(shape.points, angleIndex, RIGHT_ANGLE_MARKER_SIZE)
                    return [marker.p1.x, marker.p1.y, marker.corner.x, marker.corner.y, marker.p2.x, marker.p2.y]
                  })(),
                  stroke: isGuideTextHighlighted(shape.id, 'angle', angleIndex)
                    ? '#38BDF8'
                    : (getShapeGuideItemStyle(shape, 'angle', angleIndex).lineColor || getShapeGuideItemStyle(shape, 'angle', angleIndex).color || ANGLE_GUIDE_DEFAULT_COLOR),
                  strokeWidth: getShapeGuideItemStyle(shape, 'angle', angleIndex).lineWidth || DEFAULT_GUIDE_LINE_PX,
                  hitStrokeWidth: 14,
                  shadowColor: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? 0.45 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'angle', angleIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'angle', angleIndex, $event)"
              />
              <v-line
                v-if="toolStore.showAngle && (toolStore.angleDisplayMode === 'all' || shape.type === 'angle-line') && isShapeGuideVisible(shape, 'angle') && isShapeGuideItemVisible(shape, 'angle', angleIndex) && !isRightAngleAt(shape, angleIndex)"
                :config="{
                  points: getShapeAngleArcPolyline(shape, angleIndex),
                  stroke: isGuideTextHighlighted(shape.id, 'angle', angleIndex)
                    ? '#38BDF8'
                    : (getShapeGuideItemStyle(shape, 'angle', angleIndex).lineColor || getShapeGuideItemStyle(shape, 'angle', angleIndex).color || ANGLE_GUIDE_DEFAULT_COLOR),
                  strokeWidth: getShapeGuideItemStyle(shape, 'angle', angleIndex).lineWidth || DEFAULT_GUIDE_LINE_PX,
                  hitStrokeWidth: 14,
                  shadowColor: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? 0.45 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'angle', angleIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'angle', angleIndex, $event)"
              />
              <v-rect
                v-if="toolStore.showAngle && isShapeGuideVisible(shape, 'angle') && isShapeGuideItemVisible(shape, 'angle', angleIndex) && isShapeGuideItemBlank(shape, 'angle', angleIndex) && !isDetachedShapeGuideItem(shape, 'angle', angleIndex)"
                :config="{
                  x: getShapeGuideBlankRect(shape, 'angle', angleIndex).x,
                  y: getShapeGuideBlankRect(shape, 'angle', angleIndex).y,
                  width: getShapeGuideBlankRect(shape, 'angle', angleIndex).width,
                  height: getShapeGuideBlankRect(shape, 'angle', angleIndex).height,
                  cornerRadius: getShapeGuideBlankRect(shape, 'angle', angleIndex).cornerRadius,
                  fill: '#FFFFFF',
                  listening: true,
                  ...getBlankGuideHighlightConfig(isGuideTextHighlighted(shape.id, 'angle', angleIndex))
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'angle', angleIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'angle', angleIndex, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'angle', angleIndex, $event)"
              />
              <v-image
                v-if="getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}-blank-suffix`) && toolStore.showAngle && isShapeGuideVisible(shape, 'angle') && isShapeGuideItemVisible(shape, 'angle', angleIndex) && isShapeGuideItemBlank(shape, 'angle', angleIndex) && !isDetachedShapeGuideItem(shape, 'angle', angleIndex)"
                :config="{
                  image: getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}-blank-suffix`)!.sprite.image,
                  x: getRuntimeLatexImageX(getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}-blank-suffix`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}-blank-suffix`)!.sprite),
                  y: getRuntimeLatexImageY(getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}-blank-suffix`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}-blank-suffix`)!.sprite),
                  width: getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}-blank-suffix`)!.sprite.width,
                  height: getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}-blank-suffix`)!.sprite.height,
                  listening: false
                }"
              />
              <v-image
                v-if="getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}`) && toolStore.showAngle && (toolStore.angleDisplayMode === 'all' || shape.type === 'angle-line') && isShapeGuideVisible(shape, 'angle') && isShapeGuideItemVisible(shape, 'angle', angleIndex) && !isShapeGuideItemBlank(shape, 'angle', angleIndex) && !isDetachedShapeGuideItem(shape, 'angle', angleIndex)"
                :config="{
                  image: getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}`)!.sprite.image,
                  x: getRuntimeLatexImageX(getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}`)!.sprite),
                  y: getRuntimeLatexImageY(getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}`)!.sprite),
                  width: getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}`)!.sprite.width,
                  height: getRuntimeShapeGuideLatexSprite(`${shape.id}-angle-${angleIndex}`)!.sprite.height,
                  listening: true,
                  shadowColor: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? 0.45 : 0
                }"
                @dblclick="handleShapeGuideValueDblClick(shape, 'angle', angleIndex, $event)"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'angle', angleIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'angle', angleIndex, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'angle', angleIndex, $event)"
              />
            </template>
            <template v-if="toolStore.showPointName && isShapeGuideVisible(shape, 'pointName')">
              <template v-for="(_, pIndex) in shape.points" :key="`${shape.id}-point-name-${pIndex}`">
                <v-rect
                  v-if="isShapeGuideItemBlank(shape, 'pointName', pIndex) && isShapeGuideItemVisible(shape, 'pointName', pIndex)"
                  @dblclick="handlePointLabelDblClick(shape, pIndex, $event)"
                  :config="{
                    x: getShapeGuideBlankRect(shape, 'pointName', pIndex).x,
                    y: getShapeGuideBlankRect(shape, 'pointName', pIndex).y,
                    width: getShapeGuideBlankRect(shape, 'pointName', pIndex).width,
                    height: getShapeGuideBlankRect(shape, 'pointName', pIndex).height,
                    cornerRadius: getShapeGuideBlankRect(shape, 'pointName', pIndex).cornerRadius,
                    fill: '#FFFFFF',
                    listening: true,
                    ...getBlankGuideHighlightConfig(isGuideTextHighlighted(shape.id, 'pointName', pIndex))
                  }"
                  @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', pIndex)"
                  @mouseleave="handleGuideTextMouseLeave"
                  @mousedown="handleShapeGuideTextMouseDown(shape.id, 'pointName', pIndex, $event)"
                  @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', pIndex, $event)"
                />
                <v-image
                  v-if="getRuntimePointLatexSprite(shape.id, pIndex) && !isShapeGuideItemBlank(shape, 'pointName', pIndex) && isShapeGuideItemVisible(shape, 'pointName', pIndex)"
                  @dblclick="handlePointLabelDblClick(shape, pIndex, $event)"
                  :config="{
                    image: getRuntimePointLatexSprite(shape.id, pIndex)!.sprite.image,
                    x: getRuntimeLatexImageX(getRuntimePointLatexSprite(shape.id, pIndex)!.overlay, getRuntimePointLatexSprite(shape.id, pIndex)!.sprite),
                    y: getRuntimeLatexImageY(getRuntimePointLatexSprite(shape.id, pIndex)!.overlay, getRuntimePointLatexSprite(shape.id, pIndex)!.sprite),
                    width: getRuntimePointLatexSprite(shape.id, pIndex)!.sprite.width,
                    height: getRuntimePointLatexSprite(shape.id, pIndex)!.sprite.height,
                    listening: true,
                    shadowColor: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? '#38BDF8' : 'transparent',
                    shadowBlur: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? 8 : 0,
                    shadowOpacity: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? 0.45 : 0
                  }"
                  @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', pIndex)"
                  @mouseleave="handleGuideTextMouseLeave"
                  @mousedown="handleShapeGuideTextMouseDown(shape.id, 'pointName', pIndex, $event)"
                  @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', pIndex, $event)"
                />
              </template>
            </template>
          </template>

          <!-- 원 -->
          <template v-else>
            <v-circle
              @click="handleShapeNodeClick(shape.id, $event)"
              @mousedown="handleShapeNodeMouseDown(shape.id, $event)"
              @mouseenter="handleShapeNodeMouseEnter(shape.id)"
              @mouseleave="handleShapeNodeMouseLeave(shape.id)"
              @contextmenu="handleShapeContextMenu(shape.id, $event)"
              :config="{
                name: `shape-hit-${shape.id}`,
                x: shape.points[0].x,
                y: shape.points[0].y,
                radius: calculateDistancePixels(shape.points[0], shape.points[1]),
                fill: getColors(shape).fill,
                stroke: isShapeHovered(shape.id) ? '#38BDF8' : getColors(shape).stroke,
                strokeWidth: isShapeHovered(shape.id)
                  ? Math.max(getShapeStrokeWidthPx(shape) + 1.8, 2.6)
                  : getShapeStrokeWidthPx(shape),
                shadowColor: getShapeShadowConfig(shape.id).color,
                shadowBlur: getShapeShadowConfig(shape.id).blur,
                shadowOpacity: getShapeShadowConfig(shape.id).opacity
              }"
            />
            <!-- 원 점 표시 -->
            <template v-for="(point, pIndex) in shape.points" :key="`${shape.id}-circle-point-${pIndex}`">
              <v-circle
                v-if="isShapePointVisible(shape, pIndex)"
                :config="{
                  x: point.x,
                  y: point.y,
                  radius: 3,
                  fill: getColors(shape).point,
                  listening: false
                }"
              />
              <v-circle
                :config="{
                  x: point.x,
                  y: point.y,
                  radius: 9,
                  fill: 'rgba(0,0,0,0)',
                  stroke: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? '#38BDF8' : 'transparent',
                  strokeWidth: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? 1.8 : 0,
                  shadowColor: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'pointName', pIndex) ? 0.45 : 0,
                  hitStrokeWidth: 16
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', pIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', pIndex, $event)"
              />
            </template>
            <v-circle
              v-if="false && toolStore.mode === 'select' && canvasStore.selectedShapeId === shape.id"
              v-for="(point, pIndex) in shape.points"
              :key="`${shape.id}-circle-vertex-handle-${pIndex}`"
              @mousedown="handleVertexHandleMouseDown(shape.id, pIndex, $event)"
              @click="handleVertexHandleClick(shape.id, $event)"
              @mouseenter="handleVertexMouseEnter(shape.id, pIndex)"
              @mouseleave="handleVertexMouseLeave"
              :config="{
                x: point.x,
                y: point.y,
                radius: isVertexHovered(shape.id, pIndex) ? 7 : 6,
                fill: isVertexHovered(shape.id, pIndex) ? '#DBEAFE' : '#ffffff',
                stroke: isVertexHovered(shape.id, pIndex) ? '#1D4ED8' : '#2563EB',
                strokeWidth: isVertexHovered(shape.id, pIndex) ? 2.5 : 2,
                shadowColor: isVertexHovered(shape.id, pIndex) ? '#60A5FA' : 'transparent',
                shadowBlur: isVertexHovered(shape.id, pIndex) ? 10 : 0,
                shadowOpacity: isVertexHovered(shape.id, pIndex) ? 0.45 : 0,
                hitStrokeWidth: 14
              }"
            />
            <!-- Blank point-name box -->
            <v-rect
              v-if="toolStore.showPointName && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 0) && isShapeGuideItemBlank(shape, 'pointName', 0)"
              @dblclick="handlePointLabelDblClick(shape, 0, $event)"
              :config="{
                x: getShapeGuideBlankRect(shape, 'pointName', 0).x,
                y: getShapeGuideBlankRect(shape, 'pointName', 0).y,
                width: getShapeGuideBlankRect(shape, 'pointName', 0).width,
                height: getShapeGuideBlankRect(shape, 'pointName', 0).height,
                cornerRadius: getShapeGuideBlankRect(shape, 'pointName', 0).cornerRadius,
                fill: '#FFFFFF',
                listening: true,
                ...getBlankGuideHighlightConfig(isGuideTextHighlighted(shape.id, 'pointName', 0))
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', 0)"
              @mouseleave="handleGuideTextMouseLeave"
              @mousedown="handleShapeGuideTextMouseDown(shape.id, 'pointName', 0, $event)"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', 0, $event)"
            />
            <v-image
              v-if="getRuntimePointLatexSprite(shape.id, 0) && toolStore.showPointName && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 0) && !isShapeGuideItemBlank(shape, 'pointName', 0)"
              @dblclick="handlePointLabelDblClick(shape, 0, $event)"
              :config="{
                image: getRuntimePointLatexSprite(shape.id, 0)!.sprite.image,
                x: getRuntimeLatexImageX(getRuntimePointLatexSprite(shape.id, 0)!.overlay, getRuntimePointLatexSprite(shape.id, 0)!.sprite),
                y: getRuntimeLatexImageY(getRuntimePointLatexSprite(shape.id, 0)!.overlay, getRuntimePointLatexSprite(shape.id, 0)!.sprite),
                width: getRuntimePointLatexSprite(shape.id, 0)!.sprite.width,
                height: getRuntimePointLatexSprite(shape.id, 0)!.sprite.height,
                listening: true,
                shadowColor: isGuideTextHighlighted(shape.id, 'pointName', 0) ? '#38BDF8' : 'transparent',
                shadowBlur: isGuideTextHighlighted(shape.id, 'pointName', 0) ? 8 : 0,
                shadowOpacity: isGuideTextHighlighted(shape.id, 'pointName', 0) ? 0.45 : 0
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', 0)"
              @mouseleave="handleGuideTextMouseLeave"
              @mousedown="handleShapeGuideTextMouseDown(shape.id, 'pointName', 0, $event)"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', 0, $event)"
            />
            <v-rect
              v-if="toolStore.showPointName && shape.points[1] && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 1) && isShapeGuideItemBlank(shape, 'pointName', 1)"
              @dblclick="handlePointLabelDblClick(shape, 1, $event)"
              :config="{
                x: getShapeGuideBlankRect(shape, 'pointName', 1).x,
                y: getShapeGuideBlankRect(shape, 'pointName', 1).y,
                width: getShapeGuideBlankRect(shape, 'pointName', 1).width,
                height: getShapeGuideBlankRect(shape, 'pointName', 1).height,
                cornerRadius: getShapeGuideBlankRect(shape, 'pointName', 1).cornerRadius,
                fill: '#FFFFFF',
                listening: true,
                ...getBlankGuideHighlightConfig(isGuideTextHighlighted(shape.id, 'pointName', 1))
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', 1)"
              @mouseleave="handleGuideTextMouseLeave"
              @mousedown="handleShapeGuideTextMouseDown(shape.id, 'pointName', 1, $event)"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', 1, $event)"
            />
            <v-image
              v-if="getRuntimePointLatexSprite(shape.id, 1) && toolStore.showPointName && shape.points[1] && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 1) && !isShapeGuideItemBlank(shape, 'pointName', 1)"
              @dblclick="handlePointLabelDblClick(shape, 1, $event)"
              :config="{
                image: getRuntimePointLatexSprite(shape.id, 1)!.sprite.image,
                x: getRuntimeLatexImageX(getRuntimePointLatexSprite(shape.id, 1)!.overlay, getRuntimePointLatexSprite(shape.id, 1)!.sprite),
                y: getRuntimeLatexImageY(getRuntimePointLatexSprite(shape.id, 1)!.overlay, getRuntimePointLatexSprite(shape.id, 1)!.sprite),
                width: getRuntimePointLatexSprite(shape.id, 1)!.sprite.width,
                height: getRuntimePointLatexSprite(shape.id, 1)!.sprite.height,
                listening: true,
                shadowColor: isGuideTextHighlighted(shape.id, 'pointName', 1) ? '#38BDF8' : 'transparent',
                shadowBlur: isGuideTextHighlighted(shape.id, 'pointName', 1) ? 8 : 0,
                shadowOpacity: isGuideTextHighlighted(shape.id, 'pointName', 1) ? 0.45 : 0
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', 1)"
              @mouseleave="handleGuideTextMouseLeave"
              @mousedown="handleShapeGuideTextMouseDown(shape.id, 'pointName', 1, $event)"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', 1, $event)"
            />
            <v-rect
              v-if="toolStore.showPointName && shape.points[2] && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 2) && isShapeGuideItemBlank(shape, 'pointName', 2)"
              @dblclick="handlePointLabelDblClick(shape, 2, $event)"
              :config="{
                x: getShapeGuideBlankRect(shape, 'pointName', 2).x,
                y: getShapeGuideBlankRect(shape, 'pointName', 2).y,
                width: getShapeGuideBlankRect(shape, 'pointName', 2).width,
                height: getShapeGuideBlankRect(shape, 'pointName', 2).height,
                cornerRadius: getShapeGuideBlankRect(shape, 'pointName', 2).cornerRadius,
                fill: '#FFFFFF',
                listening: true,
                ...getBlankGuideHighlightConfig(isGuideTextHighlighted(shape.id, 'pointName', 2))
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', 2)"
              @mouseleave="handleGuideTextMouseLeave"
              @mousedown="handleShapeGuideTextMouseDown(shape.id, 'pointName', 2, $event)"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', 2, $event)"
            />
            <v-image
              v-if="getRuntimePointLatexSprite(shape.id, 2) && toolStore.showPointName && shape.points[2] && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 2) && !isShapeGuideItemBlank(shape, 'pointName', 2)"
              @dblclick="handlePointLabelDblClick(shape, 2, $event)"
              :config="{
                image: getRuntimePointLatexSprite(shape.id, 2)!.sprite.image,
                x: getRuntimeLatexImageX(getRuntimePointLatexSprite(shape.id, 2)!.overlay, getRuntimePointLatexSprite(shape.id, 2)!.sprite),
                y: getRuntimeLatexImageY(getRuntimePointLatexSprite(shape.id, 2)!.overlay, getRuntimePointLatexSprite(shape.id, 2)!.sprite),
                width: getRuntimePointLatexSprite(shape.id, 2)!.sprite.width,
                height: getRuntimePointLatexSprite(shape.id, 2)!.sprite.height,
                listening: true,
                shadowColor: isGuideTextHighlighted(shape.id, 'pointName', 2) ? '#38BDF8' : 'transparent',
                shadowBlur: isGuideTextHighlighted(shape.id, 'pointName', 2) ? 8 : 0,
                shadowOpacity: isGuideTextHighlighted(shape.id, 'pointName', 2) ? 0.45 : 0
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'pointName', 2)"
              @mouseleave="handleGuideTextMouseLeave"
              @mousedown="handleShapeGuideTextMouseDown(shape.id, 'pointName', 2, $event)"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'pointName', 2, $event)"
            />
            <v-line
              v-if="toolStore.showLength && isShapeGuideVisible(shape, 'radius') && isShapeGuideItemVisible(shape, 'length', 0)"
              :config="{
                points: (() => {
                  const { p1, p2 } = getCircleLengthEndpoints(shape)
                  return [p1.x, p1.y, p2.x, p2.y]
                })(),
                stroke: isGuideTextHighlighted(shape.id, 'length', 0) ? '#38BDF8' : getCircleGuideMainLineColor(shape),
                strokeWidth: isGuideTextHighlighted(shape.id, 'length', 0)
                  ? getCircleGuideMainLineWidth(shape) + 1.6
                  : getCircleGuideMainLineWidth(shape),
                hitStrokeWidth: 18,
                shadowColor: isGuideTextHighlighted(shape.id, 'length', 0) ? '#0EA5E9' : 'transparent',
                shadowBlur: isGuideTextHighlighted(shape.id, 'length', 0) ? 14 : 0,
                shadowOpacity: isGuideTextHighlighted(shape.id, 'length', 0) ? 0.85 : 0
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'length', 0)"
              @mouseleave="handleGuideTextMouseLeave"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'length', 0, $event)"
            />
            <!-- 반지름/지름 길이 보조선: 점선 곡선 -->
            <v-line
              v-for="(segmentPoints, segIdx) in getCircleLengthCurveSegments(shape)"
              v-if="toolStore.showLength && isShapeGuideVisible(shape, 'radius') && isShapeGuideItemVisible(shape, 'length', 0)"
              :key="`${shape.id}-radius-seg-${segIdx}`"
              :config="{
                points: segmentPoints,
                stroke: isGuideTextHighlighted(shape.id, 'length', 0) ? '#38BDF8' : getCircleGuideMeasureLineColor(shape),
                strokeWidth: isGuideTextHighlighted(shape.id, 'length', 0)
                  ? getCircleGuideMeasureLineWidth(shape) + 1.6
                  : getCircleGuideMeasureLineWidth(shape),
                dash: GUIDE_DASH_PATTERN,
                hitStrokeWidth: 18,
                shadowColor: isGuideTextHighlighted(shape.id, 'length', 0) ? '#0EA5E9' : 'transparent',
                shadowBlur: isGuideTextHighlighted(shape.id, 'length', 0) ? 14 : 0,
                shadowOpacity: isGuideTextHighlighted(shape.id, 'length', 0) ? 0.85 : 0
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'length', 0)"
              @mouseleave="handleGuideTextMouseLeave"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'length', 0, $event)"
            />
            <v-rect
              v-if="toolStore.showLength && isShapeGuideVisible(shape, 'radius') && isShapeGuideItemVisible(shape, 'length', 0) && isShapeGuideItemBlank(shape, 'length', 0)"
              :config="{
                x: getShapeGuideBlankRect(shape, 'length', 0).x,
                y: getShapeGuideBlankRect(shape, 'length', 0).y,
                width: getShapeGuideBlankRect(shape, 'length', 0).width,
                height: getShapeGuideBlankRect(shape, 'length', 0).height,
                cornerRadius: getShapeGuideBlankRect(shape, 'length', 0).cornerRadius,
                fill: '#FFFFFF',
                listening: true,
                ...getBlankGuideHighlightConfig(isGuideTextHighlighted(shape.id, 'length', 0))
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'length', 0)"
              @mouseleave="handleGuideTextMouseLeave"
              @mousedown="handleShapeGuideTextMouseDown(shape.id, 'length', 0, $event)"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'length', 0, $event)"
            />
            <v-image
              v-if="getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0-blank-unit`) && toolStore.showLength && isShapeGuideVisible(shape, 'radius') && isShapeGuideItemVisible(shape, 'length', 0) && isShapeGuideItemBlank(shape, 'length', 0) && toolStore.showGuideUnit"
              :config="{
                image: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0-blank-unit`)!.sprite.image,
                x: getRuntimeLatexImageX(getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0-blank-unit`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0-blank-unit`)!.sprite),
                y: getRuntimeLatexImageY(getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0-blank-unit`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0-blank-unit`)!.sprite),
                width: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0-blank-unit`)!.sprite.width,
                height: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0-blank-unit`)!.sprite.height,
                listening: false
              }"
            />
            <v-image
              v-if="getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0`) && toolStore.showLength && isShapeGuideVisible(shape, 'radius') && isShapeGuideItemVisible(shape, 'length', 0) && !isShapeGuideItemBlank(shape, 'length', 0)"
              :config="{
                image: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0`)!.sprite.image,
                x: getRuntimeLatexImageX(getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0`)!.sprite),
                y: getRuntimeLatexImageY(getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0`)!.overlay, getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0`)!.sprite),
                width: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0`)!.sprite.width,
                height: getRuntimeShapeGuideLatexSprite(`${shape.id}-length-0`)!.sprite.height,
                listening: true,
                shadowColor: isGuideTextHighlighted(shape.id, 'length', 0) ? '#38BDF8' : 'transparent',
                shadowBlur: isGuideTextHighlighted(shape.id, 'length', 0) ? 8 : 0,
                shadowOpacity: isGuideTextHighlighted(shape.id, 'length', 0) ? 0.45 : 0
              }"
              @mouseenter="handleGuideTextMouseEnter(shape.id, 'length', 0)"
              @mouseleave="handleGuideTextMouseLeave"
              @mousedown="handleShapeGuideTextMouseDown(shape.id, 'length', 0, $event)"
              @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'length', 0, $event)"
            />
          </template>
        </template>

        <!-- Shape preview while drawing -->
        <template v-if="toolStore.mode === 'shape' && toolStore.tempPoints.length > 0">
          <!-- Preview polyline -->
          <v-line
            v-if="toolStore.tempPoints.length > 1 && toolStore.shapeType !== 'arrow-curve'"
            :config="{
              points: getPolygonPoints(toolStore.tempPoints),
              stroke: '#FF9800',
              strokeWidth: 2,
              dash: [5, 5]
            }"
          />
          <!-- Circle preview -->
          <v-circle
            v-if="toolStore.shapeType === 'circle' && toolStore.tempPoints.length === 2"
            :config="{
              x: toolStore.tempPoints[0].x,
              y: toolStore.tempPoints[0].y,
              radius: calculateDistancePixels(toolStore.tempPoints[0], toolStore.tempPoints[1]),
              stroke: '#FF9800',
              strokeWidth: 2,
              dash: [5, 5]
            }"
          />
          <!-- Arrow preview -->
          <v-line
            v-if="(toolStore.shapeType === 'arrow' || toolStore.shapeType === 'arrow-curve') && mousePos && toolStore.tempPoints.length >= 1"
            :config="{
              points: getArrowPreviewShaftPoints(),
              stroke: '#FB923C',
              strokeWidth: 2,
              dash: [5, 5],
              lineCap: 'round',
              lineJoin: 'round'
            }"
          />
          <v-line
            v-if="(toolStore.shapeType === 'arrow' || toolStore.shapeType === 'arrow-curve') && mousePos && toolStore.tempPoints.length >= 1"
            :config="{
              points: getArrowPreviewHeadPoints(),
              stroke: '#FB923C',
              fill: '#FB923C',
              closed: true,
              strokeWidth: 2,
              dash: [5, 5],
              lineCap: 'round',
              lineJoin: 'round'
            }"
          />
          <v-line
            v-if="toolStore.shapeType !== 'circle' && toolStore.shapeType !== 'arrow' && toolStore.shapeType !== 'arrow-curve' && mousePos"
            :config="{
              points: getPolygonPoints(getPreviewPoints()),
              stroke: '#FB923C',
              strokeWidth: 2,
              dash: [5, 5],
              closed: !OPEN_SHAPE_TYPES.has(toolStore.shapeType)
            }"
          />
          <!-- Preview vertices -->
          <v-circle
            v-for="(point, index) in toolStore.tempPoints"
            :key="`temp-${index}`"
            :config="{
              x: point.x,
              y: point.y,
              radius: 4,
              fill: '#FF9800'
            }"
          />
          <v-circle
            v-if="toolStore.shapeType === 'polygon' && toolStore.tempPoints.length > 1"
            :config="{
              x: toolStore.tempPoints[0].x,
              y: toolStore.tempPoints[0].y,
              radius: 2,
              fill: '#FFFFFF',
              listening: false
            }"
          />
            </template>
          </template>
          <template v-else-if="item.kind === 'guide' && item.guide.visible !== false">
            <template v-for="guide in [item.guide]" :key="guide.id">
              <template v-if="guide.type === 'length' && toolStore.showLength">
                <v-line
                  @contextmenu="handleGuideContextMenu(guide.id, $event)"
                  :config="{
                    name: getGuideNodeName(guide.id),
                    points: getLengthGuideCurvePoints(guide),
                    stroke: guide.color || LENGTH_GUIDE_DEFAULT_COLOR,
                    strokeWidth: guide.lineWidth || DEFAULT_GUIDE_LINE_PX,
                    dash: [5, 5]
                  }"
                />
                <v-text
                  @contextmenu="handleGuideContextMenu(guide.id, $event)"
                  :config="{
                    name: getGuideNodeName(guide.id),
                    x: getLengthGuideLabelPos(guide).x,
                    y: getLengthGuideLabelPos(guide).y - 16,
                    text: formatMathText(formatLengthGuideText(guide.text)),
                    fontSize: guide.fontSize || DEFAULT_TEXT_FONT_SIZE,
                    fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                    fill: guide.color || LENGTH_GUIDE_DEFAULT_COLOR,
                    fontStyle: 'normal',
                    align: 'center',
                    offsetX: 20
                  }"
                />
              </template>
              <template v-if="shouldRenderCanvasTextGuide() && guide.type === 'text'">
                <v-image
                  v-if="getRuntimeTextGuideImageConfig(guide.id)"
                  @click="handleTextGuideClick(guide.id, $event)"
                  @mousedown="handleTextGuideMouseDown(guide.id, $event)"
                  @mouseenter="handleTextGuideMouseEnter(guide.id)"
                  @mouseleave="handleTextGuideMouseLeave(guide.id)"
                  @dblclick="handleTextGuideDblClick(guide.id, $event)"
                  @contextmenu="handleGuideContextMenu(guide.id, $event)"
                  :config="{
                    name: getGuideNodeName(guide.id),
                    ...getRuntimeTextGuideImageConfig(guide.id)!,
                    shadowColor: isTextGuideHighlighted(guide.id) ? '#38BDF8' : 'transparent',
                    shadowBlur: isTextGuideHighlighted(guide.id) ? 10 : 0,
                    shadowOpacity: isTextGuideHighlighted(guide.id) ? 0.7 : 0
                  }"
                />
              </template>
              <template v-if="guide.type === 'blank-box'">
                <v-rect
                  @click="handleBlankBoxGuideClick(guide.id, $event)"
                  @mousedown="handleBlankBoxGuideMouseDown(guide.id, $event)"
                  @mouseenter="handleBlankBoxGuideMouseEnter(guide.id)"
                  @mouseleave="handleBlankBoxGuideMouseLeave(guide.id)"
                  @contextmenu="handleGuideContextMenu(guide.id, $event)"
                  :config="{
                    name: getGuideNodeName(guide.id),
                    x: getBlankBoxRect(guide).x,
                    y: getBlankBoxRect(guide).y,
                    width: getBlankBoxRect(guide).width,
                    height: getBlankBoxRect(guide).height,
                    cornerRadius: getBlankBoxRect(guide).cornerRadius,
                    stroke: isBlankBoxGuideHighlighted(guide.id) ? '#38BDF8' : BLANK_BORDER_COLOR,
                    strokeWidth: isBlankBoxGuideHighlighted(guide.id) ? BLANK_BORDER_WIDTH_PX + 1 : BLANK_BORDER_WIDTH_PX,
                    fill: '#FFFFFF',
                    shadowColor: isBlankBoxGuideHighlighted(guide.id) ? '#0EA5E9' : 'transparent',
                    shadowBlur: isBlankBoxGuideHighlighted(guide.id) ? 10 : 0,
                    shadowOpacity: isBlankBoxGuideHighlighted(guide.id) ? 0.45 : 0
                  }"
                />
                <v-image
                  v-if="getRuntimeBlankBoxGuideLatexSprite(guide.id) && getBlankBoxSuffixText(guide)"
                  :config="{
                    image: getRuntimeBlankBoxGuideLatexSprite(guide.id)!.sprite.image,
                    x: getRuntimeLatexImageX(getRuntimeBlankBoxGuideLatexSprite(guide.id)!.overlay, getRuntimeBlankBoxGuideLatexSprite(guide.id)!.sprite),
                    y: getRuntimeLatexImageY(getRuntimeBlankBoxGuideLatexSprite(guide.id)!.overlay, getRuntimeBlankBoxGuideLatexSprite(guide.id)!.sprite),
                    width: getRuntimeBlankBoxGuideLatexSprite(guide.id)!.sprite.width,
                    height: getRuntimeBlankBoxGuideLatexSprite(guide.id)!.sprite.height,
                    listening: false
                  }"
                />
                <v-text
                  v-else-if="getBlankBoxSuffixText(guide)"
                  :config="{
                    x: getBlankBoxSuffixPos(guide).x,
                    y: getBlankBoxSuffixPos(guide).y,
                    text: getBlankBoxSuffixText(guide),
                    fontSize: guide.fontSize || DEFAULT_TEXT_FONT_SIZE,
                    fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                    fill: DEFAULT_TEXT_COLOR,
                    fontStyle: 'normal',
                    listening: false
                  }"
                />
              </template>
              <template v-if="guide.type === 'angle' && toolStore.showAngle">
                <template v-if="isRightAngleGuide(guide.points)">
                  <v-line
                    @contextmenu="handleGuideContextMenu(guide.id, $event)"
                    :config="{
                      name: getGuideNodeName(guide.id),
                      points: (() => {
                        const marker = getRightAngleGuideMarkerPoints(guide.points[0], guide.points[1], guide.points[2], GUIDE_RIGHT_ANGLE_MARKER_SIZE)
                        return [marker.p1.x, marker.p1.y, marker.corner.x, marker.corner.y, marker.p2.x, marker.p2.y]
                      })(),
                      stroke: guide.color || ANGLE_GUIDE_DEFAULT_COLOR,
                      strokeWidth: guide.lineWidth || DEFAULT_GUIDE_LINE_PX
                    }"
                  />
                </template>
                <template v-else>
                  <v-line
                    @contextmenu="handleGuideContextMenu(guide.id, $event)"
                    :config="{
                      name: getGuideNodeName(guide.id),
                      points: getAngleArcPoints(guide.points),
                      stroke: guide.color || ANGLE_GUIDE_DEFAULT_COLOR,
                      strokeWidth: guide.lineWidth || DEFAULT_GUIDE_LINE_PX
                    }"
                  />
                </template>
                <v-text
                  @contextmenu="handleGuideContextMenu(guide.id, $event)"
                  :config="{
                    name: getGuideNodeName(guide.id),
                    x: guide.points[1].x + 24,
                    y: guide.points[1].y - 18,
                    text: formatMathText(getTextGuideDisplayText(guide.text || '')),
                    fontSize: guide.fontSize || DEFAULT_TEXT_FONT_SIZE,
                    fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                    fill: guide.color || ANGLE_GUIDE_DEFAULT_COLOR,
                    fontStyle: 'normal'
                  }"
                />
              </template>
            </template>
          </template>
        </template>
        <template
          v-if="toolStore.mode === 'select' && selectedTextGuideId && selectedTextGuideTransformUI && !textGuideTransformDrag"
        >
          <v-circle
            :config="{
              x: selectedTextGuideTransformUI.scaleHandle.x,
              y: selectedTextGuideTransformUI.scaleHandle.y,
              radius: 8,
              fill: '#ffffff',
              stroke: '#64748B',
              strokeWidth: DEFAULT_GUIDE_LINE_PX
            }"
            @mousedown="handleTextGuideScaleHandleMouseDown(selectedTextGuideId, $event)"
          />
          <v-text
            :config="{
              x: selectedTextGuideTransformUI.scaleHandle.x - 4.5,
              y: selectedTextGuideTransformUI.scaleHandle.y - 6,
              text: '⤢',
              fontSize: 11,
              fill: '#475569',
              listening: false
            }"
          />
          <v-circle
            :config="{
              x: selectedTextGuideTransformUI.rotateHandle.x,
              y: selectedTextGuideTransformUI.rotateHandle.y,
              radius: 8,
              fill: '#ffffff',
              stroke: '#64748B',
              strokeWidth: DEFAULT_GUIDE_LINE_PX
            }"
            @mousedown="handleTextGuideRotateHandleMouseDown(selectedTextGuideId, $event)"
          />
          <v-text
            :config="{
              x: selectedTextGuideTransformUI.rotateHandle.x - 4.5,
              y: selectedTextGuideTransformUI.rotateHandle.y - 6,
              text: '⟳',
              fontSize: 11,
              fill: '#475569',
              listening: false
            }"
          />
        </template>

        <!-- Temporary guides -->
        <template v-if="toolStore.mode === 'guide' && toolStore.tempPoints.length > 0">
          <v-circle
            v-for="(point, index) in toolStore.tempPoints"
            :key="`guide-temp-${index}`"
            :config="{
              x: point.x,
              y: point.y,
              radius: 4,
              fill: '#FF9800'
            }"
          />
        </template>
      </v-layer>

      <!-- Guide layer -->
      <v-layer>
        <template v-for="guide in canvasStore.guides.filter((g) => g.shapeId)" :key="guide.id">
          <!-- Length guides -->
          <template v-if="guide.type === 'length' && guide.visible !== false && toolStore.showLength">
            <v-line
              @contextmenu="handleGuideContextMenu(guide.id, $event)"
              :config="{
                name: getGuideNodeName(guide.id),
                points: getLengthGuideCurvePoints(guide),
                stroke: guide.color || LENGTH_GUIDE_DEFAULT_COLOR,
                strokeWidth: guide.lineWidth || DEFAULT_GUIDE_LINE_PX,
                dash: [5, 5]
              }"
            />
            <v-text
              @contextmenu="handleGuideContextMenu(guide.id, $event)"
              :config="{
                name: getGuideNodeName(guide.id),
                x: getLengthGuideLabelPos(guide).x,
                y: getLengthGuideLabelPos(guide).y - 16,
                text: formatMathText(formatLengthGuideText(guide.text)),
                fontSize: guide.fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: guide.color || LENGTH_GUIDE_DEFAULT_COLOR,
                fontStyle: 'normal',
                align: 'center',
                offsetX: 20
              }"
            />
          </template>

          <!-- Text guides -->
          <template v-if="shouldRenderCanvasTextGuide() && guide.type === 'text' && guide.visible !== false">
            <v-image
              v-if="getRuntimeTextGuideImageConfig(guide.id)"
              @click="handleTextGuideClick(guide.id, $event)"
              @mousedown="handleTextGuideMouseDown(guide.id, $event)"
              @mouseenter="handleTextGuideMouseEnter(guide.id)"
              @mouseleave="handleTextGuideMouseLeave(guide.id)"
              @dblclick="handleTextGuideDblClick(guide.id, $event)"
              @contextmenu="handleGuideContextMenu(guide.id, $event)"
              :config="{
                name: getGuideNodeName(guide.id),
                ...getRuntimeTextGuideImageConfig(guide.id)!,
                shadowColor: isTextGuideHighlighted(guide.id) ? '#38BDF8' : 'transparent',
                shadowBlur: isTextGuideHighlighted(guide.id) ? 10 : 0,
                shadowOpacity: isTextGuideHighlighted(guide.id) ? 0.7 : 0
              }"
            />
            <v-text
              v-else
              @click="handleTextGuideClick(guide.id, $event)"
              @mousedown="handleTextGuideMouseDown(guide.id, $event)"
              @mouseenter="handleTextGuideMouseEnter(guide.id)"
              @mouseleave="handleTextGuideMouseLeave(guide.id)"
              @dblclick="handleTextGuideDblClick(guide.id, $event)"
              @contextmenu="handleGuideContextMenu(guide.id, $event)"
              :config="{
                name: getGuideNodeName(guide.id),
                x: getTextGuideAnchor(guide).x,
                y: getTextGuideAnchor(guide).y,
                text: formatMathText(getTextGuideDisplayText(guide.text || 'A')),
                fontSize: getTextGuideFontSize(guide),
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: guide.color || DEFAULT_TEXT_COLOR,
                fontStyle: 'normal',
                align: 'center',
                rotation: getTextGuideRotation(guide),
                offsetX: getTextWidthPx(formatMathText(getTextGuideDisplayText(guide.text || 'A')), getTextGuideFontSize(guide)) * 0.5,
                offsetY: getTextGuideFontSize(guide) * 0.45,
                shadowColor: isTextGuideHighlighted(guide.id) ? '#38BDF8' : 'transparent',
                shadowBlur: isTextGuideHighlighted(guide.id) ? 10 : 0,
                shadowOpacity: isTextGuideHighlighted(guide.id) ? 0.7 : 0
              }"
            />
          </template>

          <template v-if="guide.type === 'blank-box' && guide.visible !== false">
            <v-rect
              @click="handleBlankBoxGuideClick(guide.id, $event)"
              @mousedown="handleBlankBoxGuideMouseDown(guide.id, $event)"
              @mouseenter="handleBlankBoxGuideMouseEnter(guide.id)"
              @mouseleave="handleBlankBoxGuideMouseLeave(guide.id)"
              @contextmenu="handleGuideContextMenu(guide.id, $event)"
              :config="{
                name: getGuideNodeName(guide.id),
                x: getBlankBoxRect(guide).x,
                y: getBlankBoxRect(guide).y,
                width: getBlankBoxRect(guide).width,
                height: getBlankBoxRect(guide).height,
                cornerRadius: getBlankBoxRect(guide).cornerRadius,
                stroke: isBlankBoxGuideHighlighted(guide.id) ? '#38BDF8' : BLANK_BORDER_COLOR,
                strokeWidth: isBlankBoxGuideHighlighted(guide.id)
                  ? BLANK_BORDER_WIDTH_PX + 1
                  : BLANK_BORDER_WIDTH_PX,
                fill: '#FFFFFF',
                shadowColor: isBlankBoxGuideHighlighted(guide.id) ? '#0EA5E9' : 'transparent',
                shadowBlur: isBlankBoxGuideHighlighted(guide.id) ? 10 : 0,
                shadowOpacity: isBlankBoxGuideHighlighted(guide.id) ? 0.45 : 0
              }"
            />
            <v-image
              v-if="getRuntimeBlankBoxGuideLatexSprite(guide.id) && getBlankBoxSuffixText(guide)"
              :config="{
                image: getRuntimeBlankBoxGuideLatexSprite(guide.id)!.sprite.image,
                x: getRuntimeLatexImageX(getRuntimeBlankBoxGuideLatexSprite(guide.id)!.overlay, getRuntimeBlankBoxGuideLatexSprite(guide.id)!.sprite),
                y: getRuntimeLatexImageY(getRuntimeBlankBoxGuideLatexSprite(guide.id)!.overlay, getRuntimeBlankBoxGuideLatexSprite(guide.id)!.sprite),
                width: getRuntimeBlankBoxGuideLatexSprite(guide.id)!.sprite.width,
                height: getRuntimeBlankBoxGuideLatexSprite(guide.id)!.sprite.height,
                listening: false
              }"
            />
            <v-text
              v-else-if="getBlankBoxSuffixText(guide)"
              :config="{
                x: getBlankBoxSuffixPos(guide).x,
                y: getBlankBoxSuffixPos(guide).y,
                text: getBlankBoxSuffixText(guide),
                fontSize: guide.fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: DEFAULT_TEXT_COLOR,
                fontStyle: 'normal',
                listening: false
              }"
            />
          </template>

          <!-- Angle guides -->
          <template v-if="guide.type === 'angle' && guide.visible !== false && toolStore.showAngle">
            <template v-if="isRightAngleGuide(guide.points)">
              <v-line
                @contextmenu="handleGuideContextMenu(guide.id, $event)"
                :config="{
                  name: getGuideNodeName(guide.id),
                  points: (() => {
                    const marker = getRightAngleGuideMarkerPoints(guide.points[0], guide.points[1], guide.points[2], GUIDE_RIGHT_ANGLE_MARKER_SIZE)
                    return [marker.p1.x, marker.p1.y, marker.corner.x, marker.corner.y, marker.p2.x, marker.p2.y]
                  })(),
                  stroke: guide.color || ANGLE_GUIDE_DEFAULT_COLOR,
                  strokeWidth: guide.lineWidth || DEFAULT_GUIDE_LINE_PX
                }"
              />
            </template>
            <template v-else>
              <v-line
                @contextmenu="handleGuideContextMenu(guide.id, $event)"
                :config="{
                  name: getGuideNodeName(guide.id),
                  points: getAngleArcPoints(guide.points),
                  stroke: guide.color || ANGLE_GUIDE_DEFAULT_COLOR,
                  strokeWidth: guide.lineWidth || DEFAULT_GUIDE_LINE_PX
                }"
              />
            </template>
            <v-text
              @contextmenu="handleGuideContextMenu(guide.id, $event)"
              :config="{
                name: getGuideNodeName(guide.id),
                x: guide.points[1].x + 24,
                y: guide.points[1].y - 18,
                text: formatMathText(guide.text || ''),
                fontSize: guide.fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: guide.color || ANGLE_GUIDE_DEFAULT_COLOR,
                fontStyle: 'normal'
              }"
            />
          </template>
        </template>

        <!-- Length guide drag preview -->
        <template v-if="lengthGuidePreview">
          <v-line
            :config="{
              points: createQuadraticCurvePoints(
                lengthGuidePreview.p1,
                getLengthGuideControlPoint(lengthGuidePreview.p1, lengthGuidePreview.p2, lengthGuidePreview.bendRef),
                lengthGuidePreview.p2
              ),
              stroke: LENGTH_GUIDE_DEFAULT_COLOR,
              strokeWidth: 2,
              dash: [5, 5]
            }"
          />
        </template>
      </v-layer>

      <!-- Interaction handle layer (always above guides/shapes) -->
      <v-layer>
        <template v-if="toolStore.mode === 'select' && canvasStore.selectedShapeId && canvasStore.selectedShape">
          <v-circle
            v-for="(point, pIndex) in canvasStore.selectedShape.points"
            :key="`${canvasStore.selectedShapeId}-overlay-vertex-handle-${pIndex}`"
            @mousedown="handleVertexHandleMouseDown(canvasStore.selectedShapeId, pIndex, $event)"
            @click="handleVertexHandleClick(canvasStore.selectedShapeId, $event)"
            @mouseenter="handleVertexMouseEnter(canvasStore.selectedShapeId, pIndex)"
            @mouseleave="handleVertexMouseLeave"
            :config="{
              x: point.x,
              y: point.y,
              radius: isVertexHovered(canvasStore.selectedShapeId, pIndex) ? 7 : 6,
              fill: isVertexHovered(canvasStore.selectedShapeId, pIndex) ? '#DBEAFE' : '#ffffff',
              stroke: isVertexHovered(canvasStore.selectedShapeId, pIndex) ? '#1D4ED8' : '#2563EB',
              strokeWidth: isVertexHovered(canvasStore.selectedShapeId, pIndex) ? 2.5 : 2,
              shadowColor: isVertexHovered(canvasStore.selectedShapeId, pIndex) ? '#60A5FA' : 'transparent',
              shadowBlur: isVertexHovered(canvasStore.selectedShapeId, pIndex) ? 10 : 0,
              shadowOpacity: isVertexHovered(canvasStore.selectedShapeId, pIndex) ? 0.45 : 0,
              hitStrokeWidth: 14
            }"
          />
        </template>

        <template v-if="toolStore.mode === 'select' && canvasStore.selectedShapeId && selectedShapeTransformUI && !transformDrag">
          <v-circle
            :config="{
              x: selectedShapeTransformUI.scaleHandle.x,
              y: selectedShapeTransformUI.scaleHandle.y,
              radius: 8,
              fill: '#ffffff',
              stroke: '#64748B',
              strokeWidth: DEFAULT_GUIDE_LINE_PX,
              shadowColor: 'transparent',
              shadowBlur: 0,
              shadowOpacity: 0
            }"
            @mousedown="handleScaleHandleMouseDown(canvasStore.selectedShapeId!, $event)"
          />
          <v-text
            :config="{
              x: selectedShapeTransformUI.scaleHandle.x - 4.5,
              y: selectedShapeTransformUI.scaleHandle.y - 6,
              text: '⤢',
              fontSize: 11,
              fill: '#475569',
              listening: false
            }"
          />
          <v-circle
            :config="{
              x: selectedShapeTransformUI.rotateHandle.x,
              y: selectedShapeTransformUI.rotateHandle.y,
              radius: 8,
              fill: '#ffffff',
              stroke: '#64748B',
              strokeWidth: 2,
              shadowColor: 'transparent',
              shadowBlur: 0,
              shadowOpacity: 0
            }"
            @mousedown="handleRotateHandleMouseDown(canvasStore.selectedShapeId!, $event)"
          />
          <v-text
            :config="{
              x: selectedShapeTransformUI.rotateHandle.x - 4.5,
              y: selectedShapeTransformUI.rotateHandle.y - 6,
              text: '⟳',
              fontSize: 11,
              fill: '#475569',
              listening: false
            }"
          />
        </template>
      </v-layer>
    </v-stage>
      <CanvasLatexOverlays
        :latex-text-guide-overlays="[]"
        :latex-point-label-overlays="[]"
        :latex-shape-guide-overlays="[]"
        :zoom-scale="zoomScale"
        :viewport-offset="viewportOffset"
        :font-family="DEFAULT_TEXT_FONT_FAMILY"
        :is-text-guide-highlighted="isTextGuideHighlighted"
        :is-text-guide-dragging="isTextGuideDragging"
        :is-point-guide-dragging="isPointGuideDragging"
        :is-guide-text-highlighted="isGuideTextHighlighted"
        :is-shape-guide-dragging="isShapeGuideDragging"
        @text-guide-mouse-enter="handleTextGuideMouseEnter"
        @text-guide-mouse-leave="handleTextGuideMouseLeave"
        @text-guide-mouse-down="handleTextGuideOverlayMouseDown"
        @text-guide-mouse-up="handleLatexOverlayMouseUp"
        @text-guide-dbl-click="startTextGuideEdit"
        @text-guide-context-menu="handleTextGuideOverlayContextMenu"
        @point-guide-mouse-enter="(shapeId, pointIndex) => handleGuideTextMouseEnter(shapeId, 'pointName', pointIndex)"
        @point-guide-mouse-leave="handleGuideTextMouseLeave"
        @point-guide-mouse-down="handleLatexPointLabelMouseDown"
        @point-guide-mouse-up="handleLatexOverlayMouseUp"
        @point-guide-dbl-click="handleLatexPointOverlayDblClick"
        @point-guide-context-menu="handleLatexPointOverlayContextMenu"
        @shape-guide-mouse-enter="handleGuideTextMouseEnter"
        @shape-guide-mouse-leave="handleGuideTextMouseLeave"
        @shape-guide-mouse-down="handleLatexShapeGuideMouseDown"
        @shape-guide-mouse-up="handleLatexOverlayMouseUp"
        @shape-guide-dbl-click="handleLatexShapeGuideOverlayDblClick"
        @shape-guide-context-menu="handleLatexShapeGuideOverlayContextMenu"
      />
    <CanvasTextEditPanels
      :zoom-scale="zoomScale"
      :viewport-offset="viewportOffset"
      :text-input-state="textInputState"
      :text-input-value="textInputValue"
      :text-input-use-latex="textInputUseLatex"
      :point-label-edit-state="pointLabelEditState"
      :point-label-value="pointLabelValue"
      :point-label-use-latex="pointLabelUseLatex"
      :text-guide-edit-state="textGuideEditState"
      :text-guide-value="textGuideValue"
      :text-guide-use-latex="textGuideUseLatex"
      :shape-guide-value-edit-state="shapeGuideValueEditState"
      :shape-guide-value="shapeGuideValue"
      :shape-guide-value-label="shapeGuideValueLabel"
      :shape-guide-apply-to-geometry="shapeGuideApplyToGeometry"
      @update:text-input-value="textInputValue = $event"
      @update:text-input-use-latex="textInputUseLatex = $event"
      @update:point-label-value="pointLabelValue = $event"
      @update:point-label-use-latex="pointLabelUseLatex = $event"
      @update:text-guide-value="textGuideValue = $event"
      @update:text-guide-use-latex="textGuideUseLatex = $event"
      @update:shape-guide-value="shapeGuideValue = $event"
      @update:shape-guide-apply-to-geometry="shapeGuideApplyToGeometry = $event"
      @confirm-text-input="confirmTextInput"
      @cancel-text-input="cancelTextInput"
      @confirm-point-label-edit="confirmPointLabelEdit"
      @cancel-point-label-edit="cancelPointLabelEdit"
      @confirm-text-guide-edit="confirmTextGuideEdit"
      @cancel-text-guide-edit="cancelTextGuideEdit"
      @confirm-shape-guide-value-edit="confirmShapeGuideValueEdit"
      @cancel-shape-guide-value-edit="cancelShapeGuideValueEdit"
      @reset-shape-guide-value-edit="resetShapeGuideValueEdit"
    />
  </div>
</template>
