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

interface LatexShapeGuideOverlay {
  key: string
  x: number
  y: number
  html: string
  shapeId: string
  guideKey: 'length' | 'angle' | 'height'
  itemIndex: number
  color: string
  fontSize: number
  interactive?: boolean
  centerAlign?: boolean
}

const props = defineProps<{
  latexTextGuideOverlays: LatexTextGuideOverlay[]
  latexPointLabelOverlays: LatexPointLabelOverlay[]
  latexShapeGuideOverlays: LatexShapeGuideOverlay[]
  zoomScale: number
  viewportOffset: { x: number, y: number }
  fontFamily: string
  isTextGuideHighlighted: (guideId: string) => boolean
  isTextGuideDragging: (guideId: string) => boolean
  isPointGuideDragging: (shapeId: string, pointIndex: number) => boolean
  isGuideTextHighlighted: (shapeId: string, guideKey: 'pointName' | 'length' | 'angle' | 'height', itemIndex: number) => boolean
  isShapeGuideDragging: (shapeId: string, guideKey: 'length' | 'angle' | 'height', itemIndex: number) => boolean
}>()

const emit = defineEmits<{
  textGuideMouseEnter: [guideId: string]
  textGuideMouseLeave: [guideId: string]
  textGuideMouseDown: [guideId: string, event: MouseEvent]
  textGuideMouseUp: []
  textGuideDblClick: [guideId: string]
  textGuideContextMenu: [guideId: string, event: MouseEvent]
  pointGuideMouseEnter: [shapeId: string, pointIndex: number]
  pointGuideMouseLeave: []
  pointGuideMouseDown: [shapeId: string, pointIndex: number, event: MouseEvent]
  pointGuideMouseUp: []
  pointGuideDblClick: [shapeId: string, pointIndex: number]
  pointGuideContextMenu: [shapeId: string, pointIndex: number, event: MouseEvent]
  shapeGuideMouseEnter: [shapeId: string, guideKey: 'length' | 'angle' | 'height', itemIndex: number]
  shapeGuideMouseLeave: []
  shapeGuideMouseDown: [shapeId: string, guideKey: 'length' | 'angle' | 'height', itemIndex: number, event: MouseEvent]
  shapeGuideMouseUp: []
  shapeGuideDblClick: [shapeId: string, guideKey: 'length' | 'angle' | 'height', itemIndex: number]
  shapeGuideContextMenu: [shapeId: string, guideKey: 'length' | 'angle' | 'height', itemIndex: number, event: MouseEvent]
}>()

function snapCssPixel(value: number) {
  return Math.round(value * 2) / 2
}
</script>

