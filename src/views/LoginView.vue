<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

const tampilPopupUjiCoba = ref(true)

const handleLogin = async () => {
  errorMsg.value = ''
  if (!username.value || !password.value) {
    errorMsg.value = 'Silakan masukkan username dan password.'
    return
  }

  loading.value = true
  try {
    // --- BYPASS UNTUK WAKA KURIKULUM ---
    if (
      username.value === 'admin' &&
      (password.value === 'admin123' || password.value === 'admin 123')
    ) {
      localStorage.setItem('user_role', 'waka')
      localStorage.setItem('user_nama', 'Admin Waka Kurikulum')
      localStorage.setItem('user_nip', 'admin')
      router.replace('/waka')
      return
    }

    // --- CEK KE FIRESTORE UNTUK GURU / SISWA ---
    const docRef = doc(db, 'users', username.value.trim())
    const snap = await getDoc(docRef)

    if (snap.exists()) {
      const data = snap.data()

      // PERBAIKAN: Jika password di database kosong (karena baru didaftar), otomatis gunakan '123456'
      const passwordDatabase = data.password || '123456'

      if (passwordDatabase === password.value) {
        localStorage.setItem('user_role', data.role)
        localStorage.setItem('user_nama', data.nama)
        localStorage.setItem('user_nip', snap.id)

        if (data.role === 'guru') {
          router.replace('/guru')
        } else if (data.role === 'siswa') {
          router.replace('/siswa')
        } else {
          errorMsg.value = 'Role akun tidak dikenali.'
        }
      } else {
        errorMsg.value = 'Kata sandi salah.'
      }
    } else {
      errorMsg.value = 'Akun tidak ditemukan di sistem.'
    }
  } catch (e) {
    console.error(e)
    errorMsg.value = 'Terjadi kesalahan jaringan. Coba lagi.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen flex flex-col justify-center items-center relative overflow-hidden bg-slate-50 font-sans selection:bg-emerald-200"
  >
    <!-- POPUP VERSI UJI COBA (Tampil paling depan) -->
    <div
      v-if="tampilPopupUjiCoba"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
    >
      <div
        class="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-500"
      >
        <div class="p-8 text-center relative">
          <!-- Ikon Roket / Uji Coba -->

          <h2 class="text-xl font-black text-slate-800 mb-3 tracking-tight">
            Versi Uji Coba (Beta)
          </h2>

          <p class="text-[13px] text-slate-500 font-medium leading-relaxed mb-8">
            Selamat datang! Aplikasi LMS SMKN 6 Balikpapan ini masih dalam tahap penyesuaian. Jika
            Anda menemukan <strong class="text-rose-500">bug</strong>, kendala, atau memiliki
            masukan, mohon berkenan untuk melaporkannya kepada tim pengembang.
          </p>

          <button
            @click="tampilPopupUjiCoba = false"
            class="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-slate-800/20 transform hover:-translate-y-0.5"
          >
            Siap, Saya Mengerti!
          </button>
        </div>
      </div>
    </div>

    <!-- Latar Belakang Premium Hijau -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 h-[50vh] transition-all"
    >
      <!-- Dekorasi Lingkaran Cahaya Aestetik -->
      <div
        class="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/30 rounded-full mix-blend-screen filter blur-[80px]"
      ></div>
      <div
        class="absolute top-10 -left-10 w-72 h-72 bg-teal-400/20 rounded-full mix-blend-screen filter blur-[60px]"
      ></div>
    </div>

    <!-- Kotak Login -->
    <div class="relative z-10 w-full max-w-[480px] px-4">
      <div
        class="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-500"
      >
        <!-- Wadah Logo -->
        <div
          class="w-20 h-20 mx-auto mb-6 bg-white rounded-full flex items-center justify-center p-3 shadow-sm border border-slate-100 relative overflow-hidden group hover:border-emerald-300 transition-colors"
        >
          <div
            class="absolute inset-0 bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity"
          ></div>
          <img
            src="/logo_smkn6.png"
            alt="Logo SMKN 6"
            class="w-full h-full object-contain relative z-10 drop-shadow-sm"
            onerror="this.style.display = 'none'"
          />
        </div>

        <div class="text-center mb-8">
          <h1 class="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
            Portal <span class="text-emerald-600">Akademik</span>
          </h1>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">
            LMS SMKN 6 Balikpapan
          </p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-5">
          <div
            v-if="errorMsg"
            class="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 animate-in slide-in-from-top-1"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            {{ errorMsg }}
          </div>

          <div>
            <label
              class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2"
              >NIP / NIS / Username</label
            >
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg
                  class="w-5 h-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  ></path>
                </svg>
              </div>
              <input
                type="text"
                v-model="username"
                class="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none placeholder:text-slate-400 placeholder:font-medium"
                placeholder="Masukkan ID Anda"
                required
              />
            </div>
          </div>

          <div>
            <label
              class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2"
              >Kata Sandi</label
            >
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg
                  class="w-5 h-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  ></path>
                </svg>
              </div>
              <input
                type="password"
                v-model="password"
                class="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none placeholder:text-slate-400 placeholder:font-medium tracking-widest"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none mt-2 flex items-center justify-center gap-2"
          >
            <svg v-if="loading" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{{ loading ? 'Mengautentikasi...' : 'Masuk ke Sistem' }}</span>
          </button>
        </form>

        <div class="mt-8 pt-6 border-t border-slate-100">
          <p
            class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center"
          >
            Informasi Default
          </p>
          <div class="space-y-2 text-xs">
            <!-- Akses Waka -->
            <div
              class="flex justify-between items-center bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors"
            >
              <span class="font-bold text-slate-600">Akses Waka</span>
              <span
                class="font-mono font-bold text-emerald-700 bg-white px-2.5 py-1 rounded shadow-sm border border-emerald-100 text-[11px]"
                >admin / admin123</span
              >
            </div>
            <!-- Akses Guru -->
            <div
              class="flex justify-between items-center bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors"
            >
              <span class="font-bold text-slate-600">Akses Guru</span>
              <span
                class="font-mono font-bold text-emerald-700 bg-white px-2.5 py-1 rounded shadow-sm border border-emerald-100 text-[11px]"
                >12345 / 123456</span
              >
            </div>
            <!-- Akses Siswa -->
            <div
              class="flex justify-between items-center bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors"
            >
              <span class="font-bold text-slate-600">Akses Siswa</span>
              <span
                class="font-mono font-bold text-emerald-700 bg-white px-2.5 py-1 rounded shadow-sm border border-emerald-100 text-[11px]"
                >1 / 123456</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
