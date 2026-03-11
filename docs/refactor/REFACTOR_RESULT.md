# MathCut 리팩토링 결과 보고서
작성일: 2026-03-10
기준 문서: `docs/refactor/REFACTOR_FINAL.md`
현재 완료 범위: Phase 1, Phase 2, Phase 3, Phase 4-1, Phase 4-2, Phase 4-3, Phase 4-4, Phase 4-5 일부

## 1. 요약
이번 리팩토링은 안정성 보강, 공용 규칙 정리, 가이드 레이아웃 공용화를 중심으로 진행했다. 현재 기준으로 Phase 1~3 범위를 반영했고, 화면(Konva)과 SVG export가 가능한 한 동일한 계산 경로를 사용하도록 정리했다.

주요 결과는 다음과 같다.
- Phase 1: 타입 안정화, 히스토리 관리 보강, 임시 안전장치 추가, 미사용 의존성 제거
- Phase 2: 도형 규칙과 가이드 threshold, 높이 기본 표시 규칙의 상수화
- Phase 3: 길이/높이/각도/점이름 라벨의 좌표 계산과 blank 내부 텍스트 배치 공용화
- 추가 수정: SVG export 시 폰트 embed 기본 활성화, 화면/SVG 텍스트 굵기 normal 통일
- Phase 4-1: export orchestration과 SVG 생성 본체를 `useCanvasExport.ts`로 분리

## 2. 완료 항목
### Phase 1. 안정화 패치
- `patchShapeGuideItemStyle` 입력 타입을 `Partial<ShapeGuideItemStyle>`로 변경
- `rawToPoint()`의 `gridX/gridY` 계산 보정
- `GridCanvas.vue`의 중복 mouse leave 초기화 제거
- `getShapeGuideItemStyle()` 반환 타입 명시
- `setGridMode(mode)` 파라미터명을 `newMode`로 정리
- 히스토리 상한 `100` 적용
- `loadSnapshot()`에서 history/reset 초기화 추가
- `counter: 0` 임시 안전장치 추가
- 미사용 의존성 `xlsx` 제거

### Phase 2. 공용 규칙 정리
- [shapeRules.ts](d:\vision\mathcut-front\src\constants\shapeRules.ts) 추가
- `OPEN_SHAPE_TYPES` 공용화
- `HEIGHT_DEFAULT_VISIBLE_TYPES` 공용화
- `GUIDE_HIT_THRESHOLD_PX`, `GUIDE_CONTEXT_THRESHOLD_PX` 공용화
- [colorPalette.ts](d:\vision\mathcut-front\src\constants\colorPalette.ts)의 `MAGENTA_100_HEX` 공용 사용
- [useShape.ts](d:\vision\mathcut-front\src\composables\useShape.ts), [useGuide.ts](d:\vision\mathcut-front\src\composables\useGuide.ts), [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue), [InfoPanel.vue](d:\vision\mathcut-front\src\components\InfoPanel.vue), [ContextMenu.vue](d:\vision\mathcut-front\src\components\ContextMenu.vue), [EditorView.vue](d:\vision\mathcut-front\src\views\EditorView.vue)에서 중복 규칙 제거

### Phase 3. 가이드 레이아웃 공용화
- [geometry.ts](d:\vision\mathcut-front\src\utils\geometry.ts)
  - `computeAngleDegrees()` 추가
  - `formatAngleDegrees()` 추가
- [shapeGuideLayout.ts](d:\vision\mathcut-front\src\utils\shapeGuideLayout.ts)
  - blank 크기와 텍스트 위치 계산 helper 추가
  - point name 기본 위치 계산 helper 추가
  - auto angle/length 인덱스 계산 helper 추가
  - 길이/높이/각도 라벨 위치 계산 helper 추가
  - polyline/rect 충돌 계산 helper 통합
  - blank unit/suffix 위치 계산 helper 통합
- [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue)
  - Konva와 SVG가 길이/높이/각도/점이름 라벨 월드 좌표 계산을 공통 helper로 사용하도록 정리
  - SVG 생성 경로가 shared layout helper를 재사용하도록 정리
- [EditorView.vue](d:\vision\mathcut-front\src\views\EditorView.vue)
  - angle/length 대상 판정 helper 재사용

## 3. SVG 폰트 및 굵기 보정
- 증상
  - SVG 내보내기 결과에서 점이름, 길이 수치, 각도 수치 텍스트가 화면과 다른 폰트 또는 굵기로 보이는 케이스 확인
- 원인
  - SVG export의 폰트 embed 기본값이 비활성 상태였고, 화면과 SVG 양쪽 텍스트에 `bold`가 강제 지정되어 렌더러 차이가 더 두드러질 수 있었음
