import type { TeamView } from "@/api/types"
import type { Match, MatchEvent } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { dateWords, formatDate, formatTime, localDateKey, slugify } from "./format"
import { liveLabel } from "./live"
import { scoreNote, sideName, stageLabel, totalScore, winnerSide } from "./match"
import { toCyrillic } from "./translit"

/**
 * Telegram kanali va ijtimoiy tarmoqlar uchun o'yin rasmi (1080×1350 PNG).
 * Kutilayotgan o'yin — anons, jonli o'yin — joriy hisob, yakunlangan o'yin — natija.
 * Rasm brauzerning o'zida chiziladi, hech qayerga yuborilmaydi.
 */

export type MatchImageKind = "result" | "live" | "preview"

export interface MatchImageSide {
  name: string
  team: Pick<TeamView, "shortName" | "primaryColor" | "secondaryColor" | "logoUrl"> | null
  scorers: string[]
  reds: string[]
  dimmed: boolean
}

export interface MatchImageData {
  kind: MatchImageKind
  badge: string
  season: string
  stage: string
  home: MatchImageSide
  away: MatchImageSide
  score: { home: number; away: number } | null
  note: string | null
  time: string | null
  date: string | null
  /** Chipta uchun sana qismlari; sana hali belgilanmagan bo'lsa null */
  when: { weekday: string; day: number; month: string; year: number } | null
  venue: string | null
  /** Rasm ostidagi sayt manzili — faqat haqiqiy domen, aks holda bo'sh */
  site: string
}

const GOAL_TYPES = new Set<MatchEvent["type"]>(["GOAL", "PENALTY_GOAL", "OWN_GOAL"])

/** Gol urganlar: bir o'yinchining gollari bitta qatorga yig'iladi — «Zafar Ochilov 23′, 67′ (p)» */
export function scorerLines(match: Match, events: MatchEvent[], index: Pick<SeasonIndex, "player">) {
  const lines = { home: new Map<string, { name: string; marks: string[] }>(), away: new Map<string, { name: string; marks: string[] }>() }
  for (const e of events) {
    if (!GOAL_TYPES.has(e.type)) continue
    const own = e.type === "OWN_GOAL"
    const forHome = own ? e.seasonTeamId !== match.homeId : e.seasonTeamId === match.homeId
    const side = forHome ? lines.home : lines.away
    const p = index.player(e.playerId)
    const key = `${e.playerId ?? "unknown"}:${own ? "own" : "goal"}`
    const row = side.get(key) ?? { name: p ? `${p.firstName} ${p.lastName}` : "Muallif noma’lum", marks: [] }
    const suffix = e.type === "PENALTY_GOAL" ? " (p)" : own ? " (a.g.)" : ""
    row.marks.push(`${e.minute ? `${e.minute}′` : ""}${suffix}`.trim())
    side.set(key, row)
  }
  const join = (m: Map<string, { name: string; marks: string[] }>) =>
    [...m.values()].map((r) => [r.name, r.marks.filter(Boolean).join(", ")].filter(Boolean).join(" "))
  return { home: join(lines.home), away: join(lines.away) }
}

function redLines(match: Match, events: MatchEvent[], index: Pick<SeasonIndex, "player">) {
  const out = { home: [] as string[], away: [] as string[] }
  for (const e of events) {
    if (e.type !== "RED" && e.type !== "SECOND_YELLOW") continue
    const p = index.player(e.playerId)
    if (!p) continue
    const label = `${p.firstName} ${p.lastName}${e.minute ? ` ${e.minute}′` : ""}`
    ;(e.seasonTeamId === match.homeId ? out.home : out.away).push(label)
  }
  return out
}

/** Rasmga yoziladigan sayt nomi: localhost, IP manzil va port hech qachon chiqmaydi, «www.» olib tashlanadi */
export function publicSiteName(host: string) {
  const name = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "")
  const local = name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local") || name.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(name)
  return !name || local || !name.includes(".") ? "" : name
}

