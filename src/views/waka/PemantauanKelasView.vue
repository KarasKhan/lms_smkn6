<script setup>
import { ref, computed, onMounted } from 'vue'
import { db } from '../../firebase'
import { collection, getDocs } from 'firebase/firestore'

// State Utama
const daftarKelas = ref([])
const sedangMemuat = ref(true)

// State Filter
const filterGuru = ref('')
const filterRombel = ref('')

// State Modal Intip Silabus
const tampilModalSilabus = ref(false)
const kelasAktif = ref(null)

// Mengambil Seluruh Kelas dari Firebase (Tanpa Batasan NIP)
const fetchSemuaKelas = async () => {
  sedangMemuat.value = true
  try {
    const querySnapshot = await getDocs(collection(db, 'kelas'))
    const dataSementara = []
    querySnapshot.forEach((doc) => {
      dataSementara.push({ id: doc.id, ...doc.data() })
    })
    daftarKelas.value = dataSementara
  } catch (error) {
    console.error('Gagal mengambil data kelas:', error)
    alert('Terjadi kesalahan saat memuat data supervisi.')
  } finally {
    sedangMemuat.value = false
  }
}

onMounted(() => {
  fetchSemuaKelas()
})

// Ekstraksi Daftar Unik untuk Filter
const daftarGuruUnik = computed(() => {
  const guru = daftarKelas.value.map((k) => k.guru_nama).filter(Boolean)
  return [...new Set(guru)].sort()
})

const daftarRombelUnik = computed(() => {
  const rombel = daftarKelas.value.map((k) => k.rombel_target).filter(Boolean)
  return [...new Set(rombel)].sort()
})

// Menerapkan Filter pada Data
const kelasTerfilter = computed(() => {
  return daftarKelas.value
    .filter((kelas) => {
      const cocokGuru = filterGuru.value === '' || kelas.guru_nama === filterGuru.value
      const cocokRombel = filterRombel.value === '' || kelas.rombel_target === filterRombel.value
      return cocokGuru && cocokRombel
    })
    .sort((a, b) => a.nama_matpel.localeCompare(b.nama_matpel))
})

// --- LOGIKA INDIKATOR KESEHATAN KELAS ---
const hitungTotalMateri = (struktur) => {
  if (!struktur || struktur.length === 0) return 0
  return struktur.reduce((total, bab) => total + (bab.sub_bab ? bab.sub_bab.length : 0), 0)
}

const getStatusKesehatan = (kelas) => {
  const totalMateri = hitungTotalMateri(kelas.struktur_materi)
  const totalPertemuan = kelas.pertemuan ? kelas.pertemuan.length : 0

  if (totalMateri === 0 && totalPertemuan === 0) {
    return { kode: 'Mati Suri', warna: 'bg-red-100 text-red-700 border-red-200', ikon: '🔴' }
  } else if (totalMateri > 0 && totalPertemuan === 0) {
    return {
      kode: 'Perlu Perhatian',
      warna: 'bg-amber-100 text-amber-700 border-amber-200',
      ikon: '🟡',
    }
  } else {
    return {
      kode: 'Aktif Berjalan',
      warna: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      ikon: '🟢',
    }
  }
}

