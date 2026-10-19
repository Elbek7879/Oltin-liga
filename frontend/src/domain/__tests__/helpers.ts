import type { Match, SeasonRules } from "../types"

export const rules: SeasonRules = {
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakers: ["H2H_POINTS", "H2H_GOAL_DIFF", "GOAL_DIFF", "GOALS_FOR", "FAIR_PLAY"],
  legs: 1,
  qualifiersBySize: { 3: 2, 4: 2, 5: 3, 6: 3 },
  qualifiersPerGroup: 2,
  thirdPlaceMatch: true,
}

let n = 0
export function played(homeId: string, awayId: string, hs: number, as: number, day = 1): Match {
  n++
  return {
    id: `m${n}`,
    seasonId: "s",
    stage: "GROUP",
    groupId: "g",
    round: 1,
    homeId,
    awayId,
    kickoff: `2026-05-${String(day).padStart(2, "0")}T16:00:00+05:00`,
    status: "FINISHED",
    homeScore: hs,
    awayScore: as,
  }
}
