import { describe, expect, it } from "vitest"
import { liveLabel, liveMinute } from "../live"

const start = "2026-10-19T10:00:00Z"
const at = (minutes: number) => Date.parse(start) + minutes * 60_000

describe("jonli daqiqa (sayt)", () => {
  it("bo‘lim boshlangan vaqtdan hisoblanadi, backend bilan bir xil", () => {
    expect(liveMinute({ livePeriod: "FIRST_HALF", periodStartedAt: start }, 25, at(33.5))).toBe(34)
    expect(liveMinute({ livePeriod: "SECOND_HALF", periodStartedAt: start }, 25, at(10))).toBe(36)
    expect(liveMinute({ livePeriod: "EXTRA_TIME", periodStartedAt: start }, 25, at(0))).toBe(51)
  })

  it("tanaffus va penaltilar so‘z bilan; soat yo‘q bo‘lsa — saqlangan daqiqa", () => {
    expect(liveLabel({ livePeriod: "HALF_TIME", periodStartedAt: start })).toBe("Tanaffus")
    expect(liveLabel({ livePeriod: "PENALTIES", periodStartedAt: start })).toBe("Penaltilar")
    expect(liveLabel({ liveMinute: 67 })).toBe("67′")
    expect(liveLabel({})).toBeNull()
  })
})
