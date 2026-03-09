export interface Point {
  x: number
  y: number
  gridX: number
  gridY: number
}

export type ShapeType =
  | 'rectangle' | 'triangle' | 'circle' | 'polygon'
  | 'point'
  | 'point-on-object'
  | 'segment'
  | 'ray'
  | 'line'
  | 'angle-line'
  | 'triangle-equilateral'
  | 'triangle-right'
  | 'triangle-isosceles'
  | 'triangle-free'
  | 'rect-square'
  | 'rect-rectangle'
  | 'rect-trapezoid'
  | 'rect-rhombus'
  | 'rect-parallelogram'
  | 'rect-free'
  | 'polygon-regular'
  | 'free-shape'
  | 'arrow'
  | 'arrow-curve'
  | 'counter'

export type StyleType = 'default' | 'pastel' | 'blackwhite'
export type GuideType = 'length' | 'text' | 'angle'

export interface ShapeColor {
  stroke: string
  fill: string
  point?: string
}

export interface ShapeGuideVisibility {
  length?: boolean
  radius?: boolean
  angle?: boolean
  pointName?: boolean
  point?: boolean
  height?: boolean
  lengthHiddenIndices?: number[]
  angleHiddenIndices?: number[]
  pointNameHiddenIndices?: number[]
  heightHiddenIndices?: number[]
}

export interface ShapeGuideItemStyle {
  color?: string
  textColor?: string
  lineColor?: string
  curveSide?: 1 | -1
  heightLineColor?: string
  heightLineWidth?: number
  measureLineColor?: string
  measureLineWidth?: number
  textMode?: 'normal' | 'blank'
  blankWidthMm?: number
  blankSizeMm?: number
  fontSize?: number
  lineWidth?: number
  offsetX?: number
  offsetY?: number
}

export interface ShapeGuideStyleMap {
  length?: Record<number, ShapeGuideItemStyle>
  angle?: Record<number, ShapeGuideItemStyle>
  pointName?: Record<number, ShapeGuideItemStyle>
  height?: Record<number, ShapeGuideItemStyle>
}

export interface Shape {
  id: string
  type: ShapeType
  points: Point[]
  circleMeasureMode?: 'radius' | 'diameter'
  pointLabels?: string[]
  pointLabelLatex?: boolean[]
  style: StyleType
  color?: ShapeColor
  strokeWidthPt?: number
  heightBaseEdgeIndex?: number
  attachedToShapeId?: string
  guideVisibility?: ShapeGuideVisibility
  guideStyleMap?: ShapeGuideStyleMap
}

export interface Guide {
  id: string
  type: GuideType
  points: Point[]
  text?: string
  shapeId?: string
  visible?: boolean
  useLatex?: boolean
  color?: string
  fontSize?: number
  lineWidth?: number
}

export type ModeType = 'shape' | 'guide' | 'select'
export type GridMode = 'grid' | 'dots' | 'none'

export const STYLE_COLORS = {
  default: {
    fill: '#CFEAF7',
    stroke: '#231815',
    point: '#231815',
    label: '#666',
    rightAngle: '#f44336'
  },
  pastel: {
    fill: 'rgba(255, 182, 193, 0.3)',
    stroke: '#FFB6C1',
    point: '#FFB6C1',
    label: '#FF69B4',
    rightAngle: '#FF69B4'
  },
  blackwhite: {
    fill: 'rgba(200, 200, 200, 0.2)',
    stroke: '#333',
    point: '#333',
    label: '#000',
    rightAngle: '#000'
  }
} as const

export const GRID_CONFIG = {
  size: 20,
  width: 64,
  height: 36,
  majorInterval: 5
} as const
