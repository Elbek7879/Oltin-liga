import type { ID, Match, PlayoffRoundKey, SeasonRules } from "./types"

/**
 * Pley-off sxemasi. Guruhlardan chiqadiganlar soni guruh hajmiga bog'liq (masalan, 4 jamoalidan 2 ta, 5 jamoalidan 3 ta),
 * shuning uchun jami soni har doim ham 2, 4, 8, 16, 32 bo'lavermaydi. Bunday holatda:
 *  1. chiqqan jamoalar umumiy reytingga qo'yiladi: avval guruh g'oliblari, keyin ikkinchilar, keyin uchinchilar;
 *     bir xil o'rindagilar o'yin boshiga o'rtacha ochko, to'plar farqi, urilgan gol va Fair Play bo'yicha, so'ng qur'a bilan;
 *  2. eng yaxshilari asosiy setkaga to'g'ridan-to'g'ri o'tadi, qolganlari saralash o'yinida bo'sh joylar uchun o'ynaydi;
 *  3. bitta guruhdan chiqqan jamoalar imkon qadar birinchi bosqichda uchrashmaydi.
 * Backend `Bracket.java` da xuddi shu algoritm bor — o'zgartirilsa ikkalasi ham yangilanadi.
 */

export const ROUND_LABELS: Record<PlayoffRoundKey, string> = {
  R64: "1/32 final",
  R32: "1/16 final",
  R16: "1/8 final",
  QF: "Chorak final",
  SF: "Yarim final",
  THIRD: "3-o‘rin uchun o‘yin",
  F: "Final",
}

export const ROUND_SEQUENCE: PlayoffRoundKey[] = ["R64", "R32", "R16", "QF", "SF", "F"]
export const PLAY_IN_LABEL = "Saralash"
export const MAX_PLAYOFF_TEAMS = 64

const ROUND_BY_SIZE: Record<number, PlayoffRoundKey> = { 2: "F", 4: "SF", 8: "QF", 16: "R16", 32: "R32", 64: "R64" }

export function isPowerOfTwo(n: number) {
  return n >= 2 && (n & (n - 1)) === 0
}

/** n dan oshmaydigan eng katta 2 ning darajasi */
export function bracketSizeFor(n: number) {
  return n < 2 ? 0 : 2 ** Math.floor(Math.log2(n))
}

export function firstRoundFor(bracketSize: number): PlayoffRoundKey | null {
  return ROUND_BY_SIZE[bracketSize] ?? null
}

/** Shu hajmdagi guruhdan pley-offga chiqadigan jamoalar soni (guruhdagi jamoalardan kam) */
export function qualifiersFor(rules: Pick<SeasonRules, "qualifiersPerGroup" | "qualifiersBySize">, groupSize: number) {
  const q = rules.qualifiersBySize?.[groupSize] ?? rules.qualifiersPerGroup
  return Math.max(1, Math.min(q, groupSize - 1))
}

// ---------- Reja: reyting, saralash va setka ----------

/** Guruhdagi jamoaning reyting uchun kerakli ko'rsatkichlari (jadval tartibida) */
export interface TeamRecord {
  seasonTeamId: ID
  played: number
  points: number
  goalDiff: number
  goalsFor: number
  fairPlay: number
}

export interface GroupFinish {
  name: string
  table: TeamRecord[]
  qualifiers: number
}

/** Reytingdagi o'rin: 1 — eng kuchli */
export interface Seed {
  seed: number
  seasonTeamId: ID
  label: string
  groupName: string
  position: number
}

/** Asosiy setkadagi joy: jamoa to'g'ridan-to'g'ri yoki saralash o'yini g'olibi */
export interface Slot {
  label: string
  seasonTeamId: ID | null
  playInIndex: number | null
}

export interface PlayIn {
  home: Seed
  away: Seed
}

/** Bir o'rindagi jamoalar qur'asiz ajratib bo'lmagan holat */
export interface SeedTie {
  position: number
  seasonTeamIds: ID[]
}

