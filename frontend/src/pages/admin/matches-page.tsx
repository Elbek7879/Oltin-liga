import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarCheck, CalendarClock, CalendarDays, CalendarPlus, ImageDown, ListChecks, Pencil, Trash, TriangleAlert } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useSearchParams } from "react-router"
import { z } from "zod"
import { api } from "@/api/client"
import { useAdminMutation } from "@/api/hooks"
import type { MatchInput } from "@/api/types"
import { AdminMatchItem } from "@/components/admin/admin-match-item"
import { AdminPageHeader, ConfirmAction, Field, ReadOnlyBanner, runAction, useReadOnly } from "@/components/admin/admin-ui"
import { ScheduleBoard, type ScheduleSection } from "@/components/admin/schedule-board"
import { MatchImageDialog, matchImageTitle } from "@/components/league/match-image-dialog"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/league/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { roundLabel } from "@/domain/playoff"
import { findScheduleConflicts, findVenueConflicts, primaryVenueId, toLocalIso } from "@/domain/schedule"
import type { Match, MatchStatus } from "@/domain/types"
import { useSeason } from "@/hooks/use-season"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { formatShortDate, formatTime, localDateKey, MATCH_STATUS_LABEL, todayKey } from "@/lib/format"
import { stageLabel } from "@/lib/match"

const NONE = "__none__"
const EDITABLE_STATUSES: MatchStatus[] = ["SCHEDULED", "POSTPONED", "CANCELLED"]

