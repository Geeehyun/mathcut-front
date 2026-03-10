# MathCut 업무 진행사항

**마지막 업데이트**: 2026-03-03

---

## 문서 구조

```
┌─────────────────────────────────────────────────────────────┐
│  PROGRESS.md (이 파일)                                       │
│  └─ 공용 진행 요약: Claude/Codex 모두 여기에 요약 기록        │
│                                                             │
│  logs/CLAUDE_LOG.md                                         │
│  └─ Claude 상세 로그: 기능 구현, 설계 결정 상세 내용          │
│                                                             │
│  logs/CODEX_LOG.md                                          │
│  └─ Codex 상세 로그: 버그 수정, 리팩토링 상세 내용            │
└─────────────────────────────────────────────────────────────┘
```

### 작성 규칙
1. **상세 내용**은 각자 로그 파일(`logs/`)에 먼저 기록
2. **요약**은 이 파일의 `작업 로그` 섹션에 기록
3. 날짜는 **역순** (최신이 위로)
4. 형식: `#### [담당자] 작업 제목` + 간단한 불릿 요약

---

## 현재 상태

| 항목 | 값 |
|------|-----|
| **현재 단계** | 1단계 - 프론트엔드 MVP |
| **개발 서버** | http://localhost:5174 |
| **다음 작업** | 선택/이동 및 특수도형 브라우저 QA, 잔여 UX polish |

### 진행률

| 단계 | 상태 | 진행률 |
|------|------|--------|
| 1단계: 프론트엔드 MVP | 🟢 진행 중 | 96% |
| 2단계: 백엔드 연동 | ⚪ 대기 | 0% |
| 3단계: AI 기능 | ⚪ 대기 | 0% |

---

## 작업 로그

> 최신순 정렬. 상세 내용은 `logs/` 참조.

### 2026-03-10 (세션 2)

#### [Claude] 내보내기 출판 품질 개선 4종 (A·B·F·D)
- **A: 흑백 내보내기** — PNG/PDF 픽셀 변환(Rec.709), SVG feColorMatrix 필터, 체크박스 UI
- **B: 600 DPI** — select 옵션 추가, 메모리 경고 computed, try-catch 렌더링 실패 처리
- **F: 출판 안내 문구** — 포맷별 CMYK/PDF-X/SVG Illustrator 안내 텍스트 추가
- **D: SVG 폰트 임베딩** — KaTeX_Main Regular·Bold woff2 base64 embed, async generateVectorSVG, 폰트 임베딩 체크박스(SVG 전용)
- `npm run build` 통과

### 2026-03-10

#### [Claude] 내보내기 해상도(DPI) 가이드 UI 개선
- `EditorView.vue`: SVG 선택 시 해상도 섹션 숨김+벡터 안내, PNG/PDF에 DPI별 용도 설명 추가
- `npm run build` 통과

#### [Claude] SVG 빈칸형 표시 + 높이 가이드 색상/굵기 분리 설정
- `GridCanvas.vue`: `svgBlankRectEl()` 헬퍼로 길이/원/높이/각도/점이름 빈칸 rect SVG 렌더링 추가
- `ContextMenu.vue`: 높이 우클릭 메뉴에 높이선색/길이선색/텍스트색/높이선굵기/길이선굵기 별도 컨트롤 추가
- `npm run build` 통과

#### [Claude] SVG 내보내기 높이 보조선 점선 누락 수정
- `GridCanvas.vue`: 메인 높이선 `stroke-dasharray="2 2"` 추가, 확장 base선 누락 추가, 직각 마커 색상 수정
- `npm run build` 통과

#### [Claude] SVG 내보내기 단위(cm) 간격 화면 일치 수정
- `GridCanvas.vue`: `svgUnitText()` 헬퍼로 숫자·단위를 분리 출력, 블록 중앙 계산으로 화면과 동일한 간격 유지
- `npm run build` 통과