export interface PlayoffPlan {
  seeds: Seed[]
  bracketSize: number
  playIns: PlayIn[]
  slots: Slot[]
  ties: SeedTie[]
  error?: string
}

/** a/aN va b/bN kasrlarini aniq taqqoslaydi; o'yin o'ynamagan jamoaning ko'rsatkichi 0. Musbat — a katta */
function compareRate(a: number, aN: number, b: number, bN: number) {
  if (aN === 0 && bN === 0) return 0
  if (aN === 0) return Math.sign(0 - b)
  if (bN === 0) return Math.sign(a)
  return Math.sign(a * bN - b * aN)
}

interface Entry {
  group: string
  record: TeamRecord
}

const statsCompare = (a: Entry, b: Entry) =>
  compareRate(b.record.points, b.record.played, a.record.points, a.record.played) ||
  compareRate(b.record.goalDiff, b.record.played, a.record.goalDiff, a.record.played) ||
  compareRate(b.record.goalsFor, b.record.played, a.record.goalsFor, a.record.played) ||
  // Fair Play: kamroq jarima ochkosi yaxshiroq
  compareRate(a.record.fairPlay, a.record.played, b.record.fairPlay, b.record.played)

function orderTier(tier: Entry[], lot: ID[], ties: SeedTie[], position: number): Entry[] {
  const sorted = [...tier].sort((a, b) => statsCompare(a, b) || (a.group < b.group ? -1 : a.group > b.group ? 1 : 0))
  const clusters: Entry[][] = []
  for (const e of sorted) {
    const last = clusters[clusters.length - 1]
    if (last && statsCompare(last[0], e) === 0) last.push(e)
    else clusters.push([e])
  }
  for (const cluster of clusters) {
    if (cluster.length < 2) continue
    const ids = cluster.map((e) => e.record.seasonTeamId)
    if (ids.every((id) => lot.includes(id))) cluster.sort((a, b) => lot.indexOf(a.record.seasonTeamId) - lot.indexOf(b.record.seasonTeamId))
    else ties.push({ position, seasonTeamIds: ids })
  }
  return clusters.flat()
}

/** Saralash juftligida bitta guruh jamoalari tushsa, kuchsizroq raqiblarni boshqa juftlik bilan almashtiradi */
function separateGroups(pairs: [Seed, Seed][]) {
  for (let i = 0; i < pairs.length; i++) {
    const a = pairs[i]
    if (a[0].groupName !== a[1].groupName) continue
    for (let k = 0; k < pairs.length; k++) {
      if (k === i) continue
      const b = pairs[k]
      if (a[0].groupName !== b[1].groupName && b[0].groupName !== a[1].groupName) {
        ;[a[1], b[1]] = [b[1], a[1]]
        break
      }
    }
  }
}

function groupsOf(slot: Slot, groupOf: Map<ID, string>, playIns: PlayIn[]): string[] {
  if (slot.playInIndex === null) return [groupOf.get(slot.seasonTeamId!)!]
  const p = playIns[slot.playInIndex]
  return [p.home.groupName, p.away.groupName]
}

/** To'qnashuv bahosi: aniq uchrashuv — 2, saralash g'olibi o'sha guruhdan chiqishi mumkin — 1 */
function clash(a: Slot, b: Slot, groupOf: Map<ID, string>, playIns: PlayIn[]) {
  const ga = groupsOf(a, groupOf, playIns)
  const gb = groupsOf(b, groupOf, playIns)
  if (!ga.some((g) => gb.includes(g))) return 0
  return a.playInIndex === null && b.playInIndex === null ? 2 : 1
}

