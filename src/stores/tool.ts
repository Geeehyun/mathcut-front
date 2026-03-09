import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ModeType, ShapeType, GuideType, StyleType, GridMode, Point } from '@/types'

export const useToolStore = defineStore('tool', () => {
  // 현재 모드 (도형 그리기 / 가이드)
  const mode = ref<ModeType>('select')

  // 도형 타입
  const shapeType = ref<ShapeType>('rectangle')

  // 가이드 타입
  const guideType = ref<GuideType>('length')

  // 스타일
  const style = ref<StyleType>('default')

  // 모눈종이 표시 모드 (grid: 격자선 / dots: 꼭지점만 / none: 백지)
  const gridMode = ref<GridMode>('grid')

  // 정다각형 변 개수
  const polygonSides = ref<number>(5)

  // 가이드 표시 토글
  const showLength = ref<boolean>(true)
  const showAngle = ref<boolean>(true)
  const showPointName = ref<boolean>(true)
  const showHeight = ref<boolean>(true)
  const angleDisplayMode = ref<'right' | 'all'>('all')
  const showGuideUnit = ref<boolean>(true)
  const gridLineColor = ref<string>('#009FE3')
  const gridBackgroundColor = ref<string>('#FFFFFF')

  // 캔버스 배율
  const zoom = ref<number>(100)

  // 그리는 중인 임시 점들
  const tempPoints = ref<Point[]>([])

  // 모드 전환
  function setMode(newMode: ModeType) {
    mode.value = newMode
    tempPoints.value = []
  }

  // 도형 타입 변경
  function setShapeType(type: ShapeType) {
    shapeType.value = type
    tempPoints.value = []
  }

  // 가이드 타입 변경
  function setGuideType(type: GuideType) {
    guideType.value = type
    tempPoints.value = []
  }

  // 스타일 변경
  function setStyle(newStyle: StyleType) {
    style.value = newStyle
  }

  // 모눈종이 표시 모드 변경
  function setGridMode(mode: GridMode) {
    gridMode.value = mode
  }

  // 모눈종이 표시 모드 순환 (grid → dots → none → grid)
  function cycleGridMode() {
    const order: GridMode[] = ['grid', 'dots', 'none']
    const idx = order.indexOf(gridMode.value)
    gridMode.value = order[(idx + 1) % order.length]
  }

  // 정다각형 변 개수 설정
  function setPolygonSides(n: number) {
    polygonSides.value = Math.max(3, Math.min(12, n))
  }

  // 가이드 표시 토글
  function setShowLength(v: boolean) {
    showLength.value = v
  }

  function setShowAngle(v: boolean) {
    showAngle.value = v
  }

  function setShowPointName(v: boolean) {
    showPointName.value = v
  }

  function setShowHeight(v: boolean) {
    showHeight.value = v
  }

  function setAngleDisplayMode(v: 'right' | 'all') {
    angleDisplayMode.value = v
  }

  function setShowGuideUnit(v: boolean) {
    showGuideUnit.value = v
  }

  function setGridLineColor(v: string) {
    gridLineColor.value = v
  }

  function setGridBackgroundColor(v: string) {
    gridBackgroundColor.value = v
  }

  // 배율 설정
  function setZoom(v: number) {
    zoom.value = Math.max(50, Math.min(200, v))
  }

  function zoomIn() {
    setZoom(zoom.value + 10)
  }

  function zoomOut() {
    setZoom(zoom.value - 10)
  }

  // 임시 점 추가
  function addTempPoint(point: Point) {
    tempPoints.value.push(point)
  }

  // 임시 점 초기화
  function clearTempPoints() {
    tempPoints.value = []
  }

  // 마지막 임시 점 제거
  function removeLastTempPoint() {
    tempPoints.value.pop()
  }

  return {
    mode,
    shapeType,
    guideType,
    style,
    gridMode,
    polygonSides,
    showLength,
    showAngle,
    showPointName,
    showHeight,
    angleDisplayMode,
    showGuideUnit,
    gridLineColor,
    gridBackgroundColor,
    zoom,
    tempPoints,
    setMode,
    setShapeType,
    setGuideType,
    setStyle,
    setGridMode,
    cycleGridMode,
    setPolygonSides,
    setShowLength,
    setShowAngle,
    setShowPointName,
    setShowHeight,
    setAngleDisplayMode,
    setShowGuideUnit,
    setGridLineColor,
    setGridBackgroundColor,
    setZoom,
    zoomIn,
    zoomOut,
    addTempPoint,
    clearTempPoints,
    removeLastTempPoint
  }
})
