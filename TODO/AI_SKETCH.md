# AI 스케치 변환 기능 구현

> **설계담당**: Claude
> **구현담당**: Codex
> **상태**: MVP 프론트 직접 호출 구현 완료

## 현재 결정

현재 단계는 프론트엔드 MVP이므로, 백엔드 프록시 없이 `VITE_OPENAI_API_KEY`를 브라우저에서 직접 사용하는 방식으로 먼저 구현했다.

- 현재 구현: 프론트 직접 호출
- 추후 전환: 백엔드 AI endpoint 프록시
- 유지한 보완점: 응답 normalize, batch import, undo 1회 반영

이 문서의 "백엔드 프록시 권장" 내용은 배포 단계 전환 기준으로 유지한다.

## Codex 검토 요약

이 문서는 방향은 맞지만, 현재 상태로 바로 구현에 들어가면 아래 4가지 문제가 크다.

1. `VITE_OPENAI_API_KEY`를 프론트에서 직접 쓰는 구조는 배포 불가다.
2. OpenAI 호출 방식이 구식이다. `chat/completions + json_object`보다 `Responses API + Structured Outputs`가 더 적합하다.
3. AI 응답을 그대로 `addShape()`/`addGuide()`로 넣으면 검증 누락과 undo 히스토리 오염이 생긴다.
4. 현재 `canvasStore.addShape()` / `addGuide()`는 호출마다 history를 쌓으므로 AI 결과 N개 반영 시 undo가 지나치게 잘게 쪼개진다.

따라서 이 기능은 아래 기준으로 보완한 뒤 진행하는 것이 맞다.

- 프론트는 OpenAI를 직접 호출하지 않고, 백엔드 AI endpoint만 호출
- AI 응답은 JSON Schema 수준으로 강하게 제한하고, 프론트에서 한 번 더 validate
- 좌표/타입/배열 길이는 모두 clamp 및 normalize
- 캔버스 반영은 개별 추가가 아니라 1회 batch import

---

## Context

현재 MathCut은 사용자가 직접 도형 도구를 선택해 캔버스에 그리는 방식만 지원한다.
새 기능은 사용자가 손으로 대략적인 수학 도형을 그리거나 사진을 업로드하면,
GPT-4o Vision이 이를 인식해 MathCut 도형 데이터(Shape[])로 자동 변환해 캔버스에 추가하는 것이다.
이를 통해 "러프 스케치 → AI 정제 → 편집" 워크플로가 가능해진다.

---

## 아키텍처 개요

```
[크롬 바 "AI 스케치" 버튼]
        ↓
[AISketchModal.vue]
  ├─ 탭1: 직접 그리기 (HTML5 Canvas 프리핸드)
  └─ 탭2: 이미지 업로드 (파일 input / 드래그앤드롭)
        ↓ "AI로 변환" 클릭
[useAISketch.ts]
  ├─ canvas.toDataURL() 또는 업로드 이미지 data URL 확보
  ├─ fetch → 백엔드 AI endpoint (`POST /api/ai/sketch` 또는 별도 서버 URL)
  ├─ 응답 파싱 + schema validate
  └─ normalize → { shapes: Shape[], guides: Guide[], meta }
        ↓
[canvasStore.importAISketchResult(...)]
        ↓
[GridCanvas.vue에 도형/가이드 즉시 반영]
```

### 권장 호출 구조

- 프론트: `VITE_AI_SKETCH_API_URL`로 내부/백엔드 endpoint 호출
- 백엔드: OpenAI `Responses API` 호출
- 모델: `gpt-4o` 또는 비용 우선 시 `gpt-4o-mini`
- 출력 형식: Structured Outputs(JSON Schema)

`VITE_OPENAI_API_KEY`를 브라우저에 넣는 방식은 개발용 임시 테스트 외에는 금지한다.

---

## 생성할 파일

### 1. `src/composables/useAISketch.ts`
AI 분석 로직 전담 composable.

