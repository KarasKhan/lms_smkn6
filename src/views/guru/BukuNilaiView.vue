<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '../../firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

import TabPembelajaran from './buku-nilai/TabPembelajaran.vue'
import TabKehadiran from './buku-nilai/TabKehadiran.vue'
import TabRekapAkhir from './buku-nilai/TabRekapAkhir.vue'

const route = useRoute()
const router = useRouter()
const idKelas = route.params.id

const kelas = ref(null)
const sedangMemuat = ref(true)
const tabAktif = ref('pembelajaran')

const tampilModalPengaturan = ref(false)
const bobot = ref({ materi: 20, tugas: 30, kuis: 50 })
const sedangSimpanBobot = ref(false)

const ambilDataKelas = async () => {
  sedangMemuat.value = true
  const docRef = doc(db, 'kelas', idKelas)
  const snap = await getDoc(docRef)

  if (snap.exists()) {
    const data = snap.data()
    const nipLogin = localStorage.getItem('user_nip')

    // PERBAIKAN: Validasi Kepemilikan Kelas di Buku Nilai
    if (data.guru_nip !== nipLogin) {
      alert('Akses Ditolak: Anda tidak memiliki wewenang melihat buku nilai kelas ini!')
      router.replace('/guru/kelas')
      return
    }

    kelas.value = { id: snap.id, ...data }
    if (data.pengaturan_rapor) bobot.value = { ...data.pengaturan_rapor }
  } else {
    alert('Kelas tidak ditemukan.')
    router.replace('/guru/kelas')
  }
  sedangMemuat.value = false
}

onMounted(() => {
  ambilDataKelas()
})

const totalBobot = computed(
  () => Number(bobot.value.materi) + Number(bobot.value.tugas) + Number(bobot.value.kuis),
)

const bukaPengaturan = () => {
  if (kelas.value.pengaturan_rapor) bobot.value = { ...kelas.value.pengaturan_rapor }
  tampilModalPengaturan.value = true
}

const simpanPengaturanRapor = async () => {
  if (totalBobot.value !== 100) return alert('Total bobot presentase harus tepat 100%.')
  sedangSimpanBobot.value = true
  try {
    await updateDoc(doc(db, 'kelas', idKelas), { pengaturan_rapor: bobot.value })
    kelas.value.pengaturan_rapor = bobot.value
    tampilModalPengaturan.value = false
  } catch (error) {
    console.error(error)
    alert('Gagal menyimpan pengaturan.')
  }
  sedangSimpanBobot.value = false
}
</script>

<template>
  <div class="h-full flex flex-col relative overflow-hidden bg-slate-50">
    <div class="mb-4 flex items-center justify-between shrink-0 px-2 pt-2">
      <div class="flex items-center gap-4">
        <button
          @click="router.push('/guru/kelas')"
          class="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition shadow-sm"
        >
          &larr; Kembali
        </button>
        <div>
          <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Manajemen Nilai Kelas</h1>
          <p v-if="kelas" class="text-sm text-slate-500 mt-1">
            {{ kelas.nama_matpel }} | Rombel: {{ kelas.rombel_target }}
          </p>
        </div>
      </div>
    </div>

    <div class="px-2 mb-4 shrink-0">
      <div class="flex bg-slate-200/50 p-1 rounded-xl w-max border border-slate-200 shadow-sm">
        <button
          @click="tabAktif = 'pembelajaran'"
          :class="[
            'px-6 py-2.5 text-sm font-bold rounded-lg transition-all',
            tabAktif === 'pembelajaran'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          ]"
        >
          Nilai Pembelajaran
        </button>
        <button
          @click="tabAktif = 'kehadiran'"
          :class="[
            'px-6 py-2.5 text-sm font-bold rounded-lg transition-all',
            tabAktif === 'kehadiran'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          ]"
        >
          Nilai Kehadiran
        </button>
        <button
          @click="tabAktif = 'akhir'"
          :class="[
            'px-6 py-2.5 text-sm font-bold rounded-lg transition-all',
            tabAktif === 'akhir'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          ]"
        >
          Rekap Nilai Akhir
        </button>
      </div>
    </div>

    <div class="flex-1 flex flex-col min-h-0 relative overflow-hidden mx-2 mb-2">
      <div
        v-if="sedangMemuat"
        class="h-full bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400"
      >
        <span class="animate-pulse font-medium">Memuat matriks kelas...</span>
      </div>
      <template v-else>
        <TabPembelajaran
          v-if="tabAktif === 'pembelajaran'"
          :kelas="kelas"
          @update-siswa="(siswaBaru) => (kelas.siswa = siswaBaru)"
          @buka-pengaturan="bukaPengaturan"
        />
        <TabKehadiran v-if="tabAktif === 'kehadiran'" :kelas="kelas" />
        <TabRekapAkhir v-if="tabAktif === 'akhir'" :kelas="kelas" />
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="tampilModalPengaturan"
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4 transition-opacity"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden"
        >
          <div
            class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center"
          >
            <h3 class="font-bold text-slate-800">Pengaturan Formula Rapor</h3>
            <button
              @click="tampilModalPengaturan = false"
              class="text-slate-400 hover:text-slate-600 text-xl"
            >
              &times;
            </button>
          </div>
          <div class="p-6 space-y-5">
            <div class="space-y-4">
              <div class="flex items-center justify-between gap-4">
                <label class="text-sm font-bold text-slate-700 flex-1">Ketercapaian Materi</label>
                <div class="flex items-center gap-2 w-24">
                  <input
                    type="number"
                    v-model="bobot.materi"
                    class="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-sm font-bold focus:border-blue-500 outline-none"
                  />
                  <span class="text-slate-400 font-bold">%</span>
                </div>
              </div>
              <div class="flex items-center justify-between gap-4">
                <label class="text-sm font-bold text-slate-700 flex-1">Rata-rata Tugas</label>
                <div class="flex items-center gap-2 w-24">
                  <input
                    type="number"
                    v-model="bobot.tugas"
                    class="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-sm font-bold focus:border-blue-500 outline-none"
                  />
                  <span class="text-slate-400 font-bold">%</span>
                </div>
              </div>
              <div class="flex items-center justify-between gap-4">
                <label class="text-sm font-bold text-slate-700 flex-1"
                  >Rata-rata Kuis / Ujian</label
                >
                <div class="flex items-center gap-2 w-24">
                  <input
                    type="number"
                    v-model="bobot.kuis"
                    class="w-full border border-slate-300 rounded-lg px-3 py-2 text-center text-sm font-bold focus:border-blue-500 outline-none"
                  />
                  <span class="text-slate-400 font-bold">%</span>
                </div>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button
              @click="tampilModalPengaturan = false"
              class="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition"
            >
              Batal
            </button>
            <button
              @click="simpanPengaturanRapor"
              :disabled="totalBobot !== 100 || sedangSimpanBobot"
              class="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {{ sedangSimpanBobot ? 'Menyimpan...' : 'Simpan Formula' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
