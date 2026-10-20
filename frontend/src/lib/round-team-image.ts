import type { TeamView } from "@/api/types"
import { ROUND_TEAM_SLOTS, roundKeyOf, roundOptions, roundStats } from "@/domain/round-team"
import type { RoundTeam, RoundTeamSlotKey } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { formatDateRange, slugify } from "./format"
import { FONT, SHIELD, SHIELD_TOP, ball, fitText, loadImage, publicSiteName, type Ctx } from "./match-image"
import { toCyrillic } from "./translit"

/**
 * Ramziy jamoa rasmi (1080×1350 PNG) — Telegram kanali va ijtimoiy tarmoqlar uchun.
 * «Oltin medallar»: tungi yashil maydon, oltin chiziqlar, har bir futbolchi oltin halqali medalda.
 * Rasm brauzerning o'zida chiziladi, hech qayerga yuborilmaydi.
 */

export interface RoundTeamImagePlayer {
  slot: RoundTeamSlotKey
  position: string
  firstName: string
  lastName: string
  teamName: string
  team: Pick<TeamView, "shortName" | "primaryColor" | "secondaryColor" | "logoUrl"> | null
  number: number | null
  photoUrl: string | null
  /** «2 gol, 1 uzatma» yoki darvozabonga «Darvozasini quruq saqladi» */
  stats: string
  goals: number
}

export interface RoundTeamImageData {
  /** Guruh bosqichida tur raqami («1»), pley-offda null */
  numeral: string | null
  /** Raqam yonidagi so'z: «-tur»; pley-offda bosqich nomi: «Yarim final» */
  stage: string
  /** «Ramziy jamoa» */
  title: string
  /** «16–17-oktabr o‘yinlarining eng yaxshi futbolchilari» */
  subtitle: string
  season: string
  venue: string | null
  players: RoundTeamImagePlayer[]
  /** Rasm ostidagi sayt manzili — faqat haqiqiy domen, aks holda bo'sh */
  site: string
  /** Fayl nomi va post matni uchun: «1-tur», «Yarim final» */
  label: string
}

const POSITIONS: Record<RoundTeamSlotKey, string> = Object.fromEntries(ROUND_TEAM_SLOTS.map((s) => [s.key, s.label])) as Record<RoundTeamSlotKey, string>

function statsText(slot: RoundTeamSlotKey, goals: number, assists: number, conceded: number | null) {
  if (slot === "GK") return conceded === 0 ? "Darvozasini quruq saqladi" : ""
  return [goals > 0 && `${goals} gol`, assists > 0 && `${assists} uzatma`].filter(Boolean).join(", ")
}

export function roundTeamImageData(team: RoundTeam, index: SeasonIndex, host = typeof window === "undefined" ? "" : window.location.host): RoundTeamImageData {
  const option = roundOptions(index.bundle.matches).find((o) => o.key === roundKeyOf(team))
  const stats = option
    ? roundStats(option, { events: index.bundle.events, appearances: index.bundle.appearances, rosters: index.bundle.rosters })
    : new Map()
  const label = option?.label ?? (team.round != null ? `${team.round}-tur` : "Pley-off")
  const dates = option ? formatDateRange(option.matches.map((m) => m.kickoff)) : null
  // Turdagi o'yinlar o'tgan stadion (bir nechta bo'lsa — eng ko'p o'yin bo'lgani)
  const venueCount = new Map<string, number>()
  for (const m of option?.matches ?? []) if (m.venueId) venueCount.set(m.venueId, (venueCount.get(m.venueId) ?? 0) + 1)
  const venueId = [...venueCount].sort((a, b) => b[1] - a[1])[0]?.[0]
  const season = index.bundle.season
  const order: RoundTeamSlotKey[] = ["FW", "MF_L", "MF_R", "DF", "GK"]
  const players = order.flatMap((slot) => {
    const s = team.slots.find((x) => x.slot === slot)
    if (!s) return []
    const p = index.player(s.playerId)
    const st = stats.get(s.playerId)
    const t = index.team(s.seasonTeamId)
    return [
      {
        slot,
        position: POSITIONS[slot],
        firstName: p?.firstName ?? "",
        lastName: p?.lastName ?? "",
        teamName: t?.name ?? "",
        team: t ?? null,
        number: index.numberOf(s.playerId) ?? null,
        photoUrl: p?.photoUrl ?? null,
        stats: statsText(slot, st?.goals ?? 0, st?.assists ?? 0, st?.conceded ?? null),
        goals: slot === "GK" ? 0 : (st?.goals ?? 0),
      },
    ]
  })
  return {
    numeral: team.stage === "GROUP" && team.round != null ? String(team.round) : null,
    stage: team.stage === "GROUP" ? "-tur" : label,
    title: "Ramziy jamoa",
    subtitle: dates ? `${dates} o‘yinlarining eng yaxshi futbolchilari` : "Eng yaxshi futbolchilar",
    season: `${season.year}-yil, ${season.name}`,
    venue: venueId ? (index.venue(venueId)?.name ?? null) : null,
    players,
    site: publicSiteName(host),
    label,
  }
}

