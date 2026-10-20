import { CircleCheck, EyeOff, ImageUp, LoaderCircle, Search, Shirt, Trash, UserRoundX, WandSparkles, X } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"
import { api } from "@/api/client"
import { useAdminMutation, useAdminRoundTeams } from "@/api/hooks"
import type { RoundTeamInput } from "@/api/types"
import { AdminPageHeader, ConfirmAction, ReadOnlyBanner, runAction, useReadOnly } from "@/components/admin/admin-ui"
import { GoalBalls, PlayerSilhouette, RoundTeamPitch, EmptySlot, type PitchPlayer } from "@/components/league/round-team-pitch"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  ROUND_TEAM_SLOTS,
  roundKeyOf,
  roundOptions,
  roundStats,
  slotMeta,
  slotScore,
  suggestRoundTeam,
  type PlayerRoundStats,
  type RoundOption,
} from "@/domain/round-team"
import type { ID, Position, RoundTeam, RoundTeamSlotKey } from "@/domain/types"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { formatDate, fullName, positionLabel } from "@/lib/format"
import { prepareImage } from "@/lib/image"
import { toPitchPlayer } from "@/lib/round-team-view"
import { searchKey } from "@/lib/translit"
import { cn } from "@/lib/utils"

type Picks = Partial<Record<RoundTeamSlotKey, ID>>

const POSITION_PLURAL: Record<Position, string> = {
  GK: "Faqat darvozabonlar",
  DF: "Faqat himoyachilar",
  MF: "Faqat yarim himoyachilar",
  FW: "Faqat hujumchilar",
}

const FILL_ORDER: RoundTeamSlotKey[] = ["GK", "DF", "MF_L", "MF_R", "FW"]

const RESULT_WORD = { W: "g‘alaba", D: "durang", L: "mag‘lubiyat" } as const

const picksOf = (team: RoundTeam | undefined): Picks => Object.fromEntries((team?.slots ?? []).map((s) => [s.slot, s.playerId]))
const samePicks = (a: Picks, b: Picks) => ROUND_TEAM_SLOTS.every(({ key }) => (a[key] ?? null) === (b[key] ?? null))
const filled = (p: Picks) => ROUND_TEAM_SLOTS.filter(({ key }) => p[key]).length

/** Jamoaning turdagi natijasi: «2:0 g‘alaba», penaltilarda hal bo'lsa — shuni aytadi */
function teamResultText(s: PlayerRoundStats | undefined) {
  if (!s?.result || !s.score) return "Bu turda o‘ynamagan"
  const [f, c] = s.score.split(":").map(Number)
  if (f === c && s.result !== "D") return `${s.score}, penaltilarda ${RESULT_WORD[s.result]}`
  return `${s.score} ${RESULT_WORD[s.result]}`
}

