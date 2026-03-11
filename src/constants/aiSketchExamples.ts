import type { ShapeType } from '@/types'

/**
 * AI 스케치 도형 타입별 예시 JSON
 *
 * 각 도형 타입마다 최소한의 올바른 구조를 GPT-4o에게 보여주기 위한 예시입니다.
 * 프롬프트의 "Reference example" 섹션에 삽입됩니다.
 *
 * 수정 시 주의사항:
 * - textDirection은 특별한 이유 없이 'auto'를 사용할 것 (앱이 기하학적으로 자동 배치)
 * - triangle-right의 직각 꼭짓점은 반드시 text:'90°', visible:false 형태로 유지
 *   (applyAnnotatedTriangleRightLengths가 직각 꼭짓점 감지에 text 값을 사용)
 * - 좌표 비율이 실제 길이(cm)와 일치하도록 유지할 것 (1 grid = 1cm)
 */

// ---- 개별 타입 예시 ----

const EXAMPLE_TRIANGLE_RIGHT = {
  shapes: [{
    type: 'triangle-right',
    // C가 90° 꼭짓점. 배치 순서: C(직각 코너) 먼저, 그 다음 A·B를 수직 방향으로 offset.
    // C=(20,26), A=(20,23) [C에서 3 위 → leg CA=3cm], B=(26,26) [C에서 6 오른쪽 → leg CB=6cm]
    // AB=빗변 (C의 반대편) → lengthItems[0] 숨김 (right angle at index 2 → hide lengthItems[0])
    points: [{ gridX: 20, gridY: 23 }, { gridX: 26, gridY: 26 }, { gridX: 20, gridY: 26 }],
    pointLabels: ['A', 'B', 'C'],
    guideVisibility: { pointName: true, point: false, length: true, angle: true, height: false, radius: false },
    circleMeasureMode: null,
    lengthItems: [
      { visible: false, textMode: 'normal', textDirection: 'auto' },             // index 0: A→B 빗변 (C의 반대편 → HIDDEN)
      { text: '6cm', visible: true, textMode: 'normal', textDirection: 'auto' }, // index 1: B→C 수평 변 (CB=6cm)
      { text: '3cm', visible: true, textMode: 'normal', textDirection: 'auto' }, // index 2: C→A 수직 변 (CA=3cm)
    ],
    angleItems: [
      { text: '30°', visible: true, textMode: 'normal', textDirection: 'auto' },   // index 0: A의 각도
      { text: '60°', visible: true, textMode: 'normal', textDirection: 'auto' },   // index 1: B의 각도
      { text: '90°', visible: false, textMode: 'normal', textDirection: 'auto' },  // index 2: C의 각도 (직각 마커 자동 렌더 — 텍스트 숨김, text값은 좌표 보정용으로 반드시 유지)
    ],
    heightItem: null,
    showUnit: true,
  }],
  guides: [],
}

const EXAMPLE_CIRCLE = {
  shapes: [{
    type: 'circle',
    // center=(32,18), edge=(35,18) → radius=3 grid units=3cm
    // pointLabels[0]='ㅇ' is the center label → rendered near the center
    // guideVisibility.point:true → shows a filled dot at the center
    points: [{ gridX: 32, gridY: 18 }, { gridX: 35, gridY: 18 }],
    pointLabels: ['ㅇ'],
    guideVisibility: { pointName: true, point: true, length: true, angle: false, height: false, radius: true },
    circleMeasureMode: 'radius',
    lengthItems: [{ text: '3cm', visible: true, textMode: 'normal', textDirection: 'auto' }],
    angleItems: null,
    heightItem: null,
    showUnit: true,
  }],
  guides: [],
}

const EXAMPLE_RECT_RECTANGLE = {
  shapes: [{
    type: 'rect-rectangle',
    // 시계 방향 4꼭짓점: 좌상→우상→우하→좌하
    // lengthItems[0]=상변, [1]=우변, [2]=하변(숨김), [3]=좌변(숨김)
    points: [{ gridX: 14, gridY: 10 }, { gridX: 50, gridY: 10 }, { gridX: 50, gridY: 28 }, { gridX: 14, gridY: 28 }],
    pointLabels: null,
    guideVisibility: { pointName: false, point: false, length: true, angle: false, height: false, radius: false },
    circleMeasureMode: null,
    lengthItems: [
      { text: '8cm', visible: true, textMode: 'normal', textDirection: 'auto' },  // index 0: 상변
      { text: '6cm', visible: true, textMode: 'normal', textDirection: 'auto' },  // index 1: 우변
      { visible: false, textMode: 'normal', textDirection: 'auto' },              // index 2: 하변 (대칭이므로 숨김)
      { visible: false, textMode: 'normal', textDirection: 'auto' },              // index 3: 좌변 (대칭이므로 숨김)
    ],
    angleItems: null,
    heightItem: null,
    showUnit: true,
  }],
  guides: [],
}

