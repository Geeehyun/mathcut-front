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
  findRightAngles,
  getRightAngleMarkerPoints,
  getLengthGuideControlPoint,
  createQuadraticCurvePoints,
  distancePointToPolyline,
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
import type { Point, Shape } from '@/types'
import type { KonvaEventObject } from 'konva/lib/Node'
import jsPDF from 'jspdf'
import { formatMathText } from '@/utils/mathText'
import katex from 'katex'

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
const DIMENSION_LABEL_OFFSET_PX = 12
const HEIGHT_LABEL_HORIZONTAL_OFFSET_PX = 8
const MAX_DIMENSION_AUTO_SHIFT_PX = 18
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

// Rendered stage size: fill container while keeping minimum canvas size
const stageWidth = computed(() => Math.max(canvasWidth, containerSize.value.width))
const stageHeight = computed(() => Math.max(canvasHeight, containerSize.value.height))
const gridShapeRenderKey = computed(
  () => `${toolStore.gridMode}:${toolStore.gridLineColor}:${stageWidth.value}x${stageHeight.value}`
)
const hoveredShapeId = ref<string | null>(null)
const suppressCanvasClick = ref(false)
const suppressNativeContextMenu = ref(false)
const mousePos = ref<Point | null>(null)
const isSpacePressed = ref(false)
const panDrag = ref<{
  startClientX: number
  startClientY: number
  startOffsetX: number
  startOffsetY: number
} | null>(null)
const viewportOffset = ref({ x: 0, y: 0 })
const shapeDrag = ref<{
  id: string
  lastPoint: Point
} | null>(null)
const vertexDrag = ref<{
  shapeId: string
  pointIndex: number
} | null>(null)
const transformDrag = ref<{
  shapeId: string
  type: 'scale' | 'rotate'
  center: { x: number, y: number }
  startDistance?: number
  startAngle?: number
  originalPoints: Point[]
} | null>(null)
const guideTextDrag = ref<{
  shapeId: string
  guideKey: 'length' | 'angle' | 'pointName' | 'height'
  itemIndex: number
  startRaw: { x: number, y: number }
  startOffset: { x: number, y: number }
} | null>(null)
const selectedTextGuideId = ref<string | null>(null)
const hoveredTextGuideId = ref<string | null>(null)
const textGuideDrag = ref<{
  guideId: string
  lastPoint: Point
} | null>(null)
const textGuideTransformDrag = ref<{
  guideId: string
  type: 'scale' | 'rotate'
  center: { x: number, y: number }
  startDistance?: number
  startAngle?: number
  originalFontSize: number
  originalRotation: number
} | null>(null)
const hoveredVertex = ref(false)
const hoveredVertexKey = ref<string | null>(null)
const hoveredGuideTextKey = ref<string | null>(null)
const textInputState = ref<{
  point: Point
  rawX: number
  rawY: number
} | null>(null)
const textInputValue = ref('')
const textInputUseLatex = ref(false)
const textInputRef = ref<HTMLInputElement | null>(null)
const textInputPanelRef = ref<HTMLElement | null>(null)
const pointLabelEditState = ref<{
  shapeId: string
  pointIndex: number
  rawX: number
  rawY: number
} | null>(null)
const pointLabelValue = ref('')
const pointLabelUseLatex = ref(false)
const pointLabelInputRef = ref<HTMLInputElement | null>(null)
const pointLabelPanelRef = ref<HTMLElement | null>(null)
const textGuideEditState = ref<{
  guideId: string
  rawX: number
  rawY: number
} | null>(null)
const textGuideValue = ref('')
const textGuideUseLatex = ref(false)
const textGuideInputRef = ref<HTMLInputElement | null>(null)
const textGuidePanelRef = ref<HTMLElement | null>(null)

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

function clampViewportOffset(x: number, y: number): { x: number, y: number } {
  if (toolStore.zoom <= 100) return { x: 0, y: 0 }
  const scaledWidth = stageWidth.value * zoomScale.value
  const scaledHeight = stageHeight.value * zoomScale.value
  const minX = Math.min(0, containerSize.value.width - scaledWidth)
  const minY = Math.min(0, containerSize.value.height - scaledHeight)
  return {
    x: Math.max(minX, Math.min(0, x)),
    y: Math.max(minY, Math.min(0, y))
  }
}

watchEffect(() => {
  const clamped = clampViewportOffset(viewportOffset.value.x, viewportOffset.value.y)
  if (clamped.x !== viewportOffset.value.x || clamped.y !== viewportOffset.value.y) {
    viewportOffset.value = clamped
  }
})

function shouldStartPanGesture(evt: MouseEvent): boolean {
  return toolStore.mode === 'select' && toolStore.zoom > 100 && isSpacePressed.value && evt.button === 0
}

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
  context.globalAlpha = 0.45
  context.lineWidth = 1
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
  context.globalAlpha = 0.8
  context.lineWidth = 1.5
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
      context.moveTo(x + 2, y)
      context.arc(x, y, 2, 0, Math.PI * 2)
    }
  }
  context.fillStyle = toolStore.gridLineColor
  context.globalAlpha = 0.85
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

  const pos = stage.getPointerPosition()
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
      textInputState.value = { point, rawX: pos.x, rawY: pos.y }
      textInputValue.value = ''
      textInputUseLatex.value = false
      requestAnimationFrame(() => {
        textInputRef.value?.focus()
      })
      return
    }
    handleCanvasClick(point, pos)
  }
}

function handleMouseDown(e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e.evt)) {
    panDrag.value = {
      startClientX: e.evt.clientX,
      startClientY: e.evt.clientY,
      startOffsetX: viewportOffset.value.x,
      startOffsetY: viewportOffset.value.y
    }
    suppressCanvasClick.value = true
    return
  }
  if (e.evt.button !== 0) return
  if (toolStore.mode === 'select') return
  if (toolStore.mode !== 'guide' || toolStore.guideType !== 'length') return
  const stage = e.target.getStage()
  if (!stage) return
  const pos = stage.getPointerPosition()
  if (!pos) return
  startLengthGuideDrag(pos)
}

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

function handleMouseLeave() {
  emit('mouseMove', null)
  hoveredShapeId.value = null
  hoveredVertex.value = false
  hoveredVertexKey.value = null
  mousePos.value = null
  panDrag.value = null
  shapeDrag.value = null
  vertexDrag.value = null
  transformDrag.value = null
  guideTextDrag.value = null
  textGuideDrag.value = null
  textGuideTransformDrag.value = null
  hoveredTextGuideId.value = null
  hoveredGuideTextKey.value = null
  hoveredGuideTextKey.value = null
  if (toolStore.mode !== 'guide' || toolStore.guideType !== 'text') {
    cancelTextInput()
  }
}

function handleMouseMove(e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) {
    panDrag.value = null
    shapeDrag.value = null
    vertexDrag.value = null
    transformDrag.value = null
    guideTextDrag.value = null
    textGuideDrag.value = null
    textGuideTransformDrag.value = null
    hoveredTextGuideId.value = null
    hoveredGuideTextKey.value = null
    return
  }
  const stage = e.target.getStage()
  if (!stage) return
  const pos = stage.getPointerPosition()
  if (!pos) return

  if (toolStore.mode === 'select' && panDrag.value) {
    const nextX = panDrag.value.startOffsetX + (e.evt.clientX - panDrag.value.startClientX)
    const nextY = panDrag.value.startOffsetY + (e.evt.clientY - panDrag.value.startClientY)
    viewportOffset.value = clampViewportOffset(nextX, nextY)
    return
  }

  mousePos.value = snapToGrid(pos.x, pos.y)

  // Emit mouse position in grid coordinates for status display.
  emit('mouseMove', {
    x: Math.round(pos.x / GRID_CONFIG.size),
    y: Math.round(pos.y / GRID_CONFIG.size)
  })

  if (toolStore.mode === 'select' && guideTextDrag.value) {
    const drag = guideTextDrag.value
    const nextOffsetX = drag.startOffset.x + (pos.x - drag.startRaw.x)
    const nextOffsetY = drag.startOffset.y + (pos.y - drag.startRaw.y)
    canvasStore.patchShapeGuideItemStyle(
      drag.shapeId,
      drag.guideKey,
      drag.itemIndex,
      { offsetX: nextOffsetX, offsetY: nextOffsetY },
      false
    )
    return
  }

  if (toolStore.mode === 'select' && textGuideTransformDrag.value) {
    const drag = textGuideTransformDrag.value
    const guide = canvasStore.guides.find((g) => g.id === drag.guideId)
    if (!guide || guide.type !== 'text') {
      textGuideTransformDrag.value = null
      return
    }
    if (drag.type === 'scale') {
      const currentDistance = Math.max(1, Math.hypot(pos.x - drag.center.x, pos.y - drag.center.y))
      const ratio = Math.max(0.1, Math.min(10, currentDistance / Math.max(1, drag.startDistance || 1)))
      const nextFontSize = Math.max(8, Math.min(72, drag.originalFontSize * ratio))
      canvasStore.updateGuide(drag.guideId, (target) => ({ ...target, fontSize: nextFontSize }), false)
      return
    }
    const currentAngle = Math.atan2(pos.y - drag.center.y, pos.x - drag.center.x)
    const delta = currentAngle - (drag.startAngle || 0)
    const nextRotation = drag.originalRotation + (delta * 180 / Math.PI)
    canvasStore.updateGuide(drag.guideId, (target) => ({ ...target, rotation: nextRotation }), false)
    return
  }

  if (toolStore.mode === 'select' && textGuideDrag.value) {
    const snapped = snapToGrid(pos.x, pos.y)
    const dx = snapped.x - textGuideDrag.value.lastPoint.x
    const dy = snapped.y - textGuideDrag.value.lastPoint.y
    if (dx !== 0 || dy !== 0) {
      canvasStore.updateGuide(textGuideDrag.value.guideId, (guide) => ({
        ...guide,
        points: guide.points.map((p, index) => index === 0
          ? {
              x: p.x + dx,
              y: p.y + dy,
              gridX: (p.x + dx) / GRID_CONFIG.size,
              gridY: (p.y + dy) / GRID_CONFIG.size
            }
          : p
        )
      }), false)
      textGuideDrag.value.lastPoint = snapped
    }
    return
  }

  if (toolStore.mode === 'select' && transformDrag.value) {
    const drag = transformDrag.value
    if (drag.type === 'scale') {
      const currentDistance = Math.max(1, Math.hypot(pos.x - drag.center.x, pos.y - drag.center.y))
      const ratio = Math.max(0.1, Math.min(10, currentDistance / Math.max(1, drag.startDistance || 1)))
      const nextPoints = drag.originalPoints.map((p) => {
        const x = drag.center.x + (p.x - drag.center.x) * ratio
        const y = drag.center.y + (p.y - drag.center.y) * ratio
        return {
          x,
          y,
          gridX: x / GRID_CONFIG.size,
          gridY: y / GRID_CONFIG.size
        }
      })
      canvasStore.setShapePoints(drag.shapeId, nextPoints, false)
      return
    }
    const currentAngle = Math.atan2(pos.y - drag.center.y, pos.x - drag.center.x)
    const delta = currentAngle - (drag.startAngle || 0)
    const cos = Math.cos(delta)
    const sin = Math.sin(delta)
    const nextPoints = drag.originalPoints.map((p) => {
      const rx = p.x - drag.center.x
      const ry = p.y - drag.center.y
      const x = drag.center.x + (rx * cos - ry * sin)
      const y = drag.center.y + (rx * sin + ry * cos)
      return {
        x,
        y,
        gridX: x / GRID_CONFIG.size,
        gridY: y / GRID_CONFIG.size
      }
    })
    canvasStore.setShapePoints(drag.shapeId, nextPoints, false)
    return
  }

  if (toolStore.mode === 'select' && vertexDrag.value) {
    const shape = canvasStore.shapes.find((s) => s.id === vertexDrag.value!.shapeId)
    if (!shape) {
      vertexDrag.value = null
      return
    }
    const snapped = shape.type === 'point-on-object'
      ? snapToSubGrid(pos.x, pos.y)
      : snapToGrid(pos.x, pos.y)
    canvasStore.setShapePoint(vertexDrag.value.shapeId, vertexDrag.value.pointIndex, snapped, false)
    return
  }

  if (toolStore.mode === 'select' && shapeDrag.value) {
    const snapped = snapToGrid(pos.x, pos.y)
    const dx = snapped.x - shapeDrag.value.lastPoint.x
    const dy = snapped.y - shapeDrag.value.lastPoint.y
    if (dx !== 0 || dy !== 0) {
      // 드래그 중에는 히스토리를 쌓지 않고, 기준점을 매 이동마다 갱신한다.
      canvasStore.moveShape(shapeDrag.value.id, dx, dy, false)
      shapeDrag.value.lastPoint = snapped
    }
    return
  }

  // Length guide drag handling
  if (toolStore.mode === 'guide' && toolStore.guideType === 'length') {
    updateLengthGuideDrag(pos)
  }
}

