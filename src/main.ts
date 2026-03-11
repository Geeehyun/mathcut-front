import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueKonva from 'vue-konva'
import Konva from 'konva'
import App from './App.vue'
import './styles/main.css'
import 'katex/dist/katex.min.css'

Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
;(Konva as typeof Konva & { _fixTextRendering: boolean })._fixTextRendering = true

const app = createApp(App)

app.use(createPinia())
app.use(VueKonva)

app.mount('#app')
