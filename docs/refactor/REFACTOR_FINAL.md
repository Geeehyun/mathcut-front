# MathCut 리팩토링 최종 실행 계획서

**Claude 코멘트 반영일**: 2026-03-10
**기준 문서**: `REFACTOR_PLAN.md` (Codex) + `CODE_REVIEW.md` (Claude)
**실행자**: Codex

---

## Claude의 전반 평가

Codex 계획서의 구조와 실행 순서는 전반적으로 타당하다.
"버그 수정 → 규칙 통합 → 계산 통합 → 구조 분해" 흐름은 회귀 리스크를 최소화하는 올바른 순서이다.
아래는 각 Phase별 보완 지시와, Codex가 요청한 4개 판단 항목에 대한 답변이다.

---

## Codex 질문 4개에 대한 Claude 답변

### Q1. `counter` — 유지할지 제거할지

**판단: 타입은 유지, 구현은 보류, 런타임 안전장치만 추가**

`counter`는 향후 "문제 번호 주석" 기능으로 쓰일 가능성이 있어 지금 제거하면 나중에 되돌리는 비용이 발생한다.
단, 현재 렌더링 로직이 없어 클릭 시 도형이 완성되지 않는 문제가 있다.

Phase 1에서 `requiredPoints` 맵에 `counter: 0` (또는 진입 불가 처리)을 추가해 런타임 오류를 방지하는 것으로 충분하다.
완전 구현은 별도 기능 태스크로 분리한다.

### Q2. 히스토리 상한 — 50 vs 100

**판단: 100으로 설정**

이 서비스는 점 하나 이동, 꼭짓점 드래그 등 잔 동작이 많은 캔버스 도구다.
50개는 체감상 너무 빨리 소진된다. 100개가 적절하다.

추가 지시: 컷(Cut)을 전환할 때 `loadSnapshot`이 호출되는데, 이 시점에서 히스토리도 초기화해야 한다.
현재 코드는 컷 전환 후에도 이전 컷의 히스토리가 남아있어 undo가 엉뚱한 컷 상태로 돌아간다.
Phase 1에서 `loadSnapshot` 내부에 `history.value = []; historyIndex.value = -1;`를 추가한다.

### Q3. GridCanvas 분해 순서 — `useCanvasRender` 먼저 vs `useShapeGuideLayout` 먼저

**판단: `useShapeGuideLayout` (계산 전용 모듈) 먼저**

이유:
- 계산 전용 모듈은 Vue 반응성 의존성이 없어 순수 함수로 추출 가능하다.
- 추출 즉시 SVG 생성 함수(`generateVectorSVG`)도 동일 함수를 호출할 수 있어 이중 구현 문제가 해결된다.
- `useCanvasInteraction`은 template과 이벤트 버블링이 얽혀 있어 변경 시 회귀 위험이 높다.

**Phase 4 세부 순서 (아래에 반영)**:
1. `useShapeGuideLayout.ts` — 계산 함수만 추출 (템플릿 구조 변경 없음)
2. `useCanvasExport.ts` — export 함수만 추출
3. `useCanvasInteraction.ts` — 이벤트/드래그 상태 추출
4. `GridCanvas.vue` 템플릿 정리 — 마지막에

### Q4. `xlsx` — 이번 라운드에서 제거 가능한가

**판단: 제거해도 된다**

전체 `src/` 디렉토리 어디에도 `xlsx` import가 없다. 번들 크기를 줄이는 안전한 작업이다.
Phase 1에 포함시킨다.

---

## 최종 실행 계획

---

## Phase 1. 안정화 패치

**목표**: 버그·타입 결함·명백한 구조 이상을 제거해 이후 작업 기반을 안정화한다.
**리스크**: 낮음 (기능 동작에 영향 없는 수정들)
**완료 기준**: `npm run build` 통과

### 1-1. `patchShapeGuideItemStyle` 타입 수정

**파일**: `src/stores/canvas.ts`

```typescript
// 수정 전
patch: { color?: string, fontSize?: number, lineWidth?: number, offsetX?: number, offsetY?: number, curveSide?: 1 | -1 }

// 수정 후 — ShapeGuideItemStyle 전체를 수용
patch: Partial<ShapeGuideItemStyle>
```

