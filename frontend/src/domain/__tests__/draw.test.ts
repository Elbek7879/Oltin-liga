import { describe, expect, it } from "vitest"
import { checkDraw, constrainedDraw, describeSizes, groupOptions, potDraw, seededRandom, splitIntoPots } from "../draw"

const q = (size: number) => (size === 5 ? 3 : 2)
const teams = (n: number) => Array.from({ length: n }, (_, i) => `T${i}`)

describe("guruh variantlari (4 va 5 jamoali)", () => {
  it.each([
    [20, [4, 5], 5],
    [36, [8, 9], 9],
    [40, [8, 9, 10], 10],
    [32, [7, 8], 8],
  ])("%i jamoa: variantlar %j, tavsiya — %i guruh (saralash eng kam)", (n, groups, recommended) => {
    const options = groupOptions(n, q)
    expect(options.map((o) => o.groups)).toEqual(groups)
    expect(options.every((o) => o.sizes.every((s) => s === 4 || s === 5))).toBe(true)
    expect(options.find((o) => o.recommended)?.groups).toBe(recommended)
  })

  it("36 jamoa, 8 guruh: 20 jamoa chiqadi, 4 saralash o‘yini", () => {
    const o = groupOptions(36, q).find((x) => x.groups === 8)!
    expect(o).toMatchObject({ qualified: 20, bracketSize: 16, playIns: 4 })
    expect(describeSizes(o.sizes)).toBe("8 ta guruh: 4 tasi 5 jamoali, 4 tasi 4 jamoali")
  })

  it("4 yoki 5 ga bo‘linmaydigan son uchun ham variant beradi", () => {
    expect(groupOptions(11, q).length).toBeGreaterThan(0)
  })
})

describe("savatlar va qishloqlar", () => {
  it("har guruhga har savatdan bittadan jamoa tushadi", () => {
    const all = teams(36)
    const pots = splitIntoPots(all, 8)
    expect(pots.map((p) => p.length)).toEqual([8, 8, 8, 8, 4])
    const { groups } = potDraw(pots, 8, undefined, seededRandom(3))
    expect(checkDraw(groups, all).ok).toBe(true)
    for (const g of groups) {
      for (const pot of pots.slice(0, 4)) expect(g.teamIds.filter((id) => pot.includes(id))).toHaveLength(1)
    }
    expect(groups.map((g) => g.teamIds.length).sort()).toEqual([4, 4, 4, 4, 5, 5, 5, 5])
  })

  it("bir qishloq jamoalari iloji bo‘lsa alohida guruhlarga tushadi", () => {
    const all = teams(16)
    const village = (id: string) => Number(id.slice(1)) % 4 // 4 ta qishloq, har birida 4 jamoa
    const { groups, conflicts } = constrainedDraw(all, 4, (a, b) => village(a) === village(b), seededRandom(5))
    expect(conflicts).toBe(0)
    for (const g of groups) expect(new Set(g.teamIds.map(village)).size).toBe(g.teamIds.length)
  })
})
