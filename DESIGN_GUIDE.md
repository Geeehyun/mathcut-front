# MathCut 디자인 가이드

이 문서는 MathCut의 디자인 시스템을 정의합니다.
UI 작업 시 이 가이드를 참고하여 일관된 디자인을 유지해주세요.

---

## 디자인 컨셉

**모던 미니멀 + 컬러풀 에듀**

- 깔끔하고 심플한 UI (Figma/Notion 스타일)
- 교육용 서비스답게 친근하고 밝은 컬러 포인트
- 그림자와 둥근 모서리로 부드러운 느낌

---

## 컬러 팔레트

### Primary (주요 액션)
```css
/* 그라데이션 - 메인 CTA 버튼 */
from-blue-500 to-indigo-600      /* #3B82F6 → #4F46E5 */
hover: from-blue-600 to-indigo-700

/* 단색 */
blue-500: #3B82F6               /* 기본 */
blue-600: #2563EB               /* 호버 */
blue-50: #EFF6FF                /* 배경 */
```

### Secondary (보조)
```css
/* AI/특수 기능 버튼 */
from-purple-500 to-pink-500      /* #8B5CF6 → #EC4899 */

/* 가이드 도구 */
orange-500: #FF9800
orange-50: #FFF7ED
```

### Neutral (중립)
```css
gray-50: #F9FAFB                /* 페이지 배경 */
gray-100: #F3F4F6               /* 카드 내부 배경 */
gray-200: #E5E7EB               /* 테두리 */
gray-400: #9CA3AF               /* 비활성 텍스트 */
gray-500: #6B7280               /* 보조 텍스트 */
gray-700: #374151               /* 본문 텍스트 */
gray-800: #1F2937               /* 제목 */
gray-900: #111827               /* 강조 텍스트 */

white: #FFFFFF                  /* 카드, 헤더 배경 */
```

### Semantic (의미)
```css
/* 성공 */
emerald-400 ~ cyan-500          /* 유저 아바타 그라데이션 */

/* 위험/삭제 */
red-500: #EF4444
red-50: #FEF2F2
red-600: #DC2626                /* 호버 */

/* 알림 뱃지 */
red-500 (작은 점)
```

### 도형 스타일 컬러
```css
/* 기본 스타일 */
fill: rgba(33, 150, 243, 0.1)
stroke: #2196F3
point: #2196F3

/* 파스텔 스타일 */
fill: rgba(255, 182, 193, 0.3)
stroke: #FFB6C1
point: #FFB6C1

/* 흑백 스타일 */
fill: rgba(200, 200, 200, 0.2)
stroke: #333333
point: #333333
```

---

## 타이포그래피

### 폰트 패밀리
```css
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
```

### 크기 & 용도
| 용도 | 클래스 | 예시 |
|------|--------|------|
| 페이지 제목 | `text-2xl font-bold` | MathCut |
| 섹션 제목 | `text-xs font-semibold uppercase tracking-wider text-gray-400` | 도형, 스타일 |
| 본문 | `text-sm text-gray-700` | 일반 텍스트 |
| 보조 텍스트 | `text-sm text-gray-500` | 안내 문구 |
| 라벨 | `text-xs font-medium` | 버튼 내부 |
| 캡션 | `text-xs text-gray-400` | 힌트, 버전 |

---

## 간격 (Spacing)

### 페이지 레이아웃
```css
padding: p-6 (24px)             /* 메인 콘텐츠 영역 */
gap: gap-4 (16px)               /* 섹션 간 간격 */
```

### 카드/패널 내부
```css
padding: p-4 (16px)             /* 카드 내부 */
margin-bottom: mb-3 (12px)      /* 제목과 내용 사이 */
gap: gap-2 (8px)                /* 버튼/아이템 간격 */
```

### 사이드바
```css
width: w-64 (256px)
padding: p-4 (16px)
```

---

## 컴포넌트 스타일

### 버튼

#### Primary (주요 액션)
```html
<button class="flex items-center gap-2 px-4 py-2
  bg-gradient-to-r from-blue-500 to-indigo-600
  hover:from-blue-600 hover:to-indigo-700
  text-white rounded-lg font-medium text-sm
  transition shadow-lg shadow-blue-500/25">
```

