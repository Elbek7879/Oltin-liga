import type { SeasonBundle } from "@/api/types"
import { playoffOverview } from "./playoff-overview"

export type StepState = "done" | "current" | "todo" | "attention"

export interface RoadmapStep {
  key: string
  title: string
  /** Hozirgi holat — bir jumla */
  detail: string
  state: StepState
  /** Majburiy emas (masalan, futbolchilar ro'yxati) */
  optional?: boolean
  action?: { label: string; to: string }
}

const MIN_TEAMS = 4

/**
 * Mavsum yo'l xaritasi: tashkilotchi nima qilingani va keyingi qadam nima ekanini bir qarashda ko'radi.
 * Hammasi mavsum ma'lumotidan hisoblanadi, alohida saqlanmaydi.
 */
export function seasonRoadmap(bundle: SeasonBundle): RoadmapStep[] {
  const { teams, groups, rosters, season } = bundle
  const ov = playoffOverview(bundle)
  const inGroups = new Set(groups.flatMap((g) => g.seasonTeamIds))
  const withPlayers = new Set(rosters.map((r) => r.seasonTeamId))
  const noPlayers = teams.filter((t) => !withPlayers.has(t.id)).length
  const finishedGroup = ov.groupMatches.filter((m) => m.status === "FINISHED").length
  const undatedGroup = ov.groupMatches.filter((m) => m.timeConfirmed === false && m.status !== "CANCELLED").length
  const final = ov.playoff.find((m) => m.playoffRound === "F")

  const steps: (Omit<RoadmapStep, "state"> & { done: boolean; attention?: boolean })[] = [
    {
      key: "season",
      title: "Mavsumni boshlash",
      detail: season.status === "DRAFT" ? "Mavsum tayyorlanmoqda — «Boshlash» bosilgach saytda joriy mavsum bo‘ladi" : `${season.year}-yil, ${season.name} ochilgan`,
      done: season.status !== "DRAFT",
      action: { label: "Mavsumlar", to: "/admin/mavsumlar" },
    },
    {
      key: "teams",
      title: "Jamoalarni qo‘shish",
      detail: teams.length >= MIN_TEAMS ? `${teams.length} ta jamoa ishtirok etadi` : `Kamida ${MIN_TEAMS} ta jamoa kerak, hozir ${teams.length} ta`,
      done: teams.length >= MIN_TEAMS,
      action: { label: "Jamoalar", to: "/admin/jamoalar" },
    },
    {
      key: "players",
      title: "Futbolchilar ro‘yxati",
      optional: true,
      detail:
        teams.length === 0
          ? "Jamoalar qo‘shilgach kiritiladi"
          : noPlayers === 0
            ? "Barcha jamoalarning tarkibi kiritilgan"
            : `${noPlayers} ta jamoada tarkib yo‘q — gol mualliflarini belgilash uchun kerak`,
      done: teams.length > 0 && noPlayers === 0,
      action: { label: "Futbolchilar", to: "/admin/futbolchilar" },
    },
    {
      key: "draw",
      title: "Qur’a: guruhlarni tuzish",
      detail:
        groups.length === 0
          ? "Guruhlar hali tuzilmagan"
          : inGroups.size < teams.length
            ? `${teams.length - inGroups.size} ta jamoa guruhga kiritilmagan`
            : `${groups.length} ta guruh: ${ov.groups.map((g) => `${g.group.name} (${g.size})`).join(", ")}`,
      done: groups.length > 0 && inGroups.size >= teams.length,
      action: { label: "Guruhlar", to: "/admin/guruhlar" },
    },
    {
      key: "schedule",
      title: "Guruh o‘yinlari sanalari",
      detail:
        ov.groupMatches.length === 0
          ? "Qur’a tasdiqlanishi bilan juftliklar o‘zi tuziladi"
          : undatedGroup > 0
            ? `${undatedGroup} ta o‘yinning sanasi belgilanmagan (jami ${ov.groupMatches.length} ta juftlik)`
            : `Barcha ${ov.groupMatches.length} ta o‘yinning sanasi belgilangan`,
      done: ov.groupMatches.length > 0 && undatedGroup === 0,
      action: { label: "Sanalarni belgilash", to: "/admin/oyinlar" },
    },
    {
      key: "results",
      title: "Guruh bosqichi natijalari",
      detail: ov.groupMatches.length > 0 ? `${finishedGroup} / ${ov.groupMatches.length} ta o‘yin yakunlangan` : "O‘yinlar belgilangach boshlanadi",
      done: ov.complete,
      action: { label: "Natijalar", to: "/admin/natijalar" },
    },
    {
      key: "ties",
      title: "Teng holatlar bo‘yicha qur’a",
      detail:
        ov.complete && ov.groupTies.length > 0
          ? `${ov.groupTies.map((t) => `${t.group.name} guruhi`).join(", ")}: jamoalar barcha mezonlar bo‘yicha teng — qur’a tashlang`
          : ov.complete
            ? "Teng holat yo‘q — qur’a kerak emas"
            : "Kerak bo‘lsa, guruh bosqichi tugagach shu yerda ko‘rinadi",
      done: ov.complete && ov.groupTies.length === 0,
      attention: ov.complete && ov.groupTies.length > 0,
      action: { label: "Qur’a tashlash", to: "/admin/pley-off" },
    },
    {
      key: "bracket",
      title: "Pley-off setkasi",
      detail: ov.playoff.length > 0 ? `Setka tuzildi: ${ov.playoff.length} ta o‘yin, raqiblar avtomatik aniqlangan` : "Guruh bosqichi tugashi bilan avtomatik tuziladi",
      done: ov.playoff.length > 0,
      action: { label: "Pley-off", to: "/admin/pley-off" },
    },
    {
      key: "dates",
      title: "Pley-off sana va vaqtlari",
      detail:
        ov.playoff.length === 0
          ? "Setka tuzilgach har bir o‘yinga sana va vaqt belgilanadi"
          : ov.unconfirmed.length > 0
            ? `${ov.unconfirmed.length} ta o‘yinning sanasi belgilanmagan — muxlislarga «Sana belgilanmagan» deb ko‘rinmoqda`
            : "Barcha o‘yinlar sanasi e’lon qilingan",
      done: ov.playoff.length > 0 && ov.unconfirmed.length === 0,
      attention: ov.unconfirmed.length > 0,
      action: { label: "Sanalarni belgilash", to: "/admin/pley-off" },
    },
    {
      key: "finish",
      title: "Final va mavsumni yakunlash",
      detail:
        season.status === "FINISHED"
          ? "Mavsum yakunlangan, chempion arxivga yozilgan"
          : final?.status === "FINISHED"
            ? "Final o‘tkazildi — mavsumni yakunlab, chempionni e’lon qiling"
            : "Final o‘yinidan keyin",
      done: season.status === "FINISHED",
      attention: season.status !== "FINISHED" && final?.status === "FINISHED",
      action: { label: "Mavsumlar", to: "/admin/mavsumlar" },
    },
  ]

  // Birinchi bajarilmagan majburiy qadam — «hozirgi»; diqqat talab qiladiganlar alohida belgilanadi
  let currentSet = false
  return steps.map(({ done, attention, ...s }) => {
    let state: StepState = done ? "done" : "todo"
    if (attention) state = "attention"
    else if (!done && !s.optional && !currentSet) {
      state = "current"
      currentSet = true
    }
    return { ...s, state }
  })
}