export function matchImageData(match: Match, index: SeasonIndex, host = typeof window === "undefined" ? "" : window.location.host): MatchImageData {
  const events = index.eventsOf(match.id)
  const score = totalScore(match)
  const kind: MatchImageKind = match.status === "FINISHED" && score ? "result" : match.status === "LIVE" && score ? "live" : "preview"
  const scorers = kind === "preview" ? { home: [], away: [] } : scorerLines(match, events, index)
  const reds = kind === "preview" ? { home: [], away: [] } : redLines(match, events, index)
  const winner = winnerSide(match)
  const venue = index.venue(match.venueId)
  const confirmed = match.timeConfirmed !== false
  const side = (s: "home" | "away"): MatchImageSide => {
    const team = index.team(s === "home" ? match.homeId : match.awayId)
    return {
      name: sideName(match, s, index),
      team: team ?? null,
      scorers: scorers[s],
      reds: reds[s],
      dimmed: kind === "result" && winner !== null && winner !== s,
    }
  }
  const season = index.bundle.season
  const live = kind === "live" ? liveLabel(match, season.rules.halfMinutes) : null
  return {
    kind,
    badge: kind === "result" ? "Yakuniy hisob" : kind === "live" ? `Jonli${live ? `, ${live}` : ""}` : "O‘yin anonsi",
    season: `${season.year}-yil, ${season.name}`,
    stage: stageLabel(match, index),
    home: side("home"),
    away: side("away"),
    score: kind === "preview" ? null : score,
    note: scoreNote(match),
    time: confirmed ? formatTime(match.kickoff) : null,
    date: confirmed ? formatDate(match.kickoff, { weekday: true, year: true }) : null,
    when: confirmed ? dateWords(match.kickoff) : null,
    venue: venue?.name ?? null,
    site: publicSiteName(host),
  }
}

/** Rasm ma'lumotlarini kirillchaga o'giradi (sayt kirill rejimida bo'lsa — rasm va post ham kirillcha); sayt domeni o'zgarmaydi */
export function matchImageInCyrillic(d: MatchImageData): MatchImageData {
  const c = (s: string | null) => (s === null ? null : toCyrillic(s))
  const side = (x: MatchImageSide): MatchImageSide => ({
    ...x,
    name: toCyrillic(x.name),
    team: x.team ? { ...x.team, shortName: toCyrillic(x.team.shortName) } : null,
    scorers: x.scorers.map(toCyrillic),
    reds: x.reds.map(toCyrillic),
  })
  return {
    ...d,
    badge: toCyrillic(d.badge),
    season: toCyrillic(d.season),
    stage: toCyrillic(d.stage),
    home: side(d.home),
    away: side(d.away),
    note: c(d.note),
    date: c(d.date),
    when: d.when ? { ...d.when, weekday: toCyrillic(d.when.weekday), month: toCyrillic(d.when.month) } : null,
    venue: c(d.venue),
  }
}

/** Telegram posti uchun matn (rasm ostiga yoziladi) */
export function matchCaption(d: MatchImageData) {
  const lines = [d.stage]
  if (d.score) lines.push(`${d.home.name} ${d.score.home}:${d.score.away} ${d.away.name}${d.note ? ` (${d.note.toLowerCase()})` : ""}`)
  else lines.push(`${d.home.name} — ${d.away.name}`)
  const goals = [...d.home.scorers.map((s) => `${s} (${d.home.name})`), ...d.away.scorers.map((s) => `${s} (${d.away.name})`)]
  if (goals.length) lines.push(`${/[\u0400-\u04FF]/.test(d.stage) ? "Голлар" : "Gollar"}: ${goals.join("; ")}`)
  const soon = /[\u0400-\u04FF]/.test(d.stage) ? toCyrillic("Sana tez orada e’lon qilinadi") : "Sana tez orada e’lon qilinadi"
  lines.push([d.date ?? soon, d.time, d.venue].filter(Boolean).join(", "))
  const league = /[\u0400-\u04FF]/.test(d.stage) ? toCyrillic("Payariq Oltin Ligasi") : "Payariq Oltin Ligasi"
  lines.push(d.site ? `${league}, ${d.site}` : league)
  return lines.join("\n")
}

export function matchImageFileName(match: Match, d: MatchImageData) {
  const kind = d.kind === "preview" ? "anons" : d.kind === "live" ? "hisob" : "natija"
  // Sana Toshkent vaqti bilan (UTC bo'yicha olinsa, tungi o'yinda fayl nomi bir kun oldingi sanani ko'rsatadi)
  return `payariq-${kind}-${slugify(d.home.name)}-${slugify(d.away.name)}-${localDateKey(match.kickoff)}.png`
}

