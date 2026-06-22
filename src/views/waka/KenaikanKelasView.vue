<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useWakaStore } from '../../stores/wakaStore'
import { useUiStore } from '../../stores/uiStore'
import { db } from '../../firebase'
import { doc, writeBatch } from 'firebase/firestore'

const wakaStore = useWakaStore()
const uiStore = useUiStore()

// State Formulir
const rombelAsal = ref('')
const rombelTujuan = ref('')
const sedangMemproses = ref(false)

// State Lokal untuk Checklist Siswa (agar tidak mengubah state Pinia secara langsung sebelum di-save)
const listSiswaLokal = ref([])

onMounted(() => {
  // Pastikan data tersedia. Jika belum ada di cache, Pinia akan otomatis mengambilnya dari Firebase.
  if (wakaStore.daftarSiswa.length === 0) {
    wakaStore.fetchSemuaSiswa()
  }
})

// Mengambil daftar rombel unik HANYA dari siswa yang statusnya 'aktif'
const daftarRombelUnik = computed(() => {
  const rombel = wakaStore.daftarSiswa
    .filter((s) => s.status === 'aktif')
    .map((s) => s.rombel_aktif)
  return [...new Set(rombel)].sort()
})

// Memantau perubahan dropdown "Rombel Asal" untuk memuat daftar siswa ke tabel lokal
watch(rombelAsal, (nilaiBaru) => {
  if (nilaiBaru) {
    listSiswaLokal.value = wakaStore.daftarSiswa
      .filter((s) => s.rombel_aktif === nilaiBaru && s.status === 'aktif')
      // Default semua siswa tercentang (naik kelas)
      .map((s) => ({ ...s, dipilih: true }))
  } else {
    listSiswaLokal.value = []
  }
})

// Kalkulasi ringkasan
const jumlahDipromosikan = computed(() => listSiswaLokal.value.filter((s) => s.dipilih).length)
const jumlahTinggal = computed(() => listSiswaLokal.value.filter((s) => !s.dipilih).length)

// Fungsi Checklist Master (Pilih Semua / Batal Pilih Semua)
const togglePilihSemua = (event) => {
  const isChecked = event.target.checked
  listSiswaLokal.value.forEach((s) => (s.dipilih = isChecked))
}

// Eksekusi Pembaruan Database
const prosesKenaikan = async () => {
  if (!rombelAsal.value || !rombelTujuan.value) {
    alert('Mohon pilih Rombel Asal dan isi Rombel Tujuan terlebih dahulu.')
    return
  }

  if (jumlahDipromosikan.value === 0) {
    alert('Tidak ada siswa yang dipilih untuk dipromosikan.')
    return
  }

  const konfirmasi = confirm(
    `Anda yakin ingin memindahkan ${jumlahDipromosikan.value} siswa dari ${rombelAsal.value} ke ${rombelTujuan.value}?`,
  )
  if (!konfirmasi) return

  sedangMemproses.value = true

  // Tampilkan layar loading dan kunci aksi pengguna
  uiStore.showLoading(`Memigrasi ${jumlahDipromosikan.value} siswa ke kelas baru...`)

  try {
    const siswaNaik = listSiswaLokal.value.filter((s) => s.dipilih)

    // Strategi Batch Write untuk menghindari limit dan menghemat kuota Write
    let urutanData = 0
    const UKURAN_BATCH = 400

    while (urutanData < siswaNaik.length) {
      const batch = writeBatch(db)
      const potongan = siswaNaik.slice(urutanData, urutanData + UKURAN_BATCH)

      potongan.forEach((siswa) => {
        const docRef = doc(db, 'users', siswa.nis)
        // Hanya update field rombel_aktif, data lainnya dibiarkan utuh
        batch.update(docRef, { rombel_aktif: rombelTujuan.value })
      })

      await batch.commit()
      urutanData += UKURAN_BATCH
    }

    // UPDATE CACHE LOKAL: Agar tabel Master Siswa ikut terupdate tanpa harus fetch Firebase lagi!
    siswaNaik.forEach((siswaNaikItem) => {
      const index = wakaStore.daftarSiswa.findIndex((s) => s.nis === siswaNaikItem.nis)
      if (index !== -1) {
        wakaStore.daftarSiswa[index].rombel_aktif = rombelTujuan.value
      }
    })

    alert('Proses pemindahan kelas berhasil dieksekusi.')

    // Reset Form
    rombelAsal.value = ''
    rombelTujuan.value = ''
    listSiswaLokal.value = []
  } catch (error) {
    console.error('Gagal memproses pemindahan kelas:', error)
    alert('Terjadi kesalahan sistem saat memperbarui data server.')
  } finally {
    sedangMemproses.value = false

    // Matikan layar loading saat proses selesai
    uiStore.hideLoading()
  }
}
</script>