**주요 함수 및 책임:**
```typescript
// 핵심 상태
const isAnalyzing = ref(false)
const error = ref<string | null>(null)

// 메인 함수: base64 이미지 → { shapes: Shape[], guides: Guide[], meta }
async function analyzeImage(imageDataUrl: string): Promise<{ shapes: Shape[], guides: Guide[] }>
  // 1. 백엔드 AI endpoint 호출
  // 2. 응답 파싱 + validateAIResponse()
  // 3. normalizeAIShape() / normalizeAIGuide()
  // 4. convertToCanvasShape() × N, convertToGuide() × N

// Shape 변환 함수
function convertToCanvasShape(aiShape, existingCount: number): Shape
  // gridX/gridY → x/y (× GRID_CONFIG.size = 20)
  // id: generateId() (geometry.ts)
  // color: FILL_PALETTE[existingCount % FILL_PALETTE.length]
  // style: toolStore.style
  // circleMeasureMode: aiShape.circleMeasureMode ?? 'radius'
  // pointLabels: aiShape.pointLabels ?? undefined
  // guideVisibility: aiShape.guideVisibility ?? {}
  // guideStyleMap: buildGuideStyleMap(aiShape) 로 변환

// polygon-regular → polygon 변환
// AI가 polygon-regular를 반환해도 type은 'polygon'으로 저장 (전체 꼭짓점 points 그대로 사용)

// guideStyleMap 빌더
function buildGuideStyleMap(aiShape): ShapeGuideStyleMap
  // lengthItems[i].textMode/textDirection → guideStyleMap.length[i]
  // angleItems[i].textMode/textDirection  → guideStyleMap.angle[i]
  // heightItem.textMode/textDirection     → guideStyleMap.height[0]
  // textDirection → offsetX/offsetY (above:-20Y, below:+20Y, left:-20X, right:+20X)

// Guide 변환 함수
function convertToGuide(aiGuide): Guide
  // type: 'text'
  // points: [{ x: gridX*20, y: gridY*20, gridX, gridY }]
  // text, rotation, useLatex, color: '#231815', fontSize: 11

// 검증/정규화 함수
function validateAIResponse(payload): asserts payload is AISketchResponse
function clampGridPoint(point): { gridX: number, gridY: number }
function normalizeAIShape(aiShape): NormalizedAIShape | null
function normalizeAIGuide(aiGuide): NormalizedAIGuide | null
```

**프론트 → 백엔드 호출:**
```
POST {VITE_AI_SKETCH_API_URL}
Content-Type: application/json
body: {
  imageDataUrl: string,
  source: 'draw' | 'upload'
}
```

**백엔드 → OpenAI 호출 권장:**
```
POST https://api.openai.com/v1/responses
model: gpt-4o
input:
  - role: user
    content:
      - { type: "input_text", text: "...도형 추출 지시..." }
      - { type: "input_image", image_url: imageDataUrl, detail: "high" }
text:
  format:
    type: "json_schema"
    strict: true
```

**AI 프롬프트 (상세):**

GPT-4o가 인식해야 할 시각 요소:
| 시각 요소 | 매핑 |
|---------|------|
| 도형 윤곽선 | `shapes[].type` + `points` |
| 꼭짓점 레이블(ㄱ,A 등) | `shapes[].pointLabels` |
| 꼭짓점 점(•) 마커 | `shapes[].guideVisibility.point` |
| 변 위 숫자 or 빈칸□ | `shapes[].lengthItems[i].textMode` |
| 길이 텍스트 위치(위/아래) | `shapes[].lengthItems[i].textDirection` |
| 꼭짓점 각도 호+숫자 or 직각□ | `shapes[].angleItems[i].textMode` |
| 각도 텍스트 위치 | `shapes[].angleItems[i].textDirection` |
| 수직 높이 보조선 | `shapes[].guideVisibility.height` |
| 높이 텍스트 빈칸 여부 | `shapes[].heightItem.textMode` |
| 높이 텍스트 위치 | `shapes[].heightItem.textDirection` |
| "cm" 단위 | `shapes[].showUnit` |
| 원의 반지름/지름 구분 | `shapes[].circleMeasureMode` |
| 독립 점(•) 마커 | `shapes[]` (type: "point") |
| 직선 (양방향 끝없음) | `shapes[]` (type: "line") |
| 반직선 (한쪽만) | `shapes[]` (type: "ray") |
| 각 표시선 (3점) | `shapes[]` (type: "angle-line") |
| 화살표 직선 | `shapes[]` (type: "arrow") |
| 화살표 곡선 | `shapes[]` (type: "arrow-curve") |
| 자유도형 | `shapes[]` (type: "free-shape") |
| 자유 텍스트 레이블 | `guides[]` (type: "text") |

