import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/pages/index/IndexPage.vue'),
  },
  {
    path: '/form/:id?',
    name: 'Form',
    component: () => import('@/pages/form/FormPage.vue'),
  },
  {
    path: '/detail/:id',
    name: 'Detail',
    component: () => import('@/pages/detail/DetailPage.vue'),
  },
  {
    path: '/approval/:id',
    name: 'Approval',
    component: () => import('@/pages/approval/ApprovalPage.vue'),
  },
  {
    path: '/config',
    name: 'Config',
    component: () => import('@/pages/config/ConfigPage.vue'),
  },
  {
    path: '/recycle',
    name: 'Recycle',
    component: () => import('@/pages/recycle/RecyclePage.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
