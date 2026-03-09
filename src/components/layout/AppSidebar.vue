<script setup lang="ts">
import { ref, computed, type ComponentPublicInstance } from 'vue'
import { useToolStore } from '@/stores/tool'
import { useCanvasStore } from '@/stores/canvas'
import type { ShapeType, GuideType } from '@/types'

const toolStore = useToolStore()
const canvasStore = useCanvasStore()

// 현재 열린 플라이아웃 카테고리
const openFlyout = ref<string | null>(null)
let closeFlyoutTimer: number | null = null
const flyoutAnchors = ref<Record<string, HTMLElement | null>>({})

function clearCloseFlyoutTimer() {
  if (closeFlyoutTimer !== null) {
    window.clearTimeout(closeFlyoutTimer)
    closeFlyoutTimer = null
  }
}

function scheduleCloseFlyout() {
  clearCloseFlyoutTimer()
  closeFlyoutTimer = window.setTimeout(() => {
    openFlyout.value = null
    closeFlyoutTimer = null
  }, 120)
}

function toggleFlyout(key: string) {
  openFlyout.value = openFlyout.value === key ? null : key
}

function openFlyoutOnHover(key: string) {
  clearCloseFlyoutTimer()
  openFlyout.value = key
}

function setFlyoutAnchor(key: string, el: Element | ComponentPublicInstance | null) {
  flyoutAnchors.value[key] = (el as HTMLElement | null) ?? null
}

function getFlyoutStyle(key: string) {
  const top = flyoutAnchors.value[key]?.offsetTop ?? 0
  return { top: `${top}px` }
}

function closeFlyout() {
  clearCloseFlyoutTimer()
  openFlyout.value = null
}

// 도형 도구 선택 → 플라이아웃 자동 닫힘
function selectShape(type: ShapeType) {
  toolStore.setMode('shape')
  toolStore.setShapeType(type)
  closeFlyout()
}

// 가이드 도구 선택 → 플라이아웃 자동 닫힘
function selectGuide(type: GuideType) {
  toolStore.setMode('guide')
  toolStore.setGuideType(type)
  closeFlyout()
}

function isShapeActive(type: ShapeType) {
  return toolStore.mode === 'shape' && toolStore.shapeType === type
}

function isGuideActive(type: GuideType) {
  return toolStore.mode === 'guide' && toolStore.guideType === type
}

// 카테고리별 활성 여부 (점 표시용)
const activeCategoryKey = computed(() => {
  if (toolStore.mode === 'select') return 'select'
  if (toolStore.mode === 'guide') return 'misc'
  const t = toolStore.shapeType
  if (t === 'point' || t === 'point-on-object') return 'point'
  if (t === 'segment' || t === 'ray' || t === 'line' || t === 'angle-line') return 'line'
  if (t.startsWith('triangle')) return 'triangle'
  if (t.startsWith('rect') || t === 'rectangle') return 'rect'
  if (t === 'polygon-regular' || t === 'polygon' || t === 'circle' || t === 'free-shape') return 'poly'
  if (t === 'arrow' || t === 'arrow-curve') return 'misc'
  return null
})

// 격자 모드 아이콘/레이블
const gridModeMeta = computed(() => {
  if (toolStore.gridMode === 'grid') return { icon: '▦', label: '격자' }
  if (toolStore.gridMode === 'dots') return { icon: '∙∙', label: '점판' }
  return { icon: '□', label: '백지' }
})

</script>

