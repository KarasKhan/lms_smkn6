<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '../../../firebase'
import { doc, updateDoc } from 'firebase/firestore'

const props = defineProps({
  kelas: { type: Object, required: true },
})

const emit = defineEmits(['update-siswa', 'buka-pengaturan'])

const route = useRoute()
const idKelas = route.params.id

// Panel Sidebar Koreksi
const tampilPanelKoreksi = ref(false)
const dataKoreksi = ref(null)
const nilaiInput = ref('')
const sedangMenyimpan = ref(false)

// State khusus untuk Revisi & Tab Tugas
const tabTugasAktif = ref('pdf')
const modeRevisi = ref(false)
const formRevisi = ref({ catatan: '', batasWaktu: '' })

// Filter Rombel Aktif
const rombelPilihan = ref('Semua')

const daftarRombelUnik = computed(() => {
  if (!props.kelas || !props.kelas.siswa) return []
  const rombelSet = new Set(props.kelas.siswa.map((s) => s.rombel).filter(Boolean))
  return Array.from(rombelSet).sort()
})

const siswaTerurut = computed(() => {
  if (!props.kelas || !props.kelas.siswa) return []
  let listSiswa = [...props.kelas.siswa]

  if (rombelPilihan.value !== 'Semua') {
    listSiswa = listSiswa.filter((s) => s.rombel === rombelPilihan.value)
  }
  return listSiswa.sort((a, b) => a.nama.localeCompare(b.nama))
})

const formulaRapor = computed(() => {
  return props.kelas.pengaturan_rapor || { materi: 20, tugas: 30, kuis: 50 }
})

const daftarKolomKegiatan = computed(() => {
  if (!props.kelas || !props.kelas.struktur_materi) return []
  const kolom = []
  let urutanMateri = 1,
    urutanTugas = 1,
    urutanKuis = 1

  props.kelas.struktur_materi.forEach((bab) => {
    if (bab.sub_bab) {
      bab.sub_bab.forEach((sub) => {
        let kodeUnik = ''
        if (sub.tipe === 'materi') kodeUnik = 'M' + urutanMateri++
        else if (sub.tipe === 'tugas') kodeUnik = 'T' + urutanTugas++
        else if (sub.tipe === 'kuis') kodeUnik = 'K' + urutanKuis++
        kolom.push({ ...sub, bab_judul: bab.judul, kode: kodeUnik })
      })
    }
  })
  return kolom
})

const getStatusProgresSiswa = (siswa, kegiatan) => {
  const progres = siswa.progres_belajar?.[kegiatan.id]
  const nilai = siswa.nilai_pembelajaran?.[kegiatan.id]

  if (kegiatan.tipe === 'materi') {
    return progres === 'selesai'
      ? {
          status: 'selesai',
          label: '✓',
          kelas: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-sm',
        }
      : { status: 'belum', label: '-', kelas: 'bg-slate-100 text-slate-400 hover:bg-slate-200' }
  }

  if (nilai !== undefined && nilai !== null) {
    if (nilai === 'menunggu') {
      return {
        status: 'menunggu',
        label: 'Cek',
        kelas: 'bg-amber-100 text-amber-700 animate-pulse hover:bg-amber-200 shadow-sm',
      }
    }
    if (nilai === 'revisi') {
      return {
        status: 'revisi',
        label: 'Rev',
        kelas: 'bg-rose-100 text-rose-700 animate-pulse hover:bg-rose-200 shadow-sm',
      }
    }
    return {
      status: 'selesai',
      label: nilai.toString(),
      kelas: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-sm',
    }
  }

  return { status: 'belum', label: '-', kelas: 'bg-slate-100 text-slate-400 hover:bg-slate-200' }
}

const getStatusKeterlambatanTabel = (siswa, kegiatan) => {
  if (kegiatan.tipe === 'materi') return null

  const waktuKumpul = siswa.waktu_kumpul?.[kegiatan.id]
  // PERBAIKAN: Sintaks IF yang rusak sudah diperbaiki
  if (!waktuKumpul) return null

  if (!kegiatan.deadline) return { status: 'tepat', teks: 'TEPAT' }

  const dtKumpul = new Date(waktuKumpul)
  const dtBatas = new Date(kegiatan.deadline)

  if (dtKumpul > dtBatas) {
    return { status: 'telat', teks: 'TELAT' }
  }
  return { status: 'tepat', teks: 'TEPAT' }
}

