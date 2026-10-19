import type { MatchStatus, Position, SeasonStatus } from "@/domain/types"

export const TIME_ZONE = "Asia/Tashkent"

const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"]
const WEEKDAYS_SHORT = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"]
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]
const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"]

/** Toshkent vaqti bo'yicha sana qismlari */
export function localParts(iso: string) {
  const d = new Date(iso)
  const shifted = new Date(d.getTime() + 5 * 3600_000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  }
}

export function localDateKey(iso: string) {
  const p = localParts(iso)
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

export function todayKey(now: Date = new Date()) {
  return localDateKey(now.toISOString())
}

export function formatTime(iso: string) {
  const p = localParts(iso)
  return `${String(p.hours).padStart(2, "0")}:${String(p.minutes).padStart(2, "0")}`
}

export function formatDate(iso: string, opts: { weekday?: boolean; year?: boolean } = {}) {
  const p = localParts(iso)
  const base = `${p.day}-${MONTHS[p.month]}`
  const withYear = opts.year ? `${p.year}-yil ${base}` : base
  return opts.weekday ? `${WEEKDAYS[p.weekday]}, ${withYear}` : withYear
}

/** Sana qismlari so'z bilan (Toshkent vaqti): «Juma», 16, «oktabr», 2026 */
export function dateWords(iso: string) {
  const p = localParts(iso)
  return { weekday: WEEKDAYS[p.weekday], day: p.day, month: MONTHS[p.month], year: p.year }
}

export function formatShortDate(iso: string) {
  const p = localParts(iso)
  return `${p.day} ${MONTHS_SHORT[p.month]}`
}

export function weekdayShort(iso: string) {
  return WEEKDAYS_SHORT[localParts(iso).weekday]
}

/** "Bugun", "Ertaga", "Kecha" yoki to'liq sana */
export function relativeDayLabel(iso: string, now: Date = new Date()) {
  const key = localDateKey(iso)
  const today = todayKey(now)
  const diff = Math.round((Date.parse(key) - Date.parse(today)) / 86_400_000)
  if (diff === 0) return "Bugun"
  if (diff === 1) return "Ertaga"
  if (diff === -1) return "Kecha"
  return formatDate(iso, { weekday: true })
}

export function formatDateTime(iso: string) {
  return `${formatDate(iso, { year: true })}, ${formatTime(iso)}`
}

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  SCHEDULED: "Rejalashtirilgan",
  LIVE: "Davom etmoqda",
  FINISHED: "Yakunlangan",
  POSTPONED: "Qoldirilgan",
  CANCELLED: "Bekor qilingan",
}

export const SEASON_STATUS_LABEL: Record<SeasonStatus, string> = {
  DRAFT: "Tayyorlanmoqda",
  ACTIVE: "Davom etmoqda",
  FINISHED: "Yakunlangan",
}

export const POSITION_LABEL: Record<Position, string> = {
  GK: "Darvozabon",
  DF: "Himoyachi",
  MF: "Yarim himoyachi",
  FW: "Hujumchi",
}

/** Pozitsiya ko'rsatilmagan bo'lishi mumkin (tezkor kiritishda) */
export const positionLabel = (p: Position | null | undefined) => (p ? POSITION_LABEL[p] : "Pozitsiyasi ko‘rsatilmagan")
export const positionShort = (p: Position | null | undefined) => (p ? POSITION_SHORT[p] : "—")

export const POSITION_SHORT: Record<Position, string> = {
  GK: "DR",
  DF: "HM",
  MF: "YH",
  FW: "HJ",
}

export function plural(n: number, word: string) {
  return `${n} ta ${word}`
}

export function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`
}

export function shortName(p: { firstName: string; lastName: string }) {
  return `${p.firstName.charAt(0)}. ${p.lastName}`
}

/** URL uchun lotin harflaridan iborat qisqa yozuv */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’ʻʼ'`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}
