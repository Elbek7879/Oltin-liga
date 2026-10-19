import { describe, expect, it } from "vitest"
import type { SeasonBundle } from "@/api/types"
import { played, rules } from "@/domain/__tests__/helpers"
import type { Match } from "@/domain/types"
import { seasonRoadmap } from "../season-roadmap"

const team = (id: string) => ({ id, teamId: `t-${id}`, seasonId: "s", name: id, shortName: id, primaryColor: "#000", secondaryColor: "#fff", village: "" })

function bundle(over: Partial<SeasonBundle>): SeasonBundle {
  return {
    season: { id: "s", number: 1, name: "1-mavsum", year: 2026, startDate: "2026-05-01", endDate: "2026-06-30", status: "ACTIVE", rules },
    teams: [],
    groups: [],
    matches: [],
    events: [],
    appearances: [],
    players: [],
    rosters: [],
    venues: [],
    standings: {},
    playerStats: [],
    discipline: [],
    awards: [],
    adjustments: [],
    lots: [],
    ...over,
  } as SeasonBundle
}

const state = (steps: ReturnType<typeof seasonRoadmap>) => Object.fromEntries(steps.map((s) => [s.key, s.state]))

describe("mavsum yo‘l xaritasi", () => {
  it("bo‘sh mavsumda birinchi qadam — jamoalarni qo‘shish", () => {
    const s = state(seasonRoadmap(bundle({})))
    expect(s.teams).toBe("current")
    expect(s.draw).toBe("todo")
    expect(s.bracket).toBe("todo")
  })

  it("guruh o‘yinlari davom etayotganda hozirgi qadam — natijalar; tarkib ixtiyoriy", () => {
    const teams = ["A", "B", "C", "D"].map(team)
    const matches: Match[] = [played("A", "B", 1, 0), { ...played("C", "D", 0, 0), status: "SCHEDULED", homeScore: null, awayScore: null }]
    const s = state(
      seasonRoadmap(bundle({ teams, groups: [{ id: "g", seasonId: "s", name: "A", order: 0, seasonTeamIds: ["A", "B", "C", "D"] }], matches })),
    )
    expect(s.teams).toBe("done")
    expect(s.players).toBe("todo")
    expect(s.draw).toBe("done")
    expect(s.schedule).toBe("done")
    expect(s.results).toBe("current")
  })

  it("sanasi belgilanmagan pley-off o‘yinlari diqqat talab qiladi", () => {
    const teams = ["A", "B", "C", "D"].map(team)
    const matches: Match[] = [
      played("A", "B", 1, 0),
      { ...played("C", "D", 2, 0), id: "sf", stage: "PLAYOFF", groupId: null, playoffRound: "F", status: "SCHEDULED", homeScore: null, awayScore: null, timeConfirmed: false },
    ]
    const s = state(
      seasonRoadmap(bundle({ teams, groups: [{ id: "g", seasonId: "s", name: "A", order: 0, seasonTeamIds: ["A", "B", "C", "D"] }], matches })),
    )
    expect(s.bracket).toBe("done")
    expect(s.dates).toBe("attention")
  })
})