/* ───────────────────────── Chizish ─────────────────────────
 * Kompozitsiya: rasm ikki jamoa rangida qiya bo'linadi, chegarada oltin chiziq.
 * O'rtada «tablo»: anonsda boshlanish vaqti, o'yin davomida va oxirida hisob.
 * Pastda oltin chipta: kun, stadion va kalendar varag'i ko'rinishidagi sana.
 */

const W = 1080
const H = 1350
/** Chekka bo'shliq */
const M = 64
/** Qiya chiziqning og'ishi: yuqorida markazdan o'ngga, pastda chapga */
const TILT = 92
/** Jamoa nomi uchun eng katta kenglik */
const NAME_W = 400
const C = {
  bgTop: "#0d3a2b",
  bgBottom: "#051a12",
  shade: "3,16,11",
  white: "#ffffff",
  muted: "#b9cdc0",
  gold: "#d1a531",
  goldLight: "#ecc85c",
  ticketFrom: "#efcb5e",
  ticketTo: "#c99a26",
  ink: "#0a2219",
  plate: "rgba(4,22,15,0.9)",
  live: "#e5484d",
  red: "#d63b3b",
}
export const FONT = `"Archivo Variable", "Archivo", system-ui, sans-serif`
export const SHIELD = "M20 1.5 37.5 7v15.2c0 11.4-7.4 18.4-17.5 22.3C9.9 40.6 2.5 33.6 2.5 22.2V7Z"
export const SHIELD_TOP = "M2.5 7 20 1.5 37.5 7v5.5H2.5Z"

export type Ctx = CanvasRenderingContext2D

export function setFont(ctx: Ctx, size: number, weight = 700, condensed = true) {
  ctx.font = `${weight} ${size}px ${FONT}`
  if ("fontStretch" in ctx) (ctx as Ctx & { fontStretch: string }).fontStretch = condensed ? "condensed" : "normal"
}

/** Matn kenglikka sig'maguncha shriftni kichraytiradi, kerak bo'lsa oxirini «…» bilan qisqartiradi */
export function fitText(ctx: Ctx, text: string, maxWidth: number, size: number, min: number, weight = 700, condensed = true) {
  let s = size
  setFont(ctx, s, weight, condensed)
  while (s > min && ctx.measureText(text).width > maxWidth) setFont(ctx, (s -= 2), weight, condensed)
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    try {
      if (new URL(url, window.location.href).origin !== window.location.origin) img.crossOrigin = "anonymous"
    } catch {
      resolve(null)
      return
    }
    img.decoding = "async"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function luminance([r, g, b]: [number, number, number]) {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** Jamoa rangi fon uchun: och ranglar kuchsizroq beriladi — oq matn har doim o'qilsin */
function tint(color: string | undefined, dimmed: boolean) {
  const c = color ? rgb(color) : null
  if (!c) return null
  const l = luminance(c)
  const a = (l > 0.5 ? 0.18 : l > 0.2 ? 0.3 : 0.46) * (dimmed ? 0.55 : 1)
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
}

const seamX = (y: number) => W / 2 + TILT - (2 * TILT * y) / H

function background(ctx: Ctx, d: MatchImageData) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, C.bgTop)
  g.addColorStop(1, C.bgBottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Ikki yarim: har bir jamoa o'z rangida
  const halves: [MatchImageSide, [number, number][]][] = [
    [d.home, [[0, 0], [seamX(0), 0], [seamX(H), H], [0, H]]],
    [d.away, [[seamX(0), 0], [W, 0], [W, H], [seamX(H), H]]],
  ]
  for (const [side, pts] of halves) {
    const fill = tint(side.team?.primaryColor, side.dimmed)
    if (!fill) continue
    ctx.fillStyle = fill
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fill()
  }

  // Qiya chiziqqa parallel xira chiziqlar — harakat hissi
  ctx.strokeStyle = "rgba(255,255,255,0.03)"
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let o = -W; o < W; o += 24) {
    ctx.moveTo(seamX(0) + o, 0)
    ctx.lineTo(seamX(H) + o, H)
  }
  ctx.stroke()

  // Sarlavha va chipta o'qilishi uchun yuqori va pastki qism to'qroq
  const top = ctx.createLinearGradient(0, 0, 0, 280)
  top.addColorStop(0, `rgba(${C.shade},0.8)`)
  top.addColorStop(1, `rgba(${C.shade},0)`)
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 280)
  const bottom = ctx.createLinearGradient(0, 940, 0, H)
  bottom.addColorStop(0, `rgba(${C.shade},0)`)
  bottom.addColorStop(1, `rgba(${C.shade},0.85)`)
  ctx.fillStyle = bottom
  ctx.fillRect(0, 940, W, H - 940)
}

