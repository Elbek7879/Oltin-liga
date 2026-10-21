import type { Match } from "@/domain/types"

/**
 * Sahifa nomi va tavsifi (Google va Telegram uchun). Matnlar serverdagi SeoService bilan AYNAN bir xil:
 * production'da server sahifani shu nom bilan beradi, sayt ochilgach esa sahifalar orasida o'tilganda nom shu yerdan yangilanadi.
 * O'zgartirsangiz — ikkalasini birga va testlarini ham yangilang.
 */

export const DEFAULT_LEAGUE = "Payariq Oltin Ligasi"

export interface PageMeta {
  title: string
  description: string
  /** Google ko'rsatmasin (admin panel, «topilmadi») */
  noindex?: boolean
}

/** Doimiy bo'limlar: manzil → [sarlavha, tavsif] (SeoService.STATIC_PAGES) */
export const STATIC_PAGES: Record<string, [string, string]> = {
  "/oyinlar": ["O‘yinlar", "O‘yinlar taqvimi va natijalari: sana, vaqt, stadion va hisob."],
  "/jadval": ["Turnir jadvali", "Guruhlar jadvali: ochkolar, to‘plar farqi va pley-offga chiqish zonasi."],
  "/pley-off": ["Pley-off", "Pley-off setkasi: chorak final, yarim final va final o‘yinlari."],
  "/jamoalar": ["Jamoalar", "Ligada qatnashayotgan qishloq va mahalla jamoalari."],
  "/futbolchilar": ["Futbolchilar", "Liga futbolchilari: jamoasi, pozitsiyasi va statistikasi."],
  "/statistika": ["Statistika", "To‘purarlar, assistlar, kartochkalar va Fair Play reytingi."],
  "/ramziy-jamoa": ["Ramziy jamoa", "Har tur yakunidagi eng yaxshi 5 futbolchi."],
  "/yangiliklar": ["Yangiliklar", "Liga yangiliklari va e’lonlari."],
  "/mavsumlar": ["Mavsumlar arxivi", "O‘tgan mavsumlar: chempionlar, to‘purarlar va final o‘yinlari."],
  "/chempionlar": ["Chempionlar tarixi", "Liga chempionlari va sovrindorlari tarixi."],
  "/homiylar": ["Homiylar", "Liga homiylari va hamkorlari."],
  "/liga-haqida": ["Liga haqida", "Liga qayerda o‘tadi, kimlar qatnashadi va qanday qatnashish mumkin."],
  "/nizom": ["Musobaqa nizomi", "Musobaqa qoidalari: ochkolar, teng ochkoda tartib, pley-offga chiqish va intizom."],
  "/maxfiylik": ["Maxfiylik siyosati", "Sayt qanday ma’lumotlarni saqlaydi, nima uchun va futbolchi o‘z ma’lumotini qanday tuzattirishi mumkin."],
}

export const pageTitle = (title: string, league: string) => `${title} — ${league}`

/** «/jadval/» → «/jadval», bo'sh → «/» */
export function normalizePath(path: string) {
  let p = path.startsWith("/") ? path : `/${path}`
  while (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1)
  return p
}

export function homeMeta(league: string): PageMeta {
  return {
    title: `${league} — o‘yinlar, natijalar va turnir jadvali`,
    description: `${league}: o‘yinlar taqvimi, natijalar, turnir jadvali, to‘purarlar va mavsumlar tarixi.`,
  }
}

/** Doimiy sahifa (bosh sahifa ham) yoki undefined */
export function staticMeta(path: string, league: string): PageMeta | undefined {
  const p = normalizePath(path)
  if (p === "/") return homeMeta(league)
  const page = STATIC_PAGES[p]
  return page ? { title: pageTitle(page[0], league), description: page[1] } : undefined
}

export const notFoundMeta = (league: string): PageMeta => ({ title: pageTitle("Sahifa topilmadi", league), description: "Bu manzilda sahifa yo‘q.", noindex: true })

/** Admin panel: «Natijalar — Boshqaruv paneli»; bo'lim nomi bo'lmasa — serverdagidek «Boshqaruv paneli — liga» */
export const adminMeta = (section: string | undefined, league: string): PageMeta => ({
  title: section ? `${section} — Boshqaruv paneli` : pageTitle("Boshqaruv paneli", league),
  description: "Liga tashkilotchilari uchun boshqaruv paneli.",
  noindex: true,
})

export function teamMeta(team: { name: string; village?: string | null }, league: string): PageMeta {
  const place = team.village?.trim() ? ` (${team.village.trim()})` : ""
  return { title: pageTitle(team.name, league), description: `${team.name}${place}: o‘yinlar, natijalar, tarkib va mavsumlar bo‘yicha statistika.` }
}

export function playerMeta(p: { firstName: string; lastName: string }, league: string): PageMeta {
  const name = `${p.firstName} ${p.lastName}`
  return { title: pageTitle(name, league), description: `${name}: o‘yinlar, gollar, assistlar va mavsumlar bo‘yicha statistika.` }
}

/** «Lochin 2:1 Chinor», hisob bo'lmasa «Lochin – Chinor»; jamoalar aniqlanmagan bo'lsa — «Pley-off o‘yini» */
export function matchTitle(home: string | null, away: string | null, score: { home: number; away: number } | null) {
  if (!home || !away) return "Pley-off o‘yini"
  return score ? `${home} ${score.home}:${score.away} ${away}` : `${home} – ${away}`
}

export function matchMeta(match: Pick<Match, "status" | "homeScore" | "awayScore" | "homeExtra" | "awayExtra">, home: string | null, away: string | null, league: string): PageMeta {
  const scored = match.status === "FINISHED" || match.status === "LIVE"
  const score = scored ? { home: (match.homeScore ?? 0) + (match.homeExtra ?? 0), away: (match.awayScore ?? 0) + (match.awayExtra ?? 0) } : null
  const who = !home || !away ? "Pley-off o‘yini" : `${home} va ${away} o‘yini`
  return { title: pageTitle(matchTitle(home, away, score), league), description: `${who}: hisob, gollar, kartochkalar va o‘yin tafsilotlari.` }
}

export function newsMeta(news: { title: string; excerpt?: string | null }, league: string): PageMeta {
  const description = news.excerpt?.trim() ? news.excerpt.trim() : `${league} yangiliklari: ${news.title}.`
  return { title: pageTitle(news.title, league), description }
}
