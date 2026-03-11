import { ref } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useToolStore } from '@/stores/tool'
import type {
  Guide,
  Point,
  Shape,
  ShapeGuideItemStyle,
  ShapeGuideStyleMap,
  ShapeGuideVisibility,
  ShapeType,
} from '@/types'
import { GRID_CONFIG } from '@/types'
import {
  computeEquilateralTriangle,
  computeIsoscelesApex,
  computeSquare,
  computeRectangle,
  computeAngleDegrees,
  formatRoundedValue,
  distanceBetweenPoints,
  distancePointToSegment,
  generateId,
} from '@/utils/geometry'
import { FILL_NONE, FILL_PALETTE, MAGENTA_100_HEX, STROKE_PALETTE } from '@/constants/colorPalette'
import { buildShapeExample } from '@/constants/aiSketchExamples'

type TextDirection = 'above' | 'below' | 'left' | 'right' | 'auto'
type TextMode = 'normal' | 'blank'
// AI 응답 전용: 'auto'는 앱이 좌표 기반으로 각도를 계산해서 'normal'로 변환됨
type AITextMode = TextMode | 'auto'

type AIShapeItem = {
  textMode?: AITextMode | null
  textDirection?: TextDirection | null
  text?: string | null
  visible?: boolean | null
  curveSide?: 1 | -1 | null
  detached?: boolean | null
}

type AIShapeInput = {
  type?: string
  points?: Array<{ gridX?: number, gridY?: number }>
  pointLabels?: unknown
  guideVisibility?: Partial<ShapeGuideVisibility> | null
  circleMeasureMode?: 'radius' | 'diameter' | null
  lengthItems?: AIShapeItem[] | null
  angleItems?: AIShapeItem[] | null
  heightItem?: AIShapeItem | null
  showUnit?: boolean
}

type AIGuideInput = {
  type?: string
  text?: string
  position?: { gridX?: number, gridY?: number } | null
  rotation?: number
  useLatex?: boolean
}

type AISketchResponse = {
  shapes?: AIShapeInput[]
  guides?: AIGuideInput[]
}

type AnalyzeResult = {
  shapes: Shape[]
  guides: Guide[]
  meta: {
    showGuideUnit: boolean
  }
}

type AISketchDebugState = {
  systemPrompt: string
  userInstruction: string
  rawResponseText: string | null
  parsedResponse: AISketchResponse | null
}

