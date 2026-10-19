import { describe, expect, it } from "vitest"
import { checkDrafts, emptyDraft, parsePlayerList } from "../player-list"

describe("futbolchilar ro‘yxatini ajratish", () => {
  it("raqam, familiya-ism va pozitsiyani taniydi", () => {
    const rows = parsePlayerList("10 Aliyev Vali\n1. Karimov Sardor darvozabon\n7) Jasur Rahimov\n  \nnurmatov bekzod hujumchi\n23 Ali")
    expect(rows.map((r) => [r.number, r.firstName, r.lastName, r.position])).toEqual([
      ["10", "Vali", "Aliyev", ""],
      ["1", "Sardor", "Karimov", "GK"],
      ["7", "Jasur", "Rahimov", ""],
      ["", "Bekzod", "Nurmatov", "FW"],
      ["23", "Ali", "", ""],
    ])
  })

  it("ikki so‘zli pozitsiyani («yarim himoyachi») ism deb o‘qimaydi", () => {
    const rows = parsePlayerList("5 Toshmatov Anvar yarim himoyachi\n8 Ergashev Jasur yarim-himoyachi")
    expect(rows.map((r) => [r.number, r.firstName, r.lastName, r.position])).toEqual([
      ["5", "Anvar", "Toshmatov", "MF"],
      ["8", "Jasur", "Ergashev", "MF"],
    ])
  })

  it("jadvaldan nusxalangan (tab yoki vergul bilan) qatorlarni ham ajratadi", () => {
    const rows = parsePlayerList("5\tToshmatov\tAnvar\n9, Qodiriy Ulug‘bek, H")
    expect(rows.map((r) => [r.number, r.firstName, r.lastName, r.position])).toEqual([
      ["5", "Anvar", "Toshmatov", ""],
      ["9", "Ulug‘bek", "Qodiriy", "DF"],
    ])
  })

  it("xatolarni qator bo‘yicha ko‘rsatadi: bo‘sh familiya, takror va band raqam", () => {
    const a = { ...emptyDraft(), number: "10", firstName: "Vali", lastName: "Aliyev" }
    const b = { ...emptyDraft(), number: "10", firstName: "Ali", lastName: "Valiyev" }
    const c = { ...emptyDraft(), number: "", firstName: "Ali", lastName: "" }
    const d = { ...emptyDraft(), number: "9", firstName: "Sardor", lastName: "Karimov" }
    const blank = emptyDraft()
    const { errors, filled } = checkDrafts([a, b, c, d, blank], [9])
    expect(filled).toHaveLength(4)
    expect(errors[a.key]).toBeUndefined()
    expect(errors[b.key]).toBe("10-raqam takrorlangan")
    expect(errors[c.key]).toBe("Familiyasini yozing")
    expect(errors[d.key]).toBe("9-raqam jamoada band")
  })
})