<template>
  <div class="relative">
    <div class="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 tracking-tight">Mutasi & Kenaikan Kelas</h1>
        <p class="text-sm text-gray-500 mt-1">
          Pemindahan rombongan belajar secara massal pada tahun ajaran baru.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div class="lg:col-span-8">
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div
            class="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50"
          >
            <div class="flex items-center gap-3">
              <label class="text-sm font-semibold text-gray-700">Rombel Asal:</label>
              <select
                v-model="rombelAsal"
                class="border border-gray-300 rounded-md text-sm px-3 py-2 focus:ring-1 focus:ring-gray-900 focus:outline-none bg-white min-w-[150px]"
              >
                <option value="">-- Pilih Rombel --</option>
                <option v-for="rombel in daftarRombelUnik" :key="rombel" :value="rombel">
                  {{ rombel }}
                </option>
              </select>
            </div>

            <div v-if="rombelAsal" class="text-sm font-medium text-gray-500">
              Total: {{ listSiswaLokal.length }} Siswa Aktif
            </div>
          </div>

          <div v-if="!rombelAsal" class="p-12 text-center text-gray-400 text-sm">
            Silakan pilih Rombel Asal untuk memuat daftar siswa.
          </div>

          <div v-else-if="wakaStore.sedangMemuat" class="p-12 text-center text-gray-400 text-sm">
            Memuat data...
          </div>

          <div v-else class="overflow-x-auto max-h-[500px]">
            <table class="w-full text-left text-sm">
              <thead class="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-10">
                <tr>
                  <th class="px-4 py-3 text-center w-12">
                    <input
                      type="checkbox"
                      checked
                      @change="togglePilihSemua"
                      class="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900 cursor-pointer"
                    />
                  </th>
                  <th class="px-4 py-3 font-semibold text-gray-600">NIS</th>
                  <th class="px-4 py-3 font-semibold text-gray-600">Nama Lengkap Siswa</th>
                  <th class="px-4 py-3 font-semibold text-gray-600 text-right">Status Tindakan</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="siswa in listSiswaLokal"
                  :key="siswa.nis"
                  :class="[
                    'transition-colors',
                    siswa.dipilih ? 'hover:bg-gray-50' : 'bg-red-50/30',
                  ]"
                >
                  <td class="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      v-model="siswa.dipilih"
                      class="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900 cursor-pointer"
                    />
                  </td>
                  <td class="px-4 py-3 font-mono text-gray-700">{{ siswa.nis }}</td>
                  <td
                    class="px-4 py-3 font-medium text-gray-900"
                    :class="{ 'line-through text-gray-400': !siswa.dipilih }"
                  >
                    {{ siswa.nama }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <span v-if="siswa.dipilih" class="text-xs font-semibold text-green-600"
                      >Dipromosikan</span
                    >
                    <span v-else class="text-xs font-semibold text-red-500">Tinggal Kelas</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="lg:col-span-4">
        <div class="bg-gray-50 border border-gray-200 rounded-lg shadow-sm p-6 sticky top-6">
          <h3 class="font-bold text-gray-800 border-b border-gray-200 pb-3 mb-4">
            Pengaturan Tujuan
          </h3>

          <div class="space-y-5">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1.5"
                >Rombel Tujuan (Baru)</label
              >
              <input
                type="text"
                v-model="rombelTujuan"
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-gray-900 focus:outline-none bg-white uppercase"
                placeholder="Contoh: XI RPL 1"
                :disabled="!rombelAsal || listSiswaLokal.length === 0"
              />
            </div>

            <div class="bg-white border border-gray-200 rounded-md p-4">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Ringkasan Eksekusi
              </p>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between items-center pb-2 border-b border-gray-100">
                  <span class="text-gray-600">Naik ke Kelas Baru</span>
                  <span class="font-bold text-gray-900">{{ jumlahDipromosikan }} Siswa</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-600">Tetap di Rombel Lama</span>
                  <span class="font-bold text-red-600">{{ jumlahTinggal }} Siswa</span>
                </div>
              </div>
            </div>

            <button
              @click="prosesKenaikan"
              :disabled="
                sedangMemproses || !rombelAsal || !rombelTujuan || jumlahDipromosikan === 0
              "
              class="w-full bg-gray-900 text-white font-medium py-2.5 rounded-md hover:bg-gray-800 transition disabled:bg-gray-300 disabled:text-gray-500"
            >
              {{ sedangMemproses ? 'Mengeksekusi Data...' : 'Proses Pemindahan Kelas' }}
            </button>

            <p class="text-xs text-gray-500 text-center mt-3 leading-relaxed">
              Tindakan ini akan memperbarui data rombel aktif siswa. Rekam jejak nilai pada kelas di
              tahun ajaran sebelumnya tidak akan terhapus.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
