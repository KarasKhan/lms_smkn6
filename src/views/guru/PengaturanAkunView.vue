<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../../firebase'
import { doc, updateDoc } from 'firebase/firestore'

// Mengambil data dari sesi login (LocalStorage)
const formProfil = ref({
  nip: '',
  nama: '',
})

onMounted(() => {
  // Ambil dari sesi aktif
  formProfil.value.nip = localStorage.getItem('user_nip') || '199011242022211005'
  formProfil.value.nama = localStorage.getItem('user_nama') || 'Eko Prasetyo, S.Kom'
})

const formPassword = ref({
  passwordLama: '',
  passwordBaru: '',
  konfirmasiPassword: '',
})

const sedangMenyimpan = ref(false)

// 1. UPDATE NAMA PROFIL KE FIREBASE
const simpanProfil = async () => {
  sedangMenyimpan.value = true
  try {
    const docRef = doc(db, 'users', formProfil.value.nip)
    await updateDoc(docRef, { nama: formProfil.value.nama })

    // Update data lokal
    localStorage.setItem('user_nama', formProfil.value.nama)
    alert('Profil berhasil diperbarui di database!')
  } catch (error) {
    console.error(error)
    alert('Terjadi kesalahan saat mengupdate profil ke server.')
  }
  sedangMenyimpan.value = false
}

// 2. UPDATE PASSWORD KE FIREBASE
const ubahPassword = async () => {
  if (formPassword.value.passwordBaru !== formPassword.value.konfirmasiPassword) {
    return alert('Konfirmasi password baru tidak cocok!')
  }
  if (formPassword.value.passwordBaru.length < 6) {
    return alert('Password baru minimal 6 karakter.')
  }

  sedangMenyimpan.value = true
  try {
    const docRef = doc(db, 'users', formProfil.value.nip)

    // Simpan password baru ke koleksi users (Sebagai simulasi sebelum migrasi total ke Firebase Auth Backend)
    await updateDoc(docRef, { password: formPassword.value.passwordBaru })

    alert('Password berhasil diubah! Silakan gunakan password baru pada login berikutnya.')
    formPassword.value = { passwordLama: '', passwordBaru: '', konfirmasiPassword: '' }
  } catch (error) {
    console.error(error)
    alert('Terjadi kesalahan saat mengubah password.')
  }
  sedangMenyimpan.value = false
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
    <div class="border-b border-slate-200 pb-4">
      <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Pengaturan Akun</h1>
      <p class="text-sm text-slate-500 mt-1">Kelola informasi profil dan keamanan akun Anda.</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div class="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 class="font-bold text-slate-800">Informasi Pribadi</h2>
            <p class="text-xs text-slate-500 mt-1">
              Data ini ditampilkan kepada siswa di ruang kelas.
            </p>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1"
                >NIP / Kode Identitas</label
              >
              <input
                type="text"
                v-model="formProfil.nip"
                disabled
                class="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
              />
              <p class="text-[10px] text-slate-400 mt-1">
                NIP tidak dapat diubah. Hubungi Waka Kurikulum jika terdapat kesalahan.
              </p>
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1"
                >Nama Lengkap & Gelar</label
              >
              <input
                type="text"
                v-model="formProfil.nama"
                class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition"
              />
            </div>
            <div class="pt-2">
              <button
                @click="simpanProfil"
                :disabled="sedangMenyimpan"
                class="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-sm shadow-blue-200 disabled:opacity-50"
              >
                {{ sedangMenyimpan ? 'Menyimpan...' : 'Simpan Perubahan Profil' }}
              </button>
            </div>
          </div>
        </div>

        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div class="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 class="font-bold text-slate-800">Keamanan & Sandi</h2>
            <p class="text-xs text-slate-500 mt-1">
              Pastikan Anda menggunakan kata sandi yang kuat.
            </p>
          </div>
          <div class="p-6 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <label class="block text-sm font-bold text-slate-700 mb-1">Password Baru</label>
                <input
                  type="password"
                  v-model="formPassword.passwordBaru"
                  class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition"
                />
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-700 mb-1"
                  >Konfirmasi Password Baru</label
                >
                <input
                  type="password"
                  v-model="formPassword.konfirmasiPassword"
                  class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>
            <div class="pt-2">
              <button
                @click="ubahPassword"
                :disabled="sedangMenyimpan || !formPassword.passwordBaru"
                class="bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-900 transition shadow-sm disabled:opacity-50"
              >
                Perbarui Password
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="lg:col-span-1">
        <div
          class="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col items-center text-center sticky top-6"
        >
          <div
            class="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-4xl font-black shadow-lg shadow-blue-200 mb-4 ring-4 ring-white"
          >
            {{ formProfil.nama.charAt(0) || 'G' }}
          </div>
          <h3 class="font-bold text-slate-800 text-lg">{{ formProfil.nama }}</h3>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Tenaga Pendidik
          </p>

          <div class="w-full h-px bg-slate-100 my-6"></div>

          <div class="w-full text-left space-y-3">
            <div>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NIP</p>
              <p class="text-sm font-medium text-slate-700">{{ formProfil.nip }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Status Akun
              </p>
              <span
                class="inline-block mt-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md"
                >AKTIF TERSINKRONISASI</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