const EXAMPLE_SEGMENT = {
  shapes: [{
    type: 'segment',
    points: [{ gridX: 12, gridY: 18 }, { gridX: 52, gridY: 18 }],
    pointLabels: ['A', 'B'],
    guideVisibility: { pointName: true, point: true, length: true },
    circleMeasureMode: null,
    lengthItems: [{ text: '5cm', visible: true, textMode: 'normal', textDirection: 'auto' }],
    angleItems: null,
    heightItem: null,
    showUnit: true,
  }],
  guides: [],
}

const EXAMPLE_ANGLE_LINE = {
  shapes: [{
    type: 'angle-line',
    // points[0]=한쪽 끝, points[1]=꼭짓점(각도 측정점), points[2]=다른쪽 끝
    points: [{ gridX: 10, gridY: 26 }, { gridX: 32, gridY: 18 }, { gridX: 54, gridY: 26 }],
    pointLabels: null,
    guideVisibility: { angle: true },
    circleMeasureMode: null,
    lengthItems: null,
    angleItems: [{ text: '60°', visible: true, textMode: 'normal', textDirection: 'auto' }],
    heightItem: null,
    showUnit: false,
  }],
  guides: [],
}

const EXAMPLE_FREE_SHAPE = {
  shapes: [{
    type: 'free-shape',
    points: [
      { gridX: 16, gridY: 20 },
      { gridX: 24, gridY: 10 },
      { gridX: 38, gridY: 8 },
      { gridX: 48, gridY: 18 },
      { gridX: 40, gridY: 30 },
      { gridX: 24, gridY: 28 },
    ],
    pointLabels: ['A', 'B', 'C', 'D', 'E', 'F'],
    guideVisibility: { pointName: true, point: false, length: false, angle: false, height: false, radius: false },
    circleMeasureMode: null,
    lengthItems: null,
    angleItems: null,
    heightItem: null,
    showUnit: false,
  }],
  guides: [],
}

// ---- 정삼각형 전용 예시 ----
// 시계 방향(CW): ㄱ(상) → ㄴ(우하) → ㄷ(좌하)
// side=5cm → points[0]과 points[1] 사이 거리 = 5 grid units (app이 equilateral로 snap)
// 변 길이는 한 변에만 표시 (등변이므로): 이미지에서 5cm가 보이는 변의 index에만 visible:true
//   lengthItems[0]=ㄱ→ㄴ(우변), [1]=ㄴ→ㄷ(밑변), [2]=ㄷ→ㄱ(좌변)
//   5cm가 좌변에 표시된 경우 → lengthItems[2] visible:true, 나머지 visible:false
// 각도 빈칸: 이미지에 □ 박스가 그려진 꼭짓점 위치 → textMode:"blank", visible:true, detached:false
const EXAMPLE_TRIANGLE_EQUILATERAL = {
  shapes: [{
    type: 'triangle-equilateral',
    // CW: ㄱ(top) → ㄴ(bottom-right) → ㄷ(bottom-left)
    // distance(ㄱ,ㄴ) ≈ 5 grid units (app snaps ㄷ to exact equilateral)
    points: [{ gridX: 32, gridY: 22 }, { gridX: 34, gridY: 26 }, { gridX: 29, gridY: 26 }],
    pointLabels: ['ㄱ', 'ㄴ', 'ㄷ'],
    guideVisibility: { pointName: true, point: false, length: true, angle: true, height: false, radius: false },
    circleMeasureMode: null,
    lengthItems: [
      { visible: false, textMode: 'normal', textDirection: 'auto' },               // index 0: ㄱ→ㄴ (우변 — 등변이므로 숨김)
      { visible: false, textMode: 'normal', textDirection: 'auto' },               // index 1: ㄴ→ㄷ (밑변 — 등변이므로 숨김)
      { text: '5cm', visible: true, textMode: 'normal', textDirection: 'auto' },  // index 2: ㄷ→ㄱ (좌변 — 이미지에서 5cm가 이 변에 표시됨)
    ],
    angleItems: [
      { text: '60°', visible: true, textMode: 'normal', textDirection: 'auto' },              // index 0: ㄱ 각도
      { visible: true, textMode: 'blank', textDirection: 'auto', detached: false },           // index 1: ㄴ 각도 — □ 블랭크 (inline)
      { text: '60°', visible: true, textMode: 'normal', textDirection: 'auto' },              // index 2: ㄷ 각도
    ],
    heightItem: null,
    showUnit: true,
  }],
  guides: [],
}

// ---- fallback 그룹 예시 (type을 동적으로 채움) ----

function makeTriangleDefault(type: ShapeType) {
  return {
    shapes: [{
      type,
      // A=꼭짓점(상), B=좌하, C=우하
      points: [{ gridX: 32, gridY: 8 }, { gridX: 14, gridY: 28 }, { gridX: 50, gridY: 28 }],
      pointLabels: ['A', 'B', 'C'],
      guideVisibility: { pointName: true, point: false, length: true, angle: false, height: false, radius: false },
      circleMeasureMode: null,
      lengthItems: [
        { text: '5cm', visible: true, textMode: 'normal', textDirection: 'auto' }, // index 0: A→B
        { text: '4cm', visible: true, textMode: 'normal', textDirection: 'auto' }, // index 1: B→C (밑변)
        { text: '5cm', visible: true, textMode: 'normal', textDirection: 'auto' }, // index 2: C→A
      ],
      angleItems: null,
      heightItem: null,
      showUnit: true,
    }],
    guides: [],
  }
}

