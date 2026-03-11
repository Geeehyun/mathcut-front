# MathCut 코드 리뷰 보고서

**작성**: Claude Sonnet 4.6
**작성일**: 2026-03-10
**대상**: `src/` 전체 (약 8,700줄)
**목적**: 구조적 문제 파악 → Codex 리팩토링 계획 수립용 선행 문서

---

## 개요

아키텍처 설계는 Claude, 세부 기능 구현은 Codex가 담당하며 진행된 프로젝트입니다.
전체적인 데이터 흐름과 상태 분리 전략은 건전하지만, 구현 과정에서 **중복**, **책임 과잉**, **타입 불일치** 등 다수의 개선 포인트가 축적되었습니다.

---

## 심각도 분류

| 레벨 | 설명 |
|------|------|
| 🔴 **Critical** | 버그 또는 즉시 수정 필요 |
| 🟠 **High** | 유지보수성·확장성에 심각한 영향 |
| 🟡 **Medium** | 코드 품질·일관성 문제 |
| 🟢 **Low** | 스타일·소규모 개선 |

---

## 1. 구조적 문제 (Architecture)

---

### 🔴 [A-1] `GridCanvas.vue` — 5,250줄 God Component

**파일**: `src/components/canvas/GridCanvas.vue`

전체 코드베이스의 약 60%를 하나의 컴포넌트가 차지합니다.

```
책임 분석 (현재 GridCanvas.vue 내부):
├── 마우스/터치 이벤트 핸들러  (~400줄)
├── 드래그 상태 관리            (~200줄)
├── 도형 렌더링 계산 함수        (~600줄)
├── 가이드 렌더링 계산 함수      (~500줄)
├── 높이 보조선 계산             (~300줄)
├── 곡선 분할/폴리라인 계산      (~300줄)
├── 빈칸형(blank) 처리           (~150줄)
├── SVG 벡터 내보내기            (~350줄)
├── PNG/PDF 래스터 내보내기      (~100줄)
├── 텍스트 입력 UI               (~100줄)
└── Konva 템플릿                 (~1,200줄)
```

**영향**:
- 새 기능 추가 시 올바른 위치를 찾기 어려움
- 비슷한 코드가 Konva 렌더링부와 SVG 생성부에 이중 구현되어 버그 원천
- 테스트 불가능한 구조

---

### 🟠 [A-2] `openShapeTypes` 중복 정의

**파일**: `useShape.ts:29`, `GridCanvas.vue:3183`

```typescript
// useShape.ts:29
const openShapeTypes = new Set(['segment', 'ray', 'line', 'angle-line', 'arrow', 'arrow-curve'])

// GridCanvas.vue:3183 — 동일한 Set이 다시 선언됨
const openShapeTypes = new Set(['segment', 'ray', 'line', 'angle-line', 'arrow', 'arrow-curve'])
```

두 Set이 동기화 안 될 경우 특정 ShapeType이 한쪽에서만 open으로 처리되는 버그 발생 가능.

**해결**: `types/index.ts` 또는 별도 `constants.ts`에서 단일 정의 후 import.

---

### 🟠 [A-3] 높이 기본 표시 타입 중복 정의

**파일**: `useShape.ts:30-38`, `GridCanvas.vue:1306-1314`

```typescript
// useShape.ts:30
const defaultHeightVisibleTypes = new Set([
  'triangle', 'triangle-equilateral', 'triangle-isosceles', 'triangle-free',
  'rect-trapezoid', 'rect-rhombus', 'rect-parallelogram'
])

// GridCanvas.vue:1306 — 동일 목록을 if 체인으로 재구현
function isShapeHeightDefaultVisible(shape: Shape): boolean {
  return shape.type === 'triangle'
    || shape.type === 'triangle-free'
    || shape.type === 'triangle-equilateral'
    || shape.type === 'triangle-isosceles'
    || shape.type === 'rect-trapezoid'
    || shape.type === 'rect-rhombus'
    || shape.type === 'rect-parallelogram'
}
```

**해결**: `openShapeTypes`와 함께 공통 상수 파일로 추출.

---

### 🟠 [A-4] SVG 생성 로직 — Konva 렌더링과 이중 구현

**파일**: `GridCanvas.vue:3340-3665`

