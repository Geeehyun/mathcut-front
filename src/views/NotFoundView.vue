<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

function goHome() {
  router.push(auth.isLoggedIn ? '/library' : '/editor')
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 p-4">
    <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
      <span class="text-white text-2xl font-bold">M</span>
    </div>
    <div class="text-center">
      <p class="text-6xl font-bold text-gray-700 mb-3">404</p>
      <p class="text-gray-400 text-sm">페이지를 찾을 수 없습니다.</p>
    </div>
    <button
      class="text-sm bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg transition font-medium"
      @click="goHome"
    >홈으로 돌아가기</button>
  </div>
</template>
