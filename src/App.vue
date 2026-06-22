<!-- <script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template> -->

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { useUiStore } from './stores/uiStore' // <-- 1. Import UI Store

const uiStore = useUiStore() // <-- 2. Inisialisasi Store

// Fungsi untuk memblokir kombinasi tombol Inspect Element dan View Source
const blokirInspeksi = (e) => {
  if (e.key === 'F12' || e.keyCode === 123) e.preventDefault()
  if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))
    e.preventDefault()
  if (e.ctrlKey && e.key === 'U') e.preventDefault()
  if (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) e.preventDefault()
  if (e.metaKey && e.key === 'U') e.preventDefault()
}

// Fungsi untuk memblokir Klik Kanan
const blokirKlikKanan = (e) => {
  e.preventDefault()
}

onMounted(() => {
  document.addEventListener('contextmenu', blokirKlikKanan)
  document.addEventListener('keydown', blokirInspeksi)
})

onUnmounted(() => {
  document.removeEventListener('contextmenu', blokirKlikKanan)
  document.removeEventListener('keydown', blokirInspeksi)
})
</script>

<template>
  <div
    v-if="uiStore.isGlobalLoading"
    class="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity"
  >
    <div
      class="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-11/12 text-center animate-in zoom-in-95 duration-300 border border-slate-100"
    >
      <div
        class="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-6"
      ></div>

      <h3 class="text-lg font-black text-slate-800 tracking-tight mb-2">Mohon Tunggu...</h3>
      <p class="text-sm font-medium text-slate-500">{{ uiStore.loadingMessage }}</p>
    </div>
  </div>

  <RouterView />
</template>
