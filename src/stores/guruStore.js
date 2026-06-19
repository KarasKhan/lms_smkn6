import { defineStore } from 'pinia'
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

export const useGuruStore = defineStore('guru', {
  state: () => ({
    daftarKelas: [],
    sedangMemuatKelas: false,
  }),
  actions: {
    // --- MANAJEMEN KELAS ---
    async fetchKelasGuru(nipGuru) {
      this.sedangMemuatKelas = true
      try {
        const q = query(collection(db, 'kelas'), where('guru_nip', '==', nipGuru))
        const snapshot = await getDocs(q)
        this.daftarKelas = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      } catch (error) {
        console.error('Gagal ambil kelas:', error)
      } finally {
        this.sedangMemuatKelas = false
      }
    },

    async buatKelasBaru(dataKelas, daftarSiswaRombel) {
      try {
        const docRef = await addDoc(collection(db, 'kelas'), {
          ...dataKelas,
          // Menyimpan properti rombel asli tiap siswa ke array kelas
          siswa: daftarSiswaRombel.map((s) => ({
            nis: s.nis,
            nama: s.nama,
            rombel: s.rombel_aktif,
          })),
          jumlah_siswa: daftarSiswaRombel.length,
          struktur_materi: [],
          dibuat_pada: serverTimestamp(),
        })
        this.daftarKelas.push({
          id: docRef.id,
          ...dataKelas,
          jumlah_siswa: daftarSiswaRombel.length,
          struktur_materi: [],
        })
        return true
      } catch (error) {
        console.error(error)
        return false
      }
    },

    async editKelas(idKelas, dataBaru) {
      try {
        await updateDoc(doc(db, 'kelas', idKelas), dataBaru)
        const index = this.daftarKelas.findIndex((k) => k.id === idKelas)
        if (index !== -1) Object.assign(this.daftarKelas[index], dataBaru)
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    },

    async hapusKelas(idKelas) {
      try {
        await deleteDoc(doc(db, 'kelas', idKelas))
        this.daftarKelas = this.daftarKelas.filter((k) => k.id !== idKelas)
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    },

    // --- MANAJEMEN STRUKTUR MATERI (BAB) ---
    async tambahBab(idKelas, namaBab) {
      try {
        const docRef = doc(db, 'kelas', idKelas)
        const docSnap = await getDoc(docRef)
        const struktur = docSnap.data().struktur_materi || []
        struktur.push({ id: Date.now().toString(), judul: namaBab, sub_bab: [] })
        await updateDoc(docRef, { struktur_materi: struktur })
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    },

    async editBab(idKelas, idBab, judulBaru) {
      try {
        const docRef = doc(db, 'kelas', idKelas)
        const docSnap = await getDoc(docRef)
        const struktur = docSnap.data().struktur_materi
        const index = struktur.findIndex((b) => b.id === idBab)
        if (index !== -1) {
          struktur[index].judul = judulBaru
          await updateDoc(docRef, { struktur_materi: struktur })
        }
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    },

    async hapusBab(idKelas, idBab) {
      try {
        const docRef = doc(db, 'kelas', idKelas)
        const docSnap = await getDoc(docRef)
        const struktur = docSnap.data().struktur_materi.filter((b) => b.id !== idBab)
        await updateDoc(docRef, { struktur_materi: struktur })
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    },

    async simpanKontenSubBab(idKelas, idBab, dataSubBab, idSubEdit = null) {
      try {
        const docRef = doc(db, 'kelas', idKelas)
        const docSnap = await getDoc(docRef)
        const struktur = docSnap.data().struktur_materi
        const indexBab = struktur.findIndex((b) => b.id === idBab)

        if (indexBab !== -1) {
          const { id, ...dataTanpaId } = dataSubBab

          if (idSubEdit) {
            const indexSub = struktur[indexBab].sub_bab.findIndex((s) => s.id === idSubEdit)
            if (indexSub !== -1)
              struktur[indexBab].sub_bab[indexSub] = { id: idSubEdit, ...dataTanpaId }
          } else {
            struktur[indexBab].sub_bab.push({ id: Date.now().toString(), ...dataTanpaId })
          }
          await updateDoc(docRef, { struktur_materi: struktur })
        }
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    },

    async hapusSubBab(idKelas, idBab, idSubBab) {
      try {
        const docRef = doc(db, 'kelas', idKelas)
        const docSnap = await getDoc(docRef)
        const struktur = docSnap.data().struktur_materi
        const indexBab = struktur.findIndex((b) => b.id === idBab)

        if (indexBab !== -1) {
          // PERBAIKAN: pictureBab diganti menjadi struktur
          struktur[indexBab].sub_bab = struktur[indexBab].sub_bab.filter(
            (sub) => sub.id !== idSubBab,
          )
          await updateDoc(docRef, { struktur_materi: struktur })
        }
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    },

    async updateStrukturMateri(idKelas, strukturBaru) {
      try {
        await updateDoc(doc(db, 'kelas', idKelas), { struktur_materi: strukturBaru })
        return true
      } catch (e) {
        console.error(e)
        return false
      }
    },
  },
})
