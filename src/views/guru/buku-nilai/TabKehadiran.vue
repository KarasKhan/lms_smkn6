<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '../../../firebase'
import { doc, updateDoc } from 'firebase/firestore'

const props = defineProps({
  kelas: { type: Object, required: true },
})

const route = useRoute()
const idKelas = route.params.id

// ==========================================
// STATE FILTER & PENCARIAN BARU
// ==========================================
const rombelPilihan = ref('Semua')
const pencarianSiswa = ref('')
const semesterAktif = ref('1')

// ==========================================
// STATE & FUNGSI PENGATURAN FORMULA KEHADIRAN
// ==========================================
const tampilModalPengaturan = ref(false)
const sedangMenyimpan = ref(false)
const formBobot = ref({ p: 100, s: 100, i: 70, a: 0 })

// STATE BARU: Untuk menyimpan override lokal agar tidak me-mutasi props
const localPengaturan = ref(null)

const pengaturanKehadiran = computed(() => {
  return (
    localPengaturan.value || props.kelas.pengaturan_kehadiran || { p: 100, s: 100, i: 70, a: 0 }
  )
})

const bukaPengaturan = () => {
  formBobot.value = { ...pengaturanKehadiran.value }
  tampilModalPengaturan.value = true
}

const simpanPengaturanKehadiran = async () => {
  sedangMenyimpan.value = true
  try {
    formBobot.value.p = Math.min(Math.max(Number(formBobot.value.p) || 0, 0), 100)
    formBobot.value.s = Math.min(Math.max(Number(formBobot.value.s) || 0, 0), 100)
    formBobot.value.i = Math.min(Math.max(Number(formBobot.value.i) || 0, 0), 100)
    formBobot.value.a = Math.min(Math.max(Number(formBobot.value.a) || 0, 0), 100)

    const docRef = doc(db, 'kelas', idKelas)
    await updateDoc(docRef, { pengaturan_kehadiran: formBobot.value })

    localPengaturan.value = { ...formBobot.value }
    tampilModalPengaturan.value = false
  } catch (error) {
    console.error(error)
    alert('Gagal menyimpan formula kehadiran.')
  }
  sedangMenyimpan.value = false
}

// ==========================================
// LOGIKA TABEL & KALKULASI
// ==========================================
const daftarRombelUnik = computed(() => {
  if (!props.kelas || !props.kelas.siswa) return []
  const rombelSet = new Set(props.kelas.siswa.map((s) => s.rombel).filter(Boolean))
  return Array.from(rombelSet).sort()
})

const siswaTerurut = computed(() => {
  if (!props.kelas || !props.kelas.siswa) return []
  let listSiswa = [...props.kelas.siswa]

  if (rombelPilihan.value !== 'Semua') {
    listSiswa = listSiswa.filter((s) => s.rombel === rombelPilihan.value)
  }

  if (pencarianSiswa.value) {
    const kataKunci = pencarianSiswa.value.toLowerCase()
    listSiswa = listSiswa.filter(
      (s) => s.nama.toLowerCase().includes(kataKunci) || s.nis.toLowerCase().includes(kataKunci),
    )
  }

  return listSiswa.sort((a, b) => a.nama.localeCompare(b.nama))
})

const daftarPertemuan = computed(() => {
  const semuaPertemuan = props.kelas.pertemuan || []
  const pertemuanSemesterIni = semuaPertemuan.filter(
    (p) => (p.semester || '1') === semesterAktif.value,
  )

  if (rombelPilihan.value === 'Semua') {
    const uniqueKodes = [...new Set(pertemuanSemesterIni.map((p) => p.kode))]
    uniqueKodes.sort((a, b) => {
      const numA = parseInt(a.replace('H', '').replace('P', '')) || 0
      const numB = parseInt(b.replace('H', '').replace('P', '')) || 0
      return numA - numB
    })
    return uniqueKodes.map((kode) => ({
      id: 'grouped-' + kode,
      kode: kode.replace('H', 'P'),
      judul: 'Semua Rombel',
    }))
  }

  return pertemuanSemesterIni
    .filter((p) => p.rombel === rombelPilihan.value)
    .map((p) => ({
      ...p,
      kode: p.kode.replace('H', 'P'),
    }))
})