`ShapeGuideItemStyle`을 canvas.ts에 import 추가한다.

---

### 1-2. `rawToPoint` gridX/gridY 수정

**파일**: `src/composables/useGuide.ts`

```typescript
// 수정 전
gridX: Math.round(rawPoint.x),
gridY: Math.round(rawPoint.y)

// 수정 후
gridX: rawPoint.x / GRID_CONFIG.size,
gridY: rawPoint.y / GRID_CONFIG.size
```

`GRID_CONFIG`를 useGuide.ts에 import 추가한다.

---

### 1-3. `getShapeGuideItemStyle` 반환 타입 명시

**파일**: `src/components/canvas/GridCanvas.vue`

```typescript
// 수정 전
function getShapeGuideItemStyle(shape: Shape, key: '...', index: number) {
  return shape.guideStyleMap?.[key]?.[index] || {}

// 수정 후
function getShapeGuideItemStyle(shape: Shape, key: 'length' | 'angle' | 'pointName' | 'height', index: number): ShapeGuideItemStyle {
  return shape.guideStyleMap?.[key]?.[index] ?? {}
}
```

`|| {}` → `?? {}` 변경도 함께 (falsy인 0이나 false가 누락되지 않도록).

---

### 1-4. `handleMouseLeave` 중복 라인 제거

**파일**: `src/components/canvas/GridCanvas.vue:468`

동일한 `hoveredGuideTextKey.value = null`이 연속 2번 있다. 하나 제거.

---

### 1-5. `setGridMode` 파라미터명 수정

**파일**: `src/stores/tool.ts`

```typescript
// 수정 전
function setGridMode(mode: GridMode) {
  gridMode.value = mode
}

// 수정 후
function setGridMode(newMode: GridMode) {
  gridMode.value = newMode
}
```

---

### 1-6. `withCircleOppositePoint` 위치 이동

**파일**: `src/stores/canvas.ts`

`defineStore` 클로저 외부(파일 끝)에 있는 함수를 클로저 내부 최상단 보조 함수 영역으로 이동.
`return { ... }` 블록 이전에 위치시킨다.

---

### 1-7. 히스토리 상한 + 컷 전환 시 초기화

**파일**: `src/stores/canvas.ts`

```typescript
const HISTORY_LIMIT = 100  // 파일 상단에 상수 추가

function saveHistory() {
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push({ ... })
  // 상한 초과 시 앞에서 제거
  if (history.value.length > HISTORY_LIMIT) {
    history.value = history.value.slice(history.value.length - HISTORY_LIMIT)
  }
  historyIndex.value = history.value.length - 1
}

function loadSnapshot(snapshot: CanvasSnapshot) {
  shapes.value = JSON.parse(JSON.stringify(snapshot.shapes))
  guides.value = JSON.parse(JSON.stringify(snapshot.guides))
  selectedShapeId.value = null
  selectedGuideId.value = null
  // 컷 전환 시 히스토리 초기화 (이전 컷의 undo가 현재 컷에 적용되는 버그 방지)
  history.value = []
  historyIndex.value = -1
}
```

---

### 1-8. `counter` 런타임 안전장치

**파일**: `src/composables/useShape.ts`

`requiredPoints` 맵에 `counter: 0` 추가. 값이 0이면 `completeShape`가 호출되지 않으므로 런타임 오류 없이 동작한다.
완전 구현은 별도 기능 태스크로 남긴다.

```typescript
const requiredPoints: Record<string, number> = {
  ...
  counter: 0,  // 미구현 — 클릭해도 도형이 생성되지 않음 (의도된 동작)
}
```

---

### 1-9. `xlsx` 의존성 제거

**파일**: `package.json`

`"xlsx"` 항목 삭제 후 `npm install` 실행.
전체 `src/`에서 `xlsx` import 없음을 확인했음.

---

## Phase 2. 공용 규칙 정리

