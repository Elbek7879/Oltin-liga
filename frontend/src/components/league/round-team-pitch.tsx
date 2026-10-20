import { Plus } from "lucide-react"
import type { ReactNode } from "react"
import { BallIcon } from "@/components/league/icons"
import { TeamCrest } from "@/components/league/team-crest"
import type { TeamView } from "@/api/types"
import { ROUND_TEAM_SLOTS } from "@/domain/round-team"
import type { RoundTeamSlotKey } from "@/domain/types"
import { cn } from "@/lib/utils"

/** Maydondagi bitta futbolchi: ism, jamoa va shu turdagi ko'rsatkichlari */
export interface PitchPlayer {
  firstName: string
  lastName: string
  number?: number
  photoUrl?: string | null
  team?: TeamView
  goals: number
  assists: number
  /** Faqat darvozabon uchun: jamoasi gol o'tkazmagan */
  cleanSheet?: boolean
}

/**
 * «Romb» joylashuvi (maydon kengligiga nisbatan foizda). Maydon 4:5 nisbatda bo'lgani uchun
 * yon tomondagi yarim himoyachilar hujumchi va himoyachi bilan bir qatorda kesishmaydi.
 */
const PLACE: Record<RoundTeamSlotKey, { left: string; top: string }> = {
  FW: { left: "50%", top: "2.5%" },
  MF_L: { left: "17%", top: "19%" },
  MF_R: { left: "83%", top: "19%" },
  DF: { left: "50%", top: "36%" },
  GK: { left: "50%", top: "68%" },
}

/** Yuzi yo'q futbolchi uchun odamcha belgisi */
export function PlayerSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className={className}>
      <circle cx="50" cy="39" r="19" fill="currentColor" />
      <path d="M13 100c0-25 16-38 37-38s37 13 37 38Z" fill="currentColor" />
    </svg>
  )
}

/** Oltin halqali dumaloq medal: rasm yoki odamcha, chap tepada raqam, o'ng tepada jamoa nishoni */
export function PlayerMedal({ player, className }: { player: Pick<PitchPlayer, "photoUrl" | "number" | "team">; className?: string }) {
  return (
    <span className={cn("relative mx-auto block aspect-square size-[clamp(56px,17cqw,104px)] rounded-full p-[3px] shadow-[0_10px_24px_rgb(0_0_0/0.45)]", className)}>
      <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,#a8821f,#f0cf6a,#d9b13f,#f0cf6a,#a8821f)]" aria-hidden="true" />
      <span className="relative flex size-full items-end justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#1d5440,#0b2a1f)] text-pitch-300/80">
        {player.photoUrl ? (
          <img src={player.photoUrl} alt="" className="size-full object-cover object-[50%_25%]" loading="lazy" decoding="async" />
        ) : (
          <PlayerSilhouette className="size-[92%]" />
        )}
      </span>
      {player.number != null && (
        <span className="font-score absolute -top-1 -left-1.5 grid size-[clamp(22px,5.4cqw,34px)] place-items-center rounded-full border-2 border-[#d9b13f] bg-pitch-950 text-[clamp(11px,2.6cqw,17px)] text-gold-300">
          {player.number}
        </span>
      )}
      {player.team && (
        <span className="absolute -top-1 -right-2.5 drop-shadow-[0_3px_4px_rgb(0_0_0/0.5)]">
          <TeamCrest team={player.team} size="sm" className="w-[clamp(20px,5cqw,32px)]" />
        </span>
      )}
    </span>
  )
}

/** Har bir gol uchun to'p belgisi (ko'p bo'lsa — bitta to'p va son). Bezak: son matnda yoziladi */
export function GoalBalls({ goals, className }: { goals: number; className?: string }) {
  if (goals <= 0) return null
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden="true">
      {goals <= 4 ? (
        Array.from({ length: goals }, (_, i) => <BallIcon key={i} className="size-[1.1em]" />)
      ) : (
        <>
          <BallIcon className="size-[1.1em]" />×{goals}
        </>
      )}
    </span>
  )
}

/** Ko'rsatkichlar qatori: gollar to'p bilan, uzatmalar, darvozabonga «Quruq o'yin» */
export function statLine(p: Pick<PitchPlayer, "goals" | "assists" | "cleanSheet">) {
  const parts: string[] = []
  if (p.goals > 0) parts.push(`${p.goals} gol`)
  if (p.assists > 0) parts.push(`${p.assists} uzatma`)
  if (p.cleanSheet) parts.push("Quruq o‘yin")
  return parts.join(", ")
}