/** Birinchi bosqichda bitta guruh jamoalari uchrashsa, kuchsizroq raqibni boshqa juftlikdagi bilan almashtiradi */
function separateFirstRound(slots: Slot[], seeds: Seed[], playIns: PlayIn[]) {
  const groupOf = new Map(seeds.map((s) => [s.seasonTeamId, s.groupName]))
  for (let i = 0; i < slots.length; i += 2) {
    if (clash(slots[i], slots[i + 1], groupOf, playIns) < 2) continue
    let bestK = -1
    let bestScore = clash(slots[i], slots[i + 1], groupOf, playIns)
    for (let k = 0; k < slots.length; k += 2) {
      if (k === i) continue
      const before = bestScore + clash(slots[k], slots[k + 1], groupOf, playIns)
      const after = clash(slots[i], slots[k + 1], groupOf, playIns) + clash(slots[k], slots[i + 1], groupOf, playIns)
      if (after < before && (bestK < 0 || after < bestScore)) {
        bestK = k
        bestScore = after
        if (after === 0) break
      }
    }
    if (bestK >= 0) [slots[i + 1], slots[bestK + 1]] = [slots[bestK + 1], slots[i + 1]]
  }
}

/** Klassik sxema tartibi: 8 ta uchun [1,8,4,5,2,7,3,6] */
export function bracketSeedOrder(size: number): number[] {
  let order = [1, 2]
  while (order.length < size) {
    const n = order.length * 2 + 1
    order = order.flatMap((s) => [s, n - s])
  }
  return order
}

/**
 * Pley-off rejasi: reyting, saralash juftliklari va asosiy setka joylari.
 * @param seedLots o'rin bo'yicha qur'a natijalari (o'rin → jamoalar tartibi)
 */
export function playoffPlan(groups: GroupFinish[], seedLots: Record<number, ID[]> = {}): PlayoffPlan {
  const seeds: Seed[] = []
  const ties: SeedTie[] = []
  const maxQ = Math.max(0, ...groups.map((g) => g.qualifiers))
  for (let pos = 1; pos <= maxQ; pos++) {
    const tier: Entry[] = []
    for (const g of groups) if (pos <= g.qualifiers && g.table.length >= pos) tier.push({ group: g.name, record: g.table[pos - 1] })
    for (const e of orderTier(tier, seedLots[pos] ?? [], ties, pos)) {
      seeds.push({ seed: seeds.length + 1, seasonTeamId: e.record.seasonTeamId, label: `${e.group}${pos}`, groupName: e.group, position: pos })
    }
  }
  const n = seeds.length
  if (n < 2) return { seeds, bracketSize: 0, playIns: [], slots: [], ties, error: "Pley-off uchun kamida 2 ta jamoa chiqishi kerak." }
  if (n > MAX_PLAYOFF_TEAMS) {
    return { seeds, bracketSize: 0, playIns: [], slots: [], ties, error: `Pley-offga ${n} ta jamoa chiqadi — ko‘pi bilan ${MAX_PLAYOFF_TEAMS} ta bo‘lishi mumkin.` }
  }

  const size = bracketSizeFor(n)
  const playInCount = n - size
  const direct = size - playInCount

  // Saralash: eng past reytingdagilar — (direct+j) va (n+1-j)
  const pairs: [Seed, Seed][] = []
  for (let j = 1; j <= playInCount; j++) pairs.push([seeds[direct + j - 1], seeds[n - j]])
  separateGroups(pairs)
  const playIns = pairs.map(([home, away]) => ({ home, away }))

  // Asosiy setka: klassik tartib; saralash g'olibi o'z o'rnidagi kuchliroq raqib o'rnini egallaydi
  const slots: Slot[] = bracketSeedOrder(size).map((s) =>
    s <= direct
      ? { label: seeds[s - 1].label, seasonTeamId: seeds[s - 1].seasonTeamId, playInIndex: null }
      : { label: `${PLAY_IN_LABEL} ${s - direct} g‘olibi`, seasonTeamId: null, playInIndex: s - direct - 1 },
  )
  separateFirstRound(slots, seeds, playIns)
  return { seeds, bracketSize: size, playIns, slots, ties }
}

/** Guruhdagi o'rin nomi: «A guruhi g‘olibi», «B guruhi 2-o‘rni» */
export function positionLabel(groupName: string, position: number) {
  return position === 1 ? `${groupName} guruhi g‘olibi` : `${groupName} guruhi ${position}-o‘rni`
}