```
당신은 수학 교재용 도형 인식 AI입니다.
이 이미지에서 수학 도형과 주석을 인식하고 아래 JSON 형식으로만 응답하세요.

그리드: 가로 64칸 × 세로 36칸 (이미지 전체를 이 격자로 간주)

===== 지원 도형 타입 (shapes[].type) =====
삼각형: triangle, triangle-right(직각), triangle-equilateral(정삼각형), triangle-isosceles(이등변)
사각형: rect-square(정사각형), rect-rectangle(직사각형), rect-rhombus(마름모),
        rect-parallelogram(평행사변형), rect-trapezoid(사다리꼴)
기타 도형: circle(원), polygon(다각형), polygon-regular(정다각형), free-shape(자유도형)
선/화살표: segment(선분), line(직선), ray(반직선), angle-line(각 표시선),
           arrow(직선화살표), arrow-curve(곡선화살표)
점: point(독립 점 마커)

===== 응답 JSON 형식 =====
{
  "shapes": [
    {
      "type": "도형타입",
      "points": [{"gridX": 정수, "gridY": 정수}, ...],

      "pointLabels": ["ㄱ", "ㄴ", "ㄷ"],
      // 꼭짓점에 레이블이 보이면 배열. 안 보이면 null.

      "guideVisibility": {
        "pointName": true/false,  // 꼭짓점 레이블 표시 여부
        "point":     true/false,  // 꼭짓점 점(•) 마커 표시 여부
        "length":    true/false,  // 변 길이 표시 여부 (숫자 또는 빈칸)
        "angle":     true/false,  // 각도 표시 여부 (호+숫자, 직각 기호)
        "height":    true/false,  // 높이 보조선 표시 여부
        "radius":    true/false   // circle 전용: 반지름/지름 선 표시 여부
      },

      "circleMeasureMode": "radius" | "diameter" | null,
      // circle이고 guideVisibility.radius=true일 때만 사용.
      // "radius": 반지름 표기, "diameter": 지름 표기. 그 외 null.

      "lengthItems": [
        {
          "textMode": "normal" | "blank",
          // "normal": 숫자 표시, "blank": □ 빈칸 표시
          "textDirection": "above" | "below" | "left" | "right" | "auto"
          // 텍스트가 변의 기본 위치(중점 바깥쪽)에서 명확히 다른 방향에
          // 있으면 해당 방향. 기본 위치면 "auto".
        }
      ],
      // 각 변(edge)별로 하나씩. 변 순서 = points 배열 순서.
      // guideVisibility.length=false면 null.

      "angleItems": [
        {
          "textMode": "normal" | "blank",
          "textDirection": "above" | "below" | "left" | "right" | "auto"
        }
      ],
      // 각 꼭짓점별로 하나씩.
      // guideVisibility.angle=false면 null.

      "heightItem": {
        "textMode": "normal" | "blank",
        "textDirection": "above" | "below" | "left" | "right" | "auto"
      } | null,
      // guideVisibility.height=false면 null.

      "showUnit": true | false
      // 도형 주변에 "cm" 단위 표기가 보이면 true.
    }
  ],

  "guides": [
    {
      "type": "text",
      "text": "텍스트 내용",
      "position": {"gridX": 정수, "gridY": 정수},
      "rotation": 0,
      // 텍스트가 기울어져 있으면 각도(도). 수평이면 0.
      "useLatex": false
      // 수식처럼 보이면 true (예: x², \frac 등)
    }
  ]
  // 도형에 속하지 않는 독립 텍스트 레이블들.
  // 없으면 빈 배열 [].
}

===== 규칙 =====
- gridX: 0~64 정수, gridY: 0~36 정수
- circle: points[0]=중심점, points[1]=원 위의 점(반지름 끝)
- point: points[0]=점 위치 (1개만)
- segment / arrow / arrow-curve: points[0]=시작점, points[1]=끝점
- line: points[0]=직선 위의 한 점, points[1]=방향을 결정하는 두 번째 점 (무한 연장)
- ray: points[0]=시작점(끝점), points[1]=방향점 (한쪽만 연장)
- angle-line: points[0]=한 변 끝, points[1]=꼭짓점, points[2]=다른 변 끝 (3점)
- polygon / free-shape: 꼭짓점 순서대로 3개 이상
- polygon-regular: 꼭짓점 순서대로 N개 + "sides": N 필드 추가
  (정삼각형/정사각형 등 정다각형으로 보일 때 사용. 변환 시 polygon 타입으로 처리)
- 도형/주석 없으면: {"shapes": [], "guides": []}
- 설명 없이 JSON만 출력
```

