<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGuruStore } from '../../stores/guruStore'
import { useWakaStore } from '../../stores/wakaStore'
import { db } from '../../firebase'
import { doc, updateDoc, getDoc } from 'firebase/firestore'

import ModalBukaKelas from './buku-nilai/ModalBukaKelas.vue'

const router = useRouter()
const guruStore = useGuruStore()
const wakaStore = useWakaStore()

const NIP_GURU_LOGIN = localStorage.getItem('user_nip')
const NAMA_GURU_LOGIN = localStorage.getItem('user_nama')

const tampilModalKelas = ref(false)
const modeEdit = ref(false)
const idKelasEdit = ref(null)
const sedangSimpan = ref(false)

// Target rombel berupa Array untuk mendukung banyak pilihan rombel sekaligus
const formKelas = ref({ nama_matpel: '', rombel_target: [], tahun_ajaran: '2026/2027' })

const tampilModalBukaKelas = ref(false)
const kelasAktifBuka = ref(null)
const sedangMemuatAbsen = ref(false)

onMounted(async () => {
  guruStore.fetchKelasGuru(NIP_GURU_LOGIN)
  if (wakaStore.daftarSiswa.length === 0) {
    wakaStore.fetchSemuaSiswa()
  }
})

const daftarRombelTersedia = computed(() => {
  const rombel = wakaStore.daftarSiswa.map((s) => s.rombel_aktif)
  return [...new Set(rombel)].sort()
})

const bukaModalTambah = () => {
  modeEdit.value = false
  formKelas.value = { nama_matpel: '', rombel_target: [], tahun_ajaran: '2026/2027' }
  tampilModalKelas.value = true
}

const bukaModalEdit = (kelas) => {
  modeEdit.value = true
  idKelasEdit.value = kelas.id
  formKelas.value = {
    nama_matpel: kelas.nama_matpel,
    rombel_target: kelas.rombel_target ? kelas.rombel_target.split(', ') : [],
    tahun_ajaran: kelas.tahun_ajaran,
  }
  tampilModalKelas.value = true
}

const handleSimpanKelas = async () => {
  if (!formKelas.value.nama_matpel || formKelas.value.rombel_target.length === 0) {
    return alert('Lengkapi data kelas dan pilih minimal 1 rombel.')
  }
  sedangSimpan.value = true

  const stringRombelTarget = formKelas.value.rombel_target.join(', ')

  if (modeEdit.value) {
    const dataUpdate = {
      nama_matpel: formKelas.value.nama_matpel,
      rombel_target: stringRombelTarget,
      tahun_ajaran: formKelas.value.tahun_ajaran,
    }
    const sukses = await guruStore.editKelas(idKelasEdit.value, dataUpdate)
    if (sukses) tampilModalKelas.value = false
  } else {
    const siswaRombel = wakaStore.daftarSiswa.filter(
      (s) => formKelas.value.rombel_target.includes(s.rombel_aktif) && s.status === 'aktif',
    )

    if (siswaRombel.length === 0) {
      alert('Rombel yang dipilih tidak memiliki siswa aktif.')
      sedangSimpan.value = false
      return
    }

    const dataBaru = {
      ...formKelas.value,
      rombel_target: stringRombelTarget,
      guru_nip: NIP_GURU_LOGIN,
      guru_nama: NAMA_GURU_LOGIN,
    }
    const sukses = await guruStore.buatKelasBaru(dataBaru, siswaRombel)
    if (sukses) tampilModalKelas.value = false
  }
  sedangSimpan.value = false
}

const handleHapusKelas = async (idKelas, nama) => {
  if (confirm(`PERINGATAN!\nApakah Anda yakin ingin menghapus kelas "${nama}" secara permanen?`)) {
    await guruStore.hapusKelas(idKelas)
  }
}

const triggerBukaKelas = (kelasDipilih) => {
  kelasAktifBuka.value = kelasDipilih
  tampilModalBukaKelas.value = true
}

