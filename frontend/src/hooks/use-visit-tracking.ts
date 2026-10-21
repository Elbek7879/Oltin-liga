import { useEffect } from "react"
import { useLocation } from "react-router"
import { api } from "@/api/client"

/**
 * Tashrif statistikasi: har bir ochilgan sahifa serverga yuboriladi (javob kutilmaydi).
 * Brauzerda tasodifiy anonim raqam saqlanadi — shu bilan bir odam kuniga bir marta sanaladi.
 * Ism, telefon yoki IP yuborilmaydi. «Kuzatmang» (Do Not Track, GPC) yoqilgan brauzerdan hech narsa yuborilmaydi.
 */

const KEY = "pol-visitor"
let lastPath: string | null = null
let referrerSent = false
let sessionVisitor: string | null = null

/** crypto.randomUUID faqat HTTPS'da bor; oddiy http (masalan, tarmoqdagi IP) uchun o'zimiz yasaymiz */
function uuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function visitorId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      id = uuid()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // Brauzer xotirasi yopiq — raqam shu sahifa ochiq turguncha amal qiladi
    return (sessionVisitor ??= uuid())
  }
}

function optedOut() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1"
}

export function useVisitTracking() {
  const { pathname } = useLocation()
  useEffect(() => {
    // Bir sahifa ikki marta sanalmaydi (qayta chizilganda yoki faqat ?tab= o'zgarganda)
    if (pathname === lastPath || optedOut()) return
    lastPath = pathname
    // Qayerdan kelgani faqat sayt ochilgandagi birinchi sahifada ma'lum
    const referrer = referrerSent ? "" : document.referrer
    referrerSent = true
    api.trackVisit({ path: pathname, referrer, visitor: visitorId() })
  }, [pathname])
}
