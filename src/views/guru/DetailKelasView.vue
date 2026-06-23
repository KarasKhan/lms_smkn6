<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '../../firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useGuruStore } from '../../stores/guruStore'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'

const route = useRoute()
const router = useRouter()
const guruStore = useGuruStore()
const idKelas = route.params.id

const kelas = ref(null)
const modeLayar = ref('kosong')
const modePreview = ref(false)
const babAktif = ref(null)
const subBabAktif = ref(null)
const sedangMemproses = ref(false)

const babTerbuka = ref([])
const sedangSetPenanda = ref(false)

// STATE BARU: Menyimpan status tab semester yang sedang dibuka (Default 1 / Ganjil)
const semesterAktif = ref('1')

// UPDATE: Form Bab sekarang memiliki penampung untuk semester
const formBab = ref({ id: null, judul: '', semester: '1' })

const formSub = ref({
  id: null,
  judul: '',
  tipe: 'materi',
  konten_teks: '',
  syarat_lanjut: false,
  deadline: '',
  jenis_pengumpulan: [],
  daftar_soal: [],
  waktu_minimal: 0,
})

const editorRef = ref(null)

const dragBabIndex = ref(null)
const dragSubInfo = ref({ bIndex: null, sIndex: null })

// COMPUTED BARU: Menyaring daftar Bab berdasarkan tab semester yang aktif
const strukturMateriTerfilter = computed(() => {
  if (!kelas.value || !kelas.value.struktur_materi) return []
  return kelas.value.struktur_materi.filter((bab) => {
    const sem = bab.semester || '1' // Antisipasi untuk data lama yang belum punya property semester
    return sem === semesterAktif.value
  })
})

const onDragStartBab = (bIndex) => {
  dragBabIndex.value = bIndex
}

// UPDATE: Logika drag drop disesuaikan untuk mencari index asli (karena index UI sudah terfilter)
const onDropBab = async (targetIndex) => {
  if (dragBabIndex.value === null || dragBabIndex.value === targetIndex) return

  const draggedBab = strukturMateriTerfilter.value[dragBabIndex.value]
  const targetBab = strukturMateriTerfilter.value[targetIndex]

  const struktur = [...kelas.value.struktur_materi]
  const origDragIndex = struktur.findIndex((b) => b.id === draggedBab.id)
  const [item] = struktur.splice(origDragIndex, 1)

  const origTargetIndex = struktur.findIndex((b) => b.id === targetBab.id)
  struktur.splice(origTargetIndex, 0, item)

  kelas.value.struktur_materi = struktur
  await guruStore.updateStrukturMateri(idKelas, struktur)
  dragBabIndex.value = null
}

const onDragStartSub = (bIndex, sIndex) => {
  dragSubInfo.value = { bIndex, sIndex }
}

// UPDATE: Logika drag drop sub-bab disesuaikan dengan ID bab asli
const onDropSub = async (targetBIndex, targetSIndex) => {
  const source = dragSubInfo.value
  if (source.bIndex === null) return
  if (source.bIndex !== targetBIndex) return alert('Hanya bisa digeser di dalam Bab yang sama.')
  if (source.sIndex === targetSIndex) return

  const targetBabId = strukturMateriTerfilter.value[targetBIndex].id
  const struktur = [...kelas.value.struktur_materi]
  const babIndex = struktur.findIndex((b) => b.id === targetBabId)

  const bab = struktur[babIndex]
  const [item] = bab.sub_bab.splice(source.sIndex, 1)
  bab.sub_bab.splice(targetSIndex, 0, item)

  kelas.value.struktur_materi = struktur
  await guruStore.updateStrukturMateri(idKelas, struktur)
  dragSubInfo.value = { bIndex: null, sIndex: null }
}

