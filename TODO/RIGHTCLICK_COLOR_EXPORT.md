# TODO: 우클릭 메뉴 + 색상 팔레트 + 내보내기 개선

**작성일**: 2026-03-03
**담당**: Claude (기반 설계) + Codex (구현 전담)

---

## 작업 개요

1. CMYK 호환 색상 팔레트 상수 정의
2. Shape 타입에 커스텀 색상 필드 추가
3. 우클릭 컨텍스트 메뉴 (도형 위 / 배경)
4. PNG 고해상도 + PDF 내보내기 추가

---

## Phase 1 — 기반 설계 【Claude】

> Codex 작업 전 Claude가 먼저 완료

### 1-A. `src/constants/colorPalette.ts` 신규 생성

인쇄-safe CMYK 기반 팔레트 정의. Codex가 UI에서 그대로 사용.

```ts
export interface PaletteColor {
  name: string
  hex: string       // 화면 표시용 RGB
  cmyk: [number, number, number, number]  // C M Y K (0~100)
}

export const STROKE_PALETTE: PaletteColor[] = [...]  // 선 색상용 (진한 계열)
export const FILL_PALETTE: PaletteColor[] = [...]    // 채우기용 (연한 계열)
export const FILL_NONE = 'none'                       // 채우기 없음
```

### 1-B. `src/types/index.ts` 수정

Shape에 커스텀 색상 필드 추가 (optional — 없으면 기존 style preset 사용):

```ts
export interface ShapeColor {
  stroke: string   // HEX 또는 'none'
  fill: string     // HEX 또는 'none'
}

// Shape 인터페이스에 추가
export interface Shape {
  id: string
  type: ShapeType
  points: Point[]
  style: StyleType
  color?: ShapeColor   // ← 추가. 있으면 style preset 무시
}
```

### 1-C. `src/stores/canvas.ts` 수정

레이어 순서 변경 + 색상 업데이트 액션 추가:

```ts
// 레이어 순서
reorderShape(id, direction: 'up' | 'down' | 'front' | 'back')

// 커스텀 색상 설정
setShapeColor(id, color: ShapeColor)
```

---

## Phase 2 — ContextMenu 컴포넌트 【Codex】

> Phase 1 완료 후 진행

### 2-A. `src/components/ContextMenu.vue` 신규 생성

**공통 규칙**:
- 우클릭 위치에 absolute 포지션으로 표시
- 메뉴 바깥 클릭 시 닫힘
- 키보드 Escape로 닫힘
- z-index: 50 (최상위)
- 스타일: 흰 배경, 둥근 모서리, 그림자 (`shadow-xl rounded-xl`)

**Props**:
```ts
props: {
  x: number           // 화면 x 좌표
  y: number           // 화면 y 좌표
  targetShapeId: string | null  // null이면 배경 우클릭
}
```

**도형 우클릭 메뉴 항목**:
```
─────────────────
  복제
  삭제            ← 빨간색
─────────────────
  색상 변경 ▶     ← 서브메뉴 또는 인라인 팔레트
─────────────────
  앞으로 가져오기
  뒤로 보내기
  맨 앞으로
  맨 뒤로
─────────────────
```

**배경 우클릭 메뉴 항목**:
```
─────────────────
  전체 선택       ← select 모드 + 모든 도형 선택
  실행취소        ← canvasStore.undo() (비활성: opacity-40)
  다시실행        ← canvasStore.redo() (비활성: opacity-40)
─────────────────
  전체 초기화     ← 빨간색, 확인 없이 바로 실행
─────────────────
  격자 모드 전환  ← toolStore.cycleGridMode()
─────────────────
```

### 2-B. `GridCanvas.vue` — 우클릭 이벤트 연결

- `@contextmenu.prevent` 추가 (브라우저 기본 메뉴 막기)
- 도형 노드: `@contextmenu.prevent="handleShapeContextMenu(shape.id, $event)"`
- stage 배경: `@contextmenu.prevent="handleBackgroundContextMenu($event)"`
- 클릭 좌표를 `EditorView`로 emit

```ts
// emit 추가
emit('contextmenu', { x, y, shapeId: string | null })
```

완료 상태: ✅ 구현 완료

### 2-C. `EditorView.vue` — ContextMenu 마운트

