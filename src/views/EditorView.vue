<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useToolStore } from '@/stores/tool'
import { useCanvasStore } from '@/stores/canvas'
import GridCanvas from '@/components/canvas/GridCanvas.vue'
import InfoPanel from '@/components/InfoPanel.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import type { ShapeType, GuideType, Shape, Guide } from '@/types'
import { GRID_CONFIG } from '@/types'
import { findRightAngles } from '@/utils/geometry'

const toolStore = useToolStore()
const canvasStore = useCanvasStore()
const gridCanvasRef = ref<any>(null)

// 留덉슦??醫뚰몴 (寃⑹옄 ?⑥쐞)
const mousePos = ref<{ x: number, y: number } | null>(null)

// 컷 관리
type CutSnapshot = { shapes: Shape[], guides: Guide[] }
const cuts = ref<CutSnapshot[]>([{ shapes: [], guides: [] }])
const currentCutIndex = ref(0)

const exportFormat = ref<'png' | 'pdf'>('png')
const exportDpi = ref<72 | 150 | 300>(300)
const exportWidth = ref(GRID_CONFIG.size * GRID_CONFIG.width)
const exportHeight = ref(GRID_CONFIG.size * GRID_CONFIG.height)
const contextmenuState = ref<{
  visible: boolean
  x: number
  y: number
  target:
    | { kind: 'shape', shapeId: string }
    | { kind: 'guide', guideId: string }
    | { kind: 'shape-guide-item', shapeId: string, guideKey: 'length' | 'angle' | 'pointName' | 'height', itemIndex: number }
    | null
}>({
  visible: false,
  x: 0,
  y: 0,
  target: null
})

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function syncCurrentCut() {
  cuts.value[currentCutIndex.value] = cloneSnapshot(canvasStore.getSnapshot())
}

function addCut() {
  syncCurrentCut()
  cuts.value.push({ shapes: [], guides: [] })
  currentCutIndex.value = cuts.value.length - 1
  canvasStore.loadSnapshot({ shapes: [], guides: [] })
}

function duplicateCut() {
  syncCurrentCut()
  cuts.value.push(cloneSnapshot(cuts.value[currentCutIndex.value]))
  currentCutIndex.value = cuts.value.length - 1
  canvasStore.loadSnapshot(cloneSnapshot(cuts.value[currentCutIndex.value]))
}

function deleteCut() {
  if (cuts.value.length <= 1) {
    cuts.value[0] = { shapes: [], guides: [] }
    canvasStore.loadSnapshot({ shapes: [], guides: [] })
    return
  }
  cuts.value.splice(currentCutIndex.value, 1)
  currentCutIndex.value = Math.max(0, currentCutIndex.value - 1)
  canvasStore.loadSnapshot(cloneSnapshot(cuts.value[currentCutIndex.value]))
}

function handleExport() {
  gridCanvasRef.value?.exportImage(exportFormat.value, exportWidth.value, exportHeight.value, exportDpi.value)
}

function handleCanvasContextMenu(payload: {
  x: number
  y: number
  target:
    | { kind: 'shape', shapeId: string }
    | { kind: 'guide', guideId: string }
    | { kind: 'shape-guide-item', shapeId: string, guideKey: 'length' | 'angle' | 'pointName' | 'height', itemIndex: number }
    | null
}) {
  contextmenuState.value = {
    visible: true,
    x: payload.x,
    y: payload.y,
    target: payload.target
  }
}

function closeContextMenu() {
  contextmenuState.value.visible = false
}

// 도형 타입별 안내 문구
const shapeInstructions: Partial<Record<ShapeType, string>> = {
  rectangle: '두 개의 점을 대각선으로 클릭하세요',
  triangle: '세 개의 점을 클릭하세요',
  polygon: '점을 클릭하고, 첫 점을 다시 클릭하면 완성됩니다',
  circle: '중심점과 경계점을 클릭하세요',
  point: '위치를 클릭하세요',
  'point-on-object': '도형/선 위의 위치를 클릭하세요',
  segment: '두 점을 클릭하세요',
  ray: '시작점과 방향점을 클릭하세요',
  line: '두 점을 클릭하세요',
  'angle-line': '두 선분의 끝점을 클릭하세요',
  'triangle-equilateral': '밑변의 두 점을 클릭하세요',
  'triangle-right': '밑변의 두 점을 찍고 세 번째 점으로 높이를 정하세요 (직각 보정)',
  'triangle-isosceles': '밑변의 두 점을 찍고 세 번째 점으로 높이를 정하세요 (같은 변 길이 자동 고정)',
  'triangle-free': '세 개의 점을 클릭하세요',
  'rect-square': '한 변의 두 점을 클릭하세요',
  'rect-rectangle': '대각선의 두 점을 클릭하세요',
  'rect-trapezoid': '밑변의 두 점을 찍고 세 번째 점으로 윗변을 정하세요',
  'rect-rhombus': '네 점을 클릭하세요',
  'rect-parallelogram': '세 점을 클릭하세요',
  'rect-free': '네 개의 점을 클릭하세요',
  'polygon-regular': '중심과 꼭짓점을 클릭하면 정다각형이 생성됩니다',
  'free-shape': '점을 클릭하고, 첫 점을 다시 클릭하면 완성됩니다',
  arrow: '시작점과 끝점을 클릭하세요',
  'arrow-curve': '시작점과 끝점을 클릭하세요',
  counter: '위치를 클릭하세요'
}