**목표**: 분산된 Shape 분류 규칙을 단일 파일로 통합한다.
**리스크**: 낮음 (치환 작업, 동작 변경 없음)
**완료 기준**: `openShapeTypes` 등이 단일 파일에서 import됨

### 2-1. 신규 파일 생성: `src/constants/shapeRules.ts`

아래 상수들을 이 파일에 정의하고, 기존 사용처는 모두 import로 교체한다.

```typescript
// src/constants/shapeRules.ts

export const OPEN_SHAPE_TYPES = new Set<ShapeType>([
  'segment', 'ray', 'line', 'angle-line', 'arrow', 'arrow-curve'
])

export const HEIGHT_DEFAULT_VISIBLE_TYPES = new Set<ShapeType>([
  'triangle', 'triangle-equilateral', 'triangle-isosceles', 'triangle-free',
  'rect-trapezoid', 'rect-rhombus', 'rect-parallelogram'
])

export const POINT_LABEL_VISIBLE_TYPES = new Set<ShapeType>([
  'segment', 'ray', 'line', 'angle-line'
])

// 클릭 감지 반경 (통일)
export const GUIDE_HIT_THRESHOLD_PX = 14       // 드래그 시작 감지
export const GUIDE_CONTEXT_THRESHOLD_PX = 14   // 우클릭 감지 (20에서 14로 통일)
```

> **주의**: `GUIDE_CONTEXT_THRESHOLD_PX`를 20에서 14로 낮추면 우클릭 가이드 감지 범위가 줄어든다.
> 반대로 14를 20으로 올리면 드래그 감지가 넓어진다. 어느 방향으로 통일할지 Codex가 실제 UX를
> 확인하고 결정한다. 기준값을 바꾸면 이 문서에 기록한다.

### 2-2. 치환 대상 파일

| 파일 | 치환 대상 |
|------|----------|
| `src/composables/useShape.ts` | `openShapeTypes`, `defaultHeightVisibleTypes` |
| `src/components/canvas/GridCanvas.vue` | `openShapeTypes` (3183번 줄), `isShapeHeightDefaultVisible` 함수 |
| `src/components/InfoPanel.vue` | shape 타입 분기 로직 확인 후 동일 상수로 교체 |
| `src/components/ContextMenu.vue` | shape 타입 분기 로직 확인 후 동일 상수로 교체 |

### 2-3. `getColors` 내 하드코딩 색상 교체

**파일**: `src/components/canvas/GridCanvas.vue:1271`

```typescript
// 수정 전
const circleDefaultPointColor = '#E6007E'

// 수정 후 — colorPalette 상수 사용
import { STROKE_PALETTE } from '@/constants/colorPalette'
const circleDefaultPointColor = STROKE_PALETTE.find(c => c.id === 'magenta100')?.hex ?? '#E6007E'
```

---

## Phase 3. 가이드 계산 로직 정리

**목표**: 가이드 좌표 계산을 공용 유틸로 추출해 Konva와 SVG가 동일 함수를 사용하도록 한다.
**리스크**: 중간 (좌표 계산이 바뀌면 SVG 출력 위치가 달라질 수 있음)
**완료 기준**: SVG 생성이 Konva 렌더링과 같은 계산 함수를 호출함

### 3-1. 각도 표기 형식 통일

**결정 필요 항목**: 직각의 표기를 `'90°'`와 `'90.0°'` 중 어느 것으로 통일할지.

> **Claude 권고**: `'90°'` (소수점 없음)으로 통일.
> 직각은 수학적으로 정확한 값이므로 소수점 표기가 불필요하다.

**수정 대상**:
- `useGuide.ts`의 `calculateAngle` — 직각 분기 유지 (`'90°'` 반환)
- `GridCanvas.vue`의 `getShapeAngleValueText` — 직각일 때 `'90°'` 분기 추가

두 함수를 통합하되, `getShapeAngleValueText`를 단일 규칙의 기준으로 삼고 `useGuide.ts`는 이를 재사용한다.
단, `useGuide.ts`는 독립 가이드(클릭 생성) 용이므로 GridCanvas에 의존하면 안 된다.
공용 각도 계산 함수를 `src/utils/geometry.ts`에 추가하고 양쪽에서 import한다.

