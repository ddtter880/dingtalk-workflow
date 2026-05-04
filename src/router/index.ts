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
    meta: { requireAdmin: true },
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/pages/admin/AdminPage.vue'),
    meta: { requireAdmin: true },
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

// 权限守卫：管理员页面需要 admin 角色
router.beforeEach((to, _from, next) => {
  if (to.meta.requireAdmin) {
    // 从 localStorage 读取用户信息判断角色
    try {
      const userStr = sessionStorage.getItem('dt_user')
      if (userStr) {
        const user = JSON.parse(userStr)
        if (user.role === 'admin') {
          next()
          return
        }
      }
      // 非管理员重定向到首页
      next('/')
    } catch {
      next('/')
    }
  } else {
    next()
  }
})

export default router
