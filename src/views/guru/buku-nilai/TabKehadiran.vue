<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  kelas: { type: Object, required: true },
})

const rombelPilihan = ref('Semua')

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
  return listSiswa.sort((a, b) => a.nama.localeCompare(b.nama))
})

// LOGIKA BARU: Penyatuan Kolom (H1, H2, dsb) untuk Mode "Semua Rombel"
const daftarPertemuan = computed(() => {
  const semuaPertemuan = props.kelas.pertemuan || []

  if (rombelPilihan.value === 'Semua') {
    // 1. Ambil kode unik saja (H1, H2, H3)
    const uniqueKodes = [...new Set(semuaPertemuan.map((p) => p.kode))]

    // 2. Urutkan berdasarkan angka di belakang 'H'
    uniqueKodes.sort((a, b) => {
      const numA = parseInt(a.replace('H', '')) || 0
      const numB = parseInt(b.replace('H', '')) || 0
      return numA - numB
    })

    // 3. Buat kerangka kolom virtual
    return uniqueKodes.map((kode) => ({
      id: 'grouped-' + kode, // Penanda ini adalah kolom gabungan
      kode: kode,
      judul: 'Semua Rombel',
    }))
  }

  // Jika memfilter rombel spesifik, tampilkan seperti biasa
  return semuaPertemuan.filter((p) => p.rombel === rombelPilihan.value)
})

const getStatusKehadiran = (siswa, hari) => {
  let idTarget = hari.id

  // Jika sedang mode "Semua Rombel" (kolom gabungan), cari ID sesi asli untuk siswa ini
  if (hari.id.startsWith('grouped-')) {
    const sesiAsliSiswa = props.kelas.pertemuan?.find(
      (p) => p.rombel === siswa.rombel && p.kode === hari.kode,
    )
    if (!sesiAsliSiswa) return { kode: '-', kelas: 'bg-slate-100 text-slate-300' }
    idTarget = sesiAsliSiswa.id
  }

  const status = siswa.kehadiran?.[idTarget]

  if (status === 'H') return { kode: 'H', kelas: 'bg-emerald-100 text-emerald-700 font-black' }
  if (status === 'A') return { kode: 'A', kelas: 'bg-red-100 text-red-700 font-black' }
  if (status === 'S') return { kode: 'S', kelas: 'bg-amber-100 text-amber-700 font-black' }
  if (status === 'I') return { kode: 'I', kelas: 'bg-blue-100 text-blue-700 font-black' }

  return { kode: '-', kelas: 'bg-slate-100 text-slate-300' }
}

const hitungPersentaseHadir = (siswa) => {
  // Hanya hitung sesi yang DIBUAT KHUSUS untuk rombel siswa tersebut
  const pertemuanSiswa = (props.kelas.pertemuan || []).filter((p) => p.rombel === siswa.rombel)

  if (pertemuanSiswa.length === 0) return 0

  let hadir = 0
  pertemuanSiswa.forEach((sesi) => {
    if (siswa.kehadiran?.[sesi.id] === 'H') hadir++
  })

  return Math.round((hadir / pertemuanSiswa.length) * 100)
}
</script>

<template>
  <div
    class="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden"
  >
    <div
      class="bg-white border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_4px_10px_-5px_rgba(0,0,0,0.05)] z-20 shrink-0"
    >
      <div class="flex items-center gap-5">
        <div
          class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
        >
          <span class="w-3 h-3 rounded-md bg-emerald-400"></span> Hadir (H)
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

    <div
      v-if="daftarRombelUnik.length > 1"
      class="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex items-center gap-3 overflow-x-auto custom-scrollbar"
    >
      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0"
        >Filter Rombel:</span
      >
      <div class="flex gap-2">
        <button
          @click="rombelPilihan = 'Semua'"
          :class="[
            'px-4 py-1.5 rounded-full text-xs font-bold transition-all',
            rombelPilihan === 'Semua'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100',
          ]"
        >
          Semua Kelas
        </button>
        <button
          v-for="rombel in daftarRombelUnik"
          :key="rombel"
          @click="rombelPilihan = rombel"
          :class="[
            'px-4 py-1.5 rounded-full text-xs font-bold transition-all',
            rombelPilihan === rombel
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600',
          ]"
        >
          {{ rombel }}
        </button>
      </div>
    </div>

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
                >{{ hitungPersentaseHadir(siswa) }}%</span
              >
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
            <td colspan="4" class="p-16 text-center text-slate-400 bg-white">
              <span class="text-4xl block mb-3 opacity-50">📭</span>
              <p class="font-bold text-lg text-slate-500">
                Tidak ada riwayat presensi yang terekam.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
