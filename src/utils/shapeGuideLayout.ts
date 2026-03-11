import type { Point, Shape, ShapeGuideItemStyle, ShapeType } from '@/types'
import { GRID_CONFIG } from '@/types'
import { findRightAngles } from '@/utils/geometry'
import { OPEN_SHAPE_TYPES } from '@/constants/shapeRules'
import { getRightAngleGuideMarkerPoints, getLengthGuideControlPoint, createQuadraticCurvePoints, isRightAngleByThreePoints } from '@/utils/geometry'

type GuideBlankRect = {
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
}

export type LayoutRect = {
  left: number
  right: number
  top: number
  bottom: number
}

export type ShapeAngleLabelLayoutOptions = {
  arcRadius: number
  guideLineWidth: number
  rightAngleMarkerSize: number
  outerGapPx: number
  rightAngleDistMultiplier: number
  edgePaddingPx: number
  nonRightAngleExtraGapPx: number
  baselineCompensationRatio: number
  nonRightAngleBaselineLiftPx: number
  obtuseAngleStartDeg: number
  obtuseGapReduceMaxPx: number
  obtuseLiftReduceMaxPx: number
  rightAngleQuadrantXRatio: number
  rightAngleVerticalBaseRatio: number
  rightAngleVerticalQuadrantRatio: number
}

export function getGuideBlankWidthMm(
  style: ShapeGuideItemStyle | undefined,
  baseWidthMm: number,
  stepMm: number,
  minMm: number,
  maxMm: number
): number {
  const raw = Number(style?.blankWidthMm ?? style?.blankSizeMm)
  if (!Number.isFinite(raw)) return baseWidthMm
  const stepped = Math.round(raw / stepMm) * stepMm
  return Math.max(minMm, Math.min(maxMm, stepped))
}

export function getBlankSizePx(
  widthMm: number,
  mmToPx: number,
  baseHeightMm: number,
  cornerRadiusRatio: number = 0.23
): { width: number, height: number, cornerRadius: number } {
  const widthPx = widthMm * mmToPx
  const heightPx = baseHeightMm * mmToPx
  return {
    width: widthPx,
    height: heightPx,
    cornerRadius: heightPx * cornerRadiusRatio
  }
}

export function getGuideBlankRect(
  center: { x: number, y: number },
  widthMm: number,
  mmToPx: number,
  baseHeightMm: number,
  cornerRadiusRatio: number = 0.23
): GuideBlankRect {
  const size = getBlankSizePx(widthMm, mmToPx, baseHeightMm, cornerRadiusRatio)
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
    cornerRadius: size.cornerRadius
  }
}

export function getGuideBlankTextPos(
  rect: GuideBlankRect,
  fontSize: number,
  xGap: number
): { x: number, y: number } {
  return {
    x: rect.x + rect.width + xGap,
    y: rect.y + (rect.height / 2) - (fontSize * 0.5)
  }
}

