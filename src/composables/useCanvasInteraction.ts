import { computed, ref, type Ref } from 'vue'
import type { KonvaEventObject } from 'konva/lib/Node'
import { snapToGrid, snapToSubGrid } from '@/utils/geometry'
import { GRID_CONFIG } from '@/types'
import type { Point, Shape } from '@/types'
import type { useCanvasStore } from '@/stores/canvas'
import type { useToolStore } from '@/stores/tool'

type ShapeGuideKey = 'length' | 'angle' | 'pointName' | 'height'

interface DragCenter {
  x: number
  y: number
}

interface UseCanvasInteractionOptions {
  interactionLocked: Ref<boolean>
  stageRef: Ref<any>
  toolStore: ReturnType<typeof useToolStore>
  canvasStore: ReturnType<typeof useCanvasStore>
  zoomScale: Ref<number>
  stageWidth: Ref<number>
  stageHeight: Ref<number>
  containerSize: Ref<{ width: number, height: number }>
  selectedTextGuideId: Ref<string | null>
  emitMouseMove: (pos: { x: number, y: number } | null) => void
  cancelTextInput: () => void
  startLengthGuideDrag: (raw: { x: number, y: number }) => void
  updateLengthGuideDrag: (raw: { x: number, y: number }) => void
  finishLengthGuideDrag: (raw: { x: number, y: number }) => void
  logAngleGuidePlacement: (shapeId: string, angleIndex: number) => void
  startTextGuideEdit: (guideId: string) => void
  getShapeCentroid: (points: Point[]) => DragCenter
  getTextGuideAnchor: (guide: { points: Point[] }) => DragCenter
  getTextGuideFontSize: (guide: { fontSize?: number }) => number
  getTextGuideRotation: (guide: { rotation?: number }) => number
  getShapeGuideItemOffset: (shape: Shape, key: ShapeGuideKey, index: number) => DragCenter
}