type AnalyzeOptions = {
  forcedShapeType: ShapeType
  userHint?: string
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

const SUPPORTED_SHAPE_TYPES = new Set<ShapeType>([
  'rectangle',
  'triangle',
  'circle',
  'polygon',
  'point',
  'segment',
  'ray',
  'line',
  'angle-line',
  'triangle-equilateral',
  'triangle-right',
  'triangle-isosceles',
  'rect-square',
  'rect-rectangle',
  'rect-trapezoid',
  'rect-rhombus',
  'rect-parallelogram',
  'free-shape',
  'arrow',
  'arrow-curve',
])

const BASE_PROMPT = `You convert a hand-drawn math diagram into strict JSON.
Return JSON only. Do not add explanation, prose, or markdown.

The whole image uses a 64 by 36 grid.
All coordinates must be integers:
- gridX: 0 to 64
- gridY: 0 to 36

Allowed shape types:
- triangle, triangle-right, triangle-equilateral, triangle-isosceles
- rect-square, rect-rectangle, rect-rhombus, rect-parallelogram, rect-trapezoid
- circle, polygon, polygon-regular, free-shape
- point, segment, line, ray, angle-line, arrow, arrow-curve

Return format (key structure only — the actual shape type and values come from the image):
{
  "shapes": [
    {
      "type": "<shape type string>",
      "points": [{"gridX": <int>, "gridY": <int>}, ...],
      "pointLabels": null | ["A", "B", ...],
      "guideVisibility": {"pointName": bool, "point": bool, "length": bool, "angle": bool, "height": bool, "radius": bool},
      "circleMeasureMode": null | "radius" | "diameter",
      "lengthItems": null | [{"visible": bool, "textMode": "normal"|"blank", "textDirection": "above"|"below"|"left"|"right"|"auto", "text": "...", "curveSide": 1|-1}],
      "angleItems": null | [{"visible": bool, "textMode": "normal"|"blank", "textDirection": "...", "text": "...", "detached": bool}],
      "heightItem": null | {"textMode": "normal"|"blank", "textDirection": "..."},
      "showUnit": bool
    }
  ],
  "guides": [
    {"type": "text", "text": "...", "position": {"gridX": <int>, "gridY": <int>}, "rotation": 0, "useLatex": false}
  ]
}

Rules:
- Return JSON only.
- If nothing is recognized, return {"shapes":[],"guides":[]}.
- circle uses points[0] = center and points[1] = edge.
- point uses 1 point.
- segment, line, ray, arrow, arrow-curve use 2 points.
- angle-line uses 3 points.
- polygon and free-shape use 3 or more points.
- polygon-regular may be returned as polygon if needed.
- Vertex labels such as A, B, C or ㄱ, ㄴ, ㄷ must go into pointLabels, not guides.
- Side length text such as 3cm or 6 cm must be treated as side length annotations, not free text guides.
- Angle text such as 30° or 45° must be treated as angle annotations, not free text guides.
- lengthItems[index].text may contain the exact user-facing side text for that edge.
- angleItems[index].text may contain the exact user-facing angle text for that vertex.
- lengthItems[index].visible or angleItems[index].visible can be false when that item should stay hidden.
- lengthItems[index].textMode can be "blank" when the edge should render as an answer blank.
- lengthItems[index].curveSide can be 1 or -1 to choose the curve direction.
- guideVisibility.point controls whether a small filled dot is drawn at each vertex. Set point: true when the image shows a visible dot or mark at a vertex or center. Set point: false when no dot is drawn.
- For circle: if the image shows a dot at the center, or the user mentions 중점/중심/center point, set guideVisibility.point: true. If the center is visibly marked but the label character is unclear or ambiguous, use "ㅇ" as the default center label (pointLabels[0] = "ㅇ"). Only omit the label if it is clearly absent in both the image and the user hint.
- angleItems[index].detached can be true when the angle blank must appear OUTSIDE the shape (pointed to by a curved arrow). When detached, also set visible:true so the angle arc still renders at the vertex. Include a companion arrow-curve shape pointing from the vertex outward. The blank-box is placed at the arrow-curve endpoint.
- If the angle blank should appear inline (at the vertex itself), use textMode:"blank", visible:true, no detached.
- For triangle-right: always set the hypotenuse (longest side) to visible: false. Place measurements only on the two legs. Do not assign text to lengthItems at the hypotenuse position.
- shapes[0] is the main forced shape. Additional auxiliary shapes such as arrow or arrow-curve may appear in later entries.
- guides[] should only contain text that is truly separate from the main shape semantics.`


function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return String(error)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeTextMode(value: unknown): TextMode {
  // 'auto'는 resolveAutoAngleItems에서 'normal'로 이미 변환됨. 혹시 남은 경우도 'normal'로 처리.
  return value === 'blank' ? 'blank' : 'normal'
}

function normalizeTextDirection(value: unknown): TextDirection {
  if (value === 'above' || value === 'below' || value === 'left' || value === 'right') return value
  return 'auto'
}

function textDirectionToOffset(direction: TextDirection): Pick<ShapeGuideItemStyle, 'offsetX' | 'offsetY'> {
  const delta = GRID_CONFIG.size * 1.5
  if (direction === 'above') return { offsetX: 0, offsetY: -delta }
  if (direction === 'below') return { offsetX: 0, offsetY: delta }
  if (direction === 'left') return { offsetX: -delta, offsetY: 0 }
  if (direction === 'right') return { offsetX: delta, offsetY: 0 }
  return { offsetX: 0, offsetY: 0 }
}

function normalizePoint(input: { gridX?: number, gridY?: number } | null | undefined): Point | null {
  if (!input) return null
  if (typeof input.gridX !== 'number' || typeof input.gridY !== 'number') return null
  const gridX = clamp(Math.round(input.gridX), 0, GRID_CONFIG.width)
  const gridY = clamp(Math.round(input.gridY), 0, GRID_CONFIG.height)
  return {
    x: gridX * GRID_CONFIG.size,
    y: gridY * GRID_CONFIG.size,
    gridX,
    gridY,
  }
}

function makePoint(x: number, y: number): Point {
  const gridX = clamp(Math.round(x / GRID_CONFIG.size), 0, GRID_CONFIG.width)
  const gridY = clamp(Math.round(y / GRID_CONFIG.size), 0, GRID_CONFIG.height)
  return {
    x: gridX * GRID_CONFIG.size,
    y: gridY * GRID_CONFIG.size,
    gridX,
    gridY,
  }
}

/**
 * AI 스케치 좌표 보정 전용: 그리드 정수로 반올림하지 않아 정확한 cm 스케일을 유지합니다.
 * legs=6, base=4 이등변삼각형처럼 높이가 무리수(√32≈5.657)인 경우에도 정확한 거리를 보장합니다.
 * 렌더링은 x/y 픽셀값을 사용하므로 소수점 그리드 좌표도 정상 표시됩니다.
 */
function makeExactPoint(x: number, y: number): Point {
  const px = clamp(x, 0, GRID_CONFIG.width * GRID_CONFIG.size)
  const py = clamp(y, 0, GRID_CONFIG.height * GRID_CONFIG.size)
  return { x: px, y: py, gridX: px / GRID_CONFIG.size, gridY: py / GRID_CONFIG.size }
}

function chooseClosestPoint(reference: Point | undefined, candidates: Point[]): Point {
  if (!reference || candidates.length === 0) return candidates[0]
  let best = candidates[0]
  let bestDistance = distanceBetweenPoints(reference, best)
  for (const candidate of candidates.slice(1)) {
    const distance = distanceBetweenPoints(reference, candidate)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

function getRequiredPointCount(type: ShapeType): number {
  if (type === 'point') return 1
  if (type === 'circle') return 2
  if (type === 'segment' || type === 'line' || type === 'ray' || type === 'arrow' || type === 'arrow-curve') return 2
  if (type === 'angle-line') return 3
  if (type === 'triangle' || type === 'triangle-right' || type === 'triangle-equilateral' || type === 'triangle-isosceles') return 3
  if (
    type === 'rect-square'
    || type === 'rect-rectangle'
    || type === 'rect-rhombus'
    || type === 'rect-parallelogram'
    || type === 'rect-trapezoid'
    || type === 'rectangle'
  ) return 4
  return 3
}

function isOpenOrPoint(type: ShapeType): boolean {
  return type === 'point'
    || type === 'segment'
    || type === 'line'
    || type === 'ray'
    || type === 'angle-line'
    || type === 'arrow'
    || type === 'arrow-curve'
}

function isFilledShape(type: ShapeType): boolean {
  return !isOpenOrPoint(type)
}

function sanitizeShapeType(input: string | undefined): ShapeType | null {
  if (!input) return null
  const normalized = input === 'polygon-regular' ? 'polygon' : input
  return SUPPORTED_SHAPE_TYPES.has(normalized as ShapeType) ? normalized as ShapeType : null
}

function sanitizePointLabels(value: unknown, maxLength: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const labels = value
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)
    .slice(0, maxLength)
  return labels.length > 0 ? labels : undefined
}

function sanitizeGuideVisibility(value: Partial<ShapeGuideVisibility> | null | undefined): ShapeGuideVisibility | undefined {
  if (!value || typeof value !== 'object') return undefined
  const next: ShapeGuideVisibility = {}
  if (typeof value.pointName === 'boolean') next.pointName = value.pointName
  if (typeof value.point === 'boolean') next.point = value.point
  if (typeof value.length === 'boolean') next.length = value.length
  if (typeof value.angle === 'boolean') next.angle = value.angle
  if (typeof value.height === 'boolean') next.height = value.height
  if (typeof value.radius === 'boolean') next.radius = value.radius
  return Object.keys(next).length > 0 ? next : undefined
}

function normalizeCurveSide(value: unknown): 1 | -1 | undefined {
  return value === -1 ? -1 : value === 1 ? 1 : undefined
}

function getLengthItemCount(type: ShapeType, pointCount: number): number {
  if (type === 'circle') return 1
  if (type === 'segment' || type === 'line' || type === 'ray') return pointCount >= 2 ? 1 : 0
  if (type === 'arrow' || type === 'arrow-curve' || type === 'angle-line' || type === 'point') return 0
  return pointCount
}

function getAngleItemCount(type: ShapeType, pointCount: number): number {
  if (type === 'circle' || type === 'segment' || type === 'line' || type === 'ray' || type === 'arrow' || type === 'arrow-curve' || type === 'point') return 0
  if (type === 'angle-line') return pointCount >= 3 ? 1 : 0
  return pointCount >= 3 ? pointCount : 0
}

function buildGuideStyleMap(shape: AIShapeInput): ShapeGuideStyleMap | undefined {
  const map: ShapeGuideStyleMap = {}

  if (Array.isArray(shape.lengthItems) && shape.lengthItems.length > 0) {
    map.length = {}
    shape.lengthItems.forEach((item, index) => {
      map.length![index] = {
        textMode: normalizeTextMode(item?.textMode),
        customText: sanitizeMeasurementText(item?.text),
        curveSide: normalizeCurveSide(item?.curveSide),
        detached: item?.detached === true,
        ...textDirectionToOffset(normalizeTextDirection(item?.textDirection)),
      }
    })
  }

  if (Array.isArray(shape.angleItems) && shape.angleItems.length > 0) {
    map.angle = {}
    shape.angleItems.forEach((item, index) => {
      map.angle![index] = {
        textMode: normalizeTextMode(item?.textMode),
        customText: sanitizeMeasurementText(item?.text),
        detached: item?.detached === true,
        ...textDirectionToOffset(normalizeTextDirection(item?.textDirection)),
      }
    })
  }

  if (shape.heightItem) {
    map.height = {
      0: {
        textMode: normalizeTextMode(shape.heightItem.textMode),
        ...textDirectionToOffset(normalizeTextDirection(shape.heightItem.textDirection)),
      },
    }
  }

  return Object.keys(map).length > 0 ? map : undefined
}

function buildAIShapeGuideVisibility(
  type: ShapeType,
  pointCount: number,
  value: Partial<ShapeGuideVisibility> | null | undefined,
  lengthItems: AIShapeItem[] | null | undefined,
  angleItems: AIShapeItem[] | null | undefined
): ShapeGuideVisibility | undefined {
  const next = sanitizeGuideVisibility(value) || {}
  const lengthCount = getLengthItemCount(type, pointCount)
  const angleCount = getAngleItemCount(type, pointCount)

  if (Array.isArray(lengthItems) && lengthCount > 0) {
    const hidden = new Set<number>()
    for (let index = 0; index < lengthCount; index++) {
      const item = lengthItems[index]
      if (item?.visible === false) hidden.add(index)
    }
    if (hidden.size > 0) {
      next.length = true
      next.lengthHiddenIndices = Array.from(hidden).sort((a, b) => a - b)
    }
  }

  if (Array.isArray(angleItems) && angleCount > 0) {
    const hidden = new Set<number>()
    for (let index = 0; index < angleCount; index++) {
      const item = angleItems[index]
      if (item?.visible === false) hidden.add(index)
    }
    if (hidden.size > 0) {
      next.angle = true
      next.angleHiddenIndices = Array.from(hidden).sort((a, b) => a - b)
    }
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function coerceForcedShapePoints(type: ShapeType, rawPoints: Point[]): Point[] {
  if (rawPoints.length === 0) return rawPoints

  if (type === 'triangle-equilateral' && rawPoints.length >= 2) {
    const p1 = rawPoints[0]
    const p2 = rawPoints[1]
    const candidate = computeEquilateralTriangle(p1, p2)
    const mirrored = makePoint((p1.x + p2.x) - candidate.x, (p1.y + p2.y) - candidate.y)
    const third = chooseClosestPoint(rawPoints[2], [candidate, mirrored])
    return [p1, p2, third]
  }

  if (type === 'triangle-right' && rawPoints.length >= 3) {
    return rawPoints
  }

  if (type === 'triangle-isosceles' && rawPoints.length >= 3) {
    return [rawPoints[0], rawPoints[1], computeIsoscelesApex(rawPoints[0], rawPoints[1], rawPoints[2])]
  }

  if (type === 'rect-square' && rawPoints.length >= 2) {
    const p1 = rawPoints[0]
    const p2 = rawPoints[1]
    const [p3a, p4a] = computeSquare(p1, p2)
    const p3b = makePoint(p2.x + (p1.y - p2.y), p2.y + (p2.x - p1.x))
    const p4b = makePoint(p1.x + (p1.y - p2.y), p1.y + (p2.x - p1.x))
    const aiThird = rawPoints[2]
    const useAlt = aiThird
      ? distanceBetweenPoints(aiThird, p3b) + distanceBetweenPoints(rawPoints[3] ?? aiThird, p4b)
        < distanceBetweenPoints(aiThird, p3a) + distanceBetweenPoints(rawPoints[3] ?? aiThird, p4a)
      : false
    return useAlt ? [p1, p2, p3b, p4b] : [p1, p2, p3a, p4a]
  }

  if (type === 'rect-rectangle' && rawPoints.length >= 2) {
    const minX = Math.min(...rawPoints.map((point) => point.x))
    const maxX = Math.max(...rawPoints.map((point) => point.x))
    const minY = Math.min(...rawPoints.map((point) => point.y))
    const maxY = Math.max(...rawPoints.map((point) => point.y))
    return computeRectangle(makePoint(minX, minY), makePoint(maxX, maxY))
  }

  return rawPoints
}

// 손글씨 OCR 오인식 교정 맵: 숫자처럼 생긴 알파벳 → 숫자
const OCR_DIGIT_MAP: Record<string, string> = {
  b: '6', B: '8', l: '1', I: '1', O: '0', o: '0',
  S: '5', s: '5', g: '9', Z: '2', z: '2',
}

/**
 * cm/mm/°/도 단위가 붙은 텍스트에서 단위 앞이 알파벳만으로 이루어진 경우
 * OCR 오인식으로 판단해 숫자로 교정.
 * 예: "bcm" → "6cm", "lcm" → "1cm", "B0°" → "80°"
 * 단위 없는 텍스트나 유효한 수식은 그대로 반환.
 */
function sanitizeMeasurementText(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const text = raw.trim()
  if (!text) return undefined

  const match = text.match(/^(.*?)\s*(cm|mm|m|°|도)\s*$/i)
  if (!match) return text // 단위 없으면 그대로

  const numPart = match[1].trim()
  const unit = match[2]

  // 이미 유효한 수식(숫자, 연산자, 소수점, 괄호 포함)이면 그대로
  if (/^[\d\s.+\-×÷*/()]+$/.test(numPart)) return text

  // 숫자 없이 알파벳으로만 이루어진 경우 → OCR 교정 시도
  if (/^[a-zA-Z]+$/.test(numPart)) {
    const corrected = numPart.split('').map((ch) => OCR_DIGIT_MAP[ch] ?? ch).join('')
    if (/^[\d.]+$/.test(corrected)) {
      return `${corrected}${unit}`
    }
  }

  return text
}

function parseMeasurementValue(text: string | null | undefined): number | null {
  if (!text) return null
  const sanitized = sanitizeMeasurementText(text) ?? text
  const numeric = Number(sanitized.replace(/cm/gi, '').replace(/°/g, '').replace(/도/g, '').trim())
  return Number.isFinite(numeric) ? numeric : null
}

function applyAnnotatedTriangleRightLengths(points: Point[], shape: AIShapeInput): Point[] {
  if (points.length < 3) return points
  if (!Array.isArray(shape.lengthItems) || !Array.isArray(shape.angleItems)) return points

  const rightAngleIndex = shape.angleItems.findIndex((item) => parseMeasurementValue(item?.text) === 90)
  if (rightAngleIndex < 0) return points

  const prevIndex = (rightAngleIndex - 1 + points.length) % points.length
  const nextIndex = (rightAngleIndex + 1) % points.length
  const edgeBeforeIndex = prevIndex
  const edgeAfterIndex = rightAngleIndex
  const prevLeg = parseMeasurementValue(shape.lengthItems[edgeBeforeIndex]?.text)
  const nextLeg = parseMeasurementValue(shape.lengthItems[edgeAfterIndex]?.text)

  const numericLegCount = [prevLeg, nextLeg].filter((value) => value !== null).length
  if (numericLegCount < 2) return points

  const vertex = points[rightAngleIndex]
  const prev = points[prevIndex]
  const next = points[nextIndex]
  const prevVector = { x: prev.x - vertex.x, y: prev.y - vertex.y }
  const nextVector = { x: next.x - vertex.x, y: next.y - vertex.y }
  const prevLen = Math.hypot(prevVector.x, prevVector.y) || 1
  const nextLen = Math.hypot(nextVector.x, nextVector.y) || 1
  const prevScale = prevLeg ? (prevLeg * GRID_CONFIG.size) / prevLen : 1
  const nextScale = nextLeg ? (nextLeg * GRID_CONFIG.size) / nextLen : 1

  const nextPoints = [...points]
  nextPoints[prevIndex] = makePoint(
    vertex.x + prevVector.x * prevScale,
    vertex.y + prevVector.y * prevScale
  )
  nextPoints[nextIndex] = makePoint(
    vertex.x + nextVector.x * nextScale,
    vertex.y + nextVector.y * nextScale
  )
  return nextPoints
}

/**
 * 삼각형(triangle, isosceles, equilateral 등) 꼭짓점 좌표를 SSS 구성법으로 보정합니다.
 *
 * 원리: AI가 반환한 좌표는 비율은 맞지만 스케일이 틀린 경우가 대부분입니다.
 * - p0을 기준점(고정)으로, p1은 a(길이), p2는 c(길이)만큼 배치합니다.
 * - b를 알면 코사인 법칙으로 p0에서의 각도를 산출해 p2 방향을 정확히 결정합니다.
 * - 보정 후 무게중심을 원래 위치로 복원해 도형이 그리드에서 벗어나지 않게 합니다.
 */
function applyAnnotatedTriangleLengths(points: Point[], shape: AIShapeInput): Point[] {
  if (points.length < 3 || !Array.isArray(shape.lengthItems)) return points

  const a = parseMeasurementValue(shape.lengthItems[0]?.text) // p0→p1
  const b = parseMeasurementValue(shape.lengthItems[1]?.text) // p1→p2
  const c = parseMeasurementValue(shape.lengthItems[2]?.text) // p2→p0

  const hasA = a !== null && a > 0
  const hasB = b !== null && b > 0
  const hasC = c !== null && c > 0

  if (!hasA && !hasB && !hasC) return points

  const G = GRID_CONFIG.size
  const [p0, p1, p2] = points

  // 원래 무게중심 (보정 후 복원용)
  const cx0 = (p0.x + p1.x + p2.x) / 3
  const cy0 = (p0.y + p1.y + p2.y) / 3

  let np: Point[]

  if (hasA && hasB && hasC) {
    // SSS: p0 고정, p1을 a 거리로, 코사인 법칙으로 p2 방향 산출
    const dir01x = p1.x - p0.x
    const dir01y = p1.y - p0.y
    const len01 = Math.hypot(dir01x, dir01y) || 1
    const nx = dir01x / len01
    const ny = dir01y / len01
    const newP1 = makeExactPoint(p0.x + nx * a * G, p0.y + ny * a * G)

    // 코사인 법칙: cos(A0) = (a² + c² - b²) / (2ac)
    const cosA0 = Math.max(-1, Math.min(1, (a * a + c * c - b * b) / (2 * a * c)))
    const sinA0 = Math.sqrt(1 - cosA0 * cosA0)

    // 교차곱으로 p2가 dir01의 어느 방향인지 판별
    const cross = dir01x * (p2.y - p0.y) - dir01y * (p2.x - p0.x)
    const s = cross >= 0 ? 1 : -1

    // dir01을 A0만큼 회전 (s 부호로 방향 결정)
    const newP2 = makeExactPoint(
      p0.x + (nx * cosA0 - s * ny * sinA0) * c * G,
      p0.y + (s * nx * sinA0 + ny * cosA0) * c * G,
    )
    np = [p0, newP1, newP2]

  } else if (hasA && hasC) {
    // a, c만 알 때: p0 기준으로 각각 방향 유지하며 스케일
    const d01x = p1.x - p0.x, d01y = p1.y - p0.y
    const l01 = Math.hypot(d01x, d01y) || 1
    const d02x = p2.x - p0.x, d02y = p2.y - p0.y
    const l02 = Math.hypot(d02x, d02y) || 1
    np = [
      p0,
      makeExactPoint(p0.x + d01x / l01 * a * G, p0.y + d01y / l01 * a * G),
      makeExactPoint(p0.x + d02x / l02 * c * G, p0.y + d02y / l02 * c * G),
    ]

  } else if (hasA && hasB) {
    // a=p0→p1, b=p1→p2만 알 때: 체인 스케일 (p0 고정 → p1 → p2 순서로)
    const d01x = p1.x - p0.x, d01y = p1.y - p0.y
    const l01 = Math.hypot(d01x, d01y) || 1
    const newP1 = makeExactPoint(p0.x + d01x / l01 * a * G, p0.y + d01y / l01 * a * G)
    const d12x = p2.x - p1.x, d12y = p2.y - p1.y
    const l12 = Math.hypot(d12x, d12y) || 1
    const newP2 = makeExactPoint(newP1.x + d12x / l12 * b * G, newP1.y + d12y / l12 * b * G)
    np = [p0, newP1, newP2]

  } else if (hasB && hasC) {
    // b=p1→p2, c=p2→p0만 알 때: 체인 스케일 (p2 고정 → p1 → p0 순서로)
    const d21x = p1.x - p2.x, d21y = p1.y - p2.y
    const l21 = Math.hypot(d21x, d21y) || 1
    const newP1 = makeExactPoint(p2.x + d21x / l21 * b * G, p2.y + d21y / l21 * b * G)
    const d20x = p0.x - p2.x, d20y = p0.y - p2.y
    const l20 = Math.hypot(d20x, d20y) || 1
    const newP0 = makeExactPoint(p2.x + d20x / l20 * c * G, p2.y + d20y / l20 * c * G)
    np = [newP0, newP1, p2]

  } else if (hasA) {
    const d01x = p1.x - p0.x, d01y = p1.y - p0.y
    const l01 = Math.hypot(d01x, d01y) || 1
    np = [p0, makeExactPoint(p0.x + d01x / l01 * a * G, p0.y + d01y / l01 * a * G), p2]

  } else if (hasC) {
    const d02x = p2.x - p0.x, d02y = p2.y - p0.y
    const l02 = Math.hypot(d02x, d02y) || 1
    np = [p0, p1, makeExactPoint(p0.x + d02x / l02 * c * G, p0.y + d02y / l02 * c * G)]

  } else {
    // hasB만 알 때: 무게중심 기준 균등 스케일
    const curB = distanceBetweenPoints(p1, p2) / G
    if (curB < 0.1) return points
    const scale = b! / curB
    const cx = (p0.x + p1.x + p2.x) / 3
    const cy = (p0.y + p1.y + p2.y) / 3
    return points.map((p) => makeExactPoint(cx + (p.x - cx) * scale, cy + (p.y - cy) * scale))
  }

  // 무게중심 복원
  const cx1 = (np[0].x + np[1].x + np[2].x) / 3
  const cy1 = (np[0].y + np[1].y + np[2].y) / 3
  return np.map((p) => makeExactPoint(p.x + cx0 - cx1, p.y + cy0 - cy1))
}

/**
 * 선분(segment/ray/line/arrow) 길이를 lengthItems[0]에 맞게 보정합니다.
 */
function applyAnnotatedSegmentLength(points: Point[], shape: AIShapeInput): Point[] {
  if (points.length < 2 || !Array.isArray(shape.lengthItems)) return points
  const len = parseMeasurementValue(shape.lengthItems[0]?.text)
  if (len === null || len <= 0) return points
  const p0 = points[0]
  const p1 = points[1]
  const dx = p1.x - p0.x, dy = p1.y - p0.y
  const cur = Math.hypot(dx, dy) || 1
  const G = GRID_CONFIG.size
  return [p0, makeExactPoint(p0.x + dx / cur * len * G, p0.y + dy / cur * len * G)]
}

/**
 * 직사각형(rect-rectangle, rect-square) 크기를 lengthItems에 맞게 보정합니다.
 * coerceForcedShapePoints 후 axis-aligned 상태에서 호출됩니다.
 */
function applyAnnotatedRectangleLengths(points: Point[], shape: AIShapeInput): Point[] {
  if (points.length < 4 || !Array.isArray(shape.lengthItems)) return points
  const w = parseMeasurementValue(shape.lengthItems[0]?.text) // 상변(너비)
  const h = parseMeasurementValue(shape.lengthItems[1]?.text) // 우변(높이)
  if ((w === null || w <= 0) && (h === null || h <= 0)) return points

  const G = GRID_CONFIG.size
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const curW = (maxX - minX) / G
  const curH = (maxY - minY) / G
  if (curW < 0.1 || curH < 0.1) return points

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const scaleX = (w !== null && w > 0) ? w / curW : 1
  const scaleY = (h !== null && h > 0) ? h / curH : 1
  return points.map((p) => makeExactPoint(cx + (p.x - cx) * scaleX, cy + (p.y - cy) * scaleY))
}

/**
 * 삼각형에서 가장 수평에 가까운 변을 찾아 완전히 수평(dy=0)으로 정렬합니다.
 * - 무게중심은 그대로 유지하고 회전만 적용합니다.
 * - 45° 초과 기울기는 사용자 의도로 간주해 건드리지 않습니다.
 * - 해당 변이 대응 꼭짓점보다 아래(y가 큰 쪽)에 있을 때만 교정합니다.
 *   (변이 위에 있으면 사용자가 의도적으로 뒤집은 삼각형으로 간주)
 */
function alignTriangleBase(points: Point[]): Point[] {
  if (points.length < 3) return points
  const [p0, p1, p2] = points

  const edges = [
    { dx: p1.x - p0.x, dy: p1.y - p0.y, opposite: p2, vx: (p0.x + p1.x) / 2, vy: (p0.y + p1.y) / 2 },
    { dx: p2.x - p1.x, dy: p2.y - p1.y, opposite: p0, vx: (p1.x + p2.x) / 2, vy: (p1.y + p2.y) / 2 },
    { dx: p0.x - p2.x, dy: p0.y - p2.y, opposite: p1, vx: (p2.x + p0.x) / 2, vy: (p2.y + p0.y) / 2 },
  ]

  // 가장 수평에 가까운 변(|dy|가 가장 작은 변) 선택
  let bestIdx = 0
  let minAbsDy = Math.abs(edges[0].dy)
  for (let i = 1; i < 3; i++) {
    const absDy = Math.abs(edges[i].dy)
    if (absDy < minAbsDy) {
      minAbsDy = absDy
      bestIdx = i
    }
  }

  const { dx, dy, opposite, vy } = edges[bestIdx]
  const len = Math.hypot(dx, dy)
  if (len < 1) return points

  // 45° 초과 기울기는 건드리지 않음 (사용자 의도로 간주)
  if (Math.abs(dy) > Math.abs(dx)) return points

  // 밑변(해당 변)이 대응 꼭짓점보다 아래에 있을 때만 교정
  // 캔버스 좌표계에서 y가 클수록 아래이므로 변 중점 vy > 대응 꼭짓점 y 일 때 밑변
  if (vy <= opposite.y) return points

  const angle = Math.atan2(dy, dx)
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)

  const cx = (p0.x + p1.x + p2.x) / 3
  const cy = (p0.y + p1.y + p2.y) / 3

  return points.map((p) => {
    const rx = p.x - cx
    const ry = p.y - cy
    return makeExactPoint(cx + rx * cos - ry * sin, cy + rx * sin + ry * cos)
  })
}

/**
 * 도형 타입별로 적절한 좌표 보정 함수를 선택해 적용합니다.
 * (triangle-right는 별도 함수 applyAnnotatedTriangleRightLengths 사용)
 */
/**
 * 정삼각형 전용 길이 보정.
 * coerceForcedShapePoints 이후 이미 세 변이 동일하므로 균등 스케일만 적용합니다.
 * lengthItems 중 어느 변이든 annotated 값이 있으면 그 값을 변 길이로 사용합니다.
 */
function applyAnnotatedEquilateralLengths(points: Point[], shape: AIShapeInput): Point[] {
  if (points.length < 3 || !Array.isArray(shape.lengthItems)) return points

  let sideLen: number | null = null
  for (const item of shape.lengthItems) {
    const v = parseMeasurementValue(item?.text)
    if (v !== null && v > 0) { sideLen = v; break }
  }
  if (sideLen === null) return points

  const G = GRID_CONFIG.size
  const [p0, p1] = points
  const curSide = distanceBetweenPoints(p0, p1) / G
  if (curSide < 0.1) return points

  const scale = sideLen / curSide
  const cx = (points[0].x + points[1].x + points[2].x) / 3
  const cy = (points[0].y + points[1].y + points[2].y) / 3
  return points.map(p => makeExactPoint(cx + (p.x - cx) * scale, cy + (p.y - cy) * scale))
}

function applyAnnotatedGeneralLengths(type: ShapeType, points: Point[], shape: AIShapeInput): Point[] {
  if (type === 'triangle-equilateral') {
    return applyAnnotatedEquilateralLengths(points, shape)
  }
  if (type === 'triangle' || type === 'triangle-isosceles') {
    const corrected = applyAnnotatedTriangleLengths(points, shape)
    // 일반 삼각형은 밑변이 수평이 되도록 후처리 (이등변은 apex 보정이 따로 있음)
    if (type === 'triangle') return alignTriangleBase(corrected)
    return corrected
  }
  if (type === 'segment' || type === 'ray' || type === 'line' || type === 'arrow') {
    return applyAnnotatedSegmentLength(points, shape)
  }
  if (type === 'rect-rectangle' || type === 'rect-square') {
    return applyAnnotatedRectangleLengths(points, shape)
  }
  return points
}

function stripLengthUnit(text: string): string {
  return text.replace(/\s*cm$/i, '').trim()
}

function isLengthLikeText(text: string): boolean {
  return /^[0-9xabcde+\-./\s]+(?:cm)?$/i.test(text.trim())
}

function isAngleLikeText(text: string): boolean {
  return /°|각|angle/i.test(text.trim())
}

function isPointLabelLikeText(text: string): boolean {
  const normalized = text.trim()
  return /^[A-Za-z]$/.test(normalized) || /^[ㄱ-ㅎ가-힣]$/.test(normalized)
}

function assignPointLabelFromText(shape: Shape, anchor: Point, text: string): boolean {
  if (shape.points.length === 0) return false

  let bestIndex = -1
  let bestDistance = Infinity

  for (let index = 0; index < shape.points.length; index++) {
    const distance = distanceBetweenPoints(anchor, shape.points[index])
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  if (bestIndex < 0 || bestDistance > GRID_CONFIG.size * 5) return false

  const labels = [...(shape.pointLabels ?? Array.from({ length: shape.points.length }, () => ''))]
  while (labels.length < shape.points.length) {
    labels.push('')
  }

  labels[bestIndex] = text.trim()
  shape.pointLabels = labels
  shape.guideVisibility = {
    ...(shape.guideVisibility || {}),
    pointName: true,
  }
  return true
}

function createLengthGuideFromText(shape: Shape, anchor: Point, text: string): Guide | null {
  const normalizedText = stripLengthUnit(text)
  if (!normalizedText) return null

  const segmentCount = shape.type === 'segment' || shape.type === 'ray' || shape.type === 'line' || shape.type === 'arrow' || shape.type === 'arrow-curve'
    ? 1
    : shape.type === 'circle'
      ? 1
      : shape.points.length

  let bestIndex = -1
  let bestDistance = Infinity

  for (let index = 0; index < segmentCount; index++) {
    const p1 = shape.points[index]
    const p2 = shape.type === 'circle'
      ? shape.points[1]
      : segmentCount === 1
        ? shape.points[1]
        : shape.points[(index + 1) % shape.points.length]
    if (!p1 || !p2) continue

    const distance = distancePointToSegment(anchor, p1, p2)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  if (bestIndex < 0 || bestDistance > GRID_CONFIG.size * 5) return null
  const p1 = shape.points[bestIndex]
  const p2 = shape.type === 'circle'
    ? shape.points[1]
    : segmentCount === 1
      ? shape.points[1]
      : shape.points[(bestIndex + 1) % shape.points.length]
  if (!p1 || !p2) return null

  return {
    id: generateId(),
    type: 'length',
    points: [p1, p2, anchor],
    text: normalizedText,
    shapeId: shape.id,
  }
}

function createAngleGuideFromText(shape: Shape, anchor: Point, text: string): Guide | null {
  if (shape.type === 'circle' || shape.points.length < 3) return null

  let bestIndex = -1
  let bestDistance = Infinity

  for (let index = 0; index < shape.points.length; index++) {
    const distance = distanceBetweenPoints(anchor, shape.points[index])
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  if (bestIndex < 0 || bestDistance > GRID_CONFIG.size * 5) return null
  const prev = shape.points[(bestIndex - 1 + shape.points.length) % shape.points.length]
  const current = shape.points[bestIndex]
  const next = shape.points[(bestIndex + 1) % shape.points.length]

  return {
    id: generateId(),
    type: 'angle',
    points: [prev, current, next],
    text: text.trim(),
    shapeId: shape.id,
  }
}

function absorbTextGuidesIntoShapeGuides(shapes: Shape[], guides: Guide[]): Guide[] {
  if (shapes.length === 0) return guides
  const primaryShape = shapes[0]
  const nextGuides: Guide[] = []

  for (const guide of guides) {
    if (guide.type !== 'text' || guide.points.length === 0 || !guide.text) {
      nextGuides.push(guide)
      continue
    }

    if (isPointLabelLikeText(guide.text) && assignPointLabelFromText(primaryShape, guide.points[0], guide.text)) {
      continue
    }

    if (isLengthLikeText(guide.text)) {
      const converted = createLengthGuideFromText(primaryShape, guide.points[0], guide.text)
      if (converted) {
        primaryShape.guideVisibility = {
          ...(primaryShape.guideVisibility || {}),
          length: true,
        }
        nextGuides.push(converted)
        continue
      }
    }

    if (isAngleLikeText(guide.text)) {
      const converted = createAngleGuideFromText(primaryShape, guide.points[0], guide.text)
      if (converted) {
        primaryShape.guideVisibility = {
          ...(primaryShape.guideVisibility || {}),
          angle: true,
        }
        nextGuides.push(converted)
        continue
      }
    }

    nextGuides.push(guide)
  }

  return nextGuides
}

/**
 * angleItems 중 textMode === 'auto'인 항목에 대해 꼭짓점 좌표로 내각을 계산해 주입합니다.
 * 변환 후에는 textMode: 'normal', text: 계산값 형태로 반환됩니다.
 */
function resolveAutoAngleItems(points: Point[], angleItems: AIShapeItem[]): AIShapeItem[] {
  const n = points.length
  if (n < 3) return angleItems
  return angleItems.map((item, i) => {
    if (item?.textMode !== 'auto') return item
    const prev = points[(i - 1 + n) % n]
    const vertex = points[i]
    const next = points[(i + 1) % n]
    const deg = computeAngleDegrees(prev, vertex, next)
    return { ...item, textMode: 'normal' as const, text: `${formatRoundedValue(deg)}°` }
  })
}

function convertToCanvasShape(
  aiShape: AIShapeInput,
  existingCount: number,
  style: Shape['style'],
  forcedType?: ShapeType
): Shape | null {
  const type = forcedType ?? sanitizeShapeType(aiShape.type)
  if (!type || !Array.isArray(aiShape.points)) return null

  const rawPoints = aiShape.points
    .map((point) => normalizePoint(point))
    .filter((point): point is Point => point !== null)
  const coercedPoints = coerceForcedShapePoints(type, rawPoints)
  const points = type === 'triangle-right'
    ? applyAnnotatedTriangleRightLengths(coercedPoints, aiShape)
    : applyAnnotatedGeneralLengths(type, coercedPoints, aiShape)

  // textMode:'auto' 각도 항목을 좌표 기반으로 계산된 값으로 교체
  const resolvedShape: AIShapeInput = Array.isArray(aiShape.angleItems) && aiShape.angleItems.some(item => item?.textMode === 'auto')
    ? { ...aiShape, angleItems: resolveAutoAngleItems(points, aiShape.angleItems) }
    : aiShape

  const requiredPointCount = getRequiredPointCount(type)
  if (type === 'polygon' || type === 'free-shape') {
    if (points.length < 3) return null
  } else if (points.length < requiredPointCount) {
    return null
  }

  const colorIndex = existingCount % Math.max(1, FILL_PALETTE.length)
  const fillHex = FILL_PALETTE[colorIndex]?.hex ?? '#CFEAF7'
  const isArrowType = type === 'arrow' || type === 'arrow-curve'

  return {
    id: generateId(),
    type,
    points,
    style,
    color: {
      stroke: isArrowType ? MAGENTA_100_HEX : (STROKE_PALETTE[0]?.hex ?? '#231815'),
      fill: isOpenOrPoint(type) ? FILL_NONE : fillHex,
    },
    strokeWidthPt: isArrowType ? 0.5 : undefined,
    circleMeasureMode: type === 'circle'
      ? (resolvedShape.circleMeasureMode === 'diameter' ? 'diameter' : 'radius')
      : undefined,
    pointLabels: sanitizePointLabels(resolvedShape.pointLabels, points.length),
    guideVisibility: buildAIShapeGuideVisibility(type, points.length, resolvedShape.guideVisibility, resolvedShape.lengthItems, resolvedShape.angleItems),
    guideStyleMap: buildGuideStyleMap(resolvedShape),
  }
}

function convertToGuide(aiGuide: AIGuideInput): Guide | null {
  if (aiGuide.type !== 'text') return null
  const point = normalizePoint(aiGuide.position)
  const text = typeof aiGuide.text === 'string' ? aiGuide.text.trim().slice(0, 100) : ''
  if (!point || !text) return null

  return {
    id: generateId(),
    type: 'text',
    points: [point],
    text,
    rotation: typeof aiGuide.rotation === 'number' ? aiGuide.rotation : 0,
    useLatex: aiGuide.useLatex === true,
    color: '#231815',
    fontSize: 11,
  }
}

function parseAIResponse(content: string): AISketchResponse {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonText = fenced?.[1]?.trim() || trimmed
  return JSON.parse(jsonText) as AISketchResponse
}

function normalizeAISketchResponse(parsed: AISketchResponse): AISketchResponse {
  if (!Array.isArray(parsed.shapes) || parsed.shapes.length === 0) return parsed

  const shapes = parsed.shapes.map((shape) => ({
    ...shape,
    lengthItems: Array.isArray(shape.lengthItems) ? shape.lengthItems.map((item) => ({ ...item })) : shape.lengthItems,
    angleItems: Array.isArray(shape.angleItems) ? shape.angleItems.map((item) => ({ ...item })) : shape.angleItems,
  }))

  return {
    ...parsed,
    shapes,
  }
}

function createDetachedBlankBoxGuides(aiShapes: AIShapeInput[]): Guide[] {
  if (aiShapes.length < 2) return []
  const mainShape = aiShapes[0]
  if (!Array.isArray(mainShape.angleItems) || !mainShape.angleItems.some((item) => item?.textMode === 'blank' && item?.detached === true)) {
    return []
  }

  const guides: Guide[] = []
  aiShapes.slice(1).forEach((shape) => {
    if (shape.type !== 'arrow-curve' || !Array.isArray(shape.points) || shape.points.length < 2) return
    const start = normalizePoint(shape.points[0])
    const end = normalizePoint(shape.points[1])
    if (!start || !end) return

    const width = GRID_CONFIG.size * 2.8
    const height = GRID_CONFIG.size * 1.4
    const left = end.x
    const top = end.y - (height / 2)
    const right = left + width
    const bottom = top + height

    guides.push({
      id: generateId(),
      type: 'blank-box',
      points: [
        makePoint(left, top),
        makePoint(right, bottom),
      ],
      color: '#231815',
      lineWidth: 1,
    })
  })

  return guides
}

function buildPrompt(options: AnalyzeOptions): string {
  const userHint = options.userHint?.trim()
  const shapeExample = buildShapeExample(options.forcedShapeType)

  return `${BASE_PROMPT}

Reference example for "${options.forcedShapeType}" (follow this structure exactly for this shape type):
${shapeExample}

Additional instructions:
${userHint
    ? `- [TOP PRIORITY] The user provided a hint. Apply it first before anything else:\n  """\n  ${userHint}\n  """`
    : '- No user hint provided. Rely on visible text in the image (lengths, angles, labels) first.'}
- Do not infer the shape type freely. The required shape type is "${options.forcedShapeType}".
- shapes[0].type must be exactly "${options.forcedShapeType}".
- Place the main shape roughly centered in the grid: prefer gridX 10–54, gridY 6–30. Make it large enough to occupy roughly 40–70% of the grid area.
- Prefer one main shape unless the image clearly contains multiple independent shapes.

CRITICAL — Index mapping (follow exactly, do not swap):
- points[i] is the vertex named pointLabels[i]. The order you assign pointLabels determines the index for everything else.
- angleItems[i] is the angle AT vertex points[i]. When the user/image specifies "angle at vertex X = 30°", find which index i has pointLabels[i] = "X", then set angleItems[i].text = "30°". Never assign an angle to the wrong vertex index.
- lengthItems[i] is the edge FROM points[i] TO points[(i+1) % n]:
  For 3 vertices [A,B,C]: lengthItems[0]=A→B, lengthItems[1]=B→C, lengthItems[2]=C→A.
  For 4 vertices [A,B,C,D]: lengthItems[0]=A→B, lengthItems[1]=B→C, lengthItems[2]=C→D, lengthItems[3]=D→A.
- Edge naming: "CB" or "BC" means the edge between vertices C and B — regardless of direction. Match it to the lengthItems index where one endpoint is C and the other is B. Do NOT assign it to an unrelated edge.
  For pointLabels=['A','B','C']: "AB"/"BA"=lengthItems[0], "BC"/"CB"=lengthItems[1], "CA"/"AC"=lengthItems[2].
  For example: if user says "AC=3cm", assign text:"3cm" to lengthItems[2] (C→A). If user says "CB=6cm", assign text:"6cm" to lengthItems[1] (B→C).
- CRITICAL — Never convert explicit measurements to blank: If the user hint or image specifies a numeric value for an edge or angle (e.g. "CB=6cm", "A=30°"), ALWAYS assign that value as text. NEVER change a known measurement into textMode:"blank". Only use textMode:"blank" for items explicitly described as unknown/blank (e.g. "B의 각도 빈칸", "□").
- For triangle-right: find the 90° vertex (from hint or image). The hypotenuse is the edge OPPOSITE that vertex. Use the following lookup table (all 3 cases — follow exactly):
    right angle at index 0 (A): hide lengthItems[1] (B→C, opposite A). Legs are lengthItems[0] (A→B) and lengthItems[2] (C→A).
    right angle at index 1 (B): hide lengthItems[2] (C→A, opposite B). Legs are lengthItems[0] (A→B) and lengthItems[1] (B→C).
    right angle at index 2 (C): hide lengthItems[0] (A→B, opposite C). Legs are lengthItems[1] (B→C) and lengthItems[2] (C→A).
  For the 90° vertex r: set angleItems[r] = { text: "90°", visible: false, textMode: "normal" }. The text "90°" must be present so the app can correct coordinates — it will NOT be displayed. The right-angle square marker is rendered automatically. The other two vertices get their angle text normally.
- Coordinate placement workflow for triangle-right (follow exactly in this order):
    Step 1. Identify the right-angle vertex name from hint/image (e.g. "C is 90°").
    Step 2. Find its index r in pointLabels (e.g. pointLabels=['A','B','C'] → C is index 2).
    Step 3. Place points[r] (the right-angle vertex) at a convenient grid position first (e.g. gridX 20, gridY 26). This vertex is at the geometric corner.
    Step 4. Place points[(r+2)%3] along one perpendicular axis from the corner (e.g. 3 units above: gridX 20, gridY 23). This is leg 1.
    Step 5. Place points[(r+1)%3] along the other perpendicular axis from the corner (e.g. 6 units right: gridX 26, gridY 26). This is leg 2.
    Step 6. The right-angle vertex must be the GEOMETRIC CORNER — never put a different vertex at the corner if C is designated as 90°.
    Example (right angle at C, index 2, AC=3cm, CB=6cm): points[2]=C=(20,26), points[0]=A=(20,23) [3 above C], points[1]=B=(26,26) [6 right of C].
- Coordinate placement workflow for triangle-equilateral (follow exactly):
    Step 1. Read the side length s from the hint or image. The grid distance between any two adjacent vertices MUST equal s grid units.
    Step 2. Choose the winding order (clockwise or counterclockwise) to match the image. In screen coordinates (Y increases downward), clockwise on screen = top → bottom-right → bottom-left. Counterclockwise = top → bottom-left → bottom-right.
    Step 3. Place points[0] and points[1] exactly s units apart to form the base edge. Prefer a horizontal base.
    Step 4. Place points[2] roughly on the correct side (above or below) — the app will snap it to the exact equilateral position. The sign of points[2].y relative to the base determines which side the apex goes.
    Step 5. Center the triangle within gridX 10–54, gridY 6–30.
    Example (s=5cm, clockwise, ㄱ=top, ㄴ=bottom-right, ㄷ=bottom-left): base center≈(32,24), points[0]=ㄱ=(32,20), points[1]=ㄴ=(35,25), points[2]=ㄷ=(29,25). [distance(ㄱ,ㄴ)≈5, distance(ㄴ,ㄷ)=6→app corrects to equilateral]
    CRITICAL: scale takes priority over visual size. For s=5cm the triangle will be small (5×5 grid area); do NOT stretch coordinates to fill the grid.
- Coordinate placement workflow for triangle-isosceles (follow exactly):
    Step 1. Identify the three side lengths (two equal legs and one base) from the hint or image.
    Step 2. Identify which vertex is the apex (the vertex between the two equal legs). The other two are base vertices.
    Step 3. Place the two base vertices so that the distance between them = base length in cm grid units. Prefer a horizontal base.
    Step 4. Place the apex vertex above (or below) the midpoint of the base. The height h = √(leg² − (base/2)²). The apex should be h grid units from the base midpoint.
    Step 5. Center the triangle within gridX 10–54, gridY 6–30.
    Example (legs=6cm, base=4cm → h=√(36−4)=5.66): base center≈(32,24), base vertices: ㄴ=(30,24), ㄷ=(34,24). Apex ㄱ at (32, 24−5.66)=(32,18). → points=[ㄱ=(32,18), ㄴ=(30,24), ㄷ=(34,24)].
    CRITICAL: set coordinates so that dist(apex, base-vertex)=leg and dist(base-vertex1, base-vertex2)=base. The app auto-corrects coordinates to exact lengths — but you must provide approximately correct scale. Do NOT use large coordinates that fill the grid.
- Coordinate placement for triangle (general/free triangle):
    Prefer a natural upright layout: place the longest known side horizontally as the base, and the remaining vertex above (or below) the base.
    Set coordinates so each specified side equals its cm value. Sides marked "자동계산" or not specified do not need exact placement — the app derives them.
    Example (AB=4cm, BC=10cm): longest side is BC → place B=(27,24), C=(37,24) [10 units apart, horizontal]. Place A above B so dist(A,B)=4, e.g. A=(27,20). Do NOT stack A directly above B vertically if BC is meant to be the base.

CRITICAL — Vertex position reading (do not impose winding order theory):
- Read each vertex label from its ACTUAL position in the image. The label written/drawn near a corner IS that corner's label — do NOT reassign it to another corner based on clockwise/counterclockwise theory.
- After identifying which label is at which corner (top / bottom-left / bottom-right), assign coordinates to match those positions exactly. The winding order in the output is whatever the image shows — do not swap labels to achieve a specific CW/CCW direction.
- EDGE INDEX VERIFICATION — once vertex labels and coordinates are assigned, for each length text in the image:
    (1) Find which edge the text is visually adjacent to (by proximity).
    (2) Identify the two vertex labels at the ends of that edge.
    (3) Map to lengthItems index: for pointLabels=[X,Y,Z], X-Y=index0, Y-Z=index1, Z-X=index2.
    (4) Set visible:true ONLY for that index.
    Example: if "5cm" is between top-vertex(ㄱ) and bottom-left-vertex(ㄷ), and pointLabels=[ㄱ,ㄴ,ㄷ], then ㄷ-ㄱ = index2 → set lengthItems[2] visible:true.
- ANGLE BLANK VERIFICATION — for each □ box drawn in the image:
    (1) Find the nearest vertex (by visual distance to the corner).
    (2) Look up that vertex's index in pointLabels.
    (3) Set angleItems[that index] = textMode:"blank", visible:true.
    A small rectangle or square drawn at or inside a corner = angle blank for that corner's vertex.

CRITICAL — Coordinate scale (1 grid unit = 1 cm in this app):
- When the user or image specifies side lengths in cm, set grid coordinates so that the actual distance between vertices matches. Example: AC=3cm → distance(A,C) = 3 grid units. CB=6cm → distance(C,B) = 6 grid units.
- For triangle-right with right angle at vertex C, legs AC=3cm and CB=6cm: place C at a convenient grid position (e.g. gridX 20, gridY 26), A exactly 3 units away along one axis (e.g. gridX 20, gridY 23), B exactly 6 units away along the perpendicular axis (e.g. gridX 26, gridY 26).
- Hand-drawn coordinate proportions are approximate. Do not use drawn proportions as the primary source for side lengths.
- Use this priority for interpretation:
  1. User hint (if provided above).
  2. Length, angle, label, and unit text written inside the image.
  3. Overall visual layout and markers such as right-angle boxes or arc marks.
  4. Coordinate proportions only as a last fallback.
- Vertex labels like A, B, C or ㄱ, ㄴ, ㄷ must populate pointLabels, never guides[].
- Korean letters ㄱ, ㄴ, ㄷ, ㄹ near corners are vertex labels — treat them exactly like A, B, C. Do NOT place them in guides[].
- Side text like 3cm or 6cm must be interpreted as side length information for the shape.
- Distinguish vertex labels from measurements carefully.
- A single uppercase letter near a corner, such as A or B, is usually a vertex label and belongs in pointLabels.
- A text item attached to a side together with a unit such as cm, mm, or m is a side measurement, not a vertex label.
- Do not invent algebraic variables like b or x unless the handwriting clearly shows a letter.
- If a handwritten side label could be read as either a digit or a letter, prefer the digit when the text is followed by a unit and represents a length.
- For example, treat "6cm" as a side length even if the handwritten 6 looks similar to a lowercase b.
- Angle text like 30° must be interpreted as angle information for the shape.
- If the image requests only some side lengths or some angles, hide the others with visible: false.
- If the image shows a blank answer box for a side length, use textMode: "blank" for that edge.
- A blank answer box drawn on paper (a small square □) must be represented as textMode "blank" with no text value, never as a letter character in the text field. This applies to ALL shape types (triangles, rectangles, polygons, etc.) for BOTH side lengths (lengthItems) AND angles (angleItems). If □ is drawn at or near a vertex angle of any polygon, set textMode:"blank", visible:true for that angleItems index. Do not write the □ character as text.
- After establishing the vertex winding order, identify the visual position (left/right/base) of each length label in the image, then map it to the correct lengthItems index. For equilateral triangles with only one visible side text: find which side in the image has the text, determine its lengthItems index from the vertex ordering, set that index visible:true and all others visible:false.
- The value before a unit such as cm, mm, or ° must be a number or empty. If a single character before the unit could be either a handwritten digit or a letter (e.g. b vs 6, l vs 1, O vs 0), always choose the digit interpretation.
- If the angle blank appears AT the vertex (inline): set angleItems[r] = { textMode:"blank", visible:true, detached:false }.
- DEFAULT for angle blanks: always use inline (detached:false) UNLESS the image visually shows a curved arrow leading outside the shape, OR the user hint explicitly mentions an external arrow (화살표). The phrase "빈칸으로 표시" alone means inline — do NOT add detached:true or an arrow-curve companion.
- If the angle blank appears OUTSIDE the shape (with a curved arrow pointing to it AND the image or hint confirms this): set angleItems[r] = { textMode:"blank", detached:true, visible:true }. Use visible:true so the angle arc still renders at the vertex. Include a companion arrow-curve shape in shapes[]. The blank-box will be placed at the arrow-curve endpoint automatically.
- For the companion arrow-curve, place its endpoint roughly 3–5 grid units away from the vertex. Do NOT extend the arrow to the edge of the grid — keep the blank close to the shape.
- ONLY include auxiliary arrow-curve shapes when the image visually shows a curved arrow, or the user hint explicitly mentions one. Never add arrow-curve shapes spontaneously.
- Use exact detected values from image text or user hint for lengthItems[index].text and angleItems[index].text.
- Do not return those semantic labels as free text guides unless they are clearly separate notes outside the diagram.
- textDirection for length and angle items: use "auto" in almost all cases. The app computes the correct outward label position from geometry (perpendicular to the edge, away from the centroid). Only use "above"/"below"/"left"/"right" when the auto position genuinely conflicts with another element and you need to move the label further away.`
}

function buildUserInstruction(options: AnalyzeOptions): string {
  const userHint = options.userHint?.trim()
  const lines: string[] = []

  if (userHint) {
    lines.push(`[IMPORTANT] User hint — apply this first: "${userHint}"`, '')
  }

  lines.push(
    'Extract the main math diagram from the image as JSON.',
    `Forced shape type: ${options.forcedShapeType}. Do not re-classify from the image.`,
    userHint
      ? `Reconfirm user hint: ${userHint}`
      : 'No user hint. Use visible lengths, angles, and labels from the image.',
    'Vertex names A/B/C or ㄱ/ㄴ/ㄷ → pointLabels. Never put vertex labels in guides[].',
    'ㄱ, ㄴ, ㄷ at corners are Korean vertex labels, equivalent to A, B, C.',
    'INDEX RULE: angleItems[i] = angle at the vertex whose name is pointLabels[i]. Never swap vertex indices.',
    'INDEX RULE: lengthItems[i] = edge from points[i] to points[i+1]. For [A,B,C]: index0=A→B, index1=B→C, index2=C→A.',
    'EDGE RULE: "CB" means the edge between C and B. Map to the correct lengthItems index — do NOT put it on the hypotenuse.',
    'SCALE RULE: 1 grid unit = 1 cm. Set coordinates so that distances between vertices match specified lengths in cm.',
    'Side texts like 3cm or 6cm → lengthItems. Angle texts like 30° → angleItems.',
    'textDirection: use "auto" for all length and angle items. The app places labels automatically based on edge geometry (outward from centroid). Do NOT use "above"/"below"/"left"/"right" unless an explicit override is required.',
    'If only some lengths/angles appear, hide the rest with visible: false.',
    'Blank □ on a side → textMode:"blank" in lengthItems. Blank □ at a vertex angle of ANY shape (triangle, rectangle, polygon, etc.) → textMode:"blank", visible:true in angleItems. NEVER convert explicit numeric measurements (like "6cm") to blank.',
    'Blank angle: default is INLINE (detached:false, textMode:"blank", visible:true). Only use detached:true + arrow-curve if the image visually shows a curved arrow, or the hint explicitly says 화살표. "빈칸으로 표시" alone = inline.',
    'Blank angle OUTSIDE shape (with arrow) → textMode:"blank", detached:true, visible:true (NOT false — keeps arc visible at vertex). Plus arrow-curve companion shape. Arrow endpoint 3–5 grid units from vertex, not at grid edge.',
    'VERTEX POSITION: read each label from its actual corner in the image. Do NOT swap labels to force CW/CCW. The label at a corner IS that corner\'s pointLabel. Assign coordinates to match where each label is drawn.',
    'SCALE RULE (ALL SHAPES): 1 grid unit = 1 cm. Set coordinates so actual vertex distances match specified lengths. A 6cm side must be exactly 6 grid units long. Do NOT stretch shapes to fill the grid. The app auto-corrects to exact lengths but requires approximately correct scale.',
    'CONSTRAINED SHAPE RULE: triangle-equilateral and rect-square have fixed geometric constraints (all sides equal). The app enforces these constraints automatically, but ONLY scales from points[0]→points[1] as the base. Therefore you MUST set dist(points[0], points[1]) to exactly the side length in grid units. If you give a wrong scale for this base edge, ALL sides will be wrong — the constraint correction cannot fix a wrong base.',
    'EQUILATERAL SCALE: for triangle-equilateral, dist(points[0], points[1]) MUST equal the side length in cm (e.g. 10cm → exactly 10 grid units). ALL three sides will be auto-equalized from this base. Do NOT place points[0] and points[1] at a different scale and expect the third point to compensate.',
    'SQUARE SCALE: for rect-square, dist(points[0], points[1]) MUST equal the side length in cm. The remaining two corners are auto-computed as a perfect axis-aligned square. Do NOT stretch points to fill the grid.',
    'ISOSCELES SCALE: for triangle-isosceles, identify apex (vertex between equal legs) and base. Place base vertices so dist(base1,base2)=base_cm. Place apex h=√(leg²-(base/2)²) grid units above base midpoint. E.g. legs=6cm, base=4cm → h≈5.66, base=(30,24)to(34,24), apex=(32,18).',
    'GENERAL TRIANGLE LAYOUT: for triangle type, place the longest known side as a horizontal base. Place the other vertices above or below the base. Set coordinates so each side distance equals its cm value. E.g. AB=4cm, BC=10cm: place B=(27,24), C=(37,24) [BC=10 horizontal], then A above B so dist(A,B)=4 e.g. A=(27,20).',
    'EDGE INDEX CHECK: for each length text — find the two vertex labels it sits between → look up their lengthItems index (for [ㄱ,ㄴ,ㄷ]: ㄱ-ㄴ=0, ㄴ-ㄷ=1, ㄷ-ㄱ=2) → set only that index visible:true.',
    'LINE/RAY LENGTH: for line and ray types, a length label between the two points is optional. If the image or hint shows a length value annotated between the two points, set lengthItems[0] = { text: "Xcm", visible: true }. If no length is annotated, set lengthItems[0] = { visible: false }.',
    'ANGLE BLANK CHECK: for each □ box near a corner — find the nearest vertex label → get its index → set angleItems[index]=textMode:"blank",visible:true.',
    'ANGLE AUTO COMPUTE: when the hint says "자동계산하여 표시" or "자동계산" for angles, set those angleItems to textMode:"auto", visible:true. The app will compute the exact interior angle from the vertex coordinates. Do NOT set textMode:"blank" — "자동계산" means a computed numeric value will be shown, not a blank box.',
    'POINT DOT RULE: guideVisibility.point: true = renders a filled dot at each vertex/center. Set to true if the image shows a dot at a vertex or center, or if the hint mentions 중점/중심/center. Otherwise false.',
    'For circle: if center is labeled or marked, set pointLabels[0] = center label, guideVisibility.pointName: true, guideVisibility.point: true. If the center is visibly marked (dot present) but the label text is unclear or ambiguous, use "ㅇ" as the default center label.',
  )

  return lines.join('\n')
}

export function useAISketch() {
  const canvasStore = useCanvasStore()
  const toolStore = useToolStore()
  const isAnalyzing = ref(false)
  const error = ref<string | null>(null)
  const controller = ref<AbortController | null>(null)
  const isDev = import.meta.env.DEV
  const debug = ref<AISketchDebugState>({
    systemPrompt: '',
    userInstruction: '',
    rawResponseText: null,
    parsedResponse: null,
  })

  function abortAnalysis() {
    controller.value?.abort()
    controller.value = null
    isAnalyzing.value = false
  }

  async function analyzeImage(imageDataUrl: string, options: AnalyzeOptions): Promise<AnalyzeResult> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('VITE_OPENAI_API_KEY is not configured.')
    }

    isAnalyzing.value = true
    error.value = null
    controller.value = new AbortController()
    const systemPrompt = buildPrompt(options)
    const userInstruction = buildUserInstruction(options)
    debug.value = {
      systemPrompt,
      userInstruction,
      rawResponseText: null,
      parsedResponse: null,
    }
    if (isDev) {
      console.groupCollapsed('[AI Sketch] Request')
      console.log('forcedShapeType:', options.forcedShapeType)
      console.log('userHint:', options.userHint ?? '')
      console.log('systemPrompt:', systemPrompt)
      console.log('userInstruction:', userInstruction)
      console.log('requestDebugText:', safeStringify({
        forcedShapeType: options.forcedShapeType,
        userHint: options.userHint ?? '',
        systemPrompt,
        userInstruction,
      }))
      console.groupEnd()
    }

    try {
      const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userInstruction },
                { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
              ],
            },
          ],
        }),
        signal: controller.value.signal,
      })

      const raw = await response.json()
      if (!response.ok) {
        const message = raw?.error?.message || 'OpenAI request failed.'
        throw new Error(message)
      }

      const content = raw?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('AI response content was empty.')
      }
      debug.value.rawResponseText = content

      const rawParsed = parseAIResponse(content)
      const parsed = normalizeAISketchResponse(rawParsed)
      debug.value.parsedResponse = parsed
      if (isDev) {
        console.groupCollapsed('[AI Sketch] Response')
        console.log('rawResponseText:', content)
        console.log('rawParsedResponse:', rawParsed)
        console.log('normalizedResponse:', parsed)
        console.log('rawParsedResponseText:', safeStringify(rawParsed))
        console.log('normalizedResponseText:', safeStringify(parsed))
        console.groupEnd()
      }
      const baseCount = canvasStore.shapes.filter((shape) => isFilledShape(shape.type)).length
      const aiShapes = Array.isArray(parsed.shapes) ? parsed.shapes : []
      const shapes = aiShapes.length > 0
        ? aiShapes
          .map((shape, index) => convertToCanvasShape(shape, baseCount + index, toolStore.style, index === 0 ? options.forcedShapeType : undefined))
          .filter((shape): shape is Shape => shape !== null)
        : []
      const guides = Array.isArray(parsed.guides)
        ? parsed.guides
          .map((guide) => convertToGuide(guide))
          .filter((guide): guide is Guide => guide !== null)
        : []
      const detachedBlankGuides = createDetachedBlankBoxGuides(aiShapes)
      const normalizedGuides = absorbTextGuidesIntoShapeGuides(shapes, [...guides, ...detachedBlankGuides])
      const showGuideUnit = Array.isArray(parsed.shapes) && parsed.shapes.some((shape) => shape?.showUnit === true)

      if (isDev) {
        console.groupCollapsed('[AI Sketch] Canvas Payload')
        console.log('shapes:', shapes)
        console.log('guides:', normalizedGuides)
        console.log('showGuideUnit:', showGuideUnit)
        console.log('canvasPayloadText:', safeStringify({
          shapes,
          guides: normalizedGuides,
          showGuideUnit,
        }))
        console.groupEnd()
      }

      if (shapes.length === 0 && normalizedGuides.length === 0) {
        throw new Error('No recognizable shape was found.')
      }

      return {
        shapes,
        guides: normalizedGuides,
        meta: { showGuideUnit },
      }
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        if (caughtError.name === 'AbortError') {
          error.value = 'Request was canceled.'
          throw caughtError
        }
        error.value = caughtError.message
        throw caughtError
      }
      error.value = 'Unknown AI analysis error.'
      throw new Error(error.value)
    } finally {
      controller.value = null
      isAnalyzing.value = false
    }
  }

  return {
    isAnalyzing,
    error,
    debug,
    analyzeImage,
    abortAnalysis,
  }
}