function handleMouseUp(e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) {
    panDrag.value = null
    shapeDrag.value = null
    vertexDrag.value = null
    transformDrag.value = null
    guideTextDrag.value = null
    textGuideDrag.value = null
    textGuideTransformDrag.value = null
    hoveredGuideTextKey.value = null
    return
  }
  if (toolStore.mode === 'select' && panDrag.value) {
    panDrag.value = null
    return
  }
  if (e.evt.button !== 0) return
  if (toolStore.mode === 'select' && guideTextDrag.value) {
    const drag = guideTextDrag.value
    if (drag.guideKey === 'angle') {
      logAngleGuidePlacement(drag.shapeId, drag.itemIndex)
    }
    guideTextDrag.value = null
    return
  }
  if (toolStore.mode === 'select' && textGuideTransformDrag.value) {
    textGuideTransformDrag.value = null
    return
  }
  if (toolStore.mode === 'select' && textGuideDrag.value) {
    textGuideDrag.value = null
    return
  }
  if (toolStore.mode === 'select' && transformDrag.value) {
    transformDrag.value = null
    return
  }
  if (toolStore.mode === 'select' && vertexDrag.value) {
    vertexDrag.value = null
    return
  }
  if (toolStore.mode === 'select' && shapeDrag.value) {
    shapeDrag.value = null
    return
  }
  if (toolStore.mode !== 'guide' || toolStore.guideType !== 'length') return
  const stage = e.target.getStage()
  if (!stage) return
  const pos = stage.getPointerPosition()
  if (!pos) return
  finishLengthGuideDrag(pos)
}

function handleShapeNodeClick(id: string, e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (toolStore.mode === 'select' && toolStore.zoom > 100 && isSpacePressed.value) return
  if (toolStore.mode !== 'select') return
  selectedTextGuideId.value = null
  canvasStore.selectShape(id)
  suppressCanvasClick.value = true
  e.cancelBubble = true
}

function handleShapeNodeMouseDown(id: string, e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e.evt)) return
  if (e.evt.button !== 0) return
  if (toolStore.mode !== 'select') return
  const stage = e.target.getStage()
  if (!stage) return
  const pos = stage.getPointerPosition()
  if (!pos) return
  const snapped = snapToGrid(pos.x, pos.y)
  // 드래그 시작 시 히스토리 1회 저장
  canvasStore.saveHistory()
  selectedTextGuideId.value = null
  canvasStore.selectShape(id)
  shapeDrag.value = {
    id,
    lastPoint: snapped
  }
  suppressCanvasClick.value = true
  e.cancelBubble = true
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

function handleTextGuideMouseEnter(guideId: string) {
  if (toolStore.mode !== 'select') return
  hoveredTextGuideId.value = guideId
}

function handleTextGuideMouseLeave(guideId: string) {
  if (hoveredTextGuideId.value === guideId) {
    hoveredTextGuideId.value = null
  }
}

function handleTextGuideClick(guideId: string, e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (toolStore.mode !== 'select') return
  canvasStore.selectGuide(guideId)
  selectedTextGuideId.value = guideId
  suppressCanvasClick.value = true
  e.cancelBubble = true
}

function handleTextGuideMouseDown(guideId: string, e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e.evt)) return
  if (e.evt.button !== 0) return
  if (toolStore.mode !== 'select') return
  const stage = e.target.getStage()
  if (!stage) return
  const pos = stage.getPointerPosition()
  if (!pos) return
  const snapped = snapToGrid(pos.x, pos.y)
  canvasStore.saveHistory()
  canvasStore.selectGuide(guideId)
  selectedTextGuideId.value = guideId
  textGuideDrag.value = {
    guideId,
    lastPoint: snapped
  }
  suppressCanvasClick.value = true
  e.cancelBubble = true
}

function handleTextGuideDblClick(guideId: string, e: KonvaEventObject<MouseEvent>) {
  e.cancelBubble = true
  startTextGuideEdit(guideId)
}

function handleTextGuideOverlayMouseDown(guideId: string, e: MouseEvent) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e)) return
  if (e.button !== 0) return
  if (toolStore.mode !== 'select') return
  const stage = stageRef.value?.getNode?.()
  if (!stage) return
  stage.setPointersPositions(e as any)
  const pos = stage.getPointerPosition()
  if (!pos) return
  const snapped = snapToGrid(pos.x, pos.y)
  canvasStore.saveHistory()
  canvasStore.selectGuide(guideId)
  selectedTextGuideId.value = guideId
  textGuideDrag.value = {
    guideId,
    lastPoint: snapped
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

function handleVertexHandleMouseDown(shapeId: string, pointIndex: number, e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e.evt)) return
  if (toolStore.mode !== 'select') return
  if (e.evt.button !== 0) return
  canvasStore.saveHistory()
  selectedTextGuideId.value = null
  canvasStore.selectShape(shapeId)
  shapeDrag.value = null
  vertexDrag.value = { shapeId, pointIndex }
  suppressCanvasClick.value = true
  e.cancelBubble = true
}

function handleVertexHandleClick(shapeId: string, e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (toolStore.mode === 'select' && toolStore.zoom > 100 && isSpacePressed.value) return
  if (toolStore.mode !== 'select') return
  canvasStore.selectShape(shapeId)
  suppressCanvasClick.value = true
  e.cancelBubble = true
}

function getVertexKey(shapeId: string, pointIndex: number): string {
  return `${shapeId}:${pointIndex}`
}

function isShapeHovered(shapeId: string): boolean {
  return toolStore.mode === 'select' && hoveredShapeId.value === shapeId
}

function isShapeSelected(shapeId: string): boolean {
  return canvasStore.selectedShapeId === shapeId
}

function getShapeShadowConfig(shapeId: string): { color: string, blur: number, opacity: number } {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
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

function handleVertexMouseEnter(shapeId: string, pointIndex: number) {
  hoveredVertex.value = true
  hoveredVertexKey.value = getVertexKey(shapeId, pointIndex)
}

function handleVertexMouseLeave() {
  hoveredVertex.value = false
  hoveredVertexKey.value = null
}

function getGuideTextKey(
  shapeId: string,
  guideKey: 'length' | 'angle' | 'pointName' | 'height',
  itemIndex: number
): string {
  return `${shapeId}:${guideKey}:${itemIndex}`
}

function handleGuideTextMouseEnter(shapeId: string, guideKey: 'length' | 'angle' | 'pointName' | 'height', itemIndex: number) {
  if (toolStore.mode !== 'select') return
  hoveredGuideTextKey.value = getGuideTextKey(shapeId, guideKey, itemIndex)
}

function handleGuideTextMouseLeave() {
  hoveredGuideTextKey.value = null
}

function isGuideTextHighlighted(shapeId: string, guideKey: 'length' | 'angle' | 'pointName' | 'height', itemIndex: number): boolean {
  const key = getGuideTextKey(shapeId, guideKey, itemIndex)
  const dragging = !!guideTextDrag.value
    && guideTextDrag.value.shapeId === shapeId
    && guideTextDrag.value.guideKey === guideKey
    && guideTextDrag.value.itemIndex === itemIndex
  return dragging || hoveredGuideTextKey.value === key
}

function handleScaleHandleMouseDown(shapeId: string, e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e.evt)) return
  if (toolStore.mode !== 'select') return
  if (e.evt.button !== 0) return
  const stage = e.target.getStage()
  if (!stage) return
  const pos = stage.getPointerPosition()
  if (!pos) return
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape || shape.points.length < 2) return
  const center = getShapeCentroid(shape.points)
  const startDistance = Math.max(1, Math.hypot(pos.x - center.x, pos.y - center.y))
  canvasStore.saveHistory()
  selectedTextGuideId.value = null
  canvasStore.selectShape(shapeId)
  shapeDrag.value = null
  vertexDrag.value = null
  transformDrag.value = {
    shapeId,
    type: 'scale',
    center,
    startDistance,
    originalPoints: shape.points.map((p) => ({ ...p }))
  }
  suppressCanvasClick.value = true
  e.cancelBubble = true
}

function handleTextGuideScaleHandleMouseDown(guideId: string, e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e.evt)) return
  if (toolStore.mode !== 'select') return
  if (e.evt.button !== 0) return
  const stage = e.target.getStage()
  if (!stage) return
  const pos = stage.getPointerPosition()
  if (!pos) return
  const guide = canvasStore.guides.find((g) => g.id === guideId)
  if (!guide || guide.type !== 'text') return
  const center = getTextGuideAnchor(guide)
  const startDistance = Math.max(1, Math.hypot(pos.x - center.x, pos.y - center.y))
  canvasStore.saveHistory()
  canvasStore.selectGuide(guideId)
  selectedTextGuideId.value = guideId
  textGuideDrag.value = null
  textGuideTransformDrag.value = {
    guideId,
    type: 'scale',
    center,
    startDistance,
    originalFontSize: getTextGuideFontSize(guide),
    originalRotation: getTextGuideRotation(guide)
  }
  suppressCanvasClick.value = true
  e.cancelBubble = true
}