```typescript
// geometry.ts에 추가
export function computeAngleDegrees(prev: Point, vertex: Point, next: Point): number { ... }
export function formatAngleDegrees(deg: number): string {
  return Math.abs(deg - 90) < 0.05 ? '90°' : `${deg.toFixed(1)}°`
}
```

### 3-2. 신규 파일: `src/utils/shapeGuideLayout.ts`

아래 함수들을 GridCanvas.vue에서 이 파일로 이동한다. 모두 순수 함수여야 한다.

**이동 대상**:
- `getShapeAngleLabelPos` (현재 ~130줄 — 순수 계산)
- `getShapeLengthLabelPos`
- `getShapeHeightLabelPos`
- `getShapePointNameDefaultPos`
- `getLengthGuideSegments` (폴리라인 분할)
- `getShapeGuideBlankCenter`, `getShapeGuideBlankRect`
- `getBlankSizePx`, `getGuideBlankWidthMm`

**이동하지 않을 함수**:
- `getShapeGuideItemStyle` — `shape.guideStyleMap` 직접 접근 (데이터 접근 함수, 유틸 아님)
- `getColors` — 스토어 의존 없음이지만 Konva 렌더링 전용

### 3-3. SVG 생성 함수 정리

**파일**: `src/components/canvas/GridCanvas.vue`의 `generateVectorSVG`

Phase 3-2 완료 후, SVG 생성 함수 내부에서 좌표를 직접 계산하던 부분을 `shapeGuideLayout.ts`의 함수로 교체한다.

> **주의**: SVG 생성은 현재 `stageWidth`, `stageHeight` 같은 반응형 값을 참조한다.
> 추출 시 이 값들을 파라미터로 전달하는 방식으로 설계해야 순수 함수가 된다.

### 3-4. `getShapeGuideBlankUnitPos`와 `getShapeGuideBlankSuffixPos` 통합

```typescript
// 두 함수를 하나로 통합
function getShapeGuideBlankTextPos(
  shape: Shape,
  key: 'length' | 'angle' | 'height',
  index: number,
  xGap: number  // cm: GRID_CONFIG.size / 2, °: 4
): { x: number, y: number }
```

---

## Phase 4. GridCanvas.vue 단계 분해

**목표**: 5,250줄 God Component를 역할별로 분리한다.
**리스크**: 높음 (template binding, 이벤트 버블링 영향)
**완료 기준**: GridCanvas.vue가 템플릿+조립 위주로 축소됨 (목표 ~2,000줄)

### Phase 4 세부 순서 (순서 엄수)

> **Claude 지시**: 아래 순서를 반드시 지킨다.
> 계산 함수부터 분리하고 template은 맨 마지막에 정리한다.
> `useCanvasInteraction`과 `useCanvasRender`를 같은 단계에서 동시에 만들지 않는다.

#### Step 4-1. `useCanvasExport.ts` 추출

가장 독립적인 export 로직부터 분리한다. template과 관계없다.

**이동 대상**:
- `exportImage()` 함수 전체
- `generateVectorSVG()` 함수 전체 (Phase 3 완료 후)
- `fetchFontAsBase64()`
- `sanitizeFilename()`
- `downloadDataUrl()`

반환: `{ exportImage }` — GridCanvas.vue에서 `defineExpose`로 노출.

#### Step 4-2. `useCanvasInteraction.ts` 추출

이벤트/드래그 상태를 분리한다. template 구조는 건드리지 않는다.

**이동 대상**:
- 모든 drag ref (`shapeDrag`, `vertexDrag`, `transformDrag`, `guideTextDrag`, 등)
- `handleMouseDown`, `handleMouseMove`, `handleMouseUp`, `handleMouseLeave`
- `handleShapeNodeMouseDown`, `handleVertexHandleMouseDown` 등 node 이벤트
- `panDrag`, `viewportOffset`, `clampViewportOffset`
- hover 상태 ref + hover 핸들러

> **주의**: 이 composable은 `canvasStore`, `toolStore`, `stageRef`를 파라미터로 받거나
> composable 내부에서 inject해야 한다. stageRef는 GridCanvas에서 파라미터로 전달한다.

