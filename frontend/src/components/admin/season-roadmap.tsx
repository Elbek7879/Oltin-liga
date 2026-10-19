import { Check, ChevronDown, TriangleAlert } from "lucide-react"
import { Link } from "react-router"
import type { SeasonBundle } from "@/api/types"
import { Button } from "@/components/ui/button"
import { seasonRoadmap, type RoadmapStep, type StepState } from "@/lib/season-roadmap"
import { cn } from "@/lib/utils"

const BAR: Record<StepState, string> = {
  done: "bg-qualify",
  current: "bg-gold",
  attention: "bg-live",
  todo: "bg-muted",
}

const STATE_TEXT: Record<StepState, string> = {
  done: "bajarildi",
  current: "hozirgi qadam",
  attention: "diqqat talab qiladi",
  todo: "keyinroq",
}

function Marker({ step, n }: { step: RoadmapStep; n: number }) {
  if (step.state === "done")
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-qualify text-white">
        <Check className="size-4" aria-hidden="true" />
      </span>
    )
  if (step.state === "attention")
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-live/10 text-live">
        <TriangleAlert className="size-4" aria-hidden="true" />
      </span>
    )
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full font-score text-sm",
        step.state === "current" ? "bg-gold text-pitch-950" : "border border-border text-muted-foreground",
      )}
    >
      {n}
    </span>
  )
}

function StepRow({ step, n, emphasize }: { step: RoadmapStep; n: number; emphasize?: boolean }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Marker step={step} n={n} />
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold leading-tight", step.state === "todo" && "text-muted-foreground")}>
          {step.title}
          {step.optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(ixtiyoriy)</span>}
          <span className="sr-only">, {STATE_TEXT[step.state]}</span>
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p>
      </div>
      {step.action && (emphasize || step.state === "attention") && (
        <Button asChild size="sm" variant={step.state === "current" ? "default" : "outline"} className="shrink-0">
          <Link to={step.action.to}>{step.action.label}</Link>
        </Button>
      )}
    </li>
  )
}

/** Boshqaruv panelidagi mavsum yo'l xaritasi: bajarilgan qadamlar, hozirgi qadam va diqqat talab qiladiganlar */
export function SeasonRoadmap({ bundle }: { bundle: SeasonBundle }) {
  const steps = seasonRoadmap(bundle)
  const done = steps.filter((s) => s.state === "done").length
  const focus = steps.map((s, i) => ({ s, n: i + 1 })).filter(({ s }) => s.state === "current" || s.state === "attention")

  return (
    <section className="panel mb-6 overflow-hidden" aria-labelledby="roadmap-title">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-3">
        <h2 id="roadmap-title" className="font-display text-lg">
          Mavsum bosqichlari
        </h2>
        <span className="text-sm text-muted-foreground">
          {done} / {steps.length} bajarildi
        </span>
      </div>
      <div className="flex gap-1 px-4 pt-2 pb-1" aria-hidden="true">
        {steps.map((s) => (
          <span key={s.key} className={cn("h-1.5 flex-1 rounded-full", BAR[s.state])} />
        ))}
      </div>
      {focus.length > 0 ? (
        <ol className="divide-y divide-border" aria-label="Keyingi qadamlar">
          {focus.map(({ s, n }) => (
            <StepRow key={s.key} step={s} n={n} emphasize />
          ))}
        </ol>
      ) : (
        <p className="flex items-center gap-2 px-4 py-3 text-sm">
          <Check className="size-4 text-win" aria-hidden="true" />
          Barcha bosqichlar bajarildi.
        </p>
      )}
      <details className="group border-t border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-4 text-sm font-semibold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          Barcha bosqichlar
          <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <ol className="divide-y divide-border border-t border-border">
          {steps.map((s, i) => (
            <StepRow key={s.key} step={s} n={i + 1} emphasize />
          ))}
        </ol>
      </details>
    </section>
  )
}