#### [Claude] PNG/PDF 내보내기 비율 왜곡 버그 수정
- `GridCanvas.vue`: `pixelRatio` 계산 기준을 스테이지(창) 크기 → 그리드 고유 크기(1280×720)로 변경
- `drawImage` 6인수 크롭 형태로 변경 → 창 크기와 무관하게 그리드 영역만 정확히 내보내기
- `npm run build` 통과

#### [Claude] SVG 진짜 벡터 내보내기 구현
- `GridCanvas.vue`: `generateVectorSVG()` 함수 추가 — 도형/격자/측정/가이드 전체를 SVG 원시 요소로 직접 생성
- `viewBox` 활용으로 어떤 크기에도 픽셀 깨짐 없음, 기존 PNG-in-SVG 래스터 방식 완전 교체
- `npm run build` 통과

#### [Claude] 내보내기 크기 검증 + 초기화 + 권장 프리셋 UI 추가
- `EditorView.vue`: 0/음수/범위 초과 검증, [초기화] 버튼, 720p·1080p·2K 프리셋, 비율 표시, 내보내기 버튼 비활성화
- `npm run build` 통과

#### [Claude] 내보내기 크기 입력 자유화 + 배경 포함 동작 개선
- `EditorView.vue`: 크기 입력 핸들러에서 즉시 클램핑 제거 → 자유 입력 가능, 비율 유지 시 자동 계산 유지
- `GridCanvas.vue`: 배경 미포함 시 그리드 레이어 전체(배경색+격자선/점) 숨기고 흰색 배경 합성
- `npm run build` 통과

### 2026-03-03

#### [Claude] 우클릭/색상/내보내기 Phase 1 기반 구현
- `colorPalette.ts` 신규: CMYK 기반 stroke 8색 + fill 6색 팔레트 상수
- `types/index.ts`: ShapeColor 타입 + Shape.color? 옵션 필드
- `canvas.ts`: setShapeColor, reorderShape 액션 추가

#### [Claude] 우클릭/색상/내보내기 계획 수립
- `TODO/COLOR_CMYK.md`: CMYK 인쇄 고려사항 (팔레트 설계, PDF 내보내기, 색상 경고 등)
- `TODO/RIGHTCLICK_COLOR_EXPORT.md`: 우클릭 메뉴 + 팔레트 + 내보내기 분업 계획 (Phase 1~4)
- Claude: 팔레트 상수/타입/스토어 설계 담당, Codex: 컴포넌트/UI/jsPDF 구현 예정

#### [Claude] 이등변삼각형 버그 수정
- `useShape.ts`: triangle-isosceles 꼭짓점 X를 밑변 중점으로 snap → 항상 이등변 보장
- `EditorView.vue`: 안내 문구 수정

#### [Claude] 선택/이동 도구 버그 3종 수정
- `GridCanvas.vue`: 커서 변경(watchEffect + stage.container()), hitStrokeWidth 14, 드래그 히스토리 1회 수정
- `canvas.ts`: saveHistory public export
- `InfoPanel.vue`: "선택" 버튼 → setMode('select') 연결

#### [Claude] 도구별 기능 구현 Phase 1 (기반 설계)
- ModeType에 'select' 추가, moveShape 액션, geometry 특수 도형 계산 함수 6종 추가
- `TODO/TOOL_IMPLEMENTATION.md` 분업 계획 작성