/** Ikki yarim orasidagi oltin chiziq, uchlari sekin so'nadi */
function seam(ctx: Ctx, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, "rgba(236,200,92,0)")
  g.addColorStop(0.18, "rgba(236,200,92,0.9)")
  g.addColorStop(0.82, "rgba(236,200,92,0.9)")
  g.addColorStop(1, "rgba(236,200,92,0)")
  ctx.strokeStyle = g
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(seamX(y0), y0)
  ctx.lineTo(seamX(y1), y1)
  ctx.stroke()
}

function pill(ctx: Ctx, text: string, x: number, y: number, fill: string, color: string) {
  const t = fitText(ctx, text, 300, 30, 24, 750)
  const w = ctx.measureText(t).width + 48
  const h = 54
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x - w, y, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(t, x - w / 2, y + h / 2 + 1)
}

async function header(ctx: Ctx, d: MatchImageData) {
  const logo = await loadImage("/brand/logo-192.webp")
  if (logo) ctx.drawImage(logo, M, 52, 108, 108)
  const x = logo ? M + 128 : M
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = C.white
  ctx.fillText(fitText(ctx, "Payariq Oltin Ligasi", 520, 52, 40, 750), x, 104)
  ctx.fillStyle = C.goldLight
  ctx.fillText(fitText(ctx, d.season, 520, 30, 24, 600, false), x, 146)
  pill(ctx, d.badge, W - M, 76, d.kind === "live" ? C.live : C.gold, d.kind === "live" ? C.white : C.ink)
}

/** Bosqich nomi, ikki yonida qisqa oltin chiziqlar */
function stageLine(ctx: Ctx, text: string, y: number) {
  const t = fitText(ctx, text, 720, 40, 28, 700)
  const w = ctx.measureText(t).width
  ctx.fillStyle = C.goldLight
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(t, W / 2, y)
  ctx.fillStyle = "rgba(236,200,92,0.6)"
  const gap = 28
  const len = 84
  ctx.fillRect(W / 2 - w / 2 - gap - len, y - 1.5, len, 3)
  ctx.fillRect(W / 2 + w / 2 + gap, y - 1.5, len, 3)
}

async function crest(ctx: Ctx, side: MatchImageSide, cx: number, cy: number) {
  const logo = side.team?.logoUrl ? await loadImage(side.team.logoUrl) : null
  ctx.save()
  ctx.globalAlpha = side.dimmed ? 0.6 : 1
  ctx.shadowColor = "rgba(0,0,0,0.45)"
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 14
  if (logo) {
    const r = 124
    ctx.fillStyle = C.white
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = "transparent"
    ctx.strokeStyle = C.gold
    ctx.lineWidth = 5
    ctx.stroke()
    const box = 172
    const scale = Math.min(box / logo.naturalWidth, box / logo.naturalHeight)
    const w = logo.naturalWidth * scale
    const h = logo.naturalHeight * scale
    ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h)
  } else if (side.team) {
    // Qalqon: 40×46 birlikdagi chizma 250px balandlikka kattalashtiriladi
    const s = 250 / 46
    ctx.translate(cx - 20 * s, cy - 23 * s)
    ctx.scale(s, s)
    ctx.fillStyle = side.team.primaryColor
    ctx.fill(new Path2D(SHIELD))
    ctx.shadowColor = "transparent"
    ctx.fillStyle = side.team.secondaryColor
    ctx.globalAlpha *= 0.9
    ctx.fill(new Path2D(SHIELD_TOP))
    ctx.globalAlpha = side.dimmed ? 0.6 : 1
    ctx.strokeStyle = C.gold
    ctx.lineWidth = 0.7
    ctx.stroke(new Path2D(SHIELD))
    const label = side.team.shortName.slice(0, 3).toUpperCase()
    setFont(ctx, label.length > 2 ? 11.5 : 14, 800)
    ctx.fillStyle = side.team.secondaryColor
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.fillText(label, 20, 30)
  } else {
    // Jamoa hali aniqlanmagan (pley-off): bo'sh qalqon va «?»
    const s = 250 / 46
    ctx.translate(cx - 20 * s, cy - 23 * s)
    ctx.scale(s, s)
    ctx.fillStyle = "rgba(255,255,255,0.08)"
    ctx.fill(new Path2D(SHIELD))
    ctx.shadowColor = "transparent"
    ctx.strokeStyle = "rgba(236,200,92,0.6)"
    ctx.lineWidth = 0.7
    ctx.stroke(new Path2D(SHIELD))
    setFont(ctx, 20, 700)
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("?", 20, 24)
  }
  ctx.restore()
}

