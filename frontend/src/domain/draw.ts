import type { ID } from "./types"

export const GROUP_LETTERS = "ABCDEFGHIJKLMNOP".split("")

/** Guruhlar hajmi imkon qadar teng: farq ko'pi bilan 1 ta jamoa */
export function groupSizes(teamCount: number, groupCount: number): number[] {
  if (groupCount <= 0) return []
  const base = Math.floor(teamCount / groupCount)
  const extra = teamCount % groupCount
  return Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0))
}

/** Jamoalar soniga qarab tavsiya etiladigan guruhlar soni (4–5 jamoali guruhlar) */
export function suggestGroupCounts(teamCount: number): number[] {
  const options: number[] = []
  for (let g = 1; g <= Math.min(16, teamCount); g++) {
    const sizes = groupSizes(teamCount, g)
    const min = Math.min(...sizes)
    const max = Math.max(...sizes)
    if (min >= 3 && max <= 6) options.push(g)
  }
  return options.length > 0 ? options : [Math.max(1, Math.round(teamCount / 4))]
}

export function preferredGroupCount(teamCount: number): number {
  const options = suggestGroupCounts(teamCount)
  return options.reduce((best, g) => {
    const avg = teamCount / g
    const bestAvg = teamCount / best
    return Math.abs(avg - 4) < Math.abs(bestAvg - 4) ? g : best
  }, options[0])
}

/** Takrorlanadigan tasodifiy sonlar generatori (sinov va namunaviy ma'lumot uchun) */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface DrawGroup {
  name: string
  teamIds: ID[]
}

/**
 * Tasodifiy qur'a: jamoalar aralashtiriladi va navbat bilan guruhlarga taqsimlanadi.
 * Natijada guruhlar hajmi farqi ko'pi bilan 1, har bir jamoa faqat bitta guruhda bo'ladi.
 */
export function randomDraw(teamIds: ID[], groupCount: number, random: () => number = Math.random): DrawGroup[] {
  const unique = [...new Set(teamIds)]
  const sizes = groupSizes(unique.length, groupCount)
  const shuffled = shuffle(unique, random)
  const groups: DrawGroup[] = sizes.map((_, i) => ({ name: GROUP_LETTERS[i], teamIds: [] }))
  let index = 0
  for (let round = 0; index < shuffled.length; round++) {
    for (let g = 0; g < groupCount && index < shuffled.length; g++) {
      if (groups[g].teamIds.length < sizes[g]) groups[g].teamIds.push(shuffled[index++])
    }
  }
  return groups
}

export interface DrawCheck {
  ok: boolean
  errors: string[]
  warnings: string[]
}

/** Qo'lda yoki tasodifiy tuzilgan guruhlarni tasdiqlashdan oldin tekshiradi */
export function checkDraw(groups: DrawGroup[], allTeamIds: ID[]): DrawCheck {
  const errors: string[] = []
  const warnings: string[] = []
  const seen = new Map<ID, string>()
  for (const g of groups) {
    for (const id of g.teamIds) {
      if (seen.has(id)) errors.push(`Bitta jamoa ikki guruhga tushgan (${seen.get(id)} va ${g.name}).`)
      seen.set(id, g.name)
    }
  }
  const missing = allTeamIds.filter((id) => !seen.has(id))
  if (missing.length > 0) errors.push(`${missing.length} ta jamoa hali guruhga taqsimlanmagan.`)
  const sizes = groups.map((g) => g.teamIds.length)
  if (sizes.some((s) => s < 2)) errors.push("Har bir guruhda kamida 2 ta jamoa bo‘lishi kerak.")
  if (sizes.length > 0 && Math.max(...sizes) - Math.min(...sizes) > 1) {
    warnings.push("Guruhlardagi jamoalar soni bir-biridan 1 tadan ko‘proq farq qiladi.")
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings }
}

// ---------- Guruh variantlari (4 va 5 jamoali) ----------

export interface GroupOption {
  groups: number
  sizes: number[]
  /** Pley-offga chiqadiganlar soni (nizom bo'yicha) */
  qualified: number
  bracketSize: number
  playIns: number
  recommended: boolean
}

/**
 * Jamoalar soniga mos guruh variantlari. Iloji bo'lsa barcha guruhlar 4 yoki 5 jamoali bo'ladi.
 * Tavsiya: saralash o'yinlari eng kam bo'lgan, so'ng guruhlari kichikroq variant.
 */
export function groupOptions(teamCount: number, qualifiersFor: (size: number) => number): GroupOption[] {
  let counts: number[] = []
  for (let g = 1; g <= 16; g++) if (4 * g <= teamCount && teamCount <= 5 * g) counts.push(g)
  if (counts.length === 0) counts = suggestGroupCounts(teamCount)
  const options = counts.map((g) => {
    const sizes = groupSizes(teamCount, g)
    const qualified = sizes.reduce((sum, s) => sum + Math.max(1, Math.min(qualifiersFor(s), s - 1)), 0)
    const bracketSize = qualified < 2 ? 0 : 2 ** Math.floor(Math.log2(qualified))
    return { groups: g, sizes, qualified, bracketSize, playIns: qualified - bracketSize, recommended: false }
  })
  const best = [...options].sort((a, b) => a.playIns - b.playIns || b.groups - a.groups)[0]
  if (best) best.recommended = true
  return options
}

