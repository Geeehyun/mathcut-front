<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToolStore } from '@/stores/tool'
import { useCanvasStore } from '@/stores/canvas'
import { useAuthStore } from '@/stores/auth'
import { useCutStore } from '@/composables/useCutStore'
import GridCanvas from '@/components/canvas/GridCanvas.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import InfoPanel from '@/components/InfoPanel.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import AISketchModal from '@/components/AISketchModal.vue'
import type { ShapeType, GuideType, Shape, Guide } from '@/types'
import { GRID_CONFIG } from '@/types'
import { isHeightDefaultVisibleType } from '@/constants/shapeRules'
import { getShapeAutoAngleIndices } from '@/utils/shapeGuideLayout'

const router = useRouter()
const route = useRoute()
const toolStore = useToolStore()
const canvasStore = useCanvasStore()
const auth = useAuthStore()
const cutStore = useCutStore()

// 유저 드롭다운
const userDropdownOpen = ref(false)

function toggleUserDropdown() {
  userDropdownOpen.value = !userDropdownOpen.value
}

function closeUserDropdown() {
  userDropdownOpen.value = false
}

async function handleLogout() {
  closeUserDropdown()
  await auth.logout()
  await router.replace('/login')
}

function goToLibrary() {
  router.push('/library')
}

const currentSavedCutId = ref<number | null>(null)
const currentSavedCutTitle = ref('')
const cutRequestLoading = ref(false)

function getActiveSnapshot() {
  cuts.value[currentCutIndex.value] = cloneSnapshot(canvasStore.getSnapshot())
  return cloneSnapshot(cuts.value[currentCutIndex.value])
}

async function handleSave() {
  if (!auth.isLoggedIn) {
    router.push('/login')
    return
  }

  const baseTitle = currentSavedCutTitle.value || '제목 없음'
  const title = window.prompt('컷 제목을 입력하세요.', baseTitle)?.trim()
  if (!title) return

  try {
    const snapshot = getActiveSnapshot()
    const thumbnail = await gridCanvasRef.value?.createPngDataUrl?.(320, 180, { includeBackground: true })
    if (currentSavedCutId.value === null) {
      const { id } = await cutStore.saveCut(title, snapshot, thumbnail)
      currentSavedCutId.value = id
      currentSavedCutTitle.value = title
      window.alert('저장되었습니다.')
      await router.replace(`/editor/${id}`)
      return
    }

    await cutStore.updateCut(currentSavedCutId.value, title, snapshot, thumbnail)
    currentSavedCutTitle.value = title
    window.alert('저장되었습니다.')
  } catch (e) {
    window.alert(e instanceof Error ? e.message : '저장에 실패했습니다.')
  }
}
const gridCanvasRef = ref<any>(null)

// 마우스 좌표 (격자 단위)
const mousePos = ref<{ x: number, y: number } | null>(null)

// 컷 관리
type CutSnapshot = { shapes: Shape[], guides: Guide[], topLevelOrder: string[] }
const cuts = ref<CutSnapshot[]>([{ shapes: [], guides: [], topLevelOrder: [] }])
const currentCutIndex = ref(0)
const MAX_CANVAS_COUNT = 10

function resetEditorWithSnapshot(snapshot: CutSnapshot | { shapes: Shape[], guides: Guide[], topLevelOrder?: string[] }) {
  const nextSnapshot = cloneSnapshot({
    shapes: snapshot.shapes,
    guides: snapshot.guides,
    topLevelOrder: snapshot.topLevelOrder ?? []
  })
  cuts.value = [nextSnapshot]
  currentCutIndex.value = 0
  canvasStore.loadSnapshot(cloneSnapshot(nextSnapshot))
}

async function loadSavedCut(cutIdParam: unknown) {
  if (!cutIdParam) {
    currentSavedCutId.value = null
    currentSavedCutTitle.value = ''
    resetEditorWithSnapshot({ shapes: [], guides: [], topLevelOrder: [] })
    return
  }

  const cutId = Number(cutIdParam)
  if (!Number.isFinite(cutId) || cutId <= 0) {
    window.alert('잘못된 컷 경로입니다.')
    await router.replace('/editor')
    return
  }

  cutRequestLoading.value = true
  try {
    const cut = await cutStore.fetchCut(cutId)
    currentSavedCutId.value = cut.id
    currentSavedCutTitle.value = cut.title
    resetEditorWithSnapshot(cut.canvasData)
  } catch (e) {
    window.alert(e instanceof Error ? e.message : '컷을 불러오지 못했습니다.')
    await router.replace('/library')
  } finally {
    cutRequestLoading.value = false
  }
}

const EXPORT_MIN_PX = 100
const EXPORT_MAX_PX = 10000
const EXPORT_DEFAULT_WIDTH = GRID_CONFIG.size * GRID_CONFIG.width   // 1280
const EXPORT_DEFAULT_HEIGHT = GRID_CONFIG.size * GRID_CONFIG.height  // 720

