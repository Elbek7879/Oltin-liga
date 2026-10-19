import { ArrowDown, ArrowUp, Dices, ListOrdered } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "@/api/client"
import { useAdminMutation } from "@/api/hooks"
import { runAction } from "@/components/admin/admin-ui"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ID } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { cn } from "@/lib/utils"

/**
 * Teng holat uchun qur'a: tizim tasodifiy tartib tanlaydi yoki tashkilotchi joyida o'tkazilgan qur'a natijasini kiritadi.
 * Natija o'zgarishlar tarixiga yoziladi; pley-off setkasi darhol yangilanadi.
 */
export function LotDialog({
  open,
  onOpenChange,
  seasonId,
  scope,
  teamIds,
  title,
  description,
  index,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  seasonId: ID
  scope: string
  teamIds: ID[]
  title: string
  description: string
  index: SeasonIndex
}) {
  const [mode, setMode] = useState<"random" | "manual">("random")
  const [order, setOrder] = useState<ID[]>(teamIds)
  const mutation = useAdminMutation((random: boolean) => api.drawLot(seasonId, { scope, seasonTeamIds: random ? teamIds : order, random }))

  useEffect(() => {
    if (open) {
      setMode("random")
      setOrder(teamIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }

  const submit = async () => {
    const ok = await runAction(
      () => mutation.mutateAsync(mode === "random").then(() => true),
      mode === "random" ? "Qur’a tashlandi. Natija jadval va setkada ko‘rinadi." : "Qur’a natijasi saqlandi",
    )
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Qur’a usuli" className="grid gap-2 sm:grid-cols-2">
          {(
            [
              { value: "random", icon: Dices, label: "Tizim tashlasin", hint: "Tasodifiy tartib, natija tarixga yoziladi" },
              { value: "manual", icon: ListOrdered, label: "Natijani kiritaman", hint: "Qur’a joyida o‘tkazilgan bo‘lsa" },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={mode === o.value}
              onClick={() => setMode(o.value)}
              className={cn(
                "flex min-h-16 items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                mode === o.value ? "border-primary bg-secondary dark:border-gold-400" : "border-border hover:bg-muted",
              )}
            >
              <o.icon className="mt-0.5 size-5 shrink-0 text-pitch-600 dark:text-gold-400" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {mode === "random" ? (
          <ul className="space-y-1.5 rounded-xl bg-muted p-3 text-sm">
            {teamIds.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <TeamCrest team={index.team(id)} size="xs" />
                <span className="font-semibold">{index.team(id)?.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Qur’a natijasi bo‘yicha yuqoridan pastga tartiblang: birinchi turgan jamoa yuqoriroq o‘rinni oladi.</p>
            <ol className="space-y-1.5">
              {order.map((id, i) => (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
                  <span className="w-5 font-score text-muted-foreground">{i + 1}</span>
                  <TeamCrest team={index.team(id)} size="xs" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{index.team(id)?.name}</span>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`${index.team(id)?.name}ni yuqoriga`} onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`${index.team(id)?.name}ni pastga`} onClick={() => move(i, 1)} disabled={i === order.length - 1}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            <Dices aria-hidden="true" />
            {mutation.isPending ? "Saqlanmoqda…" : mode === "random" ? "Qur’a tashlash" : "Natijani saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