/** O'rtadagi tablo: anonsda boshlanish vaqti, aks holda hisob */
function scoreboard(ctx: Ctx, d: MatchImageData, cy: number) {
  const w = 320
  const h = 200
  const x = W / 2 - w / 2
  const y = cy - h / 2
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.5)"
  ctx.shadowBlur = 36
  ctx.shadowOffsetY = 12
  ctx.fillStyle = C.plate
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 26)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = d.kind === "live" ? C.live : C.gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 26)
  ctx.stroke()

  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  if (d.score) {
    ctx.fillStyle = C.white
    ctx.fillText(fitText(ctx, `${d.score.home}:${d.score.away}`, w - 48, 164, 96, 800), W / 2, cy + 8)
    if (d.note) {
      const note = fitText(ctx, d.note, 380, 28, 22, 650, false)
      const nw = ctx.measureText(note).width + 44
      ctx.fillStyle = C.plate
      ctx.beginPath()
      ctx.roundRect(W / 2 - nw / 2, y + h + 10, nw, 48, 24)
      ctx.fill()
      ctx.strokeStyle = C.gold
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = C.goldLight
      ctx.fillText(note, W / 2, y + h + 35)
    }
  } else {
    ctx.fillStyle = C.muted
    ctx.fillText(fitText(ctx, d.time ? "boshlanish" : "vaqti", w - 48, 28, 22, 600, false), W / 2, y + 42)
    ctx.fillStyle = d.time ? C.goldLight : C.muted
    ctx.fillText(fitText(ctx, d.time ?? "tez orada", w - 48, d.time ? 112 : 56, 40, 800), W / 2, cy + 26)
  }
}

/** Futbol to'pi: markazda besh burchak, undan chetga chiziqlar */
export function ball(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.fillStyle = C.white
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.clip()
  const corner = (i: number, k: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    return [cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)] as const
  }
  ctx.fillStyle = C.ink
  ctx.beginPath()
  for (let i = 0; i < 5; i++) ctx.lineTo(...corner(i, 0.48))
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = C.ink
  ctx.lineWidth = Math.max(1.5, r * 0.16)
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    ctx.moveTo(...corner(i, 0.48))
    ctx.lineTo(...corner(i, 1))
  }
  ctx.stroke()
  ctx.restore()
}

/** Jamoa nomi: sig'masa so'zlar bo'yicha ikki qatorga bo'linadi. Qaytaradi: qatorlar soni */
function teamName(ctx: Ctx, name: string, x: number, y: number, maxW: number) {
  const one = fitText(ctx, name, maxW, 56, 44, 750)
  const words = name.split(/\s+/)
  if (one === name || words.length < 2) {
    ctx.fillText(one === name ? name : fitText(ctx, name, maxW, 56, 34, 750), x, y)
    return 1
  }
  // Ikki qator iloji boricha teng uzunlikda bo'lsin
  setFont(ctx, 46, 750)
  let cut = 1
  let best = Infinity
  for (let i = 1; i < words.length; i++) {
    const wide = Math.max(ctx.measureText(words.slice(0, i).join(" ")).width, ctx.measureText(words.slice(i).join(" ")).width)
    if (wide < best) {
      best = wide
      cut = i
    }
  }
  const rows = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")]
  const longer = ctx.measureText(rows[0]).width >= ctx.measureText(rows[1]).width ? 0 : 1
  rows[longer] = fitText(ctx, rows[longer], maxW, 46, 30, 750)
  ctx.fillText(rows[0], x, y - 8)
  ctx.fillText(rows[1], x, y + 40)
  return 2
}

