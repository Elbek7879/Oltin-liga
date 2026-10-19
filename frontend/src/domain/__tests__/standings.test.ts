import { describe, expect, it } from "vitest"
import { computeStandings } from "../standings"
import { played, rules } from "./helpers"

describe("computeStandings", () => {
  it("ochkolarni 3/1/0 qoidasi bo‘yicha hisoblaydi va tartiblaydi", () => {
    const matches = [played("A", "B", 3, 1), played("C", "D", 0, 0), played("A", "C", 2, 2), played("B", "D", 1, 0)]
    const table = computeStandings({ teamIds: ["A", "B", "C", "D"], matches, rules })
    expect(table.map((r) => [r.seasonTeamId, r.points])).toEqual([
      ["A", 4],
      ["B", 3],
      ["C", 2],
      ["D", 1],
    ])
    const a = table[0]
    expect(a).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 3, goalDiff: 2 })
  })

  it("yakunlanmagan o‘yinlarni hisobga olmaydi", () => {
    const live = { ...played("A", "B", 5, 0), status: "LIVE" as const }
    const scheduled = { ...played("A", "B", 0, 0), status: "SCHEDULED" as const, homeScore: null, awayScore: null }
    const table = computeStandings({ teamIds: ["A", "B"], matches: [live, scheduled], rules })
    expect(table.every((r) => r.played === 0 && r.points === 0)).toBe(true)
  })

  it("natija tahrirlansa jadval to‘liq qayta hisoblanadi — o‘yin ikki marta hisobga olinmaydi", () => {
    const m = played("A", "B", 2, 0)
    const before = computeStandings({ teamIds: ["A", "B"], matches: [m], rules })
    expect(before[0]).toMatchObject({ seasonTeamId: "A", points: 3, played: 1 })
    const edited = { ...m, homeScore: 0, awayScore: 1 }
    const after = computeStandings({ teamIds: ["A", "B"], matches: [edited], rules })
    expect(after[0]).toMatchObject({ seasonTeamId: "B", points: 3, played: 1 })
    expect(after[1]).toMatchObject({ seasonTeamId: "A", points: 0, played: 1, goalsFor: 0, goalsAgainst: 1 })
  })

  it("teng ochkoda o‘zaro o‘yin natijasi to‘plar farqidan ustun turadi", () => {
    // A va B 6 ochkodan; B umumiy to'plar farqi yaxshiroq, lekin o'zaro o'yinda A yutgan
    const matches = [played("A", "B", 1, 0), played("B", "C", 5, 0), played("B", "D", 5, 0), played("A", "C", 1, 0), played("C", "A", 1, 0), played("D", "A", 0, 0)]
    const table = computeStandings({ teamIds: ["A", "B", "C", "D"], matches, rules: { ...rules } })
    const a = table.find((r) => r.seasonTeamId === "A")!
    const b = table.find((r) => r.seasonTeamId === "B")!
    expect(a.points).toBe(7)
    expect(b.points).toBe(6)
    const tied = computeStandings({
      teamIds: ["A", "B", "C"],
      matches: [played("A", "B", 1, 0), played("B", "C", 4, 0), played("C", "A", 1, 0)],
      rules,
    })
    // Uchala jamoa 3 ochkodan va o‘zaro ochkolar ham teng — o‘zaro to‘plar farqi hal qiladi: B +3, A 0, C -3
    expect(tied.map((r) => r.seasonTeamId)).toEqual(["B", "A", "C"])
  })

  it("ikki jamoa teng bo‘lsa o‘zaro o‘yin g‘olibi yuqorida", () => {
    const matches = [played("X", "Y", 2, 1), played("Y", "Z", 6, 0), played("X", "Z", 0, 1), played("Z", "W", 0, 0), played("Y", "W", 1, 0), played("X", "W", 1, 0)]
    const table = computeStandings({ teamIds: ["X", "Y", "Z", "W"], matches, rules })
    const x = table.findIndex((r) => r.seasonTeamId === "X")
    const y = table.findIndex((r) => r.seasonTeamId === "Y")
    expect(table[x].points).toBe(table[y].points)
    expect(table[y].goalDiff).toBeGreaterThan(table[x].goalDiff)
    expect(x).toBeLessThan(y)
  })

  it("jarima ochkolarini qo‘shadi va sababi bilan saqlaydi", () => {
    const table = computeStandings({
      teamIds: ["A", "B"],
      matches: [played("A", "B", 1, 0)],
      adjustments: [{ id: "x", seasonId: "s", seasonTeamId: "A", points: -3, reason: "Intizom", createdAt: "" }],
      rules,
    })
    const a = table.find((r) => r.seasonTeamId === "A")!
    expect(a.points).toBe(0)
    expect(a.adjustment).toBe(-3)
  })

  it("oxirgi o‘yinlar shaklini to‘g‘ri tartibda beradi", () => {
    const matches = [played("A", "B", 1, 0, 1), played("A", "C", 0, 0, 2), played("D", "A", 2, 0, 3)]
    const a = computeStandings({ teamIds: ["A", "B", "C", "D"], matches, rules }).find((r) => r.seasonTeamId === "A")!
    expect(a.form).toEqual(["W", "D", "L"])
  })
})