- 조치
  - [EditorView.vue](d:\vision\mathcut-front\src\views\EditorView.vue)에서 SVG 폰트 포함 옵션 기본값을 `true`로 변경
  - [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue)에서 SVG export 시 `embedFonts`를 기본 활성화하도록 변경
  - [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue)에서 점이름, 길이, 각도, 가이드 텍스트의 Konva `fontStyle`과 SVG `font-weight`를 `normal`로 통일
  - 텍스트 폭 계산용 canvas font 설정도 `bold` 제거
- 기대 효과
  - 외부 SVG 뷰어에서도 화면과 더 유사한 폰트 및 굵기 표현 가능
  - 점이름, 길이 수치, 각도 수치의 화면/SVG 시각 차이 감소

## 4. 검증 결과
- `npm uninstall xlsx` 완료
- `npm run build` 통과
- TypeScript 오류 없음
- Vite chunk size warning은 남아 있지만 현재 범위의 blocker는 아님
- 정적 검증 문서: [PHASE3_VERIFICATION.md](d:\vision\mathcut-front\docs\refactor\PHASE3_VERIFICATION.md)
- 실제 화면/SVG 시각 비교는 별도 수동 검증 필요

## 5. Phase 4 진행 현황
- [useCanvasExport.ts](d:\vision\mathcut-front\src\composables\useCanvasExport.ts) 추가
  - `exportImage()` 추출
  - PNG/PDF/SVG 다운로드 orchestration 추출
  - 파일명 정리와 data URL 다운로드 helper 이동
  - `generateVectorSVG()` 및 SVG 전용 helper 이동
  - 폰트 embed fetch와 SVG defs 생성 책임 이동
- [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue)
  - `useCanvasExport()` 호출로 export 진입점 연결
  - SVG export에 필요한 계산 함수와 상수만 `svg` 옵션으로 전달하도록 정리
  - `defineExpose({ exportImage })` 유지
- [useCanvasInteraction.ts](d:\vision\mathcut-front\src\composables\useCanvasInteraction.ts) 추가
  - pan/drag/transform/hover state 추출
  - `handleMouseDown/Move/Up/Leave` 추출
  - shape, vertex, text guide, guide text drag 시작 핸들러 추출
  - `getLogicalPointerPos()`, `clampViewportOffset()` 이동
- [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue)
  - 인터랙션 관련 state/handler를 `useCanvasInteraction()` 호출로 연결
  - context menu와 텍스트 입력 UI 상태만 로컬에 유지
  - 파일 라인 수가 약 5,250줄 목표에는 아직 못 미치지만 3,601줄까지 감소
- 검증
  - `npm run build` 재통과
  - TypeScript 타입 오류 없이 export/interaction 경계 이동 완료

## 6. Phase 4 추가 진행 현황
- [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue)
  - `shapeMap` computed 추가로 반복 `canvasStore.shapes.find(...)` 조회를 캐시 조회로 전환
  - `textMeasureCanvas`를 모듈 전역 변수에서 컴포넌트 지역 `ref`로 이동
  - latex point overlay, angle debug, shadow config 등 남아 있던 shape 조회를 `shapeMap.get()`으로 정리
- [useCanvasInteraction.ts](d:\vision\mathcut-front\src\composables\useCanvasInteraction.ts)
  - interaction composable 내부에도 `shapeMap` computed를 추가
  - vertex drag, scale/rotate, guide text drag 시작 시 shape 조회를 `shapeMap.get()`으로 통일
- 기대 효과
  - shape 수가 많아질 때 select/drag 경로의 선형 탐색 빈도 감소
  - text width 측정용 canvas의 범위를 컴포넌트 인스턴스 내부로 제한

## 7. 후속 범위
다음 작업은 `Phase 4-5` 중심의 `GridCanvas.vue` 조립부 정리와 추가 분리 대상 식별이다.

- [PHASE3_VERIFICATION.md](d:\vision\mathcut-front\docs\refactor\PHASE3_VERIFICATION.md) 기준 화면/SVG 비교 검증
- `GridCanvas.vue` 조립부 압축 및 추가 composable/helper 분리
- export/interaction 외 잔여 UI 상태 경계 재정리
- 파일 라인 수 추가 축소

## 8. Phase 4-5 추가 진행 현황
- [useCanvasTextEditing.ts](d:\vision\mathcut-front\src\composables\useCanvasTextEditing.ts) 추가
  - 텍스트 가이드 입력 상태, 점 이름 편집 상태, 텍스트 가이드 편집 상태를 composable로 이동
  - `openTextInput`, confirm/cancel 계열, blur handler, point label 편집 시작 로직 이동
  - 전역 점 이름 생성 규칙과 latex overlay 계산(`latexPointLabelOverlays`, `latexTextGuideOverlays`) 이동