// SIMPAN SESI AWAL TERISOLASI BERDASARKAN ROMBEL YANG DIPILIH GURU
const eksekusiSesiAbsensi = async (dataSesi) => {
  try {
    const docRef = doc(db, 'kelas', kelasAktifBuka.value.id)
    const pertemuanAsli = kelasAktifBuka.value.pertemuan || []

    // Hitung jumlah sesi untuk menentukan kode otomatis (P1, P2, dst) HANYA untuk semester dan rombel yang sama
    const totalSesiRombelIni = pertemuanAsli.filter(
      (p) => p.rombel === dataSesi.rombel && (p.semester || '1') === dataSesi.semester,
    ).length

    const tgl = new Date()
    const namaBulan = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Ags',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ]
    const tanggalFormat = `${tgl.getDate()} ${namaBulan[tgl.getMonth()]}`

    const dataPertemuanBaru = {
      id: dataSesi.id,
      rombel: dataSesi.rombel,
      semester: dataSesi.semester, // <--- TAMBAHAN: Simpan Semester
      kode: `P${totalSesiRombelIni + 1}`, // Menggunakan P (Pertemuan)
      judul: `${tanggalFormat}`,
      pin: dataSesi.pin,
      durasi: dataSesi.durasi,
      waktu_dibuat: new Date().toISOString(),
    }

    const pertemuanUpdate = [...pertemuanAsli, dataPertemuanBaru]
    await updateDoc(docRef, { pertemuan: pertemuanUpdate })
  } catch (error) {
    console.error('Gagal open live session:', error)
  }
}

// FUNGSI BARU: Untuk membatalkan sesi saat di layar QR
const batalkanSesiAbsensi = async (idSesi) => {
  try {
    const docRef = doc(db, 'kelas', kelasAktifBuka.value.id)
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      const data = snap.data()
      // Hapus sesi dari array pertemuan
      const pertemuanBaru = (data.pertemuan || []).filter((p) => p.id !== idSesi)
      await updateDoc(docRef, { pertemuan: pertemuanBaru })
    }
    tampilModalBukaKelas.value = false // Tutup Modal
  } catch (error) {
    console.error('Gagal membatalkan sesi:', error)
  }
}

// SIMPAN REKAP FINAL HASIL INTERVENSI MANUAL GURU
const simpanRekapAbsensi = async (payload) => {
  sedangMemuatAbsen.value = true

  try {
    const targetIdKelas = kelasAktifBuka.value.id // Amankan ID untuk di-redirect
    tampilModalBukaKelas.value = false // Tutup modal proyektor

    const docRef = doc(db, 'kelas', targetIdKelas)

    // Ambil snapshots paling fresh dari Firestore sebelum write operation
    const snapFresh = await getDoc(docRef)
    if (!snapFresh.exists()) return

    const dataTerbaru = snapFresh.data()
    const listSiswaBaru = JSON.parse(JSON.stringify(dataTerbaru.siswa))

    // Hanya update siswa yang masuk rombel target.
    listSiswaBaru.forEach((s) => {
      if (s.rombel === payload.rombel) {
        if (!s.kehadiran) s.kehadiran = {}
        s.kehadiran[payload.idSesi] = payload.dataKehadiran[s.nis] || 'A'
      }
    })

    await updateDoc(docRef, { siswa: listSiswaBaru })
    await guruStore.fetchKelasGuru(NIP_GURU_LOGIN)

    // REDIRECT OTOMATIS KE HALAMAN PENYUSUNAN MATERI
    router.push(`/guru/kelas/${targetIdKelas}`)
  } catch (error) {
    console.error('Gagal menyimpan rekap:', error)
    alert('Terjadi kendala saat memfinalisasi absensi.')
  }
  sedangMemuatAbsen.value = false
}
</script>

