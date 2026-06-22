<script setup>
import { computed } from 'vue'

const props = defineProps({
  kelas: Object,
  babTerbuka: Array,
  subBabAktif: Object,
  nisLogin: String,
  tampilSidebarMobile: Boolean,
  tampilSidebarDesktop: Boolean,
  sedangMembaca: Boolean, // Menerima status timer aktif dari parent
})

const emit = defineEmits(['toggle-bab', 'muat-sub-bab', 'keluar-kelas', 'sembunyikan-silabus'])

// Mengambil data progres siswa saat ini
const dataSiswaSaatIni = computed(() => {
  if (!props.kelas || !props.kelas.siswa) return null
  return props.kelas.siswa.find((s) => s.nis === props.nisLogin) || null
})

// Mengecek status pengerjaan materi/tugas/kuis
const cekStatusSubBab = (idSub) => {
  const s = dataSiswaSaatIni.value
  if (!s) return 'belum'

  if (s.progres_belajar && s.progres_belajar[idSub] === 'selesai') return 'selesai'
  if (s.nilai_pembelajaran && s.nilai_pembelajaran[idSub] !== undefined) {
    if (s.nilai_pembelajaran[idSub] === 'menunggu') return 'menunggu'
    if (s.nilai_pembelajaran[idSub] === 'revisi') return 'revisi'
    return 'dinilai'
  }
  return 'belum'
}

// 1. LOGIKA INTI: Mencari nomor urut indeks global dari sebuah materi (1, 2, 3, dst)
const getUrutanGlobal = (idSub) => {
  if (!idSub || !props.kelas || !props.kelas.struktur_materi) return -1
  let urutan = 0
  for (const bab of props.kelas.struktur_materi) {
    if (bab.sub_bab) {
      for (const s of bab.sub_bab) {
        urutan++
        if (s.id === idSub) return urutan
      }
    }
  }
  return -1
}

// 2. LOGIKA INTI: Menentukan batas urutan maksimal materi yang BOLEH diakses siswa saat ini
const urutanMaksimalBolehAkses = computed(() => {
  if (!props.kelas || !props.kelas.struktur_materi) return 1

  let urutan = 0
  let batasMaju = 1
  let ditemukanBatas = false

  for (const bab of props.kelas.struktur_materi) {
    if (bab.sub_bab) {
      for (const sub of bab.sub_bab) {
        urutan++
        const status = cekStatusSubBab(sub.id)

        if (!ditemukanBatas) {
          // Selama materi di belakang berstatus selesai/dinilai/menunggu, batas maju terus bertambah
          batasMaju = urutan
          // Kunci batas atas begitu menemukan materi pertama yang belum dikerjakan atau perlu perbaikan
          if (status === 'belum' || status === 'revisi') {
            ditemukanBatas = true
          }
        }
      }
    }
  }
  return batasMaju
})

const klikMateri = (sub) => {
  const urutanTujuan = getUrutanGlobal(sub.id)
  const urutanAktif = getUrutanGlobal(props.subBabAktif?.id)

  // VALIDASI 1: Cek apakah tujuan klik melompati batas maju maksimal siswa di database
  if (urutanTujuan > urutanMaksimalBolehAkses.value) {
    alert(
      '🔒 Akses Ditolak: Anda tidak dapat melompati materi! Selesaikan urutan pembelajaran aktif Anda terlebih dahulu.',
    )
    return
  }

  // VALIDASI 2: Proteksi jika siswa mencoba berpindah saat TIMER pengerjaan/waktu baca sedang berjalan
  if (props.sedangMembaca && props.subBabAktif?.id !== sub.id) {
    // Jika mencoba klik melompat ke depan sebelum menekan tombol selesaikan materi
    if (urutanTujuan > urutanAktif) {
      alert(
        '⏳ Batasan Halaman: Selesaikan sisa batas waktu baca materi saat ini terlebih dahulu sebelum berpindah ke depan!',
      )
      return
    }
    // Jika diizinkan kembali ke materi lama di belakang
    else {
      if (
        !confirm(
          '⏳ Jika Anda kembali melihat materi lama, sisa akumulasi waktu baca materi saat ini akan direset dari awal saat Anda kembali nanti. Lanjutkan?',
        )
      ) {
        return
      }
    }
  }

  emit('muat-sub-bab', sub)
}

const klikKeluar = () => {
  if (props.sedangMembaca) {
    if (
      !confirm(
        '⏳ Waktu baca belum selesai! Jika Anda keluar, waktu akan diulang dari awal saat Anda kembali. Lanjutkan keluar?',
      )
    ) {
      return
    }
  }
  emit('keluar-kelas')
}
</script>

