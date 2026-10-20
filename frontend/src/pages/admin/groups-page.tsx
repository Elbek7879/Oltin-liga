import { Dices, Hand, Layers, Lock, RotateCcw, Save, Sparkles, TriangleAlert, Undo2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router"
import { api } from "@/api/client"
import { useAdminMutation, useSeasonBundle } from "@/api/hooks"
import { AdminPageHeader, ConfirmAction, ReadOnlyBanner, runAction, useReadOnly } from "@/components/admin/admin-ui"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  checkDraw,
  constrainedDraw,
  describeSizes,
  GROUP_LETTERS,
  groupOptions,
  potDraw,
  splitIntoPots,
  type AvoidRule,
  type DrawGroup,
  type GroupOption,
} from "@/domain/draw"
import { firstRoundFor, qualifiersFor, ROUND_LABELS } from "@/domain/playoff"
import type { ID } from "@/domain/types"
import { useSeason } from "@/hooks/use-season"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { previousStrength } from "@/lib/team-strength"
import { cn } from "@/lib/utils"

type Method = "random" | "pots" | "manual"

/** Variant natijasi: «18 jamoa chiqadi: 14 tasi 1/8 finalga, 4 tasi saralashda» */
function optionOutcome(o: GroupOption) {
  if (o.bracketSize === 0) return "Pley-off uchun jamoalar yetarli emas"
  const first = ROUND_LABELS[firstRoundFor(o.bracketSize)!].toLowerCase()
  if (o.playIns === 0) return `Pley-offga ${o.qualified} ta jamoa chiqadi — ${first}dan boshlanadi`
  return `Pley-offga ${o.qualified} ta jamoa chiqadi: ${o.qualified - o.playIns * 2} tasi to‘g‘ridan-to‘g‘ri ${first}ga, ${o.playIns * 2} tasi saralash o‘yinida`
}