**응답 → MathCut 데이터 변환 로직 (`convertToCanvasShape` + `convertToGuide`):**
```typescript
// shapes[] → Shape
{
  type, points(gridX/Y × 20),
  circleMeasureMode,
  pointLabels,
  guideVisibility,
  guideStyleMap: {
    length: { [i]: { textMode, offsetX/offsetY(direction→px) } },
    angle:  { [i]: { textMode, offsetX/offsetY } },
    height: { 0:   { textMode, offsetX/offsetY } }
  },
  // showUnit: shapes 중 하나라도 true면 toolStore.setShowGuideUnit(true) — false로 강제 끄지 않음
}

// guides[] → Guide
{
  id: generateId(),
  type: 'text',
  points: [{ x: gridX*20, y: gridY*20, gridX, gridY }],
  text, rotation, useLatex,
  color: '#231815',
  fontSize: 11
}

// textDirection → offsetX/offsetY 변환
"above"  → { offsetX: 0,   offsetY: -20 }
"below"  → { offsetX: 0,   offsetY: +20 }
"left"   → { offsetX: -20, offsetY: 0   }
"right"  → { offsetX: +20, offsetY: 0   }
"auto"   → { offsetX: 0,   offsetY: 0   }
```

---

### 2. `src/components/AISketchModal.vue`
모달 컴포넌트. EditorView와 동일한 `v-if` + `ref(false)` 패턴 사용.

**레이아웃:**
```
┌──────────────────────────────────────────┐
│ ✦ AI 스케치 변환                    [×] │  ← 헤더
├──────────────────────────────────────────┤
│ [직접 그리기] [이미지 업로드]            │  ← 탭
├──────────────────────────────────────────┤
│                                          │
│   <canvas> or <img>                      │  ← 640×360px 작업영역
│   (그리드 점 배경, 16:9 비율 유지)       │
│                                          │
├──────────────────────────────────────────┤
│ [✏연필] [◉지우개] [✕전체삭제]  [AI로 변환하기 →] │  ← 하단 툴바
└──────────────────────────────────────────┘
```

**직접 그리기 탭:**
- `<canvas>` (HTML5, not Konva) 640×360px
- 배경: 격자 점(gridMode=dots 느낌) CSS로 표현
- mousedown/mousemove/mouseup + touch 이벤트
- 연필 모드: 3px 검정 선
- 지우개 모드: 20px white 선
- 획별 undo 스택 (`strokes: ImageData[]`)

**이미지 업로드 탭:**
- 드래그앤드롭 영역 + 클릭 → file input (accept="image/*")
- 업로드된 이미지 미리보기 (object-fit: contain)
- 교체 버튼

