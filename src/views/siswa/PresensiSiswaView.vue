<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '../../firebase'
import { doc, getDoc, runTransaction } from 'firebase/firestore'
import { Html5Qrcode } from 'html5-qrcode'
import { useUiStore } from '../../stores/uiStore'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()

const idKelas = route.params.idKelas ? route.params.idKelas.trim() : ''
const nisLogin = localStorage.getItem('user_nip')

const kelas = ref(null)
const tabAktif = ref('kamera')
const sedangMemproses = ref(false)
const pesanError = ref('')
const pesanSukses = ref('')

const kodePinInput = ref('')

let html5QrcodeScanner = null
let html5QrcodeFile = null

onMounted(async () => {
  if (!idKelas) {
    pesanError.value = 'ID Kelas tidak ditemukan di rute.'
    return
  }
  await ambilInfoKelas()
  initKameraScanner()
})

onUnmounted(() => {
  stopScanner()
})

const ambilInfoKelas = async () => {
  try {
    const docRef = doc(db, 'kelas', idKelas)
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      kelas.value = snap.data()
    } else {
      pesanError.value = `Ruang kelas dengan ID tersebut tidak ditemukan.`
    }
  } catch (err) {
    console.error(err)
    pesanError.value = 'Gagal memuat informasi kelas dari server.'
  }
}

const initKameraScanner = () => {
  setTimeout(() => {
    const readerEl = document.getElementById('reader-kamera')
    if (!readerEl) return

    // Menggunakan Html5Qrcode murni untuk mem-bypass UI bawaan
    html5QrcodeScanner = new Html5Qrcode('reader-kamera')
    const config = { fps: 10, qrbox: { width: 250, height: 250 } }

    // Memaksa menggunakan kamera belakang (environment)
    html5QrcodeScanner
      .start({ facingMode: 'environment' }, config, onScanSuccess, onScanFailure)
      .catch((err) => {
        console.error(err)
        pesanError.value =
          'Gagal mengakses kamera belakang. Pastikan izin kamera di browser sudah diberikan.'
      })
  }, 300)
}

const stopScanner = () => {
  if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
    html5QrcodeScanner.stop().catch((err) => console.error(err))
  }
}

const gantiTab = (tab) => {
  tabAktif.value = tab
  pesanError.value = ''
  pesanSukses.value = ''

  if (tab === 'kamera') {
    initKameraScanner()
  } else {
    stopScanner()
  }
}

const onScanSuccess = async (decodedText) => {
  if (decodedText) {
    stopScanner()
    await eksekusiAbsensiKehadiran(decodedText.trim())
  }
}

const onScanFailure = () => {}

const handleUploadGambarQR = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  sedangMemproses.value = true
  pesanError.value = ''
  pesanSukses.value = ''

  try {
    if (!html5QrcodeFile) {
      html5QrcodeFile = new Html5Qrcode('reader-file')
    }
    const decodedText = await html5QrcodeFile.scanFile(file, true)
    await eksekusiAbsensiKehadiran(decodedText)
  } catch (err) {
    console.error(err)
    pesanError.value = 'Gagal mendekode QR. Pastikan foto tidak silau dan terpotong.'
  } finally {
    sedangMemproses.value = false
    e.target.value = ''
  }
}

const handleInputKodeManual = async () => {
  if (!kodePinInput.value) {
    pesanError.value = 'Silakan masukkan Token Kehadiran (PIN) terlebih dahulu!'
    return
  }
  await eksekusiAbsensiKehadiran(kodePinInput.value)
}

