<script setup>
import { ref, onMounted, computed } from 'vue'
import * as XLSX from 'xlsx'
import { db } from '../../firebase'
import { doc, writeBatch, updateDoc } from 'firebase/firestore'
import { useWakaStore } from '../../stores/wakaStore'

const wakaStore = useWakaStore()

// State UI
const modeUpload = ref(false)
const filterRombel = ref('')
const pencarianSiswa = ref('') // STATE BARU: Untuk kotak pencarian

// State Modal Edit
const tampilModalEdit = ref(false)
const sedangMenyimpanEdit = ref(false)
const formEdit = ref({
  nis: '',
  nama: '',
  rombel_aktif: '',
  status: '',
})

// State Upload Excel
const fileInput = ref(null)
const dataPreview = ref([])
const sedangMengunggah = ref(false)
const pesanStatus = ref('')

onMounted(() => {
  wakaStore.fetchSemuaSiswa()
})

// --- PERBAIKAN: Komputasi Filter Ganda (Rombel + Pencarian Teks) ---
const dataSiswaTerfilter = computed(() => {
  let hasil = wakaStore.daftarSiswa

  // 1. Filter berdasarkan Rombel
  if (filterRombel.value) {
    hasil = hasil.filter((siswa) => siswa.rombel_aktif === filterRombel.value)
  }

  // 2. Filter berdasarkan Pencarian (NIS atau Nama)
  if (pencarianSiswa.value) {
    const kataKunci = pencarianSiswa.value.toLowerCase()
    hasil = hasil.filter(
      (siswa) =>
        siswa.nama.toLowerCase().includes(kataKunci) || siswa.nis.toLowerCase().includes(kataKunci),
    )
  }

  return hasil
})

const daftarRombelUnik = computed(() => {
  const rombel = wakaStore.daftarSiswa.map((s) => s.rombel_aktif)
  return [...new Set(rombel)].sort()
})

// --- FUNGSI EDIT SISWA ---
const bukaModalEdit = (siswa) => {
  formEdit.value = { ...siswa }
  tampilModalEdit.value = true
}

const tutupModalEdit = () => {
  tampilModalEdit.value = false
}

const simpanPerubahanSiswa = async () => {
  sedangMenyimpanEdit.value = true
  try {
    const docRef = doc(db, 'users', formEdit.value.nis)
    await updateDoc(docRef, {
      nama: formEdit.value.nama,
      rombel_aktif: formEdit.value.rombel_aktif,
      status: formEdit.value.status,
    })

    const indexSiswa = wakaStore.daftarSiswa.findIndex((s) => s.nis === formEdit.value.nis)
    if (indexSiswa !== -1) {
      wakaStore.daftarSiswa[indexSiswa] = { ...formEdit.value }
    }

    tutupModalEdit()
  } catch (error) {
    console.error('Gagal update data:', error)
    alert('Terjadi kesalahan saat menyimpan perubahan.')
  } finally {
    sedangMenyimpanEdit.value = false
  }
}
// -------------------------

const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result)
    const workbook = XLSX.read(data, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawData = XLSX.utils.sheet_to_json(worksheet)

    dataPreview.value = rawData
      .map((item) => ({
        nis: String(item.NIS || '').trim(),
        nama: String(item.Nama || '').trim(),
        rombel_aktif: String(item.Rombel || '').trim(),
        tahun_masuk: Number(item['Tahun Masuk'] || new Date().getFullYear()),
        role: 'siswa',
        status: 'aktif',
      }))
      .filter((siswa) => siswa.nis && siswa.nama)
  }
  reader.readAsArrayBuffer(file)
}

const pancingPilihFile = () => {
  fileInput.value.click()
}

const simpanKeFirebase = async () => {
  if (dataPreview.value.length === 0) return

  sedangMengunggah.value = true
  pesanStatus.value = 'Memproses unggahan data...'

  try {
    let urutanData = 0
    const UKURAN_BATCH = 400

    while (urutanData < dataPreview.value.length) {
      const batch = writeBatch(db)
      const potonganSiswa = dataPreview.value.slice(urutanData, urutanData + UKURAN_BATCH)

      potonganSiswa.forEach((siswa) => {
        const docRef = doc(db, 'users', siswa.nis)
        batch.set(docRef, { ...siswa })
      })

      await batch.commit()
      urutanData += UKURAN_BATCH
    }

    alert('Data siswa berhasil diunggah.')
    dataPreview.value = []
    modeUpload.value = false
    wakaStore.fetchSemuaSiswa(true)
  } catch (error) {
    console.error('Upload gagal:', error)
    alert('Terjadi kesalahan pada sistem.')
  } finally {
    sedangMengunggah.value = false
    pesanStatus.value = ''
  }
}