export function useCanvasInteraction(options: UseCanvasInteractionOptions) {
  const {
    interactionLocked,
    stageRef,
    toolStore,
    canvasStore,
    zoomScale,
    stageWidth,
    stageHeight,
    containerSize,
    selectedTextGuideId,
    emitMouseMove,
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
  } = options

  const hoveredShapeId = ref<string | null>(null)
  const shapeMap = computed(() => new Map(canvasStore.shapes.map((shape) => [shape.id, shape])))
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
    center: DragCenter
    startDistance?: number
    startAngle?: number
    originalPoints: Point[]
  } | null>(null)
  const guideTextDrag = ref<{
    shapeId: string
    guideKey: ShapeGuideKey
    itemIndex: number
    startRaw: { x: number, y: number }
    startOffset: { x: number, y: number }
  } | null>(null)
  const hoveredTextGuideId = ref<string | null>(null)
  const textGuideDrag = ref<{
    guideId: string
    lastPoint: Point
  } | null>(null)
  const textGuideTransformDrag = ref<{
    guideId: string
    type: 'scale' | 'rotate'
    center: DragCenter
    startDistance?: number
    startAngle?: number
    originalFontSize: number
    originalRotation: number
  } | null>(null)
  const hoveredVertex = ref(false)
  const hoveredVertexKey = ref<string | null>(null)
  const hoveredGuideTextKey = ref<string | null>(null)

  function clearInteractionState() {
    panDrag.value = null
    shapeDrag.value = null
    vertexDrag.value = null
    transformDrag.value = null
    guideTextDrag.value = null
    textGuideDrag.value = null
    textGuideTransformDrag.value = null
    hoveredTextGuideId.value = null
    hoveredGuideTextKey.value = null
  }

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

  function getLogicalPointerPos(
    stage: { getPointerPosition(): { x: number; y: number } | null }
  ): { x: number; y: number } | null {
    const pos = stage.getPointerPosition()
    if (!pos) return null
    return {
      x: (pos.x - viewportOffset.value.x) / zoomScale.value,
      y: (pos.y - viewportOffset.value.y) / zoomScale.value
    }
  }

  function shouldStartPanGesture(evt: MouseEvent): boolean {
    return toolStore.mode === 'select' && toolStore.zoom > 100 && isSpacePressed.value && evt.button === 0
  }

  function handleMouseDown(e: KonvaEventObject<MouseEvent>) {
    if (interactionLocked.value) return
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
    const pos = getLogicalPointerPos(stage)
    if (!pos) return
    startLengthGuideDrag(pos)
  }

  function handleMouseLeave() {
    emitMouseMove(null)
    hoveredShapeId.value = null
    hoveredVertex.value = false
    hoveredVertexKey.value = null
    mousePos.value = null
    clearInteractionState()
    if (toolStore.mode !== 'guide' || toolStore.guideType !== 'text') {
      cancelTextInput()
    }
  }

  function handleMouseMove(e: KonvaEventObject<MouseEvent>) {
    if (interactionLocked.value) {
      clearInteractionState()
      return
    }
    const stage = e.target.getStage()
    if (!stage) return
    const pos = getLogicalPointerPos(stage)
    if (!pos) return

    if (toolStore.mode === 'select' && panDrag.value) {
      const nextX = panDrag.value.startOffsetX + (e.evt.clientX - panDrag.value.startClientX)
      const nextY = panDrag.value.startOffsetY + (e.evt.clientY - panDrag.value.startClientY)
      viewportOffset.value = clampViewportOffset(nextX, nextY)
      return
    }

    mousePos.value = snapToGrid(pos.x, pos.y)
    emitMouseMove({
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
      const shape = shapeMap.value.get(vertexDrag.value.shapeId)
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
        canvasStore.moveShape(shapeDrag.value.id, dx, dy, false)
        shapeDrag.value.lastPoint = snapped
      }
      return
    }

    if (toolStore.mode === 'guide' && toolStore.guideType === 'length') {
      updateLengthGuideDrag(pos)
    }
  }

  function handleMouseUp(e: KonvaEventObject<MouseEvent>) {
    if (interactionLocked.value) {
      clearInteractionState()
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
    const pos = getLogicalPointerPos(stage)
    if (!pos) return
    finishLengthGuideDrag(pos)
  }

  function handleShapeNodeClick(id: string, e: KonvaEventObject<MouseEvent>) {
    if (interactionLocked.value) return
    if (toolStore.mode === 'select' && toolStore.zoom > 100 && isSpacePressed.value) return
    if (toolStore.mode !== 'select') return
    selectedTextGuideId.value = null
    canvasStore.selectShape(id)
    suppressCanvasClick.value = true
    e.cancelBubble = true
  }

  function handleShapeNodeMouseDown(id: string, e: KonvaEventObject<MouseEvent>) {
    if (interactionLocked.value) return
    if (shouldStartPanGesture(e.evt)) return
    if (e.evt.button !== 0) return
    if (toolStore.mode !== 'select') return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = getLogicalPointerPos(stage)
    if (!pos) return
    const snapped = snapToGrid(pos.x, pos.y)
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
    if (interactionLocked.value) return
    if (toolStore.mode !== 'select') return
    canvasStore.selectGuide(guideId)
    selectedTextGuideId.value = guideId
    suppressCanvasClick.value = true
    e.cancelBubble = true
  }

  function handleTextGuideMouseDown(guideId: string, e: KonvaEventObject<MouseEvent>) {
    if (interactionLocked.value) return
    if (shouldStartPanGesture(e.evt)) return
    if (e.evt.button !== 0) return
    if (toolStore.mode !== 'select') return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = getLogicalPointerPos(stage)
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
    if (interactionLocked.value) return
    if (shouldStartPanGesture(e)) return
    if (e.button !== 0) return
    if (toolStore.mode !== 'select') return
    const stage = stageRef.value?.getNode?.()
    if (!stage) return
    stage.setPointersPositions(e as any)
    const pos = getLogicalPointerPos(stage)
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

  function handleVertexHandleMouseDown(shapeId: string, pointIndex: number, e: KonvaEventObject<MouseEvent>) {
    if (interactionLocked.value) return
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
    if (interactionLocked.value) return
    if (toolStore.mode === 'select' && toolStore.zoom > 100 && isSpacePressed.value) return
    if (toolStore.mode !== 'select') return
    canvasStore.selectShape(shapeId)
    suppressCanvasClick.value = true
    e.cancelBubble = true
  }

  function getVertexKey(shapeId: string, pointIndex: number): string {
    return `${shapeId}:${pointIndex}`
  }

  function handleVertexMouseEnter(shapeId: string, pointIndex: number) {
    hoveredVertex.value = true
    hoveredVertexKey.value = getVertexKey(shapeId, pointIndex)
  }

  function handleVertexMouseLeave() {
    hoveredVertex.value = false
    hoveredVertexKey.value = null
  }

  function getGuideTextKey(shapeId: string, guideKey: ShapeGuideKey, itemIndex: number): string {
    return `${shapeId}:${guideKey}:${itemIndex}`
  }

  function handleGuideTextMouseEnter(shapeId: string, guideKey: ShapeGuideKey, itemIndex: number) {
    if (toolStore.mode !== 'select') return
    hoveredGuideTextKey.value = getGuideTextKey(shapeId, guideKey, itemIndex)
  }

  function handleGuideTextMouseLeave() {
    hoveredGuideTextKey.value = null
  }

  function handleScaleHandleMouseDown(shapeId: string, e: KonvaEventObject<MouseEvent>) {
    if (interactionLocked.value) return
    if (shouldStartPanGesture(e.evt)) return
    if (toolStore.mode !== 'select') return
    if (e.evt.button !== 0) return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = getLogicalPointerPos(stage)
    if (!pos) return
    const shape = shapeMap.value.get(shapeId)
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
    if (interactionLocked.value) return
    if (shouldStartPanGesture(e.evt)) return
    if (toolStore.mode !== 'select') return
    if (e.evt.button !== 0) return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = getLogicalPointerPos(stage)
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
    guideKey: ShapeGuideKey,
    itemIndex: number,
    e: KonvaEventObject<MouseEvent>
  ) {
    if (interactionLocked.value) return
    if (shouldStartPanGesture(e.evt)) return
    if (toolStore.mode !== 'select') return
    if (e.evt.button !== 0) return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = getLogicalPointerPos(stage)
    if (!pos) return
    const shape = shapeMap.value.get(shapeId)
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
    if (interactionLocked.value) return
    if (shouldStartPanGesture(e)) return
    if (toolStore.mode !== 'select') return
    if (e.button !== 0) return
    const stage = stageRef.value?.getNode?.()
    if (!stage) return
    stage.setPointersPositions(e as any)
    const pos = getLogicalPointerPos(stage)
    if (!pos) return
    const shape = shapeMap.value.get(shapeId)
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
    if (interactionLocked.value) return
    if (shouldStartPanGesture(e.evt)) return
    if (toolStore.mode !== 'select') return
    if (e.evt.button !== 0) return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = getLogicalPointerPos(stage)
    if (!pos) return
    const shape = shapeMap.value.get(shapeId)
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
    if (interactionLocked.value) return
    if (shouldStartPanGesture(e.evt)) return
    if (toolStore.mode !== 'select') return
    if (e.evt.button !== 0) return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = getLogicalPointerPos(stage)
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

  return {
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
    clearInteractionState,
    clampViewportOffset,
    getLogicalPointerPos,
    shouldStartPanGesture,
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
  }
}