Konva 렌더링 코드(`<template>`)와 SVG 생성 코드(`generateVectorSVG`)가 모두 같은 도형/가이드 목록을 순회하며 거의 동일한 좌표 계산을 수행합니다.

예시 — 길이 가이드 라벨 위치를 구하는 함수:
- Konva 렌더링: `getShapeLengthLabelPos()` → template에서 `:x` 속성으로 사용
- SVG 생성: `generateVectorSVG()` 내부에서 동일 로직을 직접 인라인으로 재작성

양쪽 중 하나에 버그가 생겨도 다른 쪽에 반영이 안 됩니다. 실제로 "SVG 점선 누락", "SVG cm 간격 불일치" 등의 버그가 이 구조에서 비롯되었습니다.

---

## 2. 타입 안전성 (Type Safety)

---

### 🔴 [T-1] `patchShapeGuideItemStyle` patch 타입 미완성

**파일**: `src/stores/canvas.ts:265`

```typescript
// canvas.ts — patch 타입에 새로 추가된 필드들이 없음
function patchShapeGuideItemStyle(
  id: string,
  key: '...',
  itemIndex: number,
  patch: { color?: string, fontSize?: number, lineWidth?: number, offsetX?: number, offsetY?: number, curveSide?: 1 | -1 },
  //                ^^^^ heightLineColor, measureLineColor, textColor, textMode, blankWidthMm 등 누락
  ...
)

// types/index.ts — 실제 사용 중인 필드들
interface ShapeGuideItemStyle {
  color?: string
  textColor?: string        // ← patch 타입에 없음
  lineColor?: string        // ← patch 타입에 없음
  curveSide?: 1 | -1
  heightLineColor?: string  // ← patch 타입에 없음
  heightLineWidth?: number  // ← patch 타입에 없음
  measureLineColor?: string // ← patch 타입에 없음
  measureLineWidth?: number // ← patch 타입에 없음
  textMode?: 'normal' | 'blank' // ← patch 타입에 없음
  blankWidthMm?: number         // ← patch 타입에 없음
  blankSizeMm?: number          // ← patch 타입에 없음
  ...
}
```

TypeScript 컴파일러가 이를 잡지 못하는 이유: `patch` 객체를 `{ ...prev, ...patch }`로 spread하기 때문에 런타임 동작은 하지만, TypeScript는 `patch`에 없는 필드를 전달할 경우 타입 오류를 잡지 못합니다.

**해결**: `patch: Partial<ShapeGuideItemStyle>` 로 통일.

---

### 🔴 [T-2] `rawToPoint` — gridX/gridY 계산 오류

**파일**: `src/composables/useGuide.ts:183-190`

```typescript
function rawToPoint(rawPoint: { x: number, y: number }): Point {
  return {
    x: rawPoint.x,
    y: rawPoint.y,
    gridX: Math.round(rawPoint.x),  // ❌ 버그: x 픽셀값이 그대로 gridX가 됨
    gridY: Math.round(rawPoint.y)   // ❌ 버그: y 픽셀값이 그대로 gridY가 됨
  }
}
// 올바른 계산:
// gridX: rawPoint.x / GRID_CONFIG.size
// gridY: rawPoint.y / GRID_CONFIG.size
```

이 함수로 만들어진 `bendRef` Point는 방향 판정(`getLengthGuideControlPoint`)에만 사용되어 현재는 기능 버그가 없지만, 나중에 이 Point를 좌표로 사용하면 20배 오차가 발생합니다. `Point` 인터페이스 계약 위반.

---

### 🟠 [T-3] `getShapeGuideItemStyle` 반환 타입 `{}`

**파일**: `GridCanvas.vue:1366-1368`

```typescript
function getShapeGuideItemStyle(shape: Shape, key: '...', index: number) {
  return shape.guideStyleMap?.[key]?.[index] || {}  // 반환 타입: ShapeGuideItemStyle | {}
}
```

빈 객체 `{}`가 기본값이 되면서 TypeScript가 반환 타입을 `ShapeGuideItemStyle | {}`로 추론합니다. 이를 사용하는 곳에서 모든 속성 접근이 `undefined | string` 등으로 퍼져나갑니다.