const schema = z
  .object({
    groupId: z.string().min(1, "Guruhni tanlang"),
    round: z.string().regex(/^\d{0,2}$/, "Tur raqami son bo‘lsin"),
    homeId: z.string(),
    awayId: z.string(),
    date: z.string().min(1, "Sanani tanlang"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Vaqtni tanlang"),
    venueId: z.string(),
    status: z.enum(["SCHEDULED", "POSTPONED", "CANCELLED", "LIVE", "FINISHED"]),
    referee: z.string().max(80),
    note: z.string().max(300),
  })
  .refine((v) => !v.homeId || v.homeId !== v.awayId, { message: "Jamoa o‘zi bilan o‘ynay olmaydi", path: ["awayId"] })
type Values = z.infer<typeof schema>

function MatchFormDialog({
  open,
  onOpenChange,
  match,
  index,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  match: Match | null
  index: SeasonIndex
}) {
  const { seasonId } = useSeason()
  const playoff = match?.stage === "PLAYOFF"
  const hasResult = match?.status === "FINISHED" || match?.status === "LIVE"
  const mutation = useAdminMutation((input: MatchInput) => (match ? api.updateMatch(match.id, input) : api.createMatch(seasonId!, input)))
  const groups = index.bundle.groups
  const defaults = (): Values => ({
    groupId: match?.groupId ?? groups[0]?.id ?? "",
    round: match?.round ? String(match.round) : "",
    homeId: match?.homeId ?? "",
    awayId: match?.awayId ?? "",
    date: match ? localDateKey(match.kickoff) : todayKey(),
    time: match ? formatTime(match.kickoff) : "16:00",
    venueId: match ? (match.venueId ?? NONE) : (primaryVenueId(index.bundle.venues, index.bundle.matches) ?? NONE),
    status: match?.status ?? "SCHEDULED",
    referee: match?.referee ?? "",
    note: match?.note ?? "",
  })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults() })
  useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, match?.id])

  const values = form.watch()
  const groupTeams = playoff
    ? index.bundle.teams
    : (groups.find((g) => g.id === values.groupId)?.seasonTeamIds ?? []).map((id) => index.team(id)!).filter(Boolean)

  const conflicts = useMemo(() => {
    if (!values.date || !values.time || !values.homeId || !values.awayId) return []
    return findScheduleConflicts(
      { id: match?.id ?? "new", homeId: values.homeId, awayId: values.awayId, kickoff: toLocalIso(values.date, values.time) },
      index.bundle.matches,
    )
  }, [values.date, values.time, values.homeId, values.awayId, match?.id, index])

  // Liga bitta stadionda o'ynaydi: shu vaqtda maydon bandmi
  const venueBusy = useMemo(() => {
    if (!values.date || !values.time || values.venueId === NONE) return []
    return findVenueConflicts({ id: match?.id ?? "new", venueId: values.venueId, kickoff: toLocalIso(values.date, values.time) }, index.bundle.matches)
  }, [values.date, values.time, values.venueId, match?.id, index])

  const onSubmit = form.handleSubmit(async (v) => {
    if (!playoff && (!v.homeId || !v.awayId)) {
      if (!v.homeId) form.setError("homeId", { message: "Birinchi jamoani tanlang" })
      if (!v.awayId) form.setError("awayId", { message: "Ikkinchi jamoani tanlang" })
      return
    }
    const input: MatchInput = {
      stage: playoff ? "PLAYOFF" : "GROUP",
      groupId: playoff ? null : v.groupId,
      round: v.round ? Number(v.round) : null,
      playoffRound: match?.playoffRound ?? null,
      homeId: v.homeId || null,
      awayId: v.awayId || null,
      kickoff: toLocalIso(v.date, v.time),
      venueId: v.venueId === NONE ? null : v.venueId,
      status: v.status,
      referee: v.referee,
      note: v.note,
    }
    const ok = await runAction(() => mutation.mutateAsync(input), match ? "O‘yin ma’lumotlari saqlandi" : "O‘yin taqvimga qo‘shildi")
    if (ok) onOpenChange(false)
  })
  const { errors } = form.formState

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{match ? "O‘yinni tahrirlash" : "Yangi o‘yin"}</DialogTitle>
          <DialogDescription>
            {playoff ? "Pley-off o‘yini: jamoalar sxema bo‘yicha avtomatik belgilanadi, sana va maydonni o‘zgartirish mumkin." : "Guruh, jamoalar, sana va maydonni tanlang."}
          </DialogDescription>
        </DialogHeader>
        <form id="match-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          {!playoff && (
            <>
              <Field label="Guruh" htmlFor="m-group" error={errors.groupId?.message} required>
                <Controller
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("homeId", ""); form.setValue("awayId", "") }} disabled={hasResult}>
                      <SelectTrigger id="m-group" className="w-full"><SelectValue placeholder="Guruhni tanlang" /></SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name} guruhi</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Tur" htmlFor="m-round" error={errors.round?.message} hint="Masalan, 3">
                <Input id="m-round" inputMode="numeric" {...form.register("round")} />
              </Field>
            </>
          )}
          {(["homeId", "awayId"] as const).map((name) => (
            <Field key={name} label={name === "homeId" ? "1-jamoa" : "2-jamoa"} htmlFor={`m-${name}`} error={errors[name]?.message} required>
              <Controller
                control={form.control}
                name={name}
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange} disabled={hasResult || playoff}>
                    <SelectTrigger id={`m-${name}`} className="w-full" aria-invalid={Boolean(errors[name])}>
                      <SelectValue placeholder="Jamoani tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          ))}
          <Field label="Sana" htmlFor="m-date" error={errors.date?.message} required>
            <Input id="m-date" type="date" {...form.register("date")} />
          </Field>
          <Field label="Boshlanish vaqti" htmlFor="m-time" error={errors.time?.message} required>
            <Input id="m-time" type="time" step={300} {...form.register("time")} />
          </Field>
          <Field label="Maydon" htmlFor="m-venue">
            <Controller
              control={form.control}
              name="venueId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="m-venue" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Belgilanmagan</SelectItem>
                    {index.bundle.venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Holati" htmlFor="m-status" hint={hasResult ? "Natijasi bor o‘yin holati «Natijalar» bo‘limida o‘zgartiriladi" : undefined}>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={hasResult}>
                  <SelectTrigger id="m-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(hasResult ? [field.value] : EDITABLE_STATUSES).map((s) => (
                      <SelectItem key={s} value={s}>{MATCH_STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Hakam" htmlFor="m-referee" error={errors.referee?.message} className="sm:col-span-2">
            <Input id="m-referee" placeholder="Ism va familiya" {...form.register("referee")} />
          </Field>
          <Field label="Izoh (muxlislarga ko‘rinadi)" htmlFor="m-note" error={errors.note?.message} className="sm:col-span-2">
            <Textarea id="m-note" rows={2} placeholder="Masalan: o‘yin yomg‘ir sababli qoldirildi" {...form.register("note")} />
          </Field>
          {(conflicts.length > 0 || venueBusy.length > 0) && (
            <div role="alert" className="flex gap-2 rounded-lg border border-gold/50 bg-gold-soft p-3 text-sm sm:col-span-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
              <div>
                <p className="font-semibold">Vaqt to‘qnashuvi</p>
                <ul className="mt-0.5 space-y-0.5">
                  {venueBusy.map((m) => (
                    <li key={`venue-${m.id}`}>
                      {index.venue(values.venueId)?.name} shu vaqtda band: {index.team(m.homeId)?.name ?? "Aniqlanmagan"} — {index.team(m.awayId)?.name ?? "Aniqlanmagan"},{" "}
                      {formatShortDate(m.kickoff)}, {formatTime(m.kickoff)}. Bir o‘yin maydonni taxminan 2 soat band qiladi.
                    </li>
                  ))}
                  {conflicts.map((c) => {
                    const m = index.bundle.matches.find((x) => x.id === c.matchId)!
                    const opponent = m.homeId === c.teamId ? m.awayId : m.homeId
                    return (
                      <li key={`${c.matchId}-${c.teamId}`}>
                        {index.team(c.teamId)?.name} shu vaqtga yaqin boshqa o‘yinda ham qatnashadi: {formatShortDate(m.kickoff)}, {formatTime(m.kickoff)}, raqib {index.team(opponent)?.name}.
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-1 text-muted-foreground">Saqlash mumkin, lekin vaqtni tekshirib ko‘ring.</p>
              </div>
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button type="submit" form="match-form" disabled={mutation.isPending}>
            {mutation.isPending ? "Saqlanmoqda…" : match ? "O‘zgarishlarni saqlash" : "O‘yinni qo‘shish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminMatchesPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const readOnly = useReadOnly()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Match | null>(null)
  const [formOpen, setFormOpen] = useState(params.get("yangi") === "1")
  const [group, setGroup] = useState("all")
  const [status, setStatus] = useState("all")
  const [imageFor, setImageFor] = useState<string | null>(null)
  const remove = useAdminMutation((id: string) => api.deleteMatch(id))
  const fixtures = useAdminMutation(() => api.generateFixtures(index!.bundle.season.id))

  const openForm = (m: Match | null) => {
    setEditing(m)
    setFormOpen(true)
  }
  const closeForm = (v: boolean) => {
    setFormOpen(v)
    if (!v && params.get("yangi")) setParams({}, { replace: true })
  }

  // Sanasi hali belgilanmagan o'yinlar: guruh turlari, so'ng pley-off bosqichlari
  const undated = useMemo((): ScheduleSection[] => {
    if (!index) return []
    const open = index.bundle.matches.filter((m) => m.timeConfirmed === false && m.status !== "FINISHED" && m.status !== "LIVE" && m.status !== "CANCELLED")
    const sections = new Map<string, ScheduleSection>()
    const order = (m: Match) => (m.stage === "GROUP" ? (m.round ?? 0) : 100 + ["R64", "R32", "R16", "QF", "SF", "THIRD", "F"].indexOf(m.playoffRound ?? ""))
    for (const m of [...open].sort((a, b) => order(a) - order(b) || a.kickoff.localeCompare(b.kickoff))) {
      const key = m.stage === "GROUP" ? `tur-${m.round ?? 0}` : `po-${m.playoffRound}`
      const title = m.stage === "GROUP" ? (m.round ? `${m.round}-tur` : "Guruh o‘yinlari") : m.playoffRound === "THIRD" ? "3-o‘rin uchun o‘yin" : roundLabel(m.playoffRound!, index.bundle.matches)
      const section = sections.get(key) ?? { key, title, matches: [] }
      section.matches.push(m)
      sections.set(key, section)
    }
    return [...sections.values()]
  }, [index])
  const groupsWithoutFixtures = index ? index.bundle.groups.filter((g) => !index.bundle.matches.some((m) => m.groupId === g.id)) : []

  const list = useMemo(() => {
    if (!index) return []
    return index.bundle.matches
      .filter((m) => group === "all" || (group === "playoff" ? m.stage === "PLAYOFF" : m.groupId === group))
      .filter((m) => status === "all" || m.status === status)
  }, [index, group, status])

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="O‘yinlar"
        description="Juftliklarni sayt qur’adan keyin o‘zi tuzadi. Siz har bir o‘yinning sanasi va vaqtini belgilaysiz — saqlangach saytda ko‘rinadi."
        actions={
          !readOnly && index ? (
            <>
              {groupsWithoutFixtures.length > 0 && (
                <Button onClick={() => runAction(() => fixtures.mutateAsync(undefined), "Juftliklar tuzildi. Endi sanalarni belgilang.")} disabled={fixtures.isPending}>
                  <ListChecks aria-hidden="true" />
                  Juftliklarni tuzish
                </Button>
              )}
              <Button variant="outline" onClick={() => openForm(null)} disabled={index.bundle.groups.length === 0}>
                <CalendarPlus aria-hidden="true" />
                O‘yin qo‘shish
              </Button>
            </>
          ) : undefined
        }
      />
      <ReadOnlyBanner />

      {index && groupsWithoutFixtures.length > 0 && index.bundle.groups.length > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-gold/60 bg-gold-soft px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
          <span>
            {groupsWithoutFixtures.map((g) => `${g.name} guruhi`).join(", ")}da juftliklar yo‘q. «Juftliklarni tuzish» tugmasini bosing — har bir jamoa guruhdagi boshqa jamoalar
            bilan o‘ynaydigan qilib turlar bo‘yicha taqsimlanadi.
          </span>
        </p>
      )}

      {index && undated.length > 0 && (
        <section className="panel mb-6 overflow-hidden" aria-labelledby="undated-title">
          <div className="border-b border-border px-4 py-3">
            <h2 id="undated-title" className="flex items-center gap-2 font-display text-lg">
              <CalendarClock className="size-5 text-gold-text" aria-hidden="true" />
              Sanasi belgilanmagan o‘yinlar ({undated.reduce((n, s) => n + s.matches.length, 0)})
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Muxlislar bu o‘yinlarda «Sana belgilanmagan» yozuvini ko‘radi. Har biriga sana va vaqtni tanlang. Butun tur bir kunda bo‘lsa, tur qatoridagi sanani tanlab «Bo‘shlarga qo‘yish»ni bosing.
            </p>
          </div>
          <ScheduleBoard sections={undated} index={index} readOnly={readOnly} metaOf={(m) => stageLabel(m, index)} />
        </section>
      )}
      {index && undated.length === 0 && index.bundle.matches.length > 0 && (
        <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarCheck className="size-4 text-win" aria-hidden="true" />
          Barcha o‘yinlarning sanasi belgilangan. Sanani o‘zgartirish uchun o‘yinni «Tahrirlash» orqali oching.
        </p>
      )}

      <h2 className="mb-2 font-display text-lg">Barcha o‘yinlar</h2>
      <div className="mb-4 grid grid-cols-2 gap-2 md:flex">
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger aria-label="Guruh" className="w-full md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha bosqichlar</SelectItem>
            {index?.bundle.groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name} guruhi</SelectItem>)}
            <SelectItem value="playoff">Pley-off</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Holat" className="w-full md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha holatlar</SelectItem>
            {(Object.keys(MATCH_STATUS_LABEL) as MatchStatus[]).map((s) => <SelectItem key={s} value={s}>{MATCH_STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <section className="panel overflow-hidden">
        {isLoading && !index ? (
          <ListSkeleton rows={6} />
        ) : error || !index ? (
          <ErrorState message={error?.message} onRetry={() => refetch()} />
        ) : index.bundle.groups.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Avval qur’a tashlang" description="Guruhlar tasdiqlanishi bilan sayt juftliklarni o‘zi tuzadi, siz faqat sanalarni belgilaysiz." />
        ) : list.length === 0 ? (
          <EmptyState icon={CalendarDays} title="O‘yinlar topilmadi" description="Filtrlarni o‘zgartiring yoki yangi o‘yin qo‘shing." />
        ) : (
          <div className="divide-y divide-border">
            {list.map((m) => (
              <AdminMatchItem
                key={m.id}
                match={m}
                team={index.team}
                meta={`${stageLabel(m, index)}${m.venueId ? `, ${index.venue(m.venueId)?.name}` : ""}`}
                action={
                  <>
                    {m.homeId && m.awayId && m.status !== "CANCELLED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setImageFor(m.id)}
                        aria-label={`${matchImageTitle(m)}: ${index.team(m.homeId)?.name} — ${index.team(m.awayId)?.name}`}
                      >
                        <ImageDown aria-hidden="true" />
                        Rasm
                      </Button>
                    )}
                    {!readOnly && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openForm(m)}>
                          <Pencil aria-hidden="true" />
                          Tahrirlash
                        </Button>
                        {m.stage === "GROUP" && m.status !== "FINISHED" && m.status !== "LIVE" && (
                          <ConfirmAction
                            trigger={
                              <Button size="sm" variant="ghost" aria-label="O‘yinni o‘chirish" className="text-destructive hover:text-destructive">
                                <Trash aria-hidden="true" />
                                <span className="sm:sr-only">O‘chirish</span>
                              </Button>
                            }
                            title="O‘yinni o‘chirasizmi?"
                            description={`${index.team(m.homeId)?.name} — ${index.team(m.awayId)?.name} o‘yini taqvimdan butunlay o‘chiriladi.`}
                            confirmLabel="Ha, o‘chirish"
                            onConfirm={() => runAction(() => remove.mutateAsync(m.id), "O‘yin o‘chirildi")}
                          />
                        )}
                      </>
                    )}
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      {index && <MatchFormDialog open={formOpen} onOpenChange={closeForm} match={editing} index={index} />}
      {index && imageFor && index.bundle.matches.some((m) => m.id === imageFor) && (
        <MatchImageDialog match={index.bundle.matches.find((m) => m.id === imageFor)!} index={index} open onOpenChange={(v) => !v && setImageFor(null)} />
      )}
    </div>
  )
}