function handleShapeGuideTextMouseDown(
  shapeId: string,
  guideKey: 'length' | 'angle' | 'pointName' | 'height',
  itemIndex: number,
  e: KonvaEventObject<MouseEvent>
) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e.evt)) return
  if (toolStore.mode !== 'select') return
  if (e.evt.button !== 0) return
  const stage = e.target.getStage()
  if (!stage) return
  const pos = stage.getPointerPosition()
  if (!pos) return
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape) return
  const offset = getShapeGuideItemOffset(shape, guideKey, itemIndex)
  canvasStore.saveHistory()
  canvasStore.selectShape(shapeId)
  shapeDrag.value = null
  vertexDrag.value = null
  transformDrag.value = null
  guideTextDrag.value = {
    shapeId,
    guideKey,
    itemIndex,
    startRaw: { x: pos.x, y: pos.y },
    startOffset: { x: offset.x, y: offset.y }
  }
  suppressCanvasClick.value = true
  e.cancelBubble = true
}

function handleLatexPointLabelMouseDown(shapeId: string, pointIndex: number, e: MouseEvent) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e)) return
  if (toolStore.mode !== 'select') return
  if (e.button !== 0) return
  const stage = stageRef.value?.getNode?.()
  if (!stage) return
  stage.setPointersPositions(e as any)
  const pos = stage.getPointerPosition()
  if (!pos) return
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape) return
  const offset = getShapeGuideItemOffset(shape, 'pointName', pointIndex)
  canvasStore.saveHistory()
  canvasStore.selectShape(shapeId)
  shapeDrag.value = null
  vertexDrag.value = null
  transformDrag.value = null
  guideTextDrag.value = {
    shapeId,
    guideKey: 'pointName',
    itemIndex: pointIndex,
    startRaw: { x: pos.x, y: pos.y },
    startOffset: { x: offset.x, y: offset.y }
  }
}

function handleRotateHandleMouseDown(shapeId: string, e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e.evt)) return
  if (toolStore.mode !== 'select') return
  if (e.evt.button !== 0) return
  const stage = e.target.getStage()
  if (!stage) return
  const pos = stage.getPointerPosition()
  if (!pos) return
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape || shape.points.length < 2) return
  const center = getShapeCentroid(shape.points)
  const startAngle = Math.atan2(pos.y - center.y, pos.x - center.x)
  canvasStore.saveHistory()
  canvasStore.selectShape(shapeId)
  shapeDrag.value = null
  vertexDrag.value = null
  transformDrag.value = {
    shapeId,
    type: 'rotate',
    center,
    startAngle,
    originalPoints: shape.points.map((p) => ({ ...p }))
  }
  suppressCanvasClick.value = true
  e.cancelBubble = true
}

function handleTextGuideRotateHandleMouseDown(guideId: string, e: KonvaEventObject<MouseEvent>) {
  if (props.interactionLocked) return
  if (shouldStartPanGesture(e.evt)) return
  if (toolStore.mode !== 'select') return
  if (e.evt.button !== 0) return
  const stage = e.target.getStage()
  if (!stage) return
  const pos = stage.getPointerPosition()
  if (!pos) return
  const guide = canvasStore.guides.find((g) => g.id === guideId)
  if (!guide || guide.type !== 'text') return
  const center = getTextGuideAnchor(guide)
  const startAngle = Math.atan2(pos.y - center.y, pos.x - center.x)
  canvasStore.saveHistory()
  canvasStore.selectGuide(guideId)
  selectedTextGuideId.value = guideId
  textGuideDrag.value = null
  textGuideTransformDrag.value = {
    guideId,
    type: 'rotate',
    center,
    startAngle,
    originalFontSize: getTextGuideFontSize(guide),
    originalRotation: getTextGuideRotation(guide)
  }
  suppressCanvasClick.value = true
  e.cancelBubble = true
}

function handleShapeNodeMouseEnter(id: string) {
  hoveredShapeId.value = id
}

function handleShapeNodeMouseLeave(id: string) {
  if (hoveredShapeId.value === id) {
    hoveredShapeId.value = null
  }
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
  const threshold = 20
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
    const pos = stage.getPointerPosition()
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
  const circleDefaultPointColor = '#E6007E'
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
  const isFilled = !openShapeTypes.has(shape.type) && shape.color?.fill !== 'none'
  return isFilled ? DEFAULT_FILLED_STROKE_PT : DEFAULT_UNFILLED_STROKE_PT
}

function getShapeStrokeWidthPx(shape: Shape): number {
  const strokeWidthPt = typeof shape.strokeWidthPt === 'number'
    ? Math.max(0.1, Math.min(12, shape.strokeWidthPt))
    : getShapeDefaultStrokeWidthPt(shape)
  return strokeWidthPt * PT_TO_PX
}

function isShapeHeightDefaultVisible(shape: Shape): boolean {
  return shape.type === 'triangle'
    || shape.type === 'triangle-free'
    || shape.type === 'triangle-equilateral'
    || shape.type === 'triangle-isosceles'
    || shape.type === 'rect-trapezoid'
    || shape.type === 'rect-rhombus'
    || shape.type === 'rect-parallelogram'
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

function getShapeGuideItemStyle(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number) {
  return shape.guideStyleMap?.[key]?.[index] || {}
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

function getShapeGuideItemOffset(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number): { x: number, y: number } {
  const style = getShapeGuideItemStyle(shape, key, index)
  return {
    x: Number(style.offsetX || 0),
    y: Number(style.offsetY || 0)
  }
}

function getLengthGuideCurvePoints(guide: { points: { x: number, y: number }[] }): number[] {
  const p1 = guide.points[0]
  const p2 = guide.points[1]
  const bendRef = guide.points.length >= 3 ? guide.points[2] : { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 + 1 }
  const cp = getLengthGuideControlPoint(p1, p2, bendRef)
  return createQuadraticCurvePoints(p1, cp, p2)
}

function getLengthGuideLabelPos(guide: { points: { x: number, y: number }[] }): { x: number, y: number } {
  const p1 = guide.points[0]
  const p2 = guide.points[1]
  const bendRef = guide.points.length >= 3 ? guide.points[2] : { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 + 1 }
  return getLengthGuideControlPoint(p1, p2, bendRef)
}

function getShapeCentroid(points: { x: number, y: number }[]): { x: number, y: number } {
  if (points.length === 0) return { x: 0, y: 0 }
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

function getShapePointNameDefaultPos(shape: Shape, index: number): { x: number, y: number } {
  const p = shape.points[index]
  if (!p) return { x: 0, y: 0 }
  let vx = 0
  let vy = 0

  // Default point-name position: opposite side of the segment from shape center to the point.
  if (shape.type === 'circle' && index === 0 && shape.points[1]) {
    const r = shape.points[1]
    vx = p.x - r.x
    vy = p.y - r.y
  } else {
    const center = getShapeCentroid(shape.points)
    vx = p.x - center.x
    vy = p.y - center.y
  }

  if (Math.hypot(vx, vy) <= 1e-6) {
    vx = 1
    vy = -1
  }
  const len = Math.hypot(vx, vy) || 1
  const nx = vx / len
  const ny = vy / len
  const distance = 14
  const anchorX = p.x + nx * distance
  const anchorY = p.y + ny * distance

  if (Math.abs(nx) >= Math.abs(ny)) {
    return {
      x: anchorX + (nx > 0 ? 2 : -16),
      y: anchorY - 6
    }
  }
  return {
    x: anchorX - 4,
    y: anchorY + (ny > 0 ? 2 : -12)
  }
}

function getShapePointNameTextPos(shape: Shape, index: number): { x: number, y: number } {
  const base = getShapePointNameDefaultPos(shape, index)
  const offset = getShapeGuideItemOffset(shape, 'pointName', index)
  return { x: base.x + offset.x, y: base.y + offset.y }
}

function getShapeAutoAngleIndices(shape: Shape): number[] {
  if (shape.type === 'angle-line') {
    return shape.points.length >= 3 ? [1] : []
  }
  if (shape.type === 'circle' || openShapeTypes.has(shape.type) || shape.points.length < 3) return []
  if (toolStore.angleDisplayMode === 'all') {
    return shape.points.map((_, index) => index)
  }
  return findRightAngles(shape.points)
}

function getShapeAutoLengthIndices(shape: Shape): number[] {
  if (shape.type === 'circle' || shape.type === 'arrow' || shape.type === 'arrow-curve' || shape.type === 'angle-line') {
    return []
  }
  if (shape.type === 'segment' || shape.type === 'ray' || shape.type === 'line') {
    return shape.points.length >= 2 ? [0] : []
  }
  return shape.points.map((_, index) => index)
}

function getShapeAngleTriplet(shape: Shape, index: number): { prev: Point, vertex: Point, next: Point } | null {
  if (shape.points.length < 3) return null
  const n = shape.points.length
  const prev = shape.points[(index - 1 + n) % n]
  const vertex = shape.points[index]
  const next = shape.points[(index + 1) % n]
  if (!prev || !vertex || !next) return null
  return { prev, vertex, next }
}

function getShapeAngleValueText(shape: Shape, index: number): string {
  const triplet = getShapeAngleTriplet(shape, index)
  if (!triplet) return ''
  const v1x = triplet.prev.x - triplet.vertex.x
  const v1y = triplet.prev.y - triplet.vertex.y
  const v2x = triplet.next.x - triplet.vertex.x
  const v2y = triplet.next.y - triplet.vertex.y
  const m1 = Math.hypot(v1x, v1y)
  const m2 = Math.hypot(v2x, v2y)
  if (m1 <= 1e-6 || m2 <= 1e-6) return '0.0°'
  const dot = v1x * v2x + v1y * v2y
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)))
  const angleDeg = (Math.acos(cos) * 180) / Math.PI
  return `${angleDeg.toFixed(1)}°`
}

function getAngleTextHalfHeightPx(fontSize: number): number {
  return fontSize * 0.62
}