#### [Codex] TOOL_IMPLEMENTATION.md 기준 Phase 2~6 구현 반영
- 변경 파일:
  - `src/components/canvas/GridCanvas.vue`: 선택/이동(클릭 선택, 빈 곳 해제, 드래그 이동), select 커서/hover move 커서, 선택 바운딩 박스, ray/line/arrow 렌더 개선, shape 미리보기 강화, 텍스트 가이드 인라인 입력 오버레이
  - `src/composables/useShape.ts`: 특수 도형 requiredPoints 조정, 정삼각형/정사각형/직사각형/마름모/평행사변형/정다각형 완성 분기 추가
  - `src/views/EditorView.vue`: 선택·이동 상태바 문구/아이콘 반영, 단축키(V/Escape/Delete/Backspace/Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z) 추가
  - `src/components/layout/AppSidebar.vue`: 선택/이동 툴(↖) 버튼 추가, `activeCategoryKey`에 select 반영
  - `src/composables/useGuide.ts`: 인라인 텍스트 입력 확정용 `createTextGuide` 노출
  - `src/components/InfoPanel.vue`: 선택 도형 타입/스타일/꼭짓점 좌표 표시 강화
  - `src/stores/canvas.ts`: `moveShape` 히스토리 옵션 파라미터 확장
  - `TODO/TOOL_IMPLEMENTATION.md`: 완료 항목 체크 업데이트
- 검증:
  - `npm run build` 통과
- 비고:
  - 선택/이동 도구는 요청대로 포토샵 스타일 인터랙션 중심으로 우선 구현(UI 미세조정 후속 가능)

### 2026-02-27 (2차)

#### [Codex] Photoshop-style UI 마무리 보정 (가시성 + 전환 성능)
- 변경 파일:
  - `src/components/layout/AppSidebar.vue`: 툴바 오프셋(`top-10 bottom-8`) 적용, 모눈 모드 라벨/아이콘 개선
  - `src/views/EditorView.vue`: 상태 바 모눈 모드 표기 개선 (`▦ 격자 / ∙∙ 점판 / □ 백지`)
  - `src/components/canvas/GridCanvas.vue`: 격자/점판 렌더를 단일 `v-shape` 드로우 방식으로 최적화
  - `TODO/UI_LAYOUT.md`: Codex 핸드오프 섹션 추가
- 작업 내용:
  - 좌측 툴바가 상단 크롬바/하단 상태바에 가려지던 이슈 수정
  - 한자 기반 모드 표기를 한국어 친화 표기+아이콘으로 교체
  - `백지→점판`, `백지→격자` 전환 지연을 유발하던 다수 노드 렌더링 제거
- 검증:
  - `npm run build` 통과

#### [Codex] Photoshop-style 레이아웃 5단계(noChrome) 적용
- 변경 파일:
  - `src/components/layout/AppLayout.vue`: `noChrome?: boolean` prop 추가, 헤더/푸터 조건부 렌더링 적용
  - `src/App.vue`: `<AppLayout :noChrome="true">`로 변경
  - `TODO/UI_LAYOUT.md`: Codex 5단계 완료, 6단계 부분 완료로 상태 갱신
- 검증:
  - `npm run build` 통과 (`vue-tsc -b && vite build`)
- 비고:
  - 브라우저 수동 확인 항목(플라이아웃/상태바/좌표 표기)은 이 환경에서 직접 확인 불가

#### [Claude] Photoshop-style UI 레이아웃 재설계 추가 수정
- **로고 중복 제거**: AppSidebar 툴박스 로고 제거 (크롬 바 + 헤더에 이미 존재)
- **캔버스 전체 채움**: GridCanvas에 ResizeObserver 적용 → 컨테이너 크기에 맞게 Konva stage 동적 확장
  - 격자선/도트도 동적 크기 기반으로 계산
  - border/rounded-lg 제거 (경계선 없이 깔끔하게)
  - `emit('mouseMove', ...)` 추가 (상태 바 좌표 표시 연동)
- 변경 파일: `AppSidebar.vue`, `GridCanvas.vue`, `EditorView.vue`
- `npm run build` 빌드 통과