const eksekusiAbsensiKehadiran = async (inputKarakter) => {
  if (!inputKarakter) return

  sedangMemproses.value = true
  pesanError.value = ''
  pesanSukses.value = ''

  // Tampilkan layar loading dan kunci aksi pengguna
  uiStore.showLoading('Memvalidasi token kehadiran Anda...')

  try {
    const docRef = doc(db, 'kelas', idKelas)

    // Membungkus proses presensi ke dalam Transaction Firestore
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef)

      if (!snap.exists()) {
        throw new Error('Dokumen kelas ini sudah tidak tersedia di server.')
      }

      const dataTerbaru = snap.data()

      if (!dataTerbaru.pertemuan || dataTerbaru.pertemuan.length === 0) {
        throw new Error('Guru belum membuka sesi presensi untuk pertemuan ini.')
      }

      const targetClean = inputKarakter.trim().toUpperCase()
      const sesi = dataTerbaru.pertemuan.find(
        (p) =>
          p.id === inputKarakter.trim() || p.pin?.toString().trim().toUpperCase() === targetClean,
      )

      if (!sesi) {
        throw new Error('Token PIN / QR Code tidak dikenali atau salah!')
      }

      const waktuBuat = new Date(sesi.waktu_dibuat)
      const menitDurasi = sesi.durasi || 15
      const waktuTenggatAbsen = new Date(waktuBuat.getTime() + menitDurasi * 60000)
      const sekarang = new Date()

      if (sekarang > waktuTenggatAbsen) {
        throw new Error(
          `Sesi presensi telah ditutup otomatis karena melewati batas ${menitDurasi} menit.`,
        )
      }

      const listSiswa = JSON.parse(JSON.stringify(dataTerbaru.siswa))
      const idx = listSiswa.findIndex((s) => s.nis === nisLogin)

      if (idx !== -1) {
        const dataSiswa = listSiswa[idx]

        // Validasi Lintas Rombel
        if (sesi.rombel && dataSiswa.rombel !== sesi.rombel) {
          throw new Error(
            `Akses Ditolak: Sesi ini khusus untuk kelas ${sesi.rombel}. Anda terdaftar di kelas ${dataSiswa.rombel}.`,
          )
        }

        if (!dataSiswa.kehadiran) dataSiswa.kehadiran = {}
        dataSiswa.kehadiran[sesi.id] = 'H'

        // Menyimpan data terbaru ke Firestore secara atomik
        transaction.update(docRef, { siswa: listSiswa })
      } else {
        throw new Error('Akses Ditolak: Anda tidak terdaftar dalam mata pelajaran ini.')
      }
    })

    // --- Jika transaksi berhasil melewati blok di atas tanpa error ---
    pesanSukses.value = 'Validasi Berhasil! Kehadiran Anda telah tercatat.'

    setTimeout(() => {
      router.replace(`/siswa/kelas/${idKelas}`)
    }, 2000)
  } catch (err) {
    console.error('Transaksi Absensi Gagal:', err)
    // Menangkap pesan error spesifik dari 'throw new Error' di dalam transaksi
    pesanError.value = err.message || 'Terjadi kegagalan jaringan Firestore. Coba lagi.'
  } finally {
    sedangMemproses.value = false

    // Matikan layar loading saat proses selesai
    uiStore.hideLoading()
  }
}
</script>