function SlotCard({ slot, player }: { slot: RoundTeamSlotKey; player: PitchPlayer }) {
  const label = ROUND_TEAM_SLOTS.find((s) => s.key === slot)!.label
  const stats = statLine(player)
  return (
    <>
      <PlayerMedal player={player} />
      <span className="relative -mt-2 block rounded-xl border-[1.5px] border-[#d9b13f]/60 bg-[rgb(4_20_13/0.86)] px-1.5 pt-[clamp(11px,2.6cqw,15px)] pb-1.5 text-white">
        <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d9b13f] px-2 py-[3px] text-[clamp(9px,2cqw,12px)] leading-none font-bold whitespace-nowrap text-pitch-950">
          {label}
        </span>
        <span className="block truncate text-[clamp(10px,2.3cqw,13px)] leading-tight text-pitch-200">{player.firstName}</span>
        <span className="font-display block truncate text-[clamp(13px,3.2cqw,19px)] leading-tight">{player.lastName}</span>
        <span className="block truncate text-[clamp(10px,2.3cqw,13px)] leading-tight font-semibold text-gold-300">{player.team?.name ?? "—"}</span>
        {stats && (
          <span className="mt-0.5 flex flex-wrap items-center justify-center gap-x-1 text-[clamp(10px,2.3cqw,13px)] leading-tight text-pitch-200">
            <GoalBalls goals={player.goals} className="text-white" />
            <span>{stats}</span>
          </span>
        )}
      </span>
    </>
  )
}

/**
 * Ramziy jamoa maydoni: tungi yashil maydon, oltin chiziqlar, 5 o'rin romb shaklida.
 * `renderSlot` berilsa (admin muharriri), har bir o'rin tugma sifatida o'sha funksiya orqali chiziladi.
 */
export function RoundTeamPitch({
  players,
  renderSlot,
  className,
  children,
}: {
  players: Partial<Record<RoundTeamSlotKey, PitchPlayer>>
  renderSlot?: (slot: RoundTeamSlotKey, card: ReactNode | null) => ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        "@container relative isolate aspect-[4/5] w-full overflow-hidden rounded-2xl border-2 border-[#d9b13f]/45 bg-[repeating-linear-gradient(180deg,rgb(255_255_255/0.03)_0_10%,transparent_10%_20%),linear-gradient(180deg,#0f3d2d,#0a2b20)]",
        className,
      )}
    >
      <svg viewBox="0 0 400 500" preserveAspectRatio="none" aria-hidden="true" focusable="false" className="absolute inset-0 -z-10 size-full">
        <g fill="none" stroke="#d9b13f" strokeOpacity="0.38" strokeWidth="2" vectorEffect="non-scaling-stroke">
          <rect x="14" y="14" width="372" height="472" rx="6" vectorEffect="non-scaling-stroke" />
          <line x1="14" y1="250" x2="386" y2="250" vectorEffect="non-scaling-stroke" />
          <ellipse cx="200" cy="250" rx="46" ry="37" vectorEffect="non-scaling-stroke" />
          <path d="M120 14v42h160V14" vectorEffect="non-scaling-stroke" />
          <path d="M120 486v-42h160v42" vectorEffect="non-scaling-stroke" />
          <path d="M160 444a40 26 0 0 1 80 0" vectorEffect="non-scaling-stroke" />
          <path d="M160 56a40 26 0 0 0 80 0" vectorEffect="non-scaling-stroke" />
        </g>
        <circle cx="200" cy="250" r="3" fill="#d9b13f" fillOpacity="0.5" />
      </svg>
      {ROUND_TEAM_SLOTS.map(({ key }) => {
        const player = players[key]
        const card = player ? <SlotCard slot={key} player={player} /> : null
        return (
          <div key={key} className="absolute w-[30cqw] -translate-x-1/2 text-center" style={PLACE[key]}>
            {renderSlot ? renderSlot(key, card) : card}
          </div>
        )
      })}
      {children}
    </div>
  )
}

/** Admin muharriridagi bo'sh o'rin: «+ Darvozabon» */
export function EmptySlot({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "mx-auto mt-[2cqw] flex min-h-[24cqw] w-[28cqw] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-gold-300/75 bg-gold-300/8 px-1 py-2 text-center text-[clamp(11px,2.5cqw,14px)] leading-tight font-bold text-gold-300 transition-colors duration-150",
        active && "border-solid bg-gold-300/22 shadow-[0_0_0_4px_rgb(237_210_127/0.3)]",
      )}
    >
      <span className="grid size-[clamp(28px,7cqw,40px)] place-items-center rounded-full bg-gold-300 text-pitch-950">
        <Plus className="size-[60%]" strokeWidth={3} aria-hidden="true" />
      </span>
      {label}
    </span>
  )
}