const exportFormat = ref<'png' | 'pdf' | 'svg'>('png')
const exportDpi = ref<number>(300)
const exportWidth = ref(EXPORT_DEFAULT_WIDTH)
const exportHeight = ref(EXPORT_DEFAULT_HEIGHT)
const exportIncludeBackground = ref(true)
const exportGrayscale = ref(false)
const exportEmbedFonts = ref(true)
const exportFileName = ref('mathcut')
const exportModalOpen = ref(false)
const aiSketchModalOpen = ref(false)
const exportKeepAspect = ref(true)
const exportAspectRatio = ref(exportWidth.value / exportHeight.value)

const exportSizeError = computed(() => {
  const w = exportWidth.value
  const h = exportHeight.value
  if (!w || !h || w <= 0 || h <= 0) return '0 이하의 값은 입력할 수 없습니다'
  if (w < EXPORT_MIN_PX || h < EXPORT_MIN_PX) return `최소 ${EXPORT_MIN_PX}px 이상 입력하세요`
  if (w > EXPORT_MAX_PX || h > EXPORT_MAX_PX) return `최대 ${EXPORT_MAX_PX.toLocaleString()}px까지 입력 가능합니다`
  return ''
})

// 출력 픽셀 수가 매우 크면 메모리 경고 (대략 3200만 픽셀 이상)
const exportMemoryWarning = computed(() => {
  if (exportFormat.value === 'svg') return ''
  const dpiScale = Math.max(1, exportDpi.value / 96)
  const isDownscaling = exportWidth.value < 1280 || exportHeight.value < 720
  const ratio = isDownscaling
    ? Math.max(exportWidth.value / 1280, exportHeight.value / 720, 0.2)
    : dpiScale
  const renderW = Math.round(1280 * ratio)
  const renderH = Math.round(720 * ratio)
  const totalPx = renderW * renderH
  if (totalPx > 32_000_000) return `렌더링 크기가 매우 큽니다 (약 ${Math.round(totalPx / 1_000_000)}MP). 메모리 부족으로 실패할 수 있습니다.`
  if (totalPx > 16_000_000) return `렌더링 크기가 큽니다 (약 ${Math.round(totalPx / 1_000_000)}MP). 시간이 걸릴 수 있습니다.`
  return ''
})

const exportAspectDisplay = computed(() => {
  const w = Math.round(exportWidth.value || 0)
  const h = Math.round(exportHeight.value || 0)
  if (!w || !h || w <= 0 || h <= 0) return ''
  function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b) }
  const d = gcd(w, h)
  const rw = w / d
  const rh = h / d
  if (rw <= 32 && rh <= 32) return `${rw}:${rh}`
  return `${(w / h).toFixed(2)}:1`
})
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

function hasSnapshotElements(snapshot: CutSnapshot): boolean {
  return snapshot.shapes.length > 0 || snapshot.guides.length > 0
}

function showMaxCanvasAlert() {
  window.alert('최대 10개까지만 캔버스를 추가할 수 있습니다.')
}

function addCut() {
  if (cuts.value.length >= MAX_CANVAS_COUNT) {
    showMaxCanvasAlert()
    return
  }
  syncCurrentCut()
  cuts.value.push({ shapes: [], guides: [], topLevelOrder: [] })
  currentCutIndex.value = cuts.value.length - 1
  canvasStore.loadSnapshot({ shapes: [], guides: [], topLevelOrder: [] })
}

function duplicateCut() {
  if (cuts.value.length >= MAX_CANVAS_COUNT) {
    showMaxCanvasAlert()
    return
  }
  syncCurrentCut()
  cuts.value.push(cloneSnapshot(cuts.value[currentCutIndex.value]))
  currentCutIndex.value = cuts.value.length - 1
  canvasStore.loadSnapshot(cloneSnapshot(cuts.value[currentCutIndex.value]))
}

function deleteCut() {
  syncCurrentCut()
  const targetSnapshot = cuts.value[currentCutIndex.value]
  if (hasSnapshotElements(targetSnapshot)) {
    const shouldDelete = window.confirm('작업중인 요소가 있습니다. 해당 캔버스를 삭제하시겠습니까?')
    if (!shouldDelete) return
  }
  if (cuts.value.length <= 1) {
    cuts.value[0] = { shapes: [], guides: [], topLevelOrder: [] }
    canvasStore.loadSnapshot({ shapes: [], guides: [], topLevelOrder: [] })
    return
  }
  cuts.value.splice(currentCutIndex.value, 1)
  currentCutIndex.value = Math.max(0, currentCutIndex.value - 1)
  canvasStore.loadSnapshot(cloneSnapshot(cuts.value[currentCutIndex.value]))
}

async function handleExport() {
  await gridCanvasRef.value?.exportImage(
    exportFormat.value,
    exportWidth.value,
    exportHeight.value,
    exportDpi.value,
    {
      fileName: exportFileName.value,
      includeBackground: exportIncludeBackground.value,
      grayscale: exportGrayscale.value,
      embedFonts: exportEmbedFonts.value,
    }
  )
}

function openExportModal() {
  exportAspectRatio.value = Math.max(0.01, exportWidth.value / Math.max(1, exportHeight.value))
  exportModalOpen.value = true
}

function closeExportModal() {
  exportModalOpen.value = false
}