// 도형 타입별 이름
const shapeNames: Partial<Record<ShapeType, string>> = {
  rectangle: '직사각형',
  triangle: '삼각형',
  circle: '원',
  polygon: '다각형',
  point: '점',
  segment: '선분',
  ray: '반직선',
  line: '직선',
  'angle-line': '각도',
  'point-on-object': '대상 위의 점',
  'triangle-equilateral': '정삼각형',
  'triangle-right': '직각삼각형',
  'triangle-isosceles': '이등변삼각형',
  'triangle-free': '자유 삼각형',
  'rect-square': '정사각형',
  'rect-rectangle': '직사각형',
  'rect-trapezoid': '사다리꼴',
  'rect-rhombus': '마름모',
  'rect-parallelogram': '평행사변형',
  'rect-free': '자유 사각형',
  'polygon-regular': '정다각형',
  'free-shape': '자유 도형',
  arrow: '화살표(직선)',
  'arrow-curve': '화살표(곡선)',
  counter: '카운터'
}

const shapeIcons: Partial<Record<ShapeType, string>> = {
  rectangle: '▭',
  triangle: '△',
  circle: '◯',
  polygon: '⬟',
  point: '•',
  segment: '／',
  ray: '↗',
  line: '⟷',
  'angle-line': '∠',
  'point-on-object': '•',
  'triangle-equilateral': '△',
  'triangle-right': '◺',
  'triangle-isosceles': '△',
  'triangle-free': '△',
  'rect-square': '□',
  'rect-rectangle': '▭',
  'rect-trapezoid': '⏢',
  'rect-rhombus': '◇',
  'rect-parallelogram': '▱',
  'rect-free': '⬠',
  'polygon-regular': '⬡',
  'free-shape': '✎',
  arrow: '➜',
  'arrow-curve': '⤳',
  counter: '1'
}

const pointLabels = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
function getPointLabel(index: number): string {
  return pointLabels[index] ?? `점${index + 1}`
}

const globalPointLabelMap = computed(() => {
  const map: Record<string, string> = {}
  let globalIndex = 0
  for (const shape of canvasStore.shapes) {
    for (let pointIndex = 0; pointIndex < shape.points.length; pointIndex++) {
      map[`${shape.id}-${pointIndex}`] = getPointLabel(globalIndex)
      globalIndex++
    }
  }
  return map
})

function getShapePointLabel(shape: Shape, pointIndex: number): string {
  const custom = shape.pointLabels?.[pointIndex]
  if (custom) return custom
  return globalPointLabelMap.value[`${shape.id}-${pointIndex}`] ?? getPointLabel(pointIndex)
}

function getShapePointTuple(shape: Shape): string {
  return shape.points.map((_, i) => getShapePointLabel(shape, i)).join(',')
}

function getShapeDisplayName(shape: Shape): string {
  const baseName = shapeNames[shape.type] ?? shape.type
  return `${baseName}(${getShapePointTuple(shape)})`
}

function getLengthLabel(shape: Shape, pointIndex: number): string {
  if (shape.type === 'circle') {
    const measureLabel = shape.circleMeasureMode === 'diameter' ? '지름' : '반지름'
    const center = getShapePointLabel(shape, 0)
    const edge = getShapePointLabel(shape, 1)
    const opposite = getShapePointLabel(shape, 2)
    if (shape.circleMeasureMode === 'diameter') {
      return `${measureLabel}(${center},${edge},${opposite})`
    }
    return `${measureLabel}(${center},${edge})`
  }
  const pointCount = shape.points.length
  const nextIndex = (pointIndex + 1) % pointCount
  return `길이(${getShapePointLabel(shape, pointIndex)},${getShapePointLabel(shape, nextIndex)})`
}