**해결**: 반환 타입을 `ShapeGuideItemStyle`로 명시, 기본값을 `{} as ShapeGuideItemStyle`.

---

### 🟠 [T-4] Konva 노드 타입 `any` 남용

**파일**: `GridCanvas.vue:1124-1145`

```typescript
function getShapeIdFromNode(node: any): string | null {  // any
function getGuideIdFromNode(node: any): string | null {  // any
```

내부에서 `node.name()`, `node.getParent()` 등을 호출하는데 타입 안전성이 없습니다. `vue-konva`가 Konva 타입을 노출하지 않는 제약이 있더라도 최소한 `unknown`으로 받고 타입 가드를 사용해야 합니다.

---

### 🟡 [T-5] `counter` ShapeType 미처리

**파일**: `types/index.ts:30`, `useShape.ts:73-97`

```typescript
// types/index.ts
type ShapeType = ... | 'counter'  // 정의되어 있음

// useShape.ts — requiredPoints에 없음
const requiredPoints: Record<string, number> = {
  rectangle: 4, triangle: 3, ...
  // 'counter': ?? — 누락
}
```

`counter`는 RequiredPoints 맵에 없어서 클릭해도 도형이 완성되지 않고, SVG 내보내기에서도 렌더링 로직이 없습니다. 구현 예정이라면 TODO 주석이 있어야 합니다.

---

## 3. 버그 및 로직 오류 (Bugs)

---

### 🔴 [B-1] `handleMouseLeave`에서 동일 라인 이중 초기화

**파일**: `GridCanvas.vue:468`

```typescript
function handleMouseLeave() {
  ...
  hoveredGuideTextKey.value = null  // 467라인
  hoveredGuideTextKey.value = null  // 468라인 — 중복
  ...
}
```

실제 버그는 아니지만, 한쪽에서 다른 변수를 설정하려다 실수로 동일 변수를 두 번 설정한 것으로 보입니다.

---

### 🟠 [B-2] `calculateAngle` 중복 구현 — 미묘한 차이

**파일**: `useGuide.ts:134-164`, `GridCanvas.vue:1490-1504`

```typescript
// useGuide.ts — 독립 가이드(클릭으로 생성)의 각도 계산
function calculateAngle(points: Point[]): string {
  const dotProduct = v1x * v2x + v1y * v2y
  if (Math.abs(dotProduct) < 1) return '90°'  // 직각 판별 임계값: 1
  ...
}

// GridCanvas.vue — 도형 내장 가이드의 각도 계산
function getShapeAngleValueText(shape: Shape, index: number): string {
  const dot = v1x * v2x + v1y * v2y
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)))
  const angleDeg = (Math.acos(cos) * 180) / Math.PI
  return `${angleDeg.toFixed(1)}°`  // 직각이어도 '90.0°'로 표시
}
```

같은 각도가 어느 방식으로 표시되느냐에 따라 `90°` 또는 `90.0°`로 다르게 보입니다.

---

### 🟠 [B-3] `withCircleOppositePoint` 스코프 위반

**파일**: `src/stores/canvas.ts:437-452`

```typescript
export const useCanvasStore = defineStore('canvas', () => {
  ...
  return { ... }
})  // ← 스토어 클로저 종료

// ↓ 스토어 밖에 함수가 정의되어 있음
function withCircleOppositePoint(shape: Shape): Shape {
  ...
}
```

`defineStore`의 닫는 `})`가 먼저 오고, `withCircleOppositePoint`는 그 아래에 있습니다. JavaScript 함수 선언의 호이스팅으로 동작하지만, 스토어 내부 함수처럼 보이는 착각을 줍니다. 스토어 클로저 안으로 이동해야 합니다.

---

### 🟡 [B-4] `useShape.ts`와 `GridCanvas.vue`에서 `counter` 제외 방식 불일치

```typescript
// useShape.ts:144-148
const isOpenOrPoint = openShapeTypes.has(normalizedType)
  || normalizedType === 'point'
  || normalizedType === 'point-on-object'
// 'counter'는 어떻게 처리?

// GridCanvas.vue에서 counter는 별도 케이스
```

---

## 4. 코드 품질 (Code Quality)

---

### 🟠 [Q-1] 히스토리 메모리 누수 — 상한 없음

**파일**: `src/stores/canvas.ts:32-41`

