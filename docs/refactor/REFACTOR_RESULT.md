# MathCut 리팩토링 결과 보고서
작성일: 2026-03-11
기준 문서: `docs/refactor/REFACTOR_FINAL.md`, `docs/refactor/CODE_REVIEW.md`, `docs/refactor/PHASE3_VERIFICATION.md`
최종 마감 범위: Phase 1, Phase 2, Phase 3, Phase 4-1, Phase 4-2, Phase 4-3, Phase 4-4, Phase 4-5 일부
마감 상태: 코드 리팩토링 작업 종료

## 1. 최종 요약
이번 리팩토링은 Claude 코드 리뷰와 최종 계획서를 기준으로, 안정화 패치, 공용 규칙 정리, 가이드 레이아웃 공용화, export/interaction 분리, `GridCanvas.vue` 책임 축소를 중심으로 진행했다.

핵심 결과는 다음과 같다.
- Phase 1: 타입 안정화, 히스토리 관리 보강, 임시 안전장치 추가, 미사용 의존성 제거
- Phase 2: 도형 규칙과 가이드 threshold, 높이 기본 표시 규칙의 상수화
- Phase 3: 길이/높이/각도/점이름 라벨과 blank 내부 텍스트 배치 계산 공용화
- Phase 4: export, interaction, text editing, transform preview, overlay/panel UI 분리
- SVG 보정: 텍스트 배치, fallback 색상, 모눈 렌더 상수, 높이/반지름/지름 보조선, 각도 텍스트 경로 정리

이번 시점에서 리팩토링 구현 자체는 마감하고, 남은 항목은 수동 검증과 필요 시 미세 시각 보정으로 한정한다.

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

### Phase 4. 구조 분리 및 책임 축소
- [useCanvasExport.ts](d:\vision\mathcut-front\src\composables\useCanvasExport.ts) 추가
  - `exportImage()` 추출
  - PNG/PDF/SVG 다운로드 orchestration 추출
  - `generateVectorSVG()` 및 SVG helper 이동
  - 폰트 embed fetch와 SVG defs 생성 책임 이동
- [useCanvasInteraction.ts](d:\vision\mathcut-front\src\composables\useCanvasInteraction.ts) 추가
  - pan/drag/transform/hover state 추출
  - `handleMouseDown/Move/Up/Leave` 추출
  - shape, vertex, text guide, guide text drag 시작 핸들러 추출
- [useCanvasTextEditing.ts](d:\vision\mathcut-front\src\composables\useCanvasTextEditing.ts) 추가
  - 텍스트 가이드 입력 상태, 점 이름 편집 상태, 텍스트 가이드 편집 상태 이동
  - `openTextInput`, confirm/cancel, point label 편집 시작 로직 이동
  - latex overlay 계산 이동
- [useCanvasTransformPreview.ts](d:\vision\mathcut-front\src\composables\useCanvasTransformPreview.ts) 추가
  - 선택 도형/텍스트 가이드 transform handle 계산 이동
  - 그리기 중 preview 포인트 계산 이동
- [CanvasLatexOverlays.vue](d:\vision\mathcut-front\src\components\canvas\CanvasLatexOverlays.vue), [CanvasTextEditPanels.vue](d:\vision\mathcut-front\src\components\canvas\CanvasTextEditPanels.vue) 추가
  - overlay DOM과 텍스트 편집 패널 UI를 `GridCanvas.vue`에서 분리
- [GridCanvas.vue](d:\vision\mathcut-front\src\components\canvas\GridCanvas.vue)
  - `shapeMap` computed 추가로 반복 조회를 캐시 조회로 전환
  - `textMeasureCanvas`를 모듈 전역 변수에서 컴포넌트 지역 `ref`로 이동
  - export/interaction/text editing/transform preview 연결부 중심으로 정리

## 3. SVG 시각 일치 보정
사용자 수동 검증 과정에서 확인된 화면/SVG 불일치 항목을 기준으로 export 경로를 보정했다.

### 반영 내용
- point name SVG 렌더에서 offset 이중 적용 제거
- point name, text guide, length guide, angle guide 텍스트에 `formatMathText()` 경로 반영
- length guide 텍스트는 `formatLengthGuideText()` 후 `formatMathText()` 적용
- 길이/높이/각도/점이름 텍스트 색상 fallback을 화면과 같은 규칙으로 정리
- 모눈 격자/점판의 두께, opacity, 점 반지름을 화면과 동일 상수로 공유
- SVG 텍스트를 `svgKonvaTextEl()` 경로로 정리해 Konva의 `x/y + offsetX/offsetY` 배치와 더 가깝게 맞춤
- 길이/높이/각도/점이름/일반 텍스트 가이드를 `middle` 기준 대신 top-left 기준 배치로 조정
- angle blank suffix를 화면과 같은 `°` 문자 배치로 정리
- SVG 높이 보조선 누락 수정
  - export 조건이 `showLength`로 잘못 묶여 있던 문제를 `showHeight` 기준으로 수정
- 원의 반지름/지름 보조선 누락 수정
  - 점선 측정 곡선만 그리고 실선 본체를 빠뜨리던 문제를 endpoints/색/두께 기준으로 보완
- 높이 guide 개별 숨김 불일치 수정
  - export에서 `isShapeGuideItemVisible(shape, 'height', 0)` 체크 추가
- 각도 텍스트 미세 위치 차이 수정
  - `text-anchor="middle"` 배치 대신 화면과 같은 `offsetX/offsetY` 경로 사용
  - blank suffix `°`는 화면과 같은 `-3/-3` 보정 적용

## 4. 검증 결과
- `npm uninstall xlsx` 완료
- `npm run build` 통과
- TypeScript 오류 없음
- Vite chunk size warning은 남아 있지만 현재 범위의 blocker는 아님
- 정적 검증 문서: [PHASE3_VERIFICATION.md](d:\vision\mathcut-front\docs\refactor\PHASE3_VERIFICATION.md)
- 수동 검증 중 확인된 주요 SVG 누락/불일치 이슈는 현재 반영분까지 수정 완료

## 5. 최종 판단
이번 리팩토링은 최초 계획의 핵심 목표였던 안정화, 규칙 공용화, 가이드 레이아웃 공용화, export/interaction 분리, `GridCanvas.vue` 부담 완화를 대부분 달성했다. 특히 화면 렌더와 SVG export가 별개로 어긋나기 쉬웠던 계산 경로를 공통 helper와 composable 중심으로 재배치한 점이 가장 큰 결과다.

완전히 종료되지 않은 것은 "실제 화면과 SVG의 100% 시각 일치 수동 검증"과 "추가 구조 축소 여지"다. 다만 현 시점에서는 리팩토링 구현을 더 확장하기보다, 현재 상태를 기준선으로 고정하고 필요한 항목만 후속 미세 수정하는 편이 적절하다.

## 6. 후속 메모
- [PHASE3_VERIFICATION.md](d:\vision\mathcut-front\docs\refactor\PHASE3_VERIFICATION.md) 기준 화면/SVG 비교 검증은 계속 유효
- 실제 사용자 관점에서 보이는 텍스트 위치, 폰트, 모눈 렌더 차이는 필요 시 후속 미세 조정 대상
- `GridCanvas.vue` 추가 분리는 가능하지만, 이번 리팩토링 마감 범위에서는 필수 항목으로 보지 않음