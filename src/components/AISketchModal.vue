<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import { useToolStore } from '@/stores/tool'
import { useAISketch } from '@/composables/useAISketch'
import type { ShapeType } from '@/types'

const emit = defineEmits<{
  close: []
}>()

const canvasStore = useCanvasStore()
const toolStore = useToolStore()
const { isAnalyzing, error, analyzeImage, abortAnalysis } = useAISketch()

const tab = ref<'draw' | 'upload'>('draw')
const drawMode = ref<'pencil' | 'eraser'>('pencil')
const drawCanvasRef = ref<HTMLCanvasElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const localError = ref<string | null>(null)
const uploadedImageDataUrl = ref<string | null>(null)
const uploadedFileName = ref('')
const drawHistory = ref<ImageData[]>([])
const hasDrawn = ref(false)
const isPointerDown = ref(false)
const lastPoint = ref<{ x: number, y: number } | null>(null)
const selectedShapeType = ref<ShapeType | ''>('')
const userHint = ref('')

const shapeHintExamples: Partial<Record<ShapeType, string>> = {
  'triangle':
    '꼭짓점 A, B, C. AB=5cm, BC=3cm, CA=4cm. A=빈칸, B=60° 표시. 높이 자동계산해서 표시',
  'triangle-right':
    '꼭짓점 A, B, C. C가 직각. A=30°, B의 각도는 빈칸. AC=3cm, CB=6cm, 빗변 표시 없음',
  'triangle-equilateral':
    '꼭짓점 ㄱ, ㄴ, ㄷ. 모든 변 5cm. 길이 표시는 ㄱ-ㄷ 변에만. 내각은 모두 60°, ㄴ의 각도만 빈칸. 높이 자동계산해서 표시',
  'triangle-isosceles':
    '꼭짓점 ㄱ(위), ㄴ(좌하), ㄷ(우하). ㄱㄴ=6cm, ㄱㄷ=6cm, ㄴㄷ=4cm(밑변). 높이 자동계산해서 표시. 각도는 ㄷ만 표시',
  'rect-square':
    '꼭짓점 A, B, C, D. 한 변=5cm, 길이 표시는 AB 한 변만. 각도 표시 없음',
  'rect-rectangle':
    '꼭짓점 A, B, C, D. 가로(AB)=8cm, 세로(BC)=5cm. 반대편 변(CD, DA)은 숨김',
  'rect-rhombus':
    '꼭짓점 A, B, C, D. 한 변=4cm. 예각 A=60°, 둔각 B=120° 표시. 나머지 각도 숨김',
  'rect-parallelogram':
    '꼭짓점 A, B, C, D. 아랫변 AB=6cm, 옆변 BC=3cm. A=60° 표시. 반대편 변 숨김. 높이 자동계산해서 표시',
  'rect-trapezoid':
    '꼭짓점 A, B, C, D. 윗변 AB=4cm, 아랫변 DC=8cm. A의 각도=빈칸. 높이 자동계산해서 표시',
  'circle':
    '중심점 이름 O. 반지름=5cm. 반지름 선과 길이 표시',
  'segment':
    '양 끝점 A, B. AB=6cm. 끝점 이름과 길이 표시',
  'ray':
    '시작점 O, 방향 끝점 A. 길이 표시 없음',
  'line':
    '직선 위 두 점 A, B 표시. 양쪽으로 무한히 이어지는 형태',
  'free-shape':
    '꼭짓점 A, B, C, D, E(5개). 각 변 길이 표시 없음. 불규칙한 닫힌 도형. 높이 표시 필요하면 "높이 표시" 명시',
  'polygon':
    '꼭짓점 A, B, C, D(4개). AB=5cm, BC=4cm, CD=6cm, DA=4cm. 불규칙한 사각형. 각도 표시 없음',
}

const shapeTypeOptions: Array<{ value: ShapeType, label: string }> = [
  { value: 'triangle', label: '자유로운 삼각형' },
  { value: 'triangle-right', label: '직각삼각형' },
  { value: 'triangle-equilateral', label: '정삼각형' },
  { value: 'triangle-isosceles', label: '이등변삼각형' },
  { value: 'polygon', label: '자유로운 사각형' },
  { value: 'rect-square', label: '정사각형' },
  { value: 'rect-rectangle', label: '직사각형' },
  { value: 'rect-rhombus', label: '마름모' },
  { value: 'rect-parallelogram', label: '평행사변형' },
  { value: 'rect-trapezoid', label: '사다리꼴' },
  { value: 'circle', label: '원' },
  { value: 'segment', label: '선분' },
  { value: 'ray', label: '반직선' },
  { value: 'line', label: '직선' },
  { value: 'free-shape', label: '자유도형' },
]