#### [Claude] Photoshop-style UI 레이아웃 재설계 (1~3단계 완료)
- **캔버스 최대화**: 헤더(h-16)/푸터(h-12) 제거 → 크롬 바(h-10)+상태 바(h-8)로 대체
- **좌측 사이드바**: w-64 아코디언 → w-14 아이콘 툴박스 + 플라이아웃 패널 (수평 200px 확보)
- **통합 크롬 바**: 로고 + 컷관리 + 줌 + 내보내기 + 유저 아바타 (한 줄 h-10)
- **상태 바**: 현재 도구 + 안내 문구 + 격자 모드 + 마우스 좌표 표시
- **격자 모드 순환**: `cycleGridMode()` 추가 (格→点→白 클릭 순환)
- **TODO 디렉토리**: `TODO/` 생성, `TODO_EDITOR_MENU.md` → `TODO/EDITOR_MENU.md` 이동
- **Codex 4~7단계 대기**: AppLayout noChrome, GridCanvas border 제거, 우측 패널 탭 UI 개선
- 변경 파일:
  - `src/stores/tool.ts`: `cycleGridMode()` 추가
  - `src/components/layout/AppSidebar.vue`: 아이콘 툴박스 + 플라이아웃 전면 재작성
  - `src/views/EditorView.vue`: 크롬 바 + 상태 바 + MainToolbar 제거
  - `TODO/UI_LAYOUT.md`: 분업 체크리스트 생성
  - `TODO/EDITOR_MENU.md`: 기존 TODO_EDITOR_MENU.md 이동
- `npm run build` 빌드 통과

### 2026-02-27

#### [Codex] 에디터 메뉴 재구성 5~6단계 완료
- `TODO_EDITOR_MENU.md` 기준 Codex 담당 범위 구현 완료
- 변경 파일:
  - `src/components/InfoPanel.vue`: 측정 정보 패널 → 속성 패널(선택/이동/스타일/가이드)로 전면 교체
  - `src/components/toolbar/MainToolbar.vue`: 컷 관리/화면 비율/내보내기(PNG/SVG + px) 툴바로 재구성
  - `src/views/EditorView.vue`: `MainToolbar` 실연결, 컷 스냅샷 관리, 내보내기 이벤트 연결
  - `src/components/canvas/GridCanvas.vue`: 선택 하이라이트, 가이드 토글 반영, 점 이름 토글, 배율 반영, 내보내기 메서드 노출
  - `src/stores/tool.ts`: `showLength/showAngle/showPointName/zoom` 상태 및 액션 추가
  - `src/stores/canvas.ts`: `updateShape/getSnapshot/loadSnapshot` 액션 추가
  - `TODO_EDITOR_MENU.md`: 단계 5~6 상태를 완료로 갱신
- `npm run build` 빌드 통과

#### [Codex] 에디터 모눈종이/포인트 동작 재보강 (사용자 피드백 반영)
- 사용자 피드백 3건 반영:
  - 모눈종이 기본 작업 영역 확대 (`64 x 36`)
  - `대상 위의 점` 기능 실구현(소격자 스냅 + 도형/선 위/내부 판정)
  - 모눈종이 표시 모드 3종(`격자/점만/백지`) 동작 확정
- 변경 파일:
  - `src/types/index.ts`: `point-on-object` 타입 추가, 격자 기본 크기 확대
  - `src/components/layout/AppSidebar.vue`: `대상 위의 점` 버튼 활성화
  - `src/composables/useShape.ts`: 점/선형 도형 완성 조건 보강, 대상 위 점 생성 조건 추가
  - `src/components/canvas/GridCanvas.vue`: 대상 위 점 소격자 스냅, 점 도형 렌더, 선형 도형 open 렌더
  - `src/utils/geometry.ts`: 소격자 분할(4분할) 및 도형 내부 판정 유틸 추가
  - `src/views/EditorView.vue`: 대상 위 점 안내문/도구명/아이콘 매핑 추가
- `npm run build` 빌드 통과

