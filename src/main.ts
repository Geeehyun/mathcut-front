import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueKonva from 'vue-konva'
import Konva from 'konva'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './styles/main.css'
import 'katex/dist/katex.min.css'

Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
;(Konva as typeof Konva & { _fixTextRendering: boolean })._fixTextRendering = true

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(VueKonva)
app.use(router)

// 페이지 새로고침 시 localStorage에서 인증 상태 복원
const auth = useAuthStore()
auth.restoreFromStorage()

app.mount('#app')
