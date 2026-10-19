import type { ID, Match } from "./types"

export interface Pairing {
  round: number
  homeId: ID
  awayId: ID
}

/**
 * Davra tizimi (circle method). Har bir turda har bir jamoa ko'pi bilan bitta o'yin o'ynaydi.
 * Jamoalar soni toq bo'lsa, har turda bitta jamoa dam oladi.
 * legs = 2 bo'lsa, har juftlik ikkinchi davrada yana o'ynaydi.
 */
export function roundRobin(teamIds: ID[], legs: 1 | 2 = 1): Pairing[] {
  if (teamIds.length < 2) return []
  const BYE = "__bye__"
  const teams = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE]
  const n = teams.length
  const rounds = n - 1
  const half = n / 2
  const result: Pairing[] = []

  let rotation = [...teams]
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = rotation[i]
      const b = rotation[n - 1 - i]
      if (a === BYE || b === BYE) continue
      // Juftlikdagi birinchi/ikkinchi jamoa o'rnini navbatma-navbat almashtirish
      const swap = i === 0 ? r % 2 === 1 : (r + i) % 2 === 1
      result.push({ round: r + 1, homeId: swap ? b : a, awayId: swap ? a : b })
    }
    rotation = [rotation[0], rotation[n - 1], ...rotation.slice(1, n - 1)]
  }

  if (legs === 2) {
    const second = result.map((p) => ({ round: p.round + rounds, homeId: p.awayId, awayId: p.homeId }))
    return [...result, ...second]
  }
  return result
}

/**
 * Sanasi hali belgilanmagan o'yin uchun ichki tartib vaqti (saytda ko'rsatilmaydi — «Sana belgilanmagan»).
 * Turlar tartibini saqlaydi: 1-tur mavsum boshida, keyingilari har 7 kunda. Haqiqiy sanani tashkilotchi belgilaydi.
 */
export function placeholderKickoff(seasonStart: string, round: number): string {
  return toLocalIso(addDays(seasonStart, 7 * Math.max(0, round - 1)), "12:00")
}

const PLAYOFF_ORDER = ["R64", "R32", "R16", "QF", "SF", "THIRD", "F"]

/**
 * Jamoa nuqtai nazaridan o'yinlar ketma-ketligi: avval guruh turlari, so'ng pley-off bosqichlari.
 * Ikkala o'yinning ham tur raqami bo'lsa — tur bo'yicha (sana hali belgilanmagan bo'lsa ham to'g'ri),
 * aks holda — boshlanish vaqti bo'yicha.
 */
export function compareMatchOrder(a: Pick<Match, "stage" | "round" | "playoffRound" | "kickoff">, b: Pick<Match, "stage" | "round" | "playoffRound" | "kickoff">) {
  if (a.stage !== b.stage) return a.stage === "GROUP" ? -1 : 1
  if (a.stage === "PLAYOFF") {
    const d = PLAYOFF_ORDER.indexOf(a.playoffRound ?? "") - PLAYOFF_ORDER.indexOf(b.playoffRound ?? "")
    if (d !== 0) return d
  } else if (a.round != null && b.round != null && a.round !== b.round) {
    return a.round - b.round
  }
  return a.kickoff.localeCompare(b.kickoff)
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/** Toshkent vaqti (UTC+5) bo'yicha ISO satr */
export function toLocalIso(date: string, time: string): string {
  return `${date}T${time}:00+05:00`
}

export interface ScheduleConflict {
  matchId: ID
  teamId: ID
  kickoff: string
}

const CONFLICT_WINDOW_HOURS = 20

/**
 * Bir jamoaga bir-biriga juda yaqin vaqtda ikkita o'yin belgilanganini aniqlaydi.
 * Bekor qilingan va qoldirilgan o'yinlar hisobga olinmaydi.
 */
export function findScheduleConflicts(
  candidate: Pick<Match, "id" | "homeId" | "awayId" | "kickoff">,
  matches: Match[],
): ScheduleConflict[] {
  const teams = [candidate.homeId, candidate.awayId].filter(Boolean) as ID[]
  const t = new Date(candidate.kickoff).getTime()
  if (Number.isNaN(t)) return []
  const conflicts: ScheduleConflict[] = []
  for (const m of matches) {
    if (m.id === candidate.id || m.timeConfirmed === false || m.status === "CANCELLED" || m.status === "POSTPONED") continue
    const diffHours = Math.abs(new Date(m.kickoff).getTime() - t) / 36e5
    if (diffHours >= CONFLICT_WINDOW_HOURS) continue
    for (const teamId of teams) {
      if (m.homeId === teamId || m.awayId === teamId) conflicts.push({ matchId: m.id, teamId, kickoff: m.kickoff })
    }
  }
  return conflicts
}

/** Bir o'yin stadionni taxminan shuncha vaqt band qiladi: 2×45 daqiqa, tanaffus va jamoalar almashinuvi */
export const VENUE_BUSY_MINUTES = 120

/** Shu stadionda shu vaqtga yaqin (2 soatdan kam farq bilan) boshqa o'yin bo'lsa, o'sha o'yinlarni qaytaradi */
export function findVenueConflicts(candidate: Pick<Match, "id" | "venueId" | "kickoff">, matches: Match[]): Match[] {
  const t = new Date(candidate.kickoff).getTime()
  if (!candidate.venueId || Number.isNaN(t)) return []
  return matches.filter(
    (m) =>
      m.id !== candidate.id &&
      m.timeConfirmed !== false &&
      m.venueId === candidate.venueId &&
      m.status !== "CANCELLED" &&
      m.status !== "POSTPONED" &&
      Math.abs(new Date(m.kickoff).getTime() - t) < VENUE_BUSY_MINUTES * 60_000,
  )
}

/** Asosiy stadion: o'yinlarda eng ko'p ishlatilgani, o'yin bo'lmasa — ro'yxatdagi birinchisi */
export function primaryVenueId(venues: { id: ID }[], matches: Pick<Match, "venueId">[]): ID | null {
  if (venues.length === 0) return null
  const usage = new Map<ID, number>()
  for (const m of matches) if (m.venueId) usage.set(m.venueId, (usage.get(m.venueId) ?? 0) + 1)
  return venues.reduce((best, v) => ((usage.get(v.id) ?? 0) > (usage.get(best.id) ?? 0) ? v : best), venues[0]).id
}