/** Savatlar: o'tgan mavsum natijasi bo'yicha avtomatik, tashkilotchi o'zgartirishi mumkin */
function PotsEditor({
  index,
  pots,
  onChange,
  source,
}: {
  index: SeasonIndex
  pots: ID[][]
  onChange: (teamId: ID, pot: number) => void
  source: string
}) {
  return (
    <div className="mt-5">
      <p className="mb-3 text-sm text-muted-foreground">{source} Har guruhga har savatdan bittadan jamoa tushadi. Kerak bo‘lsa, jamoani boshqa savatga o‘tkazing.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pots.map((pot, pi) => (
          <div key={pi} className="overflow-hidden rounded-xl border border-border">
            <p className="border-b border-border bg-muted/60 px-3 py-2 text-sm font-semibold">
              {pi + 1}-savat <span className="font-normal text-muted-foreground">({pot.length} jamoa)</span>
            </p>
            <ul className="divide-y divide-border">
              {pot.map((id) => (
                <li key={id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                  <TeamCrest team={index.team(id)} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{index.team(id)?.name}</span>
                  <Select value={String(pi)} onValueChange={(v) => onChange(id, Number(v))}>
                    <SelectTrigger aria-label={`${index.team(id)?.name}: savat`} className="w-20" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pots.map((_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {i + 1}-savat
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminGroupsPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const { seasons, season } = useSeason()
  const readOnly = useReadOnly()
  const [groupCount, setGroupCount] = useState<number | null>(null)
  const [method, setMethod] = useState<Method>("random")
  const [separateVillages, setSeparateVillages] = useState(true)
  const [draft, setDraft] = useState<{ groups: DrawGroup[]; conflicts: number } | null>(null)
  const [manual, setManual] = useState<Record<string, string>>({})
  const [potOverride, setPotOverride] = useState<Record<ID, number>>({})
  const [drawNo, setDrawNo] = useState(0)
  const save = useAdminMutation((groups: DrawGroup[]) => api.saveGroups(index!.bundle.season.id, groups.map((g) => ({ name: g.name, teamIds: g.teamIds }))))
  const resetDraw = useAdminMutation(() => api.resetGroups(index!.bundle.season.id))

  // O'tgan (yakunlangan) mavsum — savatlar uchun kuch reytingi
  const previous = useMemo(
    () => seasons.filter((s) => s.status === "FINISHED" && s.id !== season?.id && (!season || s.year <= season.year)).sort((a, b) => b.year - a.year)[0],
    [seasons, season],
  )
  const { data: prevBundle } = useSeasonBundle(previous?.id)

  const teamIds = useMemo(() => index?.bundle.teams.map((t) => t.id) ?? [], [index])
  const rules = index?.bundle.season.rules
  const options = useMemo(() => (rules && teamIds.length >= 2 ? groupOptions(teamIds.length, (s) => qualifiersFor(rules, s)) : []), [rules, teamIds.length])
  const count = groupCount ?? options.find((o) => o.recommended)?.groups ?? 1

  // Jamoalar kuch tartibida (o'tgan mavsum bo'yicha), yangi jamoalar oxirida
  const ordered = useMemo(() => {
    if (!index) return []
    const strength = prevBundle ? previousStrength(prevBundle) : new Map<ID, number>()
    return [...index.bundle.teams]
      .sort((a, b) => (strength.get(b.teamId) ?? -1) - (strength.get(a.teamId) ?? -1) || a.name.localeCompare(b.name, "uz"))
      .map((t) => t.id)
  }, [index, prevBundle])
  const pots = useMemo(() => {
    const base = splitIntoPots(ordered, count)
    if (Object.keys(potOverride).length === 0) return base
    const result: ID[][] = base.map(() => [])
    base.forEach((pot, pi) => pot.forEach((id) => result[potOverride[id] ?? pi].push(id)))
    return result
  }, [ordered, count, potOverride])

  const avoid: AvoidRule | undefined = useMemo(() => {
    if (!index || !separateVillages) return undefined
    const village = new Map(index.bundle.teams.map((t) => [t.id, t.village.trim().toLowerCase()]))
    return (a, b) => Boolean(village.get(a)) && village.get(a) === village.get(b)
  }, [index, separateVillages])

  const manualGroups: DrawGroup[] = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ name: GROUP_LETTERS[i], teamIds: teamIds.filter((id) => manual[id] === GROUP_LETTERS[i]) })),
    [count, teamIds, manual],
  )
  const candidate = method === "manual" ? manualGroups : draft?.groups ?? null
  const check = candidate ? checkDraw(candidate, teamIds) : null

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index || !rules) return <ErrorState message={error?.message} onRetry={() => refetch()} />

  const { groups, matches } = index.bundle
  const groupMatches = matches.filter((m) => m.stage === "GROUP")
  const started = groupMatches.some((m) => m.status === "FINISHED" || m.status === "LIVE")
  const scheduled = groupMatches.length

  const doDraw = () => {
    setDraft(method === "pots" ? potDraw(pots.filter((p) => p.length > 0), count, avoid) : constrainedDraw(teamIds, count, avoid))
    setDrawNo((n) => n + 1)
  }
  const reset = () => {
    setDraft(null)
    setManual({})
  }

  const onSave = () =>
    runAction(() => save.mutateAsync(candidate!), "Guruhlar saqlandi va juftliklar tuzildi. Endi «O‘yinlar» bo‘limida sana va vaqtlarni belgilang.").then((ok) => {
      if (ok !== undefined) reset()
    })

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Guruhlar va qur’a"
        description="Jamoalarni guruhlarga tasodifiy, savatlar bo‘yicha yoki qo‘lda taqsimlang. Natija faqat siz tasdiqlaganingizdan keyin saqlanadi."
      />
      <ReadOnlyBanner />

      <section aria-labelledby="current-title" className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="current-title" className="section-title">
            Hozirgi guruhlar
          </h2>
          {groups.length > 0 && !started && !readOnly && (
            <ConfirmAction
              destructive
              trigger={
                <Button variant="outline" size="sm" disabled={resetDraw.isPending}>
                  <Undo2 aria-hidden="true" />
                  Qur’ani bekor qilish
                </Button>
              }
              title="Qur’ani bekor qilasizmi?"
              description={
                <>
                  <p>
                    {groups.length} ta guruh va {scheduled} ta juftlik (belgilangan sanalari bilan) o‘chiriladi. Jamoalar mavsumda qoladi.
                  </p>
                  <p className="mt-1">Shundan keyin «Jamoalar» bo‘limida jamoa qo‘shish yoki chiqarish mumkin bo‘ladi, so‘ng qur’ani qaytadan tashlaysiz.</p>
                </>
              }
              confirmLabel="Ha, bekor qilish"
              onConfirm={() => runAction(() => resetDraw.mutateAsync(undefined), "Qur’a bekor qilindi. Jamoalarni o‘zgartirib, qur’ani qaytadan tashlang.")}
            />
          )}
        </div>
        {groups.length === 0 ? (
          <div className="panel">
            <EmptyState icon={Layers} title="Guruhlar hali tuzilmagan" description="Quyida variantni tanlab, qur’a tashlang." />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((g) => (
              <div key={g.id} className="panel overflow-hidden">
                <p className="flex items-baseline justify-between border-b border-border bg-muted/60 px-3 py-2">
                  <span className="font-display text-lg">{g.name} guruhi</span>
                  <span className="text-xs text-muted-foreground">{qualifiersFor(rules, g.seasonTeamIds.length)} ta chiqadi</span>
                </p>
                <ul className="divide-y divide-border">
                  {g.seasonTeamIds.map((id) => (
                    <li key={id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <TeamCrest team={index.team(id)} size="xs" />
                      {index.team(id)?.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {!readOnly &&
        (started ? (
          <p className="flex items-start gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Guruh bosqichi o‘yinlari boshlangan, shuning uchun qur’ani o‘zgartirib bo‘lmaydi. Bu jadval va natijalar tarixini himoya qiladi.
          </p>
        ) : teamIds.length < 4 ? (
          <div className="panel">
            <EmptyState
              icon={Layers}
              title="Qur’a uchun jamoalar yetarli emas"
              description={`Mavsumda ${teamIds.length} ta jamoa bor. Kamida 4 ta jamoani mavsumga qo‘shing.`}
              action={
                <Button asChild variant="outline">
                  <Link to="/admin/jamoalar">Jamoalar</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <section aria-labelledby="draw-title" className="panel p-4 md:p-5">
            <h2 id="draw-title" className="section-title">
              Yangi qur’a
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mavsumda {teamIds.length} ta jamoa. Har guruhdan chiqadiganlar soni nizomda: 4 jamoalidan {qualifiersFor(rules, 4)} ta, 5 jamoalidan{" "}
              {qualifiersFor(rules, 5)} ta.
            </p>

            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-semibold">1. Guruhlar</legend>
              <div role="radiogroup" aria-label="Guruhlar soni" className="grid gap-2 md:grid-cols-2">
                {options.map((o) => (
                  <button
                    key={o.groups}
                    type="button"
                    role="radio"
                    aria-checked={count === o.groups}
                    onClick={() => {
                      setGroupCount(o.groups)
                      setPotOverride({})
                      reset()
                    }}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      count === o.groups ? "border-primary bg-secondary dark:border-gold-400" : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{describeSizes(o.sizes)}</span>
                      {o.recommended && (
                        <span className="inline-flex items-center gap-1 rounded bg-gold-soft px-1.5 py-0.5 text-2xs font-semibold text-gold-text">
                          <Sparkles className="size-3" aria-hidden="true" />
                          Tavsiya etiladi
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{optionOutcome(o)}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-semibold">2. Taqsimlash usuli</legend>
              <div role="radiogroup" aria-label="Taqsimlash usuli" className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: "random" as const, label: "Tasodifiy qur’a", icon: Dices, hint: "Tizim aralashtiradi" },
                  { value: "pots" as const, label: "Savatlar bo‘yicha", icon: Layers, hint: "Kuchlilar har xil guruhda" },
                  { value: "manual" as const, label: "Qo‘lda", icon: Hand, hint: "O‘zingiz tanlaysiz" },
                ].map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={method === m.value}
                    onClick={() => {
                      setMethod(m.value)
                      reset()
                    }}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-lg border px-3 text-left transition-colors",
                      method === m.value ? "border-primary bg-secondary dark:border-gold-400" : "border-border hover:bg-muted",
                    )}
                  >
                    <m.icon className="size-5 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-semibold">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
              {method !== "manual" && (
                <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <Checkbox checked={separateVillages} onCheckedChange={(v) => setSeparateVillages(v === true)} />
                  Bir qishloq jamoalari imkon qadar bir guruhga tushmasin
                </label>
              )}
            </fieldset>

            {method === "pots" && (
              <PotsEditor
                index={index}
                pots={pots}
                source={
                  previous
                    ? `Savatlar ${previous.year}-yil mavsumi natijalari bo‘yicha: chempion va kuchlilar 1-savatda, yangi jamoalar oxirgi savatda.`
                    : "O‘tgan mavsum natijalari yo‘q, shuning uchun jamoalar alifbo tartibida. Kuchli jamoalarni 1-savatga o‘tkazing."
                }
                onChange={(id, pot) => {
                  setPotOverride((o) => ({ ...o, [id]: pot }))
                  setDraft(null)
                }}
              />
            )}

            {method !== "manual" ? (
              <div className="mt-5">
                {!draft ? (
                  <Button size="lg" onClick={doDraw} className="w-full sm:w-auto">
                    <Dices aria-hidden="true" />
                    Qur’a tashlash
                  </Button>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" key={drawNo}>
                    {draft.groups.map((g, gi) => (
                      <div key={g.name} className="overflow-hidden rounded-xl border border-gold/50">
                        <p className="flex items-baseline justify-between bg-gold-soft px-3 py-2">
                          <span className="font-display text-lg">{g.name} guruhi</span>
                          <span className="text-xs text-muted-foreground">{qualifiersFor(rules, g.teamIds.length)} ta chiqadi</span>
                        </p>
                        <ul className="divide-y divide-border">
                          {g.teamIds.map((id, ti) => (
                            <li
                              key={id}
                              className="flex items-center gap-2 px-3 py-2 text-sm animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards duration-300 motion-reduce:animate-none"
                              style={{ animationDelay: `${(ti * draft.groups.length + gi) * 60}ms` }}
                            >
                              <TeamCrest team={index.team(id)} size="xs" />
                              <span className="min-w-0 flex-1 truncate">{index.team(id)?.name}</span>
                              <span className="text-xs text-muted-foreground">{index.team(id)?.village}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                {draft && draft.conflicts > 0 && (
                  <p className="mt-3 flex items-start gap-2 text-sm text-gold-text">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    Bitta qishloqdan jamoalar guruhlardan ko‘p, shuning uchun {draft.conflicts} ta juftlikni ajratib bo‘lmadi.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-5">
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {index.bundle.teams.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                      <TeamCrest team={t} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                      <Select value={manual[t.id] ?? ""} onValueChange={(v) => setManual((m) => ({ ...m, [t.id]: v }))}>
                        <SelectTrigger aria-label={`${t.name} guruhi`} className="w-24" size="sm">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: count }, (_, i) => (
                            <SelectItem key={i} value={GROUP_LETTERS[i]}>
                              {GROUP_LETTERS[i]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">{manualGroups.map((g) => `${g.name}: ${g.teamIds.length}`).join(", ")}</p>
              </div>
            )}

            {check && (check.errors.length > 0 || check.warnings.length > 0) && (method === "manual" || draft) && (
              <div className="mt-4 rounded-lg border border-gold/50 bg-gold-soft p-3 text-sm" role="status">
                {[...check.errors, ...check.warnings].map((e) => (
                  <p key={e} className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden="true" />
                    {e}
                  </p>
                ))}
              </div>
            )}

            {candidate && (method === "manual" || draft) && (
              <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                {method !== "manual" && (
                  <Button variant="outline" onClick={doDraw}>
                    <RotateCcw aria-hidden="true" />
                    Qayta tashlash
                  </Button>
                )}
                <ConfirmAction
                  destructive={scheduled > 0}
                  trigger={
                    <Button disabled={!check?.ok || save.isPending}>
                      <Save aria-hidden="true" />
                      Tasdiqlash va saqlash
                    </Button>
                  }
                  title="Qur’a natijasini tasdiqlaysizmi?"
                  description={
                    <>
                      {groups.length > 0 && <p>Hozirgi guruhlar yangilari bilan almashtiriladi.</p>}
                      {scheduled > 0 && (
                        <p className="mt-1 font-semibold text-destructive">Guruh bosqichidagi {scheduled} ta o‘yin (belgilangan sanalari bilan) o‘chiriladi, juftliklar yangidan tuziladi.</p>
                      )}
                      <p className="mt-1">Tasdiqlangach, guruhlar saytda e’lon qilinadi.</p>
                    </>
                  }
                  confirmLabel="Ha, saqlash"
                  onConfirm={onSave}
                />
              </div>
            )}
          </section>
        ))}
    </div>
  )
}