<template>
  <aside
    :class="[
      'absolute lg:static inset-y-0 left-0 z-50 bg-white border-r border-slate-200/80 shadow-2xl lg:shadow-none flex flex-col h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden',
      tampilSidebarMobile
        ? 'translate-x-0 w-[300px]'
        : '-translate-x-full w-[300px] lg:translate-x-0',
      tampilSidebarDesktop ? 'lg:w-[320px] xl:w-[340px]' : 'lg:w-0 lg:border-none lg:opacity-0',
    ]"
  >
    <div class="p-5 border-b border-slate-100 bg-white shrink-0 relative flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <button
          @click="klikKeluar"
          class="flex-1 px-3 py-3 bg-red-600 text-white hover:bg-red-700 text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 rounded-xl shadow-sm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            ></path>
          </svg>
          KELUAR
        </button>
        <button
          @click="emit('sembunyikan-silabus')"
          class="shrink-0 px-3 py-3 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-500 hover:text-white transition-colors flex items-center justify-center rounded-xl focus:outline-none"
          title="Sembunyikan Silabus"
        >
          <svg class="lg:hidden w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
          <svg
            class="hidden lg:block w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M15 19l-7-7 7-7"
            ></path>
          </svg>
        </button>
      </div>

      <div class="mt-4">
        <h2 class="text-lg font-black text-slate-800 leading-tight truncate">
          {{ kelas ? kelas.nama_matpel : 'Memuat...' }}
        </h2>
        <div v-if="kelas" class="mt-3">
          <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
            Guru Pengampu
          </p>
          <div class="flex items-center gap-2">
            <div
              class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0"
            >
              {{ kelas.guru_nama ? kelas.guru_nama.charAt(0) : '?' }}
            </div>
            <p class="text-xs font-bold text-slate-600 truncate">{{ kelas.guru_nama }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/50 w-full">
      <div v-if="!kelas" class="text-center text-sm font-bold text-slate-400 py-10">
        Membaca silabus...
      </div>

      <div
        v-else
        v-for="bab in kelas.struktur_materi"
        :key="bab.id"
        class="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm transition-all hover:border-emerald-200"
      >
        <button
          @click="emit('toggle-bab', bab.id)"
          class="w-full flex justify-between items-center p-3 bg-white hover:bg-slate-50 transition border-b border-slate-50"
        >
          <h3 class="text-[13px] font-bold text-slate-800 text-left pr-2">{{ bab.judul }}</h3>
          <svg
            :class="[
              'w-4 h-4 text-slate-400 shrink-0 transition-transform',
              babTerbuka.includes(bab.id) ? 'rotate-180' : '',
            ]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </button>

        <div v-show="babTerbuka.includes(bab.id)" class="p-2 space-y-1 bg-slate-50/50">
          <div
            v-if="!bab.sub_bab || bab.sub_bab.length === 0"
            class="text-[11px] font-medium text-slate-400 p-3 italic text-center"
          >
            Belum ada materi.
          </div>

          <button
            v-else
            v-for="sub in bab.sub_bab"
            :key="sub.id"
            @click="klikMateri(sub)"
            :class="[
              'w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-all duration-200 border',
              subBabAktif?.id === sub.id
                ? cekStatusSubBab(sub.id) === 'revisi'
                  ? 'bg-rose-50 border-rose-200 shadow-sm'
                  : 'bg-emerald-50 border-emerald-200 shadow-sm'
                : 'bg-white border-transparent hover:border-slate-200 hover:shadow-sm',

              // REVISI TOTAL: Tampilkan visual gembok abu-abu untuk semua materi yang berada di depan batas maju siswa
              getUrutanGlobal(sub.id) > urutanMaksimalBolehAkses
                ? 'opacity-60 cursor-not-allowed grayscale'
                : '',

              // PUDARKAN MATERI DEPAN JIKA SEDANG MEMBACA (Mencegah kabur ke depan saat timer jalan)
              sedangMembaca && getUrutanGlobal(sub.id) > getUrutanGlobal(subBabAktif?.id)
                ? 'opacity-40 cursor-not-allowed filter grayscale-[50%]'
                : '',
            ]"
          >
            <div
              :class="[
                'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black shadow-inner border border-white/50 transition-colors',
                getUrutanGlobal(sub.id) > urutanMaksimalBolehAkses
                  ? 'bg-slate-200 text-slate-400' // Kunci mati visual lingkaran nomor
                  : cekStatusSubBab(sub.id) === 'selesai' || cekStatusSubBab(sub.id) === 'dinilai'
                    ? 'bg-emerald-500 text-white'
                    : cekStatusSubBab(sub.id) === 'revisi'
                      ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-200'
                      : cekStatusSubBab(sub.id) === 'menunggu'
                        ? 'bg-amber-400 text-white animate-pulse'
                        : 'bg-slate-200 text-slate-500',
              ]"
            >
              <span v-if="getUrutanGlobal(sub.id) > urutanMaksimalBolehAkses" class="text-xs"
                >🔒</span
              >
              <svg
                v-else-if="
                  cekStatusSubBab(sub.id) === 'selesai' || cekStatusSubBab(sub.id) === 'dinilai'
                "
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="3"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              <span v-else-if="cekStatusSubBab(sub.id) === 'revisi'" class="text-xs">!</span>
              <span v-else-if="cekStatusSubBab(sub.id) === 'menunggu'">?</span>
              <span v-else-if="sub.tipe === 'materi'">M</span>
              <span v-else-if="sub.tipe === 'tugas'">T</span>
              <span v-else-if="sub.tipe === 'kuis'">K</span>
            </div>

            <div class="flex-1 overflow-hidden">
              <p
                :class="[
                  'text-xs truncate transition-colors leading-tight',
                  subBabAktif?.id === sub.id
                    ? cekStatusSubBab(sub.id) === 'revisi'
                      ? 'font-black text-rose-800'
                      : 'font-black text-emerald-800'
                    : 'font-bold text-slate-700',
                ]"
              >
                {{ sub.judul }}
              </p>
              <p
                class="text-[8px] font-black uppercase tracking-widest mt-1"
                :class="
                  getUrutanGlobal(sub.id) > urutanMaksimalBolehAkses
                    ? 'text-slate-400'
                    : sub.tipe === 'kuis'
                      ? 'text-purple-500'
                      : sub.tipe === 'tugas'
                        ? 'text-amber-500'
                        : 'text-blue-500'
                "
              >
                {{ getUrutanGlobal(sub.id) > urutanMaksimalBolehAkses ? 'TERKUNCI' : sub.tipe }}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
