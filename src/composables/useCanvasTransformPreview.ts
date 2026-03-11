import { computed, type Ref } from 'vue'
import type { Point, Shape } from '@/types'
import type { useCanvasStore } from '@/stores/canvas'
import type { useToolStore } from '@/stores/tool'

interface HandlePoint {
  x: number
  y: number
}

interface TransformUI {
  center: HandlePoint
  rotateHandle: HandlePoint
  scaleHandle: HandlePoint
}

interface UseCanvasTransformPreviewOptions {
  toolStore: ReturnType<typeof useToolStore>
  canvasStore: ReturnType<typeof useCanvasStore>
  mousePos: Ref<Point | null>
  selectedTextGuideId: Ref<string | null>
  getTextGuideAnchor: (guide: { points: Point[] }) => HandlePoint
  calculateDistancePixels: (a: Point, b: Point) => number
  computeEquilateralTriangle: (a: Point, b: Point) => Point
  computeRightTriangleThirdPoint: (a: Point, b: Point, c: Point) => Point
  computeIsoscelesApex: (a: Point, b: Point, c: Point) => Point
  computeSquare: (a: Point, b: Point) => [Point, Point]
  computeRectangle: (a: Point, b: Point) => Point[]
  computeRhombus: (a: Point, b: Point) => Point[]
  computeParallelogram: (a: Point, b: Point, c: Point) => Point
  computeTrapezoidFromThreePoints: (a: Point, b: Point, c: Point) => Point[]
  computeRegularPolygon: (a: Point, b: Point, sides: number) => Point[]
}

function getShapeBounds(
  shape: Shape,
  calculateDistancePixels: (a: Point, b: Point) => number
): { x: number, y: number, width: number, height: number } | null {
  if (shape.type === 'circle' && shape.points.length >= 2) {
    const center = shape.points[0]
    const radius = calculateDistancePixels(shape.points[0], shape.points[1])
    return { x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2 }
  }
  if (!shape.points.length) return null
  const xs = shape.points.map((point) => point.x)
  const ys = shape.points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function useCanvasTransformPreview(options: UseCanvasTransformPreviewOptions) {
  const {
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
  } = options

  const selectedShapeTransformUI = computed<TransformUI | null>(() => {
    if (toolStore.mode !== 'select') return null
    const shape = canvasStore.selectedShape
    if (!shape) return null
    if (shape.type === 'point' || shape.type === 'point-on-object') return null
    if (shape.points.length < 2) return null
    const bounds = getShapeBounds(shape, calculateDistancePixels)
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

  const selectedTextGuideTransformUI = computed<TransformUI | null>(() => {
    if (toolStore.mode !== 'select') return null
    if (!selectedTextGuideId.value) return null
    const guide = canvasStore.guides.find((target) => target.id === selectedTextGuideId.value)
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

  return {
    selectedShapeTransformUI,
    selectedTextGuideTransformUI,
    getPreviewPoints,
  }
}