function getAngleLabel(shape: Shape, vertexIndex: number): string {
  const pointCount = shape.points.length
  const prevIndex = (vertexIndex - 1 + pointCount) % pointCount
  const nextIndex = (vertexIndex + 1) % pointCount
  return `각도(${getShapePointLabel(shape, prevIndex)},${getShapePointLabel(shape, vertexIndex)},${getShapePointLabel(shape, nextIndex)})`
}

function isShapeHeightDefaultVisible(shape: Shape): boolean {
  return shape.type === 'triangle'
    || shape.type === 'triangle-free'
    || shape.type === 'triangle-equilateral'
    || shape.type === 'triangle-isosceles'
    || shape.type === 'rect-trapezoid'
    || shape.type === 'rect-rhombus'
    || shape.type === 'rect-parallelogram'
}

function getShapeAngleIndices(shape: Shape): number[] {
  if (shape.type === 'angle-line') {
    return shape.points.length >= 3 ? [1] : []
  }
  const isOpenShape = shape.type === 'segment'
    || shape.type === 'ray'
    || shape.type === 'line'
    || shape.type === 'arrow'
    || shape.type === 'arrow-curve'
  if (shape.type === 'circle' || isOpenShape || shape.points.length < 3) return []
  if (toolStore.angleDisplayMode === 'all') return shape.points.map((_, index) => index)
  return findRightAngles(shape.points)
}

function isShapeGuideItemVisibleInLayer(
  shape: Shape,
  key: 'length' | 'angle' | 'pointName' | 'height',
  index: number
): boolean {
  if (key === 'length') {
    const baseVisible = shape.type === 'circle'
      ? shape.guideVisibility?.radius !== false
      : shape.guideVisibility?.length !== false
    return baseVisible && !shape.guideVisibility?.lengthHiddenIndices?.includes(index)
  }
  if (key === 'angle') {
    return (shape.guideVisibility?.angle !== false) && !shape.guideVisibility?.angleHiddenIndices?.includes(index)
  }
  if (key === 'height') {
    const baseVisible = typeof shape.guideVisibility?.height === 'boolean'
      ? shape.guideVisibility.height
      : isShapeHeightDefaultVisible(shape)
    return baseVisible && !shape.guideVisibility?.heightHiddenIndices?.includes(index)
  }
  return (shape.guideVisibility?.pointName !== false) && !shape.guideVisibility?.pointNameHiddenIndices?.includes(index)
}

// 안내 문구
const instruction = computed(() => {
  if (toolStore.mode === 'select') {
    return '도형을 클릭해 선택하거나, Space를 누른 채 드래그하여 화면을 이동합니다.' 
  }

  if (toolStore.mode === 'shape') {
    return shapeInstructions[toolStore.shapeType] ?? '도형 도구를 선택하세요'
  }

  const instructions: Record<GuideType, string> = {
    length: '도형 변을 드래그해 생성하고, 생성된 곡선을 클릭해 방향을 바꿉니다',
    text: '배치할 위치를 클릭하세요',
    angle: '도형의 꼭짓점을 클릭하면 해당 각도가 표시됩니다'
  }
  return instructions[toolStore.guideType]
})

// 현재 선택 도구 이름
const currentTool = computed(() => {
  if (toolStore.mode === 'select') {
    return '선택/이동'
  }

  if (toolStore.mode === 'shape') {
    return shapeNames[toolStore.shapeType] ?? toolStore.shapeType
  }

  const names: Record<GuideType, string> = {
    length: '길이 표시',
    text: '텍스트',
    angle: '각도'
  }
  return names[toolStore.guideType]
})

const currentIcon = computed(() => {
  if (toolStore.mode === 'select') return '↖'
  if (toolStore.mode === 'shape') return shapeIcons[toolStore.shapeType] ?? '•'
  const guideIcons: Record<GuideType, string> = { length: '📏', text: 'T', angle: '∠' }
  return guideIcons[toolStore.guideType]
})

// 격자 모드 라벨
const gridModeLabel = computed(() => {
  if (toolStore.gridMode === 'grid') return '모눈 격자'
  if (toolStore.gridMode === 'dots') return '점판'
  return '백지'
})

// 우측 패널 열림/닫힘
const rightPanelOpen = ref(true)
// 탭 전환
const activeTab = ref<'info' | 'layer'>('info')
const collapsedLayerGroups = ref<Record<string, boolean>>({})
const draggedLayerShapeId = ref<string | null>(null)
const dragOverLayerShapeId = ref<string | null>(null)