const bukaKoreksi = (siswa, kegiatan) => {
  const progres = getStatusProgresSiswa(siswa, kegiatan)
  const lampiran = siswa.lampiran_tugas?.[kegiatan.id] || null

  dataKoreksi.value = {
    siswa_nis: siswa.nis,
    siswa_nama: siswa.nama,
    kegiatan_id: kegiatan.id,
    kegiatan_judul: kegiatan.judul,
    kegiatan_kode: kegiatan.kode,
    tipe: kegiatan.tipe,
    status_saat_ini: progres.status,
    url_file: lampiran,
    jawaban_kuis: siswa.jawaban_kuis?.[kegiatan.id] || {},
    daftar_soal: kegiatan.daftar_soal || [],
    deadline: kegiatan.deadline || null,
    waktu_kumpul: siswa.waktu_kumpul?.[kegiatan.id] || null,
  }

  if (lampiran && typeof lampiran === 'object') {
    tabTugasAktif.value = lampiran.pdf ? 'pdf' : 'link'
  } else {
    tabTugasAktif.value = 'legacy'
  }

  const nilaiSekarang = siswa.nilai_pembelajaran?.[kegiatan.id]
  nilaiInput.value =
    nilaiSekarang && nilaiSekarang !== 'menunggu' && nilaiSekarang !== 'revisi' ? nilaiSekarang : ''

  modeRevisi.value = false
  formRevisi.value = { catatan: '', batasWaktu: '' }
  tampilPanelKoreksi.value = true
}

const tutupKoreksi = () => {
  tampilPanelKoreksi.value = false
  setTimeout(() => {
    dataKoreksi.value = null
    nilaiInput.value = ''
    modeRevisi.value = false
  }, 300)
}

const simpanPenilaian = async () => {
  if (!dataKoreksi.value) return
  if (dataKoreksi.value.tipe !== 'materi' && nilaiInput.value === '') return

  sedangMenyimpan.value = true
  try {
    const listSiswaBaru = JSON.parse(JSON.stringify(props.kelas.siswa))
    const idx = listSiswaBaru.findIndex((s) => s.nis === dataKoreksi.value.siswa_nis)

    if (idx !== -1) {
      if (dataKoreksi.value.tipe === 'materi') {
        if (!listSiswaBaru[idx].progres_belajar) listSiswaBaru[idx].progres_belajar = {}
        listSiswaBaru[idx].progres_belajar[dataKoreksi.value.kegiatan_id] = 'selesai'
      } else {
        if (!listSiswaBaru[idx].nilai_pembelajaran) listSiswaBaru[idx].nilai_pembelajaran = {}
        listSiswaBaru[idx].nilai_pembelajaran[dataKoreksi.value.kegiatan_id] = Number(
          nilaiInput.value,
        )
      }

      const docRef = doc(db, 'kelas', idKelas)
      await updateDoc(docRef, { siswa: listSiswaBaru })

      emit('update-siswa', listSiswaBaru)
      tutupKoreksi()
    }
  } catch (error) {
    console.error('Gagal menyimpan nilai:', error)
    alert('Terjadi kesalahan saat menyimpan nilai.')
  }
  sedangMenyimpan.value = false
}

const simpanPermintaanRevisi = async () => {
  if (!formRevisi.value.catatan || !formRevisi.value.batasWaktu) {
    return alert('Harap isi catatan perbaikan dan tentukan batas waktu revisinya!')
  }

  sedangMenyimpan.value = true
  try {
    const listSiswaBaru = JSON.parse(JSON.stringify(props.kelas.siswa))
    const idx = listSiswaBaru.findIndex((s) => s.nis === dataKoreksi.value.siswa_nis)

    if (idx !== -1) {
      if (!listSiswaBaru[idx].nilai_pembelajaran) listSiswaBaru[idx].nilai_pembelajaran = {}
      listSiswaBaru[idx].nilai_pembelajaran[dataKoreksi.value.kegiatan_id] = 'revisi'

      if (!listSiswaBaru[idx].catatan_revisi) listSiswaBaru[idx].catatan_revisi = {}
      listSiswaBaru[idx].catatan_revisi[dataKoreksi.value.kegiatan_id] = {
        aktif: true,
        catatan_guru: formRevisi.value.catatan,
        batas_waktu: formRevisi.value.batasWaktu,
      }

      const docRef = doc(db, 'kelas', idKelas)
      await updateDoc(docRef, { siswa: listSiswaBaru })

      emit('update-siswa', listSiswaBaru)
      tutupKoreksi()
    }
  } catch (error) {
    console.error('Gagal menyimpan revisi:', error)
    alert('Terjadi kesalahan saat mengirim instruksi revisi.')
  }
  sedangMenyimpan.value = false
}

