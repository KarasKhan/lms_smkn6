<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '../../firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import SidebarSilabus from './ruang-kelas/SidebarSilabus.vue'
import CanvasBelajar from './ruang-kelas/CanvasBelajar.vue'

const route = useRoute()
const router = useRouter()
const idKelas = route.params.id
const nisLogin = localStorage.getItem('user_nip')

const kelas = ref(null)
const sedangMemuat = ref(true)
const sedangMenyimpan = ref(false)
const babTerbuka = ref([])
const subBabAktif = ref(null)

const tampilSidebarMobile = ref(false)
const tampilSidebarDesktop = ref(true)

const timerAktif = ref(null)
const sisaDetik = ref(0)
const waktuTeks = computed(() => {
  const m = Math.floor(sisaDetik.value / 60)
    .toString()
    .padStart(2, '0')
  const s = (sisaDetik.value % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})

const ambilDataKelas = async () => {
  sedangMemuat.value = true
  try {
    const docRef = doc(db, 'kelas', idKelas)
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      const data = snap.data()
      kelas.value = { id: snap.id, ...data }
      if (data.struktur_materi) babTerbuka.value = data.struktur_materi.map((b) => b.id)

      if (data.materi_terakhir) {
        let foundSub = null
        data.struktur_materi.forEach((bab) => {
          if (bab.sub_bab) {
            const match = bab.sub_bab.find((s) => s.id === data.materi_terakhir)
            if (match) foundSub = match
          }
        })
        if (foundSub) {
          muatSubBab(foundSub)
        }
      }
    } else router.replace('/siswa')
  } catch (error) {
    console.error(error)
  }
  sedangMemuat.value = false
}

onMounted(() => {
  ambilDataKelas()
})
onUnmounted(() => {
  if (timerAktif.value) clearInterval(timerAktif.value)
})

const sembunyikanSilabus = () => {
  tampilSidebarMobile.value = false
  tampilSidebarDesktop.value = false
}

const toggleBab = (id) => {
  const idx = babTerbuka.value.indexOf(id)
  if (idx !== -1) babTerbuka.value.splice(idx, 1)
  else babTerbuka.value.push(id)
}

const dataSiswaSaatIni = computed(() => {
  if (!kelas.value) return null
  return kelas.value.siswa.find((s) => s.nis === nisLogin) || null
})

const statusSubBabAktif = computed(() => {
  const s = dataSiswaSaatIni.value
  if (!s || !subBabAktif.value) return 'belum'

  if (s.progres_belajar && s.progres_belajar[subBabAktif.value.id] === 'selesai') return 'selesai'
  if (s.nilai_pembelajaran && s.nilai_pembelajaran[subBabAktif.value.id] !== undefined) {
    if (s.nilai_pembelajaran[subBabAktif.value.id] === 'revisi') return 'revisi'
    return s.nilai_pembelajaran[subBabAktif.value.id] === 'menunggu' ? 'menunggu' : 'dinilai'
  }
  return 'belum'
})

const namaBabAktif = computed(() => {
  if (!kelas.value || !subBabAktif.value) return ''
  const bab = kelas.value.struktur_materi.find(
    (b) => b.sub_bab && b.sub_bab.some((s) => s.id === subBabAktif.value.id),
  )
  return bab ? bab.judul : ''
})

const daftarUrutanMateri = computed(() => {
  if (!kelas.value || !kelas.value.struktur_materi) return []
  const urutan = []
  kelas.value.struktur_materi.forEach((bab) => {
    if (bab.sub_bab) {
      bab.sub_bab.forEach((sub) => {
        urutan.push({ babId: bab.id, sub })
      })
    }
  })
  return urutan
})

const subBabBerikutnya = computed(() => {
  if (!subBabAktif.value || daftarUrutanMateri.value.length === 0) return null
  const currentIndex = daftarUrutanMateri.value.findIndex(
    (item) => item.sub.id === subBabAktif.value.id,
  )
  if (currentIndex !== -1 && currentIndex < daftarUrutanMateri.value.length - 1) {
    return daftarUrutanMateri.value[currentIndex + 1]
  }
  return null
})

const subBabSebelumnya = computed(() => {
  if (!subBabAktif.value || daftarUrutanMateri.value.length === 0) return null
  const currentIndex = daftarUrutanMateri.value.findIndex(
    (item) => item.sub.id === subBabAktif.value.id,
  )
  if (currentIndex > 0) {
    return daftarUrutanMateri.value[currentIndex - 1]
  }
  return null
})

