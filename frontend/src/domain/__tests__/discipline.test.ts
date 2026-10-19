import { describe, expect, it } from "vitest"
import { activeSuspensions, computeSuspensions, suspendedFor } from "../discipline"
import type { Match, MatchEvent } from "../types"

const match = (id: string, day: number, status: Match["status"] = "FINISHED"): Match =>
  ({ id, seasonId: "s", stage: "GROUP", groupId: "g", homeId: "A", awayId: "B", kickoff: `2026-05-${String(day).padStart(2, "0")}T16:00:00+05:00`, status, homeScore: status === "FINISHED" ? 1 : null, awayScore: status === "FINISHED" ? 0 : null }) as Match
let n = 0
const card = (matchId: string, type: MatchEvent["type"], playerId = "p1", team = "A"): MatchEvent => ({ id: `e${n++}`, matchId, type, minute: 50, playerId, seasonTeamId: team, assistId: null })

describe("diskvalifikatsiya", () => {
  it("har xil o‘yinlardagi 2 ta sariq — keyingi o‘yinni o‘tkazib yuboradi", () => {
    const ms = [match("m1", 1), match("m2", 8), match("m3", 15, "SCHEDULED")]
    const s = computeSuspensions(ms, [card("m1", "YELLOW"), card("m2", "YELLOW")])
    expect(s).toEqual([{ playerId: "p1", seasonTeamId: "A", reason: "YELLOWS", fromMatchId: "m2", banMatchId: "m3", served: false }])
    expect(suspendedFor("m3", ms, [card("m1", "YELLOW"), card("m2", "YELLOW")]).map((x) => x.playerId)).toEqual(["p1"])
  })

  it("qizil yoki ikkinchi sariq — keyingi o‘yin; o‘sha o‘yindagi birinchi sariq yig‘ilmaydi", () => {
    const ms = [match("m1", 1), match("m2", 8), match("m3", 15), match("m4", 22, "SCHEDULED")]
    const events = [card("m1", "YELLOW"), card("m2", "YELLOW"), card("m2", "SECOND_YELLOW")]
    const s = computeSuspensions(ms, events)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ reason: "RED", fromMatchId: "m2", banMatchId: "m3", served: true })
    expect(activeSuspensions(ms, events)).toEqual([])
  })

  it("jazo o‘talgach yangi sariqlar qaytadan hisoblanadi; bekor qilingan o‘yin jazo hisoblanmaydi", () => {
    const ms = [match("m1", 1), match("m2", 8), match("m3", 15), match("m4", 22, "CANCELLED"), match("m5", 29, "SCHEDULED")]
    const events = [card("m1", "YELLOW"), card("m2", "YELLOW"), card("m3", "YELLOW", "p2")]
    expect(computeSuspensions(ms, events)).toEqual([expect.objectContaining({ playerId: "p1", banMatchId: "m3", served: true })])
    const red = computeSuspensions(ms, [card("m3", "RED")])
    expect(red[0].banMatchId).toBe("m5")
  })

  it("keyingi o‘yin tur bo‘yicha aniqlanadi — sanasi hali belgilanmagan o‘yin ham", () => {
    // 1-tur 20-mayda o'ynaldi; 2-tur sanasi belgilanmagan (ichki tartib vaqti undan oldin), 3-tur 30-mayga qo'yilgan
    const ms = [
      { ...match("m1", 20), round: 1 },
      { ...match("m2", 9, "SCHEDULED"), round: 2, timeConfirmed: false },
      { ...match("m3", 30, "SCHEDULED"), round: 3 },
    ]
    expect(computeSuspensions(ms, [card("m1", "RED")])[0].banMatchId).toBe("m2")
  })
})
