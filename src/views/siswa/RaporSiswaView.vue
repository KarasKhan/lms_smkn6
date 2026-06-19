<script setup>
import { ref, onMounted } from 'vue'
import { db } from '../../firebase'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'

const nisLogin = ref(localStorage.getItem('user_nip') || '')
const sedangMemuat = ref(true)
const daftarRapor = ref([])

onMounted(async () => {
  sedangMemuat.value = true
  try {
    const userRef = doc(db, 'users', nisLogin.value)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const userData = userSnap.data()
      const rombelAktifSiswa = userData.rombel_aktif

      if (rombelAktifSiswa) {
        const kelasSnap = await getDocs(collection(db, 'kelas'))
        const hasilRapor = []

        kelasSnap.forEach((k) => {
          const kelasData = k.data()

          if (kelasData.rombel_target && kelasData.rombel_target.includes(rombelAktifSiswa)) {
            const hasilKalkulasi = hitungRaporKelas(kelasData, nisLogin.value)
            if (hasilKalkulasi) {
              hasilRapor.push({
                id: k.id,
                nama_matpel: kelasData.nama_matpel,
                guru_nama: kelasData.guru_nama,
                tahun_ajaran: kelasData.tahun_ajaran,
                ...hasilKalkulasi,
              })
            }
          }
        })
        daftarRapor.value = hasilRapor.sort((a, b) => a.nama_matpel.localeCompare(b.nama_matpel))
      }
    }
  } catch (error) {
    console.error('Gagal mengambil rapor:', error)
  }
  sedangMemuat.value = false
})