function getShapeAngleLabelPos(shape: Shape, index: number): { x: number, y: number } {
  const triplet = getShapeAngleTriplet(shape, index)
  if (!triplet) return { x: 0, y: 0 }

  const e1x = triplet.prev.x - triplet.vertex.x
  const e1y = triplet.prev.y - triplet.vertex.y
  const e2x = triplet.next.x - triplet.vertex.x
  const e2y = triplet.next.y - triplet.vertex.y
  const m1 = Math.hypot(e1x, e1y) || 1
  const m2 = Math.hypot(e2x, e2y) || 1
  const u1x = e1x / m1
  const u1y = e1y / m1
  const u2x = e2x / m2
  const u2y = e2y / m2

  let bx = u1x + u2x
  let by = u1y + u2y
  let bm = Math.hypot(bx, by)
  if (bm <= 1e-6) {
    // Straight/degenerate case: fallback to perpendicular direction.
    bx = -u1y
    by = u1x
    bm = Math.hypot(bx, by) || 1
  }
  bx /= bm
  by /= bm

  const isRightAngle = isRightAngleAt(shape, index)
  const angleText = getShapeAngleValueText(shape, index)
  const fontSize = getShapeGuideItemStyle(shape, 'angle', index).fontSize || DEFAULT_TEXT_FONT_SIZE
  const halfW = getTextWidthPx(angleText, fontSize) * 0.5
  const halfH = getAngleTextHalfHeightPx(fontSize)
  const halfExtentAlongBisector = Math.abs(bx) * halfW + Math.abs(by) * halfH

  let boundaryDist = ANGLE_ARC_RADIUS + (DEFAULT_GUIDE_LINE_PX * 0.5)
  if (isRightAngle) {
    const marker = getRightAngleMarkerPoints(shape.points, index, RIGHT_ANGLE_MARKER_SIZE)
    const tCandidates: number[] = []
    const t1 = getRaySegmentIntersectionT(triplet.vertex.x, triplet.vertex.y, bx, by, marker.p1.x, marker.p1.y, marker.corner.x, marker.corner.y)
    const t2 = getRaySegmentIntersectionT(triplet.vertex.x, triplet.vertex.y, bx, by, marker.corner.x, marker.corner.y, marker.p2.x, marker.p2.y)
    if (t1 !== null) tCandidates.push(t1)
    if (t2 !== null) tCandidates.push(t2)
    if (tCandidates.length > 0) boundaryDist = Math.max(...tCandidates)
    else boundaryDist = RIGHT_ANGLE_MARKER_SIZE * Math.SQRT2
  }

  let centerDist = boundaryDist + ANGLE_LABEL_OUTER_GAP_PX + halfExtentAlongBisector
  let nonRightAngleLiftPx = NON_RIGHT_ANGLE_BASELINE_LIFT_PX
  if (isRightAngle) {
    const markerDiag = RIGHT_ANGLE_MARKER_SIZE * Math.SQRT2
    const preferred = markerDiag * RIGHT_ANGLE_LABEL_DIST_MULTIPLIER
    const minimum = boundaryDist + 2 + (halfExtentAlongBisector * 0.85)
    centerDist = Math.max(minimum, Math.min(centerDist, preferred))
  } else {
    const dot = Math.max(-1, Math.min(1, (u1x * u2x) + (u1y * u2y)))
    const angleDeg = (Math.acos(dot) * 180) / Math.PI
    const obtuseRatio = Math.max(0, Math.min(1, (angleDeg - OBTUSE_ANGLE_START_DEG) / (180 - OBTUSE_ANGLE_START_DEG)))
    const gapReduce = OBTUSE_ANGLE_GAP_REDUCE_MAX_PX * obtuseRatio
    const liftReduce = OBTUSE_ANGLE_LIFT_REDUCE_MAX_PX * obtuseRatio
    centerDist += Math.max(0, NON_RIGHT_ANGLE_LABEL_EXTRA_GAP_PX - gapReduce)
    nonRightAngleLiftPx = Math.max(0, NON_RIGHT_ANGLE_BASELINE_LIFT_PX - liftReduce)
    // Temporary: disable acute-angle radial push for visual baseline testing.
    // const dot = Math.max(-1, Math.min(1, (u1x * u2x) + (u1y * u2y)))
    // const angleRad = Math.acos(dot)
    // const arcSpanPx = Math.max(1, boundaryDist * angleRad)
    // const labelSpanPx = halfW * 2
    // const spanDeficit = Math.max(0, labelSpanPx - arcSpanPx)
    // const acuteBoost = Math.min(fontSize * 1.8, spanDeficit * 0.7)
    // centerDist += acuteBoost
  }
  let cx = triplet.vertex.x + bx * centerDist
  let cy = triplet.vertex.y + by * centerDist

  // Visual centering compensation:
  // Right-angle labels need quadrant-aware adjustment to match the square marker.
  if (isRightAngle) {
    const sx = bx >= 0 ? 1 : -1
    const sy = by >= 0 ? 1 : -1
    cx += sx * (fontSize * RIGHT_ANGLE_LABEL_QUADRANT_X_RATIO)
    cy += fontSize * (RIGHT_ANGLE_LABEL_VERTICAL_BASE_RATIO + (RIGHT_ANGLE_LABEL_VERTICAL_QUADRANT_RATIO * sy))
  } else {
    cy += (fontSize * ANGLE_LABEL_BASELINE_COMPENSATION_RATIO) - nonRightAngleLiftPx
  }

  const getRect = () => ({
    left: cx - halfW,
    right: cx + halfW,
    top: cy - halfH,
    bottom: cy + halfH
  })

  const edges: Array<{ a: Point, b: Point }> = []
  if (shape.type === 'angle-line') {
    edges.push({ a: triplet.vertex, b: triplet.prev }, { a: triplet.vertex, b: triplet.next })
  } else if (shape.points.length >= 2) {
    const n = shape.points.length
    for (let i = 0; i < n; i++) {
      const a = shape.points[i]
      const b = shape.points[(i + 1) % n]
      if (a && b) edges.push({ a, b })
    }
  }

  for (let k = 0; k < 4; k++) {
    const rect = getRect()
    let minDist = Number.POSITIVE_INFINITY
    let hasIntersect = false
    for (const edge of edges) {
      if (segmentIntersectsRect(edge.a.x, edge.a.y, edge.b.x, edge.b.y, rect)) {
        hasIntersect = true
      }
      const d = distancePointToSegment(cx, cy, edge.a.x, edge.a.y, edge.b.x, edge.b.y)
      minDist = Math.min(minDist, d)
    }
    if (!hasIntersect && minDist >= (Math.max(halfH * 0.35, ANGLE_LABEL_EDGE_PADDING_PX))) break
    // Keep right-angle only stabilization; disable non-right push-away to avoid over-separation.
    // if (!isRightAngle) {
    //   cx += bx * ANGLE_LABEL_EDGE_PADDING_PX
    //   cy += by * ANGLE_LABEL_EDGE_PADDING_PX
    // }
  }

  return { x: cx, y: cy }
}

function getShapeAngleTextOffsetX(_shape: Shape, _index: number, text: string, fontSize: number): number {
  return getTextWidthPx(text, fontSize) * 0.5
}

function getShapeAngleTextOffsetY(_shape: Shape, _index: number, fontSize: number): number {
  return fontSize * 0.1
}

function logAngleGuidePlacement(shapeId: string, angleIndex: number) {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
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

function interpolateOnPolyline(curvePoints: number[], distance: number): { x: number, y: number, segmentIndex: number } {
  if (curvePoints.length < 4) return { x: curvePoints[0] ?? 0, y: curvePoints[1] ?? 0, segmentIndex: 0 }
  let walked = 0
  const maxSeg = Math.floor(curvePoints.length / 2) - 1
  for (let i = 0; i < maxSeg; i++) {
    const x1 = curvePoints[i * 2]
    const y1 = curvePoints[i * 2 + 1]
    const x2 = curvePoints[(i + 1) * 2]
    const y2 = curvePoints[(i + 1) * 2 + 1]
    const segLen = Math.hypot(x2 - x1, y2 - y1)
    if (walked + segLen >= distance) {
      const t = segLen <= 1e-6 ? 0 : (distance - walked) / segLen
      return {
        x: x1 + (x2 - x1) * t,
        y: y1 + (y2 - y1) * t,
        segmentIndex: i
      }
    }
    walked += segLen
  }
  return {
    x: curvePoints[curvePoints.length - 2],
    y: curvePoints[curvePoints.length - 1],
    segmentIndex: maxSeg - 1
  }
}

function getPolylineLength(curvePoints: number[]): number {
  if (curvePoints.length < 4) return 0
  let total = 0
  const maxSeg = Math.floor(curvePoints.length / 2) - 1
  for (let i = 0; i < maxSeg; i++) {
    const x1 = curvePoints[i * 2]
    const y1 = curvePoints[i * 2 + 1]
    const x2 = curvePoints[(i + 1) * 2]
    const y2 = curvePoints[(i + 1) * 2 + 1]
    total += Math.hypot(x2 - x1, y2 - y1)
  }
  return total
}

function isPointInRect(px: number, py: number, rect: { left: number, right: number, top: number, bottom: number }): boolean {
  return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom
}

function ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

function segmentsIntersect(
  a1x: number, a1y: number, a2x: number, a2y: number,
  b1x: number, b1y: number, b2x: number, b2y: number
): boolean {
  const d1 = ccw(a1x, a1y, a2x, a2y, b1x, b1y)
  const d2 = ccw(a1x, a1y, a2x, a2y, b2x, b2y)
  const d3 = ccw(b1x, b1y, b2x, b2y, a1x, a1y)
  const d4 = ccw(b1x, b1y, b2x, b2y, a2x, a2y)
  return d1 * d2 <= 0 && d3 * d4 <= 0
}

function distancePointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const lenSq = vx * vx + vy * vy
  if (lenSq <= 1e-9) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * vx + (py - ay) * vy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + vx * t
  const cy = ay + vy * t
  return Math.hypot(px - cx, py - cy)
}

function getRaySegmentIntersectionT(
  ox: number, oy: number, dx: number, dy: number,
  ax: number, ay: number, bx: number, by: number
): number | null {
  const sx = bx - ax
  const sy = by - ay
  const det = dx * (-sy) - dy * (-sx)
  if (Math.abs(det) <= 1e-9) return null
  const rx = ax - ox
  const ry = ay - oy
  const t = (rx * (-sy) - ry * (-sx)) / det
  const u = (dx * ry - dy * rx) / det
  if (t < 0) return null
  if (u < 0 || u > 1) return null
  return t
}

function segmentIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  rect: { left: number, right: number, top: number, bottom: number }
): boolean {
  if (isPointInRect(x1, y1, rect) || isPointInRect(x2, y2, rect)) return true
  return (
    segmentsIntersect(x1, y1, x2, y2, rect.left, rect.top, rect.right, rect.top) ||
    segmentsIntersect(x1, y1, x2, y2, rect.right, rect.top, rect.right, rect.bottom) ||
    segmentsIntersect(x1, y1, x2, y2, rect.right, rect.bottom, rect.left, rect.bottom) ||
    segmentsIntersect(x1, y1, x2, y2, rect.left, rect.bottom, rect.left, rect.top)
  )
}

function clipSegmentToRect(
  x1: number, y1: number, x2: number, y2: number,
  rect: { left: number, right: number, top: number, bottom: number }
): { t0: number, t1: number } | null {
  const dx = x2 - x1
  const dy = y2 - y1
  let t0 = 0
  let t1 = 1
  const p = [-dx, dx, -dy, dy]
  const q = [x1 - rect.left, rect.right - x1, y1 - rect.top, rect.bottom - y1]
  for (let i = 0; i < 4; i++) {
    const pi = p[i]
    const qi = q[i]
    if (Math.abs(pi) <= 1e-9) {
      if (qi < 0) return null
      continue
    }
    const r = qi / pi
    if (pi < 0) {
      if (r > t1) return null
      if (r > t0) t0 = r
    } else {
      if (r < t0) return null
      if (r < t1) t1 = r
    }
  }
  if (t0 > t1) return null
  return { t0, t1 }
}