#### [Claude] 모눈종이 레이아웃·소격자·표시 모드 구현
- 변경 파일:
  - `src/types/index.ts`: `GridMode` 타입 추가 (`'grid' | 'dots' | 'none'`)
  - `src/stores/tool.ts`: `showGrid(boolean)` → `gridMode(GridMode)` 교체, `setGridMode()` 추가
  - `src/utils/geometry.ts`: `snapToSubGrid()`, `SUB_GRID_DIVISIONS` 추가 (10px 소격자)
  - `src/components/layout/AppLayout.vue`: 오버레이 레이아웃 (사이드바 absolute, main 전체 너비)
  - `src/components/layout/AppSidebar.vue`: floating + slide 토글, gridMode 3단계 버튼
  - `src/views/EditorView.vue`: 캔버스 전체 화면 + 우측 패널 floating + 토글 탭
  - `src/components/canvas/GridCanvas.vue`: gridMode별 렌더링, 소격자 도트, '점' 도구 소격자 스냅
- `npm run build` 빌드 통과

#### [Claude] 에디터 메뉴 재구성 1~4단계 완료
- `MathCut IA_v1.4.xlsx` 기준으로 사이드바(생성 패널) 전면 재구성
- `TODO_EDITOR_MENU.md` 분업 계획 문서 생성 (Codex 5~6단계 대기 중)
- 변경 파일:
  - `src/types/index.ts`: ShapeType 19개 신규 항목 추가 (점/선/삼각형세부/사각형세부/기타)
  - `src/stores/tool.ts`: `showGrid`, `polygonSides` 상태 및 액션 추가
  - `src/components/layout/AppSidebar.vue`: 7개 섹션 아코디언 구조로 전면 재구성
  - `src/views/EditorView.vue`: 안내문/도구명/레이어아이콘 신규 타입 맵핑 추가
  - `src/components/toolbar/MainToolbar.vue`: ShapeType 타입 오류 수정
- `npm run build` 빌드 통과
- **다음 작업**: Codex → `InfoPanel.vue` 속성 패널 재구성, `MainToolbar.vue` 컷관리/내보내기로 변경

### 2026-02-19

#### [Codex] 레이어 패널에 가이드 항목 포함
- 레이어 목록 표시를 도형 전용에서 도형+가이드 통합으로 확장
- 가이드 타입별 아이콘(↔/A/∠)과 순번 표시
- `src/views/EditorView.vue` 수정 후 `npm run build` 통과

#### [Codex] 가이드 기능 도형-기준 인터랙션으로 변경
- 각도 가이드: 도형 꼭짓점 선택 시 해당 각도 표시되도록 변경
- 길이 가이드: 도형 변 선택 후 드래그 방향으로 고정 곡률 점선 곡선 가이드 생성
- 길이 가이드 드래그 미리보기 및 각도 가이드 호(arc) 렌더링 추가
- 관련 유틸리티 추가 후 `npm run build` 통과

#### [Codex] 구현 기능 기준선 파악
- 리팩토링/기능 수정 전 현재 코드 기준 구현 기능 스캔 완료
- 도형(사각형/삼각형/원/자유선), 가이드(길이/텍스트/각도), 스냅/직각감지/측정패널/히스토리 동작 확인
- 미구현 핵심: 각도 가이드 호(arc) 렌더링, 내보내기/AI 생성 버튼 실동작 연결

#### [Codex] 문서 구조/설정 파일명 확인
- Claude가 재정리한 문서 구조(`PROGRESS.md` 공용 + `logs/` 상세) 점검 완료
- `CODEX.md` 파일명으로 운영 가능 여부 검토
- 현재 구조는 일관적이며 운영 가능, 다만 외부 도구 호환을 위해 `AGENTS.md` 포인터 파일 유지 권장

#### [Claude] 로그 구조 정리
- `AGENTS.md` → `CODEX.md` 이름 변경
- 모든 문서에서 참조 업데이트
- `logs/CLAUDE_LOG.md`에 이전 작업 기록 추가
- 날짜 2026으로 통일

