import { CalendarCheck, CalendarClock, Dices, Network, Trash, TriangleAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { api } from "@/api/client"
import { useAdminMutation } from "@/api/hooks"
import { AdminMatchItem } from "@/components/admin/admin-match-item"
import { AdminPageHeader, ConfirmAction, Field, ReadOnlyBanner, runAction, useReadOnly } from "@/components/admin/admin-ui"
import { ScheduleBoard } from "@/components/admin/schedule-board"
import { LotDialog } from "@/components/admin/lot-dialog"
import { Bracket } from "@/components/league/bracket"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { createBracket, ROUND_SEQUENCE, roundLabel, type PlayoffPlan } from "@/domain/playoff"
import { addDays, primaryVenueId } from "@/domain/schedule"
import type { PlayoffRoundKey } from "@/domain/types"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { todayKey } from "@/lib/format"
import { planSummary, playoffOverview } from "@/lib/playoff-overview"

const ROUND_ORDER: PlayoffRoundKey[] = [...ROUND_SEQUENCE.slice(0, -1), "THIRD", "F"]

/** Guruhlardan kim chiqishi va pley-off qanday boshlanishi — tashkilotchi uchun qisqa tushuntirish */
function FormatSummary({ plan, overview }: { plan: PlayoffPlan; overview: ReturnType<typeof playoffOverview> }) {
  return (
    <section className="panel p-4 md:p-5" aria-labelledby="format-title">
      <h2 id="format-title" className="section-title">
        Pley-off formati
      </h2>
      <p className="mt-1 text-sm">{planSummary(plan)}</p>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {overview.groups.map(({ group, size, qualifiers }) => (
          <li key={group.id} className="rounded-lg border border-border px-2.5 py-1">
            <span className="font-semibold">{group.name} guruhi</span>
            <span className="text-muted-foreground">
              {" "}
              ({size} jamoa) — {qualifiers} ta chiqadi
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Chiqadigan jamoalar soni guruh hajmiga bog‘liq; uni{" "}
        <Link to="/admin/sozlamalar?tab=nizom" className="font-semibold underline">
          Sozlamalar → Liga nizomi
        </Link>
        da o‘zgartirish mumkin. Saralashsiz kim o‘tishini reyting hal qiladi: avval guruh g‘oliblari, keyin ikkinchilar, keyin uchinchilar; bir xil
        o‘rindagilar o‘yin boshiga o‘rtacha ochko, to‘plar farqi va urilgan gollar bo‘yicha solishtiriladi.
      </p>
    </section>
  )
}

/** Pley-off reytingi: kim to'g'ridan-to'g'ri o'tadi, kim saralash o'ynaydi */
function SeedingTable({ plan, index, projected }: { plan: PlayoffPlan; index: SeasonIndex; projected: boolean }) {
  const direct = plan.seeds.length - plan.playIns.length * 2
  const perGame = (id: string) => {
    for (const rows of Object.values(index.bundle.standings)) {
      const r = rows.find((x) => x.seasonTeamId === id)
      if (r) return r.played ? (r.points / r.played).toFixed(2) : "—"
    }
    return "—"
  }
  return (
    <section className="panel overflow-hidden" aria-labelledby="seeding-title">
      <div className="border-b border-border px-4 py-3">
        <h2 id="seeding-title" className="font-display text-lg">
          {projected ? "Taxminiy reyting (joriy jadval bo‘yicha)" : "Pley-off reytingi"}
        </h2>
        {projected && <p className="text-xs text-muted-foreground">Guruh bosqichi tugaguncha o‘zgarishi mumkin.</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Pley-off reytingi</caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="w-12 py-2 pl-4 text-left font-medium">№</th>
              <th scope="col" className="py-2 text-left font-medium">Jamoa</th>
              <th scope="col" className="hidden py-2 text-left font-medium sm:table-cell">Guruhda</th>
              <th scope="col" className="py-2 text-right font-medium"><abbr title="O‘yin boshiga o‘rtacha ochko" className="no-underline">O/o‘yin</abbr></th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Yo‘li</th>
            </tr>
          </thead>
          <tbody>
            {plan.seeds.map((s) => (
              <tr key={s.seasonTeamId} className="border-b border-border last:border-0">
                <td className="py-2 pl-4 font-score text-muted-foreground">{s.seed}</td>
                <td className="py-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <TeamCrest team={index.team(s.seasonTeamId)} size="xs" />
                    <span className="min-w-0">
                      {index.team(s.seasonTeamId)?.name}
                      <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                        {s.groupName} guruhi, {s.position}-o‘rin
                      </span>
                    </span>
                  </span>
                </td>
                <td className="hidden py-2 text-muted-foreground sm:table-cell">
                  {s.groupName} guruhi, {s.position}-o‘rin
                </td>
                <td className="py-2 text-right font-score">{perGame(s.seasonTeamId)}</td>
                <td className="py-2 pr-4 text-right">
                  {s.seed <= direct ? (
                    <span className="rounded bg-qualify-soft px-1.5 py-0.5 text-2xs font-semibold text-win">To‘g‘ridan-to‘g‘ri</span>
                  ) : (
                    <span className="rounded bg-gold-soft px-1.5 py-0.5 text-2xs font-semibold text-gold-text">Saralash</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Bitta pley-off o'yini sanasi, vaqti va maydoni */
export default function AdminPlayoffPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const readOnly = useReadOnly()
  const desktop = useMediaQuery("(min-width: 1024px)")
  const [third, setThird] = useState(true)
  const [startDate, setStartDate] = useState(addDays(todayKey(), 7))
  const [lot, setLot] = useState<{ scope: string; teamIds: string[]; title: string; description: string } | null>(null)
  const overview = useMemo(() => (index ? playoffOverview(index.bundle) : null), [index])
  const create = useAdminMutation(() =>
    api.createPlayoff(index!.bundle.season.id, {
      thirdPlace: third,
      startDate,
      venueId: primaryVenueId(index!.bundle.venues, index!.bundle.matches),
    }),
  )
  const remove = useAdminMutation(() => api.deletePlayoff(index!.bundle.season.id))

  const projectedMatches = useMemo(() => {
    if (!index || !overview || overview.playoff.length > 0 || overview.plan.error) return []
    let n = 0
    return createBracket({
      seasonId: index.bundle.season.id,
      plan: overview.plan,
      thirdPlace: index.bundle.season.rules.thirdPlaceMatch,
      kickoffFor: () => index.bundle.season.endDate + "T18:00:00+05:00",
      newId: () => `projected-${n++}`,
      timeConfirmed: false,
    })
  }, [index, overview])

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index || !overview) return <ErrorState message={error?.message} onRetry={() => refetch()} />

  const { playoff, started, unfinished, complete, plan, groupTies, unconfirmed } = overview
  const seasonId = index.bundle.season.id
  const shown = playoff.length > 0 ? playoff : projectedMatches
  const byRound = ROUND_ORDER.map((r) => ({
    round: r,
    list: playoff.filter((m) => m.playoffRound === r).sort((a, b) => (a.bracketIndex ?? 0) - (b.bracketIndex ?? 0)),
  })).filter((x) => x.list.length > 0)

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Pley-off"
        description="Guruh bosqichi tugashi bilan setka o‘zi tuziladi va raqiblar aniqlanadi. Sizdan faqat o‘yinlar sanasi va vaqtini belgilash talab qilinadi."
        actions={
          !readOnly && playoff.length > 0 && !started ? (
            <ConfirmAction
              trigger={
                <Button variant="outline" className="text-destructive">
                  <Trash aria-hidden="true" />
                  Setkani o‘chirish
                </Button>
              }
              title="Pley-off setkasini o‘chirasizmi?"
              description="Barcha pley-off o‘yinlari va belgilangan sanalar o‘chiriladi. Keyin setkani yangi boshlanish sanasi bilan qayta tuzishingiz mumkin."
              confirmLabel="Ha, o‘chirish"
              onConfirm={() => runAction(() => remove.mutateAsync(undefined), "Pley-off setkasi o‘chirildi")}
            />
          ) : undefined
        }
      />
      <ReadOnlyBanner />

      <div className="space-y-5">
        {playoff.length === 0 && !readOnly && overview.groupMatches.length > 0 && (
          <section className="panel p-4 md:p-5" aria-live="polite">
            {!complete ? (
              <p className="flex items-start gap-3 text-sm">
                <CalendarClock className="mt-0.5 size-5 shrink-0 text-pitch-600 dark:text-gold-400" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">Guruh bosqichida {unfinished} ta o‘yin qoldi</span>
                  Oxirgi guruh o‘yini natijasi kiritilishi bilan setka avtomatik tuziladi.{" "}
                  <Link to="/admin/natijalar" className="font-semibold underline">
                    Natijalarni kiritish
                  </Link>
                </span>
              </p>
            ) : groupTies.length > 0 ? (
              <p className="flex items-start gap-3 text-sm">
                <Dices className="mt-0.5 size-5 shrink-0 text-gold-text" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">Setka qur’ani kutyapti</span>
                  Quyidagi guruhda jamoalar barcha nizom mezonlari bo‘yicha teng. Kim yuqori turishini qur’a hal qiladi.
                </span>
              </p>
            ) : (
              <div>
                <h2 className="section-title">Setkani tuzish</h2>
                <p className="mb-3 text-sm text-muted-foreground">Setka o‘chirilgan. Birinchi bosqich sanasini tanlab, uni qayta tuzing.</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Birinchi bosqich sanasi" htmlFor="po-date" hint="Keyingi bosqichlar har 7 kunda">
                    <Input id="po-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </Field>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 self-center text-sm font-semibold">
                    <Switch checked={third} onCheckedChange={setThird} />
                    3-o‘rin uchun o‘yin
                  </label>
                </div>
                <Button
                  className="mt-4 w-full sm:w-auto"
                  disabled={create.isPending || !!plan.error}
                  onClick={() => runAction(() => create.mutateAsync(undefined), "Pley-off setkasi tuzildi")}
                >
                  <Network aria-hidden="true" />
                  Setkani tuzish
                </Button>
              </div>
            )}
          </section>
        )}

        {groupTies.map(({ group, teamIds }) => (
          <section key={group.id} role="alert" className="rounded-xl border border-gold/60 bg-gold-soft p-4">
            <p className="flex items-start gap-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
              <span>
                <span className="font-semibold">{group.name} guruhi:</span> {teamIds.map((id) => index.team(id)?.name).join(", ")} — barcha mezonlar bo‘yicha teng.
                {!complete && " Guruh bosqichi tugaguncha holat o‘zgarishi mumkin."}
              </span>
            </p>
            {!readOnly && complete && (
              <Button
                className="mt-3"
                onClick={() =>
                  setLot({
                    scope: `GROUP:${group.id}`,
                    teamIds,
                    title: `${group.name} guruhi: qur’a`,
                    description: "Ochko, o‘zaro o‘yinlar, to‘plar farqi va boshqa mezonlar bo‘yicha jamoalar teng. Ularning o‘rnini qur’a hal qiladi.",
                  })
                }
              >
                <Dices aria-hidden="true" />
                Qur’a tashlash
              </Button>
            )}
          </section>
        ))}

        {playoff.length > 0 && unconfirmed.length > 0 && !readOnly && (
          <p className="flex items-start gap-2 rounded-xl border border-gold/60 bg-gold-soft px-4 py-3 text-sm">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
            <span>
              <span className="font-semibold">{unconfirmed.length} ta o‘yinning sanasi belgilanmagan.</span> Muxlislar ularda «Sana belgilanmagan» yozuvini
              ko‘radi. Quyida sana va vaqtni tanlab, «Saqlash»ni bosing. Sanani sayt o‘zi qo‘ymaydi.
            </span>
          </p>
        )}

        {playoff.length > 0 && (
          <section className="panel overflow-hidden" aria-labelledby="dates-title">
            <h2 id="dates-title" className="flex items-center gap-2 border-b border-border px-4 py-3 font-display text-lg">
              <CalendarCheck className="size-5 text-pitch-600 dark:text-gold-400" aria-hidden="true" />
              O‘yinlar sanasi va vaqti
            </h2>
            <ScheduleBoard
              index={index}
              readOnly={readOnly}
              sections={byRound
                .map(({ round, list }) => ({ key: round, title: round === "THIRD" ? "3-o‘rin uchun o‘yin" : roundLabel(round, playoff), matches: list.filter((m) => m.status !== "FINISHED" && m.status !== "LIVE") }))
                .filter((x) => x.matches.length > 0)}
            />
          </section>
        )}

        {plan.seeds.length > 0 && overview.groupMatches.length > 0 && <FormatSummary plan={plan} overview={overview} />}

        {shown.length > 0 && (
          <section className="panel p-4 md:p-5" aria-labelledby="bracket-title">
            <h2 id="bracket-title" className="section-title mb-3">
              {playoff.length > 0 ? "Setka" : "Taxminiy setka"}
            </h2>
            {desktop ? (
              <Bracket matches={shown} index={index} linkable={false} />
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {shown
                  .slice()
                  .sort((a, b) => ROUND_ORDER.indexOf(a.playoffRound!) - ROUND_ORDER.indexOf(b.playoffRound!) || (a.bracketIndex ?? 0) - (b.bracketIndex ?? 0))
                  .map((m) => (
                    <AdminMatchItem
                      key={m.id}
                      match={m}
                      team={index.team}
                      meta={roundLabel(m.playoffRound!, shown)}
                      action={
                        playoff.length > 0 && !readOnly && m.homeId && m.awayId ? (
                          <Button asChild size="sm" variant={m.status === "FINISHED" ? "outline" : "default"}>
                            <Link to={`/admin/natijalar/${m.id}`}>{m.status === "FINISHED" ? "Tahrirlash" : "Natija"}</Link>
                          </Button>
                        ) : undefined
                      }
                    />
                  ))}
              </div>
            )}
          </section>
        )}

        {plan.seeds.length > 1 && !plan.error && overview.groupMatches.length > 0 && <SeedingTable plan={plan} index={index} projected={playoff.length === 0} />}

        {playoff.length === 0 && overview.groupMatches.length === 0 && (
          <div className="panel">
            <EmptyState
              icon={Network}
              title={readOnly ? "Bu mavsumda pley-off bo‘lmagan" : "Pley-off hali uzoqda"}
              description={readOnly ? undefined : "Avval guruhlarni tuzing va guruh bosqichi taqvimini belgilang. Guruh o‘yinlari tugashi bilan setka shu yerda paydo bo‘ladi."}
              action={
                readOnly ? undefined : (
                  <Button asChild variant="outline">
                    <Link to="/admin/guruhlar">Guruhlar va qur’a</Link>
                  </Button>
                )
              }
            />
          </div>
        )}
      </div>

      {lot && (
        <LotDialog
          open={Boolean(lot)}
          onOpenChange={(v) => !v && setLot(null)}
          seasonId={seasonId}
          scope={lot.scope}
          teamIds={lot.teamIds}
          title={lot.title}
          description={lot.description}
          index={index}
        />
      )}
    </div>
  )
}