export function getShapeCentroid(points: Array<{ x: number, y: number }>): { x: number, y: number } {
  if (points.length === 0) return { x: 0, y: 0 }
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

export function getPointNameDefaultPos(
  shapeType: ShapeType,
  points: Array<{ x: number, y: number }>,
  index: number
): { x: number, y: number } {
  const point = points[index]
  if (!point) return { x: 0, y: 0 }

  let vx = 0
  let vy = 0
  if (shapeType === 'circle' && index === 0 && points[1]) {
    const radiusPoint = points[1]
    vx = point.x - radiusPoint.x
    vy = point.y - radiusPoint.y
  } else {
    const center = getShapeCentroid(points)
    vx = point.x - center.x
    vy = point.y - center.y
  }

  if (Math.hypot(vx, vy) <= 1e-6) {
    vx = 1
    vy = -1
  }

  const len = Math.hypot(vx, vy) || 1
  const nx = vx / len
  const ny = vy / len
  const distance = 14
  const anchorX = point.x + nx * distance
  const anchorY = point.y + ny * distance

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

export function getShapeAutoAngleIndices(
  shape: Shape,
  angleDisplayMode: 'right' | 'all'
): number[] {
  if (shape.type === 'angle-line') {
    return shape.points.length >= 3 ? [1] : []
  }
  if (shape.type === 'circle' || OPEN_SHAPE_TYPES.has(shape.type) || shape.points.length < 3) {
    return []
  }
  if (angleDisplayMode === 'all') {
    return shape.points.map((_, index) => index)
  }
  return findRightAngles(shape.points)
}

export function getShapeAutoLengthIndices(shape: Shape): number[] {
  if (shape.type === 'circle' || shape.type === 'arrow' || shape.type === 'arrow-curve' || shape.type === 'angle-line') {
    return []
  }
  if (shape.type === 'segment' || shape.type === 'ray' || shape.type === 'line') {
    return shape.points.length >= 2 ? [0] : []
  }
  return shape.points.map((_, index) => index)
}

export function getShapeAngleTriplet(
  shape: Shape,
  index: number
): { prev: Point, vertex: Point, next: Point } | null {
  if (shape.points.length < 3) return null
  const pointCount = shape.points.length
  const prev = shape.points[(index - 1 + pointCount) % pointCount]
  const vertex = shape.points[index]
  const next = shape.points[(index + 1) % pointCount]
  if (!prev || !vertex || !next) return null
  return { prev, vertex, next }
}

export function getLengthGuideLabelPos(guide: { points: { x: number, y: number }[] }): { x: number, y: number } {
  const p1 = guide.points[0]
  const p2 = guide.points[1]
  const bendRef = guide.points.length >= 3 ? guide.points[2] : { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 + 1 }
  return getLengthGuideControlPoint(p1, p2, bendRef)
}

export function getLengthGuideCurvePoints(guide: { points: { x: number, y: number }[] }): number[] {
  const p1 = guide.points[0]
  const p2 = guide.points[1]
  const bendRef = guide.points.length >= 3 ? guide.points[2] : { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 + 1 }
  const controlPoint = getLengthGuideControlPoint(p1, p2, bendRef)
  return createQuadraticCurvePoints(p1, controlPoint, p2)
}

export function getShapeBottomBaseEdgeIndex(shape: Shape): number {
  const pointCount = shape.points.length
  if (pointCount < 2) return 0
  let bestIndex = 0
  let bestAverageY = -Infinity
  for (let i = 0; i < pointCount; i++) {
    const p1 = shape.points[i]
    const p2 = shape.points[(i + 1) % pointCount]
    const averageY = (p1.y + p2.y) / 2
    if (averageY > bestAverageY) {
      bestAverageY = averageY
      bestIndex = i
    }
  }
  return bestIndex
}

export function getShapeHeightBaseEdgeIndex(shape: Shape): number {
  const pointCount = shape.points.length
  if (pointCount < 2) return 0
  const custom = Number(shape.heightBaseEdgeIndex)
  if (Number.isInteger(custom) && custom >= 0 && custom < pointCount) return custom
  return getShapeBottomBaseEdgeIndex(shape)
}

export function getShapeHeightGuide(
  shape: Shape
): { apex: Point, foot: Point, baseA: Point, baseB: Point, t: number } | null {
  if (shape.type === 'circle' || shape.type === 'triangle-right' || OPEN_SHAPE_TYPES.has(shape.type) || shape.points.length < 3) {
    return null
  }

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
  let bestDistance = -1

  for (let i = 0; i < shape.points.length; i++) {
    if (i === baseIndex || i === (baseIndex + 1) % shape.points.length) continue
    const apex = shape.points[i]
    const t = ((apex.x - baseA.x) * dx + (apex.y - baseA.y) * dy) / lenSq
    const footX = baseA.x + dx * t
    const footY = baseA.y + dy * t
    const distance = Math.hypot(apex.x - footX, apex.y - footY)
    if (distance > bestDistance) {
      bestDistance = distance
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

  if (!bestApex || !bestFoot || bestDistance <= 1e-6) return null
  return { apex: bestApex, foot: bestFoot, baseA, baseB, t: bestT }
}

export function getShapeHeightRightAngleMarkerPoints(
  shape: Shape,
  markerSize: number
): number[] {
  const heightGuide = getShapeHeightGuide(shape)
  if (!heightGuide) return []
  if (!isRightAngleByThreePoints(heightGuide.baseA, heightGuide.foot, heightGuide.apex)) return []
  const marker = getRightAngleGuideMarkerPoints(heightGuide.baseA, heightGuide.foot, heightGuide.apex, markerSize)
  return [marker.p1.x, marker.p1.y, marker.corner.x, marker.corner.y, marker.p2.x, marker.p2.y]
}

export function interpolateOnPolyline(curvePoints: number[], distance: number): { x: number, y: number, segmentIndex: number } {
  if (curvePoints.length < 4) return { x: 0, y: 0, segmentIndex: 0 }
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
  const lastIndex = Math.floor(curvePoints.length / 2) - 1
  return {
    x: curvePoints[lastIndex * 2],
    y: curvePoints[lastIndex * 2 + 1],
    segmentIndex: Math.max(0, lastIndex - 1)
  }
}

export function getPolylineLength(curvePoints: number[]): number {
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

export function isPointInRect(
  px: number,
  py: number,
  rect: { left: number, right: number, top: number, bottom: number }
): boolean {
  return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom
}

function ccw(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

function segmentsIntersect(
  a1x: number,
  a1y: number,
  a2x: number,
  a2y: number,
  b1x: number,
  b1y: number,
  b2x: number,
  b2y: number
): boolean {
  const d1 = ccw(a1x, a1y, a2x, a2y, b1x, b1y)
  const d2 = ccw(a1x, a1y, a2x, a2y, b2x, b2y)
  const d3 = ccw(b1x, b1y, b2x, b2y, a1x, a1y)
  const d4 = ccw(b1x, b1y, b2x, b2y, a2x, a2y)
  return d1 * d2 <= 0 && d3 * d4 <= 0
}

export function distancePointToSegmentXY(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
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

export function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
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

export function clipSegmentToRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
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

export function splitPolylineByDistance(curvePoints: number[], startDist: number, endDist: number): number[][] {
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
  return [left, right].filter((segment) => segment.length >= 4)
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

export function getShapeAabbRect(shape: Shape): LayoutRect {
  if (shape.type === 'circle' && shape.points[0] && shape.points[1]) {
    const center = shape.points[0]
    const radius = Math.hypot(shape.points[1].x - center.x, shape.points[1].y - center.y)
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

export function rectOverlapArea(a: LayoutRect, b: LayoutRect): number {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return w * h
}

export function doesRectOverlapShape(rect: LayoutRect, shape: Shape, edgeIndex?: number): boolean {
  const center = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 }
  if (shape.type === 'circle' && shape.points[0] && shape.points[1]) {
    const c = shape.points[0]
    const r = Math.hypot(shape.points[1].x - c.x, shape.points[1].y - c.y)
    const nearestX = Math.max(rect.left, Math.min(c.x, rect.right))
    const nearestY = Math.max(rect.top, Math.min(c.y, rect.bottom))
    const dist = Math.hypot(nearestX - c.x, nearestY - c.y)
    return dist <= r || Math.hypot(center.x - c.x, center.y - c.y) <= r
  }

  if (shape.points.length >= 3 && !OPEN_SHAPE_TYPES.has(shape.type)) {
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

export function getLengthMainLeftFromAnchor(
  anchorX: number,
  mainWidth: number,
  unitWidth: number,
  gap: number,
  align: 'center' | 'left' | 'right'
): number {
  if (align === 'left') return anchorX
  if (align === 'right') return anchorX - (mainWidth + gap + unitWidth)
  return anchorX - (mainWidth / 2) - ((gap + unitWidth) / 2)
}

export function getLengthMainOffsetFromAnchor(
  mainWidth: number,
  unitWidth: number,
  gap: number,
  align: 'center' | 'left' | 'right'
): number {
  const left = getLengthMainLeftFromAnchor(0, mainWidth, unitWidth, gap, align)
  return -left
}

export function getLengthUnitXFromAnchor(
  anchorX: number,
  mainWidth: number,
  unitWidth: number,
  gap: number,
  align: 'center' | 'left' | 'right'
): number {
  if (unitWidth <= 0) return anchorX
  const left = getLengthMainLeftFromAnchor(anchorX, mainWidth, unitWidth, gap, align)
  return left + mainWidth + gap
}

export function mergeRects(a: LayoutRect, b: LayoutRect): LayoutRect {
  return {
    left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right),
    top: Math.min(a.top, b.top),
    bottom: Math.max(a.bottom, b.bottom)
  }
}

export function getUnitVisualRectFromTopLeft(
  x: number,
  y: number,
  width: number,
  fontSize: number
): LayoutRect {
  return {
    left: x,
    right: x + width,
    top: y + (fontSize * 0.16),
    bottom: y + (fontSize * 0.82)
  }
}

export function getLengthGuideTextRect(
  centerX: number,
  centerY: number,
  mainWidth: number,
  fontSize: number,
  unitWidth: number,
  gap: number,
  align: 'center' | 'left' | 'right' = 'center'
): LayoutRect {
  const left = getLengthMainLeftFromAnchor(centerX, mainWidth, unitWidth, gap, align)
  const mainRect = {
    left,
    right: left + mainWidth,
    top: centerY - (fontSize * 0.62),
    bottom: centerY + (fontSize * 0.62)
  }
  if (unitWidth <= 0) return mainRect
  const unitX = getLengthUnitXFromAnchor(centerX, mainWidth, unitWidth, gap, align)
  const unitRect = getUnitVisualRectFromTopLeft(unitX, centerY - (fontSize * 0.45), unitWidth, fontSize)
  return mergeRects(mainRect, unitRect)
}

export function getLengthGuideTextRects(
  centerX: number,
  centerY: number,
  mainWidth: number,
  fontSize: number,
  unitWidth: number,
  gap: number,
  align: 'center' | 'left' | 'right' = 'center'
): LayoutRect[] {
  const left = getLengthMainLeftFromAnchor(centerX, mainWidth, unitWidth, gap, align)
  const mainRect = {
    left,
    right: left + mainWidth,
    top: centerY - (fontSize * 0.62),
    bottom: centerY + (fontSize * 0.62)
  }
  if (unitWidth <= 0) return [mainRect]
  const unitX = getLengthUnitXFromAnchor(centerX, mainWidth, unitWidth, gap, align)
  const unitRect = getUnitVisualRectFromTopLeft(unitX, centerY - (fontSize * 0.45), unitWidth, fontSize)
  return [mainRect, unitRect]
}

export function getLengthBlankGuideRectWithUnitRect(
  blankRect: { x: number, y: number, width: number, height: number },
  unitRect: LayoutRect
): LayoutRect {
  const baseRect = {
    left: blankRect.x,
    right: blankRect.x + blankRect.width,
    top: blankRect.y,
    bottom: blankRect.y + blankRect.height
  }
  return mergeRects(baseRect, unitRect)
}

export function getDimensionAnchorForText(
  shape: Shape,
  edgeIndex: number | undefined,
  p1: { x: number, y: number },
  p2: { x: number, y: number },
  mainWidth: number,
  fontSize: number,
  unitWidth: number,
  gap: number,
  avoidPoint?: { x: number, y: number },
  preferredSide?: 1 | -1,
  avoidLine?: { a: { x: number, y: number }, b: { x: number, y: number } },
  maxAutoShiftPx: number = 18
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
    const rect = getLengthGuideTextRect(anchor.x, anchor.y, mainWidth, fontSize, unitWidth, gap, 'center')
    const bounds = getShapeAabbRect(shape)
    let score = rectOverlapArea(rect, bounds)
    if (doesRectOverlapShape(rect, shape, edgeIndex)) score += 100000
    if (avoidLine && segmentIntersectsRect(avoidLine.a.x, avoidLine.a.y, avoidLine.b.x, avoidLine.b.y, rect)) score += 100000
    return { score, rect }
  }

  const plus = { x: mid.x + nx * 12, y: mid.y + ny * 12 }
  const minus = { x: mid.x - nx * 12, y: mid.y - ny * 12 }
  let current = scoreAt(plus).score <= scoreAt(minus).score ? plus : minus
  const dir = { x: current === plus ? nx : -nx, y: current === plus ? ny : -ny }
  let moved = 0

  for (let i = 0; i < 8; i++) {
    const { score, rect } = scoreAt(current)
    if (score <= 0) return current
    const bounds = getShapeAabbRect(shape)
    const overlapW = Math.max(0, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left))
    const overlapH = Math.max(0, Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top))
    const rawShift = Math.max(5, overlapW, overlapH) + 5
    const remain = maxAutoShiftPx - moved
    if (remain <= 0) return current
    const shift = Math.min(rawShift, remain)
    moved += shift
    current = { x: current.x + dir.x * shift, y: current.y + dir.y * shift }
  }
  return current
}

export function getShapeHeightLabelPos(
  shape: Shape,
  heightGuide: { apex: Point, foot: Point },
  mainWidth: number,
  fontSize: number,
  unitWidth: number,
  gap: number,
  horizontalOffsetPx: number
): { x: number, y: number } {
  const mid = { x: (heightGuide.apex.x + heightGuide.foot.x) / 2, y: (heightGuide.apex.y + heightGuide.foot.y) / 2 }
  const left = { x: mid.x - horizontalOffsetPx, y: mid.y }
  const right = { x: mid.x + horizontalOffsetPx, y: mid.y }

  const scoreAt = (anchor: { x: number, y: number }) => {
    const rect = getLengthGuideTextRect(anchor.x, anchor.y, mainWidth, fontSize, unitWidth, gap, 'center')
    let score = 0
    for (let i = 0; i < shape.points.length; i++) {
      const a = shape.points[i]
      const b = shape.points[(i + 1) % shape.points.length]
      if (segmentIntersectsRect(a.x, a.y, b.x, b.y, rect)) score += 1000
    }
    if (segmentIntersectsRect(heightGuide.apex.x, heightGuide.apex.y, heightGuide.foot.x, heightGuide.foot.y, rect)) score += 2000
    return score
  }

  let chosen = scoreAt(left) <= scoreAt(right) ? left : right
  const lx = heightGuide.foot.x - heightGuide.apex.x
  const ly = heightGuide.foot.y - heightGuide.apex.y
  const llen = Math.hypot(lx, ly) || 1
  const nx = -ly / llen
  const ny = lx / llen

  const rect = getLengthGuideTextRect(chosen.x, chosen.y, mainWidth, fontSize, unitWidth, gap, 'center')
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

export function getShapeAngleLabelPos(
  shape: Shape,
  index: number,
  textWidth: number,
  fontSize: number,
  options: ShapeAngleLabelLayoutOptions
): { x: number, y: number } {
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
    bx = -u1y
    by = u1x
    bm = Math.hypot(bx, by) || 1
  }
  bx /= bm
  by /= bm

  const isRightAngle = isRightAngleByThreePoints(triplet.prev, triplet.vertex, triplet.next)
  const halfW = textWidth * 0.5
  const halfH = fontSize * 0.62
  const halfExtentAlongBisector = Math.abs(bx) * halfW + Math.abs(by) * halfH

  let boundaryDist = options.arcRadius + (options.guideLineWidth * 0.5)
  if (isRightAngle) {
    const marker = getRightAngleGuideMarkerPoints(triplet.prev, triplet.vertex, triplet.next, options.rightAngleMarkerSize)
    const tCandidates: number[] = []
    const t1 = getRaySegmentIntersectionT(triplet.vertex.x, triplet.vertex.y, bx, by, marker.p1.x, marker.p1.y, marker.corner.x, marker.corner.y)
    const t2 = getRaySegmentIntersectionT(triplet.vertex.x, triplet.vertex.y, bx, by, marker.corner.x, marker.corner.y, marker.p2.x, marker.p2.y)
    if (t1 !== null) tCandidates.push(t1)
    if (t2 !== null) tCandidates.push(t2)
    boundaryDist = tCandidates.length > 0 ? Math.max(...tCandidates) : options.rightAngleMarkerSize * Math.SQRT2
  }

  let centerDist = boundaryDist + options.outerGapPx + halfExtentAlongBisector
  let nonRightAngleLiftPx = options.nonRightAngleBaselineLiftPx
  if (isRightAngle) {
    const markerDiag = options.rightAngleMarkerSize * Math.SQRT2
    const preferred = markerDiag * options.rightAngleDistMultiplier
    const minimum = boundaryDist + 2 + (halfExtentAlongBisector * 0.85)
    centerDist = Math.max(minimum, Math.min(centerDist, preferred))
  } else {
    const dot = Math.max(-1, Math.min(1, (u1x * u2x) + (u1y * u2y)))
    const angleDeg = (Math.acos(dot) * 180) / Math.PI
    const obtuseRatio = Math.max(0, Math.min(1, (angleDeg - options.obtuseAngleStartDeg) / (180 - options.obtuseAngleStartDeg)))
    const gapReduce = options.obtuseGapReduceMaxPx * obtuseRatio
    const liftReduce = options.obtuseLiftReduceMaxPx * obtuseRatio
    centerDist += Math.max(0, options.nonRightAngleExtraGapPx - gapReduce)
    nonRightAngleLiftPx = Math.max(0, options.nonRightAngleBaselineLiftPx - liftReduce)
  }

  let cx = triplet.vertex.x + bx * centerDist
  let cy = triplet.vertex.y + by * centerDist

  if (isRightAngle) {
    const sx = bx >= 0 ? 1 : -1
    const sy = by >= 0 ? 1 : -1
    cx += sx * (fontSize * options.rightAngleQuadrantXRatio)
    cy += fontSize * (options.rightAngleVerticalBaseRatio + (options.rightAngleVerticalQuadrantRatio * sy))
  } else {
    cy += (fontSize * options.baselineCompensationRatio) - nonRightAngleLiftPx
  }

  const getRect = (): LayoutRect => ({
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
      const d = distancePointToSegmentXY(cx, cy, edge.a.x, edge.a.y, edge.b.x, edge.b.y)
      minDist = Math.min(minDist, d)
    }
    if (!hasIntersect && minDist >= Math.max(halfH * 0.35, options.edgePaddingPx)) break
  }

  return { x: cx, y: cy }
}

export function getShapeLengthLabelPos(
  shape: Shape,
  index: number,
  mainWidth: number,
  fontSize: number,
  unitWidth: number,
  gap: number,
  centroid: { x: number, y: number },
  curveSide: 1 | -1 | undefined,
  heightGuide: { foot: Point } | null,
  baseLabelVerticalBiasPx: number
): { x: number, y: number } {
  const p1 = shape.points[index]
  const p2 = shape.points[(index + 1) % shape.points.length]
  if (!p1 || !p2) return { x: 0, y: 0 }

  const anchor = getDimensionAnchorForText(
    shape,
    index,
    p1,
    p2,
    mainWidth,
    fontSize,
    unitWidth,
    gap,
    centroid,
    curveSide
  )

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const isHorizontalBase = Math.abs(dy) <= Math.max(1, Math.abs(dx) * 0.18)
  if (!isHorizontalBase || !heightGuide) return anchor

  const rect = getLengthGuideTextRect(anchor.x, anchor.y, mainWidth, fontSize, unitWidth, gap, 'center')
  if (!isPointInRect(heightGuide.foot.x, heightGuide.foot.y, rect)) return anchor
  return { x: anchor.x, y: anchor.y + baseLabelVerticalBiasPx }
}

export function getCircleLengthLabelPos(
  shape: Shape,
  p1: Point,
  p2: Point,
  mainWidth: number,
  fontSize: number,
  unitWidth: number,
  gap: number,
  avoidPoint: Point,
  curveSide?: 1 | -1
): { x: number, y: number } {
  return getDimensionAnchorForText(
    shape,
    0,
    p1,
    p2,
    mainWidth,
    fontSize,
    unitWidth,
    gap,
    avoidPoint,
    curveSide
  )
}