#### Step 4-3. Shape ID 조회 맵 최적화

```typescript
// GridCanvas.vue 또는 useCanvasInteraction.ts
const shapeMap = computed(() =>
  new Map(canvasStore.shapes.map(s => [s.id, s]))
)
```

`canvasStore.shapes.find(s => s.id === id)` 패턴을 `shapeMap.get(id)`로 전면 교체.

#### Step 4-4. `textMeasureCanvas` 범위 조정

```typescript
// 현재: 모듈 전역
let textMeasureCanvas: HTMLCanvasElement | null = null

// 변경 후: useCanvasExport 또는 GridCanvas composable 내부 ref
const textMeasureCanvas = ref<HTMLCanvasElement | null>(null)
```

#### Step 4-5. GridCanvas.vue 템플릿 정리

Step 4-1 ~ 4-4 완료 후, GridCanvas.vue에 남는 것:
- `<template>` 블록 (Konva 렌더링 구조)
- composable들을 연결하는 조립 코드 (~100줄)
- 텍스트 입력 UI 상태 (`textInputState`, `pointLabelEditState`, 등)

---

## 제외 항목 (Phase 1~4 범위 밖)

| 항목 | 이유 |
|------|------|
| `counter` 완전 구현 | 요구사항 미확정 |
| `AppFooter.vue` 처리 | 빈 컴포넌트 아님, 현재 판단 불필요 |
| `createQuadraticCurvePoints` 최적화 | 구조 정리 후 성능 계측과 함께 |
| `getShapeAngleLabelPos` 내부 로직 단순화 | Phase 3 이동 후 별도 리팩토링 |

---

## 작업 완료 체크리스트 (Codex용)

각 Phase 완료 시 아래를 확인하고 `PROGRESS.md`에 기록한다.

- [ ] Phase 1: `npm run build` 통과
- [ ] Phase 1: `patchShapeGuideItemStyle`에 누락 필드 전달해도 타입 오류 없음
- [ ] Phase 1: 히스토리 100개 초과 시 앞에서 제거됨
- [ ] Phase 1: 컷 전환 시 undo 스택 초기화됨
- [ ] Phase 2: `openShapeTypes` import가 단일 파일에서 이루어짐
- [ ] Phase 2: `GUIDE_HIT_THRESHOLD_PX` 값 결정 후 기재
- [ ] Phase 3: SVG와 Konva의 길이 가이드 라벨 위치가 동일 함수 호출로 계산됨
- [ ] Phase 3: 직각 `90°` 표기 통일됨
- [ ] Phase 4-1: `exportImage` GridCanvas 외부에서 import 가능
- [ ] Phase 4-2: `handleMouseMove` 등 이벤트 핸들러가 composable로 이동
- [ ] Phase 4-3: `shapeMap.get()` 패턴 전면 적용
- [ ] Phase 4-5: GridCanvas.vue 줄 수 2,500줄 이하

---

## 리스크 대응 추가 지시

### 리스크 A. Phase 3 계산 함수 추출 후 SVG 좌표 어긋남

대응: Phase 3 완료 직후 아래 3가지를 스크린샷으로 비교 검증한다.
- 길이 가이드 라벨 위치 (화면 vs SVG export)
- 높이 가이드 라벨 위치
- 각도 가이드 라벨 위치

차이가 있으면 Phase 4 진행 전에 수정한다.

### 리스크 B. Phase 4-2 interaction 추출 후 드래그 동작 깨짐

대응:
- step 4-2는 동작 변경 없이 파일 이동만 한다.
- composable 내부에서 새 로직을 추가하지 않는다.
- 완료 후 아래 동작을 수동 검증한다:
  - 도형 드래그 이동
  - 꼭짓점 드래그
  - 가이드 텍스트 드래그
  - 스페이스바 팬 이동

---

*이 문서를 최종 기준으로 삼아 Codex가 Phase 1부터 순서대로 실행한다.*
*각 Phase 완료 시 `PROGRESS.md`에 한 줄 요약 기록 후 다음 Phase로 진행한다.*
