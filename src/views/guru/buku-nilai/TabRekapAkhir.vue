<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '../../../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import * as XLSX from 'xlsx'

const props = defineProps({
  kelas: { type: Object, required: true },
})

const emit = defineEmits(['update-bobot-rekap'])
const route = useRoute()

const rombelPilihan = ref('Semua')
const semesterAktif = ref('1')

const bobotRekap = computed(() => {
  return props.kelas.bobot_rekap || { pembelajaran: 70, kehadiran: 30 }
})

// MENGAMBIL PENGATURAN POIN KEHADIRAN (H, S, I, A) DARI DATABASE
const pengaturanKehadiran = computed(() => {
  return props.kelas.pengaturan_kehadiran || { p: 100, s: 100, i: 70, a: 0 }
})

const tampilModalBobot = ref(false)
const formBobot = ref({ pembelajaran: 70, kehadiran: 30 })
const sedangMenyimpan = ref(false)
const totalBobot = computed(
  () => Number(formBobot.value.pembelajaran) + Number(formBobot.value.kehadiran),
)

const bukaPengaturan = () => {
  formBobot.value = { ...bobotRekap.value }
  tampilModalBobot.value = true
}

const simpanPengaturanBobot = async () => {
  if (totalBobot.value !== 100) return alert('Total persentase harus tepat 100%.')
  sedangMenyimpan.value = true
  try {
    await updateDoc(doc(db, 'kelas', route.params.id), { bobot_rekap: formBobot.value })
    emit('update-bobot-rekap', formBobot.value)
    tampilModalBobot.value = false
  } catch (error) {
    console.error(error)
    alert('Gagal menyimpan pengaturan bobot.')
  }
  sedangMenyimpan.value = false
}

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

const daftarKolomKegiatan = computed(() => {
  if (!props.kelas || !props.kelas.struktur_materi) return []
  const kolom = []
  props.kelas.struktur_materi.forEach((bab) => {
    const sem = bab.semester || '1'
    if (sem === semesterAktif.value && bab.sub_bab) {
      bab.sub_bab.forEach((sub) => kolom.push(sub))
    }
  })
  return kolom
})

const dapatkanKalkulasiSiswa = (siswa) => {
  let totalMateri = 0,
    selesaiMateri = 0
  let totalNilaiTugas = 0,
    countTugas = 0
  let totalNilaiKuis = 0,
    countKuis = 0

  daftarKolomKegiatan.value.forEach((kegiatan) => {
    const progres = siswa.progres_belajar?.[kegiatan.id]
    const nilai = siswa.nilai_pembelajaran?.[kegiatan.id]

    if (kegiatan.tipe === 'materi') {
      totalMateri++
      if (progres === 'selesai') selesaiMateri++
    } else if (kegiatan.tipe === 'tugas') {
      if (nilai !== undefined && typeof nilai === 'number') {
        totalNilaiTugas += nilai
        countTugas++
      }
    } else if (kegiatan.tipe === 'kuis') {
      if (nilai !== undefined && typeof nilai === 'number') {
        totalNilaiKuis += nilai
        countKuis++
      }
    }
  })

  const formulaRapor = props.kelas.pengaturan_rapor || { materi: 20, tugas: 30, kuis: 50 }
  const capaianMateri = totalMateri > 0 ? (selesaiMateri / totalMateri) * 100 : 0
  const rataTugas = countTugas > 0 ? totalNilaiTugas / countTugas : 0
  const rataKuis = countKuis > 0 ? totalNilaiKuis / countKuis : 0

  const nilaiPembelajaran =
    capaianMateri * (formulaRapor.materi / 100) +
    rataTugas * (formulaRapor.tugas / 100) +
    rataKuis * (formulaRapor.kuis / 100)

  // LOGIKA BARU: Hitung Kehadiran Berdasarkan Formula Pengaturan Poin (H/P, S, I, A)
  let totalPoinHadir = 0
  const pertemuanKhususRombelIni = (props.kelas.pertemuan || []).filter(
    (p) => p.rombel === siswa.rombel && (p.semester || '1') === semesterAktif.value, // <--- TAMBAHKAN FILTER INI
  )
  const totalSesi = pertemuanKhususRombelIni.length
  const bobotHadir = pengaturanKehadiran.value

  if (totalSesi > 0) {
    pertemuanKhususRombelIni.forEach((sesi) => {
      let status = siswa.kehadiran?.[sesi.id]
      if (status === 'H') status = 'P' // Backward Compatibility

      if (status === 'P') totalPoinHadir += Number(bobotHadir.p)
      else if (status === 'S') totalPoinHadir += Number(bobotHadir.s)
      else if (status === 'I') totalPoinHadir += Number(bobotHadir.i)
      else if (status === 'A') totalPoinHadir += Number(bobotHadir.a)
      else totalPoinHadir += Number(bobotHadir.a)
    })
  }

  const maksimalPoin = totalSesi * 100
  const nilaiKehadiran = totalSesi > 0 ? (totalPoinHadir / maksimalPoin) * 100 : 0

  const pmb = isNaN(nilaiPembelajaran) ? 0 : Math.round(nilaiPembelajaran)
  const khd = isNaN(nilaiKehadiran) ? 0 : Math.round(nilaiKehadiran)
  const finalScore =
    pmb * (bobotRekap.value.pembelajaran / 100) + khd * (bobotRekap.value.kehadiran / 100)

  return {
    pembelajaran: pmb,
    kehadiran: khd,
    final: isNaN(finalScore) ? 0 : Math.round(finalScore),
  }
}