const triggerBukaPengaturan = () => {
  emit('buka-pengaturan')
}

const hitungKetercapaianSiswa = (siswa) => {
  let totalMateri = 0,
    selesaiMateri = 0,
    totalNilaiTugas = 0,
    countTugas = 0,
    totalNilaiKuis = 0,
    countKuis = 0

  daftarKolomKegiatan.value.forEach((kegiatan) => {
    const progres = siswa.progres_belajar?.[kegiatan.id]
    const nilai = siswa.nilai_pembelajaran?.[kegiatan.id]

    if (kegiatan.tipe === 'materi') {
      totalMateri++
      if (progres === 'selesai') selesaiMateri++
    } else if (kegiatan.tipe === 'tugas') {
      if (nilai && typeof nilai === 'number') {
        totalNilaiTugas += nilai
        countTugas++
      }
    } else if (kegiatan.tipe === 'kuis') {
      if (nilai && typeof nilai === 'number') {
        totalNilaiKuis += nilai
        countKuis++
      }
    }
  })

  const capaianMateri = totalMateri > 0 ? (selesaiMateri / totalMateri) * 100 : 0
  const rataTugas = countTugas > 0 ? totalNilaiTugas / countTugas : 0
  const rataKuis = countKuis > 0 ? totalNilaiKuis / countKuis : 0

  const bMateri = formulaRapor.value.materi / 100
  const bTugas = formulaRapor.value.tugas / 100
  const bKuis = formulaRapor.value.kuis / 100

  const nilaiAkhir = capaianMateri * bMateri + rataTugas * bTugas + rataKuis * bKuis

  return { capaian: Math.round(capaianMateri), akhir: Math.round(nilaiAkhir) }
}

const pratinjauTugas = computed(() => {
  if (!dataKoreksi.value || !dataKoreksi.value.url_file) {
    return { tipe: 'none', url: '', rawUrl: '' }
  }

  const rawUrl =
    typeof dataKoreksi.value.url_file === 'object'
      ? dataKoreksi.value.url_file[tabTugasAktif.value] || ''
      : dataKoreksi.value.url_file

  if (!rawUrl) return { tipe: 'none', url: '', rawUrl: '' }

  const ytMatch = rawUrl.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/,
  )
  if (ytMatch && ytMatch[1]) {
    return { tipe: 'youtube', url: `https://www.youtube.com/embed/${ytMatch[1]}`, rawUrl }
  }

  if (rawUrl.toLowerCase().includes('.pdf') || rawUrl.includes('gurumales.com')) {
    return {
      tipe: 'pdf',
      url: `https://docs.google.com/viewer?url=${encodeURIComponent(rawUrl)}&embedded=true`,
      rawUrl,
    }
  }

  return { tipe: 'lainnya', url: rawUrl, rawUrl }
})

const statusKeterlambatan = computed(() => {
  if (!dataKoreksi.value || dataKoreksi.value.tipe === 'materi') return null

  if (!dataKoreksi.value.waktu_kumpul) {
    return { teks: 'Waktu Tidak Terekam', terlambat: false, detail: '-' }
  }

  const waktuKumpul = new Date(dataKoreksi.value.waktu_kumpul)
  const detailKumpul = waktuKumpul.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (!dataKoreksi.value.deadline) {
    return { teks: 'Tepat Waktu', terlambat: false, detail: detailKumpul }
  }

  const batasDeadline = new Date(dataKoreksi.value.deadline)

  if (waktuKumpul > batasDeadline) {
    const selisihMs = waktuKumpul - batasDeadline
    const selisihMenit = Math.floor(selisihMs / 60000)
    const selisihJam = Math.floor(selisihMenit / 60)
    const selisihHari = Math.floor(selisihJam / 24)

    let teksKeterlambatan
    if (selisihHari > 0) teksKeterlambatan = `${selisihHari} Hari`
    else if (selisihJam > 0) teksKeterlambatan = `${selisihJam} Jam`
    else teksKeterlambatan = `${selisihMenit} Menit`

    return { teks: `Terlambat ${teksKeterlambatan}`, terlambat: true, detail: detailKumpul }
  }

  return { teks: 'Tepat Waktu', terlambat: false, detail: detailKumpul }
})
</script>

