<script setup>
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGuruStore } from '../../stores/guruStore'

const router = useRouter()
const guruStore = useGuruStore()

const nipGuruLogin = ref(localStorage.getItem('user_nip') || '')
const namaGuruLogin = ref(localStorage.getItem('user_nama') || 'Guru')

onMounted(() => {
  if (nipGuruLogin.value) {
    guruStore.fetchKelasGuru(nipGuruLogin.value)
  }
})

const totalKelas = computed(() => guruStore.daftarKelas.length)

const totalSiswaDiajar = computed(() => {
  return guruStore.daftarKelas.reduce((total, kelas) => total + (kelas.jumlah_siswa || 0), 0)
})

const daftarAntreanKoreksi = computed(() => {
  const antrean = []

  guruStore.daftarKelas.forEach((kelas) => {
    if (kelas.siswa) {
      kelas.siswa.forEach((siswa) => {
        if (siswa.nilai_pembelajaran) {
          Object.keys(siswa.nilai_pembelajaran).forEach((idKegiatan) => {
            if (siswa.nilai_pembelajaran[idKegiatan] === 'menunggu') {
              let namaKegiatan = 'Berkas Tugas / Kuis'
              let tipeKegiatan = 'tugas'

              if (kelas.struktur_materi) {
                kelas.struktur_materi.forEach((bab) => {
                  if (bab.sub_bab) {
                    const sub = bab.sub_bab.find((s) => s.id === idKegiatan)
                    if (sub) {
                      namaKegiatan = sub.judul
                      tipeKegiatan = sub.tipe
                    }
                  }
                })
              }

              antrean.push({
                idKelas: kelas.id,
                namaKelas: kelas.nama_matpel,
                rombel: kelas.rombel_target,
                namaSiswa: siswa.nama,
                nis: siswa.nis,
                namaKegiatan,
                tipeKegiatan,
              })
            }
          })
        }
      })
    }
  })

  return antrean
})

const totalTugasKoreksi = computed(() => daftarAntreanKoreksi.value.length)

const sapaanWaktu = computed(() => {
  const jam = new Date().getHours()
  if (jam < 11) return 'Selamat Pagi'
  if (jam < 15) return 'Selamat Siang'
  if (jam < 18) return 'Selamat Sore'
  return 'Selamat Malam'
})
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-500">
    <div
      class="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden"
    >
      <div class="relative z-10">
        <p class="text-blue-200 font-bold tracking-wider text-sm uppercase mb-1">
          {{ sapaanWaktu }},
        </p>

        <h1 class="text-3xl font-black mb-2">{{ namaGuruLogin }}</h1>

        <p class="text-blue-100 max-w-xl leading-relaxed">
          Selamat datang di Pusat Kendali Kelas Anda. Mari kita lihat perkembangan siswa dan tugas
          apa saja yang menanti keahlian evaluasi Anda hari ini.
        </p>
      </div>
      <svg
        class="absolute right-0 top-0 h-full opacity-10 transform translate-x-1/4 -translate-y-1/4 scale-150"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path fill="currentColor" d="M0 100 C 20 0 50 0 100 100 Z"></path>
      </svg>
    </div>

    <div
      v-if="guruStore.sedangMemuatKelas"
      class="py-12 flex items-center justify-center text-slate-400 font-medium"
    >
      <div
        class="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mr-3"
      ></div>
      Menyinkronkan data kelas...
    </div>

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5 hover:shadow-md transition"
        >
          <div
            class="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"
          >
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              ></path>
            </svg>
          </div>
          <div>
            <h3 class="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">
              Total Kelas Aktif
            </h3>
            <p class="text-3xl font-black text-slate-800">
              {{ totalKelas }} <span class="text-sm font-medium text-slate-400">Rombel</span>
            </p>
          </div>
        </div>

        <div
          class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5 hover:shadow-md transition"
        >
          <div
            class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"
          >
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              ></path>
            </svg>
          </div>
          <div>
            <h3 class="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">
              Total Siswa Diajar
            </h3>
            <p class="text-3xl font-black text-slate-800">
              {{ totalSiswaDiajar }} <span class="text-sm font-medium text-slate-400">Anak</span>
            </p>
          </div>
        </div>

        <div
          class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5 hover:shadow-md transition relative overflow-hidden"
        >
          <div
            v-if="totalTugasKoreksi > 0"
            class="absolute top-0 right-0 w-2 h-full bg-amber-400"
          ></div>
          <div
            class="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"
          >
            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              ></path>
            </svg>
          </div>
          <div>
            <h3 class="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">
              Perlu Dikoreksi
            </h3>
            <p class="text-3xl font-black text-amber-600">
              {{ totalTugasKoreksi }} <span class="text-sm font-medium text-slate-400">Tugas</span>
            </p>
          </div>
        </div>
      </div>

      <div
        class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col"
      >
        <div class="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 class="text-lg font-bold text-slate-800">Antrean Evaluasi Siswa</h3>
            <p class="text-xs text-slate-500 mt-1">
              Siswa yang baru saja mengumpulkan tugas/kuis dan menunggu penilaian Anda.
            </p>
          </div>
          <span
            v-if="totalTugasKoreksi > 0"
            class="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-black animate-pulse"
          >
            Ada {{ totalTugasKoreksi }} Berkas!
          </span>
        </div>

        <div class="p-6">
          <div v-if="totalTugasKoreksi === 0" class="text-center py-12 text-slate-400">
            <div
              class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100"
            >
              <svg
                class="w-10 h-10 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
            <p class="font-bold text-lg text-slate-600">Santai dulu, tidak ada tugas yang antre.</p>
            <p class="text-sm mt-1">Semua nilai siswa sudah terekap dengan rapi!</p>
          </div>

          <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              v-for="(tugas, index) in daftarAntreanKoreksi.slice(0, 10)"
              :key="index"
              class="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 hover:border-blue-300 transition group"
            >
              <div class="flex items-start gap-4">
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 bg-blue-100 text-blue-600 mt-1"
                >
                  {{ tugas.namaSiswa.charAt(0) }}
                </div>
                <div>
                  <p class="font-bold text-slate-800">{{ tugas.namaSiswa }}</p>
                  <p
                    class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 mb-1.5"
                  >
                    {{ tugas.namaKelas }} • {{ tugas.rombel }}
                  </p>
                  <div class="flex items-center gap-2">
                    <span
                      :class="[
                        'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase',
                        tugas.tipeKegiatan === 'kuis'
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-orange-100 text-orange-600',
                      ]"
                    >
                      {{ tugas.tipeKegiatan }}
                    </span>
                    <span
                      class="text-xs font-medium text-slate-600 truncate max-w-[200px]"
                      :title="tugas.namaKegiatan"
                      >{{ tugas.namaKegiatan }}</span
                    >
                  </div>
                </div>
              </div>
              <button
                @click="router.push(`/guru/nilai/${tugas.idKelas}`)"
                class="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-blue-600 hover:text-white hover:border-blue-600 transition shadow-sm"
              >
                Beri Nilai &rarr;
              </button>
            </div>
          </div>

          <div v-if="totalTugasKoreksi > 10" class="mt-6 text-center">
            <p class="text-sm font-bold text-slate-400 italic">
              ...dan {{ totalTugasKoreksi - 10 }} tugas lainnya menanti di Buku Nilai.
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