```typescript
function saveHistory() {
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push({ ... })  // 무한 증가
  historyIndex.value = history.value.length - 1
}
```

undo/redo를 거의 안 쓰고 도형을 많이 추가하면 메모리가 계속 증가합니다. 통상 50~100개 제한이 적절합니다.

---

### 🟠 [Q-2] `getShapeAngleLabelPos` — 200줄 단일 함수

**파일**: `GridCanvas.vue:1510-1640`

직각/둔각/예각, 라벨 충돌 방지, 이등분선 계산, 경계 클램핑 등 6~7가지 다른 책임이 한 함수 안에 있습니다. 함수 내 nested 로직이 4단계까지 들어가며 테스트가 불가능한 구조입니다.

---

### 🟠 [Q-3] `getLengthGuideSegments` — 매직 넘버 집합

**파일**: `GridCanvas.vue:2010-2096`

```typescript
const cutGapPx = Math.max(14, gapPx * 0.62)
const sideMargin = Math.max(0.9, fontSize * 0.08)
const textHalfW = Math.max(6.2, gapPx * 0.42 - 8.5)
const textHalfH = Math.max(3.6, fontSize * 0.62)
```

`0.62`, `0.42`, `8.5`, `6.2`, `3.6`, `0.08` 등 경험적으로 튜닝된 매직 넘버들이 주석 없이 흩어져 있어 수정 시 의도 파악 불가.

---

### 🟡 [Q-4] `selectionThreshold` 불일치

**파일**: `useGuide.ts:21`, `GridCanvas.vue:1149`

```typescript
// useGuide.ts
const selectionThreshold = 14  // 가이드 드래그 감지

// GridCanvas.vue — findGuideIdFromRawPoint
const threshold = 20  // 우클릭 가이드 감지
```

같은 "클릭 감지 반경" 개념인데 14px과 20px로 달라서 우클릭할 때와 드래그할 때의 감지 영역이 다릅니다. 동일한 상수를 써야 합니다.

---

### 🟡 [Q-5] `getShapeGuideBlankUnitPos`와 `getShapeGuideBlankSuffixPos` 거의 동일

**파일**: `GridCanvas.vue:2150-2166`

```typescript
function getShapeGuideBlankUnitPos(shape, key: 'length' | 'height', index): { x, y } {
  const rect = getShapeGuideBlankRect(shape, key, index)
  const fontSize = ...
  return {
    x: rect.x + rect.width + (GRID_CONFIG.size / 2),  // cm용 gap
    y: rect.y + (rect.height / 2) - (fontSize * 0.5)
  }
}

function getShapeGuideBlankSuffixPos(shape, key: 'length' | 'angle' | 'height', index): { x, y } {
  const rect = getShapeGuideBlankRect(shape, key, index)
  const fontSize = ...
  return {
    x: rect.x + rect.width + 4,  // ° 용 gap
    y: rect.y + (rect.height / 2) - (fontSize * 0.5)
  }
}
```

x 오프셋(`GRID_CONFIG.size / 2` vs `4`)만 다르고 나머지가 동일. gap을 파라미터로 받는 단일 함수로 통합 가능.

---

### 🟡 [Q-6] `getColors` 내부 매직 컬러 하드코딩

**파일**: `GridCanvas.vue:1270-1292`

```typescript
function getColors(shape: Shape) {
  const circleDefaultPointColor = '#E6007E'  // 함수 안에 하드코딩
  ...
}
```

이 값은 `colorPalette.ts`의 `STROKE_PALETTE.magenta100`과 동일하지만 직접 연결이 없습니다. 팔레트 색상이 바뀌어도 이 값은 그대로입니다.

---

### 🟡 [Q-7] `setGridMode` 파라미터 섀도잉

**파일**: `src/stores/tool.ts:64`

```typescript
const mode = ref<ModeType>('select')  // 외부 state

function setGridMode(mode: GridMode) {  // ← 파라미터가 외부 mode를 가림
  gridMode.value = mode  // 이건 파라미터의 mode (의도대로 동작하지만 혼란)
}
```

파라미터를 `newMode` 또는 `gridMode`로 rename.

---

### 🟡 [Q-8] `logAngleGuidePlacement` — 불명확한 이름과 역할