**AI 변환 버튼 상태:**
- 기본: `bg-blue-600 text-white` (내보내기 버튼과 동일 스타일)
- 분석 중: 비활성 + 스피너 + "분석 중..."
- 에러: 빨간 에러 메시지 표시
- 빈 입력: 비활성 (`직접 그리기`에서 실제 stroke 없음 / `이미지 업로드`에서 파일 없음)
- Abort 지원: 모달 닫기 시 진행 중 요청 취소

**emit:**
- `@close`: 모달 닫기
- 내부에서 `canvasStore.importAISketchResult()` 호출 후 닫기

---

## 수정할 파일

### 3. `src/views/EditorView.vue`

**크롬 바에 버튼 추가** (내보내기 버튼 왼쪽):
```html
<!-- 내보내기 버튼 앞에 삽입 -->
<button
  class="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded transition font-medium flex items-center gap-1"
  @click="aiSketchModalOpen = true"
>
  ✦ AI 스케치
</button>
```

**상태 추가:**
```typescript
const aiSketchModalOpen = ref(false)
```

**모달 컴포넌트 추가** (내보내기 모달 아래):
```html
<AISketchModal
  v-if="aiSketchModalOpen"
  @close="aiSketchModalOpen = false"
/>
```

**import 추가:**
```typescript
import AISketchModal from '@/components/AISketchModal.vue'
```

### 4. `src/stores/canvas.ts`

AI 결과를 1회 history로 반영하기 위한 batch import action 추가.

```typescript
function importAISketchResult(payload: { shapes: Shape[], guides: Guide[], append?: boolean })
  // 1. saveHistory() 1회만 수행
  // 2. append=false면 기존 요소 clear 후 반영 가능하도록 여지 확보
  // 3. shapes는 withCircleOppositePoint 적용
  // 4. guides/shapes 일괄 반영
```

기존 계획의 `addShape() × N + addGuide() × N` 방식은 undo가 너무 잘게 쪼개지므로 비권장.

### 5. `.env.example`
```
VITE_AI_SKETCH_API_URL=http://localhost:8080/api/ai/sketch
```
(`.env.local`은 사용자가 직접 생성)

백엔드 저장소가 생기면 그쪽 `.env`에 OpenAI 키를 둔다.

---

## 좌표 시스템

| 개념 | 값 |
|------|-----|
| 그리드 셀 크기 | 20px (`GRID_CONFIG.size`) |
| 전체 그리드 | 64칸 × 36칸 = 1280×720px |
| AI 반환 범위 | gridX: 0~64, gridY: 0~36 |
| 픽셀 변환 | `x = gridX × 20`, `y = gridY × 20` |

AI는 그리드 비율을 기준으로 좌표를 추정하므로, 이미지 크기와 무관하게 동일한 좌표 체계로 변환 가능하다.

추가 정규화 규칙:

- `gridX`, `gridY`는 정수로 반올림 후 범위 clamp
- 점 개수가 맞지 않는 도형은 폐기하거나 안전 변환
- `polygon-regular`는 `polygon`으로 강제 변환
- 지원하지 않는 `type`은 폐기
- `lengthItems`, `angleItems`, `pointLabels` 길이는 도형 point 수에 맞춰 자르거나 채움
- `rotation`은 숫자 아니면 `0`
- `text`는 길이 제한 적용

---

## 재사용할 기존 코드

| 기능 | 참조 위치 |
|------|----------|
| `generateId()` | `src/utils/geometry.ts` |
| `FILL_PALETTE`, `STROKE_PALETTE` | `src/constants/colorPalette.ts` |
| `GRID_CONFIG` | `src/types/index.ts` |
| `canvasStore.addShape()` | `src/stores/canvas.ts` |
| `canvasStore.addGuide()` | `src/stores/canvas.ts` |
| `canvasStore.importAISketchResult()` | `src/stores/canvas.ts` (신규 추가) |
| `useToolStore().style` | `src/stores/tool.ts` |
| 모달 패턴 (`v-if` + `ref`) | `src/views/EditorView.vue` (내보내기 모달 참고) |
| 버튼 스타일 (`.chrome-btn`, `bg-blue-600`) | `src/views/EditorView.vue` |

