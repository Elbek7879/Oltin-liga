import type { SeasonRules } from "@/domain/types"

/** Yangi mavsum uchun standart liga nizomi */
export function defaultSeasonRules(): SeasonRules {
  return {
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
    tiebreakers: ["H2H_POINTS", "H2H_GOAL_DIFF", "GOAL_DIFF", "GOALS_FOR", "FAIR_PLAY"],
    legs: 1,
    qualifiersPerGroup: 2,
    // 4 jamoali guruhdan 2 ta, 5 jamoalidan 3 ta (3 va 6 jamoali guruhlar kamdan-kam)
    qualifiersBySize: { 3: 2, 4: 2, 5: 3, 6: 3 },
    halfMinutes: 25,
    thirdPlaceMatch: true,
  }
}
