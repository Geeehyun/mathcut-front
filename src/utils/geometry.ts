import type { Point } from '@/types'
import { GRID_CONFIG } from '@/types'

// 소격자 분할 수 (각 칸을 4분할 → 5px 간격)
export const SUB_GRID_DIVISIONS = 4

/**
 * 클릭 좌표를 소격자점으로 스냅 (대상 위의 점 등에 사용)
 */
export function snapToSubGrid(x: number, y: number): Point {
  const subSize = GRID_CONFIG.size / SUB_GRID_DIVISIONS
  const snapX = Math.round(x / subSize) * subSize
  const snapY = Math.round(y / subSize) * subSize
  return {
    x: snapX,
    y: snapY,
    gridX: snapX / GRID_CONFIG.size,
    gridY: snapY / GRID_CONFIG.size
  }
}

/**
 * 클릭 좌표를 가장 가까운 격자점으로 스냅
 */
export function snapToGrid(x: number, y: number): Point {
  const gridX = Math.round(x / GRID_CONFIG.size)
  const gridY = Math.round(y / GRID_CONFIG.size)

  return {
    x: gridX * GRID_CONFIG.size,
    y: gridY * GRID_CONFIG.size,
    gridX,
    gridY
  }
}

/**
 * 두 점 사이 거리 계산 (격자 단위)
 */
export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy) / GRID_CONFIG.size
}

/**
 * 두 점 사이 거리 계산 (픽셀)
 */
export function calculateDistancePixels(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 직각인 꼭지점 인덱스 찾기
 */
export function findRightAngles(points: Point[]): number[] {
  const rightAngles: number[] = []

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length]
    const current = points[i]
    const next = points[(i + 1) % points.length]

    // 벡터 계산
    const v1x = prev.x - current.x
    const v1y = prev.y - current.y
    const v2x = next.x - current.x
    const v2y = next.y - current.y

    // 내적 계산 (수직이면 0)
    const dotProduct = v1x * v2x + v1y * v2y

    // 오차 허용
    if (Math.abs(dotProduct) < 1) {
      rightAngles.push(i)
    }
  }

  return rightAngles
}

/**
 * 삼각형 종류 판별
 */
export function getTriangleType(points: Point[]): string {
  if (points.length !== 3) return ''

  const distances: number[] = []
  for (let i = 0; i < 3; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % 3]
    distances.push(calculateDistance(p1, p2))
  }
  distances.sort((a, b) => a - b)

  const [a, b, c] = distances
  const aSq = a * a
  const bSq = b * b
  const cSq = c * c

  // 피타고라스 정리로 각도 판별
  const diff = Math.abs(aSq + bSq - cSq)

  if (diff < 0.1) {
    return '직각삼각형'
  } else if (aSq + bSq > cSq) {
    return '예각삼각형'
  } else {
    return '둔각삼각형'
  }
}

/**
 * 직각 마커 좌표 계산
 */
export function getRightAngleMarkerPoints(
  points: Point[],
  angleIndex: number,
  markerSize: number = 10
): { p1: { x: number, y: number }, corner: { x: number, y: number }, p2: { x: number, y: number } } {
  const prev = points[(angleIndex - 1 + points.length) % points.length]
  const current = points[angleIndex]
  const next = points[(angleIndex + 1) % points.length]

  // 단위 벡터 계산
  const v1x = prev.x - current.x
  const v1y = prev.y - current.y
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y)
  const u1x = v1x / len1
  const u1y = v1y / len1

  const v2x = next.x - current.x
  const v2y = next.y - current.y
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y)
  const u2x = v2x / len2
  const u2y = v2y / len2

  return {
    p1: {
      x: current.x + u1x * markerSize,
      y: current.y + u1y * markerSize
    },
    corner: {
      x: current.x + u1x * markerSize + u2x * markerSize,
      y: current.y + u1y * markerSize + u2y * markerSize
    },
    p2: {
      x: current.x + u2x * markerSize,
      y: current.y + u2y * markerSize
    }
  }
}

/**
 * 고유 ID 생성
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

/**
 * 두 점이 같은 격자점인지 확인
 */
export function isSameGridPoint(p1: Point, p2: Point): boolean {
  return p1.gridX === p2.gridX && p1.gridY === p2.gridY
}

/**
 * 점-점 거리(픽셀)
 */
export function distanceBetweenPoints(
  p1: { x: number, y: number },
  p2: { x: number, y: number }
): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 점-선분 최소 거리(픽셀)
 */
export function distancePointToSegment(
  point: { x: number, y: number },
  a: { x: number, y: number },
  b: { x: number, y: number }
): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = point.x - a.x
  const apy = point.y - a.y
  const abLenSq = abx * abx + aby * aby

  if (abLenSq === 0) {
    return distanceBetweenPoints(point, a)
  }

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq))
  const projX = a.x + abx * t
  const projY = a.y + aby * t
  return distanceBetweenPoints(point, { x: projX, y: projY })
}

/**
 * 점이 다각형 내부에 있는지 확인 (Ray Casting)
 */
