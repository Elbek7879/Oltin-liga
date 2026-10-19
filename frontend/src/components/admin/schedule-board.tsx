import { CalendarCheck, CalendarClock, CircleCheck, RotateCcw, Save, TriangleAlert } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { api } from "@/api/client"
import { useAdminMutation } from "@/api/hooks"
import { runAction } from "@/components/admin/admin-ui"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { findScheduleConflicts, findVenueConflicts, primaryVenueId, toLocalIso } from "@/domain/schedule"
import type { ID, Match } from "@/domain/types"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { formatShortDate, formatTime, localDateKey } from "@/lib/format"
import { cn } from "@/lib/utils"

const NO_VENUE = "none"

export interface ScheduleSection {
  key: string
  title: string
  matches: Match[]
}

interface Draft {
  date: string
  time: string
  venue: string
}

/** Saqlangan qiymat: sana belgilanmagan o'yinda maydonlar bo'sh — sanani tashkilotchi o'zi tanlaydi */
function original(m: Match, fallbackVenue: string): Draft {
  const confirmed = m.timeConfirmed !== false
  return {
    date: confirmed ? localDateKey(m.kickoff) : "",
    time: confirmed ? formatTime(m.kickoff) : "",
    venue: m.venueId ?? fallbackVenue,
  }
}

const sideName = (m: Match, side: "home" | "away", index: SeasonIndex) =>
  index.team(side === "home" ? m.homeId : m.awayId)?.name ?? (side === "home" ? m.homeLabel : m.awayLabel) ?? "Aniqlanmagan"

/**
 * O'yinlar sanasi va vaqtini belgilash ro'yxati. Sayt sanani o'zi qo'ymaydi:
 * har bir o'yinga tashkilotchi sana va vaqt kiritadi, «Saqlash» bosilgach saytda ko'rinadi.
 * Qulaylik uchun butun turga bitta sanani qo'yish mumkin; vaqtlar baribir har o'yinga alohida.
 */