#### Secondary (보조)
```html
<button class="flex items-center gap-2 px-4 py-2
  bg-white hover:bg-gray-50
  border border-gray-200
  rounded-xl text-sm font-medium text-gray-700
  transition shadow-sm">
```

#### Danger (위험)
```html
<button class="flex items-center gap-2 px-4 py-2
  bg-red-50 hover:bg-red-100
  text-red-600 rounded-xl font-medium text-sm
  transition">
```

#### Tool Button (도구 선택)
```html
<!-- 비활성 -->
<button class="flex flex-col items-center gap-1.5 p-3
  rounded-xl border-2 border-gray-200
  hover:border-gray-300 hover:bg-gray-50
  text-gray-600 transition-all duration-200">

<!-- 활성 -->
<button class="flex flex-col items-center gap-1.5 p-3
  rounded-xl border-2 border-blue-500
  bg-blue-50 text-blue-700
  shadow-lg shadow-blue-500/20
  transition-all duration-200">
```

### 카드
```html
<div class="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
```

### 입력 필드 (미래용)
```html
<input class="w-full px-4 py-2.5
  border border-gray-200 rounded-xl
  focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
  outline-none transition" />
```

### 드롭다운 메뉴
```html
<div class="absolute right-0 mt-2 w-48
  bg-white rounded-xl shadow-xl
  border border-gray-100 py-2 z-50">
```

---

## 레이아웃 구조

### 전체 레이아웃
```
┌─────────────────────────────────────────┐
│                 Header (h-16)            │
├──────────┬──────────────────────────────┤
│          │                              │
│ Sidebar  │        Main Content          │
│ (w-64)   │         (flex-1)             │
│          │                              │
├──────────┴──────────────────────────────┤
│                 Footer (h-12)            │
└─────────────────────────────────────────┘
```

### 에디터 뷰 구조
```
┌─────────────────────────────────────────┐
│  [도구 표시]  안내문구      [내보내기] [AI]│  상단 툴바
├────────────────────────────┬────────────┤
│                            │ 측정 정보   │
│         캔버스 영역         │            │
│    (bg-white rounded-2xl)  │ 레이어     │
│                            │  (w-72)    │
└────────────────────────────┴────────────┘
```

---

## 아이콘

### 사용 방식
- Heroicons (outline 스타일) 사용
- SVG 인라인으로 삽입
- 크기: `w-4 h-4` (16px) 또는 `w-5 h-5` (20px)

### 도형 아이콘 (텍스트)
```
□ - 사각형
△ - 삼각형
○ - 원
⟡ - 자유선/다각형
↔ - 길이
∠ - 각도
A - 텍스트
```

---

## 애니메이션 & 트랜지션

### 기본 트랜지션
```css
transition                      /* 기본 150ms */
transition-all duration-200     /* 200ms, 모든 속성 */
```

### 호버 효과
- 버튼: 배경색 변경 + 약간의 그림자
- 카드: `hover:bg-gray-50`
- 링크: `hover:text-gray-700`

---

## 반응형 (추후 적용)

### Breakpoints
```css
sm: 640px   /* 모바일 가로 */
md: 768px   /* 태블릿 */
lg: 1024px  /* 데스크톱 */
xl: 1280px  /* 대형 화면 */
```

### 사이드바
- `md` 이상: 항상 표시
- `md` 미만: 햄버거 메뉴로 토글 (미구현)

---

## Do & Don't

### Do ✅
- 둥근 모서리 사용 (`rounded-lg`, `rounded-xl`, `rounded-2xl`)
- 부드러운 그림자 (`shadow-sm`, `shadow-lg`)
- 충분한 여백 (`p-4`, `gap-4`)
- 그라데이션으로 포인트 주기
- 호버 상태 명확히 표시

### Don't ❌
- 날카로운 모서리 (rounded 없이)
- 과도한 그림자
- 너무 빽빽한 레이아웃
- 원색 그대로 사용 (채도 낮추기)
- 일관성 없는 간격
