# 에디터 메뉴 재구성 TODO

**IA 기준 파일**: `D:\vision\docs\MathCut IA_v1.4.xlsx` → 시트: `IA`

---

## 분업 요약

| 단계 | 담당 | 상태 | 내용 |
|------|------|------|------|
| 1 | Claude | ✅ 완료 | `types/index.ts` ShapeType 확장 |
| 2 | Claude | ✅ 완료 | `stores/tool.ts` 신규 상태 추가 |
| 3 | Claude | ✅ 완료 | `AppSidebar.vue` 생성 패널 전면 재구성 |
| 4 | Claude | ✅ 완료 | `EditorView.vue` 안내문/레이어 맵핑 확장 |
| 5 | **Codex** | ✅ 완료 | `InfoPanel.vue` → 속성 패널 재구성 |
| 6 | **Codex** | ✅ 완료 | `MainToolbar.vue` 재구성 + 빌드 확인 |

---

## IA 기반 새 메뉴 구조

### 생성 패널 (좌측 사이드바 = AppSidebar.vue)

```
1. 점
   - 점
   - 대상 위의 점

2. 선
   - 선분 (길이 표기/미표기)
   - 반직선
   - 직선
   - 각

3. 평면도형
   [삼각형]
   - 정삼각형
   - 직각삼각형
   - 이등변삼각형
   - 자유로운 삼각형

   [사각형]
   - 정사각형
   - 직사각형
   - 사다리꼴
   - 마름모
   - 평행사변형
   - 자유로운 사각형

   - 정다각형 (변 개수 입력칸)
   - 자유 도형
   - 원

4. 입체도형 ← 2차 목표 (비활성 버튼)

5. 기타
   - 텍스트 추가
   - 화살표
   - 수 모형 (수 입력칸)

6. AI 삽화 생성 ← 2차 목표 (비활성 버튼)

7. 보조 도구
   - 모눈종이 on/off (toolStore.showGrid)
   - 자 (길이 입력칸) ← UI만 (실 기능 2차)
   - 각도기 (각도 입력칸) ← UI만 (실 기능 2차)
   - 삼각자 (두 변 길이 입력칸) ← UI만 (실 기능 2차)
   - 시계 (시분초 입력칸) ← UI만 (실 기능 2차)
```

### 속성 패널 (우측 패널 = InfoPanel.vue 재구성) ← Codex 담당

```
[선택]
- 선택 / 그룹 선택 / 복제 / 삭제

[이동]
- 밀기 (위치 이동)
- 뒤집기: 좌우 / 상하
- 돌리기: 각도 입력 (시계방향 / 반시계방향)

[스타일]  ← AppSidebar에서 이동
- 흑백 / 파스텔

[가이드] ← AppSidebar에서 이동
- 길이 on/off
- 각도 on/off
- 점 이름 on/off
```

### 상단 툴바 (MainToolbar.vue) ← Codex 담당

```
[컷 관리]
- 추가 / 복제 / 삭제

[화면 비율]
- 확대 / 축소

[내보내기] ← 기존 버튼 기능 고도화
- 형식: PNG / SVG
- 규격: 가로/세로 px 입력
```

---

## 타입 참조 (신규 추가된 ShapeType)

```typescript
// types/index.ts에 추가된 항목들
type ShapeType =
  // 기존 (유지)
  | 'rectangle' | 'triangle' | 'circle' | 'polygon'
  // 점
  | 'point'
  // 선
  | 'segment' | 'ray' | 'line' | 'angle-line'
  // 삼각형
  | 'triangle-equilateral' | 'triangle-right' | 'triangle-isosceles' | 'triangle-free'
  // 사각형
  | 'rect-square' | 'rect-rectangle' | 'rect-trapezoid'
  | 'rect-rhombus' | 'rect-parallelogram' | 'rect-free'
  // 기타
  | 'polygon-regular' | 'free-shape' | 'arrow' | 'counter'
```

## 스토어 참조 (신규 추가된 상태)

```typescript
// stores/tool.ts에 추가된 상태
const showGrid = ref<boolean>(true)      // 모눈종이 표시 여부
const polygonSides = ref<number>(5)      // 정다각형 변 개수

// 추가된 액션
function setShowGrid(v: boolean)
function setPolygonSides(n: number)
```

---

## Codex 작업 시 주의사항

1. **기존 ShapeType ('rectangle', 'triangle', 'circle', 'polygon') 절대 삭제 금지** - GridCanvas.vue가 이 타입으로 도형을 렌더링함
2. **스타일 선택 (흑백/파스텔)**: AppSidebar에서 제거하고 속성 패널로 이동
3. **가이드 토글 (길이/각도)**: AppSidebar에서 제거하고 속성 패널로 이동
4. **2차 목표 항목**: 버튼 표시는 하되 `disabled` 처리 + "준비중" 배지 표시
5. **MainToolbar.vue**: 기존 도형/가이드/스타일 토글 버튼은 완전 제거
6. `npm run build` 빌드 성공 확인 후 완료 처리

---

## 완료 후 처리

- `PROGRESS.md`에 작업 요약 추가
- `logs/CODEX_LOG.md`에 상세 기록
- 이 파일(`TODO_EDITOR_MENU.md`)의 상태 표 업데이트
