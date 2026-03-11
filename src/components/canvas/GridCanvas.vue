<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, watchEffect } from 'vue'
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
  computeAngleDegrees,
  distancePointToPolyline,
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
  getShapeHeightGuide as getSharedShapeHeightGuide,
  getShapeAngleLabelPos as getSharedShapeAngleLabelPos,
  getCircleLengthLabelPos as getSharedCircleLengthLabelPos,
  getShapeHeightLabelPos as getSharedShapeHeightLabelPos,
  getShapeHeightRightAngleMarkerPoints as getSharedShapeHeightRightAngleMarkerPoints,
  getShapeLengthLabelPos as getSharedShapeLengthLabelPos,
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
const DEFAULT_TEXT_FONT_FAMILY = 'KaTeX_Main, Times New Roman, serif'
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
  window.addEventListener('keydown', handleWindowKeydown)
  window.addEventListener('keyup', handleWindowKeyup)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
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
const selectedTextGuideId = ref<string | null>(null)

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
  textGuideDrag,
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
  handleTextGuideClick,
  handleTextGuideMouseDown,
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
  if (toolStore.mode === 'select' && toolStore.zoom > 100 && panDrag.value) {
    container.style.cursor = 'grabbing'
    return
  }
  if (toolStore.mode === 'select' && toolStore.zoom > 100 && isSpacePressed.value) {
    container.style.cursor = 'grab'
    return
  }
  if (toolStore.mode === 'select') {
    if (hoveredVertex.value || vertexDrag.value) {
      container.style.cursor = 'pointer'
    } else {
      container.style.cursor = hoveredShapeId.value ? 'move' : 'default'
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

function drawGridLines(context: any, shape: any) {
  const numCols = Math.ceil(stageWidth.value / GRID_CONFIG.size)
  const numRows = Math.ceil(stageHeight.value / GRID_CONFIG.size)

  // minor lines
  context.beginPath()
  for (let i = 0; i <= numCols; i++) {
    if (i % GRID_CONFIG.majorInterval === 0) continue
    const x = i * GRID_CONFIG.size
    context.moveTo(x, 0)
    context.lineTo(x, stageHeight.value)
  }
  for (let i = 0; i <= numRows; i++) {
    if (i % GRID_CONFIG.majorInterval === 0) continue
    const y = i * GRID_CONFIG.size
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
    const x = i * GRID_CONFIG.size
    context.moveTo(x, 0)
    context.lineTo(x, stageHeight.value)
  }
  for (let i = 0; i <= numRows; i++) {
    if (i % GRID_CONFIG.majorInterval !== 0) continue
    const y = i * GRID_CONFIG.size
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

  // Use sub-grid snap only for point-on-object, otherwise snap to main grid.
  const useSubGrid = toolStore.mode === 'shape' && toolStore.shapeType === 'point-on-object'
  const point = useSubGrid ? snapToSubGrid(pos.x, pos.y) : snapToGrid(pos.x, pos.y)

  if (toolStore.mode === 'select') {
    canvasStore.selectShape(null)
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

function getTextGuideRotation(guide: { rotation?: number }): number {
  return Number.isFinite(guide.rotation) ? Number(guide.rotation) : 0
}

function isTextGuideHighlighted(guideId: string): boolean {
  return hoveredTextGuideId.value === guideId || selectedTextGuideId.value === guideId
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
  if (shape.type === 'circle') return false
  return POINT_VISIBLE_DEFAULT_TYPES.has(shape.type)
}

function isShapePointVisible(shape: Shape, pointIndex: number): boolean {
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
  return !shape.guideVisibility?.pointNameHiddenIndices?.includes(index)
}

function getShapeGuideItemStyle(
  shape: Shape,
  key: 'length' | 'angle' | 'pointName' | 'height',
  index: number
): ShapeGuideItemStyle {
  return shape.guideStyleMap?.[key]?.[index] ?? {}
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

function getLengthGuideCurvePoints(guide: { points: { x: number, y: number }[] }): number[] {
  return getSharedLengthGuideCurvePoints(guide)
}

function getLengthGuideLabelPos(guide: { points: { x: number, y: number }[] }): { x: number, y: number } {
  return getSharedLengthGuideLabelPos(guide)
}

function getShapePointNameDefaultPos(shape: Shape, index: number): { x: number, y: number } {
  return getPointNameDefaultPos(shape.type, shape.points, index)
}

function getShapePointNameTextPos(shape: Shape, index: number): { x: number, y: number } {
  const base = getShapePointNameDefaultPos(shape, index)
  const offset = getShapeGuideItemOffset(shape, 'pointName', index)
  return { x: base.x + offset.x, y: base.y + offset.y }
}

function getShapeAngleValueText(shape: Shape, index: number): string {
  const triplet = getShapeAngleTriplet(shape, index)
  if (!triplet) return ''
  return formatAngleDegrees(computeAngleDegrees(triplet.prev, triplet.vertex, triplet.next))
}

function getShapeAngleLabelPos(shape: Shape, index: number): { x: number, y: number } {
  const angleText = getShapeAngleValueText(shape, index)
  const fontSize = getShapeGuideItemStyle(shape, 'angle', index).fontSize || DEFAULT_TEXT_FONT_SIZE
  return getSharedShapeAngleLabelPos(
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
  )
}

function getShapeAngleTextOffsetX(_shape: Shape, _index: number, text: string, fontSize: number): number {
  return getTextWidthPx(text, fontSize) * 0.5
}

function getShapeAngleTextOffsetY(_shape: Shape, _index: number, fontSize: number): number {
  return fontSize * 0.1
}

function logAngleGuidePlacement(shapeId: string, angleIndex: number) {
  const shape = shapeMap.value.get(shapeId)
  if (!shape) return
  const base = getShapeAngleLabelPos(shape, angleIndex)
  const offset = getShapeGuideItemOffset(shape, 'angle', angleIndex)
  const text = getShapeAngleValueText(shape, angleIndex)
  const fontSize = getShapeGuideItemStyle(shape, 'angle', angleIndex).fontSize || DEFAULT_TEXT_FONT_SIZE
  const payload = {
    shapeId,
    angleIndex,
    text,
    fontSize,
    base,
    offset,
    final: {
      x: base.x + offset.x,
      y: base.y + offset.y
    },
    renderOffset: {
      x: getShapeAngleTextOffsetX(shape, angleIndex, text, fontSize),
      y: getShapeAngleTextOffsetY(shape, angleIndex, fontSize)
    },
    constants: {
      ANGLE_ARC_RADIUS,
      ANGLE_LABEL_OUTER_GAP_PX,
      RIGHT_ANGLE_LABEL_DIST_MULTIPLIER,
      ANGLE_LABEL_EDGE_PADDING_PX
    }
  }
  console.log('[AngleGuideDebug]', JSON.stringify(payload))
}

function getShapeAngleArcPolyline(shape: Shape, index: number): number[] {
  const triplet = getShapeAngleTriplet(shape, index)
  if (!triplet) return []
  return getAngleArcPoints([triplet.prev, triplet.vertex, triplet.next])
}

function isRightAngleAt(shape: Shape, index: number): boolean {
  const triplet = getShapeAngleTriplet(shape, index)
  if (!triplet) return false
  return isRightAngleByThreePoints(triplet.prev, triplet.vertex, triplet.next)
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
  return kind === 'unit'
    ? getShapeGuideBlankUnitPos(shape, key === 'angle' ? 'length' : key, index)
    : getShapeGuideBlankSuffixPos(shape, key, index)
}

function formatLengthValue(value: number): string {
  const base = value.toFixed(1)
  return toolStore.showGuideUnit ? `${base}cm` : base
}

function stripGuideUnit(text: string): string {
  return text.replace(/cm$/i, '').replace(/°$/, '').trim()
}

function getLengthMainText(text: string): string {
  return stripGuideUnit(text)
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
  return centerY - (fontSize * 0.45)
}

function getLengthUnitGapPx(): number {
  return GRID_CONFIG.size / 2
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
  if (!withUnit) return anchorX
  const mainWidth = getTextWidthPx(mainText, fontSize)
  const unitWidth = getTextWidthPx('cm', fontSize)
  return getSharedLengthUnitXFromAnchor(anchorX, mainWidth, unitWidth, getLengthUnitGapPx(), align)
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
  const curveSide = getShapeLengthCurveSide(shape, 0)
  const fontSize = getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE
  const mainText = getLengthMainText(getCircleLengthValueText(shape))
  const mainWidth = getTextWidthPx(mainText, fontSize)
  const unitWidth = toolStore.showGuideUnit ? getTextWidthPx('cm', fontSize) : 0
  return getSharedCircleLengthLabelPos(
    shape,
    { ...p1, gridX: p1.x / GRID_CONFIG.size, gridY: p1.y / GRID_CONFIG.size },
    { ...p2, gridX: p2.x / GRID_CONFIG.size, gridY: p2.y / GRID_CONFIG.size },
    mainWidth,
    fontSize,
    unitWidth,
    toolStore.showGuideUnit ? getLengthUnitGapPx() : 0,
    shape.points[0],
    curveSide
  )
}

function getCircleLengthLabelWorldPos(shape: Shape): { x: number, y: number } {
  return getShapeGuideLabelWorldPos(shape, 'length', 0)
}

function getCircleLengthCurveSegments(shape: Shape): number[][] {
  const { p1, p2 } = getCircleLengthEndpoints(shape)
  const curveSide = getShapeLengthCurveSide(shape, 0)
  const curve = getTwoPointLengthCurvePoints(p1, p2, curveSide, CIRCLE_LENGTH_CURVE_OFFSET_PX)
  const text = getCircleLengthValueText(shape)
  const fontSize = getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE
  const isBlank = isShapeGuideItemBlank(shape, 'length', 0)
  const labelCenter = getCircleLengthLabelWorldPos(shape)
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
  return getSharedShapeHeightLabelPos(
    shape,
    h,
    mainWidth,
    fontSize,
    unitWidth,
    toolStore.showGuideUnit ? getLengthUnitGapPx() : 0,
    HEIGHT_LABEL_HORIZONTAL_OFFSET_PX
  )
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
  const curve = getTwoPointLengthCurvePoints(h.apex, h.foot, getShapeHeightCurveSide(shape), HEIGHT_LENGTH_CURVE_OFFSET_PX)
  const labelCenter = getShapeHeightLabelWorldPos(shape)
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
  return getSharedShapeLengthLabelPos(
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
  )
}

function getShapeLengthTextAnchorMode(_shape: Shape, _index: number): 'center' | 'left' | 'right' {
  return 'center'
}

function getShapeLengthTextOffsetX(shape: Shape, index: number, text: string, fontSize: number, withUnit: boolean): number {
  const mode = getShapeLengthTextAnchorMode(shape, index)
  return getLengthMainOffsetFromAnchor(text, fontSize, withUnit, mode)
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

function getAngleArcPoints(points: { x: number, y: number }[]): number[] {
  const p1 = points[0]
  const vertex = points[1]
  const p2 = points[2]
  const radius = ANGLE_ARC_RADIUS

  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x)
  const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x)
  let delta = a2 - a1
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2

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

// ── 진짜 벡터 SVG 내보내기 ───────────────────────────────────────────
const { exportImage } = useCanvasExport({
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

defineExpose({ exportImage })
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
        <!-- Existing shapes -->
        <template v-for="shape in canvasStore.shapes.filter((s) => s.visible !== false)" :key="shape.id">
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
                stroke: BLANK_BORDER_COLOR,
                strokeWidth: BLANK_BORDER_WIDTH_PX,
                fill: '#FFFFFF',
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
            <v-text
              v-if="toolStore.showPointName && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 0) && !isShapeGuideItemBlank(shape, 'pointName', 0) && !shape.pointLabelLatex?.[0]"
              @dblclick="handlePointLabelDblClick(shape, 0, $event)"
              :config="{
                x: getShapePointNameTextPos(shape, 0).x,
                y: getShapePointNameTextPos(shape, 0).y,
                text: formatMathText(getGlobalPointLabel(shape.id, 0)),
                fontSize: getShapeGuideItemStyle(shape, 'pointName', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: getShapeGuideTextColor(shape, 'pointName', 0, getShapeGuideFallbackTextColor(shape, 'pointName', 0)),
                fontStyle: 'normal',
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
                  stroke: BLANK_BORDER_COLOR,
                  strokeWidth: BLANK_BORDER_WIDTH_PX,
                  fill: '#FFFFFF',
                  listening: true,
                  shadowColor: isGuideTextHighlighted(shape.id, 'length', pIndex) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'length', pIndex) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'length', pIndex) ? 0.45 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'length', pIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'length', pIndex, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'length', pIndex, $event)"
              />
              <v-text
                v-if="isShapeGuideItemBlank(shape, 'length', pIndex) && isShapeGuideItemVisible(shape, 'length', pIndex) && toolStore.showGuideUnit"
                :config="{
                  x: getShapeGuideBlankTextPos(shape, 'length', pIndex, 'unit').x,
                  y: getShapeGuideBlankTextPos(shape, 'length', pIndex, 'unit').y,
                  text: 'cm',
                  fontSize: getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'length', pIndex, DEFAULT_TEXT_COLOR),
                  fontStyle: 'normal',
                  listening: false
                }"
              />
              <v-text
                v-if="!isShapeGuideItemBlank(shape, 'length', pIndex) && isShapeGuideItemVisible(shape, 'length', pIndex)"
                :config="{
                  x: getShapeGuideLabelWorldPos(shape, 'length', pIndex).x,
                  y: getShapeGuideLabelWorldPos(shape, 'length', pIndex).y,
                  text: isShapeGuideItemBlank(shape, 'length', pIndex) ? '' : getLengthMainText(getShapeLengthValueText(shape, pIndex)),
                  fontSize: getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'length', pIndex, DEFAULT_TEXT_COLOR),
                  fontStyle: 'normal',
                  offsetX: getShapeLengthTextOffsetX(
                    shape,
                    pIndex,
                    isShapeGuideItemBlank(shape, 'length', pIndex) ? '' : getLengthMainText(getShapeLengthValueText(shape, pIndex)),
                    getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                    toolStore.showGuideUnit
                  ),
                  offsetY: (getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE) * 0.45,
                  listening: true,
                  shadowColor: isGuideTextHighlighted(shape.id, 'length', pIndex) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'length', pIndex) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'length', pIndex) ? 0.45 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'length', pIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'length', pIndex, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'length', pIndex, $event)"
              />
              <v-text
                v-if="!isShapeGuideItemBlank(shape, 'length', pIndex) && isShapeGuideItemVisible(shape, 'length', pIndex) && toolStore.showGuideUnit"
                :config="{
                  x: getShapeLengthUnitX(
                    shape,
                    pIndex,
                    getShapeGuideLabelWorldPos(shape, 'length', pIndex).x,
                    getLengthMainText(getShapeLengthValueText(shape, pIndex)),
                    getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                    toolStore.showGuideUnit
                  ),
                  y: getUnitYFromCenteredText(
                    getShapeGuideLabelWorldPos(shape, 'length', pIndex).y,
                    getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE
                  ),
                  text: 'cm',
                  fontSize: getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'length', pIndex, DEFAULT_TEXT_COLOR),
                  fontStyle: 'normal',
                  listening: false
                }"
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
                  stroke: BLANK_BORDER_COLOR,
                  strokeWidth: BLANK_BORDER_WIDTH_PX,
                  fill: '#FFFFFF',
                  listening: true,
                  shadowColor: isGuideTextHighlighted(shape.id, 'height', 0) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'height', 0) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'height', 0) ? 0.45 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'height', 0)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'height', 0, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'height', 0, $event)"
              />
              <v-text
                v-if="getShapeHeightGuide(shape) && isShapeGuideItemBlank(shape, 'height', 0) && toolStore.showGuideUnit"
                :config="{
                  x: getShapeGuideBlankTextPos(shape, 'height', 0, 'unit').x,
                  y: getShapeGuideBlankTextPos(shape, 'height', 0, 'unit').y,
                  text: 'cm',
                  fontSize: getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'height', 0, DEFAULT_TEXT_COLOR),
                  fontStyle: 'normal',
                  listening: false
                }"
              />
              <v-text
                v-if="getShapeHeightGuide(shape) && !isShapeGuideItemBlank(shape, 'height', 0)"
                :config="{
                  x: getShapeGuideLabelWorldPos(shape, 'height', 0).x,
                  y: getShapeGuideLabelWorldPos(shape, 'height', 0).y,
                  text: getLengthMainText(getShapeHeightValueText(shape)),
                  fontSize: getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'height', 0, DEFAULT_TEXT_COLOR),
                  fontStyle: 'normal',
                  offsetX: getLengthMainOffsetFromAnchor(
                    getLengthMainText(getShapeHeightValueText(shape)),
                    getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                    toolStore.showGuideUnit,
                    'center'
                  ),
                  offsetY: (getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE) * 0.45,
                  listening: true
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'height', 0)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'height', 0, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'height', 0, $event)"
              />
              <v-text
                v-if="getShapeHeightGuide(shape) && !isShapeGuideItemBlank(shape, 'height', 0) && toolStore.showGuideUnit"
                :config="{
                  x: getLengthUnitXFromAnchor(
                    getShapeGuideLabelWorldPos(shape, 'height', 0).x,
                    getLengthMainText(getShapeHeightValueText(shape)),
                    getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                    toolStore.showGuideUnit,
                    'center'
                  ),
                  y: getUnitYFromCenteredText(
                    getShapeGuideLabelWorldPos(shape, 'height', 0).y,
                    getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE
                  ),
                  text: 'cm',
                  fontSize: getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'height', 0, DEFAULT_TEXT_COLOR),
                  fontStyle: 'normal',
                  listening: false
                }"
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
                v-if="toolStore.showAngle && isShapeGuideVisible(shape, 'angle') && isShapeGuideItemVisible(shape, 'angle', angleIndex) && isShapeGuideItemBlank(shape, 'angle', angleIndex)"
                :config="{
                  x: getShapeGuideBlankRect(shape, 'angle', angleIndex).x,
                  y: getShapeGuideBlankRect(shape, 'angle', angleIndex).y,
                  width: getShapeGuideBlankRect(shape, 'angle', angleIndex).width,
                  height: getShapeGuideBlankRect(shape, 'angle', angleIndex).height,
                  cornerRadius: getShapeGuideBlankRect(shape, 'angle', angleIndex).cornerRadius,
                  stroke: BLANK_BORDER_COLOR,
                  strokeWidth: BLANK_BORDER_WIDTH_PX,
                  fill: '#FFFFFF',
                  listening: true,
                  shadowColor: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? 0.45 : 0
                }"
                @mouseenter="handleGuideTextMouseEnter(shape.id, 'angle', angleIndex)"
                @mouseleave="handleGuideTextMouseLeave"
                @mousedown="handleShapeGuideTextMouseDown(shape.id, 'angle', angleIndex, $event)"
                @contextmenu="handleShapeGuideItemContextMenu(shape.id, 'angle', angleIndex, $event)"
              />
              <v-text
                v-if="toolStore.showAngle && isShapeGuideVisible(shape, 'angle') && isShapeGuideItemVisible(shape, 'angle', angleIndex) && isShapeGuideItemBlank(shape, 'angle', angleIndex)"
                :config="{
                  x: getShapeGuideBlankTextPos(shape, 'angle', angleIndex, 'suffix').x - 3,
                  y: getShapeGuideBlankTextPos(shape, 'angle', angleIndex, 'suffix').y - 3,
                  text: '°',
                  fontSize: getShapeGuideItemStyle(shape, 'angle', angleIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'angle', angleIndex, DEFAULT_TEXT_COLOR),
                  fontStyle: 'normal',
                  listening: false
                }"
              />
              <v-text
                v-if="toolStore.showAngle && (toolStore.angleDisplayMode === 'all' || shape.type === 'angle-line') && isShapeGuideVisible(shape, 'angle') && isShapeGuideItemVisible(shape, 'angle', angleIndex) && !isShapeGuideItemBlank(shape, 'angle', angleIndex)"
                :config="{
                  x: getShapeGuideLabelWorldPos(shape, 'angle', angleIndex).x,
                  y: getShapeGuideLabelWorldPos(shape, 'angle', angleIndex).y,
                  text: getShapeAngleValueText(shape, angleIndex),
                  fontSize: getShapeGuideItemStyle(shape, 'angle', angleIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'angle', angleIndex, DEFAULT_TEXT_COLOR),
                  fontStyle: 'normal',
                  offsetX: getShapeAngleTextOffsetX(
                    shape,
                    angleIndex,
                    getShapeAngleValueText(shape, angleIndex),
                    getShapeGuideItemStyle(shape, 'angle', angleIndex).fontSize || DEFAULT_TEXT_FONT_SIZE
                  ),
                  offsetY: getShapeAngleTextOffsetY(
                    shape,
                    angleIndex,
                    getShapeGuideItemStyle(shape, 'angle', angleIndex).fontSize || DEFAULT_TEXT_FONT_SIZE
                  ),
                  listening: true,
                  shadowColor: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? '#38BDF8' : 'transparent',
                  shadowBlur: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? 8 : 0,
                  shadowOpacity: isGuideTextHighlighted(shape.id, 'angle', angleIndex) ? 0.45 : 0
                }"
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
                    stroke: BLANK_BORDER_COLOR,
                    strokeWidth: BLANK_BORDER_WIDTH_PX,
                    fill: '#FFFFFF',
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
                <v-text
                  v-if="!isShapeGuideItemBlank(shape, 'pointName', pIndex) && !shape.pointLabelLatex?.[pIndex] && isShapeGuideItemVisible(shape, 'pointName', pIndex)"
                  @dblclick="handlePointLabelDblClick(shape, pIndex, $event)"
                  :config="{
                    x: getShapePointNameTextPos(shape, pIndex).x,
                    y: getShapePointNameTextPos(shape, pIndex).y,
                    text: formatMathText(getGlobalPointLabel(shape.id, pIndex)),
                    fontSize: getShapeGuideItemStyle(shape, 'pointName', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                    fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                    fill: getShapeGuideTextColor(shape, 'pointName', pIndex, getShapeGuideFallbackTextColor(shape, 'pointName', pIndex)),
                    fontStyle: 'normal',
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

          <!-- ??-->
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
                stroke: BLANK_BORDER_COLOR,
                strokeWidth: BLANK_BORDER_WIDTH_PX,
                fill: '#FFFFFF',
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
            <v-text
              v-if="toolStore.showPointName && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 0) && !isShapeGuideItemBlank(shape, 'pointName', 0) && !shape.pointLabelLatex?.[0]"
              @dblclick="handlePointLabelDblClick(shape, 0, $event)"
              :config="{
                x: getShapePointNameTextPos(shape, 0).x,
                y: getShapePointNameTextPos(shape, 0).y,
                text: formatMathText(getGlobalPointLabel(shape.id, 0)),
                fontSize: getShapeGuideItemStyle(shape, 'pointName', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: getShapeGuideTextColor(shape, 'pointName', 0, getShapeGuideFallbackTextColor(shape, 'pointName', 0)),
                fontStyle: 'normal',
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
                stroke: BLANK_BORDER_COLOR,
                strokeWidth: BLANK_BORDER_WIDTH_PX,
                fill: '#FFFFFF',
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
            <v-text
              v-if="toolStore.showPointName && shape.points[1] && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 1) && !isShapeGuideItemBlank(shape, 'pointName', 1) && !shape.pointLabelLatex?.[1]"
              @dblclick="handlePointLabelDblClick(shape, 1, $event)"
              :config="{
                x: getShapePointNameTextPos(shape, 1).x,
                y: getShapePointNameTextPos(shape, 1).y,
                text: formatMathText(getGlobalPointLabel(shape.id, 1)),
                fontSize: getShapeGuideItemStyle(shape, 'pointName', 1).fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: getShapeGuideTextColor(shape, 'pointName', 1, getShapeGuideFallbackTextColor(shape, 'pointName', 1)),
                fontStyle: 'normal',
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
                stroke: BLANK_BORDER_COLOR,
                strokeWidth: BLANK_BORDER_WIDTH_PX,
                fill: '#FFFFFF',
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
            <v-text
              v-if="toolStore.showPointName && shape.points[2] && isShapeGuideVisible(shape, 'pointName') && isShapeGuideItemVisible(shape, 'pointName', 2) && !isShapeGuideItemBlank(shape, 'pointName', 2) && !shape.pointLabelLatex?.[2]"
              @dblclick="handlePointLabelDblClick(shape, 2, $event)"
              :config="{
                x: getShapePointNameTextPos(shape, 2).x,
                y: getShapePointNameTextPos(shape, 2).y,
                text: formatMathText(getGlobalPointLabel(shape.id, 2)),
                fontSize: getShapeGuideItemStyle(shape, 'pointName', 2).fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: getShapeGuideTextColor(shape, 'pointName', 2, getShapeGuideFallbackTextColor(shape, 'pointName', 2)),
                fontStyle: 'normal',
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
                stroke: BLANK_BORDER_COLOR,
                strokeWidth: BLANK_BORDER_WIDTH_PX,
                fill: '#FFFFFF',
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
            <v-text
              v-if="toolStore.showLength && isShapeGuideVisible(shape, 'radius') && isShapeGuideItemVisible(shape, 'length', 0) && isShapeGuideItemBlank(shape, 'length', 0) && toolStore.showGuideUnit"
              :config="{
                x: getShapeGuideBlankTextPos(shape, 'length', 0, 'unit').x,
                y: getShapeGuideBlankTextPos(shape, 'length', 0, 'unit').y,
                text: 'cm',
                fontSize: getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: getShapeGuideTextColor(shape, 'length', 0, DEFAULT_TEXT_COLOR),
                fontStyle: 'normal',
                listening: false
              }"
            />
            <v-text
              v-if="toolStore.showLength && isShapeGuideVisible(shape, 'radius') && isShapeGuideItemVisible(shape, 'length', 0) && !isShapeGuideItemBlank(shape, 'length', 0)"
              :config="{
                x: getCircleLengthLabelWorldPos(shape).x,
                y: getCircleLengthLabelWorldPos(shape).y,
                text: isShapeGuideItemBlank(shape, 'length', 0) ? '' : getLengthMainText(getCircleLengthValueText(shape)),
                fontSize: getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: getShapeGuideTextColor(shape, 'length', 0, DEFAULT_TEXT_COLOR),
                fontStyle: 'normal',
                offsetX: getShapeLengthTextOffsetX(
                  shape,
                  0,
                  isShapeGuideItemBlank(shape, 'length', 0) ? '' : getLengthMainText(getCircleLengthValueText(shape)),
                  getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  toolStore.showGuideUnit
                ),
                offsetY: (getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE) * 0.45,
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
            <v-text
              v-if="toolStore.showLength && isShapeGuideVisible(shape, 'radius') && isShapeGuideItemVisible(shape, 'length', 0) && !isShapeGuideItemBlank(shape, 'length', 0) && toolStore.showGuideUnit"
              :config="{
                x: getShapeLengthUnitX(
                  shape,
                  0,
                  getCircleLengthLabelWorldPos(shape).x,
                  getLengthMainText(getCircleLengthValueText(shape)),
                  getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  toolStore.showGuideUnit
                ),
                y: getUnitYFromCenteredText(
                  getCircleLengthLabelWorldPos(shape).y,
                  getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE
                ),
                text: 'cm',
                fontSize: getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: getShapeGuideTextColor(shape, 'length', 0, DEFAULT_TEXT_COLOR),
                fontStyle: 'normal',
                listening: false
              }"
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
        <template v-for="guide in canvasStore.guides" :key="guide.id">
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
          <template v-if="guide.type === 'text' && guide.visible !== false && !guide.useLatex">
            <v-text
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
                text: formatMathText(guide.text || 'A'),
                fontSize: getTextGuideFontSize(guide),
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: guide.color || DEFAULT_TEXT_COLOR,
                fontStyle: 'normal',
                align: 'center',
                rotation: getTextGuideRotation(guide),
                offsetX: getTextWidthPx(formatMathText(guide.text || 'A'), getTextGuideFontSize(guide)) * 0.5,
                offsetY: getTextGuideFontSize(guide) * 0.45,
                shadowColor: isTextGuideHighlighted(guide.id) ? '#38BDF8' : 'transparent',
                shadowBlur: isTextGuideHighlighted(guide.id) ? 10 : 0,
                shadowOpacity: isTextGuideHighlighted(guide.id) ? 0.7 : 0
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
        :latex-text-guide-overlays="latexTextGuideOverlays"
        :latex-point-label-overlays="latexPointLabelOverlays"
        :zoom-scale="zoomScale"
        :viewport-offset="viewportOffset"
        :font-family="DEFAULT_TEXT_FONT_FAMILY"
        :is-text-guide-highlighted="isTextGuideHighlighted"
        :is-guide-text-highlighted="isGuideTextHighlighted"
        @text-guide-mouse-enter="handleTextGuideMouseEnter"
        @text-guide-mouse-leave="handleTextGuideMouseLeave"
        @text-guide-mouse-down="handleTextGuideOverlayMouseDown"
        @text-guide-dbl-click="startTextGuideEdit"
        @text-guide-context-menu="handleTextGuideOverlayContextMenu"
        @point-guide-mouse-enter="(shapeId, pointIndex) => handleGuideTextMouseEnter(shapeId, 'pointName', pointIndex)"
        @point-guide-mouse-leave="handleGuideTextMouseLeave"
        @point-guide-mouse-down="handleLatexPointLabelMouseDown"
        @point-guide-dbl-click="handleLatexPointOverlayDblClick"
        @point-guide-context-menu="handleLatexPointOverlayContextMenu"
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
      @update:text-input-value="textInputValue = $event"
      @update:text-input-use-latex="textInputUseLatex = $event"
      @update:point-label-value="pointLabelValue = $event"
      @update:point-label-use-latex="pointLabelUseLatex = $event"
      @update:text-guide-value="textGuideValue = $event"
      @update:text-guide-use-latex="textGuideUseLatex = $event"
      @confirm-text-input="confirmTextInput"
      @cancel-text-input="cancelTextInput"
      @confirm-point-label-edit="confirmPointLabelEdit"
      @cancel-point-label-edit="cancelPointLabelEdit"
      @confirm-text-guide-edit="confirmTextGuideEdit"
      @cancel-text-guide-edit="cancelTextGuideEdit"
    />
  </div>
</template>
