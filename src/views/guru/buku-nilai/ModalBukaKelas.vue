<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { db } from '../../../firebase'
import { doc, getDoc } from 'firebase/firestore'

const props = defineProps({
  kelas: { type: Object, required: true },
})

const emit = defineEmits(['tutup', 'sesi-dibuka', 'simpan-rekap'])

// Mode Layar: 'pilih_rombel' | 'qr' | 'resume'
const modeLayar = ref('pilih_rombel')
const rombelTerpilih = ref('')
const semesterSesi = ref('1')

const pinKelas = ref('')
const qrCodeUrl = ref('')
const waktuBerjalan = ref('00:00')
let intervalTimer = null
let detik = 0

const idSesiAktif = ref('p' + Date.now())
const sedangMemuatLive = ref(false)
const daftarSiswaLive = ref([])
const drafKehadiran = ref({})

// Memecah string rombel target kelas (misal: "XI RPL 1, XI RPL 2" menjadi array)
const listRombelSaran = computed(() => {
  if (!props.kelas || !props.kelas.rombel_target) return []
  return props.kelas.rombel_target
    .split(', ')
    .map((r) => r.trim())
    .filter(Boolean)
})

onMounted(() => {
  // Jalur Cepat: Jika kelas dari awal hanya dikonfigurasi untuk 1 rombel, langsung lewati seleksi
  if (listRombelSaran.value.length <= 1) {
    const rombelTunggal = listRombelSaran.value[0] || props.kelas.rombel_target
    konfirmasiPilihanRombel(rombelTunggal)
  }
})

onUnmounted(() => {
  clearInterval(intervalTimer)
})

// Fungsi trigger setelah guru memilih rombel spesifik yang sedang diajar saat itu
const konfirmasiPilihanRombel = (rombelName) => {
  rombelTerpilih.value = rombelName
  generatePIN()
  mulaiTimer()
  modeLayar.value = 'qr'

  // Laporkan ke ManajemenKelasView untuk membuat sesi aktif di Firestore untuk rombel ini
  emit('sesi-dibuka', {
    id: idSesiAktif.value,
    pin: pinKelas.value,
    durasi: 15,
    rombel: rombelTerpilih.value,
    semester: semesterSesi.value,
  })
}

// FUNGSI BARU: Batalkan di Layar QR
const klikBatalSesiQR = () => {
  if (confirm('Batalkan kelas hari ini? Kode QR akan hangus dan data tidak tersimpan.')) {
    clearInterval(intervalTimer)
    emit('batalkan-sesi', idSesiAktif.value)
  }
}

