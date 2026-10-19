import { useEffect } from "react"
import { useLocation } from "react-router"

/**
 * Sahifa almashganda yuqoriga qaytaradi (bir sahifa ichidagi tab o'zgarishida emas).
 * Manzilda #bo'lim bo'lsa — sahifa yuklanib bo'lgach o'sha bo'limga o'tadi.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 })
      return
    }
    const id = decodeURIComponent(hash.slice(1))
    let tries = 0
    let timer: number | undefined
    const find = () => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ block: "start" })
      else if (tries++ < 30) timer = window.setTimeout(find, 50)
    }
    find()
    return () => window.clearTimeout(timer)
  }, [pathname, hash])
  return null
}
