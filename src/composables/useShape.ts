import { useCanvasStore } from '@/stores/canvas'
import { useToolStore } from '@/stores/tool'
import {
  generateId,
  isSameGridPoint,
  calculateDistancePixels,
  distancePointToSegment,
  isPointInPolygon,
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
import type { Point, Shape } from '@/types'
import { FILL_NONE, FILL_PALETTE, STROKE_PALETTE } from '@/constants/colorPalette'

/**
 * 도형 그리기 관련 로직
 */
export function useShape() {
  const canvasStore = useCanvasStore()
  const toolStore = useToolStore()
  let pendingAttachShapeId: string | null = null
  const openShapeTypes = new Set(['segment', 'ray', 'line', 'angle-line', 'arrow', 'arrow-curve'])
  const defaultHeightVisibleTypes = new Set([
    'triangle',
    'triangle-equilateral',
    'triangle-isosceles',
    'triangle-free',
    'rect-trapezoid',
    'rect-rhombus',
    'rect-parallelogram'
  ])

  /**
   * 점 클릭 처리
   */
  function handlePointClick(point: Point) {
    const { shapeType, tempPoints } = toolStore

    if (shapeType === 'point-on-object') {
      const attachShapeId = findAttachableShapeId(point)
      if (!attachShapeId) return
      pendingAttachShapeId = attachShapeId
    }

    // 자유선 모드에서 첫 점 재클릭 시 도형 완성
    if (shapeType === 'polygon' && tempPoints.length >= 3) {
      if (isSameGridPoint(tempPoints[0], point)) {
        completeShape()
        return
      }
    }

    // 점 추가
    toolStore.addTempPoint(point)

    // 도형 완성 체크
    checkShapeComplete()
  }

  /**
   * 도형 완성 체크
   */
  function checkShapeComplete() {
    const { shapeType, tempPoints } = toolStore

    const requiredPoints: Record<string, number> = {
      rectangle: 4,
      triangle: 3,
      circle: 2,
      polygon: -1, // 수동 완성
      point: 1,
      'point-on-object': 1,
      segment: 2,
      ray: 2,
      line: 2,
      arrow: 2,
      'arrow-curve': 2,
      'angle-line': 3,
      'triangle-equilateral': 2,
      'triangle-right': 3,
      'triangle-isosceles': 3,
      'triangle-free': 3,
      'rect-square': 2,
      'rect-rectangle': 2,
      'rect-trapezoid': 3,
      'rect-rhombus': 2,
      'rect-parallelogram': 3,
      'rect-free': 4,
      'polygon-regular': 2
    }

    const required = requiredPoints[shapeType]
    if (required > 0 && tempPoints.length >= required) {
      completeShape()
    }
  }

  /**
   * 도형 생성 완료
   */
  function completeShape() {
    const { shapeType, tempPoints, style } = toolStore

    if (tempPoints.length < 1) return

    const normalizedType = shapeType === 'triangle-free'
      ? 'triangle'
      : shapeType === 'polygon'
        ? 'polygon'
        : shapeType

    let points: Point[] = [...tempPoints]

    if (shapeType === 'triangle-equilateral' && tempPoints.length >= 2) {
      points = [tempPoints[0], tempPoints[1], computeEquilateralTriangle(tempPoints[0], tempPoints[1])]
    } else if (shapeType === 'triangle-right' && tempPoints.length >= 3) {
      points = [tempPoints[0], tempPoints[1], computeRightTriangleThirdPoint(tempPoints[0], tempPoints[1], tempPoints[2])]
    } else if (shapeType === 'triangle-isosceles' && tempPoints.length >= 3) {
      points = [tempPoints[0], tempPoints[1], computeIsoscelesApex(tempPoints[0], tempPoints[1], tempPoints[2])]
    } else if (shapeType === 'rect-square' && tempPoints.length >= 2) {
      const [p3, p4] = computeSquare(tempPoints[0], tempPoints[1])
      points = [tempPoints[0], tempPoints[1], p3, p4]
    } else if (shapeType === 'rect-rectangle' && tempPoints.length >= 2) {
      points = computeRectangle(tempPoints[0], tempPoints[1])
    } else if (shapeType === 'rect-rhombus' && tempPoints.length >= 2) {
      points = computeRhombus(tempPoints[0], tempPoints[1])
    } else if (shapeType === 'rect-parallelogram' && tempPoints.length >= 3) {
      points = [tempPoints[0], tempPoints[1], computeParallelogram(tempPoints[0], tempPoints[1], tempPoints[2]), tempPoints[2]]
    } else if (shapeType === 'rect-trapezoid' && tempPoints.length >= 3) {
      points = computeTrapezoidFromThreePoints(tempPoints[0], tempPoints[1], tempPoints[2])
    } else if (shapeType === 'polygon-regular' && tempPoints.length >= 2) {
      points = computeRegularPolygon(tempPoints[0], tempPoints[1], toolStore.polygonSides)
    }

    const nextDefaultFillHex = (() => {
      const filledShapeCount = canvasStore.shapes.filter(
        (shape) => !openShapeTypes.has(shape.type) && shape.type !== 'point' && shape.type !== 'point-on-object'
      ).length
      return FILL_PALETTE[filledShapeCount % FILL_PALETTE.length]?.hex || FILL_PALETTE[0]?.hex || FILL_NONE
    })()
    const isOpenOrPoint = openShapeTypes.has(normalizedType) || normalizedType === 'point' || normalizedType === 'point-on-object'

    const arrowDefaultStroke = STROKE_PALETTE.find((c) => c.id === 'magenta100')?.hex || '#E6007E'
    const isArrowType = normalizedType === 'arrow' || normalizedType === 'arrow-curve'

    const shape: Shape = {
      id: generateId(),
      type: normalizedType,
      points,
      style,
      color: {
        stroke: isArrowType ? arrowDefaultStroke : (STROKE_PALETTE[0]?.hex || '#231815'),
        fill: isOpenOrPoint ? FILL_NONE : nextDefaultFillHex
      },
      strokeWidthPt: isArrowType ? 0.5 : undefined,
      guideVisibility: {
        length: normalizedType === 'ray' || normalizedType === 'line' ? false : undefined,
        height: defaultHeightVisibleTypes.has(normalizedType),
        point: isArrowType ? false : undefined
      },
      attachedToShapeId: shapeType === 'point-on-object' ? pendingAttachShapeId ?? undefined : undefined
    }

    canvasStore.addShape(shape)
    toolStore.clearTempPoints()
    pendingAttachShapeId = null
  }

  function findAttachableShapeId(point: Point): string | null {
    const edgeTolerance = 1

    for (let i = canvasStore.shapes.length - 1; i >= 0; i--) {
      const shape = canvasStore.shapes[i]
      if (shape.type === 'point' || shape.type === 'point-on-object') continue
      if (shape.points.length < 2) continue

      if (shape.type === 'circle' && shape.points.length >= 2) {
        const center = shape.points[0]
        const edge = shape.points[1]
        const radius = calculateDistancePixels(center, edge)
        const d = calculateDistancePixels(center, point)
        if (d <= radius + edgeTolerance) return shape.id
        continue
      }

      const isOpenShape = shape.type === 'segment'
        || shape.type === 'ray'
        || shape.type === 'line'
        || shape.type === 'arrow'
        || shape.type === 'arrow-curve'
        || shape.type === 'angle-line'

      if (!isOpenShape && shape.points.length >= 3 && isPointInPolygon(point, shape.points)) {
        // 도형 내부 클릭 허용 (외부는 불가)
        return shape.id
      }

      const segmentCount = isOpenShape
        ? Math.max(1, shape.points.length - 1)
        : shape.points.length

      for (let s = 0; s < segmentCount; s++) {
        const p1 = shape.points[s]
        const p2 = shape.points[(s + 1) % shape.points.length]
        if (!p1 || !p2) continue
        if (distancePointToSegment(point, p1, p2) <= edgeTolerance) {
          return shape.id
        }
      }
    }

    return null
  }

  /**
   * 마지막 작업 취소
   */
  function undoLast() {
    const { tempPoints } = toolStore

    if (tempPoints.length > 0) {
      toolStore.removeLastTempPoint()
    } else {
      canvasStore.removeLastShape()
    }
  }

  return {
    handlePointClick,
    completeShape,
    undoLast
  }
}
