# MathCut 리팩토링 실행 계획서

작성일: 2026-03-10
기준 문서: `CODE_REVIEW.md`
검증 기준: 실제 코드 확인 결과 반영

## 1. 목적

이번 리팩토링의 목적은 단순한 코드 정리가 아니라 다음 3가지를 동시에 달성하는 것이다.

1. 실제 버그와 타입 결함을 먼저 제거해 작업 기반을 안정화한다.
2. 중복된 규칙과 렌더링 계산을 공용화해 이후 수정 비용을 낮춘다.
3. `GridCanvas.vue`를 한 번에 쪼개지 않고, 계산 로직과 이벤트 로직부터 분리해 안전하게 단계 분해한다.

---

## 2. 코드 확인 후 재분류한 결론

`CODE_REVIEW.md`의 큰 방향은 타당하다. 다만 실제 코드 기준으로는 아래처럼 우선순위를 다시 잡는 것이 맞다.

### 확정적으로 바로 수정해도 되는 항목

- `src/stores/canvas.ts`의 `patchShapeGuideItemStyle` 타입을 `Partial<ShapeGuideItemStyle>` 기반으로 정리
- `src/composables/useGuide.ts`의 `rawToPoint` `gridX/gridY` 계산 수정
- `src/components/canvas/GridCanvas.vue`의 `handleMouseLeave` 중복 라인 제거
- `src/stores/tool.ts`의 `setGridMode` 파라미터명 정리
- `src/stores/canvas.ts`의 `withCircleOppositePoint` 위치를 스토어 내부 구조상 더 읽기 쉬운 위치로 정리
- 히스토리 스택 상한 추가

### 단기 리팩토링으로 묶어야 하는 항목

- `openShapeTypes` 중복 제거
- 높이 기본 표시 규칙 중복 제거
- 가이드 스타일 접근 방식 통일
- 선택 임계값 상수 통일
- 매직 컬러/매직 넘버 일부 공용 상수화

### 중기 구조개편으로 다뤄야 하는 항목

- `GridCanvas.vue`의 계산 함수 분리
- Konva 렌더링과 SVG 생성 로직의 계산 공용화
- shape 조회 반복을 줄이기 위한 ID 인덱스 도입

### 보류 또는 추가 판단이 필요한 항목

- `counter`는 타입만 있고 동작이 일부만 구현된 상태라서, 유지할지 제거할지 먼저 결정이 필요
- `xlsx` 제거는 현재 미사용으로 보이지만, 예정 기능 의존성이 없는지 확인 후 처리
- `AppFooter.vue`는 빈 컴포넌트가 아니라 실제 마크업이 있으므로 이번 계획의 제거 대상에서는 제외

---

## 3. 실행 원칙

1. 동작 보존이 우선이다.
2. 한 단계에서 UI 구조 변경과 로직 변경을 동시에 하지 않는다.
3. `GridCanvas.vue` 분리는 먼저 “공용 계산 함수 추출”을 끝낸 뒤 진행한다.
4. 각 단계는 `npm run build` 기준으로 통과 가능해야 한다.

---

## 4. 단계별 실행 계획

## Phase 1. 안정화 패치

목표: 현재 보이는 결함과 타입 누수를 먼저 정리해 이후 리팩토링 리스크를 낮춘다.

대상:

- `src/stores/canvas.ts`
- `src/composables/useGuide.ts`
- `src/components/canvas/GridCanvas.vue`
- `src/stores/tool.ts`
- `src/types/index.ts`

작업:

1. `patchShapeGuideItemStyle`의 patch 타입을 `Partial<ShapeGuideItemStyle>`로 교체한다.
2. `rawToPoint`가 픽셀 좌표를 그대로 `gridX/gridY`에 넣는 문제를 수정한다.
3. `getShapeGuideItemStyle`의 반환 타입을 명시해 `{}` 유니온 누수를 막는다.
4. `handleMouseLeave` 중복 라인을 제거한다.
5. `setGridMode(mode)`의 파라미터명을 의미 있는 이름으로 바꾼다.
6. `withCircleOppositePoint`를 스토어 내부 보조 함수로 재배치한다.
7. undo/redo 히스토리 상한을 도입한다. 기본값은 `50` 또는 `100` 중 하나로 확정한다.

완료 기준:

- 타입 단에서 `guideStyle` patch 누락 필드가 사라진다.
- 가이드 생성 시 `Point`의 grid 좌표 계약이 맞춰진다.
- 빌드가 통과한다.

---

## Phase 2. 공용 규칙 정리

목표: 여러 컴포넌트에 분산된 shape 규칙과 guide 규칙을 한 곳으로 모은다.

대상:

- `src/composables/useShape.ts`
- `src/components/canvas/GridCanvas.vue`
- `src/components/InfoPanel.vue`
- `src/components/ContextMenu.vue`
- 신규 상수 파일: `src/constants/shape.ts` 또는 `src/constants/shapeRules.ts`

작업:

1. `openShapeTypes`를 공용 상수로 추출하고 전역 치환한다.
2. 높이 기본 표시 대상 shape 목록도 공용 상수/헬퍼로 추출한다.
3. `counter`를 open shape로 볼지, 별도 특수 타입으로 볼지 규칙을 하나로 정한다.
4. 선택 임계값(`14`, `20`)을 목적별 상수로 재정의한다.
5. `getColors` 내부 하드코딩 색상을 팔레트 상수 기반으로 교체한다.

