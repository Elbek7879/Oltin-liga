import { Ban } from "lucide-react"
import { useEffect, useState } from "react"
import { CardIcon } from "@/components/league/icons"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TeamView } from "@/api/types"
import type { ID } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { cn } from "@/lib/utils"

export type QuickGoalKind = "GOAL" | "PENALTY_GOAL" | "OWN_GOAL"
export type QuickCardKind = "YELLOW" | "SECOND_YELLOW" | "RED"

const GOAL_KINDS: { value: QuickGoalKind; label: string }[] = [
  { value: "GOAL", label: "Gol" },
  { value: "PENALTY_GOAL", label: "Penalti" },
  { value: "OWN_GOAL", label: "Avtogol" },
]
const CARD_KINDS: { value: QuickCardKind; label: string; icon: "yellow" | "second" | "red" }[] = [
  { value: "YELLOW", label: "Sariq", icon: "yellow" },
  { value: "SECOND_YELLOW", label: "Ikkinchi sariq", icon: "second" },
  { value: "RED", label: "Qizil", icon: "red" },
]

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-colors",
            value === o.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Tezkor kiritish: jamoa o'yinchilaridan birini bosish bilan gol yoki kartochka yoziladi.
 * Gol tanlansa hisob ham o'zi bittaga oshadi (bu mantiq chaqiruvchida).
 */
export function QuickEventDialog({
  open,
  onOpenChange,
  mode,
  team,
  opponent,
  roster,
  opponentRoster,
  index,
  suspended,
  onGoal,
  onCard,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "goal" | "card"
  team: TeamView
  opponent: TeamView
  roster: ID[]
  opponentRoster: ID[]
  index: SeasonIndex
  suspended: Set<ID>
  onGoal: (kind: QuickGoalKind, playerId: ID | null) => void
  onCard: (kind: QuickCardKind, playerId: ID) => void
}) {
  const [goalKind, setGoalKind] = useState<QuickGoalKind>("GOAL")
  const [cardKind, setCardKind] = useState<QuickCardKind>("YELLOW")
  useEffect(() => {
    if (open) {
      setGoalKind("GOAL")
      setCardKind("YELLOW")
    }
  }, [open])

  // Avtogolni raqib o'yinchisi uradi — hisob esa shu jamoaga qo'shiladi
  const own = mode === "goal" && goalKind === "OWN_GOAL"
  const list = own ? opponentRoster : roster
  const listTeam = own ? opponent : team

  const pick = (playerId: ID | null) => {
    if (mode === "goal") onGoal(goalKind, playerId)
    else if (playerId) onCard(cardKind, playerId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <TeamCrest team={team} size="sm" />
            {mode === "goal" ? `${team.name}: gol` : `${team.name}: kartochka`}
          </DialogTitle>
          <DialogDescription>
            {mode === "goal"
              ? own
                ? `Avtogol: ${opponent.name} o‘yinchisi o‘z darvozasiga urdi — gol ${team.name} hisobiga yoziladi.`
                : "Gol urgan o‘yinchini bosing — gol uning nomiga yoziladi va hisob bittaga oshadi."
              : "Kartochka turini tanlab, o‘yinchini bosing."}
          </DialogDescription>
        </DialogHeader>

        {mode === "goal" ? (
          <Segmented label="Gol turi" value={goalKind} onChange={setGoalKind} options={GOAL_KINDS} />
        ) : (
          <Segmented
            label="Kartochka turi"
            value={cardKind}
            onChange={setCardKind}
            options={CARD_KINDS.map((c) => ({ value: c.value, label: <><CardIcon kind={c.icon} /> {c.label}</> }))}
          />
        )}

        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {listTeam.name} tarkibida futbolchi yo‘q. Ularni «Futbolchilar» bo‘limida qo‘shing{mode === "goal" ? " yoki «Muallif noma’lum»ni tanlang" : ""}.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label={`${listTeam.name} o‘yinchilari`}>
            {list.map((id) => {
              const p = index.player(id)
              const n = index.numberOf(id)
              const banned = suspended.has(id)
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => pick(id)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-pitch-300 hover:bg-muted active:scale-[0.99]"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary font-score text-sm">{n ?? "—"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {p?.firstName} {p?.lastName}
                      </span>
                      {banned && (
                        <span className="inline-flex items-center gap-1 text-2xs font-semibold text-destructive">
                          <Ban className="size-3" aria-hidden="true" />
                          Diskvalifikatsiyada
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {mode === "goal" && (
          <Button type="button" variant="outline" onClick={() => pick(null)}>
            Muallif noma’lum
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