/**
 * Gol urganlar (to'p belgisi bilan) va qizil kartochkalar — jamoa nomi ostida, belgilar bir ustunda.
 * bottom — oxirgi qator markazi uchun chegara; sig'maganlari «va yana N ta» bo'ladi.
 */
function eventsColumn(ctx: Ctx, side: MatchImageSide, cx: number, top: number, bottom: number) {
  const items = [...side.scorers.map((t) => ({ t, red: false })), ...side.reds.map((t) => ({ t, red: true }))]
  const lineH = items.length >= 4 ? 44 : 50
  const room = Math.max(1, Math.floor((bottom - top) / lineH) + 1)
  const maxLines = items.length > room ? room - 1 : room
  const shown = items.slice(0, maxLines)
  const icon = 22
  const gap = 12
  const maxText = 430 - icon - gap
  // Ustundagi barcha qatorlar bitta o'lchamda: eng uzuni sig'adigan o'lcham tanlanadi
  let size = 32
  setFont(ctx, size, 600, false)
  const widest = () => Math.max(...shown.map((it) => ctx.measureText(it.t).width))
  while (size > 22 && widest() > maxText) setFont(ctx, (size -= 2), 600, false)
  const texts = shown.map((it) => fitText(ctx, it.t, maxText, size, size, 600, false))
  const blockW = icon + gap + Math.max(...texts.map((t) => ctx.measureText(t).width))
  const x = Math.min(Math.max(cx - blockW / 2, M - 24), W - M + 24 - blockW)
  ctx.save()
  ctx.globalAlpha = side.dimmed ? 0.75 : 1
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  shown.forEach((it, i) => {
    const y = top + i * lineH
    const text = texts[i]
    if (it.red) {
      ctx.fillStyle = C.red
      ctx.beginPath()
      ctx.roundRect(x + 3, y - 13, 16, 24, 3)
      ctx.fill()
    } else {
      ball(ctx, x + icon / 2, y, icon / 2)
    }
    ctx.fillStyle = it.red ? C.muted : C.white
    ctx.fillText(text, x + icon + gap, y + 1)
  })
  if (items.length > maxLines) {
    setFont(ctx, 26, 600, false)
    ctx.fillStyle = C.muted
    ctx.textAlign = "center"
    ctx.fillText(`va yana ${items.length - maxLines} ta`, x + blockW / 2, top + maxLines * lineH)
  }
  ctx.restore()
}

function pin(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = C.ink
  ctx.beginPath()
  ctx.arc(x, y, 11, Math.PI * 0.8, Math.PI * 0.2)
  ctx.lineTo(x, y + 21)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = C.ticketFrom
  ctx.beginPath()
  ctx.arc(x, y, 4.5, 0, Math.PI * 2)
  ctx.fill()
}