/** Turni tanlash: faqat to'liq yakunlangan turlar ochiq, holati yonida yoziladi */
function RoundSelect({ options, value, onChange, saved }: { options: RoundOption[]; value: string; onChange: (key: string) => void; saved: Map<string, RoundTeam> }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor="rt-round" className="text-sm font-semibold">
        Tur
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="rt-round" className="h-11 w-full min-w-56 sm:w-auto lg:h-9">
          <SelectValue placeholder="Turni tanlang" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const t = saved.get(o.key)
            const done = o.matches.filter((m) => m.status === "FINISHED").length
            const note = !o.complete ? `hali tugamagan: ${done}/${o.matches.length}` : t?.published ? "e’lon qilingan" : t ? "qoralama" : null
            return (
              <SelectItem key={o.key} value={o.key} disabled={!o.complete}>
                {o.label}
                {note && <span className="text-muted-foreground"> ({note})</span>}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Tanlangan futbolchi: rasm yuklash va maydondan olish */
function SelectedPlayer({ index, playerId, slot, onRemove, readOnly }: { index: SeasonIndex; playerId: ID; slot: RoundTeamSlotKey; onRemove: () => void; readOnly: boolean }) {
  const player = index.player(playerId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const photo = useAdminMutation((v: { playerId: ID; url: string | null }) => api.setPlayerPhoto(v.playerId, v.url))
  const name = player ? fullName(player) : "Noma’lum futbolchi"

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const { blob, name: fileName } = await prepareImage(file, 512)
      const { url } = await api.uploadMedia(blob, fileName.replace("logo", "futbolchi"))
      await photo.mutateAsync({ playerId, url })
      toast.success(`${name}ning rasmi saqlandi`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rasmni yuklab bo‘lmadi.")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const removePhoto = async () => {
    setError(null)
    setBusy(true)
    await runAction(() => photo.mutateAsync({ playerId, url: null }), `${name}ning rasmi olib tashlandi`)
    setBusy(false)
  }

  return (
    <section className="rounded-xl border border-border bg-muted/50 p-3" aria-label="Tanlangan futbolchi">
      <div className="flex items-center gap-3">
        <span className="relative grid size-16 shrink-0 place-items-end overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#1d5440,#0b2a1f)] text-pitch-300/80 ring-2 ring-gold">
          {player?.photoUrl ? (
            <img src={player.photoUrl} alt={`${name} rasmi`} className="size-full object-cover object-[50%_25%]" />
          ) : (
            <PlayerSilhouette className="size-[92%]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {slotMeta(slot).fullLabel}, {index.team(index.teamOfPlayer(playerId))?.name ?? "—"}
          </p>
        </div>
      </div>
      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ImageUp aria-hidden="true" />}
            {busy ? "Saqlanmoqda…" : player?.photoUrl ? "Boshqa rasm" : "Rasm yuklash"}
          </Button>
          {player?.photoUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={removePhoto} disabled={busy}>
              <X aria-hidden="true" />
              Rasmni olib tashlash
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="ml-auto">
            <UserRoundX aria-hidden="true" />
            Maydondan olish
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : (
        !readOnly && <p className="mt-2 text-xs text-muted-foreground">Rasm bo‘lmasa, odamcha belgisi turadi. Yuklangan rasm keyingi turlarda ham chiqadi.</p>
      )}
    </section>
  )
}

/** Futbolchi tanlash: jamoalar bo'yicha, turdagi natija va ko'rsatkichlari bilan */
function PlayerPicker({
  index,
  option,
  stats,
  slot,
  picks,
  onPick,
  readOnly,
}: {
  index: SeasonIndex
  option: RoundOption
  stats: Map<ID, PlayerRoundStats>
  slot: RoundTeamSlotKey
  picks: Picks
  onPick: (playerId: ID) => void
  readOnly: boolean
}) {
  const meta = slotMeta(slot)
  const [query, setQuery] = useState("")
  const [onlyPosition, setOnlyPosition] = useState(true)
  const [onlyPlayed, setOnlyPlayed] = useState(true)
  const placedAt = useMemo(() => new Map(Object.entries(picks).map(([k, id]) => [id!, k as RoundTeamSlotKey])), [picks])

  const groups = useMemo(() => {
    const q = searchKey(query.trim())
    const byTeam = new Map<ID, { id: ID; best: number; rows: { id: ID; score: number; s: PlayerRoundStats }[] }>()
    for (const r of index.bundle.rosters) {
      const p = index.player(r.playerId)
      const s = stats.get(r.playerId)
      if (!p || !s) continue
      if (onlyPlayed && !s.played) continue
      if (onlyPosition && p.position !== meta.position) continue
      if (q && !searchKey(`${fullName(p)} ${index.team(r.seasonTeamId)?.name ?? ""} ${r.number ?? ""}`).includes(q)) continue
      const score = s.played ? slotScore(slot, s) : -1
      const g = byTeam.get(r.seasonTeamId) ?? { id: r.seasonTeamId, best: -Infinity, rows: [] }
      g.rows.push({ id: r.playerId, score, s })
      g.best = Math.max(g.best, score)
      byTeam.set(r.seasonTeamId, g)
    }
    const name = (id: ID) => index.team(id)?.name ?? ""
    for (const g of byTeam.values()) g.rows.sort((a, b) => b.score - a.score || (index.numberOf(a.id) ?? 999) - (index.numberOf(b.id) ?? 999))
    return [...byTeam.values()].sort((a, b) => b.best - a.best || name(a.id).localeCompare(name(b.id)))
  }, [index, stats, query, onlyPlayed, onlyPosition, meta.position, slot])

  const roundWord = option.stage === "GROUP" ? `${option.label}da` : "Shu bosqichda"
  const chip = "inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-150 lg:h-9"

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ism, jamoa yoki raqam"
          aria-label="Futbolchini qidirish"
          className="h-11 pl-9 lg:h-10"
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrlar">
        <button
          type="button"
          aria-pressed={onlyPosition}
          onClick={() => setOnlyPosition((v) => !v)}
          className={cn(chip, onlyPosition ? "border-primary/40 bg-secondary text-secondary-foreground" : "border-border hover:bg-muted")}
        >
          {onlyPosition && <CircleCheck className="size-3.5" aria-hidden="true" />}
          {POSITION_PLURAL[meta.position]}
        </button>
        <button
          type="button"
          aria-pressed={onlyPlayed}
          onClick={() => setOnlyPlayed((v) => !v)}
          className={cn(chip, onlyPlayed ? "border-primary/40 bg-secondary text-secondary-foreground" : "border-border hover:bg-muted")}
        >
          {onlyPlayed && <CircleCheck className="size-3.5" aria-hidden="true" />}
          {roundWord} o‘ynaganlar
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm">
          <p className="font-semibold">Mos futbolchi topilmadi</p>
          <p className="mt-1 text-muted-foreground">
            {query ? "Qidiruv so‘zini o‘zgartiring yoki filtrlarni o‘chiring." : "Pozitsiyasi kiritilmagan futbolchilarni ko‘rish uchun filtrlarni o‘chiring."}
          </p>
          {(onlyPosition || onlyPlayed || query) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setOnlyPosition(false)
                setOnlyPlayed(false)
                setQuery("")
              }}
            >
              Hammasini ko‘rsatish
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const team = index.team(g.id)
            return (
              <section key={g.id} aria-label={team?.name}>
                <h3 className="flex items-center gap-2 px-0.5 text-sm font-semibold text-muted-foreground">
                  <TeamCrest team={team} size="sm" />
                  <span className="min-w-0 truncate">
                    <span className="text-foreground">{team?.name}</span>, {teamResultText(g.rows[0]?.s)}
                  </span>
                </h3>
                <ul className="mt-1.5 space-y-1.5">
                  {g.rows.map(({ id, s }) => {
                    const p = index.player(id)!
                    const selected = picks[slot] === id
                    const elsewhere = placedAt.get(id)
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          disabled={readOnly}
                          aria-pressed={selected}
                          onClick={() => onPick(id)}
                          className={cn(
                            "grid min-h-14 w-full grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors duration-150",
                            selected ? "border-primary bg-secondary shadow-[inset_3px_0_0_var(--primary)]" : "border-border hover:bg-row-hover",
                            readOnly && "cursor-default opacity-80",
                          )}
                        >
                          <span className="font-score text-center text-lg text-muted-foreground">{index.numberOf(id) ?? "—"}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{fullName(p)}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {positionLabel(p.position)}
                              {elsewhere && elsewhere !== slot && `, maydonda: ${slotMeta(elsewhere).fullLabel.toLowerCase()}`}
                            </span>
                          </span>
                          <StatChip slot={slot} s={s} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatChip({ slot, s }: { slot: RoundTeamSlotKey; s: PlayerRoundStats }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap"
  if (!s.played) return <span className={cn(base, "bg-muted text-muted-foreground")}>O‘ynamagan</span>
  if (slot === "GK") {
    return s.conceded === 0 ? (
      <span className={cn(base, "bg-secondary text-secondary-foreground")}>Quruq o‘yin</span>
    ) : (
      <span className={cn(base, "bg-muted text-muted-foreground")}>{s.conceded} ta o‘tkazdi</span>
    )
  }
  if (s.goals === 0 && s.assists === 0) return null
  return (
    <span className={cn(base, "bg-secondary text-secondary-foreground")}>
      <GoalBalls goals={s.goals} />
      {[s.goals > 0 && `${s.goals} gol`, s.assists > 0 && `${s.assists} uzatma`].filter(Boolean).join(", ")}
    </span>
  )
}

export default function AdminRoundTeamPage() {
  const { index, isLoading, error, refetch } = useSeasonData()
  const seasonId = index?.bundle.season.id
  const saved = useAdminRoundTeams(seasonId)
  const readOnly = useReadOnly()
  const wide = useMediaQuery("(min-width: 1024px)")

  const options = useMemo(() => (index ? roundOptions(index.bundle.matches) : []), [index])
  const savedByKey = useMemo(() => new Map((saved.data ?? []).map((t) => [roundKeyOf(t), t])), [saved.data])
  // Tanlangan tur manzilda turadi: sahifa yangilansa ham o'sha tur ochiladi
  const [params, setParams] = useSearchParams()
  const chosenKey = params.get("tur") ?? undefined
  const choose = (k: string) =>
    setParams(
      (p) => {
        p.set("tur", k)
        return p
      },
      { replace: true },
    )
  const [edits, setEdits] = useState<Record<string, Picks>>({})
  const [activeSlot, setActiveSlot] = useState<RoundTeamSlotKey | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Odatiy tanlov: ramziy jamoasi hali e'lon qilinmagan oxirgi tugagan tur
  const complete = options.filter((o) => o.complete)
  const fallbackKey = (complete.findLast((o) => !savedByKey.get(o.key)?.published) ?? complete.at(-1))?.key
  const key = chosenKey && complete.some((o) => o.key === chosenKey) ? chosenKey : fallbackKey
  const option = options.find((o) => o.key === key)
  const editKey = `${seasonId}|${key}`
  const existing = key ? savedByKey.get(key) : undefined
  const savedPicks = useMemo(() => picksOf(existing), [existing])
  const picks = edits[editKey] ?? savedPicks
  const dirty = !samePicks(picks, savedPicks)
  const count = filled(picks)

  const stats = useMemo(
    () =>
      index && option
        ? roundStats(option, { events: index.bundle.events, appearances: index.bundle.appearances, rosters: index.bundle.rosters })
        : new Map<ID, PlayerRoundStats>(),
    [index, option],
  )

  const save = useAdminMutation((input: RoundTeamInput) => api.saveRoundTeam(seasonId!, input))
  const remove = useAdminMutation((id: ID) => api.deleteRoundTeam(id))

  if ((isLoading && !index) || (seasonId && saved.isLoading)) return <PageSkeleton />
  if (error || !index) return <ErrorState message={error?.message} onRetry={() => refetch()} />
  if (saved.error) return <ErrorState message={saved.error.message} onRetry={() => saved.refetch()} />

  const header = (
    <AdminPageHeader
      title="Ramziy jamoa"
      description="Tur tugagach, eng yaxshi 5 futbolchini maydonga joylang. Gollar, uzatmalar va quruq o‘yinlar natijalardan avtomatik olinadi."
    />
  )

  if (!option) {
    const next = options.find((o) => !o.complete)
    return (
      <>
        {header}
        <EmptyState
          icon={Shirt}
          title={options.length === 0 ? "Hali o‘yinlar yo‘q" : "Hali birorta tur yakunlanmagan"}
          description={
            next
              ? `Ramziy jamoa tur o‘yinlarining hammasi yakunlangach tanlanadi. ${next.label}: ${next.matches.filter((m) => m.status === "FINISHED").length} ta o‘yindan ${next.matches.filter((m) => m.status !== "FINISHED").length} tasi hali yakunlanmagan.`
              : "Ramziy jamoa tur o‘yinlari yakunlangach tanlanadi. Avval qur’a tashlang va o‘yin natijalarini kiriting."
          }
          action={
            <Button asChild variant="outline">
              <Link to="/admin/natijalar">Natijalarga o‘tish</Link>
            </Button>
          }
        />
      </>
    )
  }

  const setPicks = (next: Picks) => setEdits((e) => ({ ...e, [editKey]: next }))
  const dropEdits = () =>
    setEdits((e) => {
      const next = { ...e }
      delete next[editKey]
      return next
    })
  // Bo'sh o'rinlar admin tanlaydigan tartibda: darvozabondan hujumchigacha
  const firstEmpty = FILL_ORDER.find((k) => !picks[k])
  const active = activeSlot ?? (wide && !readOnly ? (firstEmpty ?? null) : null)

  const openSlot = (slot: RoundTeamSlotKey) => {
    setActiveSlot(slot)
    if (!wide) setSheetOpen(true)
  }

  const pick = (slot: RoundTeamSlotKey, playerId: ID) => {
    const next: Picks = { ...picks }
    // Boshqa o'rinda turgan futbolchi shu o'ringa ko'chadi
    for (const k of Object.keys(next) as RoundTeamSlotKey[]) if (next[k] === playerId) delete next[k]
    next[slot] = playerId
    setPicks(next)
    setActiveSlot(slot)
  }

  const unpick = (slot: RoundTeamSlotKey) => {
    const next: Picks = { ...picks }
    delete next[slot]
    setPicks(next)
  }

  const autoFill = () => {
    const suggestion = suggestRoundTeam(stats, (id) => index.player(id)?.position, picks)
    const added = filled(suggestion) - count
    if (added === 0) {
      toast.info("Bo‘sh o‘rinlar uchun mos futbolchi topilmadi. Ularni o‘zingiz tanlang.")
      return
    }
    setPicks(suggestion)
    setActiveSlot(null)
    toast.success(`${added} ta o‘ringa futbolchi qo‘yildi. Tekshirib, kerak bo‘lsa almashtiring.`)
  }

  const persist = async (publish: boolean, message: string) => {
    const input: RoundTeamInput = {
      stage: option.stage,
      round: option.round,
      playoffRound: option.playoffRound,
      slots: ROUND_TEAM_SLOTS.filter(({ key: k }) => picks[k]).map(({ key: k }) => ({ slot: k, playerId: picks[k]! })),
      publish,
    }
    const result = await runAction(() => save.mutateAsync(input), message)
    if (result) {
      dropEdits()
      choose(option.key)
    }
  }

  const pitchPlayers = Object.fromEntries(
    ROUND_TEAM_SLOTS.filter(({ key: k }) => picks[k]).map(({ key: k }) => [k, toPitchPlayer(index, stats, k, picks[k]!)]),
  ) as Partial<Record<RoundTeamSlotKey, PitchPlayer>>

  const status = existing?.published
    ? `Saytda e’lon qilingan${existing.publishedAt ? `, ${formatDate(existing.publishedAt)}` : ""}`
    : existing
      ? "Qoralama: saytda ko‘rinmaydi"
      : "Hali tanlanmagan"

  const pickerTitle = active ? `${slotMeta(active).fullLabel} tanlang` : "O‘rinni tanlang"
  const pickerBody = active ? (
    <div className="flex flex-col gap-3">
      {picks[active] && <SelectedPlayer key={picks[active]} index={index} playerId={picks[active]!} slot={active} onRemove={() => unpick(active)} readOnly={readOnly} />}
      <PlayerPicker key={`${editKey}-${active}`} index={index} option={option} stats={stats} slot={active} picks={picks} onPick={(id) => pick(active, id)} readOnly={readOnly} />
    </div>
  ) : (
    <RoundResults index={index} option={option} />
  )

  return (
    <>
      {header}
      <ReadOnlyBanner />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <RoundSelect
          options={options}
          value={key!}
          saved={savedByKey}
          onChange={(k) => {
            choose(k)
            setActiveSlot(null)
          }}
        />
        {!readOnly && (
          <Button type="button" variant="outline" className="h-11 lg:h-9" onClick={autoFill} disabled={count === 5}>
            <WandSparkles aria-hidden="true" />
            Avtomatik taklif
          </Button>
        )}
        {!readOnly && (
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {existing && (
              <ConfirmAction
                trigger={
                  <Button type="button" variant="ghost" className="h-11 text-destructive hover:text-destructive lg:h-9">
                    <Trash aria-hidden="true" />
                    O‘chirish
                  </Button>
                }
                title={`${option.label} ramziy jamoasini o‘chirish`}
                description="Ramziy jamoa saytdan ham, admin paneldan ham o‘chadi. Futbolchilar va ularning rasmlari o‘chmaydi."
                confirmLabel="O‘chirish"
                onConfirm={async () => {
                  const ok = await runAction(() => remove.mutateAsync(existing.id).then(() => true), `${option.label} ramziy jamoasi o‘chirildi`)
                  if (ok) dropEdits()
                }}
              />
            )}
            {existing?.published ? (
              <>
                <ConfirmAction
                  destructive={false}
                  trigger={
                    <Button type="button" variant="outline" className="h-11 lg:h-9">
                      <EyeOff aria-hidden="true" />
                      Saytdan olish
                    </Button>
                  }
                  title="Saytdan olish"
                  description={`${option.label} ramziy jamoasi saytda ko‘rinmay qoladi va qoralama bo‘lib saqlanadi. Keyin yana e’lon qilish mumkin.`}
                  confirmLabel="Saytdan olish"
                  onConfirm={() => persist(false, `${option.label} ramziy jamoasi saytdan olindi`)}
                />
                <Button type="button" className="h-11 lg:h-9" disabled={!dirty || count < 5 || save.isPending} onClick={() => persist(true, "O‘zgarishlar saytda e’lon qilindi")}>
                  {save.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                  O‘zgarishlarni e’lon qilish
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 lg:h-9"
                  disabled={!dirty || count === 0 || save.isPending}
                  onClick={() => persist(false, "Qoralama saqlandi. Saytda ko‘rinmaydi.")}
                >
                  Qoralama saqlash
                </Button>
                <Button type="button" className="h-11 lg:h-9" disabled={count < 5 || save.isPending} onClick={() => persist(true, `${option.label} ramziy jamoasi saytda e’lon qilindi`)}>
                  {save.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                  E’lon qilish ({count}/5)
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" role="status">
        <span className={cn("font-semibold", existing?.published ? "text-win" : "text-muted-foreground")}>{status}</span>
        {dirty && <span className="font-semibold text-gold-text">Saqlanmagan o‘zgarishlar bor</span>}
        {option.stage === "PLAYOFF" && <span className="text-muted-foreground">Pley-off bosqichi uchun ramziy jamoa ixtiyoriy.</span>}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:items-start">
        <RoundTeamPitch
          players={pitchPlayers}
          className="mx-auto max-w-[520px]"
          renderSlot={(slot, card) => {
            const { label, fullLabel } = slotMeta(slot)
            const name = picks[slot] ? fullName(index.player(picks[slot]) ?? { firstName: "Noma’lum", lastName: "futbolchi" }) : "bo‘sh"
            return (
              <button
                type="button"
                onClick={() => openSlot(slot)}
                aria-pressed={active === slot}
                aria-label={`${fullLabel}: ${name}`}
                className={cn(
                  "block w-full rounded-2xl p-0.5 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 active:translate-y-0 motion-reduce:transform-none",
                  card && active === slot && "bg-gold-300/20 ring-2 ring-gold-300",
                )}
              >
                {card ?? <EmptySlot label={label} active={active === slot} />}
              </button>
            )
          }}
        />

        {wide ? (
          <aside className="panel sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden" aria-labelledby="rt-picker-title">
            <div className="border-b border-border px-4 py-3">
              <h2 id="rt-picker-title" className="section-title">
                {pickerTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {active ? `${option.label} o‘yinlari bo‘yicha: kim maydonga tushgan, gollar, quruq o‘yinlar` : "Maydondagi o‘rinni bosing va futbolchini tanlang."}
              </p>
            </div>
            <div className="overflow-y-auto p-4">{pickerBody}</div>
          </aside>
        ) : (
          <Sheet open={sheetOpen && active != null} onOpenChange={setSheetOpen}>
            <SheetContent side="bottom" className="max-h-[88dvh] gap-0 rounded-t-2xl p-0">
              <SheetHeader className="border-b border-border">
                <SheetTitle className="font-display text-xl">{pickerTitle}</SheetTitle>
                <SheetDescription>{option.label} o‘yinlari bo‘yicha</SheetDescription>
              </SheetHeader>
              <div className="overflow-y-auto p-4 pb-safe">{pickerBody}</div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </>
  )
}

/** O'rin tanlanmagan paytda: tur natijalari — kim yaxshi o'ynaganini eslash uchun */
function RoundResults({ index, option }: { index: SeasonIndex; option: RoundOption }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{option.label} natijalari</h3>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {option.matches.map((m) => {
          const home = index.team(m.homeId)
          const away = index.team(m.awayId)
          return (
            <li key={m.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center justify-end gap-2 text-right">
                <span className="truncate">{home?.name ?? "—"}</span>
                <TeamCrest team={home} size="xs" />
              </span>
              <span className="font-score rounded-md bg-muted px-2 py-0.5 text-base">
                {m.homeScore ?? "–"}:{m.awayScore ?? "–"}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <TeamCrest team={away} size="xs" />
                <span className="truncate">{away?.name ?? "—"}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