const generatePIN = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  pinKelas.value = result.slice(0, 3) + '-' + result.slice(3, 6)
  qrCodeUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${pinKelas.value}`
}

const mulaiTimer = () => {
  if (intervalTimer) clearInterval(intervalTimer)
  intervalTimer = setInterval(() => {
    detik++
    const m = Math.floor(detik / 60)
      .toString()
      .padStart(2, '0')
    const s = (detik % 60).toString().padStart(2, '0')
    waktuBerjalan.value = `${m}:${s}`
  }, 1000)
}

const lanjutKeResume = async () => {
  clearInterval(intervalTimer)
  sedangMemuatLive.value = true
  modeLayar.value = 'resume'

  try {
    const docRef = doc(db, 'kelas', props.kelas.id)
    const snap = await getDoc(docRef)

    if (snap.exists()) {
      const dataTerbaru = snap.data()
      // PERBAIKAN: Hanya saring siswa yang rombelnya cocok dengan rombel aktif saat ini!
      daftarSiswaLive.value = [...dataTerbaru.siswa]
        .filter((s) => s.rombel === rombelTerpilih.value)
        .sort((a, b) => a.nama.localeCompare(b.nama))

      daftarSiswaLive.value.forEach((s) => {
        const statusDariSiswa = s.kehadiran?.[idSesiAktif.value]
        drafKehadiran.value[s.nis] = statusDariSiswa === 'H' ? 'H' : 'A'
      })
    }
  } catch (error) {
    console.error('Gagal rekap live:', error)
    alert('Terjadi kesalahan jaringan saat menarik rekapitulasi data.')
  } finally {
    sedangMemuatLive.value = false
  }
}

const kembaliKeQR = () => {
  mulaiTimer()
  modeLayar.value = 'qr'
}

const statistikDraf = computed(() => {
  let h = 0,
    s = 0,
    i = 0,
    a = 0
  Object.values(drafKehadiran.value).forEach((val) => {
    if (val === 'H') h++
    else if (val === 'S') s++
    else if (val === 'I') i++
    else a++
  })
  return { h, s, i, a }
})

const simpanPermanen = () => {
  if (confirm(`Finalisasi kehadiran untuk kelas ${rombelTerpilih.value}? Sesi akan dikunci.`)) {
    emit('simpan-rekap', {
      idSesi: idSesiAktif.value,
      rombel: rombelTerpilih.value,
      dataKehadiran: drafKehadiran.value,
    })
  }
}
</script>

<template>
  <div
    class="fixed inset-0 bg-white z-[9999] flex flex-col overflow-hidden animate-in evils-fade-in duration-300"
  >
    <div
      v-if="modeLayar === 'pilih_rombel'"
      class="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50"
    >
      <div
        class="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-2xl text-center"
      >
        <span class="text-4xl block mb-3">👨‍🏫</span>
        <h3 class="text-xl font-black text-slate-800 tracking-tight">Konfirmasi Sesi Kelas</h3>
        <p class="text-sm text-slate-500 mt-2 mb-6">
          Pilih Rombel dan Semester untuk sesi pertemuan ini.
        </p>

        <!-- PILIH SEMESTER -->
        <div class="flex bg-slate-100 p-1 rounded-xl mb-5 border border-slate-200">
          <button
            @click="semesterSesi = '1'"
            :class="[
              'flex-1 py-2 text-xs font-bold rounded-lg transition',
              semesterSesi === '1' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500',
            ]"
          >
            Semester 1 (Ganjil)
          </button>
          <button
            @click="semesterSesi = '2'"
            :class="[
              'flex-1 py-2 text-xs font-bold rounded-lg transition',
              semesterSesi === '2' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500',
            ]"
          >
            Semester 2 (Genap)
          </button>
        </div>

        <div class="space-y-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
          <button
            v-for="rombel in listRombelSaran"
            :key="rombel"
            @click="konfirmasiPilihanRombel(rombel)"
            class="w-full py-3 px-4 border-2 border-slate-100 bg-slate-50 rounded-xl font-black text-slate-700 text-sm hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition"
          >
            Mulai Kelas: {{ rombel }}
          </button>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-100">
          <button
            @click="emit('tutup')"
            class="text-xs font-bold text-slate-400 hover:text-red-500 transition"
          >
            &times; Batalkan Sesi Absensi
          </button>
        </div>
      </div>
    </div>

    <template v-else>
      <div
        class="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0"
      >
        <div>
          <div class="flex items-center gap-3">
            <span v-if="modeLayar === 'qr'" class="relative flex h-3 w-3">
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
              ></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span v-else class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            <h2 class="text-xl font-black text-slate-800 tracking-tight">
              {{
                modeLayar === 'qr'
                  ? 'Sesi Presensi LIVE Rombel: ' + rombelTerpilih
                  : 'Tinjauan Akhir Absensi: ' + rombelTerpilih
              }}
            </h2>
          </div>
          <p class="text-sm text-slate-500 mt-1 font-medium">
            {{ props.kelas.nama_matpel }} | TA. {{ props.kelas.tahun_ajaran }}
          </p>
        </div>

        <div class="flex items-center gap-8">
          <div class="text-right">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Durasi Sesi
            </p>
            <p class="text-2xl font-black text-slate-800 font-mono">{{ waktuBerjalan }}</p>
          </div>

          <div v-if="modeLayar === 'qr'" class="flex gap-2">
            <!-- TOMBOL BATAL BARU -->
            <button
              @click="klikBatalSesiQR"
              class="bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-3 rounded-xl font-bold transition flex items-center gap-2 border border-rose-200"
            >
              Batalkan Sesi
            </button>
            <button
              @click="lanjutKeResume"
              class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-md flex items-center gap-2"
            >
              Kunci Akses & Tinjau Rekap &rarr;
            </button>
          </div>

          <div v-else class="flex gap-3">
            <button
              @click="kembaliKeQR"
              class="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-5 py-3 rounded-xl font-bold transition"
            >
              Kembali Tampil QR
            </button>
            <button
              @click="simpanPermanen"
              class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-md flex items-center gap-2"
            >
              Simpan Absensi Rapor ↗
            </button>
          </div>
        </div>
      </div>

      <div v-if="modeLayar === 'qr'" class="flex-1 flex bg-white items-center justify-center p-12">
        <div class="max-w-md w-full text-center">
          <h3 class="text-3xl font-black text-slate-800 mb-2">Pindai QR Kehadiran</h3>
          <p class="text-slate-500 mb-10 text-lg">
            Gunakan aplikasi smartphone siswa untuk memproses entri log.
          </p>

          <div
            class="p-6 bg-white border-2 border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 mb-8 inline-block"
          >
            <img :src="qrCodeUrl" alt="QR Code" class="w-64 h-64 rounded-xl" />
          </div>

          <div
            class="flex items-center justify-center gap-4 bg-slate-100 px-8 py-4 rounded-2xl border border-slate-200 max-w-sm mx-auto"
          >
            <span class="text-xs font-black text-slate-400 uppercase tracking-wider">TOKEN:</span>
            <span class="text-4xl font-black text-emerald-600 tracking-widest font-mono">{{
              pinKelas
            }}</span>
          </div>
        </div>
      </div>

      <div
        v-else-if="modeLayar === 'resume'"
        class="flex-1 flex flex-col overflow-hidden bg-slate-50"
      >
        <div v-if="sedangMemuatLive" class="flex-1 flex flex-col items-center justify-center">
          <div
            class="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"
          ></div>
          <p class="font-bold text-slate-400">Menyusun ringkasan kehadiran...</p>
        </div>

        <template v-else>
          <div class="bg-white p-6 border-b border-slate-200 shrink-0 grid grid-cols-4 gap-6">
            <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
              <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                Hadir via App
              </p>
              <p class="text-3xl font-black text-emerald-800">{{ statistikDraf.h }}</p>
            </div>
            <div class="bg-amber-50 border border-amber-100 p-4 rounded-xl text-center">
              <p class="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">
                Sakit
              </p>
              <p class="text-3xl font-black text-amber-800">{{ statistikDraf.s }}</p>
            </div>
            <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center">
              <p class="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Izin</p>
              <p class="text-3xl font-black text-blue-800">{{ statistikDraf.i }}</p>
            </div>
            <div class="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
              <p class="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">
                Alpa / Belum Scan
              </p>
              <p class="text-3xl font-black text-red-800">{{ statistikDraf.a }}</p>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-8 flex justify-center custom-scrollbar">
            <div
              class="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-max"
            >
              <table class="w-full text-left">
                <thead
                  class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider"
                >
                  <tr>
                    <th class="p-4 w-16 text-center">No</th>
                    <th class="p-4">Identitas Siswa ({{ rombelTerpilih }})</th>
                    <th class="p-4 text-center w-64">Intervensi Status Manual</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">
                  <tr
                    v-for="(siswa, index) in daftarSiswaLive"
                    :key="siswa.nis"
                    class="hover:bg-slate-50 transition"
                  >
                    <td class="p-4 text-center font-bold text-slate-400">{{ index + 1 }}.</td>
                    <td class="p-4">
                      <p class="font-bold text-slate-800">{{ siswa.nama }}</p>
                      <p class="text-[10px] text-slate-400 mt-0.5 font-medium">
                        NIS: {{ siswa.nis }}
                      </p>
                    </td>
                    <td class="p-4">
                      <select
                        v-model="drafKehadiran[siswa.nis]"
                        :class="[
                          'w-full text-sm font-bold rounded-lg border-2 px-3 py-2 outline-none transition-all cursor-pointer',
                          drafKehadiran[siswa.nis] === 'H'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : drafKehadiran[siswa.nis] === 'S'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : drafKehadiran[siswa.nis] === 'I'
                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                : 'bg-red-50 border-red-200 text-red-700',
                        ]"
                      >
                        <option value="H">Hadir</option>
                        <option value="S">Sakit (Ada Surat/WA)</option>
                        <option value="I">Izin (Dispensasi)</option>
                        <option value="A">Alpa (Tidak Ada Kabar)</option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>
    </template>
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
