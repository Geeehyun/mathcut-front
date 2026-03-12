<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCutStore, type CutListItem } from '@/composables/useCutStore'

const router = useRouter()
const auth = useAuthStore()
const cutStore = useCutStore()

type CutItem = CutListItem & {
  thumbnailUrl: string | null
}

const cuts = ref<CutItem[]>([])
const loading = ref(false)
const error = ref('')

// 유저 드롭다운
const dropdownOpen = ref(false)

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown() {
  dropdownOpen.value = false
}

async function handleLogout() {
  closeDropdown()
  await auth.logout()
  await router.replace('/login')
}

function goToNewEditor() {
  router.push('/editor')
}

function goToEditor(cutId: number) {
  router.push(`/editor/${cutId}`)
}

async function loadCuts() {
  loading.value = true
  error.value = ''
  try {
    const items = await cutStore.fetchCuts()
    cuts.value = items.map((cut) => ({
      ...cut,
      thumbnailUrl: cut.thumbnail,
    }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '불러오기 실패'
  } finally {
    loading.value = false
  }
}

async function deleteCut(id: number) {
  if (!confirm('컷을 삭제하시겠습니까?')) return
  try {
    await cutStore.deleteCut(id)
    cuts.value = cuts.value.filter(c => c.id !== id)
  } catch (e) {
    alert(e instanceof Error ? e.message : '삭제 실패')
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

onMounted(() => {
  loadCuts()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">

    <!-- 헤더 -->
    <header class="relative shrink-0 h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 z-50 shadow-sm">

      <!-- 로고 -->
      <div class="flex items-center gap-2 mr-4">
        <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow shadow-blue-500/30">
          <span class="text-white text-sm font-bold">M</span>
        </div>
        <span class="text-base font-bold text-slate-800">MathCut</span>
      </div>

      <div class="flex-1"></div>

      <!-- 새 컷 만들기 -->
      <button
        class="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition font-medium shadow shadow-blue-500/20"
        @click="goToNewEditor"
      >
        <span class="text-base leading-none">+</span>
        새 컷 만들기
      </button>

      <!-- 유저 드롭다운 -->
      <div class="relative">
        <button
          class="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full hover:bg-slate-100 transition"
          @click="toggleDropdown"
        >
          <div class="w-7 h-7 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center shrink-0">
            <span class="text-white text-xs font-semibold">{{ auth.nickname?.charAt(0).toUpperCase() ?? 'U' }}</span>
          </div>
          <span class="text-sm font-medium text-slate-700 max-w-[6rem] truncate">{{ auth.nickname }}</span>
          <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        <!-- 드롭다운 메뉴 -->
        <div
          v-if="dropdownOpen"
          class="absolute right-0 top-11 w-44 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/80 py-1 z-50"
          @click.stop
        >
          <button
            class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition"
            @click="handleLogout"
          >로그아웃</button>
        </div>
      </div>
    </header>

    <!-- 드롭다운 외부 클릭 닫기 -->
    <div v-if="dropdownOpen" class="fixed inset-0 z-40" @click="closeDropdown"></div>

    <!-- 메인 콘텐츠 -->
    <main class="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">

      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-slate-800">내 컷 보관함</h1>
        <span class="text-sm text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">{{ cuts.length }}개</span>
      </div>

      <!-- 로딩 -->
      <div v-if="loading" class="flex justify-center py-24">
        <div class="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>

      <!-- 에러 -->
      <div v-else-if="error" class="text-center py-24">
        <p class="text-slate-400 text-sm">{{ error }}</p>
        <button class="mt-3 text-sm text-blue-500 hover:text-blue-600 underline" @click="loadCuts">다시 시도</button>
      </div>

      <!-- 빈 상태 -->
      <div v-else-if="cuts.length === 0" class="flex flex-col items-center justify-center py-24 gap-4">
        <div class="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl flex items-center justify-center shadow-inner">
          <span class="text-4xl">📐</span>
        </div>
        <div class="text-center">
          <p class="text-slate-600 font-medium">아직 저장된 컷이 없어요</p>
          <p class="text-slate-400 text-sm mt-1">에디터에서 작업하고 저장해보세요.</p>
        </div>
        <button
          class="text-sm bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition font-medium shadow shadow-blue-500/20"
          @click="goToNewEditor"
        >첫 번째 컷 만들기</button>
      </div>

      <!-- 컷 그리드 -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="cut in cuts"
          :key="cut.id"
          class="group bg-white border border-slate-200 rounded-xl overflow-hidden
                 hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/10
                 transition-all duration-150 cursor-pointer"
          @click="goToEditor(cut.id)"
        >
          <!-- 썸네일 -->
          <div class="aspect-video bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
            <img
              v-if="cut.thumbnailUrl"
              :src="cut.thumbnailUrl"
              :alt="cut.title"
              class="w-full h-full object-cover"
            />
            <span v-else class="text-slate-300 text-4xl select-none">📐</span>
          </div>

          <!-- 정보 + 삭제 -->
          <div class="px-3 py-2.5 flex items-start justify-between gap-2 border-t border-slate-100">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-700 truncate">{{ cut.title || '제목 없음' }}</p>
              <p class="text-xs text-slate-400 mt-0.5">{{ formatDate(cut.updatedAt) }}</p>
            </div>
            <button
              class="shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center
                     text-slate-300 hover:text-red-400 hover:bg-red-50 rounded transition mt-0.5"
              title="삭제"
              @click.stop="deleteCut(cut.id)"
            >✕</button>
          </div>
        </div>
      </div>

    </main>
  </div>
</template>
