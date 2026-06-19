<script setup>
import { ref, onMounted, computed } from 'vue'
import { db } from '../../firebase'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { useWakaStore } from '../../stores/wakaStore'

const wakaStore = useWakaStore()

// State UI Form & Modal
const tampilModalGuru = ref(false)
const modeEdit = ref(false)
const sedangMenyimpan = ref(false)
const pencarianGuru = ref('') // STATE BARU: Untuk kotak pencarian

const formGuru = ref({
  nip: '',
  nama: '',
  status: 'aktif',
})

onMounted(() => {
  wakaStore.fetchSemuaGuru()
})

// --- KOMPUTASI PENCARIAN GURU ---
const dataGuruTerfilter = computed(() => {
  let hasil = wakaStore.daftarGuru

  if (pencarianGuru.value) {
    const kataKunci = pencarianGuru.value.toLowerCase()
    hasil = hasil.filter(
      (guru) =>
        (guru.nama && guru.nama.toLowerCase().includes(kataKunci)) ||
        (guru.nip && guru.nip.toLowerCase().includes(kataKunci)),
    )
  }

  return hasil
})

const bukaModalTambah = () => {
  modeEdit.value = false
  formGuru.value = { nip: '', nama: '', status: 'aktif' }
  tampilModalGuru.value = true
}

const bukaModalEdit = (guru) => {
  modeEdit.value = true
  formGuru.value = { ...guru }
  tampilModalGuru.value = true
}

const tutupModal = () => {
  tampilModalGuru.value = false
}

const simpanDataGuru = async () => {
  if (!formGuru.value.nip || !formGuru.value.nama) {
    alert('NIP/Kode Guru dan Nama Lengkap wajib diisi.')
    return
  }

  sedangMenyimpan.value = true
  try {
    const docRef = doc(db, 'users', formGuru.value.nip.trim())

    if (modeEdit.value) {
      await updateDoc(docRef, {
        nama: formGuru.value.nama,
        status: formGuru.value.status,
      })
      const index = wakaStore.daftarGuru.findIndex((g) => g.nip === formGuru.value.nip)
      if (index !== -1) wakaStore.daftarGuru[index] = { ...formGuru.value }
    } else {
      const dataBaru = {
        nip: formGuru.value.nip.trim(),
        nama: formGuru.value.nama,
        role: 'guru',
        status: formGuru.value.status,
      }
      await setDoc(docRef, dataBaru)
      wakaStore.daftarGuru.push(dataBaru)
    }

    tutupModal()
  } catch (error) {
    console.error('Gagal menyimpan data guru:', error)
    alert('Terjadi kesalahan sistem saat menyimpan data.')
  } finally {
    sedangMenyimpan.value = false
  }
}

const getWarnaStatus = (status) => {
  return status === 'aktif'
    ? 'bg-green-50 text-green-700 border-green-200'
    : 'bg-red-50 text-red-700 border-red-200'
}
</script>