/** Sayt kirill yozuvida bo'lsa — rasm va post ham kirillcha; sayt domeni o'zgarmaydi */
export function roundTeamImageInCyrillic(d: RoundTeamImageData): RoundTeamImageData {
  return {
    ...d,
    stage: toCyrillic(d.stage),
    title: toCyrillic(d.title),
    subtitle: toCyrillic(d.subtitle),
    season: toCyrillic(d.season),
    venue: d.venue === null ? null : toCyrillic(d.venue),
    label: toCyrillic(d.label),
    players: d.players.map((p) => ({
      ...p,
      position: toCyrillic(p.position),
      firstName: toCyrillic(p.firstName),
      lastName: toCyrillic(p.lastName),
      teamName: toCyrillic(p.teamName),
      team: p.team ? { ...p.team, shortName: toCyrillic(p.team.shortName) } : null,
      stats: toCyrillic(p.stats),
    })),
  }
}

/** Telegram posti uchun matn: darvozabondan hujumchigacha */
export function roundTeamCaption(d: RoundTeamImageData) {
  const cyr = /[Ѐ-ӿ]/.test(d.title)
  const t = (s: string) => (cyr ? toCyrillic(s) : s)
  const heading = `${d.label} ${t("ramziy jamoasi")}`
  const lines = [heading]
  for (const slot of ["GK", "DF", "MF_L", "MF_R", "FW"] as RoundTeamSlotKey[]) {
    const p = d.players.find((x) => x.slot === slot)
    if (!p) continue
    lines.push(`${p.position}: ${p.firstName} ${p.lastName} (${p.teamName})${p.stats ? `, ${p.stats.toLowerCase()}` : ""}`)
  }
  const league = t("Payariq Oltin Ligasi")
  lines.push(d.site ? `${league}, ${d.site}` : league)
  return lines.join("\n")
}

export function roundTeamFileName(d: RoundTeamImageData, year: number) {
  return `payariq-ramziy-jamoa-${slugify(d.label)}-${year}.png`
}

/* ───────────────────────── Chizish ───────────────────────── */

const W = 1080
const H = 1350
const M = 64
const C = {
  bgCenter: "#0c3326",
  bgEdge: "#04140d",
  gold: "#d9b13f",
  goldLight: "#f0cf6a",
  goldDark: "#a8821f",
  ink: "#08201a",
  white: "#ffffff",
  muted: "#b9cdc0",
  plate: "rgba(4,20,13,0.88)",
  silhouette: "rgba(143,179,160,0.85)",
}
/** Maydon chegarasi */
const PITCH = { x: M, y: 336, w: W - 2 * M, h: 924 }
/** O'rinlar: medal markazining x koordinatasi va medal yuqori qirrasi */
const SPOT: Record<RoundTeamSlotKey, { x: number; y: number }> = {
  FW: { x: 540, y: 356 },
  MF_L: { x: 236, y: 552 },
  MF_R: { x: 844, y: 552 },
  DF: { x: 540, y: 744 },
  GK: { x: 540, y: 1004 },
}
const MEDAL = 128
const PLATE_W = 250