<template>
  <div
    class="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden"
  >
    <div
      class="bg-white border-b border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-[0_4px_10px_-5px_rgba(0,0,0,0.05)] z-20 shrink-0"
    >
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-5">
          <div
            class="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
          >
            <span class="w-3 h-3 rounded-full bg-slate-200"></span> Belum Akses
          </div>
          <div
            class="flex items-center gap-2 text-[11px] font-bold text-amber-500 uppercase tracking-wider"
          >
            <span class="w-3 h-3 rounded-full bg-amber-400"></span> Perlu Dikoreksi
          </div>
          <div
            class="flex items-center gap-2 text-[11px] font-bold text-rose-500 uppercase tracking-wider"
          >
            <span class="w-3 h-3 rounded-full bg-rose-400"></span> Revisi
          </div>
          <div
            class="flex items-center gap-2 text-[11px] font-bold text-emerald-600 uppercase tracking-wider"
          >
            <span class="w-3 h-3 rounded-full bg-emerald-400"></span> Selesai / Dinilai
          </div>
        </div>
        <div
          class="flex items-center gap-3 text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-100/50 mt-1"
        >
          <span class="text-slate-400 uppercase font-bold tracking-widest">Kode Kolom:</span>
          <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold"
            >M = Materi ({{ formulaRapor.materi }}%)</span
          >
          <span class="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold"
            >T = Tugas ({{ formulaRapor.tugas }}%)</span
          >
          <span class="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold"
            >K = Kuis ({{ formulaRapor.kuis }}%)</span
          >
        </div>
      </div>
      <button
        @click="triggerBukaPengaturan"
        class="text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 px-5 py-2.5 rounded-xl transition border border-slate-200 shadow-sm shrink-0"
      >
        ⚙️ Ubah Formula Rapor
      </button>
    </div>

    <div
      v-if="daftarRombelUnik.length > 1"
      class="bg-slate-50 border-b border-slate-200 px-4 py-3 shrink-0 flex items-center gap-3 overflow-x-auto custom-scrollbar"
    >
      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0"
        >Filter Rombel:</span
      >
      <div class="flex gap-2">
        <button
          @click="rombelPilihan = 'Semua'"
          :class="[
            'px-4 py-1.5 rounded-full text-xs font-bold transition-all',
            rombelPilihan === 'Semua'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100',
          ]"
        >
          Semua Kelas
        </button>
        <button
          v-for="rombel in daftarRombelUnik"
          :key="rombel"
          @click="rombelPilihan = rombel"
          :class="[
            'px-4 py-1.5 rounded-full text-xs font-bold transition-all',
            rombelPilihan === rombel
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600',
          ]"
        >
          {{ rombel }}
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-auto custom-scrollbar relative bg-slate-50/50">
      <table class="w-full min-w-max border-collapse border-spacing-0 bg-white">
        <thead class="bg-white shadow-sm relative z-30">
          <tr>
            <th
              rowspan="2"
              class="sticky left-0 top-0 z-40 bg-white border-b border-r border-slate-200 p-4 w-[60px] text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
            >
              <span class="text-xs font-bold text-slate-500 uppercase">No.</span>
            </th>
            <th
              rowspan="2"
              class="sticky left-[60px] top-0 z-40 bg-white border-b border-r-4 border-slate-300 p-4 w-[240px] text-left shadow-[6px_0_10px_-4px_rgba(0,0,0,0.08)]"
            >
              <span class="text-xs font-bold text-slate-500 uppercase">Identitas Siswa</span>
            </th>
            <th
              rowspan="2"
              class="sticky top-0 z-30 bg-slate-50 border-b border-r border-slate-200 p-2 w-[90px] text-center"
            >
              <p class="text-[10px] font-bold text-slate-700 uppercase">Capaian<br />Materi</p>
            </th>
            <th
              rowspan="2"
              class="sticky top-0 z-30 bg-slate-50 border-b border-r border-slate-200 p-2 w-[100px] text-center"
            >
              <p class="text-[10px] font-bold text-slate-700 uppercase">Nilai<br />Pembelajaran</p>
            </th>
            <template v-for="bab in props.kelas.struktur_materi" :key="'bab-' + bab.id">
              <th
                v-if="bab.sub_bab && bab.sub_bab.length > 0"
                :colspan="bab.sub_bab.length"
                class="sticky top-0 z-30 bg-slate-50 border-b border-r border-slate-200 p-2 text-center h-[44px]"
              >
                <p
                  class="text-[11px] font-bold text-slate-600 truncate max-w-[200px] mx-auto px-2"
                  :title="bab.judul"
                >
                  {{ bab.judul }}
                </p>
              </th>
            </template>
          </tr>
          <tr>
            <th
              v-for="kegiatan in daftarKolomKegiatan"
              :key="kegiatan.id"
              class="sticky top-[44px] z-30 bg-white border-b border-r border-slate-200 px-2 py-2 min-w-[100px] text-center hover:bg-slate-50 transition cursor-help"
              :title="kegiatan.judul"
            >
              <span
                :class="[
                  'inline-block text-[11px] rounded-sm font-black',
                  kegiatan.tipe === 'kuis'
                    ? 'text-purple-600'
                    : kegiatan.tipe === 'tugas'
                      ? 'text-amber-600'
                      : 'text-blue-600',
                ]"
                >{{ kegiatan.kode }}</span
              >
            </th>
          </tr>
        </thead>
        <tbody class="text-sm">
          <tr
            v-for="(siswa, sIndex) in siswaTerurut"
            :key="siswa.nis"
            class="hover:bg-slate-50 transition-colors group"
          >
            <td
              class="sticky left-0 z-20 bg-white border-b border-slate-200 p-4 text-center group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
            >
              <span class="text-sm font-black text-slate-800">{{ sIndex + 1 }}.</span>
            </td>
            <td
              class="sticky left-[60px] z-20 bg-white border-b border-r-4 border-slate-300 p-4 group-hover:bg-slate-50 shadow-[6px_0_10px_-4px_rgba(0,0,0,0.08)]"
            >
              <div>
                <p class="font-bold text-slate-800 leading-tight">{{ siswa.nama }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span
                    class="bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[9px] border"
                    >{{ siswa.rombel || '?' }}</span
                  >
                  <span class="text-[10px] text-slate-400 font-medium">NIS: {{ siswa.nis }}</span>
                </div>
              </div>
            </td>
            <td class="border-b border-r border-slate-200 p-3 text-center bg-slate-50/50">
              <span class="text-sm font-bold text-blue-700"
                >{{ hitungKetercapaianSiswa(siswa).capaian }}%</span
              >
            </td>
            <td class="border-b border-r border-slate-200 p-3 text-center bg-slate-50/50">
              <span class="text-base font-black text-indigo-700">{{
                hitungKetercapaianSiswa(siswa).akhir
              }}</span>
            </td>
            <td
              v-for="kegiatan in daftarKolomKegiatan"
              :key="`${siswa.nis}-${kegiatan.id}`"
              class="border-b border-r border-slate-100 p-2 text-center"
            >
              <div class="flex items-center justify-center gap-2">
                <span
                  v-if="getStatusKeterlambatanTabel(siswa, kegiatan)"
                  :class="[
                    'text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border',
                    getStatusKeterlambatanTabel(siswa, kegiatan).status === 'telat'
                      ? 'bg-red-50 text-red-600 border-red-100'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-100',
                  ]"
                >
                  {{ getStatusKeterlambatanTabel(siswa, kegiatan).teks }}
                </span>
                <button
                  @click="bukaKoreksi(siswa, kegiatan)"
                  :class="[
                    'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all focus:outline-none hover:scale-110 shadow-sm shrink-0',
                    getStatusProgresSiswa(siswa, kegiatan).kelas,
                  ]"
                >
                  {{ getStatusProgresSiswa(siswa, kegiatan).label }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div
        v-if="tampilPanelKoreksi"
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] transition-opacity"
        @click="tutupKoreksi"
      ></div>
      <div
        :class="[
          'fixed inset-y-0 right-0 z-[9999] w-full max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200 transform transition-transform duration-300 ease-in-out',
          tampilPanelKoreksi ? 'translate-x-0' : 'translate-x-full',
        ]"
      >
        <div v-if="dataKoreksi" class="flex flex-col h-full">
          <div
            class="px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0 bg-white"
          >
            <div>
              <h3 class="font-bold text-slate-800 text-lg">Evaluasi & Penilaian</h3>
              <p class="text-xs text-slate-400 mt-1">Koreksi Berkas Hasil Belajar</p>
            </div>
            <button
              @click="tutupKoreksi"
              class="text-slate-400 hover:text-slate-600 w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full text-2xl"
            >
              &times;
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50">
            <div
              class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-5"
            >
              <div
                class="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xl border-4 border-white shadow-sm shrink-0"
              >
                {{ dataKoreksi.siswa_nama.charAt(0) }}
              </div>
              <div class="flex-1">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                  Siswa
                </p>
                <p class="text-lg font-bold text-slate-800">{{ dataKoreksi.siswa_nama }}</p>
                <p class="text-xs font-medium text-slate-500 mt-0.5">
                  [{{ dataKoreksi.kegiatan_kode }}] {{ dataKoreksi.kegiatan_judul }}
                </p>
                <div
                  v-if="dataKoreksi.tipe !== 'materi' && statusKeterlambatan"
                  class="flex flex-wrap items-center gap-2 mt-3"
                >
                  <span
                    :class="[
                      'text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border flex items-center gap-1',
                      statusKeterlambatan.terlambat
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-200',
                    ]"
                  >
                    {{ statusKeterlambatan.terlambat ? '⚠️' : '✓' }} {{ statusKeterlambatan.teks }}
                  </span>
                  <span class="text-[10px] font-bold text-slate-400 border-l border-slate-200 pl-2"
                    >Dikumpul: {{ statusKeterlambatan.detail }}</span
                  >
                </div>
              </div>
            </div>

            <div
              v-if="dataKoreksi.tipe === 'tugas'"
              class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[450px] flex flex-col"
            >
              <div
                class="px-5 pt-4 pb-0 bg-slate-50 border-b border-slate-100 flex flex-col gap-3 shrink-0"
              >
                <div class="flex justify-between items-center">
                  <span class="text-xs font-bold text-slate-500 uppercase tracking-wider"
                    >Pratinjau Dokumen Berkas</span
                  >
                  <div class="flex gap-3 text-xs font-bold" v-if="pratinjauTugas.rawUrl">
                    <a
                      :href="pratinjauTugas.rawUrl"
                      download
                      class="text-slate-600 hover:text-slate-900"
                      >Unduh Asli</a
                    >
                    <a
                      :href="pratinjauTugas.rawUrl"
                      target="_blank"
                      class="text-blue-600 hover:text-blue-800"
                      >Tab Baru ↗</a
                    >
                  </div>
                </div>
                <div
                  v-if="
                    typeof dataKoreksi.url_file === 'object' &&
                    Object.keys(dataKoreksi.url_file).length > 0
                  "
                  class="flex gap-1"
                >
                  <button
                    v-if="dataKoreksi.url_file.pdf"
                    @click="tabTugasAktif = 'pdf'"
                    :class="[
                      'px-4 py-2 text-xs font-bold rounded-t-lg border-t border-x transition-colors',
                      tabTugasAktif === 'pdf'
                        ? 'bg-white border-slate-200 text-emerald-700'
                        : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-200/50',
                    ]"
                  >
                    📄 Dokumen PDF
                  </button>
                  <button
                    v-if="dataKoreksi.url_file.link"
                    @click="tabTugasAktif = 'link'"
                    :class="[
                      'px-4 py-2 text-xs font-bold rounded-t-lg border-t border-x transition-colors',
                      tabTugasAktif === 'link'
                        ? 'bg-white border-slate-200 text-blue-700'
                        : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-200/50',
                    ]"
                  >
                    🔗 Tautan Video
                  </button>
                </div>
                <div v-else class="h-2"></div>
              </div>
              <template v-if="pratinjauTugas.tipe === 'youtube' || pratinjauTugas.tipe === 'pdf'">
                <iframe
                  :src="pratinjauTugas.url"
                  class="w-full flex-1 border-none bg-slate-100"
                ></iframe>
              </template>
              <template v-else-if="pratinjauTugas.tipe === 'lainnya'">
                <div
                  class="flex-1 bg-slate-50 flex flex-col items-center justify-center p-6 text-center"
                >
                  <span class="text-4xl block mb-3">🔗</span>
                  <p class="font-bold text-slate-700">Tautan Eksternal Terdeteksi</p>
                  <a
                    :href="pratinjauTugas.url"
                    target="_blank"
                    class="mt-5 px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl"
                    >Buka Tautan di Tab Baru ↗</a
                  >
                </div>
              </template>
              <template v-else>
                <div
                  class="flex-1 bg-slate-50 flex items-center justify-center text-slate-400 text-xs italic"
                >
                  Pratinjau tidak tersedia
                </div>
              </template>
            </div>

            <div
              v-if="dataKoreksi.tipe === 'kuis'"
              class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[450px] flex flex-col"
            >
              <div class="px-5 py-4 bg-slate-50 border-b border-slate-100 shrink-0">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >Lembar Jawaban Siswa</span
                >
              </div>
              <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div
                  v-if="!dataKoreksi.daftar_soal || dataKoreksi.daftar_soal.length === 0"
                  class="text-center text-slate-400 italic text-sm"
                >
                  Tidak ada data soal untuk kuis ini.
                </div>
                <div
                  v-else
                  v-for="(soal, index) in dataKoreksi.daftar_soal"
                  :key="soal.id"
                  class="border border-slate-200 rounded-xl p-4 shadow-sm"
                >
                  <div class="flex gap-3 mb-4">
                    <div
                      class="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center text-xs font-black shrink-0"
                    >
                      {{ index + 1 }}
                    </div>
                    <div class="flex-1">
                      <p class="font-bold text-slate-800 text-sm mb-1 leading-relaxed">
                        {{ soal.pertanyaan }}
                      </p>
                      <span
                        class="text-[9px] font-black uppercase tracking-widest text-slate-400"
                        >{{ soal.jenis === 'pilgan' ? 'Pilihan Ganda' : 'Esai / Uraian' }}</span
                      >
                    </div>
                  </div>
                  <div v-if="soal.jenis === 'pilgan'" class="ml-11 space-y-2">
                    <div
                      v-for="(val, key) in soal.opsi"
                      :key="key"
                      :class="[
                        'p-3 rounded-lg border-2 text-sm flex items-start gap-2',
                        dataKoreksi.jawaban_kuis[soal.id] === key
                          ? soal.jawaban_benar === key
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                            : 'bg-rose-50 border-rose-400 text-rose-800'
                          : 'bg-slate-50 border-slate-100 text-slate-500',
                      ]"
                    >
                      <span class="font-black uppercase">{{ key }}.</span>
                      <span class="flex-1 font-medium">{{ val }}</span>
                      <span
                        v-if="dataKoreksi.jawaban_kuis[soal.id] === key"
                        class="text-lg leading-none"
                        >{{ soal.jawaban_benar === key ? '✅' : '❌' }}</span
                      >
                      <span
                        v-else-if="soal.jawaban_benar === key"
                        class="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200"
                        >KUNCI</span
                      >
                    </div>
                    <div
                      v-if="!dataKoreksi.jawaban_kuis[soal.id]"
                      class="text-xs text-rose-500 font-bold mt-2"
                    >
                      ⚠️ Siswa tidak menjawab soal ini.
                    </div>
                  </div>
                  <div v-if="soal.jenis === 'esai'" class="ml-11 space-y-3">
                    <div
                      class="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 font-medium whitespace-pre-wrap"
                    >
                      {{ dataKoreksi.jawaban_kuis[soal.id] || '(Siswa mengosongkan jawaban)' }}
                    </div>
                    <div
                      class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800"
                    >
                      <span class="font-black uppercase tracking-widest block mb-1"
                        >Panduan Koreksi (Kunci):</span
                      >
                      <span class="font-medium whitespace-pre-wrap">{{
                        soal.jawaban_benar || 'Tidak ada panduan spesifik.'
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="dataKoreksi.tipe === 'materi'">
              <div
                v-if="dataKoreksi.status_saat_ini === 'selesai'"
                class="text-center p-8 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm"
              >
                <span class="text-5xl block mb-3">✅</span>
                <p class="text-base font-bold text-emerald-800">Materi Selesai Dibaca</p>
                <p class="text-sm text-emerald-600 mt-1">
                  Siswa telah memenuhi durasi minimal belajar.
                </p>
              </div>
              <div
                v-else
                class="bg-slate-100 p-6 rounded-2xl border border-slate-200 shadow-inner max-w-sm mx-auto flex flex-col gap-4 text-center"
              >
                <span class="text-5xl block mb-3 opacity-50">📖</span>
                <p class="text-sm font-bold text-slate-600">
                  Siswa belum menyelesaikan materi ini secara online.
                </p>
                <button
                  @click="simpanPenilaian"
                  :disabled="sedangMenyimpan"
                  class="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition shadow-md text-lg disabled:opacity-50"
                >
                  {{ sedangMenyimpan ? 'MENYIMPAN...' : 'TANDAI SELESAI MANUAL' }}
                </button>
              </div>
            </div>

            <div
              v-if="dataKoreksi.tipe !== 'materi'"
              class="bg-slate-100 p-6 rounded-2xl border border-slate-200 shadow-inner max-w-sm mx-auto flex flex-col gap-4"
            >
              <div class="flex bg-white p-1 rounded-xl border border-slate-200 mb-2">
                <button
                  @click="modeRevisi = false"
                  :class="
                    !modeRevisi
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  "
                  class="flex-1 py-2 text-xs font-bold rounded-lg transition"
                >
                  Beri Nilai
                </button>
                <button
                  @click="modeRevisi = true"
                  :class="
                    modeRevisi
                      ? 'bg-rose-50 text-rose-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  "
                  class="flex-1 py-2 text-xs font-bold rounded-lg transition"
                >
                  Minta Revisi
                </button>
              </div>
              <template v-if="!modeRevisi">
                <label
                  class="block text-xs font-bold text-slate-500 text-center uppercase tracking-widest"
                  >Masukkan Nilai (0-100)</label
                >
                <input
                  type="number"
                  min="0"
                  max="100"
                  v-model="nilaiInput"
                  class="w-full border border-slate-300 rounded-xl px-4 py-4 text-4xl font-black text-center text-blue-600 focus:border-blue-500 outline-none transition bg-white"
                  placeholder="0"
                />
                <button
                  @click="simpanPenilaian"
                  :disabled="sedangMenyimpan"
                  class="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-md text-lg disabled:opacity-50"
                >
                  {{ sedangMenyimpan ? 'MENYIMPAN...' : 'SIMPAN NILAI' }}
                </button>
              </template>
              <template v-else>
                <div class="space-y-3">
                  <div>
                    <label
                      class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                      >Catatan Perbaikan</label
                    >
                    <textarea
                      v-model="formRevisi.catatan"
                      rows="3"
                      class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-rose-500 outline-none bg-white"
                      placeholder="Misal: Format PDF salah..."
                    ></textarea>
                  </div>
                  <div>
                    <label
                      class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5"
                      >Batas Waktu Pengumpulan Ulang</label
                    >
                    <input
                      type="datetime-local"
                      v-model="formRevisi.batasWaktu"
                      class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-rose-500 outline-none bg-white"
                    />
                  </div>
                  <button
                    @click="simpanPermintaanRevisi"
                    :disabled="sedangMenyimpan"
                    class="w-full py-4 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition shadow-md text-sm mt-2 disabled:opacity-50"
                  >
                    {{ sedangMenyimpan ? 'MENGIRIM...' : 'KIRIM INSTRUKSI REVISI' }}
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
th,
td {
  border: 1px solid #e2e8f0;
}
table {
  border-collapse: separate;
  border-spacing: 0;
}
.custom-scrollbar::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f8fafc;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
  border: 2px solid #f8fafc;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
