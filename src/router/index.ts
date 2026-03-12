import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('@/views/MyLibraryView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/editor',
      name: 'editor-new',
      component: () => import('@/views/EditorView.vue'),
    },
    {
      path: '/editor/:cutId',
      name: 'editor-cut',
      component: () => import('@/views/EditorView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
    {
      path: '/',
      redirect: () => {
        const auth = useAuthStore()
        return auth.isLoggedIn ? '/library' : '/editor'
      },
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login' }
  }
  if (to.meta.requiresGuest && auth.isLoggedIn) {
    return { name: 'library' }
  }
})

export default router
