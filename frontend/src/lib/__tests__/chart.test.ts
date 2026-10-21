import { describe, expect, it } from "vitest"
import { niceMax } from "../chart"

describe("grafik o‘qining eng katta qiymati", () => {
  it("toza va juft son (o‘rtadagi chiziq ham butun son)", () => {
    expect(niceMax(0)).toBe(4)
    expect(niceMax(3)).toBe(4)
    expect(niceMax(5)).toBe(6)
    expect(niceMax(7)).toBe(8)
    expect(niceMax(9)).toBe(10)
    expect(niceMax(23)).toBe(30)
    expect(niceMax(140)).toBe(200)
    expect(niceMax(1000)).toBe(1000)
    expect(niceMax(1001)).toBe(2000)
    for (let n = 1; n <= 5000; n += 7) {
      const max = niceMax(n)
      expect(max).toBeGreaterThanOrEqual(n)
      expect(max % 2).toBe(0)
    }
  })
})
