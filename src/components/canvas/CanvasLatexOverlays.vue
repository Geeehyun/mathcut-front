<script setup lang="ts">
interface LatexTextGuideOverlay {
  key: string
  x: number
  y: number
  html: string
  guideId: string
  color: string
  fontSize: number
  rotation: number
}

interface LatexPointLabelOverlay {
  key: string
  x: number
  y: number
  html: string
  shapeId: string
  pointIndex: number
  color: string
  fontSize: number
}

const props = defineProps<{
  latexTextGuideOverlays: LatexTextGuideOverlay[]
  latexPointLabelOverlays: LatexPointLabelOverlay[]
  zoomScale: number
  viewportOffset: { x: number, y: number }
  fontFamily: string
  isTextGuideHighlighted: (guideId: string) => boolean
  isGuideTextHighlighted: (shapeId: string, guideKey: 'pointName', itemIndex: number) => boolean
}>()

const emit = defineEmits<{
  textGuideMouseEnter: [guideId: string]
  textGuideMouseLeave: [guideId: string]
  textGuideMouseDown: [guideId: string, event: MouseEvent]
  textGuideDblClick: [guideId: string]
  textGuideContextMenu: [guideId: string, event: MouseEvent]
  pointGuideMouseEnter: [shapeId: string, pointIndex: number]
  pointGuideMouseLeave: []
  pointGuideMouseDown: [shapeId: string, pointIndex: number, event: MouseEvent]
  pointGuideDblClick: [shapeId: string, pointIndex: number]
  pointGuideContextMenu: [shapeId: string, pointIndex: number, event: MouseEvent]
}>()
</script>

<template>
  <div class="absolute inset-0 pointer-events-none">
    <div
      v-for="overlay in props.latexTextGuideOverlays"
      :key="`latex-guide-${overlay.key}`"
      class="absolute pointer-events-auto rounded-sm"
      :class="props.isTextGuideHighlighted(overlay.guideId) ? 'bg-sky-100/70 ring-1 ring-sky-300' : ''"
      :style="{
        left: `${overlay.x * props.zoomScale + props.viewportOffset.x}px`,
        top: `${overlay.y * props.zoomScale + props.viewportOffset.y}px`,
        color: overlay.color,
        fontSize: `${overlay.fontSize * props.zoomScale}px`,
        fontFamily: props.fontFamily,
        transform: `translate(-50%, -45%) rotate(${overlay.rotation}deg)`,
        transformOrigin: 'center center'
      }"
      v-html="overlay.html"
      @mouseenter="emit('textGuideMouseEnter', overlay.guideId)"
      @mouseleave="emit('textGuideMouseLeave', overlay.guideId)"
      @mousedown.stop.prevent="emit('textGuideMouseDown', overlay.guideId, $event)"
      @dblclick.stop="emit('textGuideDblClick', overlay.guideId)"
      @contextmenu.stop.prevent="emit('textGuideContextMenu', overlay.guideId, $event)"
    ></div>
    <div
      v-for="overlay in props.latexPointLabelOverlays"
      :key="`latex-point-${overlay.key}`"
      class="absolute pointer-events-auto rounded-sm"
      :class="props.isGuideTextHighlighted(overlay.shapeId, 'pointName', overlay.pointIndex) ? 'bg-sky-100/70 ring-1 ring-sky-300' : ''"
      :style="{
        left: `${overlay.x * props.zoomScale + props.viewportOffset.x}px`,
        top: `${overlay.y * props.zoomScale + props.viewportOffset.y}px`,
        color: overlay.color,
        fontSize: `${overlay.fontSize * props.zoomScale}px`,
        fontFamily: props.fontFamily
      }"
      v-html="overlay.html"
      @mouseenter="emit('pointGuideMouseEnter', overlay.shapeId, overlay.pointIndex)"
      @mouseleave="emit('pointGuideMouseLeave')"
      @mousedown.stop.prevent="emit('pointGuideMouseDown', overlay.shapeId, overlay.pointIndex, $event)"
      @dblclick.stop="emit('pointGuideDblClick', overlay.shapeId, overlay.pointIndex)"
      @contextmenu.stop.prevent="emit('pointGuideContextMenu', overlay.shapeId, overlay.pointIndex, $event)"
    ></div>
  </div>
</template>