완료 기준:

- shape 분류 규칙이 한 파일에 모인다.
- `InfoPanel`, `ContextMenu`, `GridCanvas`가 같은 규칙을 사용한다.
- `counter` 처리 기준이 문서와 코드에서 일치한다.

---

## Phase 3. 가이드 계산 로직 정리

목표: 길이/각도/높이 가이드의 계산 규칙을 공용화하고, Konva와 SVG가 같은 계산 결과를 쓰도록 기반을 만든다.

대상:

- `src/components/canvas/GridCanvas.vue`
- `src/composables/useGuide.ts`
- 신규 유틸 또는 composable:
  - `src/composables/useShapeGuideLayout.ts`
  - 또는 `src/utils/shapeGuideLayout.ts`

작업:

1. `calculateAngle` 중복 구현을 하나의 포맷팅 규칙으로 통합한다.
2. `getShapeAngleLabelPos`, `getLengthGuideSegments`, blank suffix/unit 위치 계산처럼 덩치 큰 계산 함수를 공용 유틸로 옮긴다.
3. 가이드 스타일 접근을 헬퍼 함수로 통일한다.
4. 매직 넘버는 의미가 분명한 상수로 승격하고, 바로 설명 가능한 것만 남긴다.
5. SVG 생성 함수가 직접 계산하지 않고 공용 계산 함수를 호출하도록 변경한다.

완료 기준:

- Konva 렌더링과 SVG 생성이 같은 좌표 계산 함수를 공유한다.
- 각도 표기 방식이 한 규칙으로 통일된다.
- `GridCanvas.vue`에서 가이드 배치 계산 관련 코드가 의미 있는 단위로 축소된다.

---

## Phase 4. `GridCanvas.vue` 단계 분해

목표: 4,947라인짜리 단일 컴포넌트의 책임을 계산, 상호작용, 내보내기로 분리한다.

권장 분해 순서:

1. `useCanvasInteraction.ts`
2. `useCanvasExport.ts`
3. `useCanvasRender.ts` 또는 계산 전용 유틸

작업:

1. 마우스/드래그/hover 상태 처리 로직을 interaction composable로 이동한다.
2. PNG/PDF/SVG export 로직을 export composable로 이동한다.
3. 렌더링용 파생 계산값을 render 계층으로 이동한다.
4. shape ID 기반 조회 맵을 `computed`로 도입해 반복 `find`를 줄인다.
5. `textMeasureCanvas` 같은 모듈 전역 상태는 컴포넌트 범위 또는 composable 내부로 이동한다.

완료 기준:

- `GridCanvas.vue`는 템플릿과 조립 코드 중심으로 축소된다.
- 주요 계산/이벤트 함수가 파일 밖으로 이동한다.
- 이후 기능 추가 시 수정 위치를 예측 가능하게 만든다.

---

## 5. 제외 또는 후순위 처리 항목

이번 1차 리팩토링에서는 아래 항목을 바로 포함하지 않는다.

- `counter` 완전 구현
  - 이유: 구조 정리 전에 요구사항이 먼저 확정돼야 한다.
- `xlsx` 제거
  - 이유: 실제 미사용은 맞아 보이지만, 향후 import/export 기능 계획 여부 확인이 필요하다.
- `AppFooter.vue` 제거
  - 이유: 리뷰 내용과 달리 빈 컴포넌트가 아니다.
- `createQuadraticCurvePoints` 세그먼트 최적화
  - 이유: 구조 정리 후 성능 병목 계측과 함께 보는 편이 안전하다.

---

## 6. 리스크와 대응

### 리스크 1. `GridCanvas.vue`를 너무 빨리 분해하면 동작 회귀가 발생할 수 있음

대응:

- 먼저 공용 계산 함수를 추출하고, 템플릿 구조는 최대한 유지한다.

### 리스크 2. shape 분류 규칙을 바꾸는 순간 UI 여러 곳이 동시에 깨질 수 있음

대응:

- 공용 상수 도입 후 각 컴포넌트를 순차 치환한다.
- `counter`는 별도 판단 전까지 기존 동작을 보존한다.

### 리스크 3. SVG와 Konva 결과를 맞추는 과정에서 출력 차이가 드러날 수 있음

대응:

- 길이 가이드, 높이 가이드, 각도 가이드 순으로 범위를 좁혀 검증한다.

---

## 7. Claude 검토 요청 포인트

아래 4가지는 다음 라운드에서 Claude가 코멘트해 주면 좋다.

1. `counter`를 유지할지 제거할지에 대한 우선 판단
2. 히스토리 상한 기본값을 `50`으로 둘지 `100`으로 둘지
3. `GridCanvas` 분해 시 `useCanvasRender`를 먼저 만들지, `useShapeGuideLayout` 같은 계산 전용 모듈을 먼저 만들지
4. `xlsx`를 이번 라운드에서 제거해도 되는지

---

## 8. 최종 제안 순서

실제 작업은 아래 순서로 진행하는 것이 가장 안전하다.

1. Phase 1 전체 수행
2. Phase 2에서 shape 규칙 공용화 완료
3. Phase 3에서 guide 계산 공용화 완료
4. Phase 4에서 `GridCanvas.vue` 분해 시작

이 순서를 지키면 “버그 수정 → 규칙 통합 → 계산 통합 → 구조 분해” 흐름이 유지되어, 리팩토링 중간에 불필요한 되돌림이 줄어든다.
