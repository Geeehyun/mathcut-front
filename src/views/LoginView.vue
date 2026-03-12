<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const tab = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const nickname = ref('')
const errorMsg = ref('')
const loading = ref(false)

function resetForm() {
  email.value = ''
  password.value = ''
  nickname.value = ''
  errorMsg.value = ''
}

function switchTab(t: 'login' | 'register') {
  tab.value = t
  resetForm()
}

async function handleLogin() {
  if (!email.value || !password.value) {
    errorMsg.value = '이메일과 비밀번호를 입력해주세요.'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await auth.login(email.value, password.value)
    router.push('/library')
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '로그인에 실패했습니다.'
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  if (!email.value || !password.value || !nickname.value) {
    errorMsg.value = '모든 항목을 입력해주세요.'
    return
  }
  if (password.value.length < 8) {
    errorMsg.value = '비밀번호는 8자 이상이어야 합니다.'
    return
  }
  if (nickname.value.length < 2 || nickname.value.length > 20) {
    errorMsg.value = '닉네임은 2~20자여야 합니다.'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    await auth.register(email.value, password.value, nickname.value)
    switchTab('login')
    errorMsg.value = ''
    // 성공 안내는 로그인 탭에서 보여주기 위해 특별 처리
    successMsg.value = '가입되었습니다! 로그인해주세요.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '회원가입에 실패했습니다.'
  } finally {
    loading.value = false
  }
}

const successMsg = ref('')
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">

      <!-- 로고 -->
      <div class="flex items-center justify-center gap-2 mb-8">
        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
          <span class="text-white text-lg font-bold">M</span>
        </div>
        <span class="text-2xl font-bold text-white">MathCut</span>
      </div>

      <!-- 카드 -->
      <div class="bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">

        <!-- 탭 -->
        <div class="flex border-b border-gray-100">
          <button
            class="flex-1 py-3.5 text-sm font-semibold transition"
            :class="tab === 'login'
              ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
              : 'text-gray-400 hover:text-gray-600'"
            @click="switchTab('login')"
          >로그인</button>
          <button
            class="flex-1 py-3.5 text-sm font-semibold transition"
            :class="tab === 'register'
              ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
              : 'text-gray-400 hover:text-gray-600'"
            @click="switchTab('register')"
          >회원가입</button>
        </div>

        <!-- 폼 -->
        <form class="p-6 space-y-4" @submit.prevent="tab === 'login' ? handleLogin() : handleRegister()">

          <!-- 성공 메시지 (회원가입 후) -->
          <p v-if="successMsg && tab === 'login'" class="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
            {{ successMsg }}
          </p>

          <!-- 에러 메시지 -->
          <p v-if="errorMsg" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {{ errorMsg }}
          </p>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">이메일</label>
            <input
              v-model="email"
              type="email"
              placeholder="example@email.com"
              autocomplete="email"
              class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
            />
          </div>

          <div v-if="tab === 'register'">
            <label class="block text-xs font-medium text-gray-600 mb-1">닉네임</label>
            <input
              v-model="nickname"
              type="text"
              placeholder="2~20자"
              autocomplete="nickname"
              class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">비밀번호</label>
            <input
              v-model="password"
              type="password"
              placeholder="8자 이상"
              autocomplete="current-password"
              class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700
                   text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/25
                   transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading" class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 align-middle"></span>
            {{ tab === 'login' ? '로그인' : '가입하기' }}
          </button>

        </form>
      </div>

      <p class="text-center mt-4">
        <router-link to="/editor" class="text-sm text-gray-400 hover:text-gray-200 transition">
          ← 로그인 없이 에디터 사용하기
        </router-link>
      </p>

    </div>
  </div>
</template>