function splitPolylineByDistance(curvePoints: number[], startDist: number, endDist: number): number[][] {
  const start = interpolateOnPolyline(curvePoints, startDist)
  const end = interpolateOnPolyline(curvePoints, endDist)
  const left: number[] = []
  for (let i = 0; i <= start.segmentIndex; i++) {
    left.push(curvePoints[i * 2], curvePoints[i * 2 + 1])
  }
  left.push(start.x, start.y)
  const right: number[] = [end.x, end.y]
  const maxPointIndex = Math.floor(curvePoints.length / 2) - 1
  for (let i = end.segmentIndex + 1; i <= maxPointIndex; i++) {
    right.push(curvePoints[i * 2], curvePoints[i * 2 + 1])
  }
  return [left, right].filter((seg) => seg.length >= 4)
}

function pointInPolygon(point: { x: number, y: number }, polygon: { x: number, y: number }[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function getShapeAabbLTRB(shape: Shape): { left: number, right: number, top: number, bottom: number } {
  if (shape.type === 'circle' && shape.points[0] && shape.points[1]) {
    const center = shape.points[0]
    const radius = calculateDistancePixels(shape.points[0], shape.points[1])
    return {
      left: center.x - radius,
      right: center.x + radius,
      top: center.y - radius,
      bottom: center.y + radius
    }
  }
  if (shape.points.length === 0) return { left: 0, right: 0, top: 0, bottom: 0 }
  const xs = shape.points.map((p) => p.x)
  const ys = shape.points.map((p) => p.y)
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys)
  }
}

function rectOverlapArea(a: { left: number, right: number, top: number, bottom: number }, b: { left: number, right: number, top: number, bottom: number }): number {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return w * h
}

function doesRectOverlapShape(rect: { left: number, right: number, top: number, bottom: number }, shape: Shape, edgeIndex?: number): boolean {
  const center = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 }
  if (shape.type === 'circle' && shape.points[0] && shape.points[1]) {
    const c = shape.points[0]
    const r = calculateDistancePixels(shape.points[0], shape.points[1])
    const nearestX = Math.max(rect.left, Math.min(c.x, rect.right))
    const nearestY = Math.max(rect.top, Math.min(c.y, rect.bottom))
    const dist = Math.hypot(nearestX - c.x, nearestY - c.y)
    return dist <= r || Math.hypot(center.x - c.x, center.y - c.y) <= r
  }

  if (shape.points.length >= 3 && !openShapeTypes.has(shape.type)) {
    if (pointInPolygon(center, shape.points)) return true
    for (let i = 0; i < shape.points.length; i++) {
      const a = shape.points[i]
      const b = shape.points[(i + 1) % shape.points.length]
      if (segmentIntersectsRect(a.x, a.y, b.x, b.y, rect)) return true
    }
    for (const p of shape.points) {
      if (isPointInRect(p.x, p.y, rect)) return true
    }
    return false
  }

  if (edgeIndex !== undefined && shape.points.length >= 2) {
    const a = shape.points[edgeIndex]
    const b = shape.points[(edgeIndex + 1) % shape.points.length]
    if (a && b) return segmentIntersectsRect(a.x, a.y, b.x, b.y, rect)
  }
  return false
}

function getDimensionAnchorForText(
  shape: Shape,
  edgeIndex: number | undefined,
  p1: { x: number, y: number },
  p2: { x: number, y: number },
  _curvePoints: number[],
  mainText: string,
  fontSize: number,
  withUnit: boolean,
  avoidPoint?: { x: number, y: number },
  preferredSide?: 1 | -1,
  avoidLine?: { a: { x: number, y: number }, b: { x: number, y: number } }
): { x: number, y: number } {
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  let nx = -dy / len
  let ny = dx / len
  if (preferredSide === 1 || preferredSide === -1) {
    nx *= preferredSide
    ny *= preferredSide
  } else if (avoidPoint) {
    const dot = (mid.x - avoidPoint.x) * nx + (mid.y - avoidPoint.y) * ny
    const side = dot >= 0 ? 1 : -1
    nx *= side
    ny *= side
  }

  const scoreAt = (anchor: { x: number, y: number }) => {
    const rect = getLengthGuideTextRect(anchor.x, anchor.y, mainText, fontSize, withUnit, 'center')
    const bounds = getShapeAabbLTRB(shape)
    let score = rectOverlapArea(rect, bounds)
    if (doesRectOverlapShape(rect, shape, edgeIndex)) score += 100000
    if (avoidLine && segmentIntersectsRect(avoidLine.a.x, avoidLine.a.y, avoidLine.b.x, avoidLine.b.y, rect)) score += 100000
    return { score, rect }
  }

  const plus = { x: mid.x + nx * DIMENSION_LABEL_OFFSET_PX, y: mid.y + ny * DIMENSION_LABEL_OFFSET_PX }
  const minus = { x: mid.x - nx * DIMENSION_LABEL_OFFSET_PX, y: mid.y - ny * DIMENSION_LABEL_OFFSET_PX }
  let current = scoreAt(plus).score <= scoreAt(minus).score ? plus : minus
  let dir = { x: current === plus ? nx : -nx, y: current === plus ? ny : -ny }
  let moved = 0

  for (let i = 0; i < 8; i++) {
    const { score, rect } = scoreAt(current)
    if (score <= 0) return current
    const bounds = getShapeAabbLTRB(shape)
    const overlapW = Math.max(0, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left))
    const overlapH = Math.max(0, Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top))
    const rawShift = Math.max(5, overlapW, overlapH) + 5
    const remain = MAX_DIMENSION_AUTO_SHIFT_PX - moved
    if (remain <= 0) return current
    const shift = Math.min(rawShift, remain)
    moved += shift
    current = { x: current.x + dir.x * shift, y: current.y + dir.y * shift }
  }
  return current
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
  const style = getShapeGuideItemStyle(shape, key, index)
  const raw = Number(style.blankWidthMm ?? style.blankSizeMm)
  if (!Number.isFinite(raw)) return BLANK_BASE_WIDTH_MM
  const stepped = Math.round(raw / BLANK_WIDTH_STEP_MM) * BLANK_WIDTH_STEP_MM
  return Math.max(BLANK_WIDTH_MIN_MM, Math.min(BLANK_WIDTH_MAX_MM, stepped))
}

function getBlankSizePx(widthMm: number): { width: number, height: number, cornerRadius: number } {
  const widthPx = widthMm * MM_TO_PX
  const heightPx = BLANK_BASE_HEIGHT_MM * MM_TO_PX
  return {
    width: widthPx,
    height: heightPx,
    cornerRadius: heightPx * 0.23
  }
}

function getShapeGuideBlankCenter(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number): { x: number, y: number } {
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

function getShapeGuideBlankRect(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number) {
  const center = getShapeGuideBlankCenter(shape, key, index)
  const size = getBlankSizePx(getGuideBlankWidthMm(shape, key, index))
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
    cornerRadius: size.cornerRadius
  }
}

function getShapeGuideBlankUnitPos(shape: Shape, key: 'length' | 'height', index: number): { x: number, y: number } {
  const rect = getShapeGuideBlankRect(shape, key, index)
  const fontSize = getShapeGuideItemStyle(shape, key, index).fontSize || DEFAULT_TEXT_FONT_SIZE
  return {
    x: rect.x + rect.width + (GRID_CONFIG.size / 2),
    y: rect.y + (rect.height / 2) - (fontSize * 0.5)
  }
}

function getShapeGuideBlankSuffixPos(shape: Shape, key: 'length' | 'angle' | 'height', index: number): { x: number, y: number } {
  const rect = getShapeGuideBlankRect(shape, key, index)
  const fontSize = getShapeGuideItemStyle(shape, key, index).fontSize || DEFAULT_TEXT_FONT_SIZE
  return {
    x: rect.x + rect.width + 4,
    y: rect.y + (rect.height / 2) - (fontSize * 0.5)
  }
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

let textMeasureCanvas: HTMLCanvasElement | null = null
function getTextWidthPx(text: string, fontSize: number): number {
  if (!text) return 0
  if (typeof document === 'undefined') return text.length * fontSize * 0.6
  if (!textMeasureCanvas) {
    textMeasureCanvas = document.createElement('canvas')
  }
  const ctx = textMeasureCanvas.getContext('2d')
  if (!ctx) return text.length * fontSize * 0.6
  ctx.font = `bold ${fontSize}px ${DEFAULT_TEXT_FONT_FAMILY}`
  return ctx.measureText(text).width
}

function getUnitYFromCenteredText(centerY: number, fontSize: number): number {
  return centerY - (fontSize * 0.45)
}

function getLengthUnitGapPx(): number {
  return GRID_CONFIG.size / 2
}

function getLengthMainLeftFromAnchor(
  anchorX: number,
  mainText: string,
  fontSize: number,
  withUnit: boolean,
  align: 'center' | 'left' | 'right'
): number {
  const mainWidth = getTextWidthPx(mainText, fontSize)
  const unitWidth = withUnit ? getTextWidthPx('cm', fontSize) : 0
  const gap = withUnit ? getLengthUnitGapPx() : 0
  if (align === 'left') return anchorX
  if (align === 'right') return anchorX - (mainWidth + gap + unitWidth)
  return anchorX - (mainWidth / 2) - ((gap + unitWidth) / 2)
}

function getLengthMainOffsetFromAnchor(
  mainText: string,
  fontSize: number,
  withUnit: boolean,
  align: 'center' | 'left' | 'right'
): number {
  const anchorX = 0
  const left = getLengthMainLeftFromAnchor(anchorX, mainText, fontSize, withUnit, align)
  return anchorX - left
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
  const left = getLengthMainLeftFromAnchor(anchorX, mainText, fontSize, withUnit, align)
  return left + mainWidth + getLengthUnitGapPx()
}

function mergeRect(
  a: { left: number, right: number, top: number, bottom: number },
  b: { left: number, right: number, top: number, bottom: number }
): { left: number, right: number, top: number, bottom: number } {
  return {
    left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right),
    top: Math.min(a.top, b.top),
    bottom: Math.max(a.bottom, b.bottom)
  }
}