const hitungRaporKelas = (kelasData, nis) => {
  const siswaData = kelasData.siswa?.find((s) => s.nis === nis)
  if (!siswaData) return null

  // 1. Cek Ketuntasan & Kalkulasi Nilai Pembelajaran
  let totalMateriKBM = 0
  let selesaiMateriKBM = 0
  let totalMateri = 0,
    selesaiMateri = 0,
    totalNilaiTugas = 0,
    countTugas = 0,
    totalNilaiKuis = 0,
    countKuis = 0

  const struktur = kelasData.struktur_materi || []
  struktur.forEach((bab) => {
    bab.sub_bab?.forEach((sub) => {
      totalMateriKBM++
      const progres = siswaData.progres_belajar?.[sub.id]
      const nilai = siswaData.nilai_pembelajaran?.[sub.id]

      if (sub.tipe === 'materi') {
        totalMateri++
        if (progres === 'selesai') {
          selesaiMateriKBM++
          selesaiMateri++
        }
      } else if (sub.tipe === 'tugas') {
        if (nilai !== undefined && nilai !== null && nilai !== 'revisi') selesaiMateriKBM++
        if (typeof nilai === 'number') {
          totalNilaiTugas += nilai
          countTugas++
        }
      } else if (sub.tipe === 'kuis') {
        if (nilai !== undefined && nilai !== null && nilai !== 'revisi') selesaiMateriKBM++
        if (typeof nilai === 'number') {
          totalNilaiKuis += nilai
          countKuis++
        }
      }
    })
  })

  // Status Tuntas: Semua materi ada dan sudah dikerjakan/dinilai semua
  const isTuntas = totalMateriKBM > 0 && selesaiMateriKBM === totalMateriKBM

  // Kalkulasi Nilai Pembelajaran berdasarkan persentase
  const formulaRapor = kelasData.pengaturan_rapor || { materi: 20, tugas: 30, kuis: 50 }
  const capaianMateri = totalMateri > 0 ? (selesaiMateri / totalMateri) * 100 : 0
  const rataTugas = countTugas > 0 ? totalNilaiTugas / countTugas : 0
  const rataKuis = countKuis > 0 ? totalNilaiKuis / countKuis : 0

  const nilaiPembelajaran =
    capaianMateri * (formulaRapor.materi / 100) +
    rataTugas * (formulaRapor.tugas / 100) +
    rataKuis * (formulaRapor.kuis / 100)

  // 2. Kalkulasi Nilai Kehadiran (Khusus rombel siswa)
  let totalHadir = 0
  const pertemuanKhusus = (kelasData.pertemuan || []).filter((p) => p.rombel === siswaData.rombel)
  const totalSesi = pertemuanKhusus.length

  if (totalSesi > 0) {
    pertemuanKhusus.forEach((sesi) => {
      if (siswaData.kehadiran?.[sesi.id] === 'H') totalHadir++
    })
  }
  const nilaiKehadiran = totalSesi > 0 ? (totalHadir / totalSesi) * 100 : 0

  // 3. Kalkulasi Nilai Akhir (Berdasarkan bobot rekapitulasi)
  const bobotRekap = kelasData.bobot_rekap || { pembelajaran: 70, kehadiran: 30 }
  const pmb = isNaN(nilaiPembelajaran) ? 0 : Math.round(nilaiPembelajaran)
  const khd = isNaN(nilaiKehadiran) ? 0 : Math.round(nilaiKehadiran)

  const finalScore = pmb * (bobotRekap.pembelajaran / 100) + khd * (bobotRekap.kehadiran / 100)

  return {
    isTuntas,
    pembelajaran: pmb,
    kehadiran: khd,
    final: isNaN(finalScore) ? 0 : Math.round(finalScore),
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar scroll-smooth">
    <div class="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div class="border-b border-slate-200 pb-5">
        <h1 class="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
          Rapor Akademik
        </h1>
        <p class="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
          Pantau hasil evaluasi belajar dan persentase kehadiran Anda. Nilai Akhir hanya akan
          diterbitkan oleh sistem jika Anda telah menyelesaikan seluruh rangkaian materi kelas.
        </p>
      </div>

      <div
        v-if="sedangMemuat"
        class="py-24 flex flex-col items-center justify-center text-slate-400"
      >
        <div
          class="w-12 h-12 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin mb-4"
        ></div>
        <p class="font-bold text-sm tracking-wide">Merekapitulasi kalkulasi nilai dari server...</p>
      </div>

      <div
        v-else-if="daftarRapor.length === 0"
        class="bg-white border border-dashed border-slate-300 rounded-3xl p-16 text-center shadow-sm"
      >
        <div
          class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100"
        >
          <span class="text-4xl opacity-40">📭</span>
        </div>
        <h3 class="font-bold text-lg text-slate-800 mb-2">Belum Ada Data Akademik</h3>
        <p class="text-sm text-slate-500 max-w-sm mx-auto">
          Anda belum tergabung di kelas mana pun atau guru belum mengunggah struktur penilaian
          kelas.
        </p>
      </div>

      <div v-else class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div
          v-for="rapor in daftarRapor"
          :key="rapor.id"
          class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:flex-row relative group hover:border-emerald-300 transition-colors"
        >
          <!-- Indikator Strip Samping Kiri -->
          <div :class="['w-2 shrink-0', rapor.isTuntas ? 'bg-emerald-500' : 'bg-slate-200']"></div>

          <div class="p-6 lg:p-8 flex-1 flex flex-col">
            <div class="flex items-center justify-between mb-4">
              <span
                class="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md"
              >
                TA. {{ rapor.tahun_ajaran }}
              </span>
              <span
                v-if="rapor.isTuntas"
                class="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md flex items-center gap-1"
              >
                ✓ Kelas Tuntas
              </span>
            </div>

            <h3 class="text-xl font-black text-slate-800 leading-tight mb-2">
              {{ rapor.nama_matpel }}
            </h3>
            <p class="text-xs font-bold text-slate-500 mb-8">{{ rapor.guru_nama }}</p>

            <div class="grid grid-cols-2 gap-4 mt-auto">
              <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Rata-rata Tugas & Ujian
                </p>
                <p class="text-2xl font-black text-indigo-700">{{ rapor.pembelajaran }}</p>
              </div>
              <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Tingkat Kehadiran Kelas
                </p>
                <p class="text-2xl font-black text-emerald-700">
                  {{ rapor.kehadiran }}<span class="text-sm text-emerald-600/50">%</span>
                </p>
              </div>
            </div>
          </div>

          <!-- BAGIAN NILAI AKHIR (KANAN) -->
          <div
            class="bg-slate-50 lg:w-48 p-6 lg:p-8 border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col items-center justify-center text-center shrink-0"
          >
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Nilai Akhir Pembelajaran
            </p>

            <div v-if="rapor.isTuntas" class="flex flex-col items-center justify-center">
              <p class="text-6xl font-black text-slate-800 tracking-tighter">{{ rapor.final }}</p>
              <div
                class="mt-4 px-3 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded border border-emerald-200"
              >
                Memenuhi Syarat
              </div>
            </div>

            <div v-else class="flex flex-col items-center justify-center space-y-3 opacity-60">
              <span class="text-4xl">🔒</span>
              <p
                class="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed"
              >
                Belum ada nilai akhir.<br />Selesaikan kelas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
</style>