const groupedLayers = computed(() => {
  const rootShapes = canvasStore.shapes
    .filter((shape) => !shape.attachedToShapeId)
    .slice()
    .reverse()
  return rootShapes.map((shape) => {
    const isOpenShape = shape.type === 'segment'
      || shape.type === 'ray'
      || shape.type === 'line'
      || shape.type === 'arrow'
      || shape.type === 'arrow-curve'
      || shape.type === 'angle-line'

    const pointNameItems = shape.points.map((_, pIndex) => ({
      id: `auto-point-${shape.id}-${pIndex}`,
      icon: '•',
      label: `점(${getShapePointLabel(shape, pIndex)})`,
      key: 'pointName' as const,
      index: pIndex,
      visible: isShapeGuideItemVisibleInLayer(shape, 'pointName', pIndex)
    }))

    const lengthItems = shape.type === 'circle'
      ? [{
        id: `auto-length-${shape.id}-0`,
        icon: '📏',
        label: getLengthLabel(shape, 0),
        key: 'length' as const,
        index: 0,
        visible: isShapeGuideItemVisibleInLayer(shape, 'length', 0)
      }]
      : ((shape.type === 'segment' || shape.type === 'ray' || shape.type === 'line') ? [{
        id: `auto-length-${shape.id}-0`,
        icon: '📏',
        label: getLengthLabel(shape, 0),
        key: 'length' as const,
        index: 0,
        visible: isShapeGuideItemVisibleInLayer(shape, 'length', 0)
      }] : (!isOpenShape ? shape.points.map((_, pIndex) => ({
        id: `auto-length-${shape.id}-${pIndex}`,
        icon: '📏',
        label: getLengthLabel(shape, pIndex),
        key: 'length' as const,
        index: pIndex,
        visible: isShapeGuideItemVisibleInLayer(shape, 'length', pIndex)
      })) : []))

    const angleItems = getShapeAngleIndices(shape).map((aIndex) => ({
      id: `auto-angle-${shape.id}-${aIndex}`,
      icon: '∠',
      label: getAngleLabel(shape, aIndex),
      key: 'angle' as const,
      index: aIndex,
      visible: isShapeGuideItemVisibleInLayer(shape, 'angle', aIndex)
    }))

    const heightItems = (
      !isOpenShape
      && shape.type !== 'circle'
      && shape.type !== 'triangle-right'
      && shape.type !== 'rectangle'
      && shape.type !== 'rect-rectangle'
      && shape.type !== 'rect-square'
      && shape.points.length >= 3
    )
      ? [{
        id: `auto-height-${shape.id}-0`,
        icon: '↕',
        label: '높이',
        key: 'height' as const,
        index: 0,
        visible: isShapeGuideItemVisibleInLayer(shape, 'height', 0)
      }]
      : []

    const guides = canvasStore.guides
      .filter(g => g.shapeId === shape.id)
      .map((guide, gIndex) => ({
        id: `guide-${guide.id}`,
        icon: guide.type === 'length' ? '📏' : guide.type === 'text' ? 'A' : '∠',
        label: `${guide.type === 'length' ? '길이 가이드' : guide.type === 'text' ? '텍스트 가이드' : '각도 가이드'} ${gIndex + 1}`,
        guideId: guide.id,
        visible: guide.visible !== false
      }))

    const childShapes = canvasStore.shapes
      .filter((child) => child.attachedToShapeId === shape.id)
      .slice()
      .reverse()
      .map((child) => ({
        id: `shape-${child.id}`,
        shapeId: child.id,
        icon: shapeIcons[child.type] ?? '•',
        label: getShapeDisplayName(child),
        visible: child.visible !== false
      }))

    return {
      id: `shape-${shape.id}`,
      shapeId: shape.id,
      icon: shapeIcons[shape.type] ?? '•',
      label: getShapeDisplayName(shape),
      visible: shape.visible !== false,
      autoGuideItems: [...pointNameItems, ...lengthItems, ...angleItems, ...heightItems],
      guides,
      childShapes
    }
  })
})

const unboundGuides = computed(() => {
  return canvasStore.guides
    .filter(g => !g.shapeId)
    .slice()
    .reverse()
    .map((guide, index) => ({
      id: `guide-${guide.id}`,
      icon: guide.type === 'length' ? '📏' : guide.type === 'text' ? 'A' : '∠',
      label: `${guide.type === 'length' ? '길이 가이드' : guide.type === 'text' ? '텍스트 가이드' : '각도 가이드'} ${index + 1}`,
      guideId: guide.id,
      visible: guide.visible !== false
    }))
})

function isLayerCollapsed(groupId: string): boolean {
  return !!collapsedLayerGroups.value[groupId]
}

function toggleLayerCollapsed(groupId: string) {
  collapsedLayerGroups.value[groupId] = !collapsedLayerGroups.value[groupId]
}