- [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue)
  - 텍스트 입력/편집 관련 로컬 state와 helper를 제거하고 `useCanvasTextEditing()` 연결만 유지
  - canvas click 시 텍스트 가이드 입력 진입을 `openTextInput()` 호출로 단순화
- 기대 효과
  - `GridCanvas.vue`가 편집 상태 보관소 역할에서 한 단계 더 벗어남
  - 다음 단계에서 transform UI, preview/helper 계열 추가 분리 여지가 더 선명해짐

- [useCanvasTransformPreview.ts](d:\vision\mathcut-front\src\composables\useCanvasTransformPreview.ts) 추가
  - 선택 도형 transform handle 배치 계산(`selectedShapeTransformUI`) 이동
  - 선택 텍스트 가이드 transform handle 배치 계산(`selectedTextGuideTransformUI`) 이동
  - 그리기 중 도형 preview 포인트 계산(`getPreviewPoints`) 이동
- [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue)
  - transform/preivew 계산 블록 제거 후 `useCanvasTransformPreview()` 연결만 유지
  - `GridCanvas.vue` 내부 중간 계산 함수 블록 추가 축소
- [CanvasLatexOverlays.vue](d:\vision\mathcut-front\src\components\canvas\CanvasLatexOverlays.vue), [CanvasTextEditPanels.vue](d:\vision\mathcut-front\src\components\canvas\CanvasTextEditPanels.vue) 추가
  - LaTeX overlay DOM 블록과 텍스트 입력/편집 패널 UI를 `GridCanvas.vue`에서 분리
  - 패널 내부 focus/blur 처리 책임을 child component로 이동
- [useCanvasTextEditing.ts](d:\vision\mathcut-front\src\composables\useCanvasTextEditing.ts)
  - DOM ref와 blur handler를 제거하고 상태/액션 중심으로 정리

## 9. SVG 시각 일치 보정
- 사용자 확인 기준 불일치 항목
  - 점 이름 텍스트
  - 길이 텍스트
  - 높이의 길이 텍스트
  - 모눈종이 굵기 및 색상/투명도 체감 차이
- 원인 정리
  - SVG point name 렌더링 경로에서 offset이 한 번 더 적용되고 있었음
  - SVG가 일부 텍스트에 `formatMathText()`를 적용하지 않아 화면 텍스트와 다른 문자열이 렌더될 수 있었음
  - SVG 길이/높이 텍스트의 fallback 색상 기준이 화면과 달랐음
  - SVG 모눈/점판이 화면 Konva 렌더와 다른 두께, 반지름, opacity 하드코딩을 사용하고 있었음
- 조치
  - [useCanvasExport.ts](d:\vision\mathcut-front\src\composables\useCanvasExport.ts)
    - point name SVG 렌더에서 offset 이중 적용 제거
    - point name, text guide, length guide, angle guide 텍스트에 `formatMathText()` 경로 반영
    - length guide 텍스트는 `formatLengthGuideText()` 후 `formatMathText()` 적용
    - 길이/높이/각도/점이름 텍스트 색상 fallback을 화면과 같은 규칙으로 맞춤
    - 모눈 격자/점판의 두께, opacity, 점 반지름을 화면과 동일 상수로 받도록 변경
    - Konva `x/y + offsetX/offsetY` 배치와 더 가깝게 맞추기 위해 SVG 텍스트를 `svgKonvaTextEl()` 경로로 재정렬
    - 길이/높이/각도/점이름/일반 텍스트 가이드의 SVG 텍스트를 `middle` 기준 대신 top-left 기준으로 맞춤
    - angle blank suffix를 화면과 같은 `°` 문자 배치로 정리
  - [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue)
    - 점 이름 텍스트 fallback 색상을 공통 helper(`getShapeGuideFallbackTextColor`)로 통일
    - 모눈/점판 렌더 상수를 export 경로와 공유하도록 정리
- 검증 상태
  - `npm run build` 통과
  - 실제 화면/SVG 시각 비교는 여전히 수동 검증 필요
  - SVG 높이 보조선 누락은 export 조건이 `showLength`로 잘못 묶여 있던 문제였고, 화면과 동일하게 `showHeight` 기준으로 수정
  - 원의 반지름/지름 보조선은 SVG에서 점선 측정 곡선만 그리고 실선 본체를 빠뜨리고 있었고, 화면과 동일한 endpoints/색/두께 기준으로 본체 선을 추가
  - 높이 guide 개별 숨김 상태는 export에서 `isShapeGuideItemVisible(shape, 'height', 0)` 체크가 빠져 있어 계속 노출되고 있었고, 화면과 같은 조건으로 수정
  - 각도 텍스트는 SVG만 `text-anchor="middle"` 배치를 쓰고 있어 미세 오차가 있었고, 화면과 같은 `offsetX/offsetY` 경로와 blank suffix `°` 보정(`-3/-3`)으로 통일