function makeRectDefault(type: ShapeType) {
  return {
    shapes: [{
      type,
      points: [{ gridX: 14, gridY: 10 }, { gridX: 50, gridY: 10 }, { gridX: 50, gridY: 28 }, { gridX: 14, gridY: 28 }],
      pointLabels: null,
      guideVisibility: { length: true },
      circleMeasureMode: null,
      lengthItems: [
        { text: '8cm', visible: true, textMode: 'normal', textDirection: 'auto' },
        { text: '6cm', visible: true, textMode: 'normal', textDirection: 'auto' },
        { visible: false, textMode: 'normal', textDirection: 'auto' },
        { visible: false, textMode: 'normal', textDirection: 'auto' },
      ],
      angleItems: null,
      heightItem: null,
      showUnit: true,
    }],
    guides: [],
  }
}

function makeLineDefault(type: ShapeType) {
  return {
    shapes: [{
      type,
      points: [{ gridX: 12, gridY: 18 }, { gridX: 52, gridY: 18 }],
      pointLabels: null,
      guideVisibility: {},
      circleMeasureMode: null,
      lengthItems: null,
      angleItems: null,
      heightItem: null,
      showUnit: false,
    }],
    guides: [],
  }
}

// ---- 이등변삼각형 예시 ----
// 꼭짓점 ㄱ(apex=top), ㄴ(base-left), ㄷ(base-right)
// 다리(legs): ㄱ-ㄴ = ㄷ-ㄱ = 6cm, 밑변: ㄴ-ㄷ = 4cm
// 높이 h = √(6²-2²) = √32 ≈ 5.66 grid units
// 기준 배치: base center=(32,24) → ㄴ=(30,24), ㄷ=(34,24), ㄱ=(32,18)
// SCALE 주의: 6cm = 6 grid units. 그리드를 채우려고 크게 그리면 안 됨.
// app이 computeIsoscelesApex로 정확한 수직이등분선 위치로 보정함
const EXAMPLE_TRIANGLE_ISOSCELES = {
  shapes: [{
    type: 'triangle-isosceles',
    points: [{ gridX: 32, gridY: 18 }, { gridX: 30, gridY: 24 }, { gridX: 34, gridY: 24 }],
    pointLabels: ['ㄱ', 'ㄴ', 'ㄷ'],
    guideVisibility: { pointName: true, point: false, length: true, angle: true, height: true, radius: false },
    circleMeasureMode: null,
    lengthItems: [
      { text: '6cm', visible: true, textMode: 'normal', textDirection: 'auto' },  // index 0: ㄱ→ㄴ (다리)
      { text: '4cm', visible: true, textMode: 'normal', textDirection: 'auto' },  // index 1: ㄴ→ㄷ (밑변)
      { text: '6cm', visible: true, textMode: 'normal', textDirection: 'auto' },  // index 2: ㄷ→ㄱ (다리)
    ],
    angleItems: [
      { visible: false, textMode: 'normal', textDirection: 'auto' },                               // index 0: ㄱ 숨김
      { visible: false, textMode: 'normal', textDirection: 'auto' },                               // index 1: ㄴ 숨김
      { text: '70°', visible: true, textMode: 'normal', textDirection: 'auto' },                   // index 2: ㄷ 표시
    ],
    heightItem: { text: '5.6cm', textMode: 'normal', textDirection: 'auto' },
    showUnit: true,
  }],
  guides: [],
}

// ---- 공개 API ----

const NAMED_EXAMPLES: Partial<Record<ShapeType, object>> = {
  'triangle-right': EXAMPLE_TRIANGLE_RIGHT,
  'triangle-isosceles': EXAMPLE_TRIANGLE_ISOSCELES,
  'triangle-equilateral': EXAMPLE_TRIANGLE_EQUILATERAL,
  'circle': EXAMPLE_CIRCLE,
  'rect-rectangle': EXAMPLE_RECT_RECTANGLE,
  'segment': EXAMPLE_SEGMENT,
  'angle-line': EXAMPLE_ANGLE_LINE,
  'free-shape': EXAMPLE_FREE_SHAPE,
}

export function buildShapeExample(type: ShapeType): string {
  const named = NAMED_EXAMPLES[type]
  if (named) return JSON.stringify(named, null, 2)

  if (type === 'triangle' || type === 'triangle-equilateral' || type === 'triangle-isosceles') {
    return JSON.stringify(makeTriangleDefault(type), null, 2)
  }
  if (type === 'rect-square' || type === 'rect-rhombus' || type === 'rect-parallelogram' || type === 'rect-trapezoid') {
    return JSON.stringify(makeRectDefault(type), null, 2)
  }
  if (type === 'line' || type === 'ray' || type === 'arrow' || type === 'arrow-curve') {
    return JSON.stringify(makeLineDefault(type), null, 2)
  }
  return JSON.stringify(makeTriangleDefault(type), null, 2)
}