**파일**: `GridCanvas.vue:1643`

함수명이 "log"지만 실제로 콘솔 출력인지, 히스토리 기록인지, 다른 무언가인지 파악이 안 됩니다. 코드를 보지 않고는 의도를 알 수 없습니다.

---

### 🟡 [Q-9] `getShapeBottomBaseEdgeIndex`와 `getShapeHeightBaseEdgeIndex` 유사 중복

**파일**: `GridCanvas.vue:2698-2722`

```typescript
function getShapeBottomBaseEdgeIndex(shape: Shape): number { ... }
function getShapeHeightBaseEdgeIndex(shape: Shape): number {
  if (typeof shape.heightBaseEdgeIndex === 'number') return shape.heightBaseEdgeIndex
  return getShapeBottomBaseEdgeIndex(shape)  // 위임
}
```

`getShapeHeightBaseEdgeIndex`는 거의 `getShapeBottomBaseEdgeIndex`의 래퍼입니다. 이름 차이가 명확하지 않아 호출 위치에서 어느 것을 써야 하는지 혼란.

---

## 5. 성능 (Performance)

---

### 🟡 [P-1] `canvasStore.shapes.find(...)` 반복 호출

**파일**: `GridCanvas.vue` 전반

이벤트 핸들러에서 같은 shapeId로 `canvasStore.shapes.find(s => s.id === shapeId)`를 여러 번 호출합니다. 도형이 많아지면 O(n) 탐색이 반복됩니다.

**해결**: ID → Shape의 Map을 `computed`로 만들어 O(1) 접근.

---

### 🟡 [P-2] `textMeasureCanvas` 모듈 레벨 변수

**파일**: `GridCanvas.vue:2181`

```typescript
let textMeasureCanvas: HTMLCanvasElement | null = null
```

모듈 레벨 변수라서 컴포넌트 언마운트 후에도 메모리에 남습니다. `ref` 또는 컴포넌트 스코프 변수로 이동 필요.

---

### 🟡 [P-3] `createQuadraticCurvePoints` segments=24 — 불필요한 고해상도

**파일**: `geometry.ts:264`

모든 길이 가이드 곡선을 24개 점으로 샘플링합니다. 화면에서는 12개로도 충분하며, 폴리라인 충돌 감지(`distancePointToPolyline`)도 24개 세그먼트를 순회합니다.

---

## 6. 코드 일관성 (Consistency)

---

### 🟡 [C-1] `useGuide.ts`의 exported 함수명 불일치

**파일**: `src/composables/useGuide.ts:291`

```typescript
return {
  ...
  createTextGuide: completeTextGuide  // 내부 이름: completeTextGuide, 외부 이름: createTextGuide
}
```

함수 내부 이름과 반환 시 외부 이름이 다릅니다. `useShape.ts`는 그대로 export하는 것과 일관성이 없습니다.

---

### 🟡 [C-2] 가이드 스타일 접근 패턴 불일치

**파일**: `GridCanvas.vue`

```typescript
// 어떤 곳은:
const style = getShapeGuideItemStyle(shape, key, index)
return style.textColor || style.color || fallback

// 다른 곳은:
getShapeGuideTextColor(shape, key, index, fallback)  // 위를 감싼 헬퍼

// 또 다른 곳은:
shape.guideStyleMap?.[key]?.[index]?.color  // 직접 접근
```

같은 데이터에 3가지 방식으로 접근하고 있어 일관성이 없습니다.

---

### 🟡 [C-3] `ShapeGuideVisibility` — boolean vs 배열 혼용

**파일**: `types/index.ts:41-52`

```typescript
interface ShapeGuideVisibility {
  length?: boolean           // ← 전체 표시/숨김 (boolean)
  lengthHiddenIndices?: number[]  // ← 개별 항목 숨김 (배열)
  // 두 접근이 함께 사용됨
}
```

`length === false`이면 모두 숨김, `lengthHiddenIndices = [0, 2]`이면 특정 항목만 숨김 — 두 레벨의 제어가 혼재합니다. 어떤 경우에 어느 것을 확인해야 하는지 명확한 우선순위 문서가 없습니다.

---

## 7. 미사용·미구현 코드

---

### 🟡 [U-1] `counter` ShapeType — 미구현

