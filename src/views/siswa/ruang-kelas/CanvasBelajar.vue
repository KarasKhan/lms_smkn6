<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  dataSiswa: Object, // Props baru untuk menerima data lengkap profil dan history siswa
  subBabAktif: Object,
  statusSubBab: String,
  sedangMenyimpan: Boolean,
})

const emit = defineEmits(['kirim-tugas', 'kirim-kuis'])

const jawabanKuis = ref({})
const inputTugasURL = ref('')
const fileTugas = ref(null)
const sedangUploadFile = ref(false)
const fileInputRef = ref(null)

const izinkanLink = computed(
  () =>
    !props.subBabAktif.jenis_pengumpulan ||
    props.subBabAktif.jenis_pengumpulan.length === 0 ||
    props.subBabAktif.jenis_pengumpulan.includes('link'),
)
const izinkanPDF = computed(
  () => props.subBabAktif.jenis_pengumpulan && props.subBabAktif.jenis_pengumpulan.includes('pdf'),
)

// === LOGIKA REVISI EKSKLUSIF SISWA ===
const dataRevisi = computed(() => {
  if (!props.dataSiswa || !props.dataSiswa.catatan_revisi || !props.subBabAktif) return null
  return props.dataSiswa.catatan_revisi[props.subBabAktif.id] || null
})

const isRevisiAktif = computed(() => {
  return dataRevisi.value && dataRevisi.value.aktif === true
})

const isWaktuRevisiHabis = computed(() => {
  if (!isRevisiAktif.value || !dataRevisi.value.batas_waktu) return false
  const sekarang = new Date()
  const batas = new Date(dataRevisi.value.batas_waktu)
  return sekarang > batas
})

