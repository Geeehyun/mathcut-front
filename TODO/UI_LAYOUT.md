# Photoshop-style UI 레이아웃 재설계 TODO

**목표**: 캔버스가 최대한 크고 UI가 안 걸리적거리는 포토샵 스타일 레이아웃

---

## 분업 요약

| 단계 | 담당 | 상태 | 내용 |
|------|------|------|------|
| 1 | Claude | ✅ 완료 | `stores/tool.ts` — `cycleGridMode()` 추가 |
| 2 | Claude | ✅ 완료 | `AppSidebar.vue` — w-14 아이콘 툴박스 + 플라이아웃, 로고 제거 |
| 3 | Claude | ✅ 완료 | `EditorView.vue` — 크롬 바(h-10) + 상태 바(h-8) + 탭 UI |
| 4 | Claude | ✅ 완료 | `GridCanvas.vue` — 동적 크기(ResizeObserver), border 제거, mouseMove emit |
| **5** | **Codex** | ✅ **완료** | `AppLayout.vue` + `App.vue` — noChrome prop (헤더/푸터 숨김) |
| **6** | **Codex** | ⚠️ **부분 완료** | `npm run build` 완료 + `PROGRESS.md` 기록 완료 (브라우저 수동 확인 필요) |

---

## 목표 레이아웃

```
┌──────────────────────────────────────────────────────────────────────┐
│ [M]  ←  1 / 3  →  [+][⧉][🗑]   [−][50%][+]   [↓ 내보내기]   [U▾] │  h-10 (크롬 바)
├──┬───────────────────────────────────────────────────────────────────┤
│  │                                                       ┌──────────┤
│· │                                                       │[속성][레이어│
│— │         캔버스 (모눈종이 full-fill)                   │          │
│△ │                                                       │ InfoPanel│
│□ │                                                       │          │
│⬡ │                                                       │  Layer   │
│T │                                                       │  Panel   │
│格│                                                       │  w-64    │
│  │                                                       └──────────┤
│↩ │                                                                   │
├──┴───────────────────────────────────────────────────────────────────┤
│ [·] 점  │  위치를 클릭하세요              │  格 격자  │  x:12 y:8  │  h-8 (상태 바)
└──────────────────────────────────────────────────────────────────────┘
  w-14                                                       w-64 (toggle)
```

---

## [Claude] 1단계: stores/tool.ts — cycleGridMode()

```typescript
// grid → dots → none → grid 순환
function cycleGridMode() {
  const order: GridMode[] = ['grid', 'dots', 'none']
  const idx = order.indexOf(gridMode.value)
  gridMode.value = order[(idx + 1) % order.length]
}
```

수정 파일: `src/stores/tool.ts`

---

## [Claude] 2단계: AppSidebar.vue — 아이콘 툴박스 + 플라이아웃

**툴박스 (w-14, 56px)**:
- 아이콘 버튼 단일 컬럼 (h-12 w-full)
- 카테고리: 점(·) / 선(—) / 삼각형(△) / 사각형(□) / 다각형·원(⬡) / 기타(T)
- 격자 모드 버튼: 클릭 시 cycleGridMode() (格/点/白 표시)
- 하단: 실행취소 / 전체 초기화

**플라이아웃 패널 (w-52)**:
- 카테고리 아이콘 클릭 → absolute 위치에 sub-panel 출현
- 서브 버튼 그리드 (기존 AppSidebar 내용 그대로)
- 도구 선택 시 자동 닫힘
- 외부 클릭 시 닫힘

수정 파일: `src/components/layout/AppSidebar.vue`

---

## [Claude] 3단계: EditorView.vue — 크롬 바 + 상태 바

**크롬 바 (h-10, shrink-0)**:
- 로고 아이콘 + "MathCut"
- 컷 관리: ← N/M → + 추가/복제/삭제
- 줌: − / 100% / +
- 내보내기 버튼
- 유저 아바타

**상태 바 (h-8, shrink-0)**:
- 좌: 현재 도구 아이콘 + 이름
- 중: 안내 문구 (기존 floating badge 대체)
- 우: 격자 모드 표시 + 마우스 좌표

