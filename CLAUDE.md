# MathCut 프로젝트 - AI 어시스턴트 공유 설정

이 파일은 Claude와 Codex가 공유하는 프로젝트 설정입니다.
**새 세션 시작 시 반드시 이 파일과 PROGRESS.md를 먼저 읽어주세요.**

---

## 프로젝트 개요

**MathCut (매쓰컷)**: 수학 교재 문제 이미지 생성 서비스

### 핵심 기능
1. 모눈종이에서 직접 도형 그리기
2. 손으로 그린 그림 + 프롬프트로 AI 이미지 생성 (모눈종이에 그려지고 수정 가능)

---

## 기술 스택

### 프론트엔드 (mathcut-front)
- **Vue 3** + TypeScript
- **Vite**: 빌드 도구
- **Konva.js** (vue-konva): 캔버스/도형 편집
- **Pinia**: 상태 관리
- **Tailwind CSS**: 스타일링

### 백엔드 (mathcut-api) - **연동 시작**
- Kotlin + Spring Boot
- 위치: `D:\vision\mathcut-api`
- API 명세: `D:\vision\mathcut-api\API-SPEC.md`
- Base URL: `http://localhost:8080`
- 실행: `OPENAI_API_KEY=sk-... ./gradlew bootRun`

---

## 역할 분담

| AI | 담당 업무 |
|----|----------|
| **Claude** | 주요 기능 구현, 아키텍처 설계 |
| **Codex** | 버그 수정, 문서 작업, 리팩토링 |

---

## 작업 규칙

### 한국어 사용
- 모든 응답, 주석, 커밋 메시지는 한국어로 작성
- 기술 용어만 영어 사용 가능

### CSS 관리
- 인라인 스타일 지양
- 각 컴포넌트/뷰에 맞는 CSS 파일 또는 Tailwind 클래스 사용

### 작업 진행
1. 로직 수정/추가 시 먼저 개요를 보여주고 사용자 확인 후 진행
2. 작업 중 이슈 발생 시 즉시 사용자에게 고지
3. **작업 완료 후 반드시 PROGRESS.md 업데이트**

### 로그 운영 방식
1. `PROGRESS.md`는 Claude/Codex 공용 진행 요약 문서로 사용
2. 상세 작업 기록은 역할별 로그에 작성
3. `logs/CLAUDE_LOG.md`: Claude 상세 로그
4. `logs/CODEX_LOG.md`: Codex 상세 로그
5. 작업 완료 시 상세 로그 기록 후 `PROGRESS.md`에 최종 요약 반영

> ⚠️ **Claude 전용 체크리스트 — 매 작업 완료 시 필수**
> 1. `logs/CLAUDE_LOG.md` 에 변경 파일 + 설계 결정 기록
> 2. `PROGRESS.md` 작업 로그 섹션에 한 줄 요약 추가
> 3. `npm run build` 통과 확인
> Codex는 잘 지키는데 Claude가 자주 빠뜨림 — 절대 잊지 말 것!

### 배포/인프라
- 직접 수행 불가한 작업은 DEPLOYMENT_TODO.md에 기록

---

## 주요 파일 안내

| 파일 | 설명 |
|------|------|
| `CLAUDE.md` | AI 어시스턴트 공유 설정 (이 파일) |
| `CODEX.md` | Codex 전용 작업 가이드 |
| `PROGRESS.md` | 업무 진행사항 로그 (공용 요약) |
| `logs/CLAUDE_LOG.md` | Claude 상세 작업 로그 |
| `logs/CODEX_LOG.md` | Codex 상세 작업 로그 |
| `ARCHITECTURE.md` | 프로젝트 구조 및 설계 문서 |
| `DESIGN_GUIDE.md` | 디자인 시스템 가이드 (컬러, 타이포, 컴포넌트) |
| `demo/` | 초기 프로토타입 (순수 HTML) |

---

## 디자인 원칙

**UI 작업 시 반드시 `DESIGN_GUIDE.md` 참고!**

- 스타일: 모던 미니멀 + 컬러풀 에듀
- 메인 컬러: blue-500 ~ indigo-600 그라데이션
- 둥근 모서리: rounded-xl, rounded-2xl
- 그림자: shadow-lg shadow-blue-500/25
- Tailwind CSS 클래스 사용

---

## 참고 사항

- 데모 코드 위치: `demo/grid-drawing-demo.html`
- 데모에 구현된 기능: 도형 그리기(사각형/삼각형/원/자유선), 스타일 선택, 가이드 추가, 직각 감지