const getWarnaStatus = (status) => {
  switch (status) {
    case 'aktif':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'keluar':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'pindah':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'lulus':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}
</script>

<template>
  <div class="relative">
    <div class="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 tracking-tight">Data Induk Siswa</h1>
        <p class="text-sm text-gray-500 mt-1">Manajemen dan sinkronisasi data siswa aktif.</p>
      </div>

      <div class="flex gap-3">
        <button
          v-if="!modeUpload"
          @click="modeUpload = true"
          class="bg-gray-900 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-gray-800 transition shadow-sm"
        >
          Unggah Data (Excel)
        </button>
        <button
          v-else
          @click="modeUpload = false"
          class="bg-white text-gray-700 border border-gray-300 px-4 py-2 text-sm font-medium rounded-md hover:bg-gray-50 transition"
        >
          Batal Unggah
        </button>
      </div>
    </div>

    <div v-if="!modeUpload">
      <div
        class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm"
      >
        <div class="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div class="relative w-full sm:w-64">
            <input
              type="text"
              v-model="pencarianSiswa"
              placeholder="Cari NIS atau Nama Siswa..."
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

          <div class="hidden sm:block w-px h-6 bg-gray-200"></div>

          <div class="flex items-center gap-2 w-full sm:w-auto">
            <label class="text-sm font-medium text-gray-500 whitespace-nowrap"
              >Filter Rombel:</label
            >
            <select
              v-model="filterRombel"
              class="border border-gray-300 rounded-md text-sm px-3 py-1.5 focus:ring-1 focus:ring-gray-900 focus:outline-none bg-white w-full sm:w-auto"
            >
              <option value="">Semua Rombel</option>
              <option v-for="rombel in daftarRombelUnik" :key="rombel" :value="rombel">
                {{ rombel }}
              </option>
            </select>
          </div>
        </div>

        <button
          @click="wakaStore.fetchSemuaSiswa(true)"
          :disabled="wakaStore.sedangMemuat"
          class="text-sm text-blue-600 hover:text-blue-800 font-bold whitespace-nowrap flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-md transition disabled:opacity-50"
        >
          <svg
            :class="['w-4 h-4', wakaStore.sedangMemuat ? 'animate-spin' : '']"
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
          {{ wakaStore.sedangMemuat ? 'Menyinkronkan...' : 'Muat Ulang Data' }}
        </button>
      </div>

      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-6 py-3 font-semibold text-gray-600">NIS</th>
              <th class="px-6 py-3 font-semibold text-gray-600">Nama Lengkap</th>
              <th class="px-6 py-3 font-semibold text-gray-600">Rombel Aktif</th>
              <th class="px-6 py-3 font-semibold text-gray-600 text-center">Tahun Masuk</th>
              <th class="px-6 py-3 font-semibold text-gray-600 text-center">Status</th>
              <th class="px-6 py-3 font-semibold text-gray-600 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="wakaStore.sedangMemuat" class="bg-white">
              <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                Menyinkronkan data dengan server...
              </td>
            </tr>
            <tr v-else-if="dataSiswaTerfilter.length === 0" class="bg-white">
              <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                <span class="text-3xl block mb-2 opacity-50">🔍</span>
                Tidak ada data siswa yang cocok dengan filter atau pencarian Anda.
              </td>
            </tr>
            <tr
              v-else
              v-for="siswa in dataSiswaTerfilter"
              :key="siswa.nis"
              class="hover:bg-blue-50/30 transition-colors"
            >
              <td class="px-6 py-3 font-mono text-gray-700">{{ siswa.nis }}</td>
              <td class="px-6 py-3 font-bold text-gray-900">{{ siswa.nama }}</td>
              <td class="px-6 py-3 font-medium text-gray-600">{{ siswa.rombel_aktif }}</td>
              <td class="px-6 py-3 text-gray-500 text-center">{{ siswa.tahun_masuk }}</td>
              <td class="px-6 py-3 text-center">
                <span
                  :class="[
                    'px-2.5 py-1 border rounded-md text-[10px] font-bold uppercase tracking-wider',
                    getWarnaStatus(siswa.status),
                  ]"
                >
                  {{ siswa.status }}
                </span>
              </td>
              <td class="px-6 py-3 text-right">
                <button
                  @click="bukaModalEdit(siswa)"
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
        Menampilkan {{ dataSiswaTerfilter.length }} dari total
        {{ wakaStore.daftarSiswa.length }} siswa.
      </div>
    </div>

    <div v-else>
      <div class="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
        <h2 class="text-lg font-bold text-gray-900 mb-4">Proses Impor Data Siswa</h2>

        <input
          type="file"
          ref="fileInput"
          accept=".xlsx, .xls"
          @change="handleFileChange"
          class="hidden"
        />

        <div class="flex gap-3 mb-6">
          <button
            @click="pancingPilihFile"
            :disabled="sedangMengunggah"
            class="bg-white border border-gray-300 text-gray-700 px-4 py-2 text-sm font-bold rounded-md hover:bg-gray-50 transition shadow-sm"
          >
            Pilih File Excel (.xlsx)
          </button>

          <button
            v-if="dataPreview.length > 0"
            @click="simpanKeFirebase"
            :disabled="sedangMengunggah"
            class="bg-gray-900 text-white px-5 py-2 text-sm font-bold rounded-md hover:bg-gray-800 transition disabled:bg-gray-400 shadow-sm"
          >
            {{
              sedangMengunggah
                ? 'Menyimpan ke Server...'
                : 'Simpan Data (' + dataPreview.length + ' baris)'
            }}
          </button>
        </div>

        <div
          v-if="pesanStatus"
          class="mb-4 text-sm font-bold text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100"
        >
          {{ pesanStatus }}
        </div>

        <div
          v-if="dataPreview.length > 0"
          class="border border-gray-200 rounded-lg overflow-hidden"
        >
          <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider"
              >Pratampilan Berkas</span
            >
          </div>
          <div class="overflow-y-auto max-h-[400px]">
            <table class="w-full text-left text-sm">
              <thead class="sticky top-0 bg-white border-b border-gray-200 shadow-sm">
                <tr>
                  <th class="px-4 py-3 font-semibold text-gray-600">NIS</th>
                  <th class="px-4 py-3 font-semibold text-gray-600">Nama Lengkap</th>
                  <th class="px-4 py-3 font-semibold text-gray-600">Rombel</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="siswa in dataPreview" :key="siswa.nis" class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-mono text-gray-700">{{ siswa.nis }}</td>
                  <td class="px-4 py-3 font-medium text-gray-900">{{ siswa.nama }}</td>
                  <td class="px-4 py-3 text-gray-600">{{ siswa.rombel_aktif }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="tampilModalEdit"
      class="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden"
      >
        <div
          class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"
        >
          <h3 class="font-bold text-gray-800">Edit Data Siswa</h3>
          <button
            @click="tutupModalEdit"
            class="text-gray-400 hover:text-gray-600 text-xl font-light w-8 h-8 flex items-center justify-center hover:bg-white rounded-full transition"
          >
            &times;
          </button>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1"
              >NIS (Tidak dapat diubah)</label
            >
            <input
              type="text"
              v-model="formEdit.nis"
              disabled
              class="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1"
              >Nama Lengkap</label
            >
            <input
              type="text"
              v-model="formEdit.nama"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-gray-800"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1"
              >Rombel Aktif</label
            >
            <input
              type="text"
              v-model="formEdit.rombel_aktif"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none font-medium text-gray-800"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1"
              >Status Keanggotaan</label
            >
            <select
              v-model="formEdit.status"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none bg-white font-medium text-gray-800"
            >
              <option value="aktif">Aktif</option>
              <option value="keluar">Keluar / Drop Out</option>
              <option value="pindah">Pindah Sekolah</option>
              <option value="lulus">Lulus</option>
            </select>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            @click="tutupModalEdit"
            class="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition shadow-sm"
          >
            Batal
          </button>
          <button
            @click="simpanPerubahanSiswa"
            :disabled="sedangMenyimpanEdit"
            class="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition shadow-sm"
          >
            {{ sedangMenyimpanEdit ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