async function confirmExport() {
  if (exportSizeError.value) return
  exportWidth.value = Math.min(EXPORT_MAX_PX, Math.max(EXPORT_MIN_PX, Math.round(exportWidth.value)))
  exportHeight.value = Math.min(EXPORT_MAX_PX, Math.max(EXPORT_MIN_PX, Math.round(exportHeight.value)))
  // 선택 효과(그림자·핸들)가 이미지에 포함되지 않도록 선택 해제 후 Vue→Konva 반응성 갱신 대기
  canvasStore.selectShape(null)
  await nextTick()
  handleExport()
  closeExportModal()
}

function resetExportSize() {
  exportWidth.value = EXPORT_DEFAULT_WIDTH
  exportHeight.value = EXPORT_DEFAULT_HEIGHT
  exportAspectRatio.value = EXPORT_DEFAULT_WIDTH / EXPORT_DEFAULT_HEIGHT
}

function setExportPreset(w: number, h: number) {
  exportWidth.value = w
  exportHeight.value = h
  exportAspectRatio.value = w / h
}

function handleExportWidthInput() {
  if (exportKeepAspect.value && exportWidth.value > 0) {
    exportHeight.value = Math.round(exportWidth.value / Math.max(0.01, exportAspectRatio.value))
  }
}

function handleExportHeightInput() {
  if (exportKeepAspect.value && exportHeight.value > 0) {
    exportWidth.value = Math.round(exportHeight.value * Math.max(0.01, exportAspectRatio.value))
  }
}

watch(exportKeepAspect, (enabled) => {
  if (!enabled) return
  exportAspectRatio.value = Math.max(0.01, exportWidth.value / Math.max(1, exportHeight.value))
})

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
  rectangle: '두 개의 점을 대각선으로 클릭하세요.',
  triangle: '세 개의 점을 클릭하세요.',
  polygon: '점을 클릭하고, 첫 점을 다시 클릭하면 완성됩니다.',
  circle: '중심점과 경계점을 클릭하세요.',
  point: '위치를 클릭하세요.',
  'point-on-object': '도형/선 위의 위치를 클릭하세요.',
  segment: '두 점을 클릭하세요.',
  ray: '시작점과 방향점을 클릭하세요.',
  line: '두 점을 클릭하세요.',
  'angle-line': '두 선분의 끝점을 클릭하세요.',
  'triangle-equilateral': '밑변의 두 점을 클릭하세요.',
  'triangle-right': '밑변의 두 점을 찍고 세 번째 점으로 높이를 정하세요 (직각 보정).',
  'triangle-isosceles': '밑변의 두 점을 찍고 세 번째 점으로 높이를 정하세요 (같은 변 길이 자동 고정).',
  'triangle-free': '세 개의 점을 클릭하세요.',
  'rect-square': '한 변의 두 점을 클릭하세요.',
  'rect-rectangle': '대각선의 두 점을 클릭하세요.',
  'rect-trapezoid': '밑변의 두 점을 찍고 세 번째 점으로 윗변을 정하세요.',
  'rect-rhombus': '한 변의 두 점을 찍고 세 번째 점으로 기울기를 정하세요.',
  'rect-parallelogram': '세 점을 클릭하세요.',
  'rect-free': '네 개의 점을 클릭하세요.',
  'polygon-regular': '중심과 꼭짓점을 클릭하면 정다각형이 생성됩니다.',
  'free-shape': '점을 클릭하고, 첫 점을 다시 클릭하면 완성됩니다.',
  arrow: '시작점과 끝점을 클릭하세요.',
  'arrow-curve': '시작점과 끝점을 클릭하세요.',
  counter: '위치를 클릭하세요.'
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
  return isHeightDefaultVisibleType(shape.type)
}

function getShapeAngleIndices(shape: Shape): number[] {
  return getShapeAutoAngleIndices(shape, toolStore.angleDisplayMode)
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
    return shapeInstructions[toolStore.shapeType] ?? '도형 도구를 선택하세요.'
  }

  const instructions: Record<GuideType, string> = {
    length: '도형 변을 드래그해 생성하고, 생성된 곡선을 클릭해 방향을 바꿉니다.',
    text: '배치할 위치를 클릭하세요.',
    angle: '도형의 꼭짓점을 클릭하면 해당 각도가 표시됩니다.',
    'blank-box': 'AI 스케치에서 생성되는 외부 빈칸 박스입니다.'
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
    angle: '각도',
    'blank-box': '빈칸 박스'
  }
  return names[toolStore.guideType]
})