#### [Codex] 공용 로그 사용 가이드 반영
- `PROGRESS.md` 상단에 사용 방법 추가
- `CLAUDE.md`에 로그 운영 방식 추가

#### [Codex] 역할별 상세 로그 분리
- `logs/CODEX_LOG.md`, `logs/CLAUDE_LOG.md` 생성
- `CODEX.md`에 로그 운영 규칙 섹션 추가

#### [Codex] 협업 로그 규칙 추가
- `CODEX.md` 추가 (Codex 전용 가이드)
- 기록 항목 표준화

#### [Claude] 디자인 가이드 문서 작성
- `DESIGN_GUIDE.md` 생성
- 컬러, 타이포, 컴포넌트, Do & Don't 정의

#### [Claude] UI 디자인 개선
- 모던 미니멀 + 컬러풀 에듀 스타일 적용
- 헤더/사이드바/푸터 레이아웃 구성
- 우측 정보 패널 + 레이어 패널 추가

#### [Claude] 데모 코드 Vue 이관
- 타입, 스토어, 유틸리티, 컴포저블, 컴포넌트 분리
- 도형 그리기, 스타일, 가이드 기능 모두 이관

#### [Claude] Vue 3 프로젝트 세팅
- Vite + Vue 3 + TypeScript 프로젝트 생성
- Tailwind CSS, vue-konva, Pinia 설치

#### [Claude] 프로젝트 킥오프
- 기술 스택 확정
- 공유 문서 시스템 구축

---

## 구현 현황

### 도형 그리기
- [x] 사각형 (4점)
- [x] 삼각형 (3점)
- [x] 원 (중심 + 반지름)
- [x] 자유 직선 (다각형)
- [x] 격자 스냅
- [x] 직각 자동 감지 및 표시
- [x] 변 길이 자동 표시

### 스타일
- [x] 기본 (파란색)
- [x] 파스텔 (분홍색)
- [x] 흑백

### 가이드
- [x] 길이 표시
- [x] 텍스트 추가
- [x] 각도 표시

### UI/UX
- [x] 헤더 (로고, 네비게이션, 유저 메뉴)
- [x] 사이드바 (도형/스타일/가이드 도구)
- [x] 푸터
- [x] 측정 정보 패널
- [x] 레이어 패널
- [x] 실행취소
- [x] 전체 초기화

---

## 이슈 & TODO

### 알려진 이슈
- [x] 텍스트 가이드: prompt 창 → 인라인 입력으로 개선 완료 (2026-03-03)
- [ ] 길이 가이드 편집 기능 미구현
- [ ] 각도 가이드 호 렌더링 스타일/배치 고도화 필요

### TODO (우선순위순)
1. 브라우저 테스트 및 버그 확인
2. 길이 가이드 편집 기능
3. 각도 가이드 호 렌더링 스타일/배치 polish
4. 이미지 내보내기 UX 개선

### Codex 작업 요청
현재 없음

---

## 로드맵

### 1단계: 프론트엔드 MVP ← 현재
- [x] Vue 3 + Vite 프로젝트 세팅
- [x] Tailwind CSS 설정
- [x] Konva.js (vue-konva) 설치
- [x] 기본 레이아웃 구성
- [x] 모눈종이 캔버스 컴포넌트
- [x] 도형 그리기 기능 이관
- [x] 툴바 컴포넌트
- [x] 스타일 선택 기능
- [x] 가이드 추가 기능
- [x] 실행취소
- [ ] 테스트 및 버그 수정
- [ ] 이미지 내보내기

### 2단계: 백엔드 연동
- [ ] Spring Boot 프로젝트 세팅
- [ ] AI API 프록시 엔드포인트
- [ ] 프론트-백 연동

### 3단계: AI 기능
- [ ] 손그림 입력 UI
- [ ] 프롬프트 입력 UI
- [ ] AI 생성 이미지 → 캔버스 변환
- [ ] 생성된 도형 편집 기능
