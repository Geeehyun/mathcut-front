import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import type { Guide, Shape } from '@/types'

export type CutCanvasData = {
  shapes: Shape[]
  guides: Guide[]
  topLevelOrder?: string[]
}

export type CutListItem = {
  id: number
  title: string
  thumbnail: string | null
  createdAt: string
  updatedAt: string
}

export type CutDetail = {
  id: number
  title: string
  canvasData: CutCanvasData
  thumbnail: string | null
  createdAt: string
  updatedAt: string
}

export function useCutStore() {
  const api = useApi()
  const cuts = ref<CutListItem[]>([])
  const currentCut = ref<CutDetail | null>(null)
  const loading = ref(false)

  async function fetchCuts() {
    loading.value = true
    try {
      const data = await api.get<CutListItem[]>('/api/cuts')
      cuts.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function fetchCut(id: number) {
    loading.value = true
    try {
      const data = await api.get<CutDetail>(`/api/cuts/${id}`)
      currentCut.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function saveCut(title: string, canvasData: CutCanvasData, thumbnail?: string | null) {
    const data = await api.post<{ id: number }>('/api/cuts', { title, canvasData, thumbnail })
    return data
  }

  async function updateCut(id: number, title: string, canvasData: CutCanvasData, thumbnail?: string | null) {
    const data = await api.put<{ id: number }>(`/api/cuts/${id}`, { title, canvasData, thumbnail })
    return data
  }

  async function deleteCut(id: number) {
    await api.del(`/api/cuts/${id}`)
    cuts.value = cuts.value.filter((cut) => cut.id !== id)
    if (currentCut.value?.id === id) {
      currentCut.value = null
    }
  }

  return {
    cuts,
    currentCut,
    loading,
    fetchCuts,
    fetchCut,
    saveCut,
    updateCut,
    deleteCut,
  }
}