`types/index.ts`에 `'counter'`가 타입에 포함되어 있으나 어디에서도 실제 렌더링 로직이 없습니다.

---

### 🟡 [U-2] `xlsx` 의존성 — 사용처 불명확

**파일**: `package.json`

```json
"xlsx": "^0.18.5"
```

프로젝트 어디에서도 import가 없습니다. 제거 필요.

---

### 🟡 [U-3] `AppFooter.vue` — 빈 컴포넌트

현재 푸터는 렌더링할 내용이 없는 빈 컴포넌트입니다. 기능이 없으면 파일 자체가 없어야 합니다.

---

## 8. 긍정적 평가 (잘 된 부분)

잘못된 것만 있는 건 아닙니다. 다음은 설계가 잘 된 부분입니다:

1. **Pinia 스토어 책임 분리** — `useToolStore`(UI 상태)와 `useCanvasStore`(데이터)의 분리는 명확하고 바람직합니다.

2. **`geometry.ts` 함수 설계** — 기하학 계산 함수들이 순수 함수(side effect 없음)로 잘 설계되어 있습니다. 단위 테스트 대상으로 적합합니다.

3. **`ShapeGuideStyleMap` 구조** — `Record<number, ShapeGuideItemStyle>`의 sparse array 패턴은 가이드 항목별 스타일을 효율적으로 저장합니다.

4. **`computeXxx` 계산 함수들** — 특수 도형 계산 함수들이 입출력이 명확한 순수 함수로 되어 있어 재사용성이 높습니다.

5. **CMYK 기반 색상 팔레트** — 인쇄 친화적 설계 의도가 명확하게 반영되어 있습니다.

6. **히스토리의 완전 격리** — `JSON.parse(JSON.stringify(...))` 방식이 단순하지만 참조 공유로 인한 버그를 완전히 방지합니다.

---

## 9. 리팩토링 우선순위 권고

| 순위 | 항목 | 효과 | 난이도 |
|------|------|------|--------|
| 1 | [T-1] `patchShapeGuideItemStyle` 타입 수정 | 타입 안전성 | 낮음 |
| 2 | [T-2] `rawToPoint` gridX/gridY 수정 | 버그 수정 | 낮음 |
| 3 | [A-2][A-3] `openShapeTypes` 공통 상수 추출 | 중복 제거 | 낮음 |
| 4 | [B-1] `handleMouseLeave` 중복 라인 제거 | 정리 | 낮음 |
| 5 | [Q-7] `setGridMode` 파라미터 rename | 가독성 | 낮음 |
| 6 | [B-3] `withCircleOppositePoint` 스코프 이동 | 구조 명확화 | 낮음 |
| 7 | [Q-1] 히스토리 상한 추가 (50개) | 메모리 안정성 | 낮음 |
| 8 | [U-2] `xlsx` 의존성 제거 | 번들 크기 | 낮음 |
| 9 | [T-3] `getShapeGuideItemStyle` 반환 타입 명시 | 타입 안전성 | 낮음 |
| 10 | [Q-4] `selectionThreshold` 통일 | 일관성 | 낮음 |
| 11 | [Q-6] 매직 컬러 상수화 | 가독성 | 낮음 |
| 12 | [A-1] GridCanvas.vue 분리 | 유지보수성 | 높음 |
| 13 | [P-1] shapes ID→Map 캐싱 | 성능 | 중간 |

---

## 10. GridCanvas.vue 분리 방향 (참고)

[A-1]의 구체적 분리 방향 제안 (구현은 이후 단계에서):

```
GridCanvas.vue (500줄 목표)
├── useCanvasInteraction.ts     — 마우스/터치/키보드 이벤트
├── useCanvasRender.ts          — 렌더링 계산 함수 (좌표, 색상)
├── useCanvasExport.ts          — PNG/PDF/SVG 내보내기
└── useShapeGuideLayout.ts      — 가이드 라벨 위치 계산
```

SVG 생성 로직은 Konva 렌더링 함수를 재사용하도록 설계하면 이중 구현 문제가 해결됩니다.

---

**이 문서를 바탕으로 Codex가 구체적 작업 계획 보고서를 작성하고, 이후 Claude가 검토 후 구현을 진행합니다.**