function toggleShapeGuideVisibility(shapeId: string, key: 'length' | 'angle' | 'pointName' | 'height', index: number, visible: boolean) {
  const shape = canvasStore.shapes.find((s) => s.id === shapeId)
  if (!shape) return
  if (key === 'height') {
    canvasStore.setShapeGuideVisibility(shapeId, 'height', !visible)
    return
  }
  // 기본 가시성(boolean)이 꺼진 상태에서도 레이어 개별 토글로 바로 표시되도록 동기화
  if (!visible) {
    if (key === 'length') {
      canvasStore.setShapeGuideVisibility(shapeId, shape.type === 'circle' ? 'radius' : 'length', true)
    } else {
      canvasStore.setShapeGuideVisibility(shapeId, key, true)
    }
  }
  canvasStore.setShapeGuideItemVisible(shapeId, key, index, !visible)
}

function toggleGuideVisibility(guideId: string, visible: boolean) {
  canvasStore.setGuideVisible(guideId, !visible)
}

function selectGuideLayer(guideId: string) {
  canvasStore.selectGuide(guideId)
  activeTab.value = 'info'
}

function isShapeLayerSelected(shapeId: string): boolean {
  return canvasStore.selectedShapeId === shapeId
}

function selectShapeLayer(shapeId: string) {
  canvasStore.selectShape(shapeId)
  activeTab.value = 'info'
}

function toggleShapeLayerVisibility(shapeId: string, visible: boolean) {
  canvasStore.setShapeVisible(shapeId, !visible)
}

function getVisibilityIcon(visible: boolean): string {
  return visible ? '👁' : '🙈'
}

function openShapeLayerContextMenu(e: MouseEvent, shapeId: string) {
  e.preventDefault()
  contextmenuState.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    target: { kind: 'shape', shapeId }
  }
}

function openShapeGuideItemContextMenu(
  e: MouseEvent,
  shapeId: string,
  key: 'length' | 'angle' | 'pointName' | 'height',
  index: number
) {
  e.preventDefault()
  contextmenuState.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    target: { kind: 'shape-guide-item', shapeId, guideKey: key, itemIndex: index }
  }
}

function openGuideLayerContextMenu(e: MouseEvent, guideId: string) {
  e.preventDefault()
  contextmenuState.value = {
    visible: true,
    x: e.clientX,
    y: e.clientY,
    target: { kind: 'guide', guideId }
  }
}

