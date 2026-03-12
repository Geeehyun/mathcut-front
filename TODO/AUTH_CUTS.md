# 인증 + 컷 관리 기능 구현 계획

**관련 API**: `D:\vision\mathcut-api\API-SPEC.md`
**담당 분업**: Claude (기반 설계 + 화면) / Codex (API 연동)

---

## 화면 구조

```
/login          → LoginView      (비로그인 접근 가능, 로그인 시 /library로)
/library        → MyLibraryView  (로그인 필요 — 내 컷 보관함)
/editor         → EditorView     (로그인 필요 — 새 컷 작성)
/editor/:cutId  → EditorView     (로그인 필요 — 기존 컷 편집)
```

---

## 신규 파일 목록

| 파일 | 담당 | 설명 |
|------|------|------|
| `src/router/index.ts` | Claude | Vue Router 설정, Navigation Guard |
| `src/stores/auth.ts` | Claude | 로그인 상태, JWT 토큰 (localStorage) |
| `src/composables/useApi.ts` | Claude | fetch 래퍼 (Base URL, Auth 헤더 자동 추가) |
| `src/composables/useCutStore.ts` | Codex | 컷 CRUD API 연동 |
| `src/views/LoginView.vue` | Claude | 로그인/회원가입 화면 + 기능 |
| `src/views/MyLibraryView.vue` | Claude | 컷 보관함 화면 골격 (UI + 빈상태/로딩) |

---

## Claude 작업 범위

### 1단계: 기반 (router + auth + api)

#### `src/router/index.ts`
```
- createRouter (history mode)
- 라우트: /login, /library, /editor, /editor/:cutId
- Navigation Guard: 비로그인 → /login 리다이렉트
  - /login은 로그인 상태에서 접근 시 /library로 리다이렉트
```

#### `src/stores/auth.ts` (Pinia)
```typescript
state:
  - accessToken: string | null   (localStorage 동기화)
  - refreshToken: string | null  (localStorage 동기화)
  - userId: number | null
  - nickname: string | null

getters:
  - isLoggedIn: boolean

actions:
  - login(email, password)   → POST /api/auth/login
  - register(email, password, nickname) → POST /api/auth/register
  - refreshTokens()          → POST /api/auth/refresh
  - logout()                 → POST /api/auth/logout 후 세션 초기화
  - restoreFromStorage()     → 앱 시작 시 localStorage에서 복원
```

#### `src/composables/useApi.ts`
```typescript
- apiGet(path)
- apiPost(path, body)
- apiPut(path, body)
- apiDelete(path)
- 공통: Authorization: Bearer {token} 헤더 자동 추가
- 공통: VITE_API_BASE_URL 기반 URL 조합
- 공통: 401 응답 시 refresh 재시도 후 실패하면 auth.logout() + /login 이동
```

---

### 2단계: 화면

#### `src/views/LoginView.vue`
```
- 탭: 로그인 / 회원가입
- 로그인: email + password → auth.login() → /library
- 회원가입: email + password + nickname → auth.register() → 로그인탭으로
- 에러 메시지 표시
- 스타일: 중앙 카드, 블루-인디고 그라데이션 헤더
```

#### `src/views/MyLibraryView.vue` (UI 골격)
```
- 헤더: MathCut 로고 + 닉네임 + 로그아웃
- [+ 새 컷 만들기] 버튼 → /editor
- 컷 카드 그리드 (title, updatedAt, 삭제 버튼)
- 빈 상태: "저장된 컷이 없습니다" 안내
- 로딩 스피너
- 컷 카드 클릭 → /editor/:cutId
→ 데이터 연동은 Codex 담당
```

#### `src/views/EditorView.vue` 수정
```
- 크롬 바 우측 유저 아바타:
  - 현재: 더미 아바타 원
  - 변경: 드롭다운 (닉네임 첫 글자, "내 보관함" / "로그아웃")
- 크롬 바에 [저장] 버튼 추가 (AI 스케치 옆)
  → 저장 기능 자체는 Codex 담당 (useEditorSave 호출만 연결)
- App.vue: RouterView로 교체
- main.ts: router 등록
```

---

## Codex 작업 범위

### 3단계: API 연동

#### `src/composables/useCutStore.ts`
```typescript
- fetchCuts()           → GET /api/cuts
- fetchCut(id)          → GET /api/cuts/:id
- saveCut(title, data, thumbnail?)  → POST /api/cuts → id 반환
- updateCut(id, title, data, thumbnail?) → PUT /api/cuts/:id
- deleteCut(id)         → DELETE /api/cuts/:id
```

#### `src/views/MyLibraryView.vue` API 연동
```
- mounted 시 fetchCuts() 호출
- 컷 목록 렌더링 (thumbnail 포함)
- 삭제 버튼: deleteCut(id) → 목록 갱신
- 컷 카드 클릭 → router.push('/editor/' + cut.id)
```

#### `src/views/EditorView.vue` 저장/로드 연동
```
- onMounted: route.params.cutId 있으면 fetchCut(id) → 캔버스 복원
  - canvasStore.loadSnapshot(cut.canvasData)
  - currentCutId ref 관리 (저장 시 POST vs PUT 판단)
- [저장] 버튼 클릭:
  - title 입력 모달 또는 인라인 입력
  - thumbnail data URL 생성
  - 신규: saveCut(title, snapshot, thumbnail) → /editor/:newId로 replace
  - 수정: updateCut(currentCutId, title, snapshot, thumbnail)
  - 성공 시 토스트 "저장되었습니다"
```

---

## 작업 순서

```
Claude: 1단계 (router + auth + api) → 2단계 (LoginView + MyLibraryView 골격 + EditorView 수정)
Codex: Claude 완료 후 → 3단계 (useCutStore + MyLibraryView 연동 + EditorView 저장/로드)
```

---

## 설계 참고사항

### JWT 저장
- `localStorage.setItem('mc_token', accessToken)` 으로 유지
- `localStorage.setItem('mc_refresh_token', refreshToken)` 으로 유지
- 앱 시작(main.ts) 시 `authStore.restoreFromStorage()` 호출

### 컷 제목
- 저장 시 제목 미입력 → 기본값 `"제목 없음"`

### 기존 컷 편집 상태
- `/editor` 진입 시: 새 컷 (currentCutId = null)
- `/editor/:cutId` 진입 시: 기존 컷 (currentCutId = cutId)

### canvasData 형식
```json
{ "shapes": [...], "guides": [...] }
```
→ `canvasStore.getSnapshot()` 그대로 사용

### thumbnail
- 컷 목록/상세 응답의 `thumbnail` 사용
- 저장/수정 시 `thumbnail`은 선택값
- 프론트에서는 에디터 canvas PNG data URL을 생성해 함께 전송

---

## 체크리스트

### Claude
- [ ] vue-router 패키지 설치 (`npm install vue-router`)
- [ ] `src/router/index.ts` 작성
- [ ] `src/stores/auth.ts` 작성
- [ ] `src/composables/useApi.ts` 작성
- [ ] `src/views/LoginView.vue` 작성
- [ ] `src/views/MyLibraryView.vue` 골격 작성
- [ ] `EditorView.vue` 크롬 바 유저 드롭다운 + 저장 버튼 추가
- [ ] `App.vue` RouterView 전환
- [ ] `main.ts` router 등록
- [ ] `npm run build` 통과

### Codex
- [x] `src/composables/useCutStore.ts` 작성
- [x] `MyLibraryView.vue` 컷 목록 API 연동 + 삭제
- [x] `EditorView.vue` cutId 로드 + 저장 버튼 연동
- [x] `npm run build` 통과