<template>
  <div class="relative">
    <div class="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 tracking-tight">Data Induk Guru</h1>
        <p class="text-sm text-gray-500 mt-1">
          Registrasi dan otorisasi hak akses tenaga pendidik.
        </p>
      </div>

      <button
        @click="bukaModalTambah"
        class="bg-gray-900 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-gray-800 transition shadow-sm"
      >
        Tambah Guru Baru
      </button>
    </div>

    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm"
    >
      <div class="relative w-full md:w-80">
        <input
          type="text"
          v-model="pencarianGuru"
          placeholder="Cari NIP atau Nama Guru..."
          class="w-full border border-gray-300 rounded-md text-sm pl-9 pr-3 py-1.5 focus:ring-1 focus:ring-gray-900 focus:outline-none bg-gray-50/50 focus:bg-white transition"
        />
        <svg
          class="w-4 h-4 text-gray-400 absolute left-3 top-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          ></path>
        </svg>
      </div>

      <button
        @click="wakaStore.fetchSemuaGuru(true)"
        :disabled="wakaStore.sedangMemuatGuru"
        class="text-sm text-blue-600 hover:text-blue-800 font-bold whitespace-nowrap flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-md transition disabled:opacity-50"
      >
        <svg
          :class="['w-4 h-4', wakaStore.sedangMemuatGuru ? 'animate-spin' : '']"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          ></path>
        </svg>
        {{ wakaStore.sedangMemuatGuru ? 'Menyinkronkan...' : 'Muat Ulang Data' }}
      </button>
    </div>

    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-6 py-3 font-semibold text-gray-600">NIP / Kode Identitas</th>
            <th class="px-6 py-3 font-semibold text-gray-600">Nama Lengkap Tenaga Pendidik</th>
            <th class="px-6 py-3 font-semibold text-gray-600 text-center">Hak Akses Sistem</th>
            <th class="px-6 py-3 font-semibold text-gray-600 text-center">Status Keaktifan</th>
            <th class="px-6 py-3 font-semibold text-gray-600 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="wakaStore.sedangMemuatGuru" class="bg-white">
            <td colspan="5" class="px-6 py-12 text-center text-gray-500">
              Menyinkronkan data dengan server...
            </td>
          </tr>
          <tr v-else-if="dataGuruTerfilter.length === 0" class="bg-white">
            <td colspan="5" class="px-6 py-12 text-center text-gray-500">
              <span class="text-3xl block mb-2 opacity-50">🔍</span>
              Tidak ada data guru yang cocok dengan pencarian Anda.
            </td>
          </tr>
          <tr
            v-else
            v-for="guru in dataGuruTerfilter"
            :key="guru.nip"
            class="hover:bg-blue-50/30 transition-colors"
          >
            <td class="px-6 py-3 font-mono text-gray-700">{{ guru.nip }}</td>
            <td class="px-6 py-3 font-bold text-gray-900">{{ guru.nama }}</td>
            <td class="px-6 py-3 text-center">
              <span
                class="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200"
              >
                {{ guru.role }}
              </span>
            </td>
            <td class="px-6 py-3 text-center">
              <span
                :class="[
                  'px-2.5 py-1 border rounded-md text-[10px] font-bold uppercase tracking-wider',
                  getWarnaStatus(guru.status),
                ]"
              >
                {{ guru.status }}
              </span>
            </td>
            <td class="px-6 py-3 text-right">
              <button
                @click="bukaModalEdit(guru)"
                class="text-indigo-600 hover:text-indigo-900 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition"
              >
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-4 text-right text-xs font-medium text-gray-400">
      Menampilkan {{ dataGuruTerfilter.length }} dari total {{ wakaStore.daftarGuru.length }} guru.
    </div>

    <div
      v-if="tampilModalGuru"
      class="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden"
      >
        <div
          class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"
        >
          <h3 class="font-bold text-gray-800">
            {{ modeEdit ? 'Perbarui Data Guru' : 'Registrasi Guru Baru' }}
          </h3>
          <button
            @click="tutupModal"
            class="text-gray-400 hover:text-gray-600 text-xl font-light w-8 h-8 flex items-center justify-center hover:bg-white rounded-full transition"
          >
            &times;
          </button>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1"
              >NIP / Kode Guru</label
            >
            <input
              type="text"
              v-model="formGuru.nip"
              :disabled="modeEdit"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-500 font-mono"
              placeholder="Contoh: 19901124..."
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1"
              >Nama Lengkap & Gelar</label
            >
            <input
              type="text"
              v-model="formGuru.nama"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-gray-800"
              placeholder="Contoh: Eko Prasetyo, S.Kom."
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1"
              >Status Keaktifan</label
            >
            <select
              v-model="formGuru.status"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none bg-white font-medium text-gray-800"
            >
              <option value="aktif">Aktif (Diberikan Hak Akses)</option>
              <option value="nonaktif">Nonaktif / Mutasi Keluar</option>
            </select>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            @click="tutupModal"
            class="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition shadow-sm"
          >
            Batal
          </button>
          <button
            @click="simpanDataGuru"
            :disabled="sedangMenyimpan"
            class="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition shadow-sm"
          >
            {{ sedangMenyimpan ? 'Menyimpan...' : 'Simpan Data' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