const getStatusKehadiran = (siswa, hari) => {
  let idTarget = hari.id

  if (hari.id.startsWith('grouped-')) {
    const originalKode = hari.kode.replace('P', 'H')
    const sesiAsliSiswa = props.kelas.pertemuan?.find(
      (p) => p.rombel === siswa.rombel && p.kode === originalKode,
    )
    if (!sesiAsliSiswa) return { kode: '-', kelas: 'bg-slate-100 text-slate-300' }
    idTarget = sesiAsliSiswa.id
  }

  const status = siswa.kehadiran?.[idTarget]

  if (status === 'P' || status === 'H')
    return { kode: 'P', kelas: 'bg-emerald-100 text-emerald-700 font-black' }
  if (status === 'A') return { kode: 'A', kelas: 'bg-red-100 text-red-700 font-black' }
  if (status === 'S') return { kode: 'S', kelas: 'bg-amber-100 text-amber-700 font-black' }
  if (status === 'I') return { kode: 'I', kelas: 'bg-blue-100 text-blue-700 font-black' }

  return { kode: '-', kelas: 'bg-slate-100 text-slate-300' }
}

const hitungPersentaseHadir = (siswa) => {
  const pertemuanSiswa = (props.kelas.pertemuan || []).filter(
    (p) => p.rombel === siswa.rombel && (p.semester || '1') === semesterAktif.value,
  )
  if (pertemuanSiswa.length === 0) return 0

  let totalPoin = 0
  const bobot = pengaturanKehadiran.value

  pertemuanSiswa.forEach((sesi) => {
    let status = siswa.kehadiran?.[sesi.id]
    if (status === 'H') status = 'P'

    if (status === 'P') totalPoin += Number(bobot.p)
    else if (status === 'S') totalPoin += Number(bobot.s)
    else if (status === 'I') totalPoin += Number(bobot.i)
    else if (status === 'A') totalPoin += Number(bobot.a)
    else totalPoin += Number(bobot.a)
  })

  const maksimalPoin = pertemuanSiswa.length * 100
  return Math.round((totalPoin / maksimalPoin) * 100)
}
</script>

