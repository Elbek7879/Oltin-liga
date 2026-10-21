import { useEffect } from "react"
import { useSettings } from "@/api/hooks"
import { DEFAULT_LEAGUE, type PageMeta } from "@/lib/seo"

/** Liga nomi (sozlamalardan); yuklanayotgan paytda — undefined */
export function useLeagueName() {
  const { data, isError } = useSettings()
  // Server (SeoService.league) bilan bir xil: bo'sh bo'lmasa — o'zgartirmasdan
  if (data) return data.name?.trim() ? data.name : DEFAULT_LEAGUE
  return isError ? DEFAULT_LEAGUE : undefined
}

function setTag(selector: string, create: () => HTMLElement, attr: string, value: string | null) {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (value === null) {
    el?.remove()
    return
  }
  if (!el) {
    el = create()
    document.head.append(el)
  }
  el.setAttribute(attr, value)
}

const meta = (key: "name" | "property", name: string) => () => {
  const el = document.createElement("meta")
  el.setAttribute(key, name)
  return el
}

/**
 * Sahifa nomi, tavsifi, asosiy manzili (canonical) va Telegram teglarini yangilaydi.
 * Production'da server sahifani allaqachon shu qiymatlar bilan beradi; bu hook sahifalar orasida o'tilganda kerak.
 * meta berilmasa (ma'lumot hali yuklanmoqda) hech narsa o'zgarmaydi — oldingi nom turaveradi.
 * Kirill rejimida yorliqdagi nomni translit-dom o'zi o'giradi; teglar Google uchun lotincha qoladi.
 */
export function useDocumentMeta(page: PageMeta | undefined) {
  const title = page?.title
  const description = page?.description
  const noindex = Boolean(page?.noindex)
  useEffect(() => {
    if (!title || description === undefined) return
    document.title = title
    const url = `${window.location.origin}${window.location.pathname.replace(/(.)\/+$/, "$1")}`
    setTag('meta[name="description"]', meta("name", "description"), "content", description)
    setTag('meta[property="og:title"]', meta("property", "og:title"), "content", title)
    setTag('meta[property="og:description"]', meta("property", "og:description"), "content", description)
    setTag('meta[property="og:url"]', meta("property", "og:url"), "content", url)
    setTag(
      'link[rel="canonical"]',
      () => {
        const el = document.createElement("link")
        el.rel = "canonical"
        return el
      },
      "href",
      noindex ? null : url,
    )
    setTag('meta[name="robots"]', meta("name", "robots"), "content", noindex ? "noindex" : null)
  }, [title, description, noindex])
}

/** Liga nomiga bog'liq sahifa nomi: sozlamalar yuklangach build(liga) natijasi qo'yiladi */
export function useLeagueMeta(build: (league: string) => PageMeta | undefined) {
  const league = useLeagueName()
  useDocumentMeta(league === undefined ? undefined : build(league))
}