/** «8 guruh: 4 tasi 5 jamoali, 4 tasi 4 jamoali» */
export function describeSizes(sizes: number[]) {
  const counts = new Map<number, number>()
  for (const s of sizes) counts.set(s, (counts.get(s) ?? 0) + 1)
  const parts = [...counts.entries()].sort((a, b) => b[0] - a[0])
  if (parts.length === 1) return `${sizes.length} ta guruh, har birida ${parts[0][0]} jamoa`
  return `${sizes.length} ta guruh: ${parts.map(([size, n]) => `${n} tasi ${size} jamoali`).join(", ")}`
}

// ---------- Savatlar va cheklovlar ----------

/** Guruhda bir-biri bilan tushmasligi kerak bo'lgan jamoalar (masalan, bir qishloq) */
export type AvoidRule = (a: ID, b: ID) => boolean

function conflicts(groups: DrawGroup[], avoid?: AvoidRule) {
  if (!avoid) return 0
  let n = 0
  for (const g of groups) for (let i = 0; i < g.teamIds.length; i++) for (let j = i + 1; j < g.teamIds.length; j++) if (avoid(g.teamIds[i], g.teamIds[j])) n++
  return n
}

/** Bir necha urinishdan eng kam to'qnashuvli qur'ani tanlaydi */
function bestOf(attempt: () => DrawGroup[], avoid?: AvoidRule, tries = 300): { groups: DrawGroup[]; conflicts: number } {
  let best = attempt()
  let bestConflicts = conflicts(best, avoid)
  for (let i = 1; i < tries && bestConflicts > 0; i++) {
    const candidate = attempt()
    const c = conflicts(candidate, avoid)
    if (c < bestConflicts) {
      best = candidate
      bestConflicts = c
    }
  }
  return { groups: best, conflicts: bestConflicts }
}

/**
 * Jamoani to'qnashuvi eng kam bo'lgan bo'sh guruhga joylaydi (teng bo'lsa — tasodifiy).
 * capacity — guruhning qolgan sig'imi.
 */
function placeGreedy(id: ID, groups: DrawGroup[], capacity: number[], avoid: AvoidRule | undefined, random: () => number) {
  const open = groups.map((_, i) => i).filter((i) => capacity[i] > 0)
  const score = (i: number) => (avoid ? groups[i].teamIds.filter((other) => avoid(id, other)).length : 0)
  const min = Math.min(...open.map(score))
  const choices = open.filter((i) => score(i) === min)
  const pick = choices[Math.floor(random() * choices.length)]
  groups[pick].teamIds.push(id)
  capacity[pick]--
}

/** Tasodifiy qur'a, iloji bo'lsa cheklov (masalan, bir qishloq jamoalari alohida) bilan */
export function constrainedDraw(teamIds: ID[], groupCount: number, avoid?: AvoidRule, random: () => number = Math.random) {
  if (!avoid) return { groups: randomDraw(teamIds, groupCount, random), conflicts: 0 }
  const unique = [...new Set(teamIds)]
  // Cheklovi ko'p jamoalar (masalan, katta qishloqlar) birinchi joylanadi
  const pressure = (id: ID) => unique.filter((o) => o !== id && avoid(id, o)).length
  return bestOf(() => {
    const groups: DrawGroup[] = groupSizes(unique.length, groupCount).map((_, i) => ({ name: GROUP_LETTERS[i], teamIds: [] }))
    const capacity = shuffle(groupSizes(unique.length, groupCount), random)
    const order = shuffle(unique, random).sort((a, b) => pressure(b) - pressure(a))
    for (const id of order) placeGreedy(id, groups, capacity, avoid, random)
    return groups
  }, avoid, 60)
}

/**
 * Savatlar bo'yicha qur'a (jahon chempionatidagidek): har guruhga har savatdan bittadan jamoa tushadi,
 * shuning uchun kuchli jamoalar bir guruhda to'planmaydi. Savatlar kuchdan kuchsizga tartiblangan.
 */
export function potDraw(pots: ID[][], groupCount: number, avoid?: AvoidRule, random: () => number = Math.random) {
  const attempt = () => {
    const groups: DrawGroup[] = Array.from({ length: groupCount }, (_, i) => ({ name: GROUP_LETTERS[i], teamIds: [] }))
    for (const pot of pots) {
      // Kam jamoali guruhlar birinchi to'ldiriladi — hajmlar farqi ko'pi bilan 1
      // Har guruhga savatdan ko'pi bilan bittadan; kam jamoali guruhlar birinchi, to'qnashuvlar eng kam
      const minSize = Math.min(...groups.map((g) => g.teamIds.length))
      const capacity: number[] = groups.map((g) => (g.teamIds.length === minSize ? 1 : 0))
      if (capacity.reduce((a, b) => a + b, 0) < pot.length) capacity.fill(1)
      for (const id of shuffle(pot, random)) placeGreedy(id, groups, capacity, avoid, random)
    }
    return groups
  }
  return bestOf(attempt, avoid)
}

/** Jamoalarni kuch tartibida savatlarga bo'ladi: har savatda guruhlar soniga teng jamoa */
export function splitIntoPots(orderedTeamIds: ID[], groupCount: number): ID[][] {
  const pots: ID[][] = []
  for (let i = 0; i < orderedTeamIds.length; i += groupCount) pots.push(orderedTeamIds.slice(i, i + groupCount))
  return pots
}
