# MathCut 프로젝트 - Codex 작업 가이드

이 파일은 Codex가 MathCut 프로젝트에서 작업할 때 따르는 운영 규칙입니다.
**새 세션 시작 시 `CLAUDE.md`, `CODEX.md`, `PROGRESS.md`를 먼저 확인합니다.**

---

## 프로젝트 컨텍스트

- 프로젝트: **MathCut (매쓰컷)**
- 주 AI 어시스턴트: **Claude**
- Codex 역할: **버그 수정, 리팩토링, 구조 안정화, 문서 보강**

---

## 협업 원칙

1. Claude가 만든 구조/방향을 우선 존중하고, 변경 시 영향 범위를 명확히 설명합니다.
2. 기능 추가보다 안정성(버그 수정, 회귀 방지, 코드 일관성)을 우선합니다.
3. 큰 변경은 작은 단위로 나누어 적용하고, 확인 가능한 결과를 남깁니다.

---

## 작업 완료 규칙 (필수)

**모든 작업 완료 후 반드시 `PROGRESS.md`를 업데이트합니다.**

기록 항목:
- 날짜
- 담당자 (`Codex` 또는 `Claude`)
- 변경 파일
- 작업 요약
- 파일 변경이 없는 경우에도 수행 내용(분석/검증/리뷰) 기록

예외:
- 사용자가 해당 작업에 한해 "기록하지 말라"고 명시한 경우만 생략 가능합니다.

---

## ⚠️ 인코딩 규칙 (위반 시 커밋 차단됨)

> **이 규칙은 git pre-commit hook(`.githooks/pre-commit`)으로 강제됩니다.**
> 위반 시 커밋이 자동 차단되므로 반드시 준수하세요.

### 필수 사항
- **모든 소스 파일(`.vue`, `.ts`, `.js`, `.md`)은 반드시 UTF-8 인코딩으로 저장합니다.**
- Windows 환경에서 파일 저장 시 CP949/EUC-KR이 아닌 UTF-8을 명시적으로 선택합니다.
- `.editorconfig`에 `charset = utf-8`이 설정되어 있으므로 EditorConfig 지원 에디터 사용을 권장합니다.

### 금지 사항 (pre-commit hook이 감지하는 패턴)
- 소스 파일에 **CJK Compatibility Ideographs (U+F900-U+FAFF)** 포함 금지
  - 예: 留(U+F9CD), 紐(U+F9CF), 罹(U+F9DC) 등이 주석에 나타나면 인코딩 오류
- 소스 파일에 **Enclosed Digits (U+2460-U+2473, ①-⑳)** 포함 금지
  - 예: ⑤(U+2464), ⑹(U+2479)가 주석에 나타나면 인코딩 오류

### 확인 방법
커밋 전 직접 검사하려면:
```bash
python3 .githooks/pre-commit
```

### 배경
2026-03-12: Codex가 Windows CP949 환경에서 저장한 파일에서 한국어 주석 23개가
`// 마우스 좌표` → `// 留덉슦??醫뚰몴` 형태로 깨진 사례 발생.
이후 Claude가 수정 + pre-commit hook으로 재발 방지 조치 완료.

- 운영 규칙 변경 시 `CODEX.md`와 `PROGRESS.md`에 함께 반영합니다.

---

## 로그 운영 규칙

- 공용 진행 로그는 `PROGRESS.md`를 단일 기준 문서로 유지합니다.
- 상세 작업 로그는 역할별 파일로 분리합니다.
- `logs/CODEX_LOG.md`: Codex 상세 로그(버그 원인, 리팩토링 메모, 검증 내용)
- `logs/CLAUDE_LOG.md`: Claude 상세 로그(기획/구현 결정, 기능 작업 메모)
- 작업 완료 시:
  1. 상세 내용은 각자 로그 파일에 기록
  2. 최종 요약과 결과는 `PROGRESS.md`에 기록

---

## 백엔드 연동 현황

> **2026-03-12부터 백엔드 API가 연동되었습니다.**

| 항목 | 값 |
|------|-----|
| **백엔드 위치** | `D:\vision\mathcut-api` |
| **API 명세** | `D:\vision\mathcut-api\API-SPEC.md` |
| **Base URL** | `http://localhost:8080` |
| **환경변수** | `VITE_API_BASE_URL=http://localhost:8080` (`.env`) |

### 변경된 사항
- `useAISketch.ts`: OpenAI 직접 호출 제거 → `POST /api/ai/sketch` 백엔드 호출로 교체
- `VITE_OPENAI_API_KEY`, `VITE_OPENAI_MODEL` 환경변수 폐기 → `VITE_API_BASE_URL` 사용
- 프롬프트 로직(`buildPrompt`, `buildUserInstruction`)은 백엔드로 이동됨

### 주의
- 프론트에서 OpenAI 직접 호출 코드를 절대 추가하지 마세요.
- AI 관련 기능 수정 시 반드시 API 명세를 먼저 확인하세요.

---

## 참조 문서

| 파일 | 설명 |
|------|------|
| `CLAUDE.md` | 프로젝트 공통 협업 설정 |
| `CODEX.md` | Codex 작업 가이드 (이 파일) |
| `PROGRESS.md` | 통합 작업 로그 |
| `logs/CLAUDE_LOG.md` | Claude 상세 로그 |
| `logs/CODEX_LOG.md` | Codex 상세 로그 |
| `ARCHITECTURE.md` | 구조/설계 문서 |
| `DESIGN_GUIDE.md` | UI/디자인 원칙 |
| `TODO_EDITOR_MENU.md` | **에디터 메뉴 재구성 분업 TODO** (현재 진행 중) |

---

## 현재 진행 중인 작업: 에디터 메뉴 재구성

**`TODO_EDITOR_MENU.md` 파일을 반드시 먼저 읽으세요.**

IA 기준으로 에디터 메뉴 전체를 재구성하는 작업입니다.
Claude가 1~3단계를 완료하면 Codex가 4~6단계를 이어서 작업합니다.
