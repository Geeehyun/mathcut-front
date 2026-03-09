<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="h-12 bg-white border-t border-gray-200 px-6 flex items-center justify-between text-sm text-gray-500">
    <div class="flex items-center gap-4">
      <span>© {{ currentYear }} MathCut</span>
      <span class="text-gray-300">|</span>
      <a href="#" class="hover:text-gray-700 transition">이용약관</a>
      <a href="#" class="hover:text-gray-700 transition">개인정보처리방침</a>
    </div>

    <div class="flex items-center gap-4">
      <a href="#" class="hover:text-gray-700 transition">문의하기</a>
      <span class="text-gray-300">|</span>
      <span class="text-gray-400">v0.1.0</span>
    </div>
  </footer>
</template>