export function isPointInPolygon(
  point: { x: number, y: number },
  polygon: { x: number, y: number }[]
): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 1e-9) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * 길이 가이드 곡선의 고정 곡률 오프셋(px)
 */
export const LENGTH_GUIDE_CURVATURE = 28

/**
 * 선택된 변과 기준점으로 길이 가이드의 제어점 계산
 */
export function getLengthGuideControlPoint(
  p1: { x: number, y: number },
  p2: { x: number, y: number },
  bendRef: { x: number, y: number },
  curvature: number = LENGTH_GUIDE_CURVATURE
): { x: number, y: number } {
  const midX = (p1.x + p2.x) / 2
  const midY = (p1.y + p2.y) / 2
  const edgeX = p2.x - p1.x
  const edgeY = p2.y - p1.y
  const len = Math.sqrt(edgeX * edgeX + edgeY * edgeY)

  if (len === 0) return { x: midX, y: midY }

  const nx = -edgeY / len
  const ny = edgeX / len
  const refX = bendRef.x - midX
  const refY = bendRef.y - midY
  const side = refX * nx + refY * ny >= 0 ? 1 : -1

  return {
    x: midX + nx * curvature * side,
    y: midY + ny * curvature * side
  }
}

/**
 * 2차 베지어를 Konva polyline 포인트 배열로 샘플링
 */
export function createQuadraticCurvePoints(
  p0: { x: number, y: number },
  cp: { x: number, y: number },
  p2: { x: number, y: number },
  segments: number = 24
): number[] {
  const points: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const mt = 1 - t
    const x = mt * mt * p0.x + 2 * mt * t * cp.x + t * t * p2.x
    const y = mt * mt * p0.y + 2 * mt * t * cp.y + t * t * p2.y
    points.push(x, y)
  }
  return points
}

/**
 * 점-폴리라인 최소 거리(픽셀)
 */
export function distancePointToPolyline(
  point: { x: number, y: number },
  polylinePoints: number[]
): number {
  if (polylinePoints.length < 4) return Infinity
  let best = Infinity
  for (let i = 0; i < polylinePoints.length - 2; i += 2) {
    const a = { x: polylinePoints[i], y: polylinePoints[i + 1] }
    const b = { x: polylinePoints[i + 2], y: polylinePoints[i + 3] }
    const d = distancePointToSegment(point, a, b)
    if (d < best) best = d
  }
  return best
}

// ─── 특수 도형 기하학 계산 함수 ──────────────────────────────────────────────

/**
 * 픽셀 좌표로 Point 생성 헬퍼
 */
function makePoint(x: number, y: number): Point {
  return { x, y, gridX: x / GRID_CONFIG.size, gridY: y / GRID_CONFIG.size }
}

/**
 * 정삼각형: 밑변 두 점 → 세 번째 꼭짓점 계산 (위쪽 방향)
 */
export function computeEquilateralTriangle(p1: Point, p2: Point): Point {
  const mx = (p1.x + p2.x) / 2
  const my = (p1.y + p2.y) / 2
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  // 밑변 수직 방향으로 높이(= √3/2 * 밑변 길이) 이동
  const h = Math.sqrt(3) / 2
  return makePoint(mx - dy * h, my + dx * h)
}

/**
 * 이등변삼각형: 밑변 두 점 + 꼭짓점 힌트 점 → 보정된 꼭짓점 계산
 * 꼭짓점은 밑변의 수직이등분선 위에 놓이도록 투영한다.
 */
export function computeIsoscelesApex(p1: Point, p2: Point, apexHint: Point): Point {
  const mx = (p1.x + p2.x) / 2
  const my = (p1.y + p2.y) / 2
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.sqrt(dx * dx + dy * dy)

  if (len === 0) return makePoint(apexHint.x, apexHint.y)

  // 밑변 수직 단위벡터
  const nx = -dy / len
  const ny = dx / len

  // 힌트 점을 수직이등분선 방향으로 투영
  const vx = apexHint.x - mx
  const vy = apexHint.y - my
  const t = vx * nx + vy * ny

  return makePoint(mx + nx * t, my + ny * t)
}

/**
 * 직각삼각형: 밑변 두 점 p1, p2 + 힌트점 -> p2를 직각 꼭짓점으로 하는 3번째 점 계산
 * 힌트점을 p2를 지나는 밑변 수직선으로 투영해 "높이"를 결정한다.
 */
export function computeRightTriangleThirdPoint(p1: Point, p2: Point, hint: Point): Point {
  const bx = p2.x - p1.x
  const by = p2.y - p1.y
  const len = Math.sqrt(bx * bx + by * by)
  if (len === 0) return makePoint(hint.x, hint.y)

  // 밑변 수직 단위벡터
  const nx = -by / len
  const ny = bx / len

  // 힌트점을 p2 기준 수직축으로 투영 -> 높이 결정
  const hx = hint.x - p2.x
  const hy = hint.y - p2.y
  const h = hx * nx + hy * ny

  return makePoint(p2.x + nx * h, p2.y + ny * h)
}

/**
 * 정사각형: 한 변의 두 점 → 나머지 두 꼭짓점 계산 (반시계 방향)
 * 반환: [p3, p4] — p1-p2-p3-p4 순서
 */
