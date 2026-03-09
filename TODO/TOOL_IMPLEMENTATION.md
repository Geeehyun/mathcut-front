# TODO: 도구별 기능 구현

**작성일**: 2026-03-03
**관련 담당**: Claude (기반 설계) + Codex (구현 대부분)

---

## 작업 개요

1. 선택/이동 도구 추가 (포토샵 V키 스타일)
2. 특수 도형 기하학 계산 및 완성 로직
3. 렌더링 개선 (ray/line/arrow, 미리보기)
4. 키보드 단축키
5. UX 개선 (텍스트 가이드 인라인 입력, InfoPanel 연동)

---

## Phase 1 — 기반 설계 【Claude】

> Codex 작업 전에 Claude가 먼저 완료해야 하는 항목

### 1-A. 타입 + 스토어 변경

- [x] `src/types/index.ts`
  - `ModeType`에 `'select'` 추가

- [x] `src/stores/canvas.ts`
  - `moveShape(id, dx, dy)` 액션 추가

- [x] `src/stores/tool.ts`
  - `setMode('select')` 호출 시 tempPoints 초기화 (기존 setMode 로직 적용 확인)

### 1-B. 도형 기하학 계산 함수 【Claude】 ✅ 완료

`src/utils/geometry.ts`에 추가 완료:

| 함수 | 입력 | 반환 |
|------|------|------|
| `computeEquilateralTriangle(p1, p2)` | 밑변 2점 | 세 번째 꼭짓점 Point |
| `computeSquare(p1, p2)` | 한 변의 2점 | 나머지 2 꼭짓점 [Point, Point] |
| `computeRectangle(p1, p2)` | 대각선 2점 | 4 꼭짓점 [Point, Point, Point, Point] |
| `computeRhombus(p1, p2)` | 대각선 2점 | 4 꼭짓점 [Point, Point, Point, Point] |
| `computeParallelogram(p1, p2, p3)` | 3점 | 4번째 꼭짓점 Point |
| `computeRegularPolygon(center, vertex, n)` | 중심+꼭짓점+변수 | 전체 꼭짓점 배열 Point[] |

> 이등변삼각형, 직각삼각형, 사다리꼴은 자유 입력(n점 클릭) 방식 유지 — 계산 함수 불필요

---

## Phase 2 — 선택/이동 도구 구현 【Codex】

> Phase 1 완료 후 진행

### 2-A. AppSidebar.vue — 선택/이동 버튼 추가

- [x] 툴박스 최상단 (점 버튼 위)에 선택/이동 버튼 추가
  ```
  아이콘: ↖ (또는 화살표 SVG)
  레이블: 선택
  활성 조건: toolStore.mode === 'select'
  클릭 동작: toolStore.setMode('select') + closeFlyout()
  ```
- [x] `activeCategoryKey` 계산에 select 모드 반영

### 2-B. GridCanvas.vue — select 모드 이벤트 처리

- [x] 컨테이너 `cursor` 클래스를 mode에 따라 동적 변경
  - `select` 모드: `cursor-default`
  - `shape/guide` 모드: `cursor-crosshair` (기존 유지)

- [x] `handleClick` 수정
  - select 모드일 때: 도형 클릭 시 선택, 빈 곳 클릭 시 `canvasStore.selectShape(null)`

- [x] 드래그로 도형 이동 (select 모드 전용)
  - `mousedown`: 선택된 도형 위에서 시작 시 dragStart 기록
  - `mousemove`: dragStart 있으면 `canvasStore.moveShape(id, dx, dy)` 호출
  - `mouseup`: dragStart 초기화

- [x] 도형 hover 시 커서 `cursor-move` (선택 모드에서만)

### 2-C. 선택 상태 시각화 (GridCanvas.vue)

- [x] 선택된 도형 bounding box 렌더 (점선 사각형, 파란색)
  - `v-rect` 또는 `v-line`으로 점선 테두리
  - 도형 points 기준 min/max 계산하여 위치·크기 결정
  - 원(circle)은 중심+반지름 기준

### 2-D. EditorView.vue — 상태바 반영

- [x] `선택·이동` 도구명 및 안내문 추가
  - 도구명: `선택·이동`
  - 안내문: `도형을 클릭하여 선택하거나 드래그하여 이동합니다`
  - 아이콘: `↖`

---

## Phase 3 — 특수 도형 완성 로직 【Codex】

> Phase 1-B (geometry 함수) 완료 후 진행

### 3-A. useShape.ts 수정

