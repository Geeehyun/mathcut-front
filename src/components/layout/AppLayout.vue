<script setup lang="ts">
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import AppFooter from './AppFooter.vue'

const props = defineProps<{
  noChrome?: boolean
}>()
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- 헤더 -->
    <AppHeader v-if="!props.noChrome" />

    <!-- 메인 콘텐츠: 사이드바가 absolute로 캔버스 위에 떠있음 -->
    <div class="flex-1 relative overflow-hidden">
      <!-- 사이드바 (절대 위치, 캔버스 위에 floating) -->
      <AppSidebar />

      <!-- 캔버스 영역: 전체 너비 사용 -->
      <main class="absolute inset-0">
        <slot />
      </main>
    </div>

    <!-- 푸터 -->
    <AppFooter v-if="!props.noChrome" />
  </div>
</template>
