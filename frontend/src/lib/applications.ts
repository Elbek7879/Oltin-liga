import type { ApplicationStatus, FeedbackInput, FeedbackKind, TeamApplicationInput } from "@/api/types"
import type { Season } from "@/domain/types"
import { cleanName, nameKey } from "./team-names"

/**
 * Ariza qabul qilinadigan yangi mavsum (server bilan bir xil qoida): eng so'nggi ochilgan, hali tayyorlanayotgan
 * haqiqiy (sinov emas) mavsum. Qur'asi tashlangan yoki o'yini o'tkazilgan bo'lsa, server qabul qilmaydi.
 */
export function upcomingSeason(seasons: Season[]) {
  return [...seasons].sort((a, b) => b.year - a.year || b.number - a.number).find((s) => s.status === "DRAFT" && !s.test)
}

/** Arizadagi futbolchilar soni — liga talabi (serverdagi ApplicationService.TEAM_SIZE bilan bir xil) */
export const TEAM_SIZE = 10

export const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/
export const BIRTH_YEAR_MIN = 1950
export const BIRTH_YEAR_MAX = 2020

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  SUGGESTION: "Taklif",
  COMPLAINT: "Shikoyat",
  REQUEST: "Murojaat",
}

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  NEW: "Yangi",
  ACCEPTED: "Qabul qilingan",
  IGNORED: "E’tiborsiz qoldirilgan",
}

/** Jadvallar uchun qisqa nom: nomdagi dastlabki 3 ta harf (masalan «Burgut» → BUR) */
export function shortNameOf(name: string) {
  const letters = [...name].filter((c) => /\p{L}/u.test(c))
  return letters.length < 2 ? "JAM" : letters.slice(0, 3).join("").toUpperCase()
}

/** Jamoa arizasidagi birinchi xato (server bilan bir xil xabarlar) — xato bo'lmasa null */
export function teamApplicationProblem(input: TeamApplicationInput): string | null {
  const name = cleanName(input.teamName)
  if (name.length < 2 || name.length > 40) return "Jamoa nomini kiriting (2–40 ta belgi)."
  if (cleanName(input.village).length > 60) return "Qishloq yoki mahalla nomi juda uzun (60 ta belgigacha)."
  const phone = cleanName(input.contactPhone)
  if (phone && !PHONE_PATTERN.test(phone)) return "Telefon raqamini +998 90 123 45 67 ko‘rinishida kiriting yoki bo‘sh qoldiring."
  if (input.players.length !== TEAM_SIZE) return `Arizada ${TEAM_SIZE} ta futbolchi bo‘lishi kerak.`
  const seen = new Set<string>()
  for (const [i, p] of input.players.entries()) {
    const row = `${i + 1}-futbolchi: `
    const first = cleanName(p.firstName)
    const last = cleanName(p.lastName)
    if (first.length < 2 || first.length > 40) return `${row}ismini kiriting (2–40 ta belgi).`
    if (last.length < 2 || last.length > 40) return `${row}familiyasini kiriting (2–40 ta belgi).`
    if (!p.position) return `${row}pozitsiyasini tanlang.`
    if (p.birthYear != null && (p.birthYear < BIRTH_YEAR_MIN || p.birthYear > BIRTH_YEAR_MAX)) {
      return `${row}tug‘ilgan yilni to‘g‘ri kiriting (${BIRTH_YEAR_MIN}–${BIRTH_YEAR_MAX}) yoki bo‘sh qoldiring.`
    }
    const key = nameKey(`${first} ${last}`)
    if (seen.has(key)) return `${row}${first} ${last} ro‘yxatda ikki marta yozilgan.`
    seen.add(key)
  }
  if (!input.players.some((p) => p.position === "GK")) return "Kamida bitta futbolchini darvozabon deb belgilang."
  return null
}

export function feedbackProblem(input: FeedbackInput): string | null {
  if (!input.kind) return "Murojaat turini tanlang: taklif, shikoyat yoki murojaat."
  const body = input.body.trim()
  if (body.length < 10) return "Murojaat matnini yozing (kamida 10 ta belgi)."
  if (body.length > 2000) return "Matn juda uzun — 2000 ta belgidan oshmasin."
  if (cleanName(input.authorName).length > 60) return "Ism juda uzun (60 ta belgigacha)."
  const phone = cleanName(input.phone)
  if (phone && !PHONE_PATTERN.test(phone)) return "Telefon raqamini +998 90 123 45 67 ko‘rinishida kiriting yoki bo‘sh qoldiring."
  return null
}