const muatSubBab = (sub) => {
  if (timerAktif.value) clearInterval(timerAktif.value)
  sisaDetik.value = 0
  subBabAktif.value = sub
  tampilSidebarMobile.value = false
  if (window.innerWidth < 1024) tampilSidebarDesktop.value = false

  if (sub.tipe === 'materi' && sub.waktu_minimal > 0 && statusSubBabAktif.value !== 'selesai') {
    sisaDetik.value = sub.waktu_minimal * 60
    timerAktif.value = setInterval(() => {
      if (sisaDetik.value > 0) sisaDetik.value--
      else clearInterval(timerAktif.value)
    }, 1000)
  }
}

const prosesKirimEvaluasi = async (fieldUpdateData) => {
  sedangMenyimpan.value = true
  try {
    const listSiswa = JSON.parse(JSON.stringify(kelas.value.siswa))
    const idx = listSiswa.findIndex((s) => s.nis === nisLogin)

    if (idx !== -1) {
      for (const key in fieldUpdateData) {
        if (!listSiswa[idx][key]) listSiswa[idx][key] = {}
        listSiswa[idx][key][subBabAktif.value.id] = fieldUpdateData[key]
      }

      if (listSiswa[idx].catatan_revisi && listSiswa[idx].catatan_revisi[subBabAktif.value.id]) {
        listSiswa[idx].catatan_revisi[subBabAktif.value.id].aktif = false
      }

      await updateDoc(doc(db, 'kelas', idKelas), { siswa: listSiswa })
      kelas.value.siswa = listSiswa
    }
  } catch (e) {
    console.error('Error sinkronisasi:', e)
    alert('Gagal menyinkronkan data.')
  }
  sedangMenyimpan.value = false
}

const navigasiSelanjutnya = async () => {
  if (subBabAktif.value.tipe === 'materi' && statusSubBabAktif.value === 'belum') {
    await prosesKirimEvaluasi({ progres_belajar: 'selesai' })
  }

  if (subBabBerikutnya.value) {
    if (!babTerbuka.value.includes(subBabBerikutnya.value.babId)) {
      babTerbuka.value.push(subBabBerikutnya.value.babId)
    }
    muatSubBab(subBabBerikutnya.value.sub)
  } else {
    router.push('/siswa')
  }
}

const navigasiSebelumnya = () => {
  // PENCEGAHAN KLIK TOMBOL 'SEBELUMNYA' JIKA TIMER AKTIF
  if (sisaDetik.value > 0) {
    if (
      !confirm(
        '⏳ Jika Anda kembali ke materi sebelumnya, sisa waktu baca materi ini akan hangus dan diulang. Lanjutkan?',
      )
    ) {
      return
    }
  }

  if (subBabSebelumnya.value) {
    if (!babTerbuka.value.includes(subBabSebelumnya.value.babId)) {
      babTerbuka.value.push(subBabSebelumnya.value.babId)
    }
    muatSubBab(subBabSebelumnya.value.sub)
  }
}

const kirimTugas = async (payload) => {
  await prosesKirimEvaluasi({
    lampiran_tugas: payload,
    nilai_pembelajaran: 'menunggu',
    waktu_kumpul: new Date().toISOString(),
  })
  alert('Tugas berhasil dikumpulkan dan menunggu penilaian.')
}

const kirimKuis = async (jawaban) => {
  await prosesKirimEvaluasi({
    jawaban_kuis: jawaban,
    nilai_pembelajaran: 'menunggu',
    waktu_kumpul: new Date().toISOString(),
  })
  alert('Jawaban kuis berhasil dikumpulkan!')
}
</script>

