import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const isGlobalLoading = ref(false)
  const loadingMessage = ref('Memproses data...')

  const showLoading = (msg = 'Memproses data...') => {
    loadingMessage.value = msg
    isGlobalLoading.value = true
  }

  const hideLoading = () => {
    isGlobalLoading.value = false
  }

  return { isGlobalLoading, loadingMessage, showLoading, hideLoading }
})