---

## 누락 보완 사항

### 응답 스키마/검증

- 프론트와 백엔드가 공유하는 `AISketchResponse` 타입 또는 schema가 필요하다.
- AI 출력은 "형식상 JSON"만으로는 부족하다. 타입, 필수 필드, 배열 길이, 숫자 범위를 별도 검증해야 한다.

### 실패 처리

- API timeout / 429 / 5xx 메시지 분리
- "인식된 도형 없음"과 "응답 파싱 실패"를 다른 에러로 분리
- 업로드 이미지가 너무 크면 클라이언트에서 리사이즈 후 전송

### 비용/성능

- 기본 모델은 `gpt-4o-mini`로 시작하고 품질이 부족하면 `gpt-4o`로 올리는 것이 현실적이다.
- 직접 그리기 canvas는 전송 전 1280×720 또는 그 이하로 정규화
- 동일 이미지 반복 요청 방지를 위해 최근 요청 해시 캐시를 둘 수 있다.

### UX

- AI 적용 전에 "기존 캔버스에 추가" / "새 컷으로 가져오기" 옵션을 두는 편이 안전하다.
- 적용 후 toast 또는 요약 메시지(`도형 3개, 텍스트 2개 추가`)가 있으면 좋다.
- 인식 결과가 이상할 때 사용자가 바로 undo 한 번으로 되돌릴 수 있어야 한다.

### 보안/운영

- 브라우저에 API Key 노출 금지
- 서버에서 rate limit / request id logging / payload size 제한 필요
- 사진 업로드 기능은 개인정보 포함 가능성이 있으므로 사용자 안내 문구가 필요하다

---

## 검증 방법

1. **환경 변수 설정**: `.env.local`에 `VITE_AI_SKETCH_API_URL` 추가
2. **서버 실행**: `npm run dev` → http://localhost:5174
3. **백엔드 실행**: AI endpoint가 열려 있어야 함
3. **프리핸드 테스트**:
   - 크롬 바 "AI 스케치" 클릭 → 모달 열림 확인
   - 직접 그리기 탭에서 삼각형/사각형 그리기
   - "AI로 변환" 클릭 → 로딩 → 캔버스에 도형 추가 확인
4. **이미지 업로드 테스트**:
   - 이미지 업로드 탭 → 수학 도형 사진 업로드
   - AI 변환 → 도형 인식 확인
5. **에러 케이스**:
   - endpoint 없으면 연결 실패 메시지 표시 확인
   - 429/500 응답 시 에러 메시지 표시 확인
   - 빈 캔버스 전송 시 "인식된 도형 없음" 처리 확인
   - malformed JSON 응답 시 안전 실패 확인
6. **빌드 확인**: `npm run build` 통과

---

## 작업 순서

1. `src/stores/canvas.ts`에 `importAISketchResult()` 추가
2. `useAISketch.ts` 생성 (endpoint 호출 + 검증 + 변환 로직)
3. `AISketchModal.vue` 생성 (프리핸드 캔버스 + 업로드 UI + abort 처리)
4. `EditorView.vue` 수정 (버튼 + 모달 연동)
5. `.env.example` 업데이트 (`VITE_AI_SKETCH_API_URL`)
6. `npm run build` 확인
7. 수동 테스트
8. `PROGRESS.md`, `logs/CODEX_LOG.md` 업데이트

---

## 구현 판단

정리하면, "AI 스케치 자체"는 진행해도 된다. 다만 아래 조건으로 바꿔서 진행해야 한다.

- 그대로 진행 가능: UI 진입점, 모달, 캔버스 스케치, 이미지 업로드, Shape/Guide 변환 방향
- 수정 후 진행 필요: OpenAI 호출 방식, 키 관리, 응답 검증, batch import
- 후순위 가능: 캐시, 새 컷으로 가져오기 옵션, 고급 후처리
