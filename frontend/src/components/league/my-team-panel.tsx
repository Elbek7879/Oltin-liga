import { Ban, Star, X } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SUSPENSION_REASON } from "@/domain/discipline"
import type { Match } from "@/domain/types"
import { MY_TEAM_DISMISSED, useMyTeam } from "@/hooks/use-my-team"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { formatShortDate, formatTime, relativeDayLabel } from "@/lib/format"
import { myTeamSummary, type Outcome } from "@/lib/my-team"
import { UNCONFIRMED_DATE } from "@/lib/playoff-overview"
import { stageLabel } from "@/lib/match"
import { cn } from "@/lib/utils"
import { LiveLabel } from "./live-label"
import { TeamCrest } from "./team-crest"

const OUTCOME: Record<Outcome, { label: string; className: string }> = {
  W: { label: "G‘alaba", className: "bg-win text-white" },
  D: { label: "Durang", className: "bg-draw text-white" },
  L: { label: "Mag‘lubiyat", className: "bg-loss text-white" },
}

function TeamPicker({ index, value, onChange, label, compact }: { index: SeasonIndex; value?: string; onChange: (v: string) => void; label: string; compact?: boolean }) {
  const teams = [...index.bundle.teams].sort((a, b) => a.name.localeCompare(b.name, "uz"))
  return (
    <Select value={value} onValueChange={onChange}>
      {compact ? (
        <SelectTrigger aria-label={label} className="shrink-0">
          <span>O‘zgartirish</span>
        </SelectTrigger>
      ) : (
        <SelectTrigger aria-label={label} className="w-full sm:w-56">
          <SelectValue placeholder="Jamoani tanlang" />
        </SelectTrigger>
      )}
      <SelectContent>
        {teams.map((t) => (
          <SelectItem key={t.teamId} value={t.teamId}>
            <TeamCrest team={t} size="xs" />
            {t.name}
          </SelectItem>
        ))}
        {value && (
          <>
            <SelectSeparator />
            <SelectItem value={MY_TEAM_DISMISSED}>Jamoani kuzatmaslik</SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  )
}

function MatchLine({ match, index, teamId }: { match: Match; index: SeasonIndex; teamId: string }) {
  const opponent = index.team(match.homeId === teamId ? match.awayId : match.homeId)
  const home = match.homeId === teamId
  return (
    <span className="flex min-w-0 items-center gap-2">
      <TeamCrest team={opponent} size="xs" />
      <span className="min-w-0 truncate font-semibold">
        {opponent?.name ?? (home ? match.awayLabel : match.homeLabel) ?? "Aniqlanmagan"}
      </span>
    </span>
  )
}

/**
 * Bosh sahifadagi «Mening jamoam»: muxlis o'z jamoasini bir marta tanlaydi —
 * keyin uning jadvaldagi o'rni, keyingi o'yini va oxirgi natijasi doim ko'z oldida bo'ladi.
 */
export function MyTeamPanel({ index }: { index: SeasonIndex }) {
  const { teamId, dismissed, setMyTeam } = useMyTeam()
  if (index.bundle.teams.length === 0) return null

  if (!teamId) {
    if (dismissed) return null
    return (
      <section aria-labelledby="my-team-title" className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <Star className="hidden size-5 shrink-0 text-gold-text sm:block" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="my-team-title" className="font-display text-lg">
            Mening jamoam
          </h2>
          <p className="text-sm text-muted-foreground">Jamoangizni tanlang — uning keyingi o‘yini, oxirgi natijasi va jadvaldagi o‘rni shu yerda chiqadi.</p>
        </div>
        <div className="flex items-center gap-2">
          <TeamPicker index={index} onChange={(v) => setMyTeam(v)} label="Mening jamoam: jamoani tanlang" />
          <Button variant="ghost" size="icon" onClick={() => setMyTeam(MY_TEAM_DISMISSED)} aria-label="Taklifni yopish" className="size-11 shrink-0">
            <X aria-hidden="true" />
          </Button>
        </div>
      </section>
    )
  }

  const summary = myTeamSummary(index, teamId)
  if (!summary) {
    return (
      <section aria-labelledby="my-team-title" className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 id="my-team-title" className="font-display text-lg">
            Mening jamoam
          </h2>
          <p className="text-sm text-muted-foreground">Tanlangan jamoangiz bu mavsumda qatnashmayapti. Boshqa jamoani tanlashingiz mumkin.</p>
        </div>
        <TeamPicker index={index} onChange={(v) => setMyTeam(v)} label="Mening jamoam: boshqa jamoani tanlash" />
      </section>
    )
  }

  const { team, standing, stage, next, last, suspensions } = summary
  return (
    <section aria-labelledby="my-team-title" className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <TeamCrest team={team} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-xs font-semibold text-gold-text">
            <Star className="size-3.5 fill-current" aria-hidden="true" />
            <span id="my-team-title">Mening jamoam</span>
          </p>
          <Link to={`/jamoalar/${team.teamId}`} className="block truncate font-display text-lg hover:underline">
            {team.name}
          </Link>
        </div>
        <TeamPicker index={index} value={team.teamId} onChange={(v) => setMyTeam(v)} label="Mening jamoamni o‘zgartirish" compact />
      </div>

      <dl className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Jadvalda</dt>
          <dd className="mt-0.5">
            {standing ? (
              <>
                <Link to="/jadval" className="font-semibold hover:underline">
                  {standing.position}-o‘rin, {standing.group} guruhi
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {standing.points} ochko, {standing.played} o‘yin
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Guruhlar hali tuzilmagan</span>
            )}
            {(stage || standing?.inZone) && (
              <span
                className={cn(
                  "mt-1 inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold",
                  stage?.tone === "gold" ? "bg-gold-soft text-gold-text" : stage?.tone === "out" ? "bg-muted text-muted-foreground" : "bg-qualify-soft text-win",
                )}
              >
                {stage?.label ?? "Pley-off zonasida"}
              </span>
            )}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">{next?.status === "LIVE" ? "Hozir o‘ynayapti" : "Keyingi o‘yin"}</dt>
          <dd className="mt-0.5 text-sm">
            {next ? (
              <Link to={`/oyinlar/${next.id}`} className="group block">
                <MatchLine match={next} index={index} teamId={team.id} />
                <span className="block text-xs text-muted-foreground group-hover:text-foreground">
                  {next.status === "LIVE" ? (
                    <>
                      Jonli
                      <LiveLabel match={next} prefix=", " />
                    </>
                  ) : next.timeConfirmed === false
                    ? `${stageLabel(next, index)}, ${UNCONFIRMED_DATE.toLowerCase()}`
                    : `${relativeDayLabel(next.kickoff)}, ${formatTime(next.kickoff)}`}
                </span>
              </Link>
            ) : (
              <span className="text-muted-foreground">Belgilangan o‘yin yo‘q</span>
            )}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Oxirgi natija</dt>
          <dd className="mt-0.5 text-sm">
            {last ? (
              <Link to={`/oyinlar/${last.match.id}`} className="group flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 font-score text-md", OUTCOME[last.outcome].className)} title={OUTCOME[last.outcome].label}>
                  {last.score}
                  <span className="sr-only">, {OUTCOME[last.outcome].label}</span>
                </span>
                <span className="min-w-0">
                  <MatchLine match={last.match} index={index} teamId={team.id} />
                  <span className="block text-xs text-muted-foreground group-hover:text-foreground">{formatShortDate(last.match.kickoff)}</span>
                </span>
              </Link>
            ) : (
              <span className="text-muted-foreground">Hali o‘ynamagan</span>
            )}
          </dd>
        </div>
      </dl>

      {suspensions.length > 0 && (
        <p className="flex items-start gap-2 border-t border-border bg-destructive/5 px-4 py-2.5 text-sm">
          <Ban className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <span>
            <span className="font-semibold">Keyingi o‘yinda o‘ynamaydi: </span>
            {suspensions.map((s, i) => {
              const p = index.player(s.playerId)
              return (
                <span key={s.playerId}>
                  {i > 0 && "; "}
                  {p?.firstName} {p?.lastName} ({SUSPENSION_REASON[s.reason]})
                </span>
              )
            })}
          </span>
        </p>
      )}
    </section>
  )
}