<template>
  <div class="relative">
    <div class="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 tracking-tight">Manajemen Kelas</h1>
        <p class="text-sm text-gray-500 mt-1">Kelola ruang kelas, materi, dan evaluasi siswa.</p>
      </div>
      <button
        @click="bukaModalTambah"
        class="bg-blue-600 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-blue-700 transition shadow-sm"
      >
        Buat Ruang Kelas Baru
      </button>
    </div>

    <div
      v-if="sedangMemuatAbsen"
      class="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
    >
      <div
        class="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"
      ></div>
      <p class="font-bold text-gray-700">Menyimpan Sesi Pembelajaran...</p>
    </div>

    <div v-if="guruStore.sedangMemuatKelas" class="py-12 text-center text-gray-500">
      Memuat daftar kelas...
    </div>
    <div
      v-else-if="guruStore.daftarKelas.length === 0"
      class="py-12 text-center bg-white border border-dashed border-gray-300 rounded-xl text-gray-400"
    >
      Belum ada ruang kelas yang dibuat.
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="kelas in guruStore.daftarKelas"
        :key="kelas.id"
        class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all relative group flex flex-col"
      >
        <div
          class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <button
            @click.stop="bukaModalEdit(kelas)"
            class="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-blue-100 hover:text-blue-600"
            title="Edit Info Kelas"
          >
            ✎
          </button>
          <button
            @click.stop="handleHapusKelas(kelas.id, kelas.nama_matpel)"
            class="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-red-100 hover:text-red-600"
            title="Hapus Kelas"
          >
            🗑
          </button>
        </div>

        <div class="mb-4">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded"
          >
            {{ kelas.tahun_ajaran }}
          </span>
        </div>
        <h3 class="text-lg font-bold text-gray-800 pr-16 leading-tight">{{ kelas.nama_matpel }}</h3>
        <p class="text-sm text-gray-500 mt-1 mb-6 truncate" :title="kelas.rombel_target">
          {{ kelas.rombel_target }} • {{ kelas.jumlah_siswa }} Siswa
        </p>

        <div class="mt-auto pt-4 border-t border-gray-100 flex flex-col gap-2">
          <button
            @click="triggerBukaKelas(kelas)"
            class="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-sm shadow-blue-200"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              ></path>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            Buka Kelas & Absensi
          </button>
          <div class="flex gap-2 mt-1">
            <button
              @click="router.push(`/guru/kelas/${kelas.id}`)"
              class="flex-1 py-2 bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold rounded hover:bg-gray-100 transition text-center"
            >
              Susun Materi
            </button>
            <button
              @click="router.push(`/guru/nilai/${kelas.id}`)"
              class="flex-1 py-2 bg-gray-50 text-gray-700 border border-gray-200 text-xs font-bold rounded hover:bg-gray-100 transition text-center"
            >
              Buku Nilai
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL CONFIG KELAS -->
    <Teleport to="body">
      <div
        v-if="tampilModalKelas"
        class="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9999] p-4"
      >
        <div
          class="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200 overflow-hidden"
        >
          <div
            class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"
          >
            <h3 class="font-bold text-gray-800">
              {{ modeEdit ? 'Edit Kelas' : 'Buat Kelas Baru' }}
            </h3>
            <button
              @click="tampilModalKelas = false"
              class="text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1"
                >Nama Mata Pelajaran</label
              >
              <input
                type="text"
                v-model="formKelas.nama_matpel"
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1"
                >Rombel Sasaran (Bisa Pilih Banyak)</label
              >
              <div
                :class="[
                  'grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3 bg-white',
                  modeEdit ? 'opacity-50 pointer-events-none' : '',
                ]"
              >
                <label
                  v-for="rombel in daftarRombelTersedia"
                  :key="rombel"
                  class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                >
                  <input
                    type="checkbox"
                    :value="rombel"
                    v-model="formKelas.rombel_target"
                    :disabled="modeEdit"
                    class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  {{ rombel }}
                </label>
              </div>
              <p v-if="modeEdit" class="text-xs text-red-500 mt-1.5 font-medium">
                *Rombel tidak dapat diubah setelah kelas dibuat (terkait data absensi & nilai).
              </p>
            </div>
          </div>
          <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <button
              @click="tampilModalKelas = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              @click="handleSimpanKelas"
              :disabled="sedangSimpan"
              class="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {{ sedangSimpan ? 'Menyimpan...' : 'Simpan Kelas' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- PROYEKTOR MODAL ABSENSI LIVE -->
    <Teleport to="body">
      <ModalBukaKelas
        v-if="tampilModalBukaKelas && kelasAktifBuka"
        :kelas="kelasAktifBuka"
        @tutup="tampilModalBukaKelas = false"
        @sesi-dibuka="eksekusiSesiAbsensi"
        @simpan-rekap="simpanRekapAbsensi"
        @batalkan-sesi="batalkanSesiAbsensi"
      />
    </Teleport>
  </div>
</template>
