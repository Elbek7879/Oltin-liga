import { ArrowLeft, Ban, CalendarClock, CircleCheck, ImageDown, Plus, Printer, Save, TriangleAlert, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { api } from "@/api/client"
import { useAdminMutation } from "@/api/hooks"
import { ReadOnlyBanner, runAction, StickyActions, useReadOnly } from "@/components/admin/admin-ui"
import { QuickEventDialog, type QuickCardKind, type QuickGoalKind } from "@/components/admin/quick-event-dialog"
import { ScoreStepper } from "@/components/admin/score-stepper"
import { MatchImageDialog, matchImageTitle } from "@/components/league/match-image-dialog"
import { BallIcon, CardIcon } from "@/components/league/icons"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { SUSPENSION_REASON, suspendedFor } from "@/domain/discipline"
import type { EventType, ID, Match, MatchStatus } from "@/domain/types"
import { validateResult, type ResultEventInput, type ResultInput } from "@/domain/validation"
import { useSeasonData, type SeasonIndex } from "@/hooks/use-season-data"
import { formatDate, formatTime, MATCH_STATUS_LABEL } from "@/lib/format"
import { stageLabel } from "@/lib/match"
import { cn } from "@/lib/utils"

type Side = "home" | "away"
type GoalKind = "GOAL" | "PENALTY_GOAL" | "OWN_GOAL"
type CardKind = "YELLOW" | "SECOND_YELLOW" | "RED"

interface GoalRow {
  key: string
  side: Side
  kind: GoalKind
  playerId: ID | null
  assistId: ID | null
  minute: string
}

interface CardRow {
  key: string
  side: Side
  kind: CardKind
  playerId: ID | null
  minute: string
}

const NONE = "__none__"
const STATUSES: MatchStatus[] = ["SCHEDULED", "LIVE", "FINISHED", "POSTPONED", "CANCELLED"]
const other = (s: Side): Side => (s === "home" ? "away" : "home")
let keySeq = 0
const nextKey = () => `row-${++keySeq}`

interface EntryState {
  status: MatchStatus
  homeScore: number
  awayScore: number
  homeExtra: number
  awayExtra: number
  homePens: number
  awayPens: number
  liveMinute: string
  forfeitLoser: Side | null
  goals: GoalRow[]
  cards: CardRow[]
  appearances: Set<ID>
}

function initialState(match: Match, index: SeasonIndex): EntryState {
  const events = index.eventsOf(match.id)
  const sideOf = (teamId: ID): Side => (teamId === match.homeId ? "home" : "away")
  const goals: GoalRow[] = events
    .filter((e) => e.type === "GOAL" || e.type === "PENALTY_GOAL" || e.type === "OWN_GOAL")
    .map((e) => ({
      key: nextKey(),
      side: e.type === "OWN_GOAL" ? other(sideOf(e.seasonTeamId)) : sideOf(e.seasonTeamId),
      kind: e.type as GoalKind,
      playerId: e.playerId ?? null,
      assistId: e.assistId ?? null,
      minute: e.minute ? String(e.minute) : "",
    }))
  const cards: CardRow[] = events
    .filter((e) => e.type === "YELLOW" || e.type === "SECOND_YELLOW" || e.type === "RED")
    .map((e) => ({ key: nextKey(), side: sideOf(e.seasonTeamId), kind: e.type as CardKind, playerId: e.playerId ?? null, minute: e.minute ? String(e.minute) : "" }))
  const apps = index.bundle.appearances.filter((a) => a.matchId === match.id).map((a) => a.playerId)
  const forfeit = match.decidedBy === "FORFEIT"
  return {
    status: match.status === "SCHEDULED" ? "FINISHED" : match.status,
    homeScore: forfeit ? 0 : match.homeScore ?? 0,
    awayScore: forfeit ? 0 : match.awayScore ?? 0,
    homeExtra: match.homeExtra ?? 0,
    awayExtra: match.awayExtra ?? 0,
    homePens: match.homePens ?? 0,
    awayPens: match.awayPens ?? 0,
    liveMinute: match.liveMinute ? String(match.liveMinute) : "",
    forfeitLoser: forfeit ? (match.winnerId === match.homeId ? "away" : "home") : null,
    goals: forfeit ? [] : goals,
    cards: forfeit ? [] : cards,
    appearances: new Set(apps),
  }
}

function PlayerSelect({
  value,
  onChange,
  options,
  index,
  label,
  allowNone,
  noneLabel = "Muallif noma’lum",
  id,
}: {
  value: ID | null
  onChange: (v: ID | null) => void
  options: ID[]
  index: SeasonIndex
  label: string
  allowNone?: boolean
  noneLabel?: string
  id: string
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger id={id} aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((pid) => {
          const p = index.player(pid)
          const n = index.numberOf(pid)
          return (
            <SelectItem key={pid} value={pid}>
              {n ? `${n}. ` : ""}
              {p?.firstName} {p?.lastName}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

export default function ResultEntryPage() {
  const { matchId = "" } = useParams()
  const navigate = useNavigate()
  const { index, isLoading, error, refetch } = useSeasonData()
  const readOnly = useReadOnly()
  const match = index?.bundle.matches.find((m) => m.id === matchId)
  const save = useAdminMutation((input: ResultInput) => api.saveResult(matchId, input))

  const [state, setState] = useState<EntryState | null>(null)
  const [appsTouched, setAppsTouched] = useState(false)
  const [showApps, setShowApps] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [quick, setQuick] = useState<{ side: Side; mode: "goal" | "card" } | null>(null)
  const [imageOpen, setImageOpen] = useState(false)

  useEffect(() => {
    if (match && index && !state) setState(initialState(match, index))
  }, [match, index, state])

  const rosterIds = useMemo(() => {
    const map = new Map<Side, ID[]>()
    if (!index || !match) return map
    for (const side of ["home", "away"] as Side[]) {
      const teamId = side === "home" ? match.homeId : match.awayId
      map.set(
        side,
        index.bundle.rosters
          .filter((r) => r.seasonTeamId === teamId)
          .sort((a, b) => (a.number ?? 99) - (b.number ?? 99))
          .map((r) => r.playerId),
      )
    }
    return map
  }, [index, match])

  if (isLoading && !index) return <PageSkeleton />
  if (error || !index) return <ErrorState message={error?.message} onRetry={() => refetch()} />
  if (!match) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="O‘yin topilmadi"
        description="Bu o‘yin tanlangan mavsumda yo‘q. Yuqoridan to‘g‘ri mavsumni tanlang."
        action={<Button asChild variant="outline"><Link to="/admin/natijalar">Natijalar ro‘yxati</Link></Button>}
      />
    )
  }
  if (!match.homeId || !match.awayId) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Jamoalar hali aniqlanmagan"
        description="Bu pley-off o‘yini uchun avvalgi bosqich natijalari kiritilishi kerak."
        action={<Button asChild variant="outline"><Link to="/admin/natijalar">Natijalar ro‘yxati</Link></Button>}
      />
    )
  }
  if (match.timeConfirmed === false && match.status !== "FINISHED" && match.status !== "LIVE") {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Avval o‘yin sanasini belgilang"
        description="Bu o‘yinning sanasi va vaqti hali belgilanmagan. Sana qo‘yilgach, natijani shu yerda kiritasiz."
        action={
          <Button asChild>
            <Link to={match.stage === "PLAYOFF" ? "/admin/pley-off" : "/admin/oyinlar"}>Sanani belgilash</Link>
          </Button>
        }
      />
    )
  }
  if (!state) return <PageSkeleton />

  const teamId = (side: Side) => (side === "home" ? match.homeId! : match.awayId!)
  const team = (side: Side) => index.team(teamId(side))!
  const playable = state.status === "LIVE" || state.status === "FINISHED"
  const isPlayoff = match.stage === "PLAYOFF"
  const forfeit = Boolean(state.forfeitLoser)
  const tiedRegular = state.homeScore === state.awayScore
  const showExtra = isPlayoff && state.status === "FINISHED" && !forfeit && tiedRegular
  const tiedExtra = showExtra && state.homeScore + state.homeExtra === state.awayScore + state.awayExtra
  const showPens = showExtra && tiedExtra

  const update = (patch: Partial<EntryState>) => setState((s) => (s ? { ...s, ...patch } : s))

  // Hisob o'zgarganda gollar ro'yxati ham avtomatik moslashadi
  const setGoals = (side: Side, field: "Score" | "Extra", value: number) => {
    setState((s) => {
      if (!s) return s
      const key = `${side}${field}` as "homeScore" | "awayScore" | "homeExtra" | "awayExtra"
      const delta = value - s[key]
      let goals = [...s.goals]
      if (delta > 0) {
        for (let i = 0; i < delta; i++) goals.push({ key: nextKey(), side, kind: "GOAL", playerId: null, assistId: null, minute: "" })
      } else if (delta < 0) {
        for (let i = 0; i < -delta; i++) {
          const candidates = goals.map((g, idx) => ({ g, idx })).filter(({ g }) => g.side === side)
          const empty = [...candidates].reverse().find(({ g }) => !g.playerId)
          const victim = empty ?? candidates[candidates.length - 1]
          if (victim) goals = goals.filter((_, idx) => idx !== victim.idx)
        }
      }
      return { ...s, [key]: value, goals }
    })
  }

  const toInput = (): ResultInput => {
    const events: ResultEventInput[] = []
    if (playable && !forfeit) {
      for (const g of state.goals) {
        const minute = g.minute ? Number(g.minute) : null
        if (g.kind === "OWN_GOAL") {
          events.push({ type: "OWN_GOAL", seasonTeamId: teamId(other(g.side)), playerId: g.playerId, minute })
        } else {
          events.push({ type: g.kind as EventType, seasonTeamId: teamId(g.side), playerId: g.playerId, assistId: g.assistId, minute })
        }
      }
      for (const c of state.cards) {
        events.push({ type: c.kind, seasonTeamId: teamId(c.side), playerId: c.playerId, minute: c.minute ? Number(c.minute) : null })
      }
    }
    return {
      status: state.status,
      homeScore: playable && !forfeit ? state.homeScore : null,
      awayScore: playable && !forfeit ? state.awayScore : null,
      homeExtra: showExtra ? state.homeExtra : null,
      awayExtra: showExtra ? state.awayExtra : null,
      homePens: showPens ? state.homePens : null,
      awayPens: showPens ? state.awayPens : null,
      forfeitLoser: playable ? state.forfeitLoser : null,
      liveMinute: state.status === "LIVE" && state.liveMinute ? Number(state.liveMinute) : null,
      events,
      appearances: appsTouched
        ? [...state.appearances].map((playerId) => ({
            playerId,
            seasonTeamId: rosterIds.get("home")!.includes(playerId) ? teamId("home") : teamId("away"),
          }))
        : undefined,
    }
  }

  const input = toInput()
  const rosterSet = (st: ID) => new Set(index.bundle.rosters.filter((r) => r.seasonTeamId === st).map((r) => r.playerId))
  const check = validateResult(match, input, rosterSet, (st) => index.team(st)?.name ?? "")

  const onSave = async () => {
    setAttempted(true)
    if (check.errors.length > 0) return
    const ok = await runAction(() => save.mutateAsync(input), state.status === "FINISHED" ? "Natija saqlandi. Jadval va statistika yangilandi." : "O‘yin holati saqlandi")
    if (ok) navigate("/admin/natijalar", { state: state.status === "FINISHED" ? { saved: match.id } : null })
  }

  const goalRows = (side: Side) => state.goals.filter((g) => g.side === side)

  const addGoal = (side: Side, kind: QuickGoalKind, playerId: ID | null) =>
    setState((s) => {
      if (!s) return s
      const key = side === "home" ? "homeScore" : "awayScore"
      const row: GoalRow = { key: nextKey(), side, kind, playerId, assistId: null, minute: s.status === "LIVE" ? s.liveMinute : "" }
      return { ...s, [key]: s[key] + 1, goals: [...s.goals, row] }
    })
  const addCard = (side: Side, kind: QuickCardKind, playerId: ID) =>
    setState((s) => (s ? { ...s, cards: [...s.cards, { key: nextKey(), side, kind, playerId, minute: s.status === "LIVE" ? s.liveMinute : "" }] } : s))

  // Jahon chempionati qoidasi: 2 sariq yoki qizil kartochka — keyingi o'yinni o'tkazib yuboradi
  const banned = suspendedFor(match.id, index.bundle.matches, index.bundle.events)
  const bannedIds = new Set(banned.map((b) => b.playerId))

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/admin/natijalar" className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Natijalar
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Natija kiritish</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stageLabel(match, index)}, {formatDate(match.kickoff, { weekday: true })}, {formatTime(match.kickoff)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/admin/natijalar/${match.id}/bayonnoma`}>
              <Printer aria-hidden="true" />
              Bayonnoma
            </Link>
          </Button>
          {(match.status === "FINISHED" || match.status === "LIVE") && (
            <Button variant="outline" size="sm" onClick={() => setImageOpen(true)}>
              <ImageDown aria-hidden="true" />
              {matchImageTitle(match)}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4">
        <ReadOnlyBanner />
      </div>

      <fieldset disabled={readOnly} className="mt-4 space-y-5">
        {banned.length > 0 && (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <Ban className="size-4" aria-hidden="true" />
              Bu o‘yinda o‘ynamasligi kerak (diskvalifikatsiya)
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {banned.map((b) => (
                <li key={b.playerId}>
                  <span className="font-semibold">
                    {index.player(b.playerId)?.firstName} {index.player(b.playerId)?.lastName}
                  </span>{" "}
                  ({index.team(b.seasonTeamId)?.name}) — {SUSPENSION_REASON[b.reason]}
                </li>
              ))}
            </ul>
          </div>
        )}

        <section className="panel p-4" aria-labelledby="status-label">
          <p id="status-label" className="mb-2 text-sm font-semibold">
            O‘yin holati
          </p>
          <div role="radiogroup" aria-labelledby="status-label" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={state.status === s}
                onClick={() => update({ status: s })}
                className={cn(
                  "min-h-11 rounded-lg border px-2 text-sm font-semibold transition-colors disabled:opacity-50",
                  state.status === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                  s === "FINISHED" && "col-span-2 sm:col-span-1",
                )}
              >
                {MATCH_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {state.status === "LIVE" && (
            <div className="mt-3 flex items-center gap-2">
              <Label htmlFor="live-minute" className="text-sm">
                Hozirgi daqiqa
              </Label>
              <Input
                id="live-minute"
                inputMode="numeric"
                value={state.liveMinute}
                onChange={(e) => update({ liveMinute: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                className="w-24"
                placeholder="63"
              />
            </div>
          )}
          {!playable && (
            <p className="mt-3 text-sm text-muted-foreground">Bu holatda hisob va voqealar saqlanmaydi. Mavjud natija bo‘lsa, u o‘chiriladi.</p>
          )}
        </section>

        {playable && (
          <section className="panel p-4" aria-labelledby="score-title">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="score-title" className="font-display text-lg">
                Hisob
              </h2>
              {state.status === "FINISHED" && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="forfeit"
                    checked={forfeit}
                    onCheckedChange={(v) => update({ forfeitLoser: v ? "away" : null })}
                  />
                  <Label htmlFor="forfeit" className="text-sm">
                    Texnik natija (3:0)
                  </Label>
                </div>
              )}
            </div>

            {forfeit ? (
              <div className="space-y-2">
                <Label htmlFor="forfeit-loser" className="text-sm font-semibold">
                  Texnik mag‘lubiyat berilgan jamoa
                </Label>
                <Select value={state.forfeitLoser ?? "away"} onValueChange={(v) => update({ forfeitLoser: v as Side })}>
                  <SelectTrigger id="forfeit-loser" className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">{team("home").name}</SelectItem>
                    <SelectItem value="away">{team("away").name}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Natija {state.forfeitLoser === "home" ? `0:3 (${team("away").name} g‘alabasi)` : `3:0 (${team("home").name} g‘alabasi)`} deb yoziladi. Gollar futbolchilar statistikasiga kirmaydi.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(["home", "away"] as Side[]).map((side) => (
                    <div key={side} className="flex min-w-0 flex-col items-center gap-3 rounded-xl bg-muted/60 px-1 py-4 sm:px-2">
                      <span className="flex max-w-full items-center gap-2">
                        <TeamCrest team={team(side)} size="sm" />
                        <span className="truncate font-semibold">{team(side).name}</span>
                      </span>
                      <ScoreStepper
                        label={`${team(side).name} gollari`}
                        value={side === "home" ? state.homeScore : state.awayScore}
                        onChange={(v) => setGoals(side, "Score", v)}
                      />
                      <div className="flex w-full flex-col gap-1.5 px-1 sm:flex-row sm:justify-center">
                        <Button type="button" size="sm" onClick={() => setQuick({ side, mode: "goal" })} aria-label={`${team(side).name}: gol qo‘shish`}>
                          <BallIcon />
                          Gol
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setQuick({ side, mode: "card" })} aria-label={`${team(side).name}: kartochka berish`}>
                          <CardIcon kind="yellow" />
                          Kartochka
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {showExtra && (
                  <div className="mt-4 rounded-xl border border-gold/40 bg-gold-soft p-3">
                    <p className="mb-2 text-sm font-semibold">Qo‘shimcha vaqt gollari</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(["home", "away"] as Side[]).map((side) => (
                        <div key={side} className="flex flex-col items-center gap-1">
                          <span className="truncate text-xs text-muted-foreground">{team(side).name}</span>
                          <ScoreStepper
                            size="sm"
                            label={`${team(side).name} qo‘shimcha vaqt gollari`}
                            value={side === "home" ? state.homeExtra : state.awayExtra}
                            onChange={(v) => setGoals(side, "Extra", v)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {showPens && (
                  <div className="mt-3 rounded-xl border border-gold/40 bg-gold-soft p-3">
                    <p className="mb-2 text-sm font-semibold">Penaltilar seriyasi</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(["home", "away"] as Side[]).map((side) => (
                        <div key={side} className="flex flex-col items-center gap-1">
                          <span className="truncate text-xs text-muted-foreground">{team(side).name}</span>
                          <ScoreStepper
                            size="sm"
                            label={`${team(side).name} penaltilari`}
                            value={side === "home" ? state.homePens : state.awayPens}
                            onChange={(v) => update(side === "home" ? { homePens: v } : { awayPens: v })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {playable && !forfeit && (
          <section className="panel p-4" aria-labelledby="goals-title">
            <h2 id="goals-title" className="font-display text-lg">
              Gol mualliflari
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">Hisobni o‘zgartirsangiz, gollar ro‘yxati ham avtomatik moslashadi. Har bir gol uchun futbolchini tanlang.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {(["home", "away"] as Side[]).map((side) => (
                <div key={side}>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <TeamCrest team={team(side)} size="xs" />
                    {team(side).name}
                    <span className="ml-auto font-score text-md">{goalRows(side).length}</span>
                  </p>
                  {goalRows(side).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">Gol yo‘q</p>
                  ) : (
                    <ol className="space-y-2">
                      {goalRows(side).map((g, i) => {
                        const own = g.kind === "OWN_GOAL"
                        const options = rosterIds.get(own ? other(side) : side) ?? []
                        const patch = (p: Partial<GoalRow>) =>
                          setState((s) => (s ? { ...s, goals: s.goals.map((x) => (x.key === g.key ? { ...x, ...p } : x)) } : s))
                        return (
                          <li key={g.key} className="rounded-lg border border-border p-2.5">
                            <div className="mb-2 flex items-center gap-2 text-sm">
                              <BallIcon className="text-muted-foreground" />
                              <span className="font-semibold">{i + 1}-gol</span>
                              <Input
                                aria-label={`${i + 1}-gol daqiqasi`}
                                inputMode="numeric"
                                placeholder="Daqiqa"
                                value={g.minute}
                                onChange={(e) => patch({ minute: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                                className="ml-auto h-9! w-24"
                              />
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[8.5rem_1fr]">
                              <Select value={g.kind} onValueChange={(v) => patch({ kind: v as GoalKind, playerId: null, assistId: null })}>
                                <SelectTrigger aria-label="Gol turi" className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="GOAL">Oddiy gol</SelectItem>
                                  <SelectItem value="PENALTY_GOAL">Penalti</SelectItem>
                                  <SelectItem value="OWN_GOAL">Avtogol</SelectItem>
                                </SelectContent>
                              </Select>
                              <PlayerSelect
                                id={`${g.key}-player`}
                                label={own ? "Avtogol urgan raqib futbolchi" : "Gol muallifi"}
                                value={g.playerId}
                                onChange={(v) => patch({ playerId: v })}
                                options={options}
                                index={index}
                                allowNone
                              />
                            </div>
                            {g.kind === "GOAL" && (
                              <div className="mt-2">
                                <PlayerSelect
                                  id={`${g.key}-assist`}
                                  label="Assist bergan futbolchi"
                                  value={g.assistId}
                                  onChange={(v) => patch({ assistId: v })}
                                  options={(rosterIds.get(side) ?? []).filter((p) => p !== g.playerId)}
                                  index={index}
                                  allowNone
                                  noneLabel="Assist yo‘q"
                                />
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {playable && !forfeit && (
          <section className="panel p-4" aria-labelledby="cards-title">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="cards-title" className="font-display text-lg">
                Kartochkalar
              </h2>
              <div className="flex gap-2">
                {(["home", "away"] as Side[]).map((side) => (
                  <Button
                    key={side}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setState((s) => (s ? { ...s, cards: [...s.cards, { key: nextKey(), side, kind: "YELLOW", playerId: null, minute: "" }] } : s))}
                  >
                    <Plus aria-hidden="true" />
                    {team(side).shortName}
                  </Button>
                ))}
              </div>
            </div>
            {state.cards.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">Kartochka berilmagan</p>
            ) : (
              <ul className="space-y-2">
                {state.cards.map((c) => {
                  const patch = (p: Partial<CardRow>) => setState((s) => (s ? { ...s, cards: s.cards.map((x) => (x.key === c.key ? { ...x, ...p } : x)) } : s))
                  return (
                    <li key={c.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[auto_9rem_1fr_6rem_auto]">
                      <CardIcon kind={c.kind === "YELLOW" ? "yellow" : c.kind === "RED" ? "red" : "second"} />
                      <Select value={c.kind} onValueChange={(v) => patch({ kind: v as CardKind })}>
                        <SelectTrigger aria-label="Kartochka turi" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="YELLOW">Sariq</SelectItem>
                          <SelectItem value="SECOND_YELLOW">Ikkinchi sariq</SelectItem>
                          <SelectItem value="RED">Qizil</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="sm:order-last"
                        aria-label="Kartochkani o‘chirish"
                        onClick={() => setState((s) => (s ? { ...s, cards: s.cards.filter((x) => x.key !== c.key) } : s))}
                      >
                        <X aria-hidden="true" />
                      </Button>
                      <div className="col-span-3 sm:col-span-1">
                        <PlayerSelect
                          id={`${c.key}-player`}
                          label={`${team(c.side).name} futbolchisi`}
                          value={c.playerId}
                          onChange={(v) => patch({ playerId: v })}
                          options={rosterIds.get(c.side) ?? []}
                          index={index}
                          allowNone
                          noneLabel={`${team(c.side).name}: futbolchini tanlang`}
                        />
                      </div>
                      <Input
                        aria-label="Kartochka daqiqasi"
                        inputMode="numeric"
                        placeholder="Daqiqa"
                        value={c.minute}
                        onChange={(e) => patch({ minute: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                        className="col-span-3 sm:col-span-1"
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {playable && !forfeit && (
          <section className="panel p-4" aria-labelledby="apps-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="apps-title" className="font-display text-lg">
                O‘yinda qatnashganlar
                <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">ixtiyoriy</span>
              </h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowApps((v) => !v)} aria-expanded={showApps}>
                {showApps ? "Yashirish" : `Ochish (${state.appearances.size})`}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Futbolchilarning «o‘yinlar soni» statistikasi shu ro‘yxatdan hisoblanadi.</p>
            {showApps && (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {(["home", "away"] as Side[]).map((side) => {
                  const ids = rosterIds.get(side) ?? []
                  return (
                    <div key={side}>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-sm font-semibold">{team(side).name}</p>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setAppsTouched(true)
                            setState((s) => (s ? { ...s, appearances: new Set([...s.appearances, ...ids]) } : s))
                          }}
                        >
                          Hammasini belgilash
                        </Button>
                      </div>
                      <ul className="divide-y divide-border rounded-lg border border-border">
                        {ids.map((pid) => {
                          const p = index.player(pid)
                          const checked = state.appearances.has(pid)
                          return (
                            <li key={pid}>
                              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    setAppsTouched(true)
                                    setState((s) => {
                                      if (!s) return s
                                      const next = new Set(s.appearances)
                                      if (v) next.add(pid)
                                      else next.delete(pid)
                                      return { ...s, appearances: next }
                                    })
                                  }}
                                />
                                <span className="w-6 font-score text-muted-foreground">{index.numberOf(pid)}</span>
                                {p?.firstName} {p?.lastName}
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        <section
          aria-live="polite"
          className={cn(
            "rounded-xl border p-4 text-sm",
            check.errors.length ? (attempted ? "border-destructive/50 bg-destructive/5" : "border-border bg-card") : "border-win/40 bg-qualify-soft",
          )}
        >
          {check.errors.length === 0 ? (
            <p className="flex items-center gap-2 font-semibold text-win">
              <CircleCheck className="size-4" aria-hidden="true" />
              Ma’lumotlar mos. Saqlashga tayyor.
            </p>
          ) : (
            <>
              <p className={cn("mb-1 flex items-center gap-2 font-semibold", attempted ? "text-destructive" : "text-foreground")}>
                <TriangleAlert className="size-4" aria-hidden="true" />
                Saqlashdan oldin tuzating
              </p>
              <ul className="list-disc space-y-0.5 pl-6">
                {check.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </>
          )}
          {check.warnings.map((w) => (
            <p key={w} className="mt-1 text-muted-foreground">
              {w}
            </p>
          ))}
        </section>
      </fieldset>

      {!readOnly && (
        <StickyActions>
          <Button variant="outline" asChild className="flex-1 md:flex-none">
            <Link to="/admin/natijalar">Bekor qilish</Link>
          </Button>
          <Button onClick={onSave} disabled={save.isPending} className="flex-[2] md:flex-none">
            <Save aria-hidden="true" />
            {save.isPending ? "Saqlanmoqda…" : "Natijani saqlash"}
          </Button>
        </StickyActions>
      )}
      {quick && (
        <QuickEventDialog
          open={Boolean(quick)}
          onOpenChange={(v) => !v && setQuick(null)}
          mode={quick.mode}
          team={team(quick.side)}
          opponent={team(other(quick.side))}
          roster={rosterIds.get(quick.side) ?? []}
          opponentRoster={rosterIds.get(other(quick.side)) ?? []}
          index={index}
          suspended={bannedIds}
          onGoal={(kind, playerId) => addGoal(quick.side, kind, playerId)}
          onCard={(kind, playerId) => addCard(quick.side, kind, playerId)}
        />
      )}
      <MatchImageDialog match={match} index={index} open={imageOpen} onOpenChange={setImageOpen} />
    </div>
  )
}