- `ContextMenu` 컴포넌트 import 및 조건부 렌더링
- `contextmenuState = { visible, x, y, shapeId }` ref 관리
완료 상태: ✅ 구현 완료

---

## Phase 3 — 색상 변경 서브메뉴 【Codex】

> Phase 1 완료 후 진행

### 3-A. ContextMenu 색상 서브패널

도형 우클릭 → "색상 변경" 클릭 → 인라인 확장 (서브메뉴 대신 패널 확장)

```
┌─────────────────────────┐
│ 선 색상                  │
│ ● ● ● ● ● ● ●  없음    │  ← STROKE_PALETTE 칩
├─────────────────────────┤
│ 채우기 색상              │
│ ○ ○ ○ ○ ○ ○ ○  없음    │  ← FILL_PALETTE 칩
└─────────────────────────┘
```

- 팔레트 칩: `w-5 h-5 rounded-full border` + hover 확대
- 칩 hover 시 CMYK 값 tooltip 표시 (`title` 속성으로 충분)
- 선택 시 `canvasStore.setShapeColor(id, { stroke, fill })` 호출
완료 상태: ✅ 구현 완료

### 3-B. `GridCanvas.vue` — 커스텀 색상 렌더링 반영

현재 `getColors(shape.style)` 사용 중 → 커스텀 색상 우선 적용:

```ts
function getColors(shape: Shape) {
  if (shape.color) {
    return {
      stroke: shape.color.stroke === 'none' ? 'transparent' : shape.color.stroke,
      fill: shape.color.fill === 'none' ? undefined : shape.color.fill,
      // point, label, rightAngle은 stroke 색상 따라감
    }
  }
  return STYLE_COLORS[shape.style] || STYLE_COLORS.default
}
```

> **주의**: `getColors` 시그니처가 `(style: string)` → `(shape: Shape)`로 변경됨. 템플릿 내 모든 호출 수정 필요.
완료 상태: ✅ 구현 완료

---

## Phase 4 — 내보내기 개선 【Codex】

### 4-A. `GridCanvas.vue` — exportPDF 메서드 추가

```ts
// 설치 필요: npm install jspdf
import jsPDF from 'jspdf'

function exportPDF(width: number, height: number): boolean {
  const stage = stageRef.value?.getNode?.()
  if (!stage) return false
  const dataUrl = stage.toDataURL({ pixelRatio: 3 })  // 고해상도
  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [width / 3.7795, height / 3.7795]  // px → mm 변환
  })
  pdf.addImage(dataUrl, 'PNG', 0, 0, width / 3.7795, height / 3.7795)
  pdf.save(`mathcut-${Date.now()}.pdf`)
  return true
}
```

> **패키지 설치**: `npm install jspdf` (Codex가 직접 실행)
완료 상태: ✅ 구현 완료 (`jspdf` 설치 포함)

### 4-B. PNG 고해상도 옵션

현재 `exportImage`의 `pixelRatio` 계산 방식 개선:
- 기존: 지정 크기 / 캔버스 크기 비율
- 변경: 300dpi 기준 `pixelRatio = 300 / 96` = 약 3.125 고정

```ts
// EditorView.vue 내보내기 UI에 해상도 옵션 추가
const exportDpi = ref<72 | 150 | 300>(300)
```
완료 상태: ✅ 구현 완료

### 4-C. `EditorView.vue` — UI 업데이트

크롬바 내보내기 섹션 변경:
```
[PNG ▼] [72dpi / 150dpi / 300dpi ▼] [↓ 내보내기]
포맷: PNG / PDF
```
완료 상태: ✅ 구현 완료

---

## 완료 기준

- [x] 도형 우클릭 → 복제/삭제/색상변경/레이어순서 메뉴 동작
- [x] 배경 우클릭 → 전체선택/실행취소/초기화/격자전환 동작
- [x] 색상 팔레트 칩 선택 시 선/채우기 색상 반영
- [x] PDF 내보내기 동작 (jsPDF)
- [x] PNG 300dpi 내보내기 동작
- [x] `npm run build` 통과

---

## 완료 후 처리

- `PROGRESS.md` 업데이트
- `logs/CLAUDE_LOG.md` / `logs/CODEX_LOG.md` 업데이트
완료 상태: ✅ 구현 완료
