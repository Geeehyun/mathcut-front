import type { ShapeType } from '@/types'

export const OPEN_SHAPE_TYPES = new Set<ShapeType>([
  'segment',
  'ray',
  'line',
  'angle-line',
  'arrow',
  'arrow-curve'
])

export const HEIGHT_DEFAULT_VISIBLE_TYPES = new Set<ShapeType>([
  'triangle',
  'triangle-equilateral',
  'triangle-isosceles',
  'triangle-free',
  'rect-trapezoid',
  'rect-rhombus',
  'rect-parallelogram'
])

export const GUIDE_HIT_THRESHOLD_PX = 14
export const GUIDE_CONTEXT_THRESHOLD_PX = 14

export function isOpenShapeType(shapeType: ShapeType): boolean {
  return OPEN_SHAPE_TYPES.has(shapeType)
}

export function isHeightDefaultVisibleType(shapeType: ShapeType): boolean {
  return HEIGHT_DEFAULT_VISIBLE_TYPES.has(shapeType)
}
