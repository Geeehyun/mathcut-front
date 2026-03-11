# Phase 3 Verification

작성일: 2026-03-10
범위: `docs/refactor/REFACTOR_FINAL.md`의 Phase 3

## 1. 정적 검증 결과

다음 항목은 코드 경로 기준으로 확인했다.

- 길이/높이/각도 라벨 월드 좌표
  - Konva와 SVG 모두 `getShapeGuideLabelWorldPos()`를 사용한다.
  - 확인 위치:
    - `src/components/canvas/GridCanvas.vue:1676`
    - `src/components/canvas/GridCanvas.vue:2864`
    - `src/components/canvas/GridCanvas.vue:2935`
    - `src/components/canvas/GridCanvas.vue:2972`
    - `src/components/canvas/GridCanvas.vue:3504`
    - `src/components/canvas/GridCanvas.vue:3668`
    - `src/components/canvas/GridCanvas.vue:3787`

- blank 내부 `cm` / `°` 좌표
  - Konva와 SVG 모두 `getShapeGuideBlankTextPos()`를 사용한다.
  - 확인 위치:
    - `src/components/canvas/GridCanvas.vue:1727`
    - `src/components/canvas/GridCanvas.vue:2873`
    - `src/components/canvas/GridCanvas.vue:2901`
    - `src/components/canvas/GridCanvas.vue:2944`
    - `src/components/canvas/GridCanvas.vue:2980`
    - `src/components/canvas/GridCanvas.vue:3491`
    - `src/components/canvas/GridCanvas.vue:3655`
    - `src/components/canvas/GridCanvas.vue:3774`
    - `src/components/canvas/GridCanvas.vue:4134`

- angle/length/height/circle label base 계산
  - `getShapeAngleLabelPos()` / `getShapeLengthLabelPos()` / `getShapeHeightLabelPos()` / `getCircleLengthLabelPos()`는 모두 `src/utils/shapeGuideLayout.ts`의 shared helper를 사용한다.

- SVG 단위 텍스트 배치
  - `svgUnitText()`가 shared width/gap 계산 helper를 직접 사용한다.

- 타입/빌드
  - `npm run build` 통과

## 2. 수동 검증 필요 항목

현재 환경에서는 브라우저 화면과 SVG export 이미지를 직접 비교하지 못했다.
아래 항목은 실제 UI에서 확인이 필요하다.

1. 길이 라벨 위치가 화면과 SVG에서 같은지 확인
2. 높이 라벨 위치가 화면과 SVG에서 같은지 확인
3. 각도 라벨 위치가 화면과 SVG에서 같은지 확인
4. blank 내부 `cm` / `°` 위치가 화면과 SVG에서 같은지 확인
5. circle 반지름/지름 라벨 위치가 화면과 SVG에서 같은지 확인

## 3. 권장 확인 절차

1. 개발 서버 실행: `npm run dev`
2. 삼각형, 사다리꼴, 원을 각각 하나씩 그린다.
3. 길이/높이/각도/point name을 모두 표시한다.
4. blank 모드와 일반 텍스트 모드를 각각 한 번씩 확인한다.
5. SVG export 후 브라우저 화면과 다음 항목을 비교한다.
   - length label
   - height label
   - angle label
   - circle radius/diameter label
   - blank `cm`
   - blank `°`

## 4. 판정

- 코드 경로 기준: Phase 3 목표 달성
- 시각 비교 기준: 수동 확인 필요