- [x] `requiredPoints` 수정
  ```ts
  'triangle-equilateral': 2,   // 1 → 2 (밑변 2점)
  'triangle-right': 3,          // 2 → 3 (자유 3점)
  'triangle-isosceles': 3,      // 1 → 3 (자유 3점)
  'rect-square': 2,             // 1 → 2 (한 변 2점)
  'rect-rectangle': 2,          // 유지 (대각선 2점)
  'rect-trapezoid': 4,          // 3 → 4 (자유 4점)
  'rect-rhombus': 2,            // 유지 (대각선 2점)
  'rect-parallelogram': 3,      // 2 → 3 (3점)
  'rect-free': 4,               // 유지 (자유 4점)
  'polygon-regular': 2,         // 유지 (중심+꼭짓점)
  ```

- [x] `completeShape()` 분기 처리
  - `triangle-equilateral`: `computeEquilateralTriangle(p1, p2)` → 3점으로 저장
  - `rect-square`: `computeSquare(p1, p2)` → 4점으로 저장
  - `rect-rectangle`: `computeRectangle(p1, p2)` → 4점으로 저장
  - `rect-rhombus`: `computeRhombus(p1, p2)` → 4점으로 저장
  - `rect-parallelogram`: `computeParallelogram(p1, p2, p3)` → 4점으로 저장
  - `polygon-regular`: `computeRegularPolygon(center, vertex, n)` → n점으로 저장
  - 나머지 (isosceles, right, trapezoid, free): tempPoints 그대로 저장 (기존 방식)

### 3-B. types/index.ts 확인

- [x] `'triangle-free'` → `'triangle'`로 이미 매핑되어 있는지 확인
  - sidebar에서 `selectShape('triangle')` 호출 중 → 문제없음
  - types에 `triangle-free`는 없으므로 그대로 유지

---

## Phase 4 — 렌더링 개선 【Codex】

### 4-A. ray / line / arrow 개선 (GridCanvas.vue)

- [x] **ray (반직선)**: p2 방향으로 연장 + 화살표 헤드
  - 헤드: `v-line` 또는 Konva Arrow shape 사용
  - 연장: p1→p2 방향으로 캔버스 끝까지 연장

- [x] **line (직선)**: 양 방향으로 캔버스 끝까지 연장

- [x] **arrow (화살표)**: p2에 화살표 헤드
  - Konva `v-arrow` 사용 권장

### 4-B. 도형 그리기 미리보기 (GridCanvas.vue)

mousemove 시 현재 tempPoints + 마우스 위치로 완성 예상 도형 미리 표시

- [x] `mousePos` ref 추가 (mousemove에서 갱신)
- [x] 미리보기 레이어에 각 shapeType별 예상 도형 렌더
  - 정삼각형: 2점 찍은 후 `computeEquilateralTriangle` 결과를 주황 점선으로
  - 정사각형/직사각형/마름모: 2점 찍은 후 4점 미리보기
  - 기타: 마우스 위치까지 점선 연결 (기존 방식 유지)

---

## Phase 5 — 키보드 단축키 【Codex】

`src/composables/useKeyboard.ts` 신규 생성 또는 `EditorView.vue`에서 처리

- [x] `V` → `toolStore.setMode('select')`
- [x] `Escape` → `toolStore.clearTempPoints()` + `canvasStore.selectShape(null)`
- [x] `Delete` / `Backspace` → 선택된 도형 삭제 (`canvasStore.removeShape(selectedShapeId)`)
- [x] `Ctrl+Z` → `canvasStore.undo()`
- [x] `Ctrl+Y` / `Ctrl+Shift+Z` → `canvasStore.redo()`

> `EditorView.vue`에 `onMounted` + `keydown` 이벤트 리스너로 구현 권장

---

## Phase 6 — UX 개선 【Codex】

### 6-A. 텍스트 가이드 입력 개선

- [x] `useGuide.ts`에서 `prompt()` 제거
- [x] 클릭 위치에 인라인 `<input>` 오버레이 표시
  - Enter → 확정, Escape → 취소
  - `EditorView.vue` 또는 `GridCanvas.vue`에서 처리

### 6-B. InfoPanel.vue — 선택된 도형 연동

- [x] 선택된 도형의 타입, 꼭짓점 좌표, 스타일을 패널에 표시
- [x] 스타일 변경 버튼 → `canvasStore.updateShape()` 호출
- [x] 도형 삭제 버튼 연결

---

## 완료 기준

- [x] 선택/이동 도구로 도형을 클릭 선택 + 드래그 이동 가능
- [x] 정삼각형, 정사각형, 직사각형, 마름모, 평행사변형, 정다각형이 올바른 기하학적 형태로 그려짐
- [x] ray/line/arrow가 올바르게 렌더됨
- [x] V / Delete / Escape / Ctrl+Z 단축키 동작
- [x] `npm run build` 통과

---

## 완료 후 처리

- `PROGRESS.md` 업데이트 (담당자 기록)
- `logs/CLAUDE_LOG.md` — Claude 작업 기록
- `logs/CODEX_LOG.md` — Codex 작업 기록