const STRETCH = { 62: "extra-condensed", 75: "condensed", 100: "normal" } as const

function font(ctx: Ctx, size: number, weight: number, stretch: 62 | 75 | 100 = 75) {
  ctx.font = `${weight} ${size}px ${FONT}`
  if ("fontStretch" in ctx) ctx.fontStretch = STRETCH[stretch]
}

function background(ctx: Ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.35, 40, W / 2, H * 0.35, H * 0.85)
  g.addColorStop(0, C.bgCenter)
  g.addColorStop(1, C.bgEdge)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

async function header(ctx: Ctx, d: RoundTeamImageData) {
  const logo = await loadImage("/brand/logo-192.webp")
  if (logo) ctx.drawImage(logo, M, 48, 72, 72)
  const x = logo ? M + 90 : M
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = C.white
  ctx.fillText(fitText(ctx, "Payariq Oltin Ligasi", 600, 32, 26, 750), x, 80)
  ctx.fillStyle = C.goldLight
  ctx.fillText(fitText(ctx, d.season, 600, 24, 20, 600, false), x, 112)
}

/** Sarlavha: katta oltin raqam va yonida «-tur / Ramziy jamoa»; pley-offda bosqich nomi */
function title(ctx: Ctx, d: RoundTeamImageData) {
  const baseline = 300
  let x = M
  if (d.numeral) {
    ctx.save()
    font(ctx, 232, 900, 62)
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.shadowColor = "rgba(217,177,63,0.35)"
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 6
    ctx.fillStyle = C.goldLight
    ctx.fillText(d.numeral, x - 6, baseline)
    x += ctx.measureText(d.numeral).width + 10
    ctx.restore()
  }
  const maxW = W - M - x
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = C.goldLight
  font(ctx, 46, 850, 62)
  ctx.fillText(fitText(ctx, d.stage.toLocaleUpperCase("uz"), maxW, 46, 30, 850), x, baseline - 136)
  ctx.fillStyle = C.white
  const big = d.title.toLocaleUpperCase("uz")
  font(ctx, 92, 850, 62)
  let size = 92
  while (size > 56 && ctx.measureText(big).width > maxW) font(ctx, (size -= 4), 850, 62)
  ctx.fillText(big, x, baseline - 52)
  ctx.fillStyle = C.muted
  ctx.fillText(fitText(ctx, d.subtitle, maxW, 22, 18, 500, false), x, baseline - 14)
}

function pitch(ctx: Ctx) {
  const { x, y, w, h } = PITCH
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 28)
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, "#0f3d2d")
  g.addColorStop(1, "#0a2b20")
  ctx.fillStyle = g
  ctx.fill()
  ctx.clip()
  // O'tlarning chiziqlari
  ctx.fillStyle = "rgba(255,255,255,0.025)"
  for (let sy = y; sy < y + h; sy += 150) ctx.fillRect(x, sy, w, 75)
  // Maydon chiziqlari
  ctx.strokeStyle = "rgba(217,177,63,0.30)"
  ctx.lineWidth = 3
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.beginPath()
  ctx.moveTo(x, cy)
  ctx.lineTo(x + w, cy)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, 96, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = "rgba(217,177,63,0.45)"
  ctx.beginPath()
  ctx.arc(cx, cy, 6, 0, Math.PI * 2)
  ctx.fill()
  // Jarima maydonchalari: to'g'ri chiziq va yarim aylana
  for (const top of [true, false]) {
    const edge = top ? y : y + h
    const dir = top ? 1 : -1
    ctx.beginPath()
    ctx.moveTo(cx - 180, edge)
    ctx.lineTo(cx - 180, edge + dir * 72)
    // Yarim aylana maydon ichiga qarab egiladi
    ctx.ellipse(cx, edge + dir * 72, 180, 120, 0, Math.PI, 0, top)
    ctx.lineTo(cx + 180, edge)
    ctx.stroke()
    ctx.strokeRect(cx - 65, top ? edge : edge - 18, 130, 18)
  }
  ctx.restore()
  ctx.strokeStyle = "rgba(217,177,63,0.45)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 27)
  ctx.stroke()
}