<template>
  <div class="absolute inset-0 pointer-events-none">
    <div
      v-for="overlay in props.latexTextGuideOverlays"
      :key="`latex-guide-${overlay.key}`"
      class="absolute pointer-events-auto rounded-sm"
      :class="props.isTextGuideHighlighted(overlay.guideId) ? 'bg-sky-100/70 ring-1 ring-sky-300' : ''"
      :style="{
        left: `${snapCssPixel(overlay.x * props.zoomScale + props.viewportOffset.x)}px`,
        top: `${snapCssPixel((overlay.y - overlay.fontSize * 0.45) * props.zoomScale + props.viewportOffset.y)}px`,
        color: overlay.color,
        fontSize: `${overlay.fontSize * props.zoomScale}px`,
        fontFamily: props.fontFamily,
        textRendering: 'geometricPrecision',
        WebkitFontSmoothing: 'antialiased',
        transform: `translate(-50%, 0) rotate(${overlay.rotation}deg)`,
        transformOrigin: 'center center',
        cursor: props.isTextGuideDragging(overlay.guideId) ? 'grabbing' : 'grab'
      }"
      v-html="overlay.html"
      @mouseenter="emit('textGuideMouseEnter', overlay.guideId)"
      @mouseleave="emit('textGuideMouseLeave', overlay.guideId)"
      @mousedown.stop.prevent="emit('textGuideMouseDown', overlay.guideId, $event)"
      @mouseup.stop.prevent="emit('textGuideMouseUp')"
      @dblclick.stop="emit('textGuideDblClick', overlay.guideId)"
      @contextmenu.stop.prevent="emit('textGuideContextMenu', overlay.guideId, $event)"
    ></div>
    <div
      v-for="overlay in props.latexPointLabelOverlays"
      :key="`latex-point-${overlay.key}`"
      class="absolute pointer-events-auto rounded-sm"
      :class="props.isGuideTextHighlighted(overlay.shapeId, 'pointName', overlay.pointIndex) ? 'bg-sky-100/70 ring-1 ring-sky-300' : ''"
      :style="{
        left: `${snapCssPixel(overlay.x * props.zoomScale + props.viewportOffset.x)}px`,
        top: `${snapCssPixel(overlay.y * props.zoomScale + props.viewportOffset.y)}px`,
        color: overlay.color,
        fontSize: `${overlay.fontSize * props.zoomScale}px`,
        fontFamily: props.fontFamily,
        textRendering: 'geometricPrecision',
        WebkitFontSmoothing: 'antialiased',
        cursor: props.isPointGuideDragging(overlay.shapeId, overlay.pointIndex) ? 'grabbing' : 'grab'
      }"
      v-html="overlay.html"
      @mouseenter="emit('pointGuideMouseEnter', overlay.shapeId, overlay.pointIndex)"
      @mouseleave="emit('pointGuideMouseLeave')"
      @mousedown.stop.prevent="emit('pointGuideMouseDown', overlay.shapeId, overlay.pointIndex, $event)"
      @mouseup.stop.prevent="emit('pointGuideMouseUp')"
      @dblclick.stop="emit('pointGuideDblClick', overlay.shapeId, overlay.pointIndex)"
      @contextmenu.stop.prevent="emit('pointGuideContextMenu', overlay.shapeId, overlay.pointIndex, $event)"
    ></div>
    <div
      v-for="overlay in props.latexShapeGuideOverlays"
      :key="`latex-shape-guide-${overlay.key}`"
      class="absolute rounded-sm"
      :class="[
        overlay.interactive === false ? 'pointer-events-none' : 'pointer-events-auto',
        overlay.interactive === false
          ? ''
          : (props.isGuideTextHighlighted(overlay.shapeId, overlay.guideKey, overlay.itemIndex) ? 'bg-sky-100/70 ring-1 ring-sky-300' : '')
      ]"
      :style="{
        left: `${snapCssPixel(overlay.x * props.zoomScale + props.viewportOffset.x)}px`,
        top: `${snapCssPixel(overlay.y * props.zoomScale + props.viewportOffset.y)}px`,
        color: overlay.color,
        fontSize: `${overlay.fontSize * props.zoomScale}px`,
        fontFamily: props.fontFamily,
        textRendering: 'geometricPrecision',
        WebkitFontSmoothing: 'antialiased',
        transform: overlay.centerAlign ? 'translateX(-50%)' : '',
        cursor: overlay.interactive === false
          ? 'default'
          : (props.isShapeGuideDragging(overlay.shapeId, overlay.guideKey, overlay.itemIndex) ? 'grabbing' : 'grab')
      }"
      v-html="overlay.html"
      @mouseenter="emit('shapeGuideMouseEnter', overlay.shapeId, overlay.guideKey, overlay.itemIndex)"
      @mouseleave="emit('shapeGuideMouseLeave')"
      @mousedown.stop.prevent="emit('shapeGuideMouseDown', overlay.shapeId, overlay.guideKey, overlay.itemIndex, $event)"
      @mouseup.stop.prevent="emit('shapeGuideMouseUp')"
      @dblclick.stop="emit('shapeGuideDblClick', overlay.shapeId, overlay.guideKey, overlay.itemIndex)"
      @contextmenu.stop.prevent="emit('shapeGuideContextMenu', overlay.shapeId, overlay.guideKey, overlay.itemIndex, $event)"
    ></div>
  </div>
</template>