<template>
  <div
    class="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden"
  >
    <!-- HEADER: LEGENDA & TOMBOL PENGATURAN -->
    <div
      class="bg-white border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_4px_10px_-5px_rgba(0,0,0,0.05)] z-20 shrink-0"
    >
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-5">
          <div
            class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
          >
            <span class="w-3 h-3 rounded-md bg-emerald-400"></span> Pertemuan (P)
          </div>
          <div
            class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
          >
            <span class="w-3 h-3 rounded-md bg-amber-400"></span> Sakit (S)
          </div>
          <div
            class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
          >
            <span class="w-3 h-3 rounded-md bg-blue-400"></span> Izin (I)
          </div>
          <div
            class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
          >
            <span class="w-3 h-3 rounded-md bg-red-400"></span> Alpa (A)
          </div>
        </div>
        <p class="text-[11px] font-bold text-slate-400">
          Total Kolom Ditampilkan: {{ daftarPertemuan.length }} Sesi
        </p>
      </div>

      <button
        @click="bukaPengaturan"
        class="text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 px-5 py-2.5 rounded-xl transition border border-slate-200 shadow-sm shrink-0"
      >
        ⚙️ Atur Poin Presensi
      </button>
    </div>

    <!-- AREA KONTROL: PENCARIAN & FILTER ROMBEL -->
    <div
      class="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
        <!-- Input Pencarian -->
        <div class="relative w-full sm:w-64 shrink-0">
          <input
            type="text"
            v-model="pencarianSiswa"
            placeholder="Cari Siswa..."
            class="w-full border border-slate-300 rounded-lg text-sm pl-9 pr-3 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none bg-white transition"
          />
          <svg
            class="w-4 h-4 text-slate-400 absolute left-3 top-2"
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
        <!-- Filter Semester -->
        <select
          v-model="semesterAktif"
          class="border border-slate-300 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 outline-none cursor-pointer"
        >
          <option value="1">Ganjil (Sem 1)</option>
          <option value="2">Genap (Sem 2)</option>
        </select>
      </div>

      <!-- Filter Rombel -->
      <div
        v-if="daftarRombelUnik.length > 1"
        class="flex items-center gap-2 w-full md:w-auto overflow-x-auto custom-scrollbar"
      >
        <span
          class="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 hidden sm:inline-block"
          >Filter Rombel:</span
        >
        <select
          v-model="rombelPilihan"
          class="w-full sm:w-auto border border-slate-300 rounded-lg text-xs font-bold text-slate-700 px-3 py-1.5 bg-white outline-none cursor-pointer"
        >
          <option value="Semua">Semua Kelas</option>
          <option v-for="rombel in daftarRombelUnik" :key="rombel" :value="rombel">
            {{ rombel }}
          </option>
        </select>
      </div>
    </div>
    <!-- END AREA KONTROL -->

    <!-- TABEL UTAMA -->
    <div class="flex-1 overflow-auto custom-scrollbar relative bg-slate-50/50">
      <table class="w-full border-collapse border-spacing-0 bg-white min-w-max">
        <thead class="bg-white shadow-sm relative z-30">
          <tr>
            <th
              class="sticky left-0 top-0 z-40 bg-white border-b border-slate-300 p-4 w-[60px] min-w-[60px] text-center align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
            >
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">No.</span>
            </th>
            <th
              class="sticky left-[60px] top-0 z-40 bg-white border-b border-r-4 border-slate-300 p-4 w-[240px] min-w-[240px] max-w-[240px] text-left align-middle shadow-[6px_0_10px_-4px_rgba(0,0,0,0.08)]"
            >
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider"
                >Identitas Siswa</span
              >
            </th>
            <th
              class="sticky top-0 z-30 bg-emerald-50 border-b border-r border-slate-200 p-2 w-[100px] min-w-[100px] max-w-[100px] text-center align-middle h-[44px]"
            >
              <p
                class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider leading-tight"
              >
                Persentase<br />Rombel
              </p>
            </th>
            <th
              v-for="hari in daftarPertemuan"
              :key="hari.id"
              class="sticky top-0 z-30 bg-slate-50 border-b border-r border-slate-200 p-2 min-w-[70px] text-center align-middle h-[44px]"
            >
              <p class="text-[11px] font-black text-slate-700 tracking-tight">{{ hari.kode }}</p>
              <p class="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{{ hari.judul }}</p>
            </th>
          </tr>
        </thead>
        <tbody class="text-sm">
          <tr
            v-for="(siswa, sIndex) in siswaTerurut"
            :key="siswa.nis"
            class="hover:bg-slate-50 transition-colors group"
          >
            <td
              class="sticky left-0 z-20 bg-white border-b border-slate-200 p-4 text-center group-hover:bg-slate-50 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
            >
              <span class="text-sm font-black text-slate-800">{{ sIndex + 1 }}.</span>
            </td>
            <td
              class="sticky left-[60px] z-20 bg-white border-b border-r-4 border-slate-300 p-4 group-hover:bg-slate-50 transition-colors shadow-[6px_0_10px_-4px_rgba(0,0,0,0.08)]"
            >
              <div>
                <p class="font-bold text-slate-800 leading-tight">{{ siswa.nama }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span
                    class="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[9px] border"
                    >{{ siswa.rombel || '?' }}</span
                  >
                  <span class="text-[10px] text-slate-400 font-medium">NIS: {{ siswa.nis }}</span>
                </div>
              </div>
            </td>
            <td class="border-b border-r border-slate-200 p-2 text-center bg-emerald-50/30">
              <span
                :class="[
                  'text-sm font-bold',
                  hitungPersentaseHadir(siswa) > 0 ? 'text-emerald-700' : 'text-slate-400',
                ]"
              >
                {{ hitungPersentaseHadir(siswa) }}%
              </span>
            </td>
            <td
              v-for="hari in daftarPertemuan"
              :key="`${siswa.nis}-${hari.id}`"
              class="border-b border-r border-slate-100 p-2 text-center hover:bg-slate-50 transition cursor-pointer"
            >
              <div
                :class="[
                  'w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-[11px] shadow-sm',
                  getStatusKehadiran(siswa, hari).kelas,
                ]"
              >
                {{ getStatusKehadiran(siswa, hari).kode }}
              </div>
            </td>
          </tr>
          <tr v-if="siswaTerurut.length === 0">
            <td
              :colspan="3 + daftarPertemuan.length"
              class="p-16 text-center text-slate-400 bg-white"
            >
              <span class="text-4xl block mb-3 opacity-50">📭</span>
              <p class="font-bold text-lg text-slate-500">Siswa tidak ditemukan.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- END TABEL UTAMA -->

    <!-- MODAL PENGATURAN POIN PRESENSI -->
    <Teleport to="body">
      <div
        v-if="tampilModalPengaturan"
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4 transition-opacity"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden"
        >
          <div
            class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"
          >
            <div>
              <h3 class="font-bold text-slate-800">Poin Status Presensi</h3>
              <p class="text-[10px] text-slate-500 mt-0.5">
                Tentukan nilai persentase untuk tiap status
              </p>
            </div>
            <button
              @click="tampilModalPengaturan = false"
              class="text-slate-400 hover:text-slate-600 text-xl"
            >
              &times;
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div class="flex items-center justify-between gap-4">
              <label class="text-sm font-bold text-emerald-700 flex-1">Pertemuan (P)</label>
              <div class="flex items-center gap-2 w-24">
                <input
                  type="number"
                  v-model="formBobot.p"
                  class="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-sm font-bold focus:border-emerald-500 outline-none"
                />
                <span class="text-slate-400 font-bold">%</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <label class="text-sm font-bold text-amber-700 flex-1">Sakit (S)</label>
              <div class="flex items-center gap-2 w-24">
                <input
                  type="number"
                  v-model="formBobot.s"
                  class="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-sm font-bold focus:border-amber-500 outline-none"
                />
                <span class="text-slate-400 font-bold">%</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <label class="text-sm font-bold text-blue-700 flex-1">Izin (I)</label>
              <div class="flex items-center gap-2 w-24">
                <input
                  type="number"
                  v-model="formBobot.i"
                  class="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-sm font-bold focus:border-blue-500 outline-none"
                />
                <span class="text-slate-400 font-bold">%</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <label class="text-sm font-bold text-red-700 flex-1">Alpa (A)</label>
              <div class="flex items-center gap-2 w-24">
                <input
                  type="number"
                  v-model="formBobot.a"
                  class="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-sm font-bold focus:border-red-500 outline-none"
                />
                <span class="text-slate-400 font-bold">%</span>
              </div>
            </div>
            <div
              class="bg-slate-50 p-3 rounded-lg border border-slate-100 text-[10px] text-slate-500 font-medium mt-2 leading-relaxed"
            >
              *Jika siswa sakit dengan surat, Anda dapat menyetel poinnya menjadi 100% agar nilai
              kehadirannya tidak berkurang.
            </div>
          </div>
          <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button
              @click="tampilModalPengaturan = false"
              class="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition"
            >
              Batal
            </button>
            <button
              @click="simpanPengaturanKehadiran"
              :disabled="sedangMenyimpan"
              class="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <!-- END MODAL PENGATURAN -->
  </div>
</template>

<style scoped>
th,
td {
  border: 1px solid #e2e8f0;
}
table {
  border-collapse: separate;
  border-spacing: 0;
}
.custom-scrollbar::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f8fafc;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
  border: 2px solid #f8fafc;
}
</style>
