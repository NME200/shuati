import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken } from './api'

const routes = [
  { path: '/login', name: 'Login', component: () => import('./views/Login.vue') },
  {
    path: '/',
    component: () => import('./layout/MainLayout.vue'),
    redirect: '/overview',
    children: [
      { path: 'overview', name: 'Overview', component: () => import('./views/Overview.vue') },
      { path: 'banks', name: 'Banks', component: () => import('./views/Banks.vue') },
      { path: 'questions', name: 'Questions', component: () => import('./views/Questions.vue') },
      { path: 'records', name: 'Records', component: () => import('./views/Records.vue') },
      { path: 'users', name: 'Users', component: () => import('./views/Users.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.path !== '/login' && !getToken()) {
    next('/login')
  } else {
    next()
  }
})

export default router