const exportKeExcel = () => {
  if (siswaTerurut.value.length === 0) return alert('Tidak ada data siswa untuk diekspor.')

  const dataExport = siswaTerurut.value.map((siswa, index) => {
    const kalkulasi = dapatkanKalkulasiSiswa(siswa)
    return {
      'No.': index + 1,
      Rombel: siswa.rombel || '-',
      NIS: siswa.nis,
      'Nama Lengkap Siswa': siswa.nama,
      'Nilai Pembelajaran': kalkulasi.pembelajaran,
      'Nilai Kehadiran': kalkulasi.kehadiran,
      'Nilai Akhir Rapor': kalkulasi.final,
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(dataExport)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, `Semester ${semesterAktif.value}`)

  const labelFile = rombelPilihan.value === 'Semua' ? 'Gabungan' : rombelPilihan.value
  const namaFile = `Rekap_Nilai_Sem_${semesterAktif.value}_${props.kelas.nama_matpel}_Rombel_${labelFile}.xlsx`
  XLSX.writeFile(workbook, namaFile.replace(/ /g, '_'))
}
</script>

<template>
  <div
    class="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden"
  >
    <div
      class="bg-white border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_4px_10px_-5px_rgba(0,0,0,0.05)] z-20 shrink-0"
    >
      <div class="flex flex-col">
        <h3 class="font-bold text-slate-800 text-sm">Agregasi Nilai Akhir Siswa</h3>
        <p class="text-[11px] text-slate-500 mt-0.5">
          Nilai Rapor Akhir = (Pembelajaran x {{ bobotRekap.pembelajaran }}%) + (Kehadiran x
          {{ bobotRekap.kehadiran }}%)
        </p>
      </div>
      <div class="flex items-center gap-3">
        <select
          v-model="semesterAktif"
          class="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 outline-none cursor-pointer shadow-sm"
        >
          <option value="1">Ganjil (Sem 1)</option>
          <option value="2">Genap (Sem 2)</option>
        </select>

        <button
          @click="bukaPengaturan"
          class="flex items-center gap-2 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 rounded-xl transition border border-slate-200 shadow-sm shrink-0"
        >
          ⚙️ Atur Bobot
        </button>
        <button
          @click="exportKeExcel"
          class="flex items-center gap-2 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 rounded-xl transition shadow-sm shrink-0"
        >
          Export Excel
        </button>
      </div>
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
              rowspan="2"
              class="sticky left-0 top-0 z-40 bg-white border-b border-r border-slate-200 p-4 w-[60px] text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
            >
              <span class="text-xs font-bold text-slate-500 uppercase">No.</span>
            </th>
            <th
              rowspan="2"
              class="sticky left-[60px] top-0 z-40 bg-white border-b border-r-4 border-slate-300 p-4 w-[240px] text-left shadow-[6px_0_10px_-4px_rgba(0,0,0,0.08)]"
            >
              <span class="text-xs font-bold text-slate-500 uppercase">Identitas Siswa</span>
            </th>

            <th
              rowspan="2"
              class="sticky top-0 z-30 bg-indigo-50 border-b border-r border-slate-200 p-4 w-[180px] text-center align-middle h-[56px]"
            >
              <p
                class="text-[11px] font-bold text-indigo-700 uppercase tracking-wider leading-tight"
              >
                Nilai Pembelajaran
              </p>
              <p class="text-[9px] text-indigo-500 font-medium mt-1">
                Bobot: {{ bobotRekap.pembelajaran }}%
              </p>
            </th>
            <th
              rowspan="2"
              class="sticky top-0 z-30 bg-emerald-50 border-b border-r border-slate-200 p-4 w-[180px] text-center align-middle h-[56px]"
            >
              <p
                class="text-[11px] font-bold text-emerald-700 uppercase tracking-wider leading-tight"
              >
                Nilai Kehadiran
              </p>
              <p class="text-[9px] text-emerald-500 font-medium mt-1">
                Bobot: {{ bobotRekap.kehadiran }}%
              </p>
            </th>
            <th
              rowspan="2"
              class="sticky top-0 z-30 bg-slate-100 border-b border-slate-300 p-4 text-center align-middle h-[56px]"
            >
              <p class="text-xs font-black text-slate-800 uppercase tracking-wider leading-tight">
                Nilai Final Rapor
              </p>
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
            <td
              class="border-b border-r border-slate-200 p-4 text-center bg-indigo-50/30 group-hover:bg-indigo-50/60 transition-colors"
            >
              <span class="text-lg font-bold text-indigo-700">{{
                dapatkanKalkulasiSiswa(siswa).pembelajaran
              }}</span>
            </td>
            <td
              class="border-b border-r border-slate-200 p-4 text-center bg-emerald-50/30 group-hover:bg-emerald-50/60 transition-colors"
            >
              <span class="text-lg font-bold text-emerald-700">{{
                dapatkanKalkulasiSiswa(siswa).kehadiran
              }}</span>
            </td>
            <td
              class="border-b border-slate-200 p-4 text-center bg-slate-50 group-hover:bg-slate-100 transition-colors"
            >
              <span class="text-2xl font-black text-slate-800">{{
                dapatkanKalkulasiSiswa(siswa).final
              }}</span>
            </td>
          </tr>
          <tr v-if="siswaTerurut.length === 0">
            <td colspan="5" class="p-16 text-center text-slate-400 bg-white">
              <span class="text-4xl block mb-3 opacity-50">📭</span>
              <p class="font-bold text-lg text-slate-500">Tidak ada data siswa untuk direkap.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div
        v-if="tampilModalBobot"
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4 transition-opacity"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden"
        >
          <div
            class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"
          >
            <h3 class="font-bold text-slate-800">Atur Bobot Agregasi</h3>
            <button
              @click="tampilModalBobot = false"
              class="text-slate-400 hover:text-slate-600 text-xl"
            >
              &times;
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div class="flex items-center justify-between gap-4">
              <label class="text-sm font-bold text-indigo-700 flex-1">Nilai Pembelajaran</label>
              <div class="flex items-center gap-2 w-24">
                <input
                  type="number"
                  v-model="formBobot.pembelajaran"
                  class="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-sm font-bold focus:border-indigo-500 outline-none"
                />
                <span class="text-slate-400 font-bold">%</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-4">
              <label class="text-sm font-bold text-emerald-700 flex-1">Nilai Kehadiran</label>
              <div class="flex items-center gap-2 w-24">
                <input
                  type="number"
                  v-model="formBobot.kehadiran"
                  class="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-sm font-bold focus:border-emerald-500 outline-none"
                />
                <span class="text-slate-400 font-bold">%</span>
              </div>
            </div>
            <div
              :class="[
                'p-3 rounded-lg text-center text-sm font-bold mt-4 border',
                totalBobot === 100
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-600 border-red-200',
              ]"
            >
              Total Saat Ini: {{ totalBobot }}%
            </div>
          </div>
          <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button
              @click="tampilModalBobot = false"
              class="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition"
            >
              Batal
            </button>
            <button
              @click="simpanPengaturanBobot"
              :disabled="totalBobot !== 100 || sedangMenyimpan"
              class="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
