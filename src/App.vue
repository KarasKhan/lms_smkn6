<!-- <script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template> -->

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'

// Fungsi untuk memblokir kombinasi tombol Inspect Element dan View Source
const blokirInspeksi = (e) => {
  // Blokir tombol F12
  if (e.key === 'F12' || e.keyCode === 123) {
    e.preventDefault()
  }
  // Blokir Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element), Ctrl+U (View Source)
  if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
    e.preventDefault()
  }
  if (e.ctrlKey && e.key === 'U') {
    e.preventDefault()
  }
  // Untuk pengguna Mac (Cmd+Option+I dsb)
  if (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
    e.preventDefault()
  }
  if (e.metaKey && e.key === 'U') {
    e.preventDefault()
  }
}

// Fungsi untuk memblokir Klik Kanan
const blokirKlikKanan = (e) => {
  e.preventDefault()
}

onMounted(() => {
  // Pasang pelindung saat aplikasi pertama kali dimuat
  document.addEventListener('contextmenu', blokirKlikKanan)
  document.addEventListener('keydown', blokirInspeksi)
})

onUnmounted(() => {
  // Bersihkan event listener jika aplikasi ditutup (best practice)
  document.removeEventListener('contextmenu', blokirKlikKanan)
  document.removeEventListener('keydown', blokirInspeksi)
})
</script>

<template>
  <RouterView />
</template>
