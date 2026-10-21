import { addDays } from "@/domain/schedule"
import { todayKey } from "@/lib/format"
import type { VisitCount, VisitInput, VisitStats } from "../types"

/**
 * Namunaviy rejimdagi tashrif statistikasi: shu brauzer xotirasida.
 * Hisob backenddagi VisitService bilan bir xil (kun, 7 kun, 30 kun, jami; noyob odamlar va sahifalar).
 */

const KEY = "pol-mock-visits"

interface Row {
  day: string
  visitor: string
  path: string
  source: string
  device: string
}

function rows(): Row[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Row[]
  } catch {
    return []
  }
}

function source(referrer: string) {
  if (!referrer) return "direct"
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    if (host === window.location.hostname) return "direct"
    if (host === "t.me") return "telegram"
    for (const key of ["telegram", "instagram", "google", "yandex", "youtube", "facebook"]) if (host.includes(key)) return key
    return "other"
  } catch {
    return "other"
  }
}

export function recordMockVisit(input: VisitInput) {
  const day = todayKey()
  const all = rows()
  const first = all.find((r) => r.day === day && r.visitor === input.visitor)
  all.push({
    day,
    visitor: input.visitor,
    path: input.path,
    source: first ? first.source : source(input.referrer),
    device: /mobi|android|iphone|ipad/i.test(navigator.userAgent) ? "phone" : "desktop",
  })
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // Brauzer xotirasi to'la yoki yopiq — namunaviy rejimda muhim emas
  }
}

function count(list: Row[]): VisitCount {
  return { visitors: new Set(list.map((r) => r.visitor)).size, views: list.length }
}

/** Kunlik tashriflar (bir odam bir kunda — bitta) bo'yicha ulush */
function shares(list: Row[], field: "source" | "device") {
  const firstOfDay = new Map<string, Row>()
  for (const r of list) if (!firstOfDay.has(`${r.day}|${r.visitor}`)) firstOfDay.set(`${r.day}|${r.visitor}`, r)
  const totals = new Map<string, number>()
  for (const r of firstOfDay.values()) totals.set(r[field], (totals.get(r[field]) ?? 0) + 1)
  return [...totals].map(([key, visits]) => ({ key, visits })).sort((a, b) => b.visits - a.visits || a.key.localeCompare(b.key))
}

export function mockVisitStats(label: (path: string) => string): VisitStats {
  const all = rows()
  const today = todayKey()
  const from = (days: number) => addDays(today, -(days - 1))
  const within = (days: number) => all.filter((r) => r.day >= from(days) && r.day <= today)
  const month = within(30)
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(from(30), i)
    return { day, ...count(month.filter((r) => r.day === day)) }
  })
  const views = new Map<string, number>()
  for (const r of month) views.set(r.path, (views.get(r.path) ?? 0) + 1)
  const pages = [...views]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([path, n]) => ({ path, label: label(path), views: n }))
  return {
    today: count(within(1)),
    week: count(within(7)),
    month: count(month),
    total: count(all),
    since: all.length ? all.map((r) => r.day).sort()[0] : null,
    daily,
    pages,
    sources: shares(month, "source"),
    devices: shares(month, "device"),
  }
}
