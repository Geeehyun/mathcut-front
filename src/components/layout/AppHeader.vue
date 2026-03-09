<script setup lang="ts">
import { ref } from 'vue'

const isUserMenuOpen = ref(false)
</script>

<template>
  <header class="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm">
    <!-- 로고 & 네비게이션 -->
    <div class="flex items-center gap-8">
      <!-- 로고 -->
      <div class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition">
        <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
          <span class="text-white text-lg font-bold">M</span>
        </div>
        <span class="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          MathCut
        </span>
      </div>

      <!-- 메인 네비게이션 -->
      <nav class="hidden md:flex items-center gap-1">
        <a href="#" class="px-4 py-2 text-gray-900 bg-blue-50 rounded-lg font-medium text-sm">
          에디터
        </a>
        <a href="#" class="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg font-medium text-sm transition">
          내 작업
        </a>
        <a href="#" class="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg font-medium text-sm transition">
          템플릿
        </a>
        <a href="#" class="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg font-medium text-sm transition">
          도움말
        </a>
      </nav>
    </div>

    <!-- 우측 액션 -->
    <div class="flex items-center gap-3">
      <!-- 새 프로젝트 버튼 -->
      <button class="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium text-sm hover:from-blue-600 hover:to-indigo-700 transition shadow-lg shadow-blue-500/25">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        새 프로젝트
      </button>

      <!-- 알림 -->
      <button class="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
      </button>

      <!-- 유저 메뉴 -->
      <div class="relative">
        <button
          @click="isUserMenuOpen = !isUserMenuOpen"
          class="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-lg transition"
        >
          <div class="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center">
            <span class="text-white text-sm font-medium">U</span>
          </div>
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- 드롭다운 메뉴 -->
        <div
          v-if="isUserMenuOpen"
          class="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
        >
          <a href="#" class="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            내 프로필
          </a>
          <a href="#" class="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            설정
          </a>
          <hr class="my-2 border-gray-100">
          <a href="#" class="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 text-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            로그아웃
          </a>
        </div>
      </div>
    </div>
  </header>
</template>