function getUnitVisualRectFromTopLeft(
  x: number,
  y: number,
  fontSize: number,
  unitText: string = 'cm'
): { left: number, right: number, top: number, bottom: number } {
  const width = getTextWidthPx(unitText, fontSize)
  // 'cm'는 숫자 본문보다 시각적 높이가 낮아 윗부분 절단을 줄인다.
  const top = y + (fontSize * 0.16)
  const bottom = y + (fontSize * 0.82)
  return {
    left: x,
    right: x + width,
    top,
    bottom
  }
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
  const left = getLengthMainLeftFromAnchor(centerX, mainText, fontSize, withUnit, align)
  const rightMain = left + mainWidth
  const mainRect = {
    left,
    right: rightMain,
    top: centerY - (fontSize * 0.62),
    bottom: centerY + (fontSize * 0.62)
  }
  if (!withUnit) return mainRect
  const unitX = getLengthUnitXFromAnchor(centerX, mainText, fontSize, withUnit, align)
  const unitRect = getUnitVisualRectFromTopLeft(
    unitX,
    getUnitYFromCenteredText(centerY, fontSize),
    fontSize,
    'cm'
  )
  return mergeRect(mainRect, unitRect)
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
  const left = getLengthMainLeftFromAnchor(centerX, mainText, fontSize, withUnit, align)
  const mainRect = {
    left,
    right: left + mainWidth,
    top: centerY - (fontSize * 0.62),
    bottom: centerY + (fontSize * 0.62)
  }
  if (!withUnit) return [mainRect]
  const unitX = getLengthUnitXFromAnchor(centerX, mainText, fontSize, withUnit, align)
  const unitRect = getUnitVisualRectFromTopLeft(
    unitX,
    getUnitYFromCenteredText(centerY, fontSize),
    fontSize,
    'cm'
  )
  return [mainRect, unitRect]
}

function getLengthBlankGuideRectWithUnit(
  blankRect: { x: number, y: number, width: number, height: number },
  unitPos: { x: number, y: number },
  fontSize: number
): { left: number, right: number, top: number, bottom: number } {
  const baseRect = {
    left: blankRect.x,
    right: blankRect.x + blankRect.width,
    top: blankRect.y,
    bottom: blankRect.y + blankRect.height
  }
  const unitRect = getUnitVisualRectFromTopLeft(unitPos.x, unitPos.y, fontSize, 'cm')
  return mergeRect(baseRect, unitRect)
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
  const curve = getTwoPointLengthCurvePoints(p1, p2, curveSide, CIRCLE_LENGTH_CURVE_OFFSET_PX)
  const fontSize = getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE
  const mainText = getLengthMainText(getCircleLengthValueText(shape))
  return getDimensionAnchorForText(shape, 0, p1, p2, curve, mainText, fontSize, toolStore.showGuideUnit, shape.points[0], curveSide)
}

function getCircleLengthLabelWorldPos(shape: Shape): { x: number, y: number } {
  const base = getCircleLengthLabelPos(shape)
  const offset = getShapeGuideItemOffset(shape, 'length', 0)
  return { x: base.x + offset.x, y: base.y + offset.y }
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
  const mainText = getLengthMainText(getShapeHeightValueText(shape))
  const mid = { x: (h.apex.x + h.foot.x) / 2, y: (h.apex.y + h.foot.y) / 2 }
  const left = { x: mid.x - HEIGHT_LABEL_HORIZONTAL_OFFSET_PX, y: mid.y }
  const right = { x: mid.x + HEIGHT_LABEL_HORIZONTAL_OFFSET_PX, y: mid.y }
  const scoreAt = (anchor: { x: number, y: number }) => {
    const rect = getLengthGuideTextRect(anchor.x, anchor.y, mainText, fontSize, toolStore.showGuideUnit, 'center')
    let score = 0
    for (let i = 0; i < shape.points.length; i++) {
      const a = shape.points[i]
      const b = shape.points[(i + 1) % shape.points.length]
      if (segmentIntersectsRect(a.x, a.y, b.x, b.y, rect)) score += 1000
    }
    if (segmentIntersectsRect(h.apex.x, h.apex.y, h.foot.x, h.foot.y, rect)) score += 2000
    return score
  }
  let chosen = scoreAt(left) <= scoreAt(right) ? left : right

  // Ensure label rect does not cross the height guide line by enforcing
  // a minimum separation along the line's normal direction.
  const lx = h.foot.x - h.apex.x
  const ly = h.foot.y - h.apex.y
  const llen = Math.hypot(lx, ly) || 1
  const nx = -ly / llen
  const ny = lx / llen

  const rect = getLengthGuideTextRect(chosen.x, chosen.y, mainText, fontSize, toolStore.showGuideUnit, 'center')
  const halfW = (rect.right - rect.left) * 0.5
  const halfH = (rect.bottom - rect.top) * 0.5
  const halfExtentOnNormal = (Math.abs(nx) * halfW) + (Math.abs(ny) * halfH)
  const minNormalDist = halfExtentOnNormal + 2

  const curNormalDist = ((chosen.x - mid.x) * nx) + ((chosen.y - mid.y) * ny)
  const normalSign = curNormalDist >= 0 ? 1 : -1
  const absDist = Math.abs(curNormalDist)
  if (absDist < minNormalDist) {
    const push = minNormalDist - absDist
    chosen = {
      x: chosen.x + (nx * normalSign * push),
      y: chosen.y + (ny * normalSign * push)
    }
  }

  return chosen
}

function getShapeHeightLabelWorldPos(shape: Shape): { x: number, y: number } {
  const base = getShapeHeightLabelPos(shape)
  const offset = getShapeGuideItemOffset(shape, 'height', 0)
  return { x: base.x + offset.x, y: base.y + offset.y }
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
  const base = getShapeLengthLabelPos(shape, index)
  const offset = getShapeGuideItemOffset(shape, 'length', index)
  return { x: base.x + offset.x, y: base.y + offset.y }
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
  const p1 = shape.points[index]
  const p2 = shape.points[(index + 1) % shape.points.length]
  if (!p1 || !p2) return { x: 0, y: 0 }
  const curveSide = getShapeLengthCurveSide(shape, index)
  const curve = getShapeLengthCurvePoints(shape, index)
  const fontSize = getShapeGuideItemStyle(shape, 'length', index).fontSize || DEFAULT_TEXT_FONT_SIZE
  const mainText = getLengthMainText(getShapeLengthValueText(shape, index))
  const anchor = getDimensionAnchorForText(shape, index, p1, p2, curve, mainText, fontSize, toolStore.showGuideUnit, getShapeCentroid(shape.points), curveSide)
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const isHorizontalBase = Math.abs(dy) <= Math.max(1, Math.abs(dx) * 0.18)
  if (!isHorizontalBase) return anchor
  const h = getShapeHeightGuide(shape)
  if (!h) return anchor
  const rect = getLengthGuideTextRect(anchor.x, anchor.y, mainText, fontSize, toolStore.showGuideUnit, 'center')
  const footNear = isPointInRect(h.foot.x, h.foot.y, rect)
  if (!footNear) return anchor
  return { x: anchor.x, y: anchor.y + BASE_LABEL_VERTICAL_BIAS_PX }
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
  const n = shape.points.length
  if (n < 2) return 0
  const custom = Number(shape.heightBaseEdgeIndex)
  if (Number.isInteger(custom) && custom >= 0 && custom < n) return custom
  return getShapeBottomBaseEdgeIndex(shape)
}

function getShapeHeightGuide(shape: Shape): { apex: Point, foot: Point, baseA: Point, baseB: Point, t: number } | null {
  if (shape.type === 'circle' || shape.type === 'triangle-right' || openShapeTypes.has(shape.type) || shape.points.length < 3) return null
  const baseIndex = getShapeHeightBaseEdgeIndex(shape)
  const baseA = shape.points[baseIndex]
  const baseB = shape.points[(baseIndex + 1) % shape.points.length]
  if (!baseA || !baseB) return null
  const dx = baseB.x - baseA.x
  const dy = baseB.y - baseA.y
  const lenSq = dx * dx + dy * dy
  if (lenSq <= 1e-6) return null

  let bestApex: Point | null = null
  let bestFoot: Point | null = null
  let bestT = 0
  let bestDist = -1

  for (let i = 0; i < shape.points.length; i++) {
    if (i === baseIndex || i === (baseIndex + 1) % shape.points.length) continue
    const apex = shape.points[i]
    const t = ((apex.x - baseA.x) * dx + (apex.y - baseA.y) * dy) / lenSq
    const footX = baseA.x + dx * t
    const footY = baseA.y + dy * t
    const dist = Math.hypot(apex.x - footX, apex.y - footY)
    if (dist > bestDist) {
      bestDist = dist
      bestApex = apex
      bestT = t
      bestFoot = {
        x: footX,
        y: footY,
        gridX: footX / GRID_CONFIG.size,
        gridY: footY / GRID_CONFIG.size
      }
    }
  }

  if (!bestApex || !bestFoot || bestDist <= 1e-6) return null
  return { apex: bestApex, foot: bestFoot, baseA, baseB, t: bestT }
}

