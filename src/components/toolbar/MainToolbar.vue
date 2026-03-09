<script setup lang="ts">
const props = defineProps<{
  cutIndex: number
  cutCount: number
  zoom: number
  exportFormat: 'png' | 'svg'
  exportWidth: number
  exportHeight: number
}>()

const emit = defineEmits<{
  'add-cut': []
  'duplicate-cut': []
  'delete-cut': []
  'zoom-in': []
  'zoom-out': []
  'export': []
  'update:exportFormat': [value: 'png' | 'svg']
  'update:exportWidth': [value: number]
  'update:exportHeight': [value: number]
}>()
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center gap-3">
    <div class="flex items-center gap-2 pr-3 border-r border-gray-200">
      <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">컷 관리</span>
      <span class="text-xs text-gray-500">컷 {{ props.cutIndex + 1 }} / {{ props.cutCount }}</span>
      <button class="btn-small" @click="emit('add-cut')">추가</button>
      <button class="btn-small" @click="emit('duplicate-cut')">복제</button>
      <button class="btn-small danger" :disabled="props.cutCount <= 1" @click="emit('delete-cut')">삭제</button>
    </div>

    <div class="flex items-center gap-2 pr-3 border-r border-gray-200">
      <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">화면 비율</span>
      <button class="btn-small" @click="emit('zoom-out')">축소</button>
      <span class="text-sm font-semibold text-gray-700 w-12 text-center">{{ props.zoom }}%</span>
      <button class="btn-small" @click="emit('zoom-in')">확대</button>
    </div>

    <div class="flex items-center gap-2">
      <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">내보내기</span>
      <select
        class="input-sm w-20"
        :value="props.exportFormat"
        @change="emit('update:exportFormat', ($event.target as HTMLSelectElement).value as 'png' | 'svg')"
      >
        <option value="png">PNG</option>
        <option value="svg">SVG</option>
      </select>
      <input
        type="number"
        min="100"
        class="input-sm w-20"
        :value="props.exportWidth"
        @input="emit('update:exportWidth', Number(($event.target as HTMLInputElement).value || 0))"
      >
      <span class="text-xs text-gray-400">x</span>
      <input
        type="number"
        min="100"
        class="input-sm w-20"
        :value="props.exportHeight"
        @input="emit('update:exportHeight', Number(($event.target as HTMLInputElement).value || 0))"
      >
      <button class="btn-small primary" @click="emit('export')">내보내기</button>
    </div>
  </div>
</template>

<style scoped>
.btn-small {
  @apply px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed;
}
.btn-small.primary {
  @apply bg-blue-600 text-white border-blue-600 hover:bg-blue-700;
}
.btn-small.danger {
  @apply text-red-600 border-red-200 hover:bg-red-50;
}
.input-sm {
  @apply px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400;
}
</style>
