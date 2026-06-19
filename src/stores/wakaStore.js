import { defineStore } from 'pinia'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'

export const useWakaStore = defineStore('waka', {
  state: () => ({
    daftarSiswa: [],
    daftarGuru: [], // Tambahan untuk data guru
    terakhirDiambil: null,
    terakhirDiambilGuru: null,
    sedangMemuat: false,
    sedangMemuatGuru: false,
  }),
  actions: {
    async fetchSemuaSiswa(paksaMuatUlang = false) {
      const BATAS_WAKTU_CACHE = 15 * 60 * 1000
      const waktuSekarang = Date.now()

      if (
        !paksaMuatUlang &&
        this.daftarSiswa.length > 0 &&
        this.terakhirDiambil &&
        waktuSekarang - this.terakhirDiambil < BATAS_WAKTU_CACHE
      ) {
        return
      }

      this.sedangMemuat = true
      try {
        const referensiKoleksi = collection(db, 'users')
        const kueriSiswa = query(referensiKoleksi, where('role', '==', 'siswa'))
        const hasilSnapshot = await getDocs(kueriSiswa)
        const dataSementara = []

        hasilSnapshot.forEach((doc) => {
          dataSementara.push(doc.data())
        })

        this.daftarSiswa = dataSementara
        this.terakhirDiambil = waktuSekarang
      } catch (error) {
        console.error('Gagal mengambil data siswa:', error)
      } finally {
        this.sedangMemuat = false
      }
    },

    // ACTION BARU: Mengambil Data Guru
    async fetchSemuaGuru(paksaMuatUlang = false) {
      const BATAS_WAKTU_CACHE = 15 * 60 * 1000
      const waktuSekarang = Date.now()

      if (
        !paksaMuatUlang &&
        this.daftarGuru.length > 0 &&
        this.terakhirDiambilGuru &&
        waktuSekarang - this.terakhirDiambilGuru < BATAS_WAKTU_CACHE
      ) {
        return
      }

      this.sedangMemuatGuru = true
      try {
        const referensiKoleksi = collection(db, 'users')
        const kueriGuru = query(referensiKoleksi, where('role', '==', 'guru'))
        const hasilSnapshot = await getDocs(kueriGuru)
        const dataSementara = []

        hasilSnapshot.forEach((doc) => {
          dataSementara.push(doc.data())
        })

        this.daftarGuru = dataSementara
        this.terakhirDiambilGuru = waktuSekarang
      } catch (error) {
        console.error('Gagal mengambil data guru:', error)
      } finally {
        this.sedangMemuatGuru = false
      }
    },
  },
})
