<script setup>
import { ref, onMounted, watch } from 'vue'
import { RouterView, RouterLink, useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const profilBuka = ref(false)
const menuMobileBuka = ref(false)
const sidebarDesktopBuka = ref(true)
const tampilHeader = ref(true)

const namaGuru = ref('Memuat...')
const nipGuru = ref('...')

onMounted(() => {
  namaGuru.value = localStorage.getItem('user_nama') || 'Guru'
  nipGuru.value = localStorage.getItem('user_nip') || '...'
})

watch(
  () => route.name,
  (namaRute) => {
    if (namaRute === 'guru-detail-kelas') {
      sidebarDesktopBuka.value = false
      tampilHeader.value = false
    } else {
      sidebarDesktopBuka.value = true
      tampilHeader.value = true
    }
  },
  { immediate: true },
)

const toggleProfil = () => {
  profilBuka.value = !profilBuka.value
}

const toggleMenu = () => {
  menuMobileBuka.value = !menuMobileBuka.value
}

const toggleSidebarDesktop = () => {
  sidebarDesktopBuka.value = !sidebarDesktopBuka.value
}

const prosesLogout = () => {
  profilBuka.value = false
  if (confirm('Apakah Anda yakin ingin keluar dari Portal Guru?')) {
    localStorage.clear()
    router.replace('/')
  }
}
</script>

<template>
  <div class="flex h-screen bg-[#F8FAFC] font-sans text-slate-800">
    <div
      v-if="menuMobileBuka"
      @click="toggleMenu"
      class="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity"
    ></div>

    <aside
      :class="[
        'fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-slate-200/60 shadow-2xl lg:shadow-none transform transition-all duration-300 ease-in-out flex flex-col shrink-0 overflow-hidden whitespace-nowrap',
        menuMobileBuka ? 'translate-x-0 w-64' : '-translate-x-full w-64 lg:translate-x-0',
        sidebarDesktopBuka ? 'lg:w-64' : 'lg:w-0 lg:border-transparent lg:opacity-0',
      ]"
    >
      <div class="h-20 px-6 flex items-center justify-between shrink-0 border-b border-slate-100">
        <h1 class="text-xl font-black text-blue-600 tracking-tight">
          Portal<span class="text-slate-800">Guru</span>
        </h1>
        <button
          @click="toggleMenu"
          class="lg:hidden text-slate-400 hover:text-red-500 transition-colors focus:outline-none"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>

      <div class="px-4 py-6 flex-1 overflow-y-auto custom-scrollbar">
        <nav class="space-y-1.5">
          <RouterLink
            to="/guru"
            @click="menuMobileBuka = false"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm',
              route.path === '/guru'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
            ]"
          >
            Dashboard Utama
          </RouterLink>
          <RouterLink
            to="/guru/kelas"
            @click="menuMobileBuka = false"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm',
              route.path.includes('/guru/kelas') || route.path.includes('/guru/nilai')
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
            ]"
          >
            Manajemen Kelas
          </RouterLink>
        </nav>
      </div>
    </aside>

    <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative">
      <header
        v-if="tampilHeader"
        class="h-20 bg-white/70 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 shrink-0 transition-all duration-300"
      >
        <div class="flex items-center gap-3 lg:gap-4 shrink-0">
          <button
            @click="toggleMenu"
            class="lg:hidden p-2.5 -ml-1 text-slate-500 hover:text-blue-600 transition bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          </button>

          <button
            @click="toggleSidebarDesktop"
            class="hidden lg:flex p-2.5 -ml-1 text-slate-500 hover:text-blue-600 transition bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              ></path>
            </svg>
          </button>

          <div class="hidden sm:block">
            <h2 class="text-sm font-bold text-slate-800 tracking-tight">LMS SMKN 6 Balikpapan</h2>
          </div>
        </div>

        <div class="relative flex-1 flex justify-end ml-4">
          <button
            @click="toggleProfil"
            class="flex items-center gap-2 sm:gap-3 focus:outline-none p-1.5 sm:pl-3 rounded-full hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
          >
            <div class="text-right hidden md:block mr-2">
              <p
                class="text-xs sm:text-sm font-black text-slate-800 leading-none truncate max-w-[120px] sm:max-w-xs"
              >
                {{ namaGuru }}
              </p>
              <p
                class="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 sm:mt-1.5"
              >
                NIP. {{ nipGuru }}
              </p>
            </div>
            <div
              class="w-9 h-9 sm:w-10 sm:h-10 shrink-0 bg-gradient-to-tr from-blue-600 to-indigo-800 rounded-full text-white flex items-center justify-center font-black shadow-md ring-2 sm:ring-4 ring-white"
            >
              {{ namaGuru.charAt(0) }}
            </div>
          </button>

          <div
            v-if="profilBuka"
            class="absolute right-0 mt-14 w-56 sm:w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/50 py-2 z-50 transform origin-top-right transition-all"
          >
            <div class="px-2 space-y-1">
              <div class="px-4 py-2 border-b border-gray-100 mb-1 md:hidden">
                <p class="text-sm font-bold text-gray-800">{{ namaGuru }}</p>
              </div>
              <button
                @click="prosesLogout"
                class="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 rounded-xl hover:bg-red-50 hover:text-red-700 transition flex items-center gap-3"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  ></path>
                </svg>
                Keluar Sistem
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        v-if="profilBuka"
        @click="profilBuka = false"
        class="fixed inset-0 z-20 bg-transparent"
      ></div>

      <!-- PERBAIKAN: Penambahan padding (p-5 lg:p-8) dan custom-scrollbar di wrapper utama ini -->
      <div
        class="flex-1 flex flex-col relative overflow-y-auto custom-scrollbar bg-[#F8FAFC] p-5 lg:p-8"
      >
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
</style>
