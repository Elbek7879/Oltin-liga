/**
 * Yangi versiya serverga chiqqanda eski JS bo'laklari o'chadi: ochiq turgan sahifa boshqa bo'limga
 * o'tmoqchi bo'lsa, bo'lak topilmaydi. Bunday holda sahifa bir marta qayta yuklanadi va yangi versiya ochiladi.
 * Cheksiz aylanmasligi uchun belgi qo'yiladi; internet yo'q bo'lsa qayta yuklanmaydi (xato sahifasi chiqadi).
 */
const KEY = "pol-chunk-reload"

/** Sahifani qayta yuklashni boshladi — true; bu safar qayta yuklab bo'lmaydi — false */
export function reloadOnceForNewVersion(): boolean {
  if (!navigator.onLine) return false
  try {
    if (sessionStorage.getItem(KEY)) return false
    sessionStorage.setItem(KEY, "1")
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** Sahifa kodi yuklandi — keyingi yangilanish uchun belgi tozalanadi */
export function markChunksLoaded() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Brauzer xotirasi yopiq — hech narsa qilinmaydi
  }
}

/** Dinamik import: bo'lak topilmasa sahifa bir marta qayta yuklanadi, aks holda xato odatdagidek chiqadi */
export async function importFresh<T>(load: () => Promise<T>): Promise<T> {
  try {
    const mod = await load()
    markChunksLoaded()
    return mod
  } catch (err) {
    if (reloadOnceForNewVersion()) return new Promise<T>(() => {})
    throw err
  }
}