const customImageHandler = () => {
  const input = document.createElement('input')
  input.setAttribute('type', 'file')
  input.setAttribute('accept', 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar')
  input.click()

  input.onchange = async () => {
    const file = input.files[0]
    if (!file) return
    const formData = new FormData()

    formData.append('image', file)

    sedangMemproses.value = true
    try {
      const r = await fetch('https://gurumales.com/upload.php', {
        method: 'POST',
        body: formData,
      })
      const hasil = await r.json()

      if (hasil.success) {
        const quill = editorRef.value.getQuill()
        let range = quill.getSelection()

        if (!range) {
          quill.focus()
          range = quill.getSelection()
        }

        const insertIndex = range ? range.index : quill.getLength()

        if (file.type.startsWith('image/')) {
          quill.insertEmbed(insertIndex, 'image', hasil.url)
          quill.setSelection(insertIndex + 1)
        } else {
          const teksLink = ` 📎 Lampiran: ${file.name} `
          quill.insertText(insertIndex, teksLink, 'link', hasil.url)
          quill.setSelection(insertIndex + teksLink.length)
        }
      } else {
        alert(hasil.message)
      }
    } catch (error) {
      console.error('Terjadi kegagalan upload:', error)
      alert('Gagal upload. Cek CORS atau koneksi jaringan.')
    } finally {
      sedangMemproses.value = false
    }
  }
}

const customVideoHandler = () => {
  const url = prompt('Masukkan Tautan Video (YouTube):')
  if (!url) return

  let embedUrl = url
  const ytMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/,
  )
  if (ytMatch && ytMatch[1]) {
    embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`
  }

  const quill = editorRef.value.getQuill()
  let range = quill.getSelection()

  if (!range) {
    quill.focus()
    range = quill.getSelection()
  }
  const insertIndex = range ? range.index : quill.getLength()

  quill.insertEmbed(insertIndex, 'video', embedUrl)
  quill.insertText(insertIndex + 1, '\n')
  quill.setSelection(insertIndex + 2)
}

const handleEditorReady = (quill) => {
  quill.root.addEventListener('paste', (e) => {
    e.preventDefault()
    const text = (e.originalEvent || e).clipboardData.getData('text/plain')
    const range = quill.getSelection(true)
    quill.insertText(range.index, text)
    quill.setSelection(range.index + text.length)
  })
}

const opsiEditor = {
  bounds: 'body',
  modules: {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['video', 'image', 'link', 'clean'],
      ],
      handlers: {
        image: customImageHandler,
        video: customVideoHandler,
      },
    },
    clipboard: {
      matchVisual: false,
    },
  },
}

const ambilDataKelas = async () => {
  const docRef = doc(db, 'kelas', idKelas)
  const snap = await getDoc(docRef)

  if (snap.exists()) {
    const data = snap.data()
    const nipLogin = localStorage.getItem('user_nip')

    if (data.guru_nip !== nipLogin) {
      alert('Akses Ditolak: Anda bukan guru pengampu kelas ini!')
      router.replace('/guru/kelas')
      return
    }

    kelas.value = { id: snap.id, ...data }

    if (data.struktur_materi) {
      babTerbuka.value = data.struktur_materi.map((b) => b.id)
    }
  } else {
    alert('Kelas tidak ditemukan.')
    router.replace('/guru/kelas')
  }
}

onMounted(() => {
  ambilDataKelas()
})

const toggleBab = (idBab) => {
  const idx = babTerbuka.value.indexOf(idBab)
  if (idx !== -1) {
    babTerbuka.value.splice(idx, 1)
  } else {
    babTerbuka.value.push(idBab)
  }
}

const setPenandaTerakhir = async (idSub) => {
  if (kelas.value.materi_terakhir === idSub) return
  sedangSetPenanda.value = true
  try {
    await updateDoc(doc(db, 'kelas', idKelas), { materi_terakhir: idSub })
    kelas.value.materi_terakhir = idSub
  } catch (e) {
    console.error(e)
    alert('Gagal menyimpan penanda materi.')
  }
  sedangSetPenanda.value = false
}

// UPDATE: Reset formBab dengan menempelkan default semester yang sedang aktif
const siapkanTambahBab = () => {
  formBab.value = { id: null, judul: '', semester: semesterAktif.value }
  modeLayar.value = 'tambah_bab'
}

// UPDATE: Tangkap semester saat memuat data Bab untuk diedit
const editBab = (bab) => {
  formBab.value = { id: bab.id, judul: bab.judul, semester: bab.semester || '1' }
  modeLayar.value = 'tambah_bab'
}

// UPDATE: Kirim parameter semester saat save ke Pinia Store
const simpanBab = async () => {
  if (!formBab.value.judul) return alert('Nama bab wajib diisi.')
  sedangMemproses.value = true
  let sukses
  if (formBab.value.id) {
    sukses = await guruStore.editBab(
      idKelas,
      formBab.value.id,
      formBab.value.judul,
      formBab.value.semester,
    )
  } else {
    sukses = await guruStore.tambahBab(idKelas, formBab.value.judul, formBab.value.semester)
  }
  if (sukses) {
    await ambilDataKelas()
    modeLayar.value = 'kosong'
  }
  sedangMemproses.value = false
}

const hapusBab = async (idBab, judul) => {
  if (confirm(`Hapus seluruh Bab "${judul}" beserta isinya?`)) {
    await guruStore.hapusBab(idKelas, idBab)
    await ambilDataKelas()
    modeLayar.value = 'kosong'
  }
}

const siapkanTambahSub = (idBab) => {
  babAktif.value = idBab
  modePreview.value = false
  formSub.value = {
    id: null,
    judul: '',
    tipe: 'materi',
    konten_teks: '',
    syarat_lanjut: false,
    deadline: '',
    jenis_pengumpulan: [],
    daftar_soal: [],
    waktu_minimal: 0,
  }
  modeLayar.value = 'tambah_sub'
  if (!babTerbuka.value.includes(idBab)) babTerbuka.value.push(idBab)
}

const siapkanEditSub = () => {
  formSub.value = { jenis_pengumpulan: [], daftar_soal: [], waktu_minimal: 0, ...subBabAktif.value }
  modePreview.value = false
  modeLayar.value = 'tambah_sub'
}

const lihatSubBab = (idBabInduk, sub) => {
  babAktif.value = idBabInduk
  subBabAktif.value = sub
  modeLayar.value = 'baca'
}

const tambahSoalPilgan = () => {
  formSub.value.daftar_soal.push({
    id: Date.now().toString(),
    jenis: 'pilgan',
    pertanyaan: '',
    opsi: { a: '', b: '', c: '', d: '', e: '' },
    jawaban_benar: 'a',
  })
}

const tambahSoalEsai = () => {
  formSub.value.daftar_soal.push({
    id: Date.now().toString(),
    jenis: 'esai',
    pertanyaan: '',
    jawaban_benar: '',
  })
}

const hapusSoal = (index) => {
  formSub.value.daftar_soal.splice(index, 1)
}

const simpanSubBab = async () => {
  if (!formSub.value.judul) return alert('Judul wajib diisi.')
  if (formSub.value.tipe === 'tugas' && formSub.value.jenis_pengumpulan.length === 0)
    return alert('Pilih minimal satu bentuk pengumpulan tugas.')
  if (formSub.value.tipe === 'kuis' && formSub.value.daftar_soal.length === 0)
    return alert('Tambahkan minimal 1 soal.')

  if (formSub.value.tipe === 'materi') {
    formSub.value.syarat_lanjut = false
    formSub.value.deadline = ''
    formSub.value.jenis_pengumpulan = []
    formSub.value.daftar_soal = []
  } else if (formSub.value.tipe === 'tugas') {
    formSub.value.daftar_soal = []
    formSub.value.waktu_minimal = 0
  } else if (formSub.value.tipe === 'kuis') {
    formSub.value.jenis_pengumpulan = []
    formSub.value.waktu_minimal = 0
  }

  sedangMemproses.value = true
  const sukses = await guruStore.simpanKontenSubBab(
    idKelas,
    babAktif.value,
    formSub.value,
    formSub.value.id,
  )
  if (sukses) {
    await ambilDataKelas()
    subBabAktif.value = JSON.parse(JSON.stringify(formSub.value))
    modeLayar.value = 'baca'
  }
  sedangMemproses.value = false
}

const hapusMateri = async () => {
  if (confirm(`Hapus materi "${subBabAktif.value.judul}"?`)) {
    sedangMemproses.value = true
    const sukses = await guruStore.hapusSubBab(idKelas, babAktif.value, subBabAktif.value.id)
    if (sukses) {
      await ambilDataKelas()
      modeLayar.value = 'kosong'
    }
    sedangMemproses.value = false
  }
}

const batalkanEdit = () => {
  modeLayar.value = 'kosong'
}
</script>

<template>
  <div class="absolute inset-0 flex flex-col bg-[#F8FAFC]">
    <header
      class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-20"
    >
      <div class="flex items-center gap-5">
        <button
          @click="router.push('/guru/kelas')"
          class="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition"
        >
          &larr; Kembali
        </button>
        <div>
          <h1 class="text-xl font-black text-gray-800 tracking-tight">
            {{ kelas ? kelas.nama_matpel : 'Memuat Kelas...' }}
          </h1>
          <p
            v-if="kelas"
            class="text-xs text-gray-500 font-medium uppercase tracking-widest mt-0.5"
          >
            Rombel: {{ kelas.rombel_target }} | TA. {{ kelas.tahun_ajaran }}
          </p>
        </div>
      </div>
    </header>

    <div v-if="kelas" class="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 p-6">
      <div
        class="w-full lg:w-[380px] flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-full shrink-0"
      >
        <div class="p-5 border-b border-gray-100 bg-gray-50 flex flex-col gap-4 shrink-0">
          <h2 class="font-bold text-gray-800 tracking-tight">Struktur Materi</h2>

          <div class="flex bg-white p-1 border border-gray-200 rounded-lg">
            <button
              @click="semesterAktif = '1'"
              :class="[
                'flex-1 py-1.5 text-xs font-bold rounded-md transition-colors',
                semesterAktif === '1'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50',
              ]"
            >
              Ganjil (1)
            </button>
            <button
              @click="semesterAktif = '2'"
              :class="[
                'flex-1 py-1.5 text-xs font-bold rounded-md transition-colors',
                semesterAktif === '2'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50',
              ]"
            >
              Genap (2)
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div
            v-if="!strukturMateriTerfilter || strukturMateriTerfilter.length === 0"
            class="text-center text-sm text-gray-400 py-4"
          >
            Belum ada bab untuk semester ini.
          </div>

          <div
            v-else
            v-for="(bab, bIndex) in strukturMateriTerfilter"
            :key="bab.id"
            class="border-l-2 border-gray-200 pl-3 group mb-2"
            draggable="true"
            @dragstart="onDragStartBab(bIndex)"
            @dragover.prevent
            @drop="onDropBab(bIndex)"
          >
            <div class="flex justify-between items-center mb-1">
              <div class="flex items-center gap-1.5 flex-1 overflow-hidden">
                <span
                  class="text-gray-300 hover:text-gray-500 text-xs cursor-grab active:cursor-grabbing shrink-0"
                  title="Tarik untuk memindahkan"
                  >⋮⋮</span
                >

                <button
                  @click="toggleBab(bab.id)"
                  class="flex items-center gap-1.5 focus:outline-none flex-1 overflow-hidden hover:bg-gray-50 py-1.5 rounded transition-colors text-left group/btn"
                >
                  <svg
                    :class="[
                      'w-3.5 h-3.5 text-gray-400 group-hover/btn:text-blue-500 transition-transform shrink-0',
                      babTerbuka.includes(bab.id) ? 'rotate-90' : '',
                    ]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="3"
                      d="M9 5l7 7-7 7"
                    ></path>
                  </svg>
                  <h3
                    class="text-sm font-bold text-gray-700 truncate group-hover/btn:text-blue-600"
                  >
                    {{ bab.judul }}
                  </h3>
                </button>
              </div>

              <div
                class="flex gap-0.5 shrink-0 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <button
                  @click="siapkanTambahSub(bab.id)"
                  class="px-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                  title="Tambah Konten"
                >
                  +
                </button>
                <button
                  @click="editBab(bab)"
                  class="px-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                  title="Edit Judul Bab"
                >
                  ✎
                </button>
                <button
                  @click="hapusBab(bab.id, bab.judul)"
                  class="px-1 text-xs text-red-500 hover:bg-red-50 rounded"
                  title="Hapus Bab"
                >
                  🗑
                </button>
              </div>
            </div>

            <div
              v-show="babTerbuka.includes(bab.id)"
              class="space-y-1.5 ml-4 mt-2 mb-4 animate-in slide-in-from-top-2 duration-200"
            >
              <div
                v-for="(sub, sIndex) in bab.sub_bab"
                :key="sub.id"
                draggable="true"
                @dragstart.stop="onDragStartSub(bIndex, sIndex)"
                @dragover.prevent
                @drop.stop="onDropSub(bIndex, sIndex)"
                @click="lihatSubBab(bab.id, sub)"
                :class="[
                  'text-xs p-2.5 rounded-xl border cursor-pointer active:cursor-grabbing transition-colors flex items-center justify-between shadow-sm',
                  modeLayar === 'baca' && subBabAktif?.id === sub.id
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50',
                ]"
              >
                <div class="flex items-center gap-2 truncate">
                  <span class="text-gray-300 hover:text-gray-500 cursor-grab shrink-0">⋮⋮</span>
                  <span
                    :class="[
                      'truncate font-medium',
                      modeLayar === 'baca' && subBabAktif?.id === sub.id ? 'font-bold' : '',
                    ]"
                    >{{ sub.judul }}</span
                  >
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span
                    :class="[
                      'text-[9px] px-1.5 py-0.5 rounded uppercase font-bold',
                      sub.tipe === 'kuis'
                        ? 'bg-purple-100 text-purple-600'
                        : sub.tipe === 'tugas'
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-gray-100 text-gray-500',
                    ]"
                    >{{ sub.tipe }}</span
                  >

                  <button
                    @click.stop="setPenandaTerakhir(sub.id)"
                    :disabled="sedangSetPenanda"
                    title="Tandai sebagai materi terakhir"
                    class="p-1 rounded-md hover:bg-gray-100 transition-colors focus:outline-none disabled:opacity-50"
                  >
                    <svg
                      v-if="kelas.materi_terakhir === sub.id"
                      class="w-4 h-4 text-emerald-500 fill-current"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 3v18l7-3 7 3V3H5z"></path>
                    </svg>
                    <svg
                      v-else
                      class="w-4 h-4 text-gray-300 hover:text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="p-4 border-t border-gray-100 bg-white shrink-0">
          <button
            @click="siapkanTambahBab"
            class="w-full py-2.5 border-2 border-dashed border-gray-200 text-gray-500 text-xs font-bold rounded-xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition"
          >
            + TAMBAH BAB BARU
          </button>
        </div>
      </div>

      <div
        class="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full"
      >
        <div
          v-if="modeLayar === 'kosong'"
          class="flex-1 flex flex-col items-center justify-center text-gray-400 p-8"
        >
          <span class="text-5xl opacity-40 mb-3">📝</span>
          <p class="text-sm font-medium">Pilih materi di samping, atau buat konten baru.</p>
        </div>

        <div
          v-else-if="modeLayar === 'baca' && subBabAktif"
          class="flex-1 flex flex-col h-full bg-white relative"
        >
          <div
            class="shrink-0 px-8 py-6 border-b border-gray-100 flex justify-between items-start z-10 shadow-sm bg-white"
          >
            <div>
              <div class="flex items-center gap-3 mb-2">
                <span
                  class="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded"
                  >{{ subBabAktif.tipe }}</span
                >
                <span
                  v-if="subBabAktif.syarat_lanjut"
                  class="text-[10px] font-bold uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-1 rounded"
                  >Wajib Selesai</span
                >
              </div>
              <h2 class="text-2xl font-bold text-gray-800">{{ subBabAktif.judul }}</h2>

              <div v-if="subBabAktif.tipe !== 'materi'" class="mt-3 flex gap-4 text-xs font-medium">
                <p
                  v-if="subBabAktif.deadline"
                  class="text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100"
                >
                  ⏱ Deadline: {{ new Date(subBabAktif.deadline).toLocaleString('id-ID') }}
                </p>
                <p
                  v-if="subBabAktif.tipe === 'tugas' && subBabAktif.jenis_pengumpulan?.length"
                  class="text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100"
                >
                  📥 Format:
                  {{ subBabAktif.jenis_pengumpulan.map((j) => j.toUpperCase()).join(' & ') }}
                </p>
                <p
                  v-if="subBabAktif.tipe === 'kuis'"
                  class="text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-100"
                >
                  📝 Total: {{ subBabAktif.daftar_soal?.length || 0 }} Soal
                </p>
              </div>
              <div v-else class="mt-3 flex gap-4 text-xs font-medium">
                <p
                  v-if="subBabAktif.waktu_minimal"
                  class="text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200"
                >
                  ⏳ Waktu Baca: {{ subBabAktif.waktu_minimal }} Menit
                </p>
              </div>
            </div>

            <div class="flex gap-2 mt-1 shrink-0">
              <button
                @click="siapkanEditSub"
                class="px-4 py-2 bg-white text-gray-700 text-xs font-bold rounded-lg border border-gray-200 hover:bg-gray-50 transition shadow-sm"
              >
                ✎ Edit
              </button>
              <button
                @click="hapusMateri"
                :disabled="sedangMemproses"
                class="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg border border-red-100 hover:bg-red-100 transition shadow-sm disabled:opacity-50"
              >
                🗑 {{ sedangMemproses ? 'Proses...' : 'Hapus' }}
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-8">
            <div
              v-if="subBabAktif.konten_teks"
              class="ql-editor prose prose-blue max-w-none text-gray-800 mb-8"
              v-html="subBabAktif.konten_teks"
            ></div>

            <div
              v-if="subBabAktif.tipe === 'kuis' && subBabAktif.daftar_soal?.length"
              class="space-y-6"
            >
              <h3 class="text-lg font-bold text-gray-800 border-b pb-2">Daftar Soal</h3>
              <div
                v-for="(soal, i) in subBabAktif.daftar_soal"
                :key="soal.id"
                class="p-5 border border-gray-200 rounded-xl bg-gray-50"
              >
                <div class="flex items-center gap-2 mb-3">
                  <span
                    class="w-6 h-6 flex items-center justify-center bg-gray-800 text-white rounded-lg text-xs font-bold"
                    >{{ i + 1 }}</span
                  >
                  <span class="text-xs font-bold text-gray-500 uppercase">{{
                    soal.jenis === 'pilgan' ? 'Pilihan Ganda' : 'Esai / Uraian'
                  }}</span>
                </div>
                <p class="text-sm text-gray-800 font-medium mb-4">
                  {{ soal.pertanyaan || '[Pertanyaan Kosong]' }}
                </p>

                <div
                  v-if="soal.jenis === 'pilgan'"
                  class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm"
                >
                  <div
                    v-for="(val, key) in soal.opsi"
                    :key="key"
                    :class="[
                      'p-2.5 border rounded-lg',
                      soal.jawaban_benar === key
                        ? 'bg-green-50 border-green-200 text-green-800 font-bold'
                        : 'bg-white border-gray-200 text-gray-600',
                    ]"
                  >
                    <span class="uppercase mr-2">{{ key }}.</span> {{ val }}
                    <span v-if="soal.jawaban_benar === key" class="float-right text-green-600"
                      >✓ Kunci</span
                    >
                  </div>
                </div>
                <div
                  v-if="soal.jenis === 'esai'"
                  class="text-sm bg-white p-3 border border-gray-200 rounded text-gray-600"
                >
                  <span class="font-bold block mb-1">Panduan Jawaban Benar:</span>
                  {{ soal.jawaban_benar || 'Tidak ada panduan spesifik.' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else-if="modeLayar === 'tambah_bab'"
          class="flex-1 flex flex-col justify-center max-w-md mx-auto w-full p-8"
        >
          <h3 class="text-lg font-bold text-gray-800 mb-6 text-center">
            {{ formBab.id ? 'Edit Bab' : 'Buat Bab Baru' }}
          </h3>

          <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Pilih Semester</label>
          <select
            v-model="formBab.semester"
            class="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none mb-4 bg-white"
          >
            <option value="1">Semester 1 (Ganjil)</option>
            <option value="2">Semester 2 (Genap)</option>
          </select>

          <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Judul Bab</label>
          <input
            type="text"
            v-model="formBab.judul"
            class="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none mb-6"
            placeholder="Contoh: Bab 1"
            @keyup.enter="simpanBab"
          />
          <div class="flex gap-3">
            <button
              @click="batalkanEdit"
              class="flex-1 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
            >
              Batal
            </button>
            <button
              @click="simpanBab"
              :disabled="sedangMemproses"
              class="flex-1 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:bg-gray-400"
            >
              {{ sedangMemproses ? 'Menyimpan...' : 'Simpan Bab' }}
            </button>
          </div>
        </div>

        <div v-else-if="modeLayar === 'tambah_sub'" class="flex flex-col h-full overflow-hidden">
          <div
            class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0"
          >
            <h3 class="font-bold text-gray-800 uppercase tracking-tight text-sm">
              {{ formSub.id ? 'Edit Konten' : 'Editor Konten Pembelajaran' }}
            </h3>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50">
            <div class="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm space-y-5">
              <div class="grid grid-cols-2 gap-6">
                <div>
                  <label class="block text-xs font-bold text-gray-500 uppercase mb-2"
                    >Judul Konten</label
                  >
                  <input
                    type="text"
                    v-model="formSub.judul"
                    class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-gray-500 uppercase mb-2"
                    >Tipe Konten</label
                  >
                  <select
                    v-model="formSub.tipe"
                    class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="materi">Materi Pembelajaran</option>
                    <option value="tugas">Tugas (Upload Berkas)</option>
                    <option value="kuis">Kuis</option>
                  </select>
                </div>
              </div>

              <div v-if="formSub.tipe === 'materi'" class="border-t border-gray-100 pt-4 mt-2">
                <div class="flex items-center gap-3">
                  <label class="block text-xs font-bold text-gray-600 uppercase w-48"
                    >Minimal Waktu Baca:</label
                  >
                  <div class="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      v-model="formSub.waktu_minimal"
                      class="w-20 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 text-center"
                    />
                    <span class="text-xs font-medium text-gray-500"
                      >Menit
                      <span class="text-[10px] italic">(Isi 0 jika bebas dilewati)</span></span
                    >
                  </div>
                </div>
              </div>

              <div v-if="formSub.tipe !== 'materi'" class="border-t border-gray-100 pt-4 mt-2">
                <div class="flex items-center gap-3 mb-5">
                  <input
                    type="checkbox"
                    v-model="formSub.syarat_lanjut"
                    class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label class="text-sm font-bold text-blue-900 block"
                    >Wajib diselesaikan sebelum membuka materi selanjutnya</label
                  >
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label class="block text-xs font-bold text-blue-800 uppercase mb-2"
                      >Batas Pengerjaan (Deadline):</label
                    >
                    <input
                      type="datetime-local"
                      v-model="formSub.deadline"
                      class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div v-if="formSub.tipe === 'tugas'">
                    <label class="block text-xs font-bold text-blue-800 uppercase mb-2"
                      >Format Pengumpulan:</label
                    >
                    <div class="flex flex-col gap-3 mt-1">
                      <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          v-model="formSub.jenis_pengumpulan"
                          value="pdf"
                          class="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        Dokumen (PDF, Word, Excel, ZIP)
                      </label>
                      <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          v-model="formSub.jenis_pengumpulan"
                          value="link"
                          class="w-4 h-4 text-blue-600 rounded border-gray-300"
                        />
                        Tautan (YouTube/Gdrive/Website)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white border border-gray-300 rounded-2xl shadow-sm overflow-hidden">
              <div
                class="bg-gray-50 px-5 py-3 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center"
              >
                <span>{{
                  formSub.tipe === 'kuis' ? 'Teks Pengantar / Instruksi Kuis' : 'Isi Konten'
                }}</span>
                <span class="text-blue-500 lowercase normal-case italic font-medium"
                  >💡 Ikon Gambar (🏞️) dapat digunakan untuk upload PDF/Word juga.</span
                >
              </div>

              <QuillEditor
                ref="editorRef"
                @ready="handleEditorReady"
                theme="snow"
                v-model:content="formSub.konten_teks"
                contentType="html"
                :options="opsiEditor"
                :class="formSub.tipe === 'kuis' ? 'min-h-[150px]' : 'min-h-[350px]'"
                class="text-sm border-none"
              />
            </div>

            <div v-if="formSub.tipe === 'kuis'" class="space-y-4">
              <div
                class="flex justify-between items-center bg-white p-5 border border-gray-200 rounded-2xl shadow-sm"
              >
                <h3 class="font-bold text-gray-800">
                  Daftar Soal Ujian ({{ formSub.daftar_soal.length }})
                </h3>
                <div class="flex gap-2">
                  <button
                    @click="tambahSoalPilgan"
                    class="px-4 py-2 bg-blue-50 text-blue-600 font-bold text-xs rounded-xl border border-blue-100 hover:bg-blue-100"
                  >
                    + Pilihan Ganda
                  </button>
                  <button
                    @click="tambahSoalEsai"
                    class="px-4 py-2 bg-purple-50 text-purple-600 font-bold text-xs rounded-xl border border-purple-100 hover:bg-purple-100"
                  >
                    + Esai
                  </button>
                </div>
              </div>

              <div
                v-for="(soal, index) in formSub.daftar_soal"
                :key="soal.id"
                class="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm relative"
              >
                <button
                  @click="hapusSoal(index)"
                  class="absolute top-5 right-5 text-gray-400 hover:text-red-500 text-2xl leading-none"
                >
                  &times;
                </button>
                <div class="flex items-center gap-2 mb-4">
                  <span
                    class="w-6 h-6 flex items-center justify-center bg-gray-800 text-white rounded-lg text-xs font-bold"
                    >{{ index + 1 }}</span
                  >
                  <span class="text-xs font-bold text-gray-500 uppercase">{{
                    soal.jenis === 'pilgan' ? 'Pilihan Ganda' : 'Esai / Uraian'
                  }}</span>
                </div>

                <label class="block text-xs font-bold text-gray-700 mb-2">Pertanyaan Soal</label>
                <textarea
                  v-model="soal.pertanyaan"
                  rows="3"
                  class="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none mb-5"
                  placeholder="Ketikkan pertanyaan..."
                ></textarea>

                <div
                  v-if="soal.jenis === 'pilgan'"
                  class="bg-gray-50 p-5 rounded-xl border border-gray-200"
                >
                  <label class="block text-xs font-bold text-gray-700 mb-3"
                    >Pilihan Jawaban & Kunci</label
                  >
                  <div class="space-y-3">
                    <div
                      v-for="opt in ['a', 'b', 'c', 'd', 'e']"
                      :key="opt"
                      class="flex items-center gap-3"
                    >
                      <input
                        type="radio"
                        :name="`kunci_${index}`"
                        :value="opt"
                        v-model="soal.jawaban_benar"
                        class="w-4 h-4 text-green-600 cursor-pointer"
                        title="Jadikan Kunci Jawaban"
                      />
                      <span class="text-sm font-bold text-gray-500 uppercase w-4">{{ opt }}.</span>
                      <input
                        type="text"
                        v-model="soal.opsi[opt]"
                        :class="[
                          'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none',
                          soal.jawaban_benar === opt
                            ? 'border-green-400 bg-green-50'
                            : 'border-gray-300',
                        ]"
                        :placeholder="`Opsi ${opt.toUpperCase()}`"
                      />
                    </div>
                  </div>
                </div>

                <div
                  v-if="soal.jenis === 'esai'"
                  class="bg-gray-50 p-5 rounded-xl border border-gray-200"
                >
                  <label class="block text-xs font-bold text-gray-700 mb-2"
                    >Panduan / Kunci Jawaban (Opsional)</label
                  >
                  <textarea
                    v-model="soal.jawaban_benar"
                    rows="2"
                    class="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-100 outline-none"
                    placeholder="Ketikkan poin-poin jawaban yang diharapkan (untuk panduan koreksi)..."
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          <div
            class="px-8 py-5 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]"
          >
            <button
              @click="batalkanEdit"
              class="px-6 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
            >
              Batalkan
            </button>
            <button
              @click="simpanSubBab"
              :disabled="sedangMemproses"
              class="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:bg-gray-400 shadow-sm"
            >
              {{ sedangMemproses ? 'Menyimpan...' : 'Simpan ke Database' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.ql-tooltip:not(.ql-hidden) {
  z-index: 9999 !important;
  position: absolute !important;
  background-color: white !important;
  border-radius: 12px !important;
  box-shadow:
    0 10px 25px -5px rgba(0, 0, 0, 0.1),
    0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid #e2e8f0 !important;
  padding: 12px 20px !important;
  transform: translateY(10px) !important;
}
.ql-tooltip:not(.ql-hidden) input[type='text'] {
  border: 1px solid #cbd5e1 !important;
  border-radius: 8px !important;
  padding: 6px 12px !important;
  font-size: 14px !important;
  outline: none !important;
}
.ql-tooltip:not(.ql-hidden) input[type='text']:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
}

/* MENYAMAKAN TAMPILAN EDITOR GURU DENGAN HASIL AKHIR SISWA */
.ql-editor {
  padding: 1.5rem !important;
  color: #334155 !important;
  font-size: 15px !important;
  line-height: 1.85 !important;
}
.ql-editor p {
  margin-bottom: 1.5rem !important;
}
.ql-editor h1,
.ql-editor h2,
.ql-editor h3 {
  color: #0f172a !important;
  font-weight: 900 !important;
  margin-top: 2.5rem !important;
  margin-bottom: 1rem !important;
  line-height: 1.3 !important;
}
.ql-editor h1 {
  font-size: 1.75rem !important;
}
.ql-editor h2 {
  font-size: 1.5rem !important;
}
.ql-editor h3 {
  font-size: 1.25rem !important;
}
.ql-editor ul,
.ql-editor ol {
  margin-left: 1.5rem !important;
  margin-bottom: 1.5rem !important;
}
.ql-editor li {
  margin-bottom: 0.5rem !important;
}
.ql-editor a {
  color: #059669 !important;
  text-decoration: none !important;
  font-weight: 700 !important;
}
.ql-editor a:hover {
  text-decoration: underline !important;
}
.ql-editor img {
  max-width: 100% !important;
  height: auto !important;
  display: block !important;
  margin: 2rem auto !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
}

/* STYLING KHUSUS VIDEO EMBED AGAR 100% LEBAR & ESTETIK (TIDAK KECIL LAGI) */
.ql-editor iframe.ql-video {
  width: 100% !important;
  height: 400px !important;
  aspect-ratio: 16 / 9 !important;
  border-radius: 12px !important;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
  margin: 2rem 0 !important;
  border: none !important;
}
@media (max-width: 768px) {
  .ql-editor iframe.ql-video {
    height: 250px !important;
  }
}
</style>