<template>
  <div id="reader-file" class="absolute -top-[9999px] -left-[9999px] invisible"></div>

  <div
    class="h-full w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F8FAFC]"
  >
    <div
      class="w-full max-w-[480px] bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-500 relative"
    >
      <div
        class="bg-gradient-to-br from-emerald-600 to-teal-800 px-8 py-10 text-center relative overflow-hidden shrink-0"
      >
        <div
          class="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full mix-blend-overlay -translate-y-1/2 translate-x-1/4 filter blur-2xl"
        ></div>
        <div
          class="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400/20 rounded-full mix-blend-overlay translate-y-1/3 -translate-x-1/3 filter blur-xl"
        ></div>

        <div class="relative z-10">
          <div
            class="w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-md flex items-center justify-center mx-auto mb-5 border border-white/30 shadow-inner"
          >
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              ></path>
            </svg>
          </div>
          <h1 class="text-2xl font-black text-white tracking-tight">Presensi Kelas</h1>
          <p class="text-emerald-100 text-[13px] font-medium mt-1.5 opacity-90 truncate px-4">
            {{ kelas ? kelas.nama_matpel : 'Menyiapkan modul...' }}
          </p>
        </div>
      </div>

      <div class="p-6 sm:p-8 flex flex-col flex-1">
        <div
          v-if="pesanError"
          class="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-start gap-3 shadow-sm"
        >
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <p class="flex-1 leading-relaxed mt-0.5">{{ pesanError }}</p>
        </div>

        <div
          v-if="pesanSukses"
          class="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-3 shadow-sm animate-pulse"
        >
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <p class="flex-1 leading-relaxed">{{ pesanSukses }}</p>
        </div>

        <div
          class="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-6 shrink-0"
          v-if="!pesanSukses && !sedangMemproses"
        >
          <button
            @click="gantiTab('kamera')"
            :class="[
              'flex-1 py-2.5 text-xs rounded-xl transition-all font-bold',
              tabAktif === 'kamera'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ]"
          >
            Pindai QR
          </button>
          <button
            @click="gantiTab('kode')"
            :class="[
              'flex-1 py-2.5 text-xs rounded-xl transition-all font-bold',
              tabAktif === 'kode'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ]"
          >
            Input Token
          </button>
          <button
            @click="gantiTab('upload')"
            :class="[
              'flex-1 py-2.5 text-xs rounded-xl transition-all font-bold',
              tabAktif === 'upload'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ]"
          >
            Upload Foto
          </button>
        </div>

        <div class="space-y-4" v-if="!pesanSukses && !sedangMemproses">
          <div
            v-show="tabAktif === 'kamera'"
            class="relative rounded-3xl overflow-hidden bg-slate-900 border-4 border-slate-100 shadow-inner flex flex-col items-center justify-center min-h-[320px] group"
          >
            <div id="reader-kamera" class="w-full relative z-10"></div>
            <div
              class="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl z-20 pointer-events-none transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1"
            ></div>
            <div
              class="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl z-20 pointer-events-none transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
            ></div>
            <div
              class="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl z-20 pointer-events-none transition-transform group-hover:-translate-x-1 group-hover:translate-y-1"
            ></div>
            <div
              class="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl z-20 pointer-events-none transition-transform group-hover:translate-x-1 group-hover:translate-y-1"
            ></div>
          </div>

          <div v-if="tabAktif === 'kode'" class="space-y-6 py-4 animate-in fade-in duration-300">
            <div class="text-center space-y-2">
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-widest"
                >Token Dari Proyektor Guru</label
              >
              <input
                type="text"
                maxlength="7"
                v-model="kodePinInput"
                placeholder="XXX-XXX"
                @keyup.enter="handleInputKodeManual"
                class="w-full border-2 border-slate-200 bg-slate-50 rounded-2xl px-4 py-5 text-4xl font-black text-center text-emerald-700 focus:border-emerald-500 focus:bg-white focus:shadow-md outline-none transition uppercase tracking-[0.2em] placeholder:text-slate-300"
              />
            </div>
            <button
              @click="handleInputKodeManual"
              class="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 text-sm flex items-center justify-center gap-2"
            >
              VALIDASI KEHADIRAN
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                ></path>
              </svg>
            </button>
          </div>

          <div v-if="tabAktif === 'upload'" class="space-y-4 py-2 animate-in fade-in duration-300">
            <label
              class="block text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center"
              >Unggah Tangkapan Layar QR</label
            >
            <div
              class="border-2 border-dashed border-slate-300 rounded-3xl p-10 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-400 transition-colors cursor-pointer relative group flex flex-col items-center justify-center"
            >
              <input
                type="file"
                accept="image/*"
                @change="handleUploadGambarQR"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                class="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
              >
                <svg
                  class="w-8 h-8 text-slate-400 group-hover:text-emerald-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  ></path>
                </svg>
              </div>
              <p class="text-sm font-bold text-slate-700">Pilih Berkas Gambar</p>
              <p class="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                JPG, JPEG, PNG
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="sedangMemproses"
          class="py-16 flex flex-col items-center justify-center text-slate-500 flex-1"
        >
          <div class="relative w-16 h-16 mb-4">
            <div class="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            <div
              class="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"
            ></div>
          </div>
          <p class="font-bold text-xs uppercase tracking-widest text-emerald-700">
            Memvalidasi Data...
          </p>
        </div>

        <div class="mt-auto pt-6">
          <div
            v-if="pesanSukses"
            class="w-full py-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-xs rounded-xl flex items-center justify-center gap-3 animate-pulse"
          >
            <div
              class="w-4 h-4 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"
            ></div>
            Tunggu, sedang mengalihkan ke halaman belajar...
          </div>
          <button
            v-else
            @click="router.back()"
            class="w-full py-3.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition"
          >
            Batalkan & Kembali
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(#reader-kamera) {
  border: none !important;
  background: transparent !important;
}
:deep(#reader-kamera__dashboard_section_csr span) {
  color: #94a3b8 !important;
  font-family: inherit !important;
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
:deep(#reader-kamera button) {
  background-color: #10b981 !important;
  color: white !important;
  padding: 0.6rem 1.5rem !important;
  border-radius: 0.75rem !important;
  font-weight: 700 !important;
  font-size: 0.875rem !important;
  border: none !important;
  transition: all 0.2s !important;
  margin: 0.5rem 0 !important;
  cursor: pointer !important;
  box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2) !important;
}
:deep(#reader-kamera button:hover) {
  background-color: #059669 !important;
  transform: translateY(-1px);
}
:deep(#reader-kamera select) {
  padding: 0.6rem 1rem !important;
  border-radius: 0.75rem !important;
  border: 2px solid #e2e8f0 !important;
  background-color: white !important;
  font-size: 0.875rem !important;
  font-weight: 600 !important;
  color: #334155 !important;
  outline: none !important;
  margin-bottom: 0.5rem !important;
  max-width: 90%;
  cursor: pointer;
}
:deep(#reader-kamera select:focus) {
  border-color: #10b981 !important;
}
:deep(#reader-kamera__video-flow) {
  width: 100% !important;
  border-radius: 1.5rem !important;
  object-fit: cover !important;
}
:deep(#reader-kamera__dashboard_section_swaplink) {
  display: none !important;
}
:deep(#html5-qrcode-anchor-scan-type-change) {
  display: none !important;
}
</style>
