# MathCut 아키텍처 문서

## 프로젝트 구조 (목표)

```
mathcut-front/
├── CLAUDE.md                 # AI 어시스턴트 공유 설정
├── PROGRESS.md               # 업무 진행사항
├── ARCHITECTURE.md           # 이 문서
├── demo/                     # 초기 프로토타입
│   └── grid-drawing-demo.html
├── src/
│   ├── main.ts               # 앱 진입점
│   ├── App.vue               # 루트 컴포넌트
│   ├── views/
│   │   └── EditorView.vue    # 메인 에디터 페이지
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── GridCanvas.vue      # 모눈종이 캔버스
│   │   │   ├── ShapeLayer.vue      # 도형 레이어
│   │   │   └── GuideLayer.vue      # 가이드 레이어
│   │   ├── toolbar/
│   │   │   ├── MainToolbar.vue     # 메인 툴바
│   │   │   ├── ShapeTools.vue      # 도형 도구
│   │   │   ├── StyleSelector.vue   # 스타일 선택
│   │   │   └── GuideTools.vue      # 가이드 도구
│   │   └── common/
│   │       └── ...
│   ├── stores/
│   │   ├── canvas.ts         # 캔버스 상태 (도형, 가이드 등)
│   │   └── tool.ts           # 현재 선택된 도구/모드
│   ├── composables/
│   │   ├── useShape.ts       # 도형 관련 로직
│   │   ├── useGuide.ts       # 가이드 관련 로직
│   │   └── useGrid.ts        # 격자 스냅 로직
│   ├── types/
│   │   └── index.ts          # TypeScript 타입 정의
│   ├── utils/
│   │   ├── geometry.ts       # 거리, 각도 계산 등
│   │   └── export.ts         # 이미지 내보내기
│   └── styles/
│       └── main.css          # Tailwind 진입점
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 핵심 컴포넌트 설계

### GridCanvas.vue
모눈종이 배경을 그리는 캔버스 컴포넌트

- Konva Stage + Layer 구조
- 격자선 렌더링 (20px 간격, 5칸마다 굵은 선)
- 클릭 시 가장 가까운 격자점으로 스냅

### ShapeLayer.vue
도형을 관리하는 레이어

- 도형 타입: rectangle, triangle, circle, polygon (자유선)
- 각 도형은 Konva Shape으로 렌더링
- 선택/드래그/수정 가능

### 상태 관리 (Pinia)

```typescript
// stores/canvas.ts
interface CanvasState {
  shapes: Shape[]           // 그려진 도형들
  guides: Guide[]           // 가이드들
  selectedShapeId: string | null
}

// stores/tool.ts
interface ToolState {
  mode: 'shape' | 'guide'
  shapeType: 'rectangle' | 'triangle' | 'circle' | 'line'
  guideType: 'length' | 'text' | 'angle'
  style: 'default' | 'pastel' | 'blackwhite'
  tempPoints: Point[]       // 그리는 중인 점들
}
```

---

## 타입 정의

```typescript
// types/index.ts

interface Point {
  x: number
  y: number
  gridX: number  // 격자 좌표
  gridY: number
}

interface Shape {
  id: string
  type: 'rectangle' | 'triangle' | 'circle' | 'polygon'
  points: Point[]
  style: 'default' | 'pastel' | 'blackwhite'
}

interface Guide {
  id: string
  type: 'length' | 'text' | 'angle'
  points: Point[]
  text?: string
}
```

---

## 데모 코드에서 이관할 기능

| 데모 기능 | Vue 컴포넌트 | 우선순위 |
|----------|-------------|---------|
| 격자 그리기 | GridCanvas | 높음 |
| 도형 그리기 (4종) | ShapeLayer | 높음 |
| 임시 도형 표시 | ShapeLayer | 높음 |
| 스타일 선택 | StyleSelector | 중간 |
| 가이드 추가 | GuideLayer, GuideTools | 중간 |
| 직각 감지 & 표시 | useShape | 중간 |
| 삼각형 종류 판별 | useShape | 낮음 |
| 측정 정보 패널 | InfoPanel | 낮음 |
| 실행취소 | stores/canvas | 높음 |

---

## 유틸리티 함수 (geometry.ts)

데모에서 가져올 함수들:
- `calculateDistance(p1, p2)`: 두 점 사이 거리 (격자 단위)
- `findRightAngles(points)`: 직각 꼭지점 찾기
- `getTriangleType(points)`: 삼각형 종류 판별
- `snapToGrid(x, y, gridSize)`: 격자점 스냅