// Fungsi Buka Modal
const intipSilabus = (kelas) => {
  kelasAktif.value = kelas
  tampilModalSilabus.value = true
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="border-b border-slate-200 pb-4 mb-6 shrink-0">
      <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Supervisi Kelas</h1>
      <p class="text-sm text-slate-500 mt-1">
        Pemantauan aktivitas KBM digital yang diselenggarakan oleh seluruh tenaga pendidik.
      </p>
    </div>

    <div
      class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
    >
      <div class="flex flex-col sm:flex-row gap-4 flex-1">
        <div class="flex-1 max-w-xs">
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
            >Filter Nama Guru</label
          >
          <select
            v-model="filterGuru"
            class="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none bg-white font-medium text-slate-700"
          >
            <option value="">Semua Guru</option>
            <option v-for="guru in daftarGuruUnik" :key="guru" :value="guru">{{ guru }}</option>
          </select>
        </div>
        <div class="flex-1 max-w-xs">
          <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
            >Filter Rombel</label
          >
          <select
            v-model="filterRombel"
            class="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none bg-white font-medium text-slate-700"
          >
            <option value="">Semua Rombel</option>
            <option v-for="rombel in daftarRombelUnik" :key="rombel" :value="rombel">
              {{ rombel }}
            </option>
          </select>
        </div>
      </div>

      <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 shrink-0">
        <p
          class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1"
        >
          Legenda Status KBM
        </p>
        <div class="flex flex-wrap gap-4 text-xs font-bold">
          <div class="flex items-center gap-1.5 text-emerald-700">
            <span>🟢</span> Aktif Berjalan
          </div>
          <div class="flex items-center gap-1.5 text-amber-700">
            <span>🟡</span> Perlu Perhatian
          </div>
          <div class="flex items-center gap-1.5 text-red-700"><span>🔴</span> Belum Aktif</div>
        </div>
        <p class="text-[9px] text-slate-400 font-medium mt-1.5 leading-tight max-w-[300px]">
          *Status dinilai berdasarkan keberadaan materi ajar dan pelaksanaan presensi absensi.
        </p>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto pb-6 custom-scrollbar">
      <div
        v-if="sedangMemuat"
        class="py-20 flex flex-col items-center justify-center text-slate-400"
      >
        <div
          class="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-4"
        ></div>
        <p class="font-bold">Menyinkronkan data dari seluruh kelas...</p>
      </div>

      <div
        v-else-if="kelasTerfilter.length === 0"
        class="py-20 text-center bg-white border border-dashed border-slate-300 rounded-2xl text-slate-400"
      >
        <span class="text-5xl block mb-3 opacity-50">📂</span>
        <p class="font-bold text-lg text-slate-500">Tidak ada kelas yang ditemukan.</p>
        <p class="text-sm mt-1">Ubah kriteria filter atau tunggu guru membuat kelas baru.</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div
          v-for="kelas in kelasTerfilter"
          :key="kelas.id"
          class="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col relative overflow-hidden group"
        >
          <div
            :class="[
              'h-1.5 w-full absolute top-0 left-0',
              getStatusKesehatan(kelas).kode === 'Aktif Berjalan'
                ? 'bg-emerald-500'
                : getStatusKesehatan(kelas).kode === 'Perlu Perhatian'
                  ? 'bg-amber-400'
                  : 'bg-red-500',
            ]"
          ></div>

          <div class="p-5 flex-1 flex flex-col">
            <div class="flex justify-between items-start mb-3">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100"
              >
                {{ kelas.tahun_ajaran }}
              </span>
              <span :title="getStatusKesehatan(kelas).kode" class="text-lg cursor-help">
                {{ getStatusKesehatan(kelas).ikon }}
              </span>
            </div>

            <h3 class="text-lg font-black text-slate-800 leading-tight mb-1">
              {{ kelas.nama_matpel }}
            </h3>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">
              {{ kelas.rombel_target }}
            </p>

            <div class="mt-auto space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div class="flex items-center gap-2">
                <div
                  class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0"
                >
                  {{ kelas.guru_nama ? kelas.guru_nama.charAt(0) : '?' }}
                </div>
                <p class="text-xs font-bold text-slate-700 truncate" :title="kelas.guru_nama">
                  {{ kelas.guru_nama || 'Tanpa Nama Guru' }}
                </p>
              </div>
              <div class="grid grid-cols-3 gap-2 border-t border-slate-200 pt-3">
                <div class="text-center">
                  <p class="text-sm font-black text-slate-700">{{ kelas.jumlah_siswa || 0 }}</p>
                  <p class="text-[9px] font-bold text-slate-400 uppercase">Siswa</p>
                </div>
                <div class="text-center border-l border-r border-slate-200">
                  <p class="text-sm font-black text-slate-700">
                    {{ hitungTotalMateri(kelas.struktur_materi) }}
                  </p>
                  <p class="text-[9px] font-bold text-slate-400 uppercase">Materi</p>
                </div>
                <div class="text-center">
                  <p class="text-sm font-black text-slate-700">
                    {{ kelas.pertemuan ? kelas.pertemuan.length : 0 }}
                  </p>
                  <p class="text-[9px] font-bold text-slate-400 uppercase">Sesi</p>
                </div>
              </div>
            </div>
          </div>

          <div class="px-5 pb-5">
            <button
              @click="intipSilabus(kelas)"
              class="w-full py-2.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 transition flex items-center justify-center gap-2 shadow-sm"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                ></path>
              </svg>
              Intip Silabus Guru
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="tampilModalSilabus && kelasAktif"
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        >
          <div
            class="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0"
          >
            <div>
              <h3 class="font-bold text-slate-800 text-lg">Pratinjau Silabus & Materi</h3>
              <p class="text-xs font-medium text-slate-500 mt-0.5">
                Mata Pelajaran:
                <span class="font-bold text-emerald-600"
                  >{{ kelasAktif.nama_matpel }} ({{ kelasAktif.rombel_target }})</span
                >
              </p>
            </div>
            <button
              @click="tampilModalSilabus = false"
              class="text-slate-400 hover:text-red-500 text-2xl font-light w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:border-red-200 rounded-full transition"
            >
              &times;
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
            <div
              v-if="!kelasAktif.struktur_materi || kelasAktif.struktur_materi.length === 0"
              class="text-center py-10"
            >
              <span class="text-4xl block mb-2 opacity-30">📚</span>
              <p class="text-sm font-bold text-slate-400">Guru belum menyusun silabus materi.</p>
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="(bab, index) in kelasAktif.struktur_materi"
                :key="bab.id"
                class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
              >
                <div
                  class="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-3"
                >
                  <span
                    class="w-6 h-6 rounded bg-slate-200 text-slate-600 text-xs font-black flex items-center justify-center shrink-0"
                    >{{ index + 1 }}</span
                  >
                  <h4 class="font-bold text-slate-700 text-sm">{{ bab.judul }}</h4>
                </div>

                <div class="p-3">
                  <div
                    v-if="!bab.sub_bab || bab.sub_bab.length === 0"
                    class="text-xs text-slate-400 italic px-2"
                  >
                    Belum ada sub-materi di bab ini.
                  </div>
                  <div v-else class="space-y-2">
                    <div
                      v-for="sub in bab.sub_bab"
                      :key="sub.id"
                      class="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition"
                    >
                      <div class="flex items-center gap-2 truncate pr-4">
                        <span class="text-slate-300">📄</span>
                        <span class="text-xs font-medium text-slate-600 truncate">{{
                          sub.judul
                        }}</span>
                      </div>
                      <span
                        :class="[
                          'text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider shrink-0',
                          sub.tipe === 'kuis'
                            ? 'bg-purple-100 text-purple-600'
                            : sub.tipe === 'tugas'
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-slate-100 text-slate-500',
                        ]"
                        >{{ sub.tipe }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex justify-end">
            <button
              @click="tampilModalSilabus = false"
              class="px-5 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-900 transition"
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
