<script setup>
import { ref, onMounted, computed } from 'vue'
import { Bar, Doughnut } from 'vue-chartjs'
import { useWakaStore } from '../../stores/wakaStore'
import { db } from '../../firebase'
import { collection, getDocs } from 'firebase/firestore'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
} from 'chart.js'

// Registrasi komponen Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

const wakaStore = useWakaStore()
const sedangMemuatData = ref(true)
const totalKelasAktif = ref(0)

onMounted(async () => {
  sedangMemuatData.value = true
  try {
    // 1. Ambil data induk siswa dan guru dari Pinia Store Cache/Firestore
    await Promise.all([wakaStore.fetchSemuaSiswa(), wakaStore.fetchSemuaGuru()])

    // 2. Ambil total data dokumen kelas nyata dari Firestore
    const kelasSnapshot = await getDocs(collection(db, 'kelas'))
    totalKelasAktif.value = kelasSnapshot.size
  } catch (error) {
    console.error('Gagal sinkronisasi data dashboard waka:', error)
  } finally {
    sedangMemuatData.value = false
  }
})

// --- METRIK UTAMA REAL-TIME ---
const totalSiswa = computed(() => {
  return wakaStore.daftarSiswa.filter((s) => s.status === 'aktif').length
})

const totalGuru = computed(() => {
  return wakaStore.daftarGuru.filter((g) => g.status === 'aktif').length
})

// --- GRAFIK 1: DISTRIBUSI SISWA PER ROMBEL (REAKTIF) ---
const chartDataRombel = computed(() => {
  const siswaAktif = wakaStore.daftarSiswa.filter((s) => s.status === 'aktif')

  // Hitung jumlah kemunculan siswa per rombel
  const pemetaanRombel = {}
  siswaAktif.forEach((s) => {
    if (s.rombel_aktif) {
      pemetaanRombel[s.rombel_aktif] = (pemetaanRombel[s.rombel_aktif] || 0) + 1
    }
  })

  // Urutkan nama rombel secara alfabetis (A-Z) agar rapi
  const labelRombelTerurut = Object.keys(pemetaanRombel).sort()
  const datasetJumlahSiswa = labelRombelTerurut.map((rombel) => pemetaanRombel[rombel])

  return {
    labels: labelRombelTerurut.length > 0 ? labelRombelTerurut : ['Belum Ada Data'],
    datasets: [
      {
        label: 'Jumlah Siswa',
        backgroundColor: '#111827', // text-slate-900
        borderRadius: 6,
        // PERBAIKAN: Mengubah datasetSiswa menjadi datasetJumlahSiswa
        data: datasetJumlahSiswa.length > 0 ? datasetJumlahSiswa : [0],
      },
    ],
  }
})

const chartOptionsBar = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
    x: { grid: { display: false } },
  },
}

// --- GRAFIK 2: RASIO KEANGGOTAAN SISWA (REAKTIF) ---
const chartDataStatus = computed(() => {
  let aktif = 0
  let lulus = 0
  let keluarPindah = 0

  wakaStore.daftarSiswa.forEach((s) => {
    if (s.status === 'aktif') aktif++
    else if (s.status === 'lulus') lulus++
    else if (s.status === 'keluar' || s.status === 'pindah') keluarPindah++
  })

  return {
    labels: ['Aktif', 'Lulus', 'Pindah/Keluar'],
    datasets: [
      {
        backgroundColor: ['#10b981', '#3b82f6', '#ef4444'], // emerald, blue, red
        borderWidth: 0,
        data: [aktif, lulus, keluarPindah],
      },
    ],
  }
})

const chartOptionsDoughnut = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
  },
}
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-500">
    <div class="border-b border-gray-200 pb-4">
      <h1 class="text-2xl font-bold text-gray-800 tracking-tight">Ikhtisar Akademik</h1>
      <p class="text-sm text-gray-500 mt-1">
        Ringkasan data statistik sistem pembelajaran secara keseluruhan.
      </p>
    </div>

    <div
      v-if="sedangMemuatData"
      class="py-24 text-center text-slate-400 font-medium bg-white border border-slate-200 rounded-xl shadow-sm"
    >
      <div
        class="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"
      ></div>
      <p>Mengkalkulasi matriks dan rasio data sekolah...</p>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          class="bg-white p-6 border border-gray-200 rounded-xl shadow-sm flex flex-col justify-center hover:border-emerald-300 transition-all"
        >
          <span class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
            >Total Siswa Aktif</span
          >
          <span class="text-4xl font-black text-gray-900"
            >{{ totalSiswa }} <span class="text-sm font-medium text-slate-400">Anak</span></span
          >
        </div>
        <div
          class="bg-white p-6 border border-gray-200 rounded-xl shadow-sm flex flex-col justify-center hover:border-emerald-300 transition-all"
        >
          <span class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
            >Total Tenaga Pendidik</span
          >
          <span class="text-4xl font-black text-gray-900"
            >{{ totalGuru }} <span class="text-sm font-medium text-slate-400">Guru</span></span
          >
        </div>
        <div
          class="bg-white p-6 border border-gray-200 rounded-xl shadow-sm flex flex-col justify-center hover:border-emerald-300 transition-all"
        >
          <span class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
            >Kelas Mata Pelajaran</span
          >
          <span class="text-4xl font-black text-gray-900"
            >{{ totalKelasAktif }}
            <span class="text-sm font-medium text-slate-400">Ruang</span></span
          >
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          class="lg:col-span-2 bg-white p-6 border border-gray-200 rounded-xl shadow-sm flex flex-col"
        >
          <h3 class="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">
            Distribusi Siswa per Rombel
          </h3>
          <div class="h-[320px] flex-1 relative">
            <Bar :data="chartDataRombel" :options="chartOptionsBar" />
          </div>
        </div>

        <div class="bg-white p-6 border border-gray-200 rounded-xl shadow-sm flex flex-col">
          <h3 class="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">
            Rasio Keanggotaan Siswa
          </h3>
          <div class="h-[320px] flex-1 relative">
            <Doughnut :data="chartDataStatus" :options="chartOptionsDoughnut" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