export function computeSquare(p1: Point, p2: Point): [Point, Point] {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return [
    makePoint(p2.x - dy, p2.y + dx),
    makePoint(p1.x - dy, p1.y + dx)
  ]
}

/**
 * 직사각형: 대각선 두 점 → 나머지 두 꼭짓점 계산
 * 반환: [p1, p2, p3, p4] 순서 (시계 방향)
 */
export function computeRectangle(p1: Point, p2: Point): [Point, Point, Point, Point] {
  return [
    p1,
    makePoint(p2.x, p1.y),
    p2,
    makePoint(p1.x, p2.y)
  ]
}

/**
 * 마름모: 대각선 두 점 → 나머지 두 꼭짓점 계산
 * p1, p2를 대각선 양 끝으로 보고 수직 대각선의 두 점 반환
 * 반환: [p1, right, p2, left] 순서
 */
export function computeRhombus(p1: Point, p2: Point): [Point, Point, Point, Point] {
  const mx = (p1.x + p2.x) / 2
  const my = (p1.y + p2.y) / 2
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return [
    p1,
    makePoint(mx + dy / 2, my - dx / 2),
    p2,
    makePoint(mx - dy / 2, my + dx / 2)
  ]
}

/**
 * 평행사변형: 3점 → 4번째 꼭짓점 계산
 * p1-p2가 밑변, p3는 왼쪽 위 꼭짓점 → p4 = p3 + (p2 - p1)
 */
export function computeParallelogram(p1: Point, p2: Point, p3: Point): Point {
  return makePoint(p3.x + (p2.x - p1.x), p3.y + (p2.y - p1.y))
}

/**
 * 사다리꼴(이등변 기준): 3점 → 4번째 꼭짓점 계산
 * p1-p2를 밑변으로 두고, p3를 윗변의 한 꼭짓점으로 사용한다.
 * p3를 밑변 축으로 분해한 뒤, 축 좌표를 밑변 중앙 기준 대칭시켜 p4를 만든다.
 * 반환: [p1, p2, p4, p3] (시계 방향)
 */
export function computeTrapezoidFromThreePoints(p1: Point, p2: Point, p3: Point): [Point, Point, Point, Point] {
  const bx = p2.x - p1.x
  const by = p2.y - p1.y
  const len = Math.hypot(bx, by)
  if (len < 1e-6) {
    return [p1, p2, p3, p3]
  }

  const ux = bx / len
  const uy = by / len
  const nx = -uy
  const ny = ux

  const vx = p3.x - p1.x
  const vy = p3.y - p1.y
  const t = vx * ux + vy * uy
  const h = vx * nx + vy * ny

  const tMirror = len - t
  const p4 = makePoint(
    p1.x + ux * tMirror + nx * h,
    p1.y + uy * tMirror + ny * h
  )

  return [p1, p2, p4, p3]
}

/**
 * 정다각형: 중심점 + 한 꼭짓점 → 전체 꼭짓점 배열
 */
export function computeRegularPolygon(center: Point, vertex: Point, n: number): Point[] {
  const r = calculateDistancePixels(center, vertex)
  const startAngle = Math.atan2(vertex.y - center.y, vertex.x - center.x)
  const points: Point[] = []
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (2 * Math.PI * i) / n
    points.push(makePoint(
      center.x + r * Math.cos(angle),
      center.y + r * Math.sin(angle)
    ))
  }
  return points
}

/**
 * 3점 각이 직각인지 판별
 */
export function isRightAngleByThreePoints(
  p1: { x: number, y: number },
  vertex: { x: number, y: number },
  p2: { x: number, y: number },
  tolerance: number = 1
): boolean {
  const v1x = p1.x - vertex.x
  const v1y = p1.y - vertex.y
  const v2x = p2.x - vertex.x
  const v2y = p2.y - vertex.y
  const dot = v1x * v2x + v1y * v2y
  return Math.abs(dot) < tolerance
}

/**
 * 각도 가이드용 직각 마커 좌표
 */
export function getRightAngleGuideMarkerPoints(
  p1: { x: number, y: number },
  vertex: { x: number, y: number },
  p2: { x: number, y: number },
  markerSize: number = 12
): { p1: { x: number, y: number }, corner: { x: number, y: number }, p2: { x: number, y: number } } {
  const v1x = p1.x - vertex.x
  const v1y = p1.y - vertex.y
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y)
  const u1x = len1 === 0 ? 0 : v1x / len1
  const u1y = len1 === 0 ? 0 : v1y / len1

  const v2x = p2.x - vertex.x
  const v2y = p2.y - vertex.y
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y)
  const u2x = len2 === 0 ? 0 : v2x / len2
  const u2y = len2 === 0 ? 0 : v2y / len2

  return {
    p1: { x: vertex.x + u1x * markerSize, y: vertex.y + u1y * markerSize },
    corner: { x: vertex.x + (u1x + u2x) * markerSize, y: vertex.y + (u1y + u2y) * markerSize },
    p2: { x: vertex.x + u2x * markerSize, y: vertex.y + u2y * markerSize }
  }
}