function getShapeHeightRightAngleMarkerPoints(shape: Shape): number[] {
  const h = getShapeHeightGuide(shape)
  if (!h) return []
  if (!isRightAngleByThreePoints(h.baseA, h.foot, h.apex)) return []
  const marker = getRightAngleGuideMarkerPoints(h.baseA, h.foot, h.apex, RIGHT_ANGLE_MARKER_SIZE)
  return [marker.p1.x, marker.p1.y, marker.corner.x, marker.corner.y, marker.p2.x, marker.p2.y]
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

function getShapeBounds(shape: Shape): { x: number, y: number, width: number, height: number } | null {
  if (shape.type === 'circle' && shape.points.length >= 2) {
    const center = shape.points[0]
    const r = calculateDistancePixels(shape.points[0], shape.points[1])
    return { x: center.x - r, y: center.y - r, width: r * 2, height: r * 2 }
  }
  if (!shape.points.length) return null
  const xs = shape.points.map((p) => p.x)
  const ys = shape.points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

const selectedShapeTransformUI = computed(() => {
  if (toolStore.mode !== 'select') return null
  const shape = canvasStore.selectedShape
  if (!shape) return null
  if (shape.type === 'point' || shape.type === 'point-on-object') return null
  if (shape.points.length < 2) return null
  const bounds = getShapeBounds(shape)
  if (!bounds) return null
  const handleDistance = 24
  const diagonalOffset = handleDistance / Math.sqrt(2)
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  }
  return {
    center,
    rotateHandle: { x: center.x, y: bounds.y - handleDistance },
    scaleHandle: {
      x: bounds.x + bounds.width + diagonalOffset,
      y: bounds.y + bounds.height + diagonalOffset
    }
  }
})

const selectedTextGuideTransformUI = computed(() => {
  if (toolStore.mode !== 'select') return null
  if (!selectedTextGuideId.value) return null
  const guide = canvasStore.guides.find((g) => g.id === selectedTextGuideId.value)
  if (!guide || guide.type !== 'text' || guide.visible === false) return null
  const center = getTextGuideAnchor(guide)
  const handleDistance = 22
  const diagonalOffset = handleDistance / Math.sqrt(2)
  return {
    center,
    rotateHandle: { x: center.x, y: center.y - handleDistance },
    scaleHandle: { x: center.x + diagonalOffset, y: center.y + diagonalOffset }
  }
})

function getPreviewPoints(): Point[] {
  if (!mousePos.value) return []
  const points = [...toolStore.tempPoints, mousePos.value]
  const { shapeType } = toolStore

  if (shapeType === 'triangle-equilateral' && points.length >= 2) {
    return [points[0], points[1], computeEquilateralTriangle(points[0], points[1])]
  }
  if (shapeType === 'triangle-right' && points.length >= 3) {
    return [points[0], points[1], computeRightTriangleThirdPoint(points[0], points[1], points[2])]
  }
  if (shapeType === 'triangle-isosceles' && points.length >= 3) {
    return [points[0], points[1], computeIsoscelesApex(points[0], points[1], points[2])]
  }
  if (shapeType === 'rect-square' && points.length >= 2) {
    const [p3, p4] = computeSquare(points[0], points[1])
    return [points[0], points[1], p3, p4]
  }
  if (shapeType === 'rect-rectangle' && points.length >= 2) {
    return computeRectangle(points[0], points[1])
  }
  if (shapeType === 'rect-rhombus' && points.length >= 2) {
    return computeRhombus(points[0], points[1])
  }
  if (shapeType === 'rect-parallelogram' && points.length >= 3) {
    return [points[0], points[1], computeParallelogram(points[0], points[1], points[2]), points[2]]
  }
  if (shapeType === 'rect-trapezoid' && points.length >= 3) {
    return computeTrapezoidFromThreePoints(points[0], points[1], points[2])
  }
  if (shapeType === 'polygon-regular' && points.length >= 2) {
    return computeRegularPolygon(points[0], points[1], toolStore.polygonSides)
  }

  return points
}

function confirmTextInput() {
  if (!textInputState.value) return
  createTextGuide(textInputState.value.point, textInputValue.value.trim() || 'A', textInputUseLatex.value)
  textInputState.value = null
  textInputValue.value = ''
  textInputUseLatex.value = false
}

function cancelTextInput() {
  textInputState.value = null
  textInputValue.value = ''
  textInputUseLatex.value = false
}

function startTextGuideEdit(guideId: string) {
  const guide = canvasStore.guides.find((g) => g.id === guideId)
  if (!guide || guide.type !== 'text') return
  const anchor = getTextGuideAnchor(guide)
  textGuideEditState.value = {
    guideId,
    rawX: anchor.x + 6,
    rawY: anchor.y + 6
  }
  textGuideValue.value = guide.text || 'A'
  textGuideUseLatex.value = !!guide.useLatex
  requestAnimationFrame(() => {
    textGuideInputRef.value?.focus()
    textGuideInputRef.value?.select()
  })
}

function confirmTextGuideEdit() {
  const state = textGuideEditState.value
  if (!state) return
  const value = textGuideValue.value.trim()
  canvasStore.updateGuide(state.guideId, (guide) => ({
    ...guide,
    text: value || 'A',
    useLatex: textGuideUseLatex.value
  }))
  textGuideEditState.value = null
  textGuideValue.value = ''
  textGuideUseLatex.value = false
}

function cancelTextGuideEdit() {
  textGuideEditState.value = null
  textGuideValue.value = ''
  textGuideUseLatex.value = false
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
  pointLabelUseLatex.value = !!shape.pointLabelLatex?.[pointIndex]
  requestAnimationFrame(() => {
    pointLabelInputRef.value?.focus()
    pointLabelInputRef.value?.select()
  })
}

function confirmPointLabelEdit() {
  const state = pointLabelEditState.value
  if (!state) return
  const value = pointLabelValue.value.trim()
  canvasStore.updateShape(state.shapeId, (shape) => {
    const nextLabels = [...(shape.pointLabels ?? [])]
    const nextLatex = [...(shape.pointLabelLatex ?? [])]
    nextLabels[state.pointIndex] = value || getGlobalPointLabel(shape.id, state.pointIndex)
    nextLatex[state.pointIndex] = pointLabelUseLatex.value
    return {
      ...shape,
      pointLabels: nextLabels,
      pointLabelLatex: nextLatex
    }
  })
  pointLabelEditState.value = null
  pointLabelValue.value = ''
  pointLabelUseLatex.value = false
}

function cancelPointLabelEdit() {
  pointLabelEditState.value = null
  pointLabelValue.value = ''
  pointLabelUseLatex.value = false
}

function handleTextInputBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (next && textInputPanelRef.value?.contains(next)) return
  confirmTextInput()
}

function handlePointLabelInputBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (next && pointLabelPanelRef.value?.contains(next)) return
  confirmPointLabelEdit()
}

function handleTextGuideInputBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  if (next && textGuidePanelRef.value?.contains(next)) return
  confirmTextGuideEdit()
}

function handlePointLabelDblClick(shape: Shape, pointIndex: number, e: KonvaEventObject<MouseEvent>) {
  e.cancelBubble = true
  startPointLabelEdit(shape, pointIndex)
}

function handleLatexPointOverlayDblClick(shapeId: string, pointIndex: number) {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape) return
  startPointLabelEdit(shape, pointIndex)
}

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

const openShapeTypes = new Set(['segment', 'ray', 'line', 'angle-line', 'arrow', 'arrow-curve'])

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
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  const custom = shape?.pointLabels?.[pointIndex]
  if (custom) return custom
  return globalPointLabelMap.value[`${shapeId}-${pointIndex}`] ?? getPointLabel(pointIndex)
}

function renderLatexHtml(input: string): string {
  return katex.renderToString(input || '', {
    throwOnError: false,
    displayMode: false
  })
}

