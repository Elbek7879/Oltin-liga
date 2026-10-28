import { CalendarClock, Crown, Star, Trophy } from "lucide-react"
import { Link } from "react-router"
import { isPlayInRound, ROUND_LABELS, ROUND_SEQUENCE, roundLabel } from "@/domain/playoff"
import type { Match, PlayoffRoundKey } from "@/domain/types"
import { useMyTeam } from "@/hooks/use-my-team"
import type { SeasonIndex } from "@/hooks/use-season-data"
import { formatShortDate, formatTime } from "@/lib/format"
import { UNCONFIRMED_DATE } from "@/lib/playoff-overview"
import { sideName, totalScore, winnerSide } from "@/lib/match"
import { cn } from "@/lib/utils"
import { LiveDot } from "./icons"
import { LiveLabel } from "./live-label"
import { TeamCrest } from "./team-crest"

const byIndex = (a: Match, b: Match) => (a.bracketIndex ?? 0) - (b.bracketIndex ?? 0)

export function playoffRounds(matches: Match[]) {
  const present = new Set(matches.map((m) => m.playoffRound))
  return ROUND_SEQUENCE.filter((r) => present.has(r))
}

/** «Yarim final, 1-o‘yin» — g'olib qaysi o'yinga chiqishi */
export function nextStepLabel(match: Match, matches: Match[]) {
  const next = match.nextMatchId ? matches.find((m) => m.id === match.nextMatchId) : undefined
  if (!next?.playoffRound) return null
  if (next.playoffRound === "F") return "Final"
  const list = matches.filter((m) => m.playoffRound === next.playoffRound).sort(byIndex)
  return `${roundLabel(next.playoffRound, matches)}, ${list.indexOf(next) + 1}-o‘yin`
}

