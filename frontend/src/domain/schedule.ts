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

/** Liga o'yini: 2 × 20 daqiqa (mavsum nizomida o'zgartiriladi) */
export const DEFAULT_HALF_MINUTES = 20

/** Bir o'yin stadionni taxminan shuncha daqiqa band qiladi: ikki bo'lim, tanaffus va jamoalar almashinuvi (2×20 da 1 soat) */
export function venueBusyMinutes(halfMinutes: number = DEFAULT_HALF_MINUTES) {
  return 2 * halfMinutes + 20
}

/** «1 soat», «1 soat 10 daqiqa», «50 daqiqa» */
export function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} daqiqa`
  return m ? `${h} soat ${m} daqiqa` : `${h} soat`
}

/** Shu stadionda o'yin davomiyligidan kam farq bilan boshqa o'yin bo'lsa, o'sha o'yinlarni qaytaradi */
export function findVenueConflicts(candidate: Pick<Match, "id" | "venueId" | "kickoff">, matches: Match[], busyMinutes = venueBusyMinutes()): Match[] {
  const t = new Date(candidate.kickoff).getTime()
  if (!candidate.venueId || Number.isNaN(t)) return []
  return matches.filter(
    (m) =>
      m.id !== candidate.id &&
      m.timeConfirmed !== false &&
      m.venueId === candidate.venueId &&
      m.status !== "CANCELLED" &&
      m.status !== "POSTPONED" &&
      Math.abs(new Date(m.kickoff).getTime() - t) < busyMinutes * 60_000,
  )
}

/**
 * Navbatdagi o'yinlar: sanasi hali belgilanmagan o'yinlardan keyingi o'yin kuni uchun `size` tasi.
 * Tartib — guruh bosqichi turlar bo'yicha (tur ichida A, B, C… guruhlar tartibida), keyin pley-off bosqichlari.
 * Bir jamoa bir kunda ikki marta o'ynamaydi; navbatdan qolgan o'yin jamoalarining keyingi o'yinlari ham kutadi —
 * shunda har jamoa o'yinlarini turlar tartibida o'ynaydi. Sanani sayt qo'ymaydi, faqat navbatni ko'rsatadi.
 */
export function nextMatchQueue(matches: Match[], groupOrder: ID[], size: number): Match[] {
  const open = matches
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.timeConfirmed === false && (m.status === "SCHEDULED" || m.status === "POSTPONED"))
  const key = ({ m, i }: { m: Match; i: number }) =>
    m.stage === "GROUP"
      ? [0, m.round ?? 0, groupOrder.indexOf(m.groupId ?? ""), i]
      : [1, PLAYOFF_ORDER.indexOf(m.playoffRound ?? ""), 0, i]
  open.sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    for (let k = 0; k < ka.length; k++) if (ka[k] !== kb[k]) return ka[k] - kb[k]
    return 0
  })
  const picked: Match[] = []
  const taken = new Set<ID>()
  for (const { m } of open) {
    if (picked.length >= size) break
    const teams = [m.homeId, m.awayId].filter((t): t is ID => Boolean(t))
    if (teams.some((t) => taken.has(t))) {
      // Bu o'yin keyingi kunga qoladi — uning jamoalari ham bugun boshqa (keyingi tur) o'yinga chiqmaydi
      teams.forEach((t) => taken.add(t))
      continue
    }
    picked.push(m)
    teams.forEach((t) => taken.add(t))
  }
  return picked
}

/** Guruh o'yinini o'chirish mumkinmi: juftlikning shu guruhda boshqa o'yini nizomdagi sondan kam bo'lmasa (davra tizimi buzilmasin) */
export function canDeleteGroupMatch(match: Match, matches: Match[], legs: number) {
  if (match.stage !== "GROUP" || match.status === "FINISHED" || match.status === "LIVE") return false
  if (!match.groupId || !match.homeId || !match.awayId) return true
  const pair = [match.homeId, match.awayId].sort().join("|")
  const others = matches.filter((x) => x.id !== match.id && x.groupId === match.groupId && [x.homeId, x.awayId].sort().join("|") === pair).length
  return others >= legs
}

/** «15:00» + daqiqa → «16:00»; yarim tundan oshsa null */
export function addMinutesToTime(time: string, minutes: number): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return null
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes
  if (total >= 24 * 60) return null
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/** Asosiy stadion: o'yinlarda eng ko'p ishlatilgani, o'yin bo'lmasa — ro'yxatdagi birinchisi */
export function primaryVenueId(venues: { id: ID }[], matches: Pick<Match, "venueId">[]): ID | null {
  if (venues.length === 0) return null
  const usage = new Map<ID, number>()
  for (const m of matches) if (m.venueId) usage.set(m.venueId, (usage.get(m.venueId) ?? 0) + 1)
  return venues.reduce((best, v) => ((usage.get(v.id) ?? 0) > (usage.get(best.id) ?? 0) ? v : best), venues[0]).id
}
