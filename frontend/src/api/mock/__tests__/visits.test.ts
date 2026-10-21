import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { todayKey } from "@/lib/format"
import { mockVisitStats, recordMockVisit } from "../visits"

/** Namunaviy rejim serverdagi hisob bilan bir xil: bir odam kuniga bir marta, sahifalar har ochilganda */
describe("namunaviy rejimdagi tashrif statistikasi", () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    vi.stubGlobal("window", { location: { hostname: "oltinliga.uz" } })
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile" })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("kun, 7 kun, 30 kun va jami; sahifalar, manba va qurilma", () => {
    const a = "3f2b8c1e-6a4d-4f7b-9c2e-1d5a7b9e0c3f"
    const b = "9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d"
    recordMockVisit({ path: "/jadval", referrer: "https://t.me/oltinliga12", visitor: a })
    recordMockVisit({ path: "/oyinlar", referrer: "", visitor: a })
    recordMockVisit({ path: "/jadval", referrer: "https://oltinliga.uz/", visitor: b })

    const s = mockVisitStats((path) => (path === "/jadval" ? "Turnir jadvali" : path))
    expect(s.today).toEqual({ visitors: 2, views: 3 })
    expect(s.week).toEqual({ visitors: 2, views: 3 })
    expect(s.total).toEqual({ visitors: 2, views: 3 })
    expect(s.since).toBe(todayKey())
    expect(s.daily).toHaveLength(30)
    expect(s.daily.at(-1)).toEqual({ day: todayKey(), visitors: 2, views: 3 })
    expect(s.daily[0].views).toBe(0)
    expect(s.pages[0]).toEqual({ path: "/jadval", label: "Turnir jadvali", views: 2 })
    expect(s.sources).toEqual([
      { key: "direct", visits: 1 },
      { key: "telegram", visits: 1 },
    ])
    expect(s.devices).toEqual([{ key: "phone", visits: 2 }])
  })

  it("tashrif bo‘lmasa — nollar va bo‘sh ro‘yxatlar", () => {
    const s = mockVisitStats((p) => p)
    expect(s.total).toEqual({ visitors: 0, views: 0 })
    expect(s.since).toBeNull()
    expect(s.daily.every((d) => d.visitors === 0 && d.views === 0)).toBe(true)
    expect(s.pages).toEqual([])
  })
})
