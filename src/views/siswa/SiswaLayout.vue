<script setup>
import { ref, onMounted, watch } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const menuMobileBuka = ref(false)
const sidebarDesktopBuka = ref(true)
const profilBuka = ref(false)
const tampilHeader = ref(true)

const namaSiswa = ref('Memuat...')
const nisSiswa = ref('...')

onMounted(() => {
  namaSiswa.value = localStorage.getItem('user_nama') || 'Siswa'
  nisSiswa.value = localStorage.getItem('user_nip') || '...'
})

watch(
  () => route.name,
  (namaRute) => {
    if (namaRute === 'siswa-ruang-kelas') {
      sidebarDesktopBuka.value = false
      tampilHeader.value = false
    } else {
      sidebarDesktopBuka.value = true
      tampilHeader.value = true
    }
  },
  { immediate: true },
)

const toggleMenu = () => {
  menuMobileBuka.value = !menuMobileBuka.value
  sidebarDesktopBuka.value = !sidebarDesktopBuka.value
}

const toggleProfil = () => {
  profilBuka.value = !profilBuka.value
}

const prosesLogout = () => {
  profilBuka.value = false
  if (confirm('Apakah Anda yakin ingin keluar dari Portal Siswa?')) {
    localStorage.clear()
    router.replace('/')
  }
}
</script>

<template>
  <div class="flex h-[100dvh] bg-[#F8FAFC] font-sans text-slate-800 selection:bg-emerald-200">
    <div
      v-if="menuMobileBuka"
      @click="toggleMenu"
      class="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity"
    ></div>

    <aside
      :class="[
        'fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-slate-200/60 shadow-2xl lg:shadow-none transform transition-all duration-300 ease-in-out flex flex-col shrink-0 whitespace-nowrap overflow-hidden',
        menuMobileBuka ? 'translate-x-0 w-72' : '-translate-x-full w-72 lg:translate-x-0',
        sidebarDesktopBuka ? 'lg:w-72 lg:opacity-100' : 'lg:w-0 lg:border-transparent lg:opacity-0',
      ]"
    >
      <div class="h-20 px-8 flex items-center justify-between shrink-0 border-b border-slate-100">
        <div class="flex items-center gap-3">
          <img
            src="/logo_smkn6.png"
            alt="Logo SMKN 6"
            class="h-10 w-auto drop-shadow-sm"
            onerror="this.style.display = 'none'"
          />
          <span class="text-xl font-black text-slate-800 tracking-tight"
            >Portal<span class="text-emerald-600">Siswa</span></span
          >
        </div>
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

      <div class="px-6 py-6">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">
          Menu Pembelajaran
        </p>
        <nav class="space-y-1.5 custom-scrollbar">
          <RouterLink
            to="/siswa"
            @click="menuMobileBuka = false"
            class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold"
            :class="
              route.path === '/siswa'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            "
          >
            <svg class="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              ></path>
            </svg>
            Beranda Saya
          </RouterLink>
          <RouterLink
            to="/siswa/nilai"
            @click="menuMobileBuka = false"
            class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold"
            :class="
              route.path === '/siswa/nilai'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            "
          >
            <svg class="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              ></path>
            </svg>
            Rapor Akademik
          </RouterLink>
        </nav>
      </div>
    </aside>

    <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300">
      <header
        v-if="tampilHeader"
        class="h-20 bg-white/70 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 shrink-0 transition-all duration-300"
      >
        <div class="flex items-center gap-3 lg:gap-4 shrink-0">
          <button
            @click="toggleMenu"
            class="p-2.5 -ml-1 text-slate-500 hover:text-emerald-600 transition bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none"
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
            <h2 class="text-sm font-bold text-slate-800 tracking-tight">SMKN 6 Balikpapan</h2>
            <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
              Tahun Ajaran 2026/2027
            </p>
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
                {{ namaSiswa }}
              </p>
              <p
                class="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 sm:mt-1.5"
              >
                NIS. {{ nisSiswa }}
              </p>
            </div>
            <div
              class="w-9 h-9 sm:w-10 sm:h-10 shrink-0 bg-gradient-to-tr from-emerald-600 to-teal-800 rounded-full text-white flex items-center justify-center font-black shadow-md ring-2 sm:ring-4 ring-white"
            >
              {{ namaSiswa.charAt(0) }}
            </div>
          </button>

          <div
            v-if="profilBuka"
            class="absolute right-0 mt-14 w-56 sm:w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/50 py-2 z-50 transform origin-top-right transition-all"
          >
            <div class="px-2 space-y-1">
              <div class="px-4 py-2 border-b border-gray-100 mb-1 md:hidden">
                <p class="text-sm font-bold text-gray-800">{{ namaSiswa }}</p>
              </div>
              <button
                class="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-600 rounded-xl hover:bg-slate-50 transition cursor-not-allowed opacity-50 flex items-center gap-3"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  ></path>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                </svg>
                Pengaturan Akun
              </button>
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

      <div class="flex-1 flex flex-col relative overflow-hidden bg-[#F8FAFC]">
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