/** Rasm doirani to'liq qoplaydi (yuz yuqoriroqda bo'lgani uchun markaz biroz tepada) */
function drawCover(ctx: Ctx, img: HTMLImageElement, cx: number, cy: number, r: number) {
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = (img.naturalWidth - side) / 2
  const sy = Math.max(0, (img.naturalHeight - side) * 0.25)
  ctx.drawImage(img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2)
}

function silhouette(ctx: Ctx, cx: number, cy: number, r: number) {
  // 100×100 birlikdagi odamcha (saytdagi belgining o'zi)
  const s = (r * 2 * 0.92) / 100
  ctx.save()
  ctx.translate(cx - 50 * s, cy + r - 100 * s)
  ctx.scale(s, s)
  ctx.fillStyle = C.silhouette
  ctx.beginPath()
  ctx.arc(50, 39, 19, 0, Math.PI * 2)
  ctx.fill()
  ctx.fill(new Path2D("M13 100c0-25 16-38 37-38s37 13 37 38Z"))
  ctx.restore()
}

async function crest(ctx: Ctx, team: RoundTeamImagePlayer["team"], x: number, y: number) {
  if (!team) return
  const logo = team.logoUrl ? await loadImage(team.logoUrl) : null
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.5)"
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 4
  if (logo) {
    const box = 48
    const scale = Math.min(box / logo.naturalWidth, box / logo.naturalHeight)
    const w = logo.naturalWidth * scale
    const h = logo.naturalHeight * scale
    ctx.fillStyle = C.white
    ctx.beginPath()
    ctx.arc(x + 22, y + 25, 27, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = "transparent"
    ctx.drawImage(logo, x + 22 - w / 2, y + 25 - h / 2, w, h)
  } else {
    const s = 50 / 46
    ctx.translate(x + 22 - 20 * s, y)
    ctx.scale(s, s)
    ctx.fillStyle = team.primaryColor
    ctx.fill(new Path2D(SHIELD))
    ctx.shadowColor = "transparent"
    ctx.globalAlpha = 0.9
    ctx.fillStyle = team.secondaryColor
    ctx.fill(new Path2D(SHIELD_TOP))
    ctx.globalAlpha = 1
    const label = team.shortName.slice(0, 3).toUpperCase()
    font(ctx, label.length > 2 ? 11.5 : 14, 800)
    ctx.fillStyle = team.secondaryColor
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.fillText(label, 20, 30)
  }
  ctx.restore()
}

async function medal(ctx: Ctx, p: RoundTeamImagePlayer, cx: number, top: number) {
  const r = MEDAL / 2
  const cy = top + r
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,0.45)"
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 14
  const ring = ctx.createConicGradient((200 * Math.PI) / 180, cx, cy)
  ring.addColorStop(0, C.goldDark)
  ring.addColorStop(0.25, C.goldLight)
  ring.addColorStop(0.5, C.gold)
  ring.addColorStop(0.75, C.goldLight)
  ring.addColorStop(1, C.goldDark)
  ctx.fillStyle = ring
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // Yuz: rasm yoki odamcha
  const inner = r - 6
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, inner, 0, Math.PI * 2)
  ctx.clip()
  const face = ctx.createRadialGradient(cx, cy - inner * 0.3, 4, cx, cy, inner)
  face.addColorStop(0, "#1d5440")
  face.addColorStop(1, "#0b2a1f")
  ctx.fillStyle = face
  ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2)
  const photo = p.photoUrl ? await loadImage(p.photoUrl) : null
  if (photo) drawCover(ctx, photo, cx, cy, inner)
  else silhouette(ctx, cx, cy, inner)
  ctx.restore()
  // Raqam: chap tepada
  if (p.number != null) {
    const nx = cx - r + 17
    const ny = top + 19
    ctx.fillStyle = C.ink
    ctx.beginPath()
    ctx.arc(nx, ny, 23, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = C.gold
    ctx.lineWidth = 3
    ctx.stroke()
    font(ctx, 24, 850, 75)
    ctx.fillStyle = C.goldLight
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(p.number), nx, ny + 1)
  }
  await crest(ctx, p.team, cx + r - 30, top - 6)
}