/**
 * Taxminiy setka (guruh bosqichi hali tugamagan): jamoa nomlari o'rniga guruhdagi o'rinlar yoziladi —
 * Jahon chempionatidagidek «A guruhi g‘olibi — B guruhi 2-o‘rni». Haqiqiy setka faqat barcha guruh o'yinlari tugagach tuziladi.
 */
export function withPositionLabels(matches: Match[], plan: Pick<PlayoffPlan, "seeds">): Match[] {
  const label = new Map(plan.seeds.map((s) => [s.seasonTeamId, positionLabel(s.groupName, s.position)]))
  const side = (id: ID | null, fallback: string | null | undefined) => (id ? label.get(id) ?? fallback ?? null : fallback ?? null)
  return matches.map((m) => ({ ...m, homeId: null, awayId: null, homeLabel: side(m.homeId, m.homeLabel), awayLabel: side(m.awayId, m.awayLabel) }))
}

/** Jadvallar bo'yicha guruh yakunlari (pley-off rejasi uchun) */
export function groupFinishes(
  groups: { id: ID; name: string; seasonTeamIds: ID[] }[],
  standings: Record<ID, TeamRecord[]>,
  rules: Pick<SeasonRules, "qualifiersPerGroup" | "qualifiersBySize">,
): GroupFinish[] {
  return groups.map((g) => ({
    name: g.name,
    table: (standings[g.id] ?? []).map((r) => ({
      seasonTeamId: r.seasonTeamId,
      played: r.played,
      points: r.points,
      goalDiff: r.goalDiff,
      goalsFor: r.goalsFor,
      fairPlay: r.fairPlay,
    })),
    qualifiers: qualifiersFor(rules, g.seasonTeamIds.length),
  }))
}

/** Qur'a natijalaridan pley-off reytingi uchun o'rin → tartib */
export function seedLotsFrom(lots: { scope: string; order: ID[] }[]): Record<number, ID[]> {
  const result: Record<number, ID[]> = {}
  for (const l of lots) if (l.scope.startsWith("SEED:")) result[Number(l.scope.slice(5))] = l.order
  return result
}

// ---------- O'yinlarni yaratish ----------

export interface BracketOptions {
  seasonId: ID
  plan: PlayoffPlan
  thirdPlace: boolean
  /** Har bir bosqich uchun boshlanish vaqti */
  kickoffFor: (round: PlayoffRoundKey, index: number) => string
  venueId?: ID | null
  newId: () => ID
  /** Avtomatik tuzilganda false — tashkilotchi sanani tasdiqlaguncha saytda «sana belgilanmagan» */
  timeConfirmed?: boolean
}

