<script setup lang="ts">
import AppLayout from './components/layout/AppLayout.vue'
import EditorView from './views/EditorView.vue'
</script>

<template>
  <AppLayout :noChrome="true">
    <EditorView />
  </AppLayout>
</template>