<template>
  <!-- 툴박스 + 플라이아웃 컨테이너 -->
  <div class="absolute left-0 top-10 bottom-8 z-20 flex pointer-events-none">

    <!-- 툴박스 본체 (w-14 = 56px) -->
    <aside
      class="h-full w-14 bg-gray-900 flex flex-col items-center py-2 gap-0.5 select-none shadow-2xl pointer-events-auto shrink-0"
      @mouseenter="clearCloseFlyoutTimer"
      @mouseleave="scheduleCloseFlyout"
    >

      <!-- 선택/이동 -->
      <button
        class="tool-btn"
        :class="[activeCategoryKey === 'select' ? 'tool-btn-active' : 'tool-btn-default']"
        @click="toolStore.setMode('select'); closeFlyout()"
        title="선택/이동 (V)"
      >
        <span class="text-base leading-none">↖</span>
        <span class="tool-label">선택</span>
        <span v-if="activeCategoryKey === 'select'" class="active-dot"></span>
      </button>

      <!-- 점 -->
      <button
        :ref="(el) => setFlyoutAnchor('point', el)"
        class="tool-btn"
        :class="[activeCategoryKey === 'point' ? 'tool-btn-active' : 'tool-btn-default', openFlyout === 'point' ? 'tool-btn-open' : '']"
        @click="toggleFlyout('point')"
        @mouseenter="openFlyoutOnHover('point')"
        title="점"
      >
        <span class="text-xl leading-none">·</span>
        <span class="tool-label">점</span>
        <span v-if="activeCategoryKey === 'point'" class="active-dot"></span>
      </button>

      <!-- 선 -->
      <button
        :ref="(el) => setFlyoutAnchor('line', el)"
        class="tool-btn"
        :class="[activeCategoryKey === 'line' ? 'tool-btn-active' : 'tool-btn-default', openFlyout === 'line' ? 'tool-btn-open' : '']"
        @click="toggleFlyout('line')"
        @mouseenter="openFlyoutOnHover('line')"
        title="선"
      >
        <span class="text-base leading-none">—</span>
        <span class="tool-label">선</span>
        <span v-if="activeCategoryKey === 'line'" class="active-dot"></span>
      </button>

      <!-- 삼각형 -->
      <button
        :ref="(el) => setFlyoutAnchor('triangle', el)"
        class="tool-btn"
        :class="[activeCategoryKey === 'triangle' ? 'tool-btn-active' : 'tool-btn-default', openFlyout === 'triangle' ? 'tool-btn-open' : '']"
        @click="toggleFlyout('triangle')"
        @mouseenter="openFlyoutOnHover('triangle')"
        title="삼각형"
      >
        <span class="text-base leading-none">△</span>
        <span class="tool-label">삼각형</span>
        <span v-if="activeCategoryKey === 'triangle'" class="active-dot"></span>
      </button>

      <!-- 사각형 -->
      <button
        :ref="(el) => setFlyoutAnchor('rect', el)"
        class="tool-btn"
        :class="[activeCategoryKey === 'rect' ? 'tool-btn-active' : 'tool-btn-default', openFlyout === 'rect' ? 'tool-btn-open' : '']"
        @click="toggleFlyout('rect')"
        @mouseenter="openFlyoutOnHover('rect')"
        title="사각형"
      >
        <span class="text-base leading-none">□</span>
        <span class="tool-label">사각형</span>
        <span v-if="activeCategoryKey === 'rect'" class="active-dot"></span>
      </button>

      <!-- 다각형·원 -->
      <button
        :ref="(el) => setFlyoutAnchor('poly', el)"
        class="tool-btn"
        :class="[activeCategoryKey === 'poly' ? 'tool-btn-active' : 'tool-btn-default', openFlyout === 'poly' ? 'tool-btn-open' : '']"
        @click="toggleFlyout('poly')"
        @mouseenter="openFlyoutOnHover('poly')"
        title="다각형·원"
      >
        <span class="text-base leading-none">⬡</span>
        <span class="tool-label">다각형</span>
        <span v-if="activeCategoryKey === 'poly'" class="active-dot"></span>
      </button>

      <!-- 기타 (텍스트·화살표) -->
      <button
        :ref="(el) => setFlyoutAnchor('misc', el)"
        class="tool-btn"
        :class="[activeCategoryKey === 'misc' ? 'tool-btn-active' : 'tool-btn-default', openFlyout === 'misc' ? 'tool-btn-open' : '']"
        @click="toggleFlyout('misc')"
        @mouseenter="openFlyoutOnHover('misc')"
        title="기타"
      >
        <span class="text-base leading-none">T</span>
        <span class="tool-label">기타</span>
        <span v-if="activeCategoryKey === 'misc'" class="active-dot"></span>
      </button>

      <div class="w-8 border-t border-gray-700 my-1"></div>

      <!-- 격자 모드 순환 버튼 -->
      <button
        :ref="(el) => setFlyoutAnchor('grid', el)"
        class="tool-btn tool-btn-default"
        @click="toolStore.cycleGridMode()"
        @mouseenter="openFlyoutOnHover('grid')"
        :title="`모눈종이: ${gridModeMeta.label} (클릭하여 전환)`"
      >
        <span class="text-sm font-bold leading-none">{{ gridModeMeta.icon }}</span>
        <span class="tool-label">{{ gridModeMeta.label }}</span>
      </button>

      <!-- 스페이서 -->
      <div class="flex-1"></div>

      <div class="w-8 border-t border-gray-700 my-1"></div>

      <!-- 실행취소 -->
      <button
        class="tool-btn tool-btn-default"
        :class="!canvasStore.canUndo ? 'opacity-30 cursor-not-allowed' : ''"
        :disabled="!canvasStore.canUndo"
        @click="canvasStore.undo()"
        title="실행취소"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        <span class="tool-label">취소</span>
      </button>

      <!-- 전체 초기화 -->
      <button
        class="tool-btn hover:bg-red-900/40 hover:text-red-400 text-gray-500"
        @click="canvasStore.clearAll(); toolStore.clearTempPoints()"
        title="전체 초기화"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span class="tool-label">초기화</span>
      </button>

    </aside>

    <!-- ========== 플라이아웃 패널들 ========== -->

    <!-- 격자 플라이아웃 -->
    <div
      v-if="openFlyout === 'grid'"
      class="flyout pointer-events-auto"
      :style="getFlyoutStyle('grid')"
      @mouseenter="clearCloseFlyoutTimer"
      @mouseleave="scheduleCloseFlyout"
    >
      <p class="flyout-title">모눈종이</p>
      <div class="grid grid-cols-3 gap-1.5">
        <button class="sub-btn" :class="toolStore.gridMode === 'grid' ? 'sub-btn-active' : 'sub-btn-default'" @click="toolStore.setGridMode('grid'); closeFlyout()">
          <span class="text-base">▦</span><span class="text-xs">격자</span>
        </button>
        <button class="sub-btn" :class="toolStore.gridMode === 'dots' ? 'sub-btn-active' : 'sub-btn-default'" @click="toolStore.setGridMode('dots'); closeFlyout()">
          <span class="text-base">∙∙</span><span class="text-xs">점판</span>
        </button>
        <button class="sub-btn" :class="toolStore.gridMode === 'none' ? 'sub-btn-active' : 'sub-btn-default'" @click="toolStore.setGridMode('none'); closeFlyout()">
          <span class="text-base">□</span><span class="text-xs">백지</span>
        </button>
      </div>
      <p class="text-[11px] text-gray-400 px-1 mt-1">버튼 클릭 시에도 순환 전환됩니다.</p>
    </div>

    <!-- 점 플라이아웃 -->
    <div
      v-if="openFlyout === 'point'"
      class="flyout pointer-events-auto"
      :style="getFlyoutStyle('point')"
      @mouseenter="clearCloseFlyoutTimer"
      @mouseleave="scheduleCloseFlyout"
    >
      <p class="flyout-title">점</p>
      <div class="grid grid-cols-2 gap-1.5">
        <button class="sub-btn" :class="isShapeActive('point') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('point')">
          <span class="text-lg">·</span><span class="text-xs">점</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('point-on-object') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('point-on-object')">
          <span class="text-lg">·</span><span class="text-xs">대상 위의 점</span>
        </button>
      </div>
    </div>

    <!-- 선 플라이아웃 -->
    <div
      v-if="openFlyout === 'line'"
      class="flyout pointer-events-auto"
      :style="getFlyoutStyle('line')"
      @mouseenter="clearCloseFlyoutTimer"
      @mouseleave="scheduleCloseFlyout"
    >
      <p class="flyout-title">선</p>
      <div class="grid grid-cols-2 gap-1.5">
        <button class="sub-btn" :class="isShapeActive('segment') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('segment')">
          <span class="text-lg">—</span><span class="text-xs">선분</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('ray') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('ray')">
          <span class="text-lg">→</span><span class="text-xs">반직선</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('line') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('line')">
          <span class="text-lg">↔</span><span class="text-xs">직선</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('angle-line') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('angle-line')">
          <span class="text-lg">∠</span><span class="text-xs">각</span>
        </button>
      </div>
    </div>

    <!-- 삼각형 플라이아웃 -->
    <div
      v-if="openFlyout === 'triangle'"
      class="flyout pointer-events-auto"
      :style="getFlyoutStyle('triangle')"
      @mouseenter="clearCloseFlyoutTimer"
      @mouseleave="scheduleCloseFlyout"
    >
      <p class="flyout-title">삼각형</p>
      <div class="grid grid-cols-2 gap-1.5">
        <button class="sub-btn" :class="isShapeActive('triangle-equilateral') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('triangle-equilateral')">
          <span class="text-lg">△</span><span class="text-xs">정삼각형</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('triangle-right') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('triangle-right')">
          <span class="text-lg">◺</span><span class="text-xs">직각삼각형</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('triangle-isosceles') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('triangle-isosceles')">
          <span class="text-lg">▲</span><span class="text-xs">이등변삼각형</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('triangle') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('triangle')">
          <span class="text-lg">△</span><span class="text-xs">자유로운 삼각형</span>
        </button>
      </div>
    </div>

    <!-- 사각형 플라이아웃 -->
    <div
      v-if="openFlyout === 'rect'"
      class="flyout pointer-events-auto"
      :style="getFlyoutStyle('rect')"
      @mouseenter="clearCloseFlyoutTimer"
      @mouseleave="scheduleCloseFlyout"
    >
      <p class="flyout-title">사각형</p>
      <div class="grid grid-cols-2 gap-1.5">
        <button class="sub-btn" :class="isShapeActive('rect-square') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('rect-square')">
          <span class="text-lg">■</span><span class="text-xs">정사각형</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('rect-rectangle') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('rect-rectangle')">
          <span class="text-lg">□</span><span class="text-xs">직사각형</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('rect-trapezoid') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('rect-trapezoid')">
          <span class="text-lg">⏢</span><span class="text-xs">사다리꼴</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('rect-rhombus') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('rect-rhombus')">
          <span class="text-lg">◇</span><span class="text-xs">마름모</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('rect-parallelogram') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('rect-parallelogram')">
          <span class="text-lg">▱</span><span class="text-xs">평행사변형</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('rect-free') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('rect-free')">
          <span class="text-lg">⬜</span><span class="text-xs">자유로운 사각형</span>
        </button>
      </div>
    </div>

    <!-- 다각형·원 플라이아웃 -->
    <div
      v-if="openFlyout === 'poly'"
      class="flyout pointer-events-auto"
      :style="getFlyoutStyle('poly')"
      @mouseenter="clearCloseFlyoutTimer"
      @mouseleave="scheduleCloseFlyout"
    >
      <p class="flyout-title">다각형 · 원</p>
      <div class="space-y-2">
        <!-- 정다각형 (변 개수 입력) -->
        <div class="flex items-center gap-1.5">
          <button class="sub-btn flex-1" :class="isShapeActive('polygon-regular') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('polygon-regular')">
            <span class="text-lg">⬡</span><span class="text-xs">정다각형</span>
          </button>
          <div class="flex items-center gap-1">
            <input
              type="number"
              :value="toolStore.polygonSides"
              @input="toolStore.setPolygonSides(Number(($event.target as HTMLInputElement).value))"
              min="3" max="12"
              class="w-10 text-xs text-center border border-gray-300 rounded-lg px-1 py-1.5 focus:outline-none focus:border-blue-400"
              title="변 개수"
            />
            <span class="text-xs text-gray-400">변</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          <button class="sub-btn" :class="isShapeActive('polygon') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('polygon')">
            <span class="text-lg">⟡</span><span class="text-xs">자유 도형</span>
          </button>
          <button class="sub-btn" :class="isShapeActive('circle') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('circle')">
            <span class="text-lg">○</span><span class="text-xs">원</span>
          </button>
        </div>
        <!-- 입체도형 (2차) -->
        <div class="border-t border-gray-100 pt-2">
          <p class="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
            입체도형
            <span class="badge-soon">준비중</span>
          </p>
          <div class="grid grid-cols-2 gap-1">
            <button class="sub-btn sub-btn-disabled" disabled v-for="label in ['직육면체','정육면체','각기둥','각뿔']" :key="label">
              <span class="text-xs">{{ label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 기타 플라이아웃 -->
    <div
      v-if="openFlyout === 'misc'"
      class="flyout pointer-events-auto"
      :style="getFlyoutStyle('misc')"
      @mouseenter="clearCloseFlyoutTimer"
      @mouseleave="scheduleCloseFlyout"
    >
      <p class="flyout-title">기타</p>
      <div class="grid grid-cols-2 gap-1.5">
        <button class="sub-btn" :class="isGuideActive('text') ? 'sub-btn-guide-active' : 'sub-btn-default'" @click="selectGuide('text')">
          <span class="text-lg">T</span><span class="text-xs">텍스트</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('arrow') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('arrow')">
          <span class="text-lg">↗</span><span class="text-xs">화살표(직선)</span>
        </button>
        <button class="sub-btn" :class="isShapeActive('arrow-curve') ? 'sub-btn-active' : 'sub-btn-default'" @click="selectShape('arrow-curve')">
          <span class="text-lg">⤳</span><span class="text-xs">화살표(곡선)</span>
        </button>
        <button class="sub-btn sub-btn-disabled col-span-2" disabled>
          <span class="text-lg">123</span><span class="text-xs">수 모형</span>
          <span class="badge-soon">준비중</span>
        </button>
      </div>
      <!-- AI 삽화 (2차) -->
      <div class="border-t border-gray-100 pt-2 mt-2">
        <button class="sub-btn sub-btn-disabled w-full" disabled>
          <span class="text-xs text-gray-400 flex items-center gap-1">
            AI 삽화 생성
            <span class="badge-soon">준비중</span>
          </span>
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.tool-btn {
  @apply w-12 h-12 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all duration-150 relative cursor-pointer;
}
.tool-btn-default {
  @apply text-gray-400 hover:bg-gray-700 hover:text-gray-100;
}
.tool-btn-active {
  @apply bg-blue-600/20 text-blue-400;
}
.tool-btn-open {
  @apply bg-gray-700 text-gray-100;
}
.tool-label {
  @apply text-[9px] leading-none text-center;
}
.active-dot {
  @apply absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-400;
}

/* 플라이아웃 패널 */
.flyout {
  @apply absolute left-14 top-0 w-52 bg-white shadow-2xl border-r border-gray-200 p-3 space-y-2 overflow-y-auto z-30;
  max-height: 100%;
}
.flyout-title {
  @apply text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1;
}

/* 서브 버튼 */
.sub-btn {
  @apply flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all duration-200 relative;
}
.sub-btn-default {
  @apply border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600;
}
.sub-btn-active {
  @apply border-blue-500 bg-blue-50 text-blue-700 shadow-lg shadow-blue-500/20;
}
.sub-btn-guide-active {
  @apply border-orange-400 bg-orange-50 text-orange-700 shadow-lg shadow-orange-400/20;
}
.sub-btn-disabled {
  @apply border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-60;
}
.badge-soon {
  @apply absolute top-1 right-1 text-[9px] bg-gray-200 text-gray-400 rounded px-1 leading-tight;
}
</style>