const latexPointLabelOverlays = computed(() => {
  if (!toolStore.showPointName) return []
  const overlays: Array<{ key: string, x: number, y: number, html: string, shapeId: string, pointIndex: number, color: string, fontSize: number }> = []
  for (const shape of canvasStore.shapes) {
    if (!isShapeGuideVisible(shape, 'pointName')) continue
    for (let i = 0; i < shape.points.length; i++) {
      if (!isShapeGuideItemVisible(shape, 'pointName', i)) continue
      if (isShapeGuideItemBlank(shape, 'pointName', i)) continue
      if (!shape.pointLabelLatex?.[i]) continue
      const p = shape.points[i]
      if (!p) continue
      const textPos = getShapePointNameTextPos(shape, i)
      overlays.push({
        key: `${shape.id}-${i}`,
        x: textPos.x,
        y: textPos.y,
        html: renderLatexHtml(getGlobalPointLabel(shape.id, i)),
        shapeId: shape.id,
        pointIndex: i,
        color: getShapeGuideItemStyle(shape, 'pointName', i).color || '#222',
        fontSize: getShapeGuideItemStyle(shape, 'pointName', i).fontSize || DEFAULT_TEXT_FONT_SIZE
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
  }> = []
  for (const guide of canvasStore.guides) {
    if (guide.type !== 'text' || guide.visible === false || !guide.useLatex) continue
    const anchor = getTextGuideAnchor(guide)
    overlays.push({
      key: guide.id,
      x: anchor.x,
      y: anchor.y,
      html: renderLatexHtml(guide.text || ''),
      guideId: guide.id,
      color: guide.color || DEFAULT_TEXT_COLOR,
      fontSize: getTextGuideFontSize(guide),
      rotation: getTextGuideRotation(guide)
    })
  }
  return overlays
})

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

function exportImage(format: 'png' | 'pdf' | 'svg', width: number, height: number, dpi: number = 300): boolean {
  const stage = stageRef.value?.getNode?.()
  if (!stage) return false
  const w = Math.max(100, width || canvasWidth)
  const h = Math.max(100, height || canvasHeight)
  const pixelRatio = Math.max(1, dpi / 96)
  const pngDataUrl = stage.toDataURL({ pixelRatio })

  if (format === 'png') {
    downloadDataUrl(pngDataUrl, `mathcut-${Date.now()}.png`)
    return true
  }

  if (format === 'pdf') {
    const pxToMm = 1 / 3.7795
    const pdf = new jsPDF({
      orientation: w > h ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [w * pxToMm, h * pxToMm]
    })
    pdf.addImage(pngDataUrl, 'PNG', 0, 0, w * pxToMm, h * pxToMm)
    pdf.save(`mathcut-${Date.now()}.pdf`)
    return true
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image href="${pngDataUrl}" x="0" y="0" width="${w}" height="${h}" /></svg>`
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mathcut-${Date.now()}.svg`
  link.click()
  URL.revokeObjectURL(url)
  return true
}

defineExpose({ exportImage })
</script>

<template>
  <div
    ref="containerRef"
    class="w-full h-full bg-white overflow-hidden relative"
    @mouseleave="handleMouseLeave"
    @contextmenu.prevent="handleNativeContextMenu"
  >
    <div
      class="relative"
      :style="{
        transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${zoomScale})`,
        transformOrigin: 'top left',
        width: `${stageWidth}px`,
        height: `${stageHeight}px`
      }"
    >
    <v-stage
      ref="stageRef"
      :config="{ width: stageWidth, height: stageHeight }"
      @click="handleClick"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
    >
      <!-- Grid layer -->
      <v-layer :config="{ listening: false }">
        <v-rect :config="{ x: 0, y: 0, width: stageWidth, height: stageHeight, fill: toolStore.gridBackgroundColor }" />
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
        <template v-for="shape in canvasStore.shapes" :key="shape.id">
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
                fill: getShapeGuideTextColor(shape, 'pointName', 0, getColors(shape).label),
                fontStyle: 'bold',
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
                  closed: !openShapeTypes.has(shape.type),
                  fill: openShapeTypes.has(shape.type) ? undefined : getColors(shape).fill,
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
                  x: getShapeGuideBlankUnitPos(shape, 'length', pIndex).x,
                  y: getShapeGuideBlankUnitPos(shape, 'length', pIndex).y,
                  text: 'cm',
                  fontSize: getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'length', pIndex, DEFAULT_TEXT_COLOR),
                  fontStyle: 'bold',
                  listening: false
                }"
              />
              <v-text
                v-if="!isShapeGuideItemBlank(shape, 'length', pIndex) && isShapeGuideItemVisible(shape, 'length', pIndex)"
                :config="{
                  x: getShapeLengthLabelPos(shape, pIndex).x + getShapeGuideItemOffset(shape, 'length', pIndex).x,
                  y: getShapeLengthLabelPos(shape, pIndex).y + getShapeGuideItemOffset(shape, 'length', pIndex).y,
                  text: isShapeGuideItemBlank(shape, 'length', pIndex) ? '' : getLengthMainText(getShapeLengthValueText(shape, pIndex)),
                  fontSize: getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'length', pIndex, DEFAULT_TEXT_COLOR),
                  fontStyle: 'bold',
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
                    getShapeLengthLabelPos(shape, pIndex).x + getShapeGuideItemOffset(shape, 'length', pIndex).x,
                    getLengthMainText(getShapeLengthValueText(shape, pIndex)),
                    getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                    toolStore.showGuideUnit
                  ),
                  y: getUnitYFromCenteredText(
                    getShapeLengthLabelPos(shape, pIndex).y + getShapeGuideItemOffset(shape, 'length', pIndex).y,
                    getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE
                  ),
                  text: 'cm',
                  fontSize: getShapeGuideItemStyle(shape, 'length', pIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'length', pIndex, DEFAULT_TEXT_COLOR),
                  fontStyle: 'bold',
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
                  x: getShapeGuideBlankUnitPos(shape, 'height', 0).x,
                  y: getShapeGuideBlankUnitPos(shape, 'height', 0).y,
                  text: 'cm',
                  fontSize: getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'height', 0, DEFAULT_TEXT_COLOR),
                  fontStyle: 'bold',
                  listening: false
                }"
              />
              <v-text
                v-if="getShapeHeightGuide(shape) && !isShapeGuideItemBlank(shape, 'height', 0)"
                :config="{
                  x: getShapeHeightLabelPos(shape).x + getShapeGuideItemOffset(shape, 'height', 0).x,
                  y: getShapeHeightLabelPos(shape).y + getShapeGuideItemOffset(shape, 'height', 0).y,
                  text: getLengthMainText(getShapeHeightValueText(shape)),
                  fontSize: getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'height', 0, DEFAULT_TEXT_COLOR),
                  fontStyle: 'bold',
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
                    getShapeHeightLabelPos(shape).x + getShapeGuideItemOffset(shape, 'height', 0).x,
                    getLengthMainText(getShapeHeightValueText(shape)),
                    getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                    toolStore.showGuideUnit,
                    'center'
                  ),
                  y: getUnitYFromCenteredText(
                    getShapeHeightLabelPos(shape).y + getShapeGuideItemOffset(shape, 'height', 0).y,
                    getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE
                  ),
                  text: 'cm',
                  fontSize: getShapeGuideItemStyle(shape, 'height', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'height', 0, DEFAULT_TEXT_COLOR),
                  fontStyle: 'bold',
                  listening: false
                }"
              />
            </template>
            <template v-for="angleIndex in getShapeAutoAngleIndices(shape)" :key="`${shape.id}-angle-${angleIndex}`">
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
                  x: getShapeGuideBlankSuffixPos(shape, 'angle', angleIndex).x - 3,
                  y: getShapeGuideBlankSuffixPos(shape, 'angle', angleIndex).y - 3,
                  text: '°',
                  fontSize: getShapeGuideItemStyle(shape, 'angle', angleIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'angle', angleIndex, DEFAULT_TEXT_COLOR),
                  fontStyle: 'bold',
                  listening: false
                }"
              />
              <v-text
                v-if="toolStore.showAngle && (toolStore.angleDisplayMode === 'all' || shape.type === 'angle-line') && isShapeGuideVisible(shape, 'angle') && isShapeGuideItemVisible(shape, 'angle', angleIndex) && !isShapeGuideItemBlank(shape, 'angle', angleIndex)"
                :config="{
                  x: getShapeAngleLabelPos(shape, angleIndex).x + getShapeGuideItemOffset(shape, 'angle', angleIndex).x,
                  y: getShapeAngleLabelPos(shape, angleIndex).y + getShapeGuideItemOffset(shape, 'angle', angleIndex).y,
                  text: getShapeAngleValueText(shape, angleIndex),
                  fontSize: getShapeGuideItemStyle(shape, 'angle', angleIndex).fontSize || DEFAULT_TEXT_FONT_SIZE,
                  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                  fill: getShapeGuideTextColor(shape, 'angle', angleIndex, DEFAULT_TEXT_COLOR),
                  fontStyle: 'bold',
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
                    fill: getShapeGuideTextColor(shape, 'pointName', pIndex, '#222'),
                    fontStyle: 'bold',
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
                fill: getShapeGuideTextColor(shape, 'pointName', 0, getColors(shape).label),
                fontStyle: 'bold',
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
                fill: getShapeGuideTextColor(shape, 'pointName', 1, getColors(shape).label),
                fontStyle: 'bold',
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
                fill: getShapeGuideTextColor(shape, 'pointName', 2, getColors(shape).label),
                fontStyle: 'bold',
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
                x: getShapeGuideBlankUnitPos(shape, 'length', 0).x,
                y: getShapeGuideBlankUnitPos(shape, 'length', 0).y,
                text: 'cm',
                fontSize: getShapeGuideItemStyle(shape, 'length', 0).fontSize || DEFAULT_TEXT_FONT_SIZE,
                fontFamily: DEFAULT_TEXT_FONT_FAMILY,
                fill: getShapeGuideTextColor(shape, 'length', 0, DEFAULT_TEXT_COLOR),
                fontStyle: 'bold',
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
                fontStyle: 'bold',
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
                fontStyle: 'bold',
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
              closed: !openShapeTypes.has(toolStore.shapeType)
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
                fontStyle: 'bold',
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
                fontStyle: 'bold',
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
                fontStyle: 'bold'
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
      <div class="absolute inset-0 pointer-events-none">
        <div
          v-for="overlay in latexTextGuideOverlays"
          :key="`latex-guide-${overlay.key}`"
          class="absolute pointer-events-auto rounded-sm"
          :class="isTextGuideHighlighted(overlay.guideId) ? 'bg-sky-100/70 ring-1 ring-sky-300' : ''"
          :style="{
            left: `${overlay.x}px`,
            top: `${overlay.y}px`,
            color: overlay.color,
            fontSize: `${overlay.fontSize}px`,
            fontFamily: DEFAULT_TEXT_FONT_FAMILY,
            transform: `translate(-50%, -45%) rotate(${overlay.rotation}deg)`,
            transformOrigin: 'center center'
          }"
          v-html="overlay.html"
          @mouseenter="handleTextGuideMouseEnter(overlay.guideId)"
          @mouseleave="handleTextGuideMouseLeave(overlay.guideId)"
          @mousedown.stop.prevent="handleTextGuideOverlayMouseDown(overlay.guideId, $event)"
          @dblclick.stop="startTextGuideEdit(overlay.guideId)"
          @contextmenu.stop.prevent="handleTextGuideOverlayContextMenu(overlay.guideId, $event)"
        ></div>
        <div
          v-for="overlay in latexPointLabelOverlays"
          :key="`latex-point-${overlay.key}`"
          class="absolute pointer-events-auto rounded-sm"
          :class="isGuideTextHighlighted(overlay.shapeId, 'pointName', overlay.pointIndex) ? 'bg-sky-100/70 ring-1 ring-sky-300' : ''"
          :style="{ left: `${overlay.x}px`, top: `${overlay.y}px`, color: overlay.color, fontSize: `${overlay.fontSize}px`, fontFamily: DEFAULT_TEXT_FONT_FAMILY }"
          v-html="overlay.html"
          @mouseenter="handleGuideTextMouseEnter(overlay.shapeId, 'pointName', overlay.pointIndex)"
          @mouseleave="handleGuideTextMouseLeave"
          @mousedown.stop.prevent="handleLatexPointLabelMouseDown(overlay.shapeId, overlay.pointIndex, $event)"
          @dblclick.stop="handleLatexPointOverlayDblClick(overlay.shapeId, overlay.pointIndex)"
          @contextmenu.stop.prevent="handleLatexPointOverlayContextMenu(overlay.shapeId, overlay.pointIndex, $event)"
        ></div>
      </div>
    </div>
    <div
      v-if="textInputState"
      ref="textInputPanelRef"
      class="absolute z-20 bg-white/95 border border-orange-300 rounded-lg px-2 py-2 shadow max-w-[360px] min-w-[220px]"
      :style="{
        left: `${textInputState.rawX * zoomScale + viewportOffset.x}px`,
        top: `${textInputState.rawY * zoomScale + viewportOffset.y}px`
      }"
    >
      <input
        ref="textInputRef"
        v-model="textInputValue"
        type="text"
        class="w-full border border-orange-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
        placeholder="텍스트"
        @keydown.enter.prevent="confirmTextInput"
        @keydown.esc.prevent="cancelTextInput"
        @blur="handleTextInputBlur"
      />
      <label class="mt-2 flex items-center gap-1.5 text-xs text-gray-700">
        <input v-model="textInputUseLatex" type="checkbox" tabindex="0">
        <span>LaTeX 사용</span>
      </label>
      <div v-if="textInputUseLatex && textInputValue.trim()" class="mt-1 text-[11px] text-gray-600">
        <span>미리보기:</span>
        <div class="mt-1 p-1.5 bg-gray-50 border border-gray-200 rounded overflow-x-auto whitespace-normal break-all" v-html="renderLatexHtml(textInputValue)"></div>
      </div>
    </div>
    <div
      v-if="pointLabelEditState"
      ref="pointLabelPanelRef"
      class="absolute z-20 bg-white/95 border border-blue-300 rounded-lg px-2 py-2 shadow max-w-[320px] min-w-[200px]"
      :style="{
        left: `${pointLabelEditState.rawX * zoomScale + viewportOffset.x}px`,
        top: `${pointLabelEditState.rawY * zoomScale + viewportOffset.y}px`
      }"
    >
      <input
        ref="pointLabelInputRef"
        v-model="pointLabelValue"
        type="text"
        class="w-full border border-blue-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
        placeholder="점 이름"
        @keydown.enter.prevent="confirmPointLabelEdit"
        @keydown.esc.prevent="cancelPointLabelEdit"
        @blur="handlePointLabelInputBlur"
      />
      <label class="mt-2 flex items-center gap-1.5 text-xs text-gray-700">
        <input v-model="pointLabelUseLatex" type="checkbox" tabindex="0">
        <span>LaTeX 사용</span>
      </label>
      <div v-if="pointLabelUseLatex && pointLabelValue.trim()" class="mt-1 text-[11px] text-gray-600">
        <span>미리보기:</span>
        <div class="mt-1 p-1.5 bg-gray-50 border border-gray-200 rounded overflow-x-auto whitespace-normal break-all" v-html="renderLatexHtml(pointLabelValue)"></div>
      </div>
    </div>
    <div
      v-if="textGuideEditState"
      ref="textGuidePanelRef"
      class="absolute z-20 bg-white/95 border border-orange-300 rounded-lg px-2 py-2 shadow max-w-[360px] min-w-[220px]"
      :style="{
        left: `${textGuideEditState.rawX * zoomScale + viewportOffset.x}px`,
        top: `${textGuideEditState.rawY * zoomScale + viewportOffset.y}px`
      }"
    >
      <input
        ref="textGuideInputRef"
        v-model="textGuideValue"
        type="text"
        class="w-full border border-orange-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500"
        placeholder="텍스트"
        @keydown.enter.prevent="confirmTextGuideEdit"
        @keydown.esc.prevent="cancelTextGuideEdit"
        @blur="handleTextGuideInputBlur"
      />
      <label class="mt-2 flex items-center gap-1.5 text-xs text-gray-700">
        <input v-model="textGuideUseLatex" type="checkbox" tabindex="0">
        <span>LaTeX 사용</span>
      </label>
      <div v-if="textGuideUseLatex && textGuideValue.trim()" class="mt-1 text-[11px] text-gray-600">
        <span>미리보기:</span>
        <div class="mt-1 p-1.5 bg-gray-50 border border-gray-200 rounded overflow-x-auto whitespace-normal break-all" v-html="renderLatexHtml(textGuideValue)"></div>
      </div>
    </div>
  </div>
</template>