const currentIcon = computed(() => {
  if (toolStore.mode === 'select') return '↖'
  if (toolStore.mode === 'shape') return shapeIcons[toolStore.shapeType] ?? '•'
  const guideIcons: Record<GuideType, string> = { length: '📏', text: 'T', angle: '∠', 'blank-box': '⬚' }
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
const draggedLayerItemId = ref<string | null>(null)
const dragOverLayerItemId = ref<string | null>(null)
const dragInsertPreview = ref<{ itemKey: string, position: 'before' | 'after' } | null>(null)

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
      && shape.type !== 'rect-rhombus'
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
        icon: guide.type === 'length' ? '📏' : guide.type === 'text' ? 'A' : guide.type === 'blank-box' ? '⬚' : '∠',
        label: `${guide.type === 'length' ? '길이 가이드' : guide.type === 'text' ? '텍스트 가이드' : guide.type === 'blank-box' ? '빈칸 박스' : '각도 가이드'} ${gIndex + 1}`,
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
      icon: guide.type === 'length' ? '📏' : guide.type === 'text' ? 'A' : guide.type === 'blank-box' ? '⬚' : '∠',
      label: `${guide.type === 'length' ? '길이 가이드' : guide.type === 'text' ? '텍스트 가이드' : guide.type === 'blank-box' ? '빈칸 박스' : '각도 가이드'} ${index + 1}`,
      guideId: guide.id,
      visible: guide.visible !== false
    }))
})

