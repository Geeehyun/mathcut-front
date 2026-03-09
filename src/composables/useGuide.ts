import { useCanvasStore } from '@/stores/canvas'
import { useToolStore } from '@/stores/tool'
import { computed, ref } from 'vue'
import {
  generateId,
  calculateDistance,
  distanceBetweenPoints,
  distancePointToSegment,
  getLengthGuideControlPoint,
  createQuadraticCurvePoints,
  distancePointToPolyline
} from '@/utils/geometry'
import type { Point, Guide } from '@/types'

/**
 * 가이드 관련 로직
 */
export function useGuide() {
  const canvasStore = useCanvasStore()
  const toolStore = useToolStore()
  const selectionThreshold = 14

  const pendingLengthEdge = ref<{ p1: Point, p2: Point, shapeId: string } | null>(null)
  const lengthDragPoint = ref<{ x: number, y: number } | null>(null)
  const isDraggingLength = ref(false)
  const suppressNextLengthClick = ref(false)

  /**
   * 캔버스 클릭 처리
   */
  function handleCanvasClick(point: Point, rawPoint: { x: number, y: number }) {
    if (toolStore.guideType === 'length') {
      if (suppressNextLengthClick.value) {
        suppressNextLengthClick.value = false
        return
      }
      tryToggleLengthGuideDirection(rawPoint)
      return
    }

    if (toolStore.guideType === 'text') {
      completeTextGuide(point)
      return
    }

    if (toolStore.guideType === 'angle') {
      completeAngleGuide(rawPoint)
    }
  }

  /**
   * 길이 가이드 드래그 시작
   */
  function startLengthGuideDrag(rawPoint: { x: number, y: number }) {
    if (toolStore.mode !== 'guide' || toolStore.guideType !== 'length') return
    const edge = findNearestEdge(rawPoint)
    if (!edge) return

    pendingLengthEdge.value = edge
    lengthDragPoint.value = rawPoint
    isDraggingLength.value = true
  }

  /**
   * 길이 가이드 드래그 업데이트
   */
  function updateLengthGuideDrag(rawPoint: { x: number, y: number }) {
    if (!isDraggingLength.value || !pendingLengthEdge.value) return
    lengthDragPoint.value = rawPoint
  }

  /**
   * 길이 가이드 드래그 종료
   */
  function finishLengthGuideDrag(rawPoint: { x: number, y: number }) {
    if (!isDraggingLength.value || !pendingLengthEdge.value) {
      resetLengthDragState()
      return
    }

    const { p1, p2, shapeId } = pendingLengthEdge.value
    const distance = calculateDistance(p1, p2)
    const guide: Guide = {
      id: generateId(),
      type: 'length',
      // [시작점, 끝점, 굽힘 방향 기준점]
      points: [p1, p2, rawToPoint(rawPoint)],
      text: distance.toFixed(1),
      shapeId
    }

    canvasStore.addGuide(guide)
    suppressNextLengthClick.value = true
    resetLengthDragState()
  }

  /**
   * 텍스트 가이드 생성
   */
  function completeTextGuide(point: Point, customText?: string, useLatex: boolean = false) {
    const guide: Guide = {
      id: generateId(),
      type: 'text',
      points: [point],
      text: customText || 'A',
      useLatex,
      color: '#231815'
    }
    canvasStore.addGuide(guide)
  }

  /**
   * 각도 가이드 생성(도형 꼭짓점 선택)
   */
  function completeAngleGuide(rawPoint: { x: number, y: number }, customText?: string) {
    const selected = findNearestVertexWithNeighbors(rawPoint)
    if (!selected) return

    const { prev, current, next, shapeId } = selected
    const guide: Guide = {
      id: generateId(),
      type: 'angle',
      points: [prev, current, next],
      text: customText || calculateAngle([prev, current, next]),
      shapeId
    }

    canvasStore.addGuide(guide)
  }

  /**
   * 각도 계산
   */
  function calculateAngle(points: Point[]): string {
    if (points.length < 3) return '0°'

    const p1 = points[0]
    const vertex = points[1]
    const p2 = points[2]

    // 벡터 계산
    const v1x = p1.x - vertex.x
    const v1y = p1.y - vertex.y
    const v2x = p2.x - vertex.x
    const v2y = p2.y - vertex.y

    // 내적으로 직각 확인
    const dotProduct = v1x * v2x + v1y * v2y
    if (Math.abs(dotProduct) < 1) {
      return '90°'
    }

    // 각도 계산
    const angle1 = Math.atan2(v1y, v1x)
    const angle2 = Math.atan2(v2y, v2x)
    let angleDiff = Math.abs(angle2 - angle1)

    if (angleDiff > Math.PI) {
      angleDiff = 2 * Math.PI - angleDiff
    }

    const angleDegrees = (angleDiff * 180 / Math.PI).toFixed(1)
    return `${angleDegrees}°`
  }

  /**
   * 마지막 작업 취소
   */
  function undoLast() {
    if (isDraggingLength.value) {
      resetLengthDragState()
    } else {
      canvasStore.removeLastGuide()
    }
  }

  function resetLengthDragState() {
    pendingLengthEdge.value = null
    lengthDragPoint.value = null
    isDraggingLength.value = false
  }

  function rawToPoint(rawPoint: { x: number, y: number }): Point {
    return {
      x: rawPoint.x,
      y: rawPoint.y,
      gridX: Math.round(rawPoint.x),
      gridY: Math.round(rawPoint.y)
    }
  }

  function findNearestEdge(rawPoint: { x: number, y: number }): { p1: Point, p2: Point, shapeId: string } | null {
    let best: { p1: Point, p2: Point, shapeId: string } | null = null
    let bestDistance = Infinity

    for (const shape of canvasStore.shapes) {
      if (shape.type === 'circle' || shape.points.length < 2) continue
      for (let i = 0; i < shape.points.length; i++) {
        const p1 = shape.points[i]
        const p2 = shape.points[(i + 1) % shape.points.length]
        const dist = distancePointToSegment(rawPoint, p1, p2)
        if (dist < selectionThreshold && dist < bestDistance) {
          bestDistance = dist
          best = { p1, p2, shapeId: shape.id }
        }
      }
    }

    return best
  }

  function findNearestVertexWithNeighbors(rawPoint: { x: number, y: number }): { prev: Point, current: Point, next: Point, shapeId: string } | null {
    let best: { prev: Point, current: Point, next: Point, shapeId: string } | null = null
    let bestDistance = Infinity

    for (const shape of canvasStore.shapes) {
      if (shape.type === 'circle' || shape.points.length < 3) continue
      for (let i = 0; i < shape.points.length; i++) {
        const current = shape.points[i]
        const dist = distanceBetweenPoints(rawPoint, current)
        if (dist < selectionThreshold && dist < bestDistance) {
          bestDistance = dist
          best = {
            prev: shape.points[(i - 1 + shape.points.length) % shape.points.length],
            current,
            next: shape.points[(i + 1) % shape.points.length],
            shapeId: shape.id
          }
        }
      }
    }

    return best
  }

  const lengthGuidePreview = computed(() => {
    if (!pendingLengthEdge.value || !lengthDragPoint.value) return null
    return {
      p1: pendingLengthEdge.value.p1,
      p2: pendingLengthEdge.value.p2,
      bendRef: lengthDragPoint.value
    }
  })

  function tryToggleLengthGuideDirection(rawPoint: { x: number, y: number }) {
    let targetGuideId: string | null = null
    let targetGuideDistance = Infinity

    for (const guide of canvasStore.guides) {
      if (guide.type !== 'length' || guide.points.length < 3) continue
      const p1 = guide.points[0]
      const p2 = guide.points[1]
      const bendRef = guide.points[2]
      const cp = getLengthGuideControlPoint(p1, p2, bendRef)
      const curvePoints = createQuadraticCurvePoints(p1, cp, p2)
      const dist = distancePointToPolyline(rawPoint, curvePoints)
      if (dist < selectionThreshold && dist < targetGuideDistance) {
        targetGuideDistance = dist
        targetGuideId = guide.id
      }
    }

    if (!targetGuideId) return

    canvasStore.updateGuide(targetGuideId, (guide) => {
      const p1 = guide.points[0]
      const p2 = guide.points[1]
      const bendRef = guide.points[2]
      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2
      const flipped: Point = {
        x: midX * 2 - bendRef.x,
        y: midY * 2 - bendRef.y,
        gridX: Math.round(midX * 2 - bendRef.x),
        gridY: Math.round(midY * 2 - bendRef.y)
      }
      return {
        ...guide,
        points: [p1, p2, flipped]
      }
    })
  }

  return {
    handleCanvasClick,
    startLengthGuideDrag,
    updateLengthGuideDrag,
    finishLengthGuideDrag,
    undoLast,
    lengthGuidePreview,
    createTextGuide: completeTextGuide
  }
}