**제거**: MainToolbar import/사용, 기존 floating 도구 배지 strip

수정 파일: `src/views/EditorView.vue`

---

## [Codex] 5단계: AppLayout.vue + App.vue — noChrome ← **지금 작업할 단계**

**목적**: EditorView를 전체 화면으로 표시하고 AppHeader/AppFooter를 숨겨 캔버스를 최대화

### AppLayout.vue 변경

현재 코드 (`src/components/layout/AppLayout.vue`):
```vue
<div class="h-screen flex flex-col bg-gray-50">
  <AppHeader />
  <div class="flex-1 relative overflow-hidden">
    <AppSidebar />
    <main class="absolute inset-0"><slot /></main>
  </div>
  <AppFooter />
</div>
```

변경 후:
```vue
<script setup lang="ts">
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import AppFooter from './AppFooter.vue'

const props = defineProps<{ noChrome?: boolean }>()
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <AppHeader v-if="!props.noChrome" />
    <div class="flex-1 relative overflow-hidden">
      <AppSidebar />
      <main class="absolute inset-0"><slot /></main>
    </div>
    <AppFooter v-if="!props.noChrome" />
  </div>
</template>
```

### App.vue 변경

현재 코드 (`src/App.vue`):
```vue
<AppLayout>
  <EditorView />
</AppLayout>
```

변경 후:
```vue
<AppLayout :noChrome="true">
  <EditorView />
</AppLayout>
```

**주의사항**:
- `AppHeader.vue`, `AppFooter.vue` 파일 삭제 금지 (다른 페이지에서 재사용 예정)
- `AppSidebar`는 `noChrome` 여부와 무관하게 항상 렌더링
- `AppLayout`의 기존 flex 구조(`h-screen flex flex-col`) 유지

수정 파일: `src/components/layout/AppLayout.vue`, `src/App.vue`

---

## [Codex] 6단계: 빌드 확인

```bash
npm run build
```

- 빌드 성공 확인
- `npm run dev`로 브라우저에서 다음 확인:
  - [ ] 헤더/푸터가 사라지고 크롬 바(h-10)만 상단에 표시되는지
  - [ ] 캔버스가 화면 전체를 채우는지
  - [ ] 좌측 툴박스 아이콘 클릭 → 플라이아웃 열림/닫힘
  - [ ] 도구 선택 → 캔버스에서 정상 그리기 가능한지
  - [ ] 하단 상태 바에 도구명 + 안내문구 + 마우스 좌표 표시되는지
- 이 파일 상태 표 업데이트 (⬜ → ✅)
- `PROGRESS.md` 에 완료 기록

---

## 연동 주의사항

1. `toolStore.setMode()` + `toolStore.setShapeType()` 기존 패턴 유지
2. `cycleGridMode()` 사용 — `setGridMode()`도 유지 (삭제 금지)
3. 기존 ShapeType 목록 변경 금지 (GridCanvas가 의존)
4. MainToolbar.vue 파일은 삭제하지 않고 보존
5. InfoPanel.vue 변경 없음

---

## Codex 추가 핸드오프 (2026-02-27)

### UI 가시성/겹침 보정
- 좌측 툴바가 크롬바/상태바를 침범하지 않도록 오프셋 적용
- 변경: `AppSidebar.vue` 컨테이너 `top-10 bottom-8`

### 모눈종이 모드 라벨 개선
- 한자 표기 제거
- `격자: ▦`, `점판: ∙∙`, `백지: □`로 통일
- 변경: `AppSidebar.vue`, `EditorView.vue`

### grid 전환 성능 개선 (핵심)
- 기존 병목: 점/격자 렌더를 `v-for` 기반 다수 노드(`v-circle`, `v-line`)로 생성
- 개선 방식:
  - 점판(main dots) → 단일 `v-shape` sceneFunc 드로우
  - 소격자 dots → 단일 `v-shape` sceneFunc 드로우
  - 격자선(grid lines) → 단일 `v-shape` sceneFunc 드로우(major/minor 분리)
  - 격자 레이어 `listening: false` 유지
- 변경: `GridCanvas.vue`
- 결과: `백지 ↔ 점판`, `백지 ↔ 격자` 전환 체감 지연 완화
