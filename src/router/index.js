import { createRouter, createWebHistory } from 'vue-router'
import GuruLayout from '../views/guru/GuruLayout.vue'
import WakaLayout from '../views/waka/WakaLayout.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'login', component: LoginView },

    // --- ROUTE WAKA KURIKULUM ---
    {
      path: '/waka',
      component: WakaLayout,
      children: [
        {
          path: '',
          name: 'waka-dashboard',
          component: () => import('../views/waka/DashboardWakaView.vue'),
        },
        {
          path: 'siswa',
          name: 'waka-siswa',
          component: () => import('../views/waka/MasterSiswaView.vue'),
        },
        {
          path: 'guru',
          name: 'waka-guru',
          component: () => import('../views/waka/MasterGuruView.vue'),
        },
        {
          path: 'kenaikan',
          name: 'waka-kenaikan',
          component: () => import('../views/waka/KenaikanKelasView.vue'),
        },
        {
          path: 'kelas',
          name: 'waka-kelas',
          component: () => import('../views/waka/PemantauanKelasView.vue'),
        },
      ],
    },

    // --- ROUTE GURU ---
    {
      path: '/guru',
      component: GuruLayout,
      children: [
        {
          path: '',
          name: 'guru-dashboard',
          component: () => import('../views/guru/DashboardView.vue'),
        },
        {
          path: 'kelas',
          name: 'guru-kelas',
          component: () => import('../views/guru/ManajemenKelasView.vue'),
        },
        {
          path: 'kelas/:id',
          name: 'guru-detail-kelas',
          component: () => import('../views/guru/DetailKelasView.vue'),
        },
        {
          path: 'nilai/:id',
          name: 'guru-buku-nilai',
          component: () => import('../views/guru/BukuNilaiView.vue'),
        },
        {
          path: 'pengaturan',
          name: 'guru-pengaturan',
          component: () => import('../views/guru/PengaturanAkunView.vue'),
        },
      ],
    },

    // --- ROUTE SISWA ---
    {
      path: '/siswa',
      component: () => import('../views/siswa/SiswaLayout.vue'),
      children: [
        {
          path: '',
          name: 'siswa-dashboard',
          component: () => import('../views/siswa/DashboardSiswaView.vue'),
        },
        {
          path: 'kelas/:id',
          name: 'siswa-ruang-kelas',
          component: () => import('../views/siswa/RuangKelasView.vue'),
        },
        {
          path: 'presensi/:idKelas',
          name: 'siswa-presensi',
          component: () => import('../views/siswa/PresensiSiswaView.vue'),
        },
        // BARU: Halaman Rapor Siswa
        {
          path: 'nilai',
          name: 'siswa-rapor',
          component: () => import('../views/siswa/RaporSiswaView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to, from) => {
  const userRole = localStorage.getItem('user_role')

  if (to.path === '/' && userRole) {
    return `/${userRole}`
  }

  if (to.path !== '/') {
    if (!userRole) {
      return '/'
    }

    if (to.path.startsWith('/waka') && userRole !== 'waka') return '/'
    if (to.path.startsWith('/guru') && userRole !== 'guru') return '/'
    if (to.path.startsWith('/siswa') && userRole !== 'siswa') return '/'
  }

  return true
})

export default router
