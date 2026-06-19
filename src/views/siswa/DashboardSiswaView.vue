<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../../firebase'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'

const router = useRouter()
const nisLogin = ref(localStorage.getItem('user_nip') || '')
const namaSiswa = ref(localStorage.getItem('user_nama') || 'Siswa')

const dataProfil = ref(null)
const daftarKelasSaya = ref([])
const sedangMemuat = ref(true)

onMounted(async () => {
  if (!nisLogin.value) {
    router.replace('/')
    return
  }

  sedangMemuat.value = true
  try {
    const docRef = doc(db, 'users', nisLogin.value)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      dataProfil.value = docSnap.data()

      if (dataProfil.value.rombel_aktif) {
        // Tarik seluruh data ruang kelas dari Firestore
        const kelasSnap = await getDocs(collection(db, 'kelas'))
        const kelasTemp = []

        kelasSnap.forEach((k) => {
          const dataKelas = k.data()

          // Pastikan kelas ini ditujukan untuk rombel aktif siswa
          if (
            dataKelas.rombel_target &&
            dataKelas.rombel_target.includes(dataProfil.value.rombel_aktif)
          ) {
            // LOGIKA BARU: Deteksi otomatis stempel ketuntasan mata pelajaran
            const siswaSayaMatch = dataKelas.siswa?.find((s) => s.nis === nisLogin.value)
            let mapelTuntasSemua = false

            if (siswaSayaMatch && dataKelas.struktur_materi) {
              let totalMateriKBM = 0
              let selesaiMateriKBM = 0

              dataKelas.struktur_materi.forEach((bab) => {
                if (bab.sub_bab) {
                  bab.sub_bab.forEach((sub) => {
                    totalMateriKBM++

                    const progres = siswaSayaMatch.progres_belajar?.[sub.id]
                    const nilai = siswaSayaMatch.nilai_pembelajaran?.[sub.id]

                    if (sub.tipe === 'materi') {
                      if (progres === 'selesai') selesaiMateriKBM++
                    } else {
                      // Untuk tugas/kuis dianggap tuntas jika sudah dinilai angka atau berstatus menunggu koreksi
                      if (nilai !== undefined && nilai !== null && nilai !== 'revisi') {
                        selesaiMateriKBM++
                      }
                    }
                  })
                }
              })

              // Mapel valid dikatakan tuntas jika jumlah materi > 0 dan semuanya selesai dikerjakan
              if (totalMateriKBM > 0 && selesaiMateriKBM === totalMateriKBM) {
                mapelTuntasSemua = true
              }
            }

            // Masukkan status ketuntasan ke dalam objek kelas lokal
            kelasTemp.push({
              id: k.id,
              ...dataKelas,
              isTuntas: mapelTuntasSemua,
            })
          }
        })

        daftarKelasSaya.value = kelasTemp.sort((a, b) => a.nama_matpel.localeCompare(b.nama_matpel))
      }
    }
  } catch (error) {
    console.error('Gagal memuat data dashboard siswa:', error)
  }
  sedangMemuat.value = false
})

const sapaanWaktu = computed(() => {
  const jam = new Date().getHours()
  if (jam < 11) return 'Semangat Pagi'
  if (jam < 15) return 'Selamat Siang'
  if (jam < 18) return 'Selamat Sore'
  return 'Selamat Malam'
})