/** Sxemadagi bitta o'yin kartasi: g'olib oltin chiziq bilan, mag'lub xira, sana yoki jonli holat pastda */
export function BracketMatch({
  match,
  index,
  className,
  linkable = true,
  note,
}: {
  match: Match
  index: SeasonIndex
  className?: string
  linkable?: boolean
  /** Karta pastidagi qo'shimcha izoh (masalan, g'olib qayerga chiqadi) */
  note?: string | null
}) {
  const { teamId: myTeamId } = useMyTeam()
  const score = totalScore(match)
  const winner = winnerSide(match)
  const isFinal = match.playoffRound === "F"
  const rows = (["home", "away"] as const).map((side) => {
    const team = index.team(side === "home" ? match.homeId : match.awayId)
    return {
      side,
      team,
      name: sideName(match, side, index),
      score: score ? score[side] : null,
      pens: match.decidedBy === "PENALTIES" ? (side === "home" ? match.homePens : match.awayPens) : null,
      mine: Boolean(myTeamId && team?.teamId === myTeamId),
    }
  })
  const mine = rows.some((r) => r.mine)
  const live = match.status === "LIVE"
  const decided = match.decidedBy === "EXTRA_TIME" ? "Qo‘shimcha vaqtda" : match.decidedBy === "PENALTIES" ? "Penaltilarda" : null
  const Wrapper = (linkable ? Link : "div") as React.ElementType
  return (
    <Wrapper
      {...(linkable ? { to: `/oyinlar/${match.id}` } : {})}
      className={cn(
        "block w-full overflow-hidden rounded-xl border bg-card text-left transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
        isFinal ? "border-gold/70 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-gold-500)_16%,transparent)]" : "border-border",
        live && "border-live/50",
        mine && "ring-2 ring-gold/60",
        linkable && "hover:border-pitch-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {isFinal && (
        <span className="flex items-center gap-1.5 bg-pitch-900 px-3 py-1.5 text-xs font-semibold text-gold-300 dark:bg-pitch-950">
          <Trophy className="size-3.5" aria-hidden="true" />
          Final
        </span>
      )}
      {rows.map((r) => {
        const won = winner === r.side
        const lost = Boolean(winner) && !won
        return (
          <span key={r.side} className={cn("relative flex h-9 items-center gap-2 pr-2 pl-3 text-sm", r.side === "home" && "border-b border-border", won && "font-semibold", lost && "text-muted-foreground")}>
            {won && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-gold" />}
            <TeamCrest team={r.team} size="xs" className={cn(lost && "opacity-60")} />
            <span title={r.name} className={cn("min-w-0 flex-1 truncate", !r.team && "text-xs text-muted-foreground italic")}>
              {r.name}
            </span>
            {r.mine && (
              <Star className="size-3 shrink-0 fill-current text-gold-text" role="img" aria-label="Mening jamoam" />
            )}
            {r.pens != null && <span className="font-score text-xs text-muted-foreground">({r.pens})</span>}
            <span
              className={cn(
                "min-w-6 rounded px-1 text-center font-score text-md tabular-nums",
                won && "bg-pitch-900 text-gold-300 dark:bg-gold-400 dark:text-pitch-950",
              )}
            >
              {r.score ?? ""}
            </span>
          </span>
        )
      })}
      <span className="flex items-center justify-between gap-2 bg-muted/50 px-3 py-1 text-2xs text-muted-foreground">
        {live ? (
          <span className="inline-flex items-center gap-1 font-semibold text-live">
            <LiveDot />
            Jonli
            <LiveLabel match={match} prefix=", " />
          </span>
        ) : match.timeConfirmed === false && match.status !== "FINISHED" ? (
          <span className="inline-flex items-center gap-1 font-semibold text-gold-text">
            <CalendarClock className="size-3" aria-hidden="true" />
            {UNCONFIRMED_DATE}
          </span>
        ) : (
          <span>
            {formatShortDate(match.kickoff)}, {formatTime(match.kickoff)}
          </span>
        )}
        {(decided ?? note) && <span className="truncate text-right">{decided ?? note}</span>}
      </span>
    </Wrapper>
  )
}

/** Final o'ynalgach — chempion */
export function ChampionBanner({ matches, index }: { matches: Match[]; index: SeasonIndex }) {
  const final = matches.find((m) => m.playoffRound === "F" && m.status === "FINISHED")
  const side = final ? winnerSide(final) : null
  if (!final || !side) return null
  const team = index.team(side === "home" ? final.homeId : final.awayId)
  return (
    <div className="mx-auto mb-6 flex w-fit max-w-full items-center gap-4 rounded-2xl border border-gold/60 bg-gold-soft px-5 py-3">
      <Crown className="size-7 shrink-0 text-gold-text" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gold-text">{index.bundle.season.year}-yil chempioni</p>
        <p className="truncate font-display text-2xl">{sideName(final, side, index)}</p>
      </div>
      <TeamCrest team={team} size="lg" />
    </div>
  )
}

/* ───────── Kompyuter uchun setka: ikki tomondan markazdagi finalga ───────── */

type Side = "L" | "R"

function SideColumn({ list, side, depth, last, index, linkable, height }: { list: Match[]; side: Side; depth: number; last: boolean; index: SeasonIndex; linkable: boolean; height: number }) {
  const pairs: Match[][] = []
  for (let i = 0; i < list.length; i += 2) pairs.push(list.slice(i, i + 2))
  return (
    <div className="flex flex-col" style={{ height }}>
      {pairs.map((pair, pi) => (
        <div
          key={pi}
          className={cn(
            "relative flex flex-1 flex-col",
            // Juftlikni keyingi bosqichga ulovchi tik chiziq
            pair.length === 2 &&
              (side === "L"
                ? "before:absolute before:top-1/4 before:bottom-1/4 before:left-[calc(100%+0.625rem)] before:border-l-[1.5px] before:border-pitch-300 before:content-[''] dark:before:border-pitch-600"
                : "before:absolute before:top-1/4 before:right-[calc(100%+0.625rem)] before:bottom-1/4 before:border-r-[1.5px] before:border-pitch-300 before:content-[''] dark:before:border-pitch-600"),
          )}
        >
          {pair.map((m) => {
            const done = m.status === "FINISHED"
            return (
              <div
                key={m.id}
                className={cn(
                  "relative flex flex-1 items-center py-2",
                  // Chiquvchi chiziq: g'olib aniqlangan bo'lsa — oltin
                  "after:absolute after:top-1/2 after:border-t-2 after:content-['']",
                  side === "L" ? "after:left-full" : "after:right-full",
                  last ? "after:w-5" : "after:w-2.5",
                  done ? "after:border-gold" : "after:border-pitch-300 dark:after:border-pitch-600",
                  // Kiruvchi chiziq (oldingi bosqichdan)
                  depth > 0 &&
                    (side === "L"
                      ? "before:absolute before:top-1/2 before:right-full before:w-2.5 before:border-t-[1.5px] before:border-pitch-300 before:content-[''] dark:before:border-pitch-600"
                      : "before:absolute before:top-1/2 before:left-full before:w-2.5 before:border-t-[1.5px] before:border-pitch-300 before:content-[''] dark:before:border-pitch-600"),
                )}
              >
                <BracketMatch match={m} index={index} linkable={linkable} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * Pley-off setkasi (kompyuter): chap va o'ng yarim markazdagi Finalga yig'iladi.
 * G'olib o'tgan yo'l oltin chiziq bilan, «Mening jamoam» yulduzcha bilan belgilanadi.
 * Saralash o'yinlari setka ustida alohida qatorda.
 */
/** headingLevel: bosqich sarlavhalari darajasi — sahifada ulardan oldin h2 bo'lmasa, 2 beriladi (h1 → h3 sakramasin) */
export function Bracket({ matches, index, linkable = true, headingLevel = 3 }: { matches: Match[]; index: SeasonIndex; linkable?: boolean; headingLevel?: 2 | 3 }) {
  const RoundHeading = headingLevel === 2 ? "h2" : "h3"
  const playInRound = playoffRounds(matches).find((r) => isPlayInRound(r, matches))
  const rounds = playoffRounds(matches).filter((r) => r !== playInRound)
  const sideRounds = rounds.filter((r) => r !== "F")
  const byRound = (r: PlayoffRoundKey) => matches.filter((m) => m.playoffRound === r).sort(byIndex)
  const halfOf = (r: PlayoffRoundKey, side: Side) => {
    const list = byRound(r)
    const h = Math.ceil(list.length / 2)
    return side === "L" ? list.slice(0, h) : list.slice(h)
  }
  const playIns = playInRound ? byRound(playInRound) : []
  const final = matches.find((m) => m.playoffRound === "F")
  const third = matches.find((m) => m.playoffRound === "THIRD")
  const firstSide = sideRounds.length > 0 ? halfOf(sideRounds[0], "L").length : 1
  const height = Math.max(firstSide * 120, 200)

  const columns: { key: string; label: string; side: Side | "C"; round: PlayoffRoundKey; depth: number }[] = [
    ...sideRounds.map((r, i) => ({ key: `L-${r}`, label: ROUND_LABELS[r], side: "L" as const, round: r, depth: i })),
    { key: "F", label: "Final", side: "C" as const, round: "F" as PlayoffRoundKey, depth: sideRounds.length },
    ...[...sideRounds].reverse().map((r) => ({ key: `R-${r}`, label: ROUND_LABELS[r], side: "R" as const, round: r, depth: sideRounds.indexOf(r) })),
  ]
  const n = columns.length
  const center = columns.findIndex((c) => c.side === "C") + 1
  const template = { gridTemplateColumns: `repeat(${n}, minmax(9.5rem, 14.5rem))`, minWidth: `calc(${n} * 9.5rem + ${n - 1} * 1.25rem)` }

  return (
    <div>
      <ChampionBanner matches={matches} index={index} />
      {playIns.length > 0 && (
        <section className="mb-6 rounded-2xl border border-dashed border-border p-4" aria-label="Saralash o‘yinlari">
          <RoundHeading className="text-sm font-semibold">{roundLabel(playInRound!, matches)}</RoundHeading>
          <p className="mb-3 text-xs text-muted-foreground">
            G‘oliblar {sideRounds[0] ? ROUND_LABELS[sideRounds[0]].toLowerCase() : "keyingi bosqich"}dagi bo‘sh joylarni egallaydi.
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))" }}>
            {playIns.map((m) => {
              const target = nextStepLabel(m, matches)
              return <BracketMatch key={m.id} match={m} index={index} linkable={linkable} note={target ? `G‘olib: ${target}` : null} />
            })}
          </div>
        </section>
      )}

      <div className="overflow-x-auto overscroll-x-contain pb-2">
        <div className="grid justify-center gap-x-5" style={template}>
          {columns.map((c) => (
            <RoundHeading key={c.key} className={cn("mb-2 text-center text-xs font-semibold text-muted-foreground", c.side === "C" && "text-gold-text")}>
              {c.label}
            </RoundHeading>
          ))}
          {columns.map((c) =>
            c.side === "C" ? (
              <div key={c.key} className="relative" style={{ height }}>
                {final && (
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                    <BracketMatch match={final} index={index} linkable={linkable} />
                  </div>
                )}
              </div>
            ) : (
              <SideColumn
                key={c.key}
                list={halfOf(c.round, c.side)}
                side={c.side}
                depth={c.depth}
                last={c.depth === sideRounds.length - 1}
                index={index}
                linkable={linkable}
                height={height}
              />
            ),
          )}
          {third && (
            <div className="mt-4" style={{ gridColumn: center }}>
              <p className="mb-1.5 text-center text-xs font-semibold text-muted-foreground">3-o‘rin uchun o‘yin</p>
              <BracketMatch match={third} index={index} linkable={linkable} />
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-gold" />
          G‘olib keyingi bosqichga o‘tdi
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Star className="size-3 fill-current text-gold-text" aria-hidden="true" />
          Mening jamoam
        </span>
      </p>
    </div>
  )
}