const HEIGHT_SUPPORTED_TYPES = new Set<ShapeType>([
  'triangle',
  'triangle-isosceles',
  'triangle-equilateral',
  'rect-parallelogram',
  'rect-trapezoid',
])

const showHeightTip = computed(() =>
  !selectedShapeType.value || HEIGHT_SUPPORTED_TYPES.has(selectedShapeType.value),
)
const hintExample = computed(() => {
  if (!selectedShapeType.value) {
    return '도형을 먼저 선택하면 해당 도형에 맞는 힌트 예시가 표시됩니다.'
  }
  return shapeHintExamples[selectedShapeType.value] || '예: 꼭짓점 이름, 길이, 각도, 배치 조건을 구체적으로 적어주세요.'
})

const canAnalyze = computed(() => {
  const hasSource = tab.value === 'draw' ? hasDrawn.value : !!uploadedImageDataUrl.value
  return hasSource && !!selectedShapeType.value
})

function getDrawContext(): CanvasRenderingContext2D | null {
  return drawCanvasRef.value?.getContext('2d') ?? null
}

function exportDrawCanvasDataUrl(): string | null {
  const canvas = drawCanvasRef.value
  if (!canvas) return null

  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = canvas.width
  exportCanvas.height = canvas.height
  const exportCtx = exportCanvas.getContext('2d')
  if (!exportCtx) return null

  exportCtx.fillStyle = '#ffffff'
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
  exportCtx.drawImage(canvas, 0, 0)

  return exportCanvas.toDataURL('image/png')
}

function resetDrawCanvas() {
  const canvas = drawCanvasRef.value
  const ctx = getDrawContext()
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawHistory.value = []
  hasDrawn.value = false
  lastPoint.value = null
}

function getCanvasPoint(event: PointerEvent): { x: number, y: number } | null {
  const canvas = drawCanvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  }
}

function startStroke(event: PointerEvent) {
  const canvas = drawCanvasRef.value
  const ctx = getDrawContext()
  const point = getCanvasPoint(event)
  if (!canvas || !ctx || !point) return

  canvas.setPointerCapture(event.pointerId)
  drawHistory.value.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
  isPointerDown.value = true
  lastPoint.value = point

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = drawMode.value === 'eraser' ? 20 : 3
  ctx.strokeStyle = '#111111'
  ctx.globalCompositeOperation = drawMode.value === 'eraser' ? 'destination-out' : 'source-over'
  ctx.beginPath()
  ctx.moveTo(point.x, point.y)
  ctx.lineTo(point.x, point.y)
  ctx.stroke()
  ctx.restore()

  hasDrawn.value = true
}

function moveStroke(event: PointerEvent) {
  const ctx = getDrawContext()
  const point = getCanvasPoint(event)
  if (!ctx || !point || !isPointerDown.value || !lastPoint.value) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = drawMode.value === 'eraser' ? 20 : 3
  ctx.strokeStyle = '#111111'
  ctx.globalCompositeOperation = drawMode.value === 'eraser' ? 'destination-out' : 'source-over'
  ctx.beginPath()
  ctx.moveTo(lastPoint.value.x, lastPoint.value.y)
  ctx.lineTo(point.x, point.y)
  ctx.stroke()
  ctx.restore()

  lastPoint.value = point
}

function finishStroke(event?: PointerEvent) {
  if (event && drawCanvasRef.value?.hasPointerCapture(event.pointerId)) {
    drawCanvasRef.value.releasePointerCapture(event.pointerId)
  }
  isPointerDown.value = false
  lastPoint.value = null
}