const topLevelLayers = computed(() => {
  const shapeMap = new Map(groupedLayers.value.map((group) => [group.shapeId, group]))
  const guideMap = new Map(unboundGuides.value.map((guide) => [guide.guideId, guide]))

  return [...canvasStore.topLevelOrder]
    .reverse()
    .map((itemKey) => {
      if (itemKey.startsWith('shape:')) {
        const shapeId = itemKey.slice(6)
        const group = shapeMap.get(shapeId)
        return group ? { kind: 'shape' as const, itemKey, ...group } : null
      }
      if (itemKey.startsWith('guide:')) {
        const guideId = itemKey.slice(6)
        const guide = guideMap.get(guideId)
        return guide ? { kind: 'guide' as const, itemKey, ...guide } : null
      }
      return null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
})

function isGuideLayerSelected(guideId: string): boolean {
  return canvasStore.selectedGuideId === guideId
}

function shouldShowLayerDropIndicator(itemKey: string, position: 'before' | 'after'): boolean {
  return dragInsertPreview.value?.itemKey === itemKey && dragInsertPreview.value?.position === position
}

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

function handleLayerDragStart(itemKey: string, e: DragEvent) {
  draggedLayerItemId.value = itemKey
  dragOverLayerItemId.value = itemKey
  e.dataTransfer?.setData('text/plain', itemKey)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

function handleLayerDragOver(itemKey: string, e: DragEvent) {
  if (!draggedLayerItemId.value) return
  e.preventDefault()
  dragOverLayerItemId.value = itemKey
  const currentTarget = e.currentTarget as HTMLElement | null
  if (currentTarget) {
    const rect = currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    dragInsertPreview.value = {
      itemKey,
      position: offsetY < rect.height / 2 ? 'before' : 'after'
    }
  }
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function handleLayerDrop(targetItemKey: string, e: DragEvent) {
  e.preventDefault()
  const draggedId = draggedLayerItemId.value
  draggedLayerItemId.value = null
  dragOverLayerItemId.value = null
  const insertPreview = dragInsertPreview.value
  dragInsertPreview.value = null
  if (!draggedId || draggedId === targetItemKey) return

  const displayOrder = topLevelLayers.value.map((item) => item.itemKey)
  const fromDisplayIndex = displayOrder.findIndex((itemKey) => itemKey === draggedId)
  const targetDisplayIndex = displayOrder.findIndex((itemKey) => itemKey === targetItemKey)
  if (fromDisplayIndex === -1 || targetDisplayIndex === -1) return

  const nextDisplayOrder = displayOrder.filter((itemKey) => itemKey !== draggedId)
  const rawInsertIndex = insertPreview?.position === 'after'
    ? targetDisplayIndex + 1
    : targetDisplayIndex
  const insertIndex = fromDisplayIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex
  nextDisplayOrder.splice(insertIndex, 0, draggedId)
  const nextDisplayIndex = nextDisplayOrder.findIndex((itemKey) => itemKey === draggedId)
  const nextOrderIndex = Math.max(0, canvasStore.topLevelOrder.length - 1 - nextDisplayIndex)
  canvasStore.moveTopLevelItemToIndex(draggedId, nextOrderIndex)
}

function handleLayerDragEnd() {
  draggedLayerItemId.value = null
  dragOverLayerItemId.value = null
  dragInsertPreview.value = null
}

function handleLayerTrashDrop(e: DragEvent) {
  e.preventDefault()
  const itemKey = draggedLayerItemId.value
  draggedLayerItemId.value = null
  dragOverLayerItemId.value = null
  dragInsertPreview.value = null
  if (!itemKey) return
  if (itemKey.startsWith('shape:')) {
    canvasStore.removeShape(itemKey.slice(6))
  } else if (itemKey.startsWith('guide:')) {
    canvasStore.removeGuide(itemKey.slice(6))
  }
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
  loadSavedCut(route.params.cutId)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(
  () => route.params.cutId,
  (cutId, prevCutId) => {
    if (cutId === prevCutId) return
    loadSavedCut(cutId)
  }
)
</script>

<template>
  <!-- EditorView: 콘테이너 전체 채움, flex 컨럼 -->
  <div class="absolute inset-0 flex flex-col bg-gray-950">

    <!-- ===== 상단 크롬 바 (h-10) ===== -->
    <div class="relative shrink-0 h-10 bg-gray-900 border-b border-gray-800 flex items-center px-3 z-50">

      <!-- ── 왼쪽: 로고 + 컷 탐색 + 줌 ── -->
      <div class="flex items-center gap-2 min-w-0">

        <!-- 로고 -->
        <div class="flex items-center gap-1.5 mr-1 shrink-0">
          <div class="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center">
            <span class="text-white text-[10px] font-bold">M</span>
          </div>
          <span class="text-xs font-semibold text-gray-300 tracking-wide">MathCut</span>
        </div>

        <div class="w-px h-4 bg-gray-700 shrink-0"></div>

        <!-- 컷 탐색 -->
        <div class="flex items-center gap-0.5 shrink-0">
          <button
            class="chrome-btn w-6 h-6 flex items-center justify-center text-[10px]"
            :disabled="currentCutIndex === 0"
            :class="currentCutIndex === 0 ? 'opacity-25 cursor-not-allowed' : ''"
            @click="currentCutIndex > 0 && (syncCurrentCut(), currentCutIndex--, canvasStore.loadSnapshot(cloneSnapshot(cuts[currentCutIndex])))"
            title="이전 컷"
          >‹</button>
          <span class="text-[11px] text-gray-400 w-10 text-center tabular-nums">{{ currentCutIndex + 1 }}/{{ cuts.length }}</span>
          <button
            class="chrome-btn w-6 h-6 flex items-center justify-center text-[10px]"
            :disabled="currentCutIndex >= cuts.length - 1"
            :class="currentCutIndex >= cuts.length - 1 ? 'opacity-25 cursor-not-allowed' : ''"
            @click="currentCutIndex < cuts.length - 1 && (syncCurrentCut(), currentCutIndex++, canvasStore.loadSnapshot(cloneSnapshot(cuts[currentCutIndex])))"
            title="다음 컷"
          >›</button>
        </div>

        <!-- 컷 조작 -->
        <div class="flex items-center gap-0.5 shrink-0">
          <button class="chrome-btn px-1.5 h-6 text-[11px]" @click="addCut" title="컷 추가">+</button>
          <button class="chrome-btn px-1.5 h-6 text-[11px]" @click="duplicateCut" title="컷 복제">⧉</button>
          <button class="chrome-btn px-1.5 h-6 text-[11px] hover:text-red-400" @click="deleteCut" title="컷 삭제">✕</button>
        </div>

        <div class="w-px h-4 bg-gray-700 shrink-0"></div>

        <!-- 줌 -->
        <div class="flex items-center gap-0.5 shrink-0">
          <button
            class="chrome-btn w-6 h-6 flex items-center justify-center text-sm font-light"
            :disabled="toolStore.zoom <= 100"
            :class="toolStore.zoom <= 100 ? 'opacity-25 cursor-not-allowed' : ''"
            @click="toolStore.zoomOut"
            title="축소"
          >−</button>
          <span class="text-[11px] text-gray-400 w-9 text-center tabular-nums">{{ toolStore.zoom }} %</span>
          <button
            class="chrome-btn w-6 h-6 flex items-center justify-center text-sm font-light"
            :disabled="toolStore.zoom >= 200"
            :class="toolStore.zoom >= 200 ? 'opacity-25 cursor-not-allowed' : ''"
            @click="toolStore.zoomIn"
            title="확대"
          >+</button>
        </div>
      </div>

      <!-- ── 스페이서 ── -->
      <div class="flex-1"></div>

      <!-- ── 오른쪽: 액션 버튼 + 유저 ── -->
      <div class="flex items-center gap-1.5">

        <!-- AI 스케치 -->
        <button
          class="flex items-center gap-1 h-6 px-2.5 rounded-md text-[11px] font-medium
                 bg-violet-500/15 text-violet-300 border border-violet-500/25
                 hover:bg-violet-500/25 hover:text-violet-200 hover:border-violet-400/40
                 transition-all duration-150"
          @click="aiSketchModalOpen = true"
        >
          <span class="text-[10px]">✦</span> AI 스케치
        </button>

        <!-- 내보내기 -->
        <button
          class="flex items-center gap-1 h-6 px-2.5 rounded-md text-[11px] font-medium
                 bg-gray-700/60 text-gray-300 border border-gray-600/50
                 hover:bg-gray-700 hover:text-gray-100 hover:border-gray-500
                 transition-all duration-150"
          @click="openExportModal"
        >
          <span class="text-[10px]">↗</span> 내보내기
        </button>

        <div class="w-px h-4 bg-gray-700"></div>

        <!-- 저장 -->
        <button
          class="h-6 px-3 rounded-md text-[11px] font-semibold
                 bg-emerald-500 text-white
                 hover:bg-emerald-400
                 disabled:opacity-50 disabled:cursor-wait
                 transition-all duration-150 shadow-sm shadow-emerald-500/20"
          :disabled="cutRequestLoading"
          @click="handleSave"
          title="내 보관함에 저장"
        >{{ cutRequestLoading ? '로딩 중…' : '저장' }}</button>

        <!-- 비로그인 -->
        <button
          v-if="!auth.isLoggedIn"
          class="h-6 px-2.5 rounded-md text-[11px] font-medium
                 text-gray-400 border border-gray-700
                 hover:text-gray-200 hover:border-gray-500
                 transition-all duration-150"
          @click="router.push('/login')"
        >로그인</button>

        <!-- 로그인: 유저 아바타 -->
        <div v-else class="relative">
          <button
            class="w-6 h-6 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full
                   flex items-center justify-center
                   hover:opacity-80 transition ring-2 ring-transparent hover:ring-emerald-400/30"
            @click="toggleUserDropdown"
            title="사용자 메뉴"
          >
            <span class="text-white text-[10px] font-semibold">{{ auth.nickname?.charAt(0).toUpperCase() ?? 'U' }}</span>
          </button>

          <div
            v-if="userDropdownOpen"
            class="absolute right-0 top-8 w-40 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl shadow-black/40 py-1 z-50"
            @click.stop
          >
            <div class="px-3 py-2 border-b border-gray-700/60">
              <p class="text-[11px] font-semibold text-gray-200 truncate">{{ auth.nickname }}</p>
              <p class="text-[10px] text-gray-500">로그인됨</p>
            </div>
            <button
              class="w-full text-left px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-700/60 transition"
              @click="goToLibrary(); closeUserDropdown()"
            >내 보관함</button>
            <button
              class="w-full text-left px-3 py-1.5 text-[11px] text-red-400 hover:bg-gray-700/60 transition"
              @click="handleLogout"
            >로그아웃</button>
          </div>
        </div>
      </div>

      <!-- 드롭다운 외부 클릭 닫기 -->
      <div v-if="userDropdownOpen" class="fixed inset-0 z-40" @click="closeUserDropdown"></div>
    </div>

    <!-- 좌측 도구 사이드바 (크롬 바/상태 바 제외, absolute) -->
    <AppSidebar />

    <!-- ===== 메인 영역 (캔버스 + 우측 패널) ===== -->
    <div class="flex-1 relative overflow-hidden">

      <!-- 캔버스 전체화면 배치 -->
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

      <!-- 우측 패널 콘테이너 -->
      <div class="absolute top-0 right-0 bottom-0 left-0 z-10 flex items-start justify-end pointer-events-none">

        <!-- 우측 패널 본체 -->
        <div
          class="h-full w-64 bg-white/95 backdrop-blur-sm border-l border-gray-200 shadow-2xl
                 flex flex-col overflow-hidden transition-transform duration-200 ease-in-out
                 pointer-events-auto"
          :class="rightPanelOpen ? 'translate-x-0' : 'translate-x-64'"
        >
          <!-- 탭 헤더 -->
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

          <!-- 속성 탭 -->
          <div v-if="activeTab === 'info'" class="flex-1 overflow-y-auto p-3">
            <InfoPanel />
          </div>

          <!-- 레이어 탭 -->
          <div v-if="activeTab === 'layer'" class="relative flex-1 overflow-y-auto p-3 pb-20">
            <div v-if="topLevelLayers.length === 0" class="text-sm text-gray-400 text-center py-8">
              도형/가이드를 추가하면<br>여기에 표시됩니다.
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="item in topLevelLayers"
                :key="item.itemKey"
                class="relative"
              >
                <div
                  v-if="shouldShowLayerDropIndicator(item.itemKey, 'before')"
                  class="absolute left-2 right-2 -top-1 h-0.5 rounded-full bg-orange-400 shadow-[0_0_0_1px_rgba(251,146,60,0.18)]"
                ></div>
                <div
                v-if="item.kind === 'shape'"
                class="rounded-lg border bg-white"
                :class="[
                  isShapeLayerSelected(item.shapeId) ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200',
                  dragOverLayerItemId === item.itemKey ? 'ring-2 ring-orange-200 border-orange-300' : ''
                ]"
                draggable="true"
                @dragstart="handleLayerDragStart(item.itemKey, $event)"
                @dragover="handleLayerDragOver(item.itemKey, $event)"
                @drop="handleLayerDrop(item.itemKey, $event)"
                @dragend="handleLayerDragEnd"
                @contextmenu="openShapeLayerContextMenu($event, item.shapeId)"
              >
                <div
                  class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 text-sm text-left cursor-pointer"
                  :class="isLayerCollapsed(item.id) ? 'rounded-lg' : 'rounded-t-lg'"
                  @click="selectShapeLayer(item.shapeId)"
                >
                  <button
                    class="text-xs text-gray-400 w-5 h-5 rounded hover:bg-gray-100"
                    @click.stop="toggleLayerCollapsed(item.id)"
                  >
                    {{ isLayerCollapsed(item.id) ? '▶' : '▼' }}
                  </button>
                  <span class="text-base leading-none">{{ item.icon }}</span>
                  <span class="text-gray-700 truncate font-medium">{{ item.label }}</span>
                  <button class="eye-btn ml-auto" @click.stop="toggleShapeLayerVisibility(item.shapeId, item.visible)" :title="item.visible ? '숨김' : '표시'">
                    {{ getVisibilityIcon(item.visible) }}
                  </button>
                  <span
                    v-if="isLayerCollapsed(item.id) && (item.childShapes.length + item.autoGuideItems.length + item.guides.length > 0)"
                    class="text-[11px] text-gray-400"
                  >
                    {{ item.childShapes.length + item.autoGuideItems.length + item.guides.length }}개
                  </span>
                </div>
                <div
                  v-if="!isLayerCollapsed(item.id) && (item.childShapes.length || item.autoGuideItems.length || item.guides.length)"
                  class="ml-4 pl-2 py-1 border-l-2 border-orange-200 space-y-1"
                >
                  <div
                    v-for="child in item.childShapes"
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
                    v-for="autoItem in item.autoGuideItems"
                    :key="autoItem.id"
                    class="flex items-center gap-2 px-2 py-1 rounded-md text-sm bg-gray-50 text-gray-700"
                    @contextmenu="openShapeGuideItemContextMenu($event, item.shapeId, autoItem.key, autoItem.index)"
                  >
                    <span class="text-base leading-none">{{ autoItem.icon }}</span>
                    <span class="truncate flex-1">{{ autoItem.label }}</span>
                    <button class="eye-btn" @click.stop="toggleShapeGuideVisibility(item.shapeId, autoItem.key, autoItem.index, autoItem.visible)">
                      {{ getVisibilityIcon(autoItem.visible) }}
                    </button>
                  </div>
                  <div
                    v-for="guide in item.guides"
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
                  v-else
                  class="rounded-lg border bg-white"
                  :class="[
                    isGuideLayerSelected(item.guideId) ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200',
                    dragOverLayerItemId === item.itemKey ? 'ring-2 ring-orange-200 border-orange-300' : ''
                  ]"
                  draggable="true"
                  @dragstart="handleLayerDragStart(item.itemKey, $event)"
                  @dragover="handleLayerDragOver(item.itemKey, $event)"
                  @drop="handleLayerDrop(item.itemKey, $event)"
                  @dragend="handleLayerDragEnd"
                  @contextmenu="openGuideLayerContextMenu($event, item.guideId)"
                >
                  <div
                    class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm bg-orange-50/60 text-gray-700 cursor-pointer hover:bg-orange-100/70"
                    @click="selectGuideLayer(item.guideId)"
                  >
                    <span class="text-base leading-none">{{ item.icon }}</span>
                    <span class="truncate flex-1">{{ item.label }}</span>
                    <button class="eye-btn" @click.stop="toggleGuideVisibility(item.guideId, item.visible)">
                      {{ getVisibilityIcon(item.visible) }}
                    </button>
                  </div>
                </div>
                <div
                  v-if="shouldShowLayerDropIndicator(item.itemKey, 'after')"
                  class="absolute left-2 right-2 -bottom-1 h-0.5 rounded-full bg-orange-400 shadow-[0_0_0_1px_rgba(251,146,60,0.18)]"
                ></div>
              </div>
            </div>

            <div
              v-if="draggedLayerItemId"
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

        <!-- 우측 패널 토글 버튼 -->
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

    <div
      v-if="exportModalOpen"
      class="absolute inset-0 z-40 bg-black/30 flex items-center justify-center"
      @click.self="closeExportModal"
    >
      <div class="w-[360px] max-w-[92vw] bg-white rounded-xl shadow-2xl border border-gray-200 p-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3">이미지 내보내기</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">파일 형식</label>
            <select v-model="exportFormat" class="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500">
              <option value="png">PNG — 래스터 이미지 (범용)</option>
              <option value="pdf">PDF — 인쇄·문서용</option>
              <option value="svg">SVG — 벡터 (편집 가능)</option>
            </select>
            <!-- 포맷별 출판 안내 -->
            <p v-if="exportFormat === 'png'" class="mt-1 text-xs text-gray-400">
              PNG는 RGB 색상입니다. 출판사 제출 시 Illustrator·Photoshop에서 CMYK로 변환하세요.
            </p>
            <p v-else-if="exportFormat === 'pdf'" class="mt-1 text-xs text-gray-400">
              PDF는 RGB 기반으로 생성됩니다. 교과서·출판물용은 Acrobat 등으로 PDF/X-1a 또는 PDF/X-4 규격으로 변환 후 제출하세요.
            </p>
            <p v-else class="mt-1 text-xs text-gray-400">
              SVG는 텍스트 기반 벡터 파일입니다. Illustrator·Inkscape에서 열어 색상 프로파일 설정 및 아웃라인화 후 사용하세요.
            </p>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">파일명</label>
            <input
              v-model.trim="exportFileName"
              type="text"
              class="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
              placeholder="mathcut"
            >
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-gray-500">이미지 크기 (px)</label>
              <button
                class="text-xs text-blue-500 hover:text-blue-700 underline"
                @click="resetExportSize"
                title="기본값으로 초기화 (1280×720)"
              >초기화</button>
            </div>
            <!-- 권장 프리셋 -->
            <div class="flex gap-1 mb-2">
              <button
                v-for="preset in [{ label: '720p', w: 1280, h: 720 }, { label: '1080p', w: 1920, h: 1080 }, { label: '2K', w: 2560, h: 1440 }]"
                :key="preset.label"
                class="flex-1 text-xs py-0.5 rounded border transition"
                :class="exportWidth === preset.w && exportHeight === preset.h
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400 hover:text-blue-500'"
                @click="setExportPreset(preset.w, preset.h)"
              >{{ preset.label }}</button>
            </div>
            <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
              <input
                v-model.number="exportWidth"
                type="number"
                class="text-sm border rounded px-2 py-1.5 focus:outline-none transition w-full"
                :class="exportSizeError ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'"
                placeholder="너비"
                @input="handleExportWidthInput"
              >
              <span class="text-xs text-gray-400 text-center">×</span>
              <input
                v-model.number="exportHeight"
                type="number"
                class="text-sm border rounded px-2 py-1.5 focus:outline-none transition w-full"
                :class="exportSizeError ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'"
                placeholder="높이"
                @input="handleExportHeightInput"
              >
            </div>
            <!-- 검증 메시지 / 비율 표시 -->
            <div class="mt-1 min-h-[1.2rem]">
              <p v-if="exportSizeError" class="text-xs text-red-500">{{ exportSizeError }}</p>
              <p v-else-if="exportAspectDisplay" class="text-xs text-gray-400">
                비율 {{ exportAspectDisplay }}
                <span class="ml-1 text-gray-300">· 권장 최소 {{ EXPORT_MIN_PX }}px, 최대 {{ EXPORT_MAX_PX.toLocaleString() }}px</span>
              </p>
            </div>
            <label class="mt-1.5 flex items-center gap-2 text-xs text-gray-600">
              <input v-model="exportKeepAspect" type="checkbox">
              <span>비율 유지</span>
            </label>
          </div>
          <!-- SVG: 벡터 안내 / PNG·PDF: 해상도 선택 -->
          <div v-if="exportFormat === 'svg'" class="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-600">
            SVG는 벡터 형식으로 어떤 크기로 출력해도 항상 선명합니다. 해상도 설정이 필요 없습니다.
          </div>
          <div v-else>
            <label class="text-xs text-gray-500 mb-1 block">해상도 (DPI)</label>
            <select v-model.number="exportDpi" class="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500">
              <option :value="72">72 DPI — 화면 표시·웹용 (파일 작음)</option>
              <option :value="150">150 DPI — 일반 출력·문서용</option>
              <option :value="300">300 DPI — 고품질 인쇄 (권장)</option>
              <option :value="600">600 DPI — 최고품질 인쇄 (파일 매우 큼)</option>
            </select>
            <p class="mt-1 text-xs text-gray-400">
              <template v-if="exportDpi === 72">화면 표시 수준의 해상도입니다. 인쇄 시 계단 현상이 생길 수 있습니다.</template>
              <template v-else-if="exportDpi === 150">일반 프린터 출력에 적합합니다.</template>
              <template v-else-if="exportDpi === 300">인쇄용 고품질 렌더링입니다. PNG·PDF 파일이 커질 수 있습니다.</template>
              <template v-else>교과서·출판물 인쇄에 권장하는 최고 품질입니다. 렌더링이 오래 걸릴 수 있습니다.</template>
            </p>
            <p v-if="exportMemoryWarning" class="mt-1 text-xs text-amber-600">⚠ {{ exportMemoryWarning }}</p>
          </div>
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="exportIncludeBackground" type="checkbox">
            <span>배경 포함</span>
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="exportGrayscale" type="checkbox">
            <span>흑백으로 내보내기</span>
          </label>
          <label v-if="exportFormat === 'svg'" class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="exportEmbedFonts" type="checkbox">
            <span>폰트 임베딩 <span class="text-xs text-gray-400">(SVG 단독 배포 시 권장)</span></span>
          </label>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button class="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50" @click="closeExportModal">취소</button>
          <button
            class="px-3 py-1.5 text-sm rounded transition"
            :class="exportSizeError ? 'bg-gray-300 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500'"
            :disabled="!!exportSizeError"
            @click="confirmExport"
          >내보내기</button>
        </div>
      </div>
    </div>

    <AISketchModal
      v-if="aiSketchModalOpen"
      @close="aiSketchModalOpen = false"
    />

    <!-- ===== 하단 상태 바 (h-8) ===== -->
    <div class="shrink-0 h-8 bg-gray-900 border-t border-gray-800 flex items-center px-3 gap-3 z-30">

      <!-- 현재 도구 -->
      <div class="flex items-center gap-1.5">
        <span class="text-sm text-gray-300 leading-none">{{ currentIcon }}</span>
        <span class="text-xs font-medium text-gray-200">{{ currentTool }}</span>
      </div>

      <div class="w-px h-4 bg-gray-700"></div>

      <!-- 안내 문구 -->
      <span class="text-xs text-gray-400 flex-1 truncate">{{ instruction }}</span>

      <!-- 격자 모드 -->
      <span class="text-xs text-gray-500">{{ gridModeLabel }}</span>

      <!-- 마우스 좌표 -->
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