function handleLayerDragStart(shapeId: string, e: DragEvent) {
  draggedLayerShapeId.value = shapeId
  dragOverLayerShapeId.value = shapeId
  e.dataTransfer?.setData('text/plain', shapeId)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

function handleLayerDragOver(shapeId: string, e: DragEvent) {
  if (!draggedLayerShapeId.value) return
  e.preventDefault()
  dragOverLayerShapeId.value = shapeId
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function handleLayerDrop(targetShapeId: string, e: DragEvent) {
  e.preventDefault()
  const draggedId = draggedLayerShapeId.value
  draggedLayerShapeId.value = null
  dragOverLayerShapeId.value = null
  if (!draggedId || draggedId === targetShapeId) return

  const fromIndex = canvasStore.shapes.findIndex((shape) => shape.id === draggedId)
  const targetIndex = canvasStore.shapes.findIndex((shape) => shape.id === targetShapeId)
  if (fromIndex === -1 || targetIndex === -1) return

  // Drop target 기준 "앞"으로 삽입
  const toIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex
  canvasStore.moveShapeToIndex(draggedId, toIndex)
}

function handleLayerDragEnd() {
  draggedLayerShapeId.value = null
  dragOverLayerShapeId.value = null
}

function handleLayerTrashDrop(e: DragEvent) {
  e.preventDefault()
  const shapeId = draggedLayerShapeId.value
  draggedLayerShapeId.value = null
  dragOverLayerShapeId.value = null
  if (!shapeId) return
  canvasStore.removeShape(shapeId)
}

function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }

  const key = e.key.toLowerCase()
  const isCtrlOrCmd = e.ctrlKey || e.metaKey

  if (!isCtrlOrCmd && !e.shiftKey && key === 'v') {
    e.preventDefault()
    toolStore.setMode('select')
    closeContextMenu()
    return
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    toolStore.clearTempPoints()
    canvasStore.selectShape(null)
    canvasStore.selectGuide(null)
    closeContextMenu()
    return
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && canvasStore.selectedShapeId) {
    e.preventDefault()
    canvasStore.removeShape(canvasStore.selectedShapeId)
    return
  }

  if (isCtrlOrCmd && !e.shiftKey && key === 'z') {
    e.preventDefault()
    canvasStore.undo()
    return
  }

  if ((isCtrlOrCmd && !e.shiftKey && key === 'y') || (isCtrlOrCmd && e.shiftKey && key === 'z')) {
    e.preventDefault()
    canvasStore.redo()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <!-- EditorView: 而⑦뀒?대꼫 ?꾩껜 梨꾩?, flex 而щ읆 -->
  <div class="absolute inset-0 flex flex-col bg-gray-950">

    <!-- ===== ?곷떒 ?щ＼ 諛?(h-10) ===== -->
    <div class="shrink-0 h-10 bg-gray-900 border-b border-gray-800 flex items-center px-3 gap-3 z-30">

      <!-- 濡쒓퀬 -->
      <div class="flex items-center gap-1.5 mr-2">
        <div class="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
          <span class="text-white text-xs font-bold">M</span>
        </div>
        <span class="text-sm font-semibold text-gray-200">MathCut</span>
      </div>

      <div class="w-px h-5 bg-gray-700"></div>

      <!-- 而?愿由?-->
      <div class="flex items-center gap-1">
        <button
          class="chrome-btn"
          :disabled="currentCutIndex === 0"
          :class="currentCutIndex === 0 ? 'opacity-30 cursor-not-allowed' : ''"
          @click="currentCutIndex > 0 && (syncCurrentCut(), currentCutIndex--, canvasStore.loadSnapshot(cloneSnapshot(cuts[currentCutIndex])))"
          title="이전 컷"
        >◀</button>
        <span class="text-xs text-gray-300 min-w-[3rem] text-center">{{ currentCutIndex + 1 }} / {{ cuts.length }}</span>
        <button
          class="chrome-btn"
          :disabled="currentCutIndex >= cuts.length - 1"
          :class="currentCutIndex >= cuts.length - 1 ? 'opacity-30 cursor-not-allowed' : ''"
          @click="currentCutIndex < cuts.length - 1 && (syncCurrentCut(), currentCutIndex++, canvasStore.loadSnapshot(cloneSnapshot(cuts[currentCutIndex])))"
          title="다음 컷"
        >▶</button>
      </div>

      <div class="flex items-center gap-0.5">
        <button class="chrome-btn px-2 text-xs" @click="addCut" title="컷 추가">+</button>
        <button class="chrome-btn px-2 text-xs" @click="duplicateCut" title="컷 복제">⧉</button>
        <button class="chrome-btn px-2 text-xs hover:text-red-400" @click="deleteCut" title="컷 삭제">✕</button>
      </div>

      <div class="w-px h-5 bg-gray-700"></div>

      <!-- 以?-->
      <div class="flex items-center gap-1">
        <button class="chrome-btn" @click="toolStore.zoomOut" title="축소">-</button>
        <span class="text-xs text-gray-300 min-w-[2.5rem] text-center">{{ toolStore.zoom }}%</span>
        <button class="chrome-btn" @click="toolStore.zoomIn" title="확대">+</button>
      </div>

      <div class="w-px h-5 bg-gray-700"></div>

      <!-- ?대낫?닿린 -->
      <div class="flex items-center gap-1">
        <select
          v-model="exportFormat"
          class="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500"
        >
          <option value="png">PNG</option>
          <option value="pdf">PDF</option>
        </select>
        <select
          v-model.number="exportDpi"
          class="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500"
        >
          <option :value="72">72dpi</option>
          <option :value="150">150dpi</option>
          <option :value="300">300dpi</option>
        </select>
        <button
          class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition font-medium"
          @click="handleExport"
        >내보내기</button>
      </div>

      <!-- ?ㅽ럹?댁꽌 -->
      <div class="flex-1"></div>

      <!-- ?좎? ?꾨컮? -->
      <div class="w-7 h-7 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition">
        <span class="text-white text-xs font-medium">U</span>
      </div>
    </div>

    <!-- ===== 硫붿씤 ?곸뿭 (罹붾쾭??+ ?곗륫 ?⑤꼸) ===== -->
    <div class="flex-1 relative overflow-hidden">

      <!-- 罹붾쾭?? ?덈? ?꾩튂濡??꾩껜 梨꾩? -->
      <div class="absolute inset-0">
        <GridCanvas
          ref="gridCanvasRef"
          :interaction-locked="contextmenuState.visible"
          @mouse-move="mousePos = $event"
          @contextmenu="handleCanvasContextMenu"
        />
      </div>

      <ContextMenu
        v-if="contextmenuState.visible"
        :x="contextmenuState.x"
        :y="contextmenuState.y"
        :target="contextmenuState.target"
        @close="closeContextMenu"
      />

      <!-- ?곗륫 ?⑤꼸 而⑦뀒?대꼫 -->
      <div class="absolute top-0 right-0 bottom-0 z-10 flex items-start justify-end pointer-events-none">

        <!-- ?곗륫 ?⑤꼸 蹂몄껜 -->
        <div
          class="h-full w-64 bg-white/95 backdrop-blur-sm border-l border-gray-200 shadow-2xl
                 flex flex-col overflow-hidden transition-transform duration-200 ease-in-out
                 pointer-events-auto"
          :class="rightPanelOpen ? 'translate-x-0' : 'translate-x-64'"
        >
          <!-- ???ㅻ뜑 -->
          <div class="shrink-0 flex border-b border-gray-200">
            <button
              class="flex-1 py-2.5 text-xs font-semibold transition"
              :class="activeTab === 'info' ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
              @click="activeTab = 'info'"
            >속성</button>
            <button
              class="flex-1 py-2.5 text-xs font-semibold transition"
              :class="activeTab === 'layer' ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
              @click="activeTab = 'layer'"
            >레이어</button>
          </div>

          <!-- ?띿꽦 ??-->
          <div v-if="activeTab === 'info'" class="flex-1 overflow-y-auto p-3">
            <InfoPanel />
          </div>

          <!-- ?덉씠????-->
          <div v-if="activeTab === 'layer'" class="relative flex-1 overflow-y-auto p-3 pb-20">
            <div v-if="groupedLayers.length === 0 && unboundGuides.length === 0" class="text-sm text-gray-400 text-center py-8">
              도형/가이드를 추가하면<br>여기에 표시됩니다
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="group in groupedLayers"
                :key="group.id"
                class="rounded-lg border bg-white"
                :class="[
                  isShapeLayerSelected(group.shapeId) ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200',
                  dragOverLayerShapeId === group.shapeId ? 'ring-2 ring-orange-200 border-orange-300' : ''
                ]"
                draggable="true"
                @dragstart="handleLayerDragStart(group.shapeId, $event)"
                @dragover="handleLayerDragOver(group.shapeId, $event)"
                @drop="handleLayerDrop(group.shapeId, $event)"
                @dragend="handleLayerDragEnd"
                @contextmenu="openShapeLayerContextMenu($event, group.shapeId)"
              >
                <div
                  class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 text-sm text-left cursor-pointer"
                  :class="isLayerCollapsed(group.id) ? 'rounded-lg' : 'rounded-t-lg'"
                  @click="selectShapeLayer(group.shapeId)"
                >
                  <button
                    class="text-xs text-gray-400 w-5 h-5 rounded hover:bg-gray-100"
                    @click.stop="toggleLayerCollapsed(group.id)"
                  >
                    {{ isLayerCollapsed(group.id) ? '▶' : '▼' }}
                  </button>
                  <span class="text-base leading-none">{{ group.icon }}</span>
                  <span class="text-gray-700 truncate font-medium">{{ group.label }}</span>
                  <button class="eye-btn ml-auto" @click.stop="toggleShapeLayerVisibility(group.shapeId, group.visible)" :title="group.visible ? '숨김' : '표시'">
                    {{ getVisibilityIcon(group.visible) }}
                  </button>
                  <span
                    v-if="isLayerCollapsed(group.id) && (group.childShapes.length + group.autoGuideItems.length + group.guides.length > 0)"
                    class="text-[11px] text-gray-400"
                  >
                    {{ group.childShapes.length + group.autoGuideItems.length + group.guides.length }}개
                  </span>
                </div>
                <div
                  v-if="!isLayerCollapsed(group.id) && (group.childShapes.length || group.autoGuideItems.length || group.guides.length)"
                  class="ml-4 pl-2 py-1 border-l-2 border-orange-200 space-y-1"
                >
                  <div
                    v-for="child in group.childShapes"
                    :key="child.id"
                    class="flex items-center gap-2 px-2 py-1 rounded-md text-sm bg-blue-50/60 text-gray-700 cursor-pointer"
                    :class="isShapeLayerSelected(child.shapeId) ? 'ring-1 ring-blue-300' : ''"
                    @click="selectShapeLayer(child.shapeId)"
                    @contextmenu="openShapeLayerContextMenu($event, child.shapeId)"
                  >
                    <span class="text-base leading-none">{{ child.icon }}</span>
                    <span class="truncate flex-1">{{ child.label }}</span>
                    <button class="eye-btn" @click.stop="toggleShapeLayerVisibility(child.shapeId, child.visible)" :title="child.visible ? '숨김' : '표시'">
                      {{ getVisibilityIcon(child.visible) }}
                    </button>
                  </div>
                  <div
                    v-for="item in group.autoGuideItems"
                    :key="item.id"
                    class="flex items-center gap-2 px-2 py-1 rounded-md text-sm bg-gray-50 text-gray-700"
                    @contextmenu="openShapeGuideItemContextMenu($event, group.shapeId, item.key, item.index)"
                  >
                    <span class="text-base leading-none">{{ item.icon }}</span>
                    <span class="truncate flex-1">{{ item.label }}</span>
                    <button class="eye-btn" @click.stop="toggleShapeGuideVisibility(group.shapeId, item.key, item.index, item.visible)">
                      {{ getVisibilityIcon(item.visible) }}
                    </button>
                  </div>
                  <div
                    v-for="guide in group.guides"
                    :key="guide.id"
                    class="flex items-center gap-2 px-2 py-1 rounded-md text-sm bg-orange-50/60 text-gray-700 cursor-pointer hover:bg-orange-100/70"
                    @click="selectGuideLayer(guide.guideId)"
                    @contextmenu="openGuideLayerContextMenu($event, guide.guideId)"
                  >
                    <span class="text-base leading-none">{{ guide.icon }}</span>
                    <span class="truncate flex-1">{{ guide.label }}</span>
                    <button class="eye-btn" @click.stop="toggleGuideVisibility(guide.guideId, guide.visible)">
                      {{ getVisibilityIcon(guide.visible) }}
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="unboundGuides.length" class="rounded-lg border border-gray-200 bg-white p-2 space-y-1">
                <p class="text-[11px] text-gray-400 px-1">독립 가이드</p>
                <div
                  v-for="guide in unboundGuides"
                  :key="guide.id"
                  class="flex items-center gap-2 px-2 py-1 rounded-md text-sm bg-orange-50/60 text-gray-700 cursor-pointer hover:bg-orange-100/70"
                  @click="selectGuideLayer(guide.guideId)"
                  @contextmenu="openGuideLayerContextMenu($event, guide.guideId)"
                >
                  <span class="text-base leading-none">{{ guide.icon }}</span>
                  <span class="truncate flex-1">{{ guide.label }}</span>
                  <button class="eye-btn" @click.stop="toggleGuideVisibility(guide.guideId, guide.visible)">
                    {{ getVisibilityIcon(guide.visible) }}
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="draggedLayerShapeId"
              class="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-3 z-20"
            >
              <div
                class="pointer-events-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-300 bg-red-50 text-red-600 shadow"
                @dragover.prevent
                @drop="handleLayerTrashDrop($event)"
              >
                <span class="text-lg leading-none">🗑</span>
                <span class="text-xs font-medium">여기에 놓으면 레이어 삭제</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ?곗륫 ?⑤꼸 ?좉? ??-->
        <button
          class="absolute top-16 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-l-lg
                 w-5 py-4 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800
                 transition-all duration-200 pointer-events-auto"
          :style="{ right: rightPanelOpen ? '256px' : '0' }"
          @click="rightPanelOpen = !rightPanelOpen"
          :title="rightPanelOpen ? '패널 닫기' : '패널 열기'"
        >{{ rightPanelOpen ? '▶' : '◀' }}</button>

      </div>
    </div>

    <!-- ===== ?섎떒 ?곹깭 諛?(h-8) ===== -->
    <div class="shrink-0 h-8 bg-gray-900 border-t border-gray-800 flex items-center px-3 gap-3 z-30">

      <!-- ?꾩옱 ?꾧뎄 -->
      <div class="flex items-center gap-1.5">
        <span class="text-sm text-gray-300 leading-none">{{ currentIcon }}</span>
        <span class="text-xs font-medium text-gray-200">{{ currentTool }}</span>
      </div>

      <div class="w-px h-4 bg-gray-700"></div>

      <!-- ?덈궡 臾멸뎄 -->
      <span class="text-xs text-gray-400 flex-1 truncate">{{ instruction }}</span>

      <!-- 寃⑹옄 紐⑤뱶 -->
      <span class="text-xs text-gray-500">{{ gridModeLabel }}</span>

      <!-- 留덉슦??醫뚰몴 -->
      <span v-if="mousePos" class="text-xs text-gray-500 min-w-[5rem] text-right font-mono">
        x:{{ mousePos.x }} y:{{ mousePos.y }}
      </span>

    </div>

  </div>
</template>

<style scoped>
.chrome-btn {
  @apply w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded transition text-sm;
}
.eye-btn {
  @apply text-xs px-1.5 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-100 transition;
}
</style>
