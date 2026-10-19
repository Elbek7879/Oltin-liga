import type { DecidedBy, EventType, ID, Match, MatchStatus } from "./types"

export interface ResultEventInput {
  type: EventType
  seasonTeamId: ID
  playerId?: ID | null
  assistId?: ID | null
  minute?: number | null
}

export interface ResultInput {
  status: MatchStatus
  homeScore: number | null
  awayScore: number | null
  homeExtra?: number | null
  awayExtra?: number | null
  homePens?: number | null
  awayPens?: number | null
  /** Texnik mag'lubiyat berilgan jamoa tomoni */
  forfeitLoser?: "home" | "away" | null
  liveMinute?: number | null
  events: ResultEventInput[]
  appearances?: { seasonTeamId: ID; playerId: ID }[]
}

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

export const FORFEIT_SCORE = 3

const isGoal = (t: EventType) => t === "GOAL" || t === "PENALTY_GOAL"

export function goalsFromEvents(events: ResultEventInput[], homeId: ID, awayId: ID) {
  let home = 0
  let away = 0
  for (const e of events) {
    if (isGoal(e.type)) {
      if (e.seasonTeamId === homeId) home++
      else if (e.seasonTeamId === awayId) away++
    } else if (e.type === "OWN_GOAL") {
      if (e.seasonTeamId === homeId) away++
      else if (e.seasonTeamId === awayId) home++
    }
  }
  return { home, away }
}

function validScore(v: number | null | undefined) {
  return v != null && Number.isInteger(v) && v >= 0 && v <= 50
}

/**
 * Natijani saqlashdan oldin tekshiradi: hisob, gol mualliflari, holat va
 * pley-off qoidalari bir-biriga mos bo'lishi shart.
 */
export function validateResult(
  match: Pick<Match, "stage" | "homeId" | "awayId">,
  input: ResultInput,
  rosterOf: (seasonTeamId: ID) => Set<ID>,
  teamName: (seasonTeamId: ID) => string,
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { homeId, awayId } = match

  if (!homeId || !awayId) {
    errors.push("O‘yin jamoalari hali aniqlanmagan. Avval ikkala jamoani belgilang.")
    return { errors, warnings }
  }

  const playable = input.status === "LIVE" || input.status === "FINISHED"
  if (!playable) {
    if (input.events.length > 0 || input.homeScore != null || input.awayScore != null) {
      errors.push("Bu holatdagi o‘yinga hisob, gol yoki kartochka kiritib bo‘lmaydi. Holatni «Davom etmoqda» yoki «Yakunlangan» qiling.")
    }
    return { errors, warnings }
  }

  if (input.forfeitLoser) {
    if (input.status !== "FINISHED") errors.push("Texnik mag‘lubiyat faqat yakunlangan o‘yinga beriladi.")
    return { errors, warnings }
  }

  if (!validScore(input.homeScore) || !validScore(input.awayScore)) {
    errors.push("Ikkala jamoa uchun hisobni 0 dan 50 gacha butun son bilan kiriting.")
    return { errors, warnings }
  }

  const isPlayoff = match.stage === "PLAYOFF"
  const hasExtra = input.homeExtra != null || input.awayExtra != null
  const hasPens = input.homePens != null || input.awayPens != null

  if (!isPlayoff && (hasExtra || hasPens)) {
    errors.push("Guruh bosqichida qo‘shimcha vaqt va penaltilar bo‘lmaydi.")
  }

  const homeTotal = input.homeScore! + (input.homeExtra ?? 0)
  const awayTotal = input.awayScore! + (input.awayExtra ?? 0)

  if (isPlayoff && input.status === "FINISHED") {
    if (input.homeScore === input.awayScore) {
      if (!hasExtra) {
        errors.push("Pley-off o‘yini durang tugadi. Qo‘shimcha vaqt natijasini kiriting (gol bo‘lmasa 0 : 0).")
      } else if (!validScore(input.homeExtra) || !validScore(input.awayExtra)) {
        errors.push("Qo‘shimcha vaqt gollarini ikkala jamoa uchun kiriting.")
      } else if (homeTotal === awayTotal) {
        if (!hasPens || !validScore(input.homePens) || !validScore(input.awayPens)) {
          errors.push("Qo‘shimcha vaqtdan keyin ham durang. Penaltilar seriyasi natijasini kiriting.")
        } else if (input.homePens === input.awayPens) {
          errors.push("Penaltilar seriyasida g‘olib bo‘lishi kerak — hisob teng bo‘lmasin.")
        }
      } else if (hasPens) {
        errors.push("Qo‘shimcha vaqtda g‘olib aniqlangan, penaltilar kerak emas.")
      }
    } else if (hasExtra || hasPens) {
      errors.push("Asosiy vaqtda g‘olib aniqlangan. Qo‘shimcha vaqt va penaltilarni bo‘sh qoldiring.")
    }
  }

  const fromEvents = goalsFromEvents(input.events, homeId, awayId)
  if (fromEvents.home !== homeTotal) {
    errors.push(
      `${teamName(homeId)}: hisobda ${homeTotal} ta gol, kiritilgan gollar esa ${fromEvents.home} ta. Gol mualliflarini tekshiring.`,
    )
  }
  if (fromEvents.away !== awayTotal) {
    errors.push(
      `${teamName(awayId)}: hisobda ${awayTotal} ta gol, kiritilgan gollar esa ${fromEvents.away} ta. Gol mualliflarini tekshiring.`,
    )
  }

  const redCount = new Map<ID, number>()
  const yellowCount = new Map<ID, number>()
  let unknownScorers = 0

  for (const e of input.events) {
    if (e.seasonTeamId !== homeId && e.seasonTeamId !== awayId) {
      errors.push("Hodisa ushbu o‘yinda qatnashmayotgan jamoaga biriktirilgan.")
      continue
    }
    const roster = rosterOf(e.seasonTeamId)
    if (e.playerId && !roster.has(e.playerId)) {
      errors.push(`Tanlangan futbolchi ${teamName(e.seasonTeamId)} tarkibida yo‘q.`)
    }
    if (!e.playerId) {
      if (isGoal(e.type) || e.type === "OWN_GOAL") unknownScorers++
      else errors.push("Kartochka uchun futbolchini tanlang.")
    }
    if (e.assistId) {
      if (!roster.has(e.assistId)) errors.push("Assist bergan futbolchi gol urgan jamoa tarkibida bo‘lishi kerak.")
      if (e.assistId === e.playerId) errors.push("Futbolchi o‘z goliga assist bera olmaydi.")
    }
    if (e.minute != null && (!Number.isInteger(e.minute) || e.minute < 1 || e.minute > 130)) {
      errors.push("Daqiqa 1 dan 130 gacha bo‘lishi kerak.")
    }
    if (e.playerId && (e.type === "RED" || e.type === "SECOND_YELLOW")) {
      redCount.set(e.playerId, (redCount.get(e.playerId) ?? 0) + 1)
    }
    if (e.playerId && e.type === "YELLOW") {
      yellowCount.set(e.playerId, (yellowCount.get(e.playerId) ?? 0) + 1)
    }
  }

  for (const [, count] of redCount) {
    if (count > 1) {
      errors.push("Bitta futbolchiga bir o‘yinda bittadan ortiq qizil kartochka berib bo‘lmaydi.")
      break
    }
  }
  for (const [, count] of yellowCount) {
    if (count > 1) {
      errors.push("Ikkinchi sariq kartochka uchun «Ikkinchi sariq» turini tanlang.")
      break
    }
  }

  if (unknownScorers > 0) {
    warnings.push(`${unknownScorers} ta gol muallifi ko‘rsatilmagan. Ular to‘purarlar reytingiga kirmaydi.`)
  }

  return { errors: [...new Set(errors)], warnings }
}