/** Oltin chipta: chapda kun va stadion, o'ngda kalendar varag'i */
function ticket(ctx: Ctx, d: MatchImageData) {
  const x0 = M
  const x1 = W - M
  const y0 = 1084
  const y1 = 1276
  const r = 22
  const px = 800 // perforatsiya chizig'i
  const nr = 18 // chipta kesigi
  const path = new Path2D()
  path.moveTo(x0 + r, y0)
  path.lineTo(px - nr, y0)
  path.arc(px, y0, nr, Math.PI, 0, true)
  path.arcTo(x1, y0, x1, y0 + r, r)
  path.arcTo(x1, y1, x1 - r, y1, r)
  path.lineTo(px + nr, y1)
  path.arc(px, y1, nr, 0, Math.PI, true)
  path.arcTo(x0, y1, x0, y1 - r, r)
  path.arcTo(x0, y0, x0 + r, y0, r)
  path.closePath()

  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, C.ticketFrom)
  g.addColorStop(1, C.ticketTo)
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.45)"
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 10
  ctx.fillStyle = g
  ctx.fill(path)
  ctx.restore()

  ctx.save()
  ctx.setLineDash([10, 10])
  ctx.strokeStyle = "rgba(10,34,25,0.4)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(px, y0 + nr + 12)
  ctx.lineTo(px, y1 - nr - 12)
  ctx.stroke()
  ctx.restore()

  // Chap qism: anonsda kun nomi (vaqt tabloda), natijada kun va soat
  const lx = x0 + 44
  const maxW = px - lx - 40
  const day = d.when ? (d.kind === "preview" || !d.time ? d.when.weekday : `${d.when.weekday}, soat ${d.time}`) : "Sana tez orada e’lon qilinadi"
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = C.ink
  ctx.fillText(fitText(ctx, day, maxW, d.when ? 58 : 44, 32, 750), lx, y0 + 88)
  pin(ctx, lx + 11, y0 + 132)
  ctx.fillStyle = "rgba(10,34,25,0.85)"
  ctx.fillText(fitText(ctx, d.venue ?? "Stadion keyinroq aytiladi", maxW - 36, 32, 24, 600, false), lx + 36, y0 + 144)

  // O'ng qism: kalendar varag'i
  const sx = (px + x1) / 2
  ctx.textAlign = "center"
  ctx.fillStyle = C.ink
  if (d.when) {
    ctx.fillText(fitText(ctx, String(d.when.day), x1 - px - 40, 108, 72, 800), sx, y0 + 112)
    ctx.fillText(fitText(ctx, d.when.month, x1 - px - 40, 32, 22, 650, false), sx, y0 + 156)
  } else {
    ctx.fillText(fitText(ctx, "—", x1 - px - 40, 96, 60, 800), sx, y0 + 124)
  }
}

export async function renderMatchImage(d: MatchImageData): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`700 40px ${FONT}`, "Payariq Oltin Ligasi ‘’′ 0123456789"),
    document.fonts.load(`800 40px ${FONT}`, "0123456789:"),
    document.fonts.load(`600 40px ${FONT}`, "Abc ‘’′"),
  ]).catch(() => undefined)

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Brauzer rasm chizishni qo‘llab-quvvatlamaydi")
  const lines = Math.min(5, Math.max(d.home.scorers.length + d.home.reds.length, d.away.scorers.length + d.away.reds.length))
  const hasEvents = lines > 0
  // Uzun nom ikki qatorga bo'linsa, gol urganlar pastroqdan boshlanadi
  const wraps = [d.home.name, d.away.name].some((n) => /\s/.test(n.trim()) && fitText(ctx, n, NAME_W, 56, 44, 750) !== n)
  const extra = wraps ? 44 : 0
  // Gol urganlar kam bo'lsa asosiy blok pastroqqa tushadi — sarlavha va chipta orasida markazda turadi
  const oy = hasEvents ? Math.max(0, (5 - lines) * 22 - extra) : 130 - extra / 2
  const stageY = 262 + oy
  const cy = 500 + oy
  const left = 250
  const right = W - 250

  background(ctx, d)
  seam(ctx, stageY + 48, 1060)
  await header(ctx, d)
  stageLine(ctx, d.stage, stageY)

  await crest(ctx, d.home, left, cy)
  await crest(ctx, d.away, right, cy)
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  for (const [side, x] of [[d.home, left], [d.away, right]] as const) {
    ctx.globalAlpha = side.dimmed ? 0.65 : 1
    ctx.fillStyle = C.white
    teamName(ctx, side.name, x, cy + 204, NAME_W)
    ctx.globalAlpha = 1
  }
  scoreboard(ctx, d, cy)

  if (hasEvents) {
    eventsColumn(ctx, d.home, left, cy + 286 + extra, 1044)
    eventsColumn(ctx, d.away, right, cy + 286 + extra, 1044)
  }

  ticket(ctx, d)
  if (d.site) {
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = C.muted
    ctx.fillText(fitText(ctx, d.site, 600, 26, 20, 600, false), W / 2, 1324)
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Rasmni tayyorlab bo‘lmadi"))), "image/png"))
}