/** Pley-off o'yinlarini yaratadi va ularni "g'olib keyingi o'yinga o'tadi" bog'lanishlari bilan ulaydi */
export function createBracket(opts: BracketOptions): Match[] {
  const { plan } = opts
  const first = firstRoundFor(plan.bracketSize)
  if (!first || plan.error) return []
  const rounds = ROUND_SEQUENCE.slice(ROUND_SEQUENCE.indexOf(first))
  const newMatch = (round: PlayoffRoundKey, i: number): Match => ({
    id: opts.newId(),
    seasonId: opts.seasonId,
    stage: "PLAYOFF",
    playoffRound: round,
    bracketIndex: i,
    homeId: null,
    awayId: null,
    kickoff: opts.kickoffFor(round, i),
    timeConfirmed: opts.timeConfirmed ?? true,
    venueId: opts.venueId ?? null,
    status: "SCHEDULED",
    homeScore: null,
    awayScore: null,
  })

  const byRound: Match[][] = rounds.map((round, r) => Array.from({ length: plan.bracketSize / 2 ** (r + 1) }, (_, i) => newMatch(round, i)))

  // Saralash o'yinlari asosiy setkadan oldingi bosqich sifatida
  const playInRound = ROUND_SEQUENCE[ROUND_SEQUENCE.indexOf(first) - 1]
  const playIns = plan.playIns.map((p, j) => ({
    ...newMatch(playInRound, j),
    homeId: p.home.seasonTeamId,
    awayId: p.away.seasonTeamId,
    homeLabel: p.home.label,
    awayLabel: p.away.label,
  }))

  byRound[0].forEach((m, i) => {
    for (const side of ["home", "away"] as const) {
      const slot = plan.slots[i * 2 + (side === "home" ? 0 : 1)]
      if (slot.playInIndex !== null) {
        playIns[slot.playInIndex].nextMatchId = m.id
        playIns[slot.playInIndex].nextSlot = side
      }
      if (side === "home") {
        m.homeId = slot.seasonTeamId
        m.homeLabel = slot.label
      } else {
        m.awayId = slot.seasonTeamId
        m.awayLabel = slot.label
      }
    }
  })

  for (let r = 0; r < byRound.length - 1; r++) {
    const label = ROUND_LABELS[rounds[r]]
    byRound[r].forEach((m, i) => {
      const next = byRound[r + 1][Math.floor(i / 2)]
      const slot = i % 2 === 0 ? "home" : "away"
      m.nextMatchId = next.id
      m.nextSlot = slot
      if (slot === "home") next.homeLabel = `${label} ${i + 1} g‘olibi`
      else next.awayLabel = `${label} ${i + 1} g‘olibi`
    })
  }

  const all = [...playIns, ...byRound.flat()]
  const semis = byRound[rounds.indexOf("SF")]
  if (opts.thirdPlace && semis && semis.length === 2) {
    const third: Match = { ...newMatch("THIRD", 0), homeLabel: "Yarim final 1 mag‘lubi", awayLabel: "Yarim final 2 mag‘lubi" }
    semis[0].loserNextMatchId = third.id
    semis[0].loserNextSlot = "home"
    semis[1].loserNextMatchId = third.id
    semis[1].loserNextSlot = "away"
    all.push(third)
  }
  return all
}

// ---------- Ko'rsatish ----------

/** Saralash bosqichi: keyingi bosqichdagi o'yinlardan ikki baravar kam bo'lmagan to'liq bo'lmagan birinchi bosqich */
export function isPlayInRound(round: PlayoffRoundKey, matches: Pick<Match, "stage" | "playoffRound">[]) {
  if (round === "THIRD" || round === "F") return false
  const next = ROUND_SEQUENCE[ROUND_SEQUENCE.indexOf(round) + 1]
  const count = (r: PlayoffRoundKey) => matches.filter((m) => m.stage === "PLAYOFF" && m.playoffRound === r).length
  return count(round) > 0 && count(round) < count(next) * 2
}

/** Bosqich nomi: saralash bosqichi «Saralash o‘yinlari» deb ko'rsatiladi */
export function roundLabel(round: PlayoffRoundKey, matches: Pick<Match, "stage" | "playoffRound">[]) {
  return isPlayInRound(round, matches) ? `${PLAY_IN_LABEL} o‘yinlari` : ROUND_LABELS[round]
}

export interface AdvanceUpdate {
  matchId: ID
  slot: "home" | "away"
  seasonTeamId: ID | null
}

/**
 * Pley-off o'yini natijasidan keyin g'olib (va yarim finalda mag'lub) keyingi o'yinga joylanadi.
 * Natija bekor qilinsa yoki o'zgarsa, keyingi o'yindagi joy ham yangilanadi.
 */
export function advancementUpdates(match: Match): AdvanceUpdate[] {
  const updates: AdvanceUpdate[] = []
  const finished = match.status === "FINISHED" && match.winnerId
  const loserId = finished ? (match.winnerId === match.homeId ? match.awayId : match.homeId) : null
  if (match.nextMatchId && match.nextSlot) {
    updates.push({ matchId: match.nextMatchId, slot: match.nextSlot, seasonTeamId: finished ? match.winnerId! : null })
  }
  if (match.loserNextMatchId && match.loserNextSlot) {
    updates.push({ matchId: match.loserNextMatchId, slot: match.loserNextSlot, seasonTeamId: loserId })
  }
  return updates
}