function undoDraw() {
  const canvas = drawCanvasRef.value
  const ctx = getDrawContext()
  const previous = drawHistory.value.pop()
  if (!canvas || !ctx || !previous) return
  ctx.putImageData(previous, 0, 0)
  hasDrawn.value = drawHistory.value.length > 0
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function loadFile(file: File) {
  if (!file.type.startsWith('image/')) {
    localError.value = '이미지 파일만 업로드할 수 있습니다.'
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    uploadedImageDataUrl.value = typeof reader.result === 'string' ? reader.result : null
    uploadedFileName.value = file.name
    localError.value = uploadedImageDataUrl.value ? null : '이미지를 불러오지 못했습니다.'
  }
  reader.onerror = () => {
    localError.value = '이미지를 불러오지 못했습니다.'
  }
  reader.readAsDataURL(file)
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  loadFile(file)
  input.value = ''
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  loadFile(file)
}

async function handleAnalyze() {
  localError.value = null
  if (!selectedShapeType.value) {
    localError.value = '도형을 먼저 선택해주세요.'
    return
  }
  if (!canAnalyze.value) {
    localError.value = '그림이나 이미지를 준비한 뒤 변환을 실행해주세요.'
    return
  }

  if (!userHint.value) {
    const confirmed = window.confirm(
      '추가 힌트 없이 이미지만으로 AI 스케치를 실행하면\n'
      + '꼭짓점 이름·변 길이·각도·빈칸 위치 등이 부정확하게 인식될 수 있습니다.\n\n'
      + '정확한 결과를 원하면 [취소] 후 힌트를 입력해주세요.\n'
      + '이대로 진행하시겠습니까?',
    )
    if (!confirmed) return
  }

  const imageDataUrl = tab.value === 'draw'
    ? exportDrawCanvasDataUrl()
    : uploadedImageDataUrl.value

  if (!imageDataUrl) {
    localError.value = '이미지를 준비하지 못했습니다.'
    return
  }

  try {
    const result = await analyzeImage(imageDataUrl, {
      forcedShapeType: selectedShapeType.value as ShapeType,
      userHint: userHint.value,
    })
    canvasStore.importAISketchResult({
      shapes: result.shapes,
      guides: result.guides,
    })
    if (result.meta.showGuideUnit) {
      toolStore.setShowGuideUnit(true)
    }
    emit('close')
  } catch (caughtError) {
    if (caughtError instanceof Error && caughtError.name === 'AbortError') return
    localError.value = error.value || 'AI 분석에 실패했습니다.'
  }
}

function closeModal() {
  abortAnalysis()
  emit('close')
}

onMounted(async () => {
  await nextTick()
  resetDrawCanvas()
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="closeModal">
    <div class="relative flex max-h-[calc(100vh-2rem)] w-[960px] max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
      <!-- 헤더 -->
      <div class="shrink-0 border-b border-gray-200 px-5 py-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold text-gray-900">AI 스케치 변환</h2>
            <p class="mt-1 text-xs text-gray-500">도형 타입을 고른 뒤 직접 그리거나 이미지를 넣어 편집 가능한 도형으로 변환하세요.</p>
          </div>
          <button class="h-8 w-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" @click="closeModal">×</button>
        </div>
      </div>

      <!-- 본문: 좌(캔버스) + 우(설정/힌트) 2열 -->
      <div class="flex flex-1 overflow-hidden">

        <!-- 좌: 탭 + 캔버스/이미지 -->
        <div class="flex flex-1 flex-col overflow-y-auto border-r border-gray-100 px-5 py-4">
          <!-- 탭 -->
          <div class="inline-flex rounded-lg bg-gray-100 p-1 self-start">
            <button
              class="rounded-md px-3 py-1.5 text-sm transition"
              :class="tab === 'draw' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'"
              @click="tab = 'draw'"
            >직접 그리기</button>
            <button
              class="rounded-md px-3 py-1.5 text-sm transition"
              :class="tab === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'"
              @click="tab = 'upload'"
            >이미지 업로드</button>
          </div>

          <!-- 그리기 캔버스 -->
          <div v-if="tab === 'draw'" class="mt-3 flex flex-1 flex-col rounded-2xl border border-gray-200 bg-white p-3">
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button
                  class="rounded-lg border px-3 py-1.5 text-sm transition"
                  :class="drawMode === 'pencil' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
                  @click="drawMode = 'pencil'"
                >펜</button>
                <button
                  class="rounded-lg border px-3 py-1.5 text-sm transition"
                  :class="drawMode === 'eraser' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'"
                  @click="drawMode = 'eraser'"
                >지우개</button>
              </div>
              <div class="flex items-center gap-2">
                <button class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" :disabled="drawHistory.length === 0" @click="undoDraw">실행 취소</button>
                <button class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" @click="resetDrawCanvas">전체 지우기</button>
              </div>
            </div>
            <canvas
              ref="drawCanvasRef"
              width="640"
              height="360"
              class="aspect-[16/9] w-full touch-none rounded-xl border border-gray-200 bg-white cursor-crosshair"
              style="background-image: radial-gradient(circle, rgba(148, 163, 184, 0.55) 1px, transparent 1px); background-size: 20px 20px;"
              @pointerdown="startStroke"
              @pointermove="moveStroke"
              @pointerup="finishStroke"
              @pointerleave="finishStroke"
              @pointercancel="finishStroke"
            />
          </div>

          <!-- 이미지 업로드 -->
          <div
            v-else
            class="mt-3 flex flex-1 flex-col rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4"
            @dragover.prevent
            @drop="handleDrop"
          >
            <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleFileChange">
            <div v-if="uploadedImageDataUrl" class="space-y-3">
              <div class="flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
                <img :src="uploadedImageDataUrl" :alt="uploadedFileName || '업로드 이미지'" class="h-full w-full object-contain">
              </div>
              <div class="flex items-center justify-between">
                <p class="truncate text-sm text-gray-600">{{ uploadedFileName }}</p>
                <button class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" @click="openFilePicker">이미지 교체</button>
              </div>
            </div>
            <button
              v-else
              class="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-500 transition hover:bg-gray-50"
              @click="openFilePicker"
            >이미지를 드래그하거나 클릭해서 업로드</button>
          </div>
        </div>

        <!-- 우: 도형 타입 + 힌트 -->
        <div class="flex w-72 shrink-0 flex-col overflow-y-auto px-5 py-4">
          <!-- 도형 타입 선택 -->
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500">도형 타입</label>
            <select
              v-model="selectedShapeType"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
            >
              <option value="">선택</option>
              <option v-for="option in shapeTypeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <div v-if="!selectedShapeType" class="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-6 text-center">
            <p class="text-xs font-semibold text-blue-900">도형 타입을 선택하면<br>힌트 가이드가 표시됩니다</p>
          </div>

          <template v-else>
            <!-- 추가 힌트 -->
            <div class="mt-4 flex flex-1 flex-col">
              <div class="flex items-baseline justify-between">
                <label class="block text-xs font-medium text-gray-700">추가 힌트</label>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="text-[11px] text-blue-500 hover:text-blue-700 hover:underline"
                    @click="userHint = hintExample"
                  >예시 불러오기</button>
                  <button
                    v-if="userHint"
                    type="button"
                    class="text-[11px] text-gray-400 hover:text-gray-600 hover:underline"
                    @click="userHint = ''"
                  >초기화</button>
                </div>
              </div>
              <p class="mt-0.5 text-[11px] text-gray-400">구체적으로 적을수록 정확도가 높아집니다.</p>
              <textarea
                v-model.trim="userHint"
                rows="5"
                class="mt-2 w-full flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
                :placeholder="hintExample"
              />
              <!-- 힌트 팁 -->
              <div class="mt-2 rounded-lg bg-gray-50 px-3 py-2.5 text-[11px] text-gray-500 leading-relaxed">
                <p class="font-medium text-gray-600 mb-1">포함하면 좋은 정보</p>
                <p>① 꼭짓점 이름 (ㄱ,ㄴ,ㄷ 또는 A,B,C)</p>
                <p>② 어느 변에 길이를 표시할지</p>
                <p class="pl-2 text-gray-400">예: ㄱ-ㄷ 변에만</p>
                <p>③ 각도값과 빈칸 위치</p>
                <p class="pl-2 text-gray-400">예: ㄴ의 각도만 빈칸</p>
                <template v-if="showHeightTip">
                  <p>④ 높이 표시 여부 <span class="text-gray-400">(이등변·정삼각형·사다리꼴·평행사변형)</span></p>
                  <p class="pl-2 text-gray-400">예: 높이 자동계산해서 표시</p>
                </template>
              </div>
            </div>
          </template>

          <p v-if="localError || error" class="mt-3 text-sm text-red-600">{{ localError || error }}</p>
        </div>
      </div>

      <div class="shrink-0 flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-4">
        <p class="text-xs text-gray-500">그림이 선명하고 표기가 분명할수록 변환 정확도가 좋아집니다.</p>
        <div class="flex items-center gap-2">
          <button class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="closeModal">취소</button>
          <button
            class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition"
            :class="!canAnalyze || isAnalyzing ? 'cursor-not-allowed bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-500'"
            :disabled="!canAnalyze || isAnalyzing"
            @click="handleAnalyze"
          >
            <span v-if="isAnalyzing" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {{ isAnalyzing ? '분석 중...' : 'AI로 변환하기' }}
          </button>
        </div>
      </div>

      <div v-if="isAnalyzing" class="absolute inset-0 flex items-center justify-center bg-white/72 backdrop-blur-[1px]">
        <div class="flex flex-col items-center gap-3 rounded-2xl border border-blue-100 bg-white px-6 py-5 shadow-lg">
          <div class="h-10 w-10 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600" />
          <div class="text-center">
            <p class="text-sm font-semibold text-gray-900">AI가 스케치를 분석하고 있습니다</p>
            <p class="mt-1 text-xs text-gray-500">도형 구조와 길이, 각도, 점 이름을 정리하는 중입니다.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