export function ScheduleBoard({ sections, index, readOnly, metaOf }: { sections: ScheduleSection[]; index: SeasonIndex; readOnly: boolean; metaOf?: (m: Match) => string }) {
  const fallbackVenue = primaryVenueId(index.bundle.venues, index.bundle.matches) ?? NO_VENUE
  const all = useMemo(() => sections.flatMap((s) => s.matches), [sections])
  const signature = all.map((m) => `${m.id}:${m.kickoff}:${m.timeConfirmed}:${m.venueId}`).join("|")
  const [drafts, setDrafts] = useState<Record<ID, Draft>>({})
  const [roundDate, setRoundDate] = useState<Record<string, string>>({})

  // Ma'lumot yangilansa (saqlangandan keyin) — qatorlar saqlangan qiymatga qaytadi
  useEffect(() => {
    setDrafts(Object.fromEntries(all.map((m) => [m.id, original(m, fallbackVenue)])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const draftOf = (m: Match) => drafts[m.id] ?? original(m, fallbackVenue)
  const isDirty = (m: Match) => {
    const d = draftOf(m)
    const o = original(m, fallbackVenue)
    return Boolean(d.date && d.time) && (d.date !== o.date || d.time !== o.time || d.venue !== o.venue || m.timeConfirmed === false)
  }
  const isPartial = (m: Match) => {
    const d = draftOf(m)
    return Boolean(d.date) !== Boolean(d.time)
  }
  const dirty = all.filter(isDirty)
  const partial = all.filter(isPartial)

  // To'qnashuvlar: saqlangan o'yinlar va hali saqlanmagan qatorlar birga tekshiriladi
  const planned = useMemo(() => {
    const changed = new Map(dirty.map((m) => [m.id, draftOf(m)]))
    return index.bundle.matches.map((m) => {
      const d = changed.get(m.id)
      return d ? { ...m, kickoff: toLocalIso(d.date, d.time), venueId: d.venue === NO_VENUE ? null : d.venue, timeConfirmed: true } : m
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, index])

  const update = (id: ID, patch: Partial<Draft>) => setDrafts((s) => ({ ...s, [id]: { ...(s[id] ?? { date: "", time: "", venue: fallbackVenue }), ...patch } }))

  const fillRound = (section: ScheduleSection) => {
    const date = roundDate[section.key]
    if (!date) return
    setDrafts((s) => {
      const next = { ...s }
      for (const m of section.matches) if (!next[m.id]?.date) next[m.id] = { ...(next[m.id] ?? original(m, fallbackVenue)), date }
      return next
    })
  }

  const save = useAdminMutation(async (rows: Match[]) => {
    for (const m of rows) {
      const d = draftOf(m)
      await api.scheduleMatch(m.id, { kickoff: toLocalIso(d.date, d.time), venueId: d.venue === NO_VENUE ? null : d.venue })
    }
  })
  const submit = () => runAction(() => save.mutateAsync(dirty), `${dirty.length} ta o‘yin sanasi saqlandi — saytda ko‘rinadi`)

  return (
    <div>
      {sections.map((section) => (
        <div key={section.key}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-muted/60 px-4 py-2">
            <h3 className="text-sm font-semibold">
              {section.title}
              <span className="ml-1.5 font-normal text-muted-foreground">({section.matches.length} ta o‘yin)</span>
            </h3>
            {!readOnly && section.matches.length > 1 && (
              <div className="ml-auto flex items-center gap-2">
                <Input
                  type="date"
                  value={roundDate[section.key] ?? ""}
                  onChange={(e) => setRoundDate((s) => ({ ...s, [section.key]: e.target.value }))}
                  aria-label={`${section.title}: hamma o‘yinlar uchun sana`}
                  className="h-9 w-40 bg-card"
                />
                <Button type="button" size="sm" variant="outline" onClick={() => fillRound(section)} disabled={!roundDate[section.key]}>
                  Bo‘shlarga qo‘yish
                </Button>
              </div>
            )}
          </div>
          <ul className="divide-y divide-border">
            {section.matches.map((m) => {
              const d = draftOf(m)
              const label = `${sideName(m, "home", index)} — ${sideName(m, "away", index)}`
              const changed = isDirty(m)
              const confirmed = m.timeConfirmed !== false
              const when = d.date && d.time ? toLocalIso(d.date, d.time) : null
              const venueBusy = when ? findVenueConflicts({ id: m.id, venueId: d.venue === NO_VENUE ? null : d.venue, kickoff: when }, planned) : []
              const teamBusy = when ? findScheduleConflicts({ id: m.id, homeId: m.homeId, awayId: m.awayId, kickoff: when }, planned) : []
              return (
                <li key={m.id} className={cn("grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9.5rem_7rem_minmax(0,13rem)] sm:items-center", !confirmed && !changed && "bg-gold-soft/30")}>
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                      <TeamCrest team={index.team(m.homeId)} size="xs" />
                      <span className="truncate">{label}</span>
                      <TeamCrest team={index.team(m.awayId)} size="xs" />
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {metaOf && <span>{metaOf(m)}</span>}
                      {changed ? (
                        <span className="font-semibold text-gold-text">Saqlanmagan</span>
                      ) : confirmed ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-win">
                          <CircleCheck className="size-3.5" aria-hidden="true" />
                          Saytda ko‘rinadi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-gold-text">
                          <CalendarClock className="size-3.5" aria-hidden="true" />
                          Sana belgilanmagan
                        </span>
                      )}
                    </p>
                  </div>
                  {readOnly ? (
                    <p className="col-span-2 text-sm sm:col-span-3">{confirmed ? `${formatShortDate(m.kickoff)}, ${formatTime(m.kickoff)}` : "—"}</p>
                  ) : (
                    <>
                      <Input type="date" value={d.date} onChange={(e) => update(m.id, { date: e.target.value })} aria-label={`${label}: sana`} />
                      <Input type="time" step={300} value={d.time} onChange={(e) => update(m.id, { time: e.target.value })} aria-label={`${label}: boshlanish vaqti`} />
                      <Select value={d.venue} onValueChange={(v) => update(m.id, { venue: v })}>
                        <SelectTrigger aria-label={`${label}: maydon`} className="col-span-2 w-full sm:col-span-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_VENUE}>Maydon belgilanmagan</SelectItem>
                          {index.bundle.venues.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  {isPartial(m) && !readOnly && (
                    <p className="col-span-2 text-xs text-gold-text sm:col-span-4">{d.date ? "Boshlanish vaqtini ham tanlang." : "Sanani ham tanlang."}</p>
                  )}
                  {(venueBusy.length > 0 || teamBusy.length > 0) && (
                    <p role="alert" className="col-span-2 flex items-start gap-1.5 text-xs text-gold-text sm:col-span-4">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {venueBusy.length > 0 &&
                          `Stadion shu vaqtda band: ${venueBusy.map((b) => `${sideName(b, "home", index)} — ${sideName(b, "away", index)}, ${formatTime(b.kickoff)}`).join("; ")}. Bir o‘yin maydonni taxminan 2 soat band qiladi. `}
                        {teamBusy.length > 0 &&
                          `${[...new Set(teamBusy.map((c) => index.team(c.teamId)?.name))].join(", ")} shu kunga yaqin boshqa o‘yinda ham qatnashadi.`}
                      </span>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {!readOnly && (
        <div className="sticky bottom-16 z-10 flex flex-wrap items-center gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:bottom-0">
          <p className="min-w-0 flex-1 text-sm" aria-live="polite">
            {dirty.length > 0 ? (
              <span className="font-semibold">{dirty.length} ta o‘yinning sanasi saqlanmagan</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CalendarCheck className="size-4" aria-hidden="true" />
                Sana va vaqtni tanlang — «Saqlash»dan keyin saytda ko‘rinadi
              </span>
            )}
            {partial.length > 0 && <span className="block text-xs text-gold-text">{partial.length} ta qatorda sana yoki vaqt to‘liq emas</span>}
          </p>
          {dirty.length > 0 && (
            <Button type="button" variant="ghost" onClick={() => setDrafts(Object.fromEntries(all.map((m) => [m.id, original(m, fallbackVenue)])))}>
              <RotateCcw aria-hidden="true" />
              Bekor qilish
            </Button>
          )}
          <Button type="button" onClick={submit} disabled={dirty.length === 0 || save.isPending}>
            <Save aria-hidden="true" />
            {save.isPending ? "Saqlanmoqda…" : dirty.length > 0 ? `Saqlash (${dirty.length})` : "Saqlash"}
          </Button>
        </div>
      )}
    </div>
  )
}
