import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Shape, Guide, ShapeColor, ShapeGuideVisibility, ShapeGuideItemStyle } from '@/types'
import { GRID_CONFIG } from '@/types'

type CanvasSnapshot = { shapes: Shape[], guides: Guide[] }
const HISTORY_LIMIT = 100

function withCircleOppositePoint(shape: Shape): Shape {
  if (shape.type !== 'circle') return shape
  if (shape.points.length < 2) return shape
  const center = shape.points[0]
  const edge = shape.points[1]
  const opposite = {
    x: center.x * 2 - edge.x,
    y: center.y * 2 - edge.y,
    gridX: (center.x * 2 - edge.x) / GRID_CONFIG.size,
    gridY: (center.y * 2 - edge.y) / GRID_CONFIG.size
  }
  return {
    ...shape,
    points: [center, edge, opposite]
  }
}

export const useCanvasStore = defineStore('canvas', () => {
  // 도형 목록
  const shapes = ref<Shape[]>([])

  // 가이드 목록
  const guides = ref<Guide[]>([])

  // 선택된 도형 ID
  const selectedShapeId = ref<string | null>(null)
  const selectedGuideId = ref<string | null>(null)

  // 히스토리 (실행취소용)
  const history = ref<CanvasSnapshot[]>([])
  const historyIndex = ref(-1)

  // 선택된 도형
  const selectedShape = computed(() =>
    shapes.value.find(s => s.id === selectedShapeId.value) || null
  )
  const selectedGuide = computed(() =>
    guides.value.find(g => g.id === selectedGuideId.value) || null
  )

  // 히스토리 저장
  function saveHistory() {
    // 현재 위치 이후 히스토리 삭제
    history.value = history.value.slice(0, historyIndex.value + 1)
    // 현재 상태 저장
    history.value.push({
      shapes: JSON.parse(JSON.stringify(shapes.value)),
      guides: JSON.parse(JSON.stringify(guides.value))
    })
    if (history.value.length > HISTORY_LIMIT) {
      history.value = history.value.slice(history.value.length - HISTORY_LIMIT)
    }
    historyIndex.value = history.value.length - 1
  }

  // 도형 추가
  function addShape(shape: Shape) {
    saveHistory()
    shapes.value.push(withCircleOppositePoint(shape))
  }

  // 도형 삭제
  function removeShape(id: string) {
    saveHistory()
    const index = shapes.value.findIndex(s => s.id === id)
    if (index !== -1) {
      shapes.value.splice(index, 1)
    }
    if (selectedShapeId.value === id) {
      selectedShapeId.value = null
    }
  }

  // 도형 커스텀 색상 설정
  function setShapeColor(id: string, color: ShapeColor) {
    const index = shapes.value.findIndex(s => s.id === id)
    if (index === -1) return
    saveHistory()
    shapes.value[index] = { ...shapes.value[index], color }
  }

  function setShapeGuideVisibility(id: string, key: keyof ShapeGuideVisibility, visible: boolean) {
    const index = shapes.value.findIndex(s => s.id === id)
    if (index === -1) return
    saveHistory()
    const prev = shapes.value[index].guideVisibility || {}
    shapes.value[index] = {
      ...shapes.value[index],
      guideVisibility: {
        ...prev,
        [key]: visible
      }
    }
  }

  function setShapeGuideItemVisible(
    id: string,
    key: 'length' | 'angle' | 'pointName' | 'height',
    index: number,
    visible: boolean
  ) {
    const shapeIndex = shapes.value.findIndex(s => s.id === id)
    if (shapeIndex === -1) return

    const visibility = { ...(shapes.value[shapeIndex].guideVisibility || {}) }
    const mapKey = key === 'length'
      ? 'lengthHiddenIndices'
      : key === 'angle'
        ? 'angleHiddenIndices'
        : key === 'height'
          ? 'heightHiddenIndices'
          : 'pointNameHiddenIndices'

    const hidden = new Set<number>(visibility[mapKey] || [])
    if (visible) {
      hidden.delete(index)
    } else {
      hidden.add(index)
    }

    saveHistory()
    visibility[mapKey] = Array.from(hidden).sort((a, b) => a - b)
    shapes.value[shapeIndex] = {
      ...shapes.value[shapeIndex],
      guideVisibility: visibility
    }
  }

  // 레이어 순서 변경 (배열 뒤 = 화면 앞)
  function reorderShape(id: string, direction: 'up' | 'down' | 'front' | 'back') {
    const index = shapes.value.findIndex(s => s.id === id)
    if (index === -1) return
    saveHistory()
    const arr = shapes.value
    if (direction === 'front') {
      arr.push(arr.splice(index, 1)[0])
    } else if (direction === 'back') {
      arr.unshift(arr.splice(index, 1)[0])
    } else if (direction === 'up' && index < arr.length - 1) {
      ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
    } else if (direction === 'down' && index > 0) {
      ;[arr[index], arr[index - 1]] = [arr[index - 1], arr[index]]
    }
  }

  // 도형 이동 (선택/이동 도구)
  function moveShape(id: string, dx: number, dy: number, recordHistory: boolean = true) {
    const target = shapes.value.find(s => s.id === id)
    if (!target) return
    if (recordHistory) {
      saveHistory()
    }

    const toMove = new Set<string>()
    collectDescendants(id, toMove)

    shapes.value = shapes.value.map((shape) => {
      if (!toMove.has(shape.id)) return shape
      return withCircleOppositePoint({
        ...shape,
        points: shape.points.map(p => ({
          x: p.x + dx,
          y: p.y + dy,
          gridX: (p.x + dx) / GRID_CONFIG.size,
          gridY: (p.y + dy) / GRID_CONFIG.size
        }))
      })
    })
  }

  function collectDescendants(rootId: string, out: Set<string>) {
    if (out.has(rootId)) return
    out.add(rootId)
    for (const shape of shapes.value) {
      if (shape.attachedToShapeId === rootId) {
        collectDescendants(shape.id, out)
      }
    }
  }

  // 도형 수정
  function updateShape(id: string, updater: (shape: Shape) => Shape) {
    const index = shapes.value.findIndex(s => s.id === id)
    if (index === -1) return
    saveHistory()
    shapes.value[index] = withCircleOppositePoint(updater(shapes.value[index]))
  }

  function setShapeVisible(id: string, visible: boolean) {
    const index = shapes.value.findIndex(s => s.id === id)
    if (index === -1) return
    saveHistory()
    shapes.value[index] = {
      ...shapes.value[index],
      visible
    }
  }

  function moveShapeToIndex(id: string, toIndex: number) {
    const fromIndex = shapes.value.findIndex((s) => s.id === id)
    if (fromIndex === -1) return
    const clampedTo = Math.max(0, Math.min(shapes.value.length - 1, toIndex))
    if (fromIndex === clampedTo) return
    saveHistory()
    const next = [...shapes.value]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(clampedTo, 0, moved)
    shapes.value = next
  }

  function setShapePoint(id: string, pointIndex: number, point: { x: number, y: number, gridX: number, gridY: number }, recordHistory: boolean = true) {
    const index = shapes.value.findIndex(s => s.id === id)
    if (index === -1) return
    const shape = shapes.value[index]
    if (pointIndex < 0 || pointIndex >= shape.points.length) return
    if (recordHistory) {
      saveHistory()
    }
    const nextPoints = shape.points.map((p, i) => i === pointIndex ? {
      x: point.x,
      y: point.y,
      gridX: point.gridX,
      gridY: point.gridY
    } : p)

    if (shape.type === 'circle' && nextPoints.length >= 2) {
      if (pointIndex === 2) {
        const center = nextPoints[0]
        const mirroredEdge = {
          x: center.x * 2 - point.x,
          y: center.y * 2 - point.y,
          gridX: (center.x * 2 - point.x) / GRID_CONFIG.size,
          gridY: (center.y * 2 - point.y) / GRID_CONFIG.size
        }
        nextPoints[1] = mirroredEdge
      }
      shapes.value[index] = withCircleOppositePoint({
        ...shape,
        points: nextPoints
      })
      return
    }

    shapes.value[index] = {
      ...shape,
      points: nextPoints
    }
  }

  function setShapePoints(
    id: string,
    points: Array<{ x: number, y: number, gridX: number, gridY: number }>,
    recordHistory: boolean = true
  ) {
    const index = shapes.value.findIndex(s => s.id === id)
    if (index === -1) return
    if (recordHistory) {
      saveHistory()
    }
    const shape = shapes.value[index]
    if (shape.type !== 'circle' && shape.points.length !== points.length) return
    const mappedPoints = points.map((p) => ({
      x: p.x,
      y: p.y,
      gridX: p.gridX,
      gridY: p.gridY
    }))
    shapes.value[index] = withCircleOppositePoint({
      ...shape,
      points: mappedPoints
    })
  }

  function patchShapeGuideItemStyle(
    id: string,
    key: 'length' | 'angle' | 'pointName' | 'height',
    itemIndex: number,
    patch: Partial<ShapeGuideItemStyle>,
    recordHistory: boolean = true
  ) {
    const shapeIndex = shapes.value.findIndex(s => s.id === id)
    if (shapeIndex === -1) return
    if (recordHistory) {
      saveHistory()
    }

    const shape = shapes.value[shapeIndex]
    const map = { ...(shape.guideStyleMap || {}) }
    const byKey = { ...(map[key] || {}) }
    const prev = { ...(byKey[itemIndex] || {}) }
    byKey[itemIndex] = { ...prev, ...patch }
    map[key] = byKey

    shapes.value[shapeIndex] = {
      ...shape,
      guideStyleMap: map
    }
  }

  // 마지막 도형 삭제
  function removeLastShape() {
    if (shapes.value.length > 0) {
      saveHistory()
      shapes.value.pop()
    }
  }

  // 가이드 추가
  function addGuide(guide: Guide) {
    saveHistory()
    guides.value.push(guide)
  }

  // 가이드 삭제
  function removeGuide(id: string) {
    saveHistory()
    const index = guides.value.findIndex(g => g.id === id)
    if (index !== -1) {
      guides.value.splice(index, 1)
    }
    if (selectedGuideId.value === id) {
      selectedGuideId.value = null
    }
  }

  // 가이드 수정
  function updateGuide(id: string, updater: (guide: Guide) => Guide, recordHistory: boolean = true) {
    const index = guides.value.findIndex(g => g.id === id)
    if (index === -1) return
    if (recordHistory) {
      saveHistory()
    }
    guides.value[index] = updater(guides.value[index])
  }

  function setGuideVisible(id: string, visible: boolean) {
    const index = guides.value.findIndex(g => g.id === id)
    if (index === -1) return
    saveHistory()
    guides.value[index] = {
      ...guides.value[index],
      visible
    }
  }

  // 마지막 가이드 삭제
  function removeLastGuide() {
    if (guides.value.length > 0) {
      saveHistory()
      guides.value.pop()
    }
  }

  // 도형 선택
  function selectShape(id: string | null) {
    selectedShapeId.value = id
    selectedGuideId.value = null
  }

  function selectGuide(id: string | null) {
    selectedGuideId.value = id
    selectedShapeId.value = null
  }

  // 전체 초기화
  function clearAll() {
    saveHistory()
    shapes.value = []
    guides.value = []
    selectedShapeId.value = null
    selectedGuideId.value = null
  }

  function getSnapshot(): CanvasSnapshot {
    return {
      shapes: JSON.parse(JSON.stringify(shapes.value)),
      guides: JSON.parse(JSON.stringify(guides.value))
    }
  }

  function loadSnapshot(snapshot: CanvasSnapshot) {
    shapes.value = JSON.parse(JSON.stringify(snapshot.shapes))
    guides.value = JSON.parse(JSON.stringify(snapshot.guides))
    selectedShapeId.value = null
    selectedGuideId.value = null
    history.value = []
    historyIndex.value = -1
  }

  // 실행취소
  function undo() {
    if (historyIndex.value > 0) {
      historyIndex.value--
      const state = history.value[historyIndex.value]
      shapes.value = JSON.parse(JSON.stringify(state.shapes))
      guides.value = JSON.parse(JSON.stringify(state.guides))
    }
  }

  // 다시실행
  function redo() {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++
      const state = history.value[historyIndex.value]
      shapes.value = JSON.parse(JSON.stringify(state.shapes))
      guides.value = JSON.parse(JSON.stringify(state.guides))
    }
  }

  // 실행취소 가능 여부
  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  return {
    shapes,
    guides,
    selectedShapeId,
    selectedGuideId,
    selectedShape,
    selectedGuide,
    canUndo,
    canRedo,
    saveHistory,
    addShape,
    removeShape,
    moveShape,
    setShapePoint,
    setShapePoints,
    patchShapeGuideItemStyle,
    setShapeColor,
    setShapeGuideVisibility,
    setShapeGuideItemVisible,
    reorderShape,
    updateShape,
    setShapeVisible,
    moveShapeToIndex,
    removeLastShape,
    addGuide,
    updateGuide,
    setGuideVisible,
    removeGuide,
    removeLastGuide,
    selectShape,
    selectGuide,
    clearAll,
    getSnapshot,
    loadSnapshot,
    undo,
    redo
  }
})