export interface Outcome {
  homeScore: number | null
  awayScore: number | null
  decidedBy: DecidedBy | null
  winnerId: ID | null
}

/** Saqlanadigan yakuniy natijani aniqlaydi (g'olib, qanday hal bo'lgani) */
export function deriveOutcome(match: Pick<Match, "homeId" | "awayId" | "stage">, input: ResultInput): Outcome {
  const { homeId, awayId } = match
  if (input.status !== "FINISHED" || !homeId || !awayId) {
    return {
      homeScore: input.status === "LIVE" ? input.homeScore : null,
      awayScore: input.status === "LIVE" ? input.awayScore : null,
      decidedBy: null,
      winnerId: null,
    }
  }
  if (input.forfeitLoser) {
    const homeLost = input.forfeitLoser === "home"
    return {
      homeScore: homeLost ? 0 : FORFEIT_SCORE,
      awayScore: homeLost ? FORFEIT_SCORE : 0,
      decidedBy: "FORFEIT",
      winnerId: homeLost ? awayId : homeId,
    }
  }
  const hs = input.homeScore ?? 0
  const as = input.awayScore ?? 0
  if (hs !== as) return { homeScore: hs, awayScore: as, decidedBy: "REGULAR", winnerId: hs > as ? homeId : awayId }
  if (match.stage !== "PLAYOFF") return { homeScore: hs, awayScore: as, decidedBy: "REGULAR", winnerId: null }
  const he = hs + (input.homeExtra ?? 0)
  const ae = as + (input.awayExtra ?? 0)
  if (he !== ae) return { homeScore: hs, awayScore: as, decidedBy: "EXTRA_TIME", winnerId: he > ae ? homeId : awayId }
  const hp = input.homePens ?? 0
  const ap = input.awayPens ?? 0
  return { homeScore: hs, awayScore: as, decidedBy: "PENALTIES", winnerId: hp > ap ? homeId : awayId }
}