const pindaiQR = (idKelasDipilih) => {
  if (!idKelasDipilih || typeof idKelasDipilih !== 'string') {
    if (daftarKelasSaya.value.length === 1) {
      router.push(`/siswa/presensi/${daftarKelasSaya.value[0].id}`)
    } else if (daftarKelasSaya.value.length > 1) {
      alert('Silakan pilih dan klik tombol "📸 Absen" pada salah satu kartu kelas di bawah ini!')
    } else {
      alert('Anda belum mendaftar atau tergabung di kelas mata pelajaran mana pun.')
    }
    return
  }
  router.push(`/siswa/presensi/${idKelasDipilih}`)
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar scroll-smooth">
    <div class="space-y-10 animate-in fade-in duration-700 pb-10">
      <div
        class="relative bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl shadow-emerald-900/20"
      >
        <div
          class="absolute inset-0 bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 opacity-90"
        ></div>
        <div
          class="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/30 rounded-full mix-blend-screen filter blur-[80px]"
        ></div>
        <div
          class="absolute top-10 -left-10 w-72 h-72 bg-teal-400/20 rounded-full mix-blend-screen filter blur-[60px]"
        ></div>

        <div
          class="relative z-10 p-8 lg:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8"
        >
          <div class="max-w-2xl">
            <p
              class="text-emerald-200 font-bold tracking-widest text-xs uppercase mb-3 flex items-center gap-2"
            >
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {{ sapaanWaktu }}
            </p>
            <h1
              class="text-3xl lg:text-5xl font-black text-white mb-4 leading-tight tracking-tight"
            >
              Halo, {{ namaSiswa.split(' ')[0] }}!
            </h1>
            <p class="text-emerald-100/80 text-sm lg:text-base leading-relaxed">
              <span v-if="dataProfil"
                >Anda tergabung di Rombel
                <strong class="text-white">"{{ dataProfil.rombel_aktif }}"</strong>.</span
              >
              Mari jelajahi materi pembelajaran, selesaikan tugas yang tertunda, dan capai target
              akademikmu hari ini.
            </p>
          </div>

          <div class="shrink-0 w-full md:w-auto">
            <button
              @click="pindaiQR"
              class="w-full md:w-auto group relative inline-flex items-center justify-center gap-3 px-8 py-4 font-bold text-white transition-all duration-200 bg-white/10 border border-white/20 rounded-2xl hover:bg-white/20 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] overflow-hidden backdrop-blur-sm"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                ></path>
              </svg>
              <span>Pindai Presensi Kehadiran</span>
            </button>
          </div>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-6 px-1">
          <div>
            <h2 class="text-xl font-black text-slate-800 tracking-tight">Kelas Mata Pelajaran</h2>
            <p class="text-sm text-slate-500 mt-1 font-medium">
              Akses silabus dan materi yang telah diunggah.
            </p>
          </div>
          <span
            class="hidden sm:inline-block text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100"
          >
            {{ daftarKelasSaya.length }} Ruang Kelas Ditemukan
          </span>
        </div>

        <div
          v-if="sedangMemuat"
          class="py-24 flex flex-col items-center justify-center text-slate-400"
        >
          <div
            class="w-12 h-12 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin mb-4"
          ></div>
          <p class="font-bold text-sm tracking-wide">Menyiapkan Ruang Pembelajaran...</p>
        </div>

        <div
          v-else-if="daftarKelasSaya.length === 0"
          class="bg-white border border-dashed border-slate-300 rounded-3xl p-16 text-center shadow-sm"
        >
          <div
            class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100"
          >
            <span class="text-4xl opacity-40">📭</span>
          </div>
          <h3 class="font-bold text-lg text-slate-800 mb-2">Belum Ada Kelas Aktif</h3>
          <p class="text-sm text-slate-500 max-w-sm mx-auto">
            Guru bidang studi belum membuat atau mendaftarkan kelas untuk rombongan belajar Anda
            saat ini.
          </p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div
            v-for="kelas in daftarKelasSaya"
            :key="kelas.id"
            @click="router.push(`/siswa/kelas/${kelas.id}`)"
            class="group relative bg-white rounded-[1.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-emerald-300 hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer overflow-hidden"
          >
            <div
              class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-80 group-hover:opacity-100 transition-opacity"
            ></div>

            <div
              v-if="kelas.isTuntas"
              class="absolute top-12 right-4 border-4 border-double border-emerald-600/30 text-emerald-600/40 font-black text-[10px] tracking-[0.25em] px-3 py-1.5 rounded-xl uppercase transform rotate-12 select-none pointer-events-none z-20 font-sans shadow-sm bg-emerald-50/10 backdrop-blur-[0.5px]"
            >
              🏅 TUNTAS BELAJAR
            </div>

            <div class="p-6 lg:p-8 flex flex-col flex-1 relative z-10">
              <div class="flex items-center justify-between mb-4">
                <span
                  class="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md"
                >
                  TA. {{ kelas.tahun_ajaran }}
                </span>
                <div
                  :class="[
                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                    kelas.isTuntas
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white',
                  ]"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2.5"
                      :d="
                        kelas.isTuntas
                          ? 'M5 13l4 4L19 7'
                          : 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
                      "
                    ></path>
                  </svg>
                </div>
              </div>

              <h3
                :class="[
                  'text-xl font-black leading-tight mb-2 transition-colors',
                  kelas.isTuntas
                    ? 'text-emerald-800'
                    : 'text-slate-800 group-hover:text-emerald-700',
                ]"
              >
                {{ kelas.nama_matpel }}
              </h3>

              <div class="flex items-center gap-3 mt-auto pt-6">
                <div
                  class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-inner"
                >
                  {{ kelas.guru_nama ? kelas.guru_nama.charAt(0) : '?' }}
                </div>
                <div>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                    Pengampu
                  </p>
                  <p class="text-xs font-bold text-slate-700 truncate max-w-[190px]">
                    {{ kelas.guru_nama || 'Menunggu Guru' }}
                  </p>
                </div>
              </div>
            </div>

            <div
              :class="[
                'px-6 lg:px-8 py-4 border-t border-slate-100 flex items-center justify-between transition-colors bg-slate-50',
                kelas.isTuntas
                  ? 'group-hover:bg-emerald-100/50 bg-emerald-50/20'
                  : 'group-hover:bg-emerald-50',
              ]"
            >
              <span
                :class="[
                  'text-sm font-black',
                  kelas.isTuntas ? 'text-emerald-700' : 'text-emerald-700',
                ]"
              >
                {{ kelas.isTuntas ? 'Buka Riwayat Belajar' : 'Buka Materi Kelas' }}
              </span>

              <div class="flex items-center gap-3">
                <button
                  v-if="!kelas.isTuntas"
                  @click.stop="pindaiQR(kelas.id)"
                  class="px-3 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all flex items-center justify-center text-xs gap-1.5 z-20 relative"
                  title="Pindai Presensi Kelas Ini"
                >
                  <span class="font-black uppercase tracking-wider">Absen</span>
                </button>

                <div
                  :class="[
                    'w-8 h-8 border border-slate-200 rounded-full flex items-center justify-center shadow-sm transform group-hover:translate-x-1 transition-all',
                    kelas.isTuntas
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-600 group-hover:bg-emerald-600 group-hover:border-emerald-600 group-hover:text-white',
                  ]"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    ></path>
                  </svg>
                </div>
              </div>
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