/** Ism lavhasi: pozitsiya yorlig'i, ism, familiya, jamoa va ko'rsatkichlar */
function plate(ctx: Ctx, p: RoundTeamImagePlayer, cx: number, top: number) {
  const inner = PLATE_W - 24
  const hasStats = Boolean(p.stats)
  const h = hasStats ? 128 : 102
  const x = cx - PLATE_W / 2
  ctx.fillStyle = C.plate
  ctx.beginPath()
  ctx.roundRect(x, top, PLATE_W, h, 16)
  ctx.fill()
  ctx.strokeStyle = "rgba(217,177,63,0.55)"
  ctx.lineWidth = 2
  ctx.stroke()
  // Pozitsiya
  const pos = fitText(ctx, p.position, PLATE_W - 40, 16, 13, 800)
  const pw = ctx.measureText(pos).width + 26
  ctx.fillStyle = C.gold
  ctx.beginPath()
  ctx.roundRect(cx - pw / 2, top - 13, pw, 26, 13)
  ctx.fill()
  ctx.fillStyle = C.ink
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(pos, cx, top + 1)

  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = C.muted
  ctx.fillText(fitText(ctx, p.firstName, inner, 20, 16, 500, false), cx, top + 38)
  ctx.fillStyle = C.white
  ctx.fillText(fitText(ctx, p.lastName, inner, 30, 22, 780), cx, top + 68)
  ctx.fillStyle = C.goldLight
  ctx.fillText(fitText(ctx, p.teamName, inner, 20, 16, 600, false), cx, top + 93)
  if (hasStats) {
    const balls = Math.min(p.goals, 4)
    const text = fitText(ctx, p.stats, inner - balls * 26, 19, 15, 500, false)
    const tw = ctx.measureText(text).width
    const total = balls * 26 + (balls ? 6 : 0) + tw
    let bx = cx - total / 2
    for (let i = 0; i < balls; i++) {
      ball(ctx, bx + 11, top + 111, 11)
      bx += 26
    }
    if (balls) bx += 6
    ctx.fillStyle = C.muted
    ctx.textAlign = "left"
    ctx.fillText(text, bx, top + 118)
    ctx.textAlign = "center"
  }
}

function footer(ctx: Ctx, d: RoundTeamImageData) {
  const y = H - 40
  ctx.textBaseline = "alphabetic"
  if (d.venue) {
    ctx.textAlign = "left"
    ctx.fillStyle = C.white
    ctx.fillText(fitText(ctx, d.venue, d.site ? 560 : W - 2 * M, 22, 18, 650, false), M, y)
  }
  if (d.site) {
    ctx.textAlign = "right"
    ctx.fillStyle = C.muted
    ctx.fillText(fitText(ctx, d.site, 400, 22, 18, 600, false), W - M, y)
  }
}

export async function renderRoundTeamImage(d: RoundTeamImageData): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`900 200px ${FONT}`, "0123456789"),
    document.fonts.load(`850 40px ${FONT}`, "RAMZIY JAMOA -TUR РАМЗИЙ ЖАМОА"),
    document.fonts.load(`700 40px ${FONT}`, "Payariq Oltin Ligasi ‘’′ Пайариқ"),
    document.fonts.load(`500 40px ${FONT}`, "Abc ‘’′ Абв"),
  ]).catch(() => undefined)

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Brauzer rasm chizishni qo‘llab-quvvatlamaydi")

  background(ctx)
  await header(ctx, d)
  title(ctx, d)
  pitch(ctx)
  for (const p of d.players) {
    const spot = SPOT[p.slot]
    await medal(ctx, p, spot.x, spot.y)
    plate(ctx, p, spot.x, spot.y + MEDAL - 12)
  }
  footer(ctx, d)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Rasmni tayyorlab bo‘lmadi"))), "image/png"))
}