// Fungsi Format Tanggal untuk Tampilan
const formatTanggal = (isoString) => {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Menentukan apakah form UI boleh diisi siswa
const bisaMengisiForm = computed(() => {
  // Boleh jika belum pernah sama sekali ATAU jika statusnya Revisi tapi belum kehabisan waktu
  return props.statusSubBab === 'belum' || (isRevisiAktif.value && !isWaktuRevisiHabis.value)
})

watch(
  () => props.subBabAktif?.id,
  () => {
    jawabanKuis.value = {}
    inputTugasURL.value = ''
    fileTugas.value = null
  },
  { immediate: true },
)

const handleFileChange = (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (file.type !== 'application/pdf') {
    alert('Hanya file PDF yang diizinkan.')
    e.target.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('Ukuran file maksimal 5MB!')
    e.target.value = ''
    return
  }
  fileTugas.value = file
}

const triggerPilihFile = () => {
  if (fileInputRef.value) fileInputRef.value.click()
}

const handleKirimTugas = async () => {
  const payload = {}
  if (izinkanLink.value && inputTugasURL.value) payload.link = inputTugasURL.value

  if (izinkanPDF.value && fileTugas.value) {
    sedangUploadFile.value = true
    const formData = new FormData()
    formData.append('image', fileTugas.value)

    try {
      const r = await fetch('https://gurumales.com/upload.php', { method: 'POST', body: formData })
      const hasil = await r.json()
      if (hasil.success) {
        payload.pdf = hasil.url
      } else {
        sedangUploadFile.value = false
        return alert(hasil.message || 'Gagal mengunggah file.')
      }
    } catch (error) {
      console.error('Upload gagal:', error) // <-- Tambahkan baris ini agar variabel terpakai
      sedangUploadFile.value = false
      return alert('Terjadi kesalahan jaringan saat mengunggah ke server.')
    }
  }

  if (Object.keys(payload).length === 0)
    return alert('Silakan lampirkan tugas Anda sebelum mengumpulkan!')
  emit('kirim-tugas', payload)
}

const handleKirimKuis = () => {
  if (Object.keys(jawabanKuis.value).length < props.subBabAktif.daftar_soal.length) {
    if (!confirm('Masih ada soal kosong. Yakin ingin mengumpulkan?')) return
  }
  emit('kirim-kuis', jawabanKuis.value)
}
</script>

<template>
  <div
    class="max-w-[850px] w-full mx-auto bg-white rounded-[1.5rem] shadow-sm border border-slate-200/60 my-6 lg:my-10 flex flex-col overflow-hidden shrink-0"
  >
    <div class="px-6 lg:px-14 py-8 lg:py-10 bg-white flex-1">
      <div
        v-if="subBabAktif.konten_teks"
        class="materi-viewer"
        v-html="subBabAktif.konten_teks"
      ></div>

      <div
        v-if="isRevisiAktif"
        :class="[
          'mb-8 p-6 rounded-2xl border-2 flex flex-col sm:flex-row gap-5',
          isWaktuRevisiHabis
            ? 'bg-red-50 border-red-200'
            : 'bg-rose-50 border-rose-200 shadow-md shadow-rose-100',
        ]"
      >
        <div
          class="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
          :class="isWaktuRevisiHabis ? 'bg-red-100 text-red-600' : 'bg-rose-200/50 text-rose-600'"
        >
          {{ isWaktuRevisiHabis ? '🚫' : '⚠️' }}
        </div>
        <div class="flex-1">
          <h4
            class="text-sm font-black uppercase tracking-widest mb-1"
            :class="isWaktuRevisiHabis ? 'text-red-700' : 'text-rose-700'"
          >
            {{ isWaktuRevisiHabis ? 'WAKTU REVISI HABIS' : 'INSTRUKSI REVISI DARI GURU' }}
          </h4>
          <p class="text-slate-800 font-medium leading-relaxed mb-3">
            "{{ dataRevisi.catatan_guru }}"
          </p>
          <div class="flex flex-col sm:flex-row gap-3">
            <span
              :class="[
                'text-xs font-bold px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5',
                isWaktuRevisiHabis
                  ? 'bg-red-100 text-red-800 border-red-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300',
              ]"
            >
              Batas Kumpul: {{ formatTanggal(dataRevisi.batas_waktu) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="subBabAktif.tipe === 'kuis' && subBabAktif.daftar_soal" class="space-y-6">
        <h3 class="text-lg font-black text-slate-800 border-b-2 border-slate-100 pb-2">
          Lembar Jawaban Evaluasi
        </h3>
        <div
          v-for="(soal, i) in subBabAktif.daftar_soal"
          :key="soal.id"
          class="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm"
        >
          <div class="flex items-start gap-3 mb-4">
            <div
              class="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center text-sm font-black shrink-0"
            >
              {{ i + 1 }}
            </div>
            <p class="text-base font-bold text-slate-800 leading-relaxed pt-1">
              {{ soal.pertanyaan }}
            </p>
          </div>
          <div v-if="soal.jenis === 'pilgan'" class="grid grid-cols-1 md:grid-cols-2 gap-3 pl-11">
            <label
              v-for="(val, key) in soal.opsi"
              :key="key"
              :class="[
                'flex items-start gap-2.5 p-3 rounded-lg border-2 cursor-pointer transition-all',
                jawabanKuis[soal.id] === key
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200',
              ]"
            >
              <input
                type="radio"
                :name="`soal_${soal.id}`"
                :value="key"
                v-model="jawabanKuis[soal.id]"
                :disabled="!bisaMengisiForm"
                class="mt-0.5 w-4 h-4 text-emerald-600 bg-white border-gray-300"
              />
              <div class="flex-1 text-sm">
                <span class="font-black uppercase mr-1.5 text-slate-400">{{ key }}.</span>
                <span class="font-medium text-slate-700">{{ val }}</span>
              </div>
            </label>
          </div>
          <div v-if="soal.jenis === 'esai'" class="pl-11">
            <textarea
              v-model="jawabanKuis[soal.id]"
              :disabled="!bisaMengisiForm"
              rows="4"
              class="w-full border-2 border-slate-200 rounded-lg p-3 text-sm font-medium focus:border-emerald-500 outline-none transition disabled:bg-slate-50"
              placeholder="Ketikkan uraian jawaban Anda di sini..."
            ></textarea>
          </div>
        </div>
        <div v-if="bisaMengisiForm" class="flex justify-end pt-6">
          <button
            @click="handleKirimKuis"
            :disabled="sedangMenyimpan"
            :class="[
              'px-6 py-3 text-white font-black text-sm rounded-xl transition shadow-sm flex items-center gap-2',
              isRevisiAktif
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700',
            ]"
          >
            {{
              sedangMenyimpan
                ? 'MENGIRIM...'
                : isRevisiAktif
                  ? 'KIRIM PERBAIKAN JAWABAN'
                  : 'KUMPULKAN JAWABAN'
            }}
          </button>
        </div>
      </div>

      <div v-if="subBabAktif.tipe === 'tugas'">
        <div class="bg-slate-50/50 border border-slate-200 p-6 rounded-2xl">
          <h3 class="text-lg font-black text-slate-800 mb-1.5 flex items-center gap-2">
            <span class="bg-amber-100 text-amber-600 p-1.5 rounded-lg"
              ><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                ></path></svg
            ></span>
            Pengumpulan Tugas
          </h3>
          <p class="text-[13px] font-medium text-slate-500 mb-6 ml-9">
            Silakan kumpulkan berkas tugas Anda sesuai instruksi format dari Guru.
          </p>

          <div v-if="bisaMengisiForm" class="ml-9 space-y-5">
            <div v-if="izinkanPDF">
              <label
                class="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2"
                >Dokumen Berkas (PDF)</label
              >
              <div
                @click="triggerPilihFile"
                class="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-white hover:bg-slate-50 hover:border-amber-400 transition cursor-pointer relative group"
              >
                <input
                  type="file"
                  ref="fileInputRef"
                  accept=".pdf"
                  class="hidden"
                  @change="handleFileChange"
                />
                <div v-if="!fileTugas">
                  <span
                    class="text-3xl block mb-1.5 opacity-40 group-hover:scale-110 transition-transform duration-300"
                    >📄</span
                  >
                  <p class="text-sm font-bold text-slate-600">Klik untuk memilih file PDF</p>
                  <p class="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">
                    Maksimal 5 MB
                  </p>
                </div>
                <div v-else class="flex flex-col items-center gap-1.5">
                  <span class="text-3xl block">📑</span>
                  <p
                    class="text-sm font-bold text-emerald-600 truncate max-w-[200px] sm:max-w-xs px-4"
                  >
                    {{ fileTugas.name }}
                  </p>
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Klik untuk mengganti file
                  </p>
                </div>
              </div>
            </div>

            <div v-if="izinkanLink">
              <label
                class="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2"
                >Tautan Video / URL</label
              >
              <input
                type="url"
                v-model="inputTugasURL"
                placeholder="https://youtube.com/watch?v=... atau link lainnya"
                class="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-500 outline-none bg-white"
              />
            </div>

            <div class="pt-2">
              <button
                @click="handleKirimTugas"
                :disabled="sedangMenyimpan || sedangUploadFile"
                :class="[
                  'px-6 py-3.5 text-white font-black text-sm rounded-xl transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto',
                  isRevisiAktif
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-500 hover:bg-amber-600',
                ]"
              >
                {{
                  sedangMenyimpan || sedangUploadFile
                    ? 'MENGUNGGAH & MENYIMPAN...'
                    : isRevisiAktif
                      ? 'KUMPULKAN REVISI TUGAS'
                      : 'KUMPULKAN TUGAS'
                }}
              </button>
            </div>
          </div>

          <div
            v-else
            class="ml-9 p-4 bg-slate-100 border border-slate-200 rounded-xl flex flex-col gap-1 text-slate-700 font-bold text-sm"
          >
            <div class="flex items-center gap-3">
              <span class="text-xl">🔒</span> Tugas Anda telah terekam di sistem.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.materi-viewer {
  color: #334155;
  font-size: 15px;
  letter-spacing: 0.015em;
}
.materi-viewer :deep(iframe) {
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  margin-top: 1rem;
  margin-bottom: 2rem;
  background-color: #f1f5f9;
}
.materi-viewer :deep(p) {
  text-align: justify;
  line-height: 1.85;
  margin-bottom: 1.5rem;
}
.materi-viewer :deep(h1),
.materi-viewer :deep(h2),
.materi-viewer :deep(h3) {
  color: #0f172a;
  font-weight: 900;
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  line-height: 1.3;
}
.materi-viewer :deep(h1) {
  font-size: 1.75rem;
}
.materi-viewer :deep(h2) {
  font-size: 1.5rem;
}
.materi-viewer :deep(h3) {
  font-size: 1.25rem;
}
.materi-viewer :deep(ul),
.materi-viewer :deep(ol) {
  margin-left: 1.5rem;
  margin-bottom: 1.5rem;
  line-height: 1.7;
}
.materi-viewer :deep(ul) {
  list-style-type: disc;
}
.materi-viewer :deep(ol) {
  list-style-type: decimal;
}
.materi-viewer :deep(li) {
  margin-bottom: 0.5rem;
}
.materi-viewer :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 2rem auto;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
.materi-viewer :deep(strong),
.materi-viewer :deep(b) {
  color: #1e293b;
  font-weight: 800;
}
.materi-viewer :deep(a) {
  color: #059669;
  text-decoration: none;
  font-weight: 700;
}
.materi-viewer :deep(a:hover) {
  text-decoration: underline;
}
</style>