<template>
  <div class="h-full flex relative overflow-hidden bg-[#F4F5F8]">
    <div
      v-if="tampilSidebarMobile"
      @click="sembunyikanSilabus"
      class="absolute inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity"
    ></div>

    <!-- KIRIM PROPS sedangMembaca -->
    <SidebarSilabus
      :kelas="kelas"
      :bab-terbuka="babTerbuka"
      :sub-bab-aktif="subBabAktif"
      :nis-login="nisLogin"
      :tampil-sidebar-mobile="tampilSidebarMobile"
      :tampil-sidebar-desktop="tampilSidebarDesktop"
      :sedang-membaca="sisaDetik > 0"
      @toggle-bab="toggleBab"
      @muat-sub-bab="muatSubBab"
      @keluar-kelas="router.push('/siswa')"
      @sembunyikan-silabus="sembunyikanSilabus"
    />

    <main class="flex-1 flex flex-col min-w-0 bg-[#F4F5F8] relative">
      <div
        v-if="!subBabAktif"
        class="flex-1 flex flex-col relative overflow-y-auto custom-scrollbar"
      >
        <div class="absolute top-6 left-6 lg:top-8 lg:left-8 z-30 flex items-center gap-3">
          <button
            v-if="!tampilSidebarMobile"
            @click="tampilSidebarMobile = true"
            class="lg:hidden w-11 h-11 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center hover:text-emerald-600"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M4 6h16M4 12h8m-8 6h16"
              ></path>
            </svg>
          </button>
          <button
            v-if="!tampilSidebarDesktop"
            @click="tampilSidebarDesktop = true"
            class="hidden lg:flex w-11 h-11 bg-white text-emerald-600 border border-slate-200 rounded-xl items-center justify-center shadow-sm hover:bg-emerald-50"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M9 5l7 7-7 7"
              ></path>
            </svg>
          </button>
        </div>

        <div
          class="flex-1 flex flex-col items-center justify-center mt-32 text-center animate-in fade-in zoom-in duration-500"
        >
          <div
            class="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200 mb-5"
          >
            <span class="text-3xl opacity-50">🧭</span>
          </div>
          <h2 class="text-lg font-black text-slate-800 mb-2">Pilih Materi Pembelajaran</h2>
          <p class="text-sm font-medium text-slate-500 max-w-sm leading-relaxed">
            Buka menu silabus di sebelah kiri untuk mulai membaca materi kelas.
          </p>
        </div>
      </div>

      <div v-else class="flex-1 flex flex-col relative overflow-hidden">
        <header
          class="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-5 lg:px-8 py-3.5 shrink-0 flex items-center gap-4 z-30 relative shadow-sm"
        >
          <button
            v-if="!tampilSidebarMobile"
            @click="tampilSidebarMobile = true"
            class="lg:hidden shrink-0 w-9 h-9 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M9 5l7 7-7 7"
              ></path>
            </svg>
          </button>

          <button
            v-if="!tampilSidebarDesktop"
            @click="tampilSidebarDesktop = true"
            class="hidden lg:flex shrink-0 w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg items-center justify-center border border-emerald-200 hover:bg-emerald-500 hover:text-white transition-all"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M9 5l7 7-7 7"
              ></path>
            </svg>
          </button>

          <div
            v-if="!tampilSidebarDesktop || !tampilSidebarMobile"
            class="w-px h-6 bg-slate-200 hidden sm:block"
          ></div>

          <div class="flex-1 min-w-0 flex flex-col justify-center">
            <div class="flex items-center gap-2 mb-0.5 flex-wrap">
              <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">{{
                namaBabAktif
              }}</span>
              <span class="text-slate-300 text-[10px] font-bold">/</span>
              <span
                :class="[
                  'text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border',
                  subBabAktif.tipe === 'kuis'
                    ? 'bg-purple-50 text-purple-700 border-purple-100'
                    : subBabAktif.tipe === 'tugas'
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : 'bg-blue-50 text-blue-700 border-blue-100',
                ]"
              >
                {{ subBabAktif.tipe }}
              </span>
            </div>
            <h1 class="text-base lg:text-lg font-black text-slate-800 truncate leading-tight">
              {{ subBabAktif.judul }}
            </h1>
          </div>

          <div class="flex items-center gap-2 md:gap-4 shrink-0">
            <div class="flex items-center gap-2">
              <span
                v-if="statusSubBabAktif === 'selesai' || statusSubBabAktif === 'dinilai'"
                class="text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md border border-emerald-200 flex items-center gap-1"
              >
                ✓ Selesai
              </span>
              <span
                v-else-if="statusSubBabAktif === 'revisi'"
                class="text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 px-2 py-1 rounded-md border border-rose-200 flex items-center gap-1 animate-pulse"
              >
                ⚠️ Revisi
              </span>
              <span
                v-else-if="statusSubBabAktif === 'menunggu'"
                class="text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-1 rounded-md border border-amber-200 flex items-center gap-1 animate-pulse"
              >
                Menunggu
              </span>
              <span
                v-if="subBabAktif.tipe !== 'materi' && subBabAktif.deadline"
                class="hidden sm:inline-block text-red-600 bg-red-50 px-2 py-1 text-[9px] font-bold rounded-md border border-red-100 uppercase tracking-widest"
              >
                Tenggat:
                {{
                  new Date(subBabAktif.deadline).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                }}
              </span>
            </div>

            <div class="hidden sm:block w-px h-8 bg-slate-200"></div>

            <div class="flex items-center gap-2 md:gap-3">
              <div class="text-right hidden sm:block">
                <p
                  class="text-xs font-black text-slate-800 leading-none truncate max-w-[120px] md:max-w-[160px]"
                >
                  {{ dataSiswaSaatIni?.nama || 'Memuat...' }}
                </p>
                <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">
                  {{ dataSiswaSaatIni?.rombel || '-' }} • {{ nisLogin }}
                </p>
              </div>
              <div
                class="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] md:text-xs font-black shrink-0 shadow-inner"
              >
                {{ dataSiswaSaatIni?.nama ? dataSiswaSaatIni.nama.charAt(0) : 'S' }}
              </div>
            </div>
          </div>
        </header>

        <div
          class="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 custom-scrollbar scroll-smooth pb-10"
        >
          <CanvasBelajar
            :data-siswa="dataSiswaSaatIni"
            :sub-bab-aktif="subBabAktif"
            :status-sub-bab="statusSubBabAktif"
            :sedang-menyimpan="sedangMenyimpan"
            @kirim-tugas="kirimTugas"
            @kirim-kuis="kirimKuis"
          />
        </div>

        <div
          class="bg-white/95 backdrop-blur-md border-t border-slate-200 px-5 lg:px-8 py-3.5 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between z-30 relative shadow-[0_-10px_20px_rgba(0,0,0,0.03)] gap-3 sm:gap-0"
        >
          <div class="hidden sm:block">
            <div
              v-if="statusSubBabAktif === 'selesai' || statusSubBabAktif === 'dinilai'"
              class="flex items-center gap-2 text-emerald-600 font-bold text-sm"
            >
              <span
                class="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-xs"
                >✓</span
              >
              {{
                subBabAktif.tipe === 'materi'
                  ? 'Selesai Dibaca'
                  : subBabAktif.tipe === 'kuis'
                    ? 'Kuis Diselesaikan'
                    : 'Sudah Dinilai'
              }}
            </div>
            <div
              v-else-if="statusSubBabAktif === 'menunggu'"
              class="flex items-center gap-2 text-amber-600 font-bold text-sm"
            >
              <span
                class="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center text-xs"
                >✓</span
              >
              Terkirim (Menunggu Dinilai)
            </div>
            <div
              v-else-if="statusSubBabAktif === 'revisi'"
              class="flex items-center gap-2 text-rose-600 font-bold text-sm"
            >
              <span
                class="w-5 h-5 bg-rose-100 rounded-full flex items-center justify-center text-xs animate-pulse"
                >!</span
              >
              Perlu Revisi
            </div>
            <div v-else class="flex items-center gap-2 text-slate-400 font-bold text-sm">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              {{ subBabAktif.tipe === 'materi' ? 'Belum Selesai Dibaca' : 'Menunggu Pengerjaan' }}
            </div>
          </div>

          <div class="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              v-if="subBabSebelumnya"
              @click="navigasiSebelumnya"
              :disabled="sedangMenyimpan"
              class="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm disabled:opacity-50"
            >
              ← <span class="hidden sm:inline">Sebelumnya</span>
            </button>

            <button
              v-if="statusSubBabAktif === 'belum' && subBabAktif.tipe === 'materi'"
              @click="navigasiSelanjutnya"
              :disabled="sisaDetik > 0 || sedangMenyimpan"
              :class="[
                'flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all',
                sisaDetik > 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:-translate-y-0.5',
              ]"
            >
              {{
                sisaDetik > 0
                  ? `Membaca (${waktuTeks})`
                  : sedangMenyimpan
                    ? 'Proses...'
                    : 'Tandai Selesai & Lanjut →'
              }}
            </button>

            <button
              v-else-if="statusSubBabAktif === 'belum' || statusSubBabAktif === 'revisi'"
              @click="navigasiSelanjutnya"
              :disabled="subBabAktif.syarat_lanjut"
              :class="[
                'flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all',
                subBabAktif.syarat_lanjut
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50',
              ]"
            >
              {{ subBabAktif.syarat_lanjut ? 'Selesaikan Untuk Lanjut' : 'Lewati & Lanjut →' }}
            </button>

            <button
              v-else
              @click="navigasiSelanjutnya"
              :disabled="sedangMenyimpan"
              class="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:-translate-y-0.5"
            >
              {{ subBabBerikutnya ? 'Materi Selanjutnya →' : 'Kembali ke Beranda →' }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
  border: 2px solid #f4f5f8;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
