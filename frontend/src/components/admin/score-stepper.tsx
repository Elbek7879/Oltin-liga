import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Hisobni katta − / + tugmalar bilan kiritish (telefonda klaviatura ochmasdan) */
export function ScoreStepper({
  value,
  onChange,
  label,
  disabled,
  size = "lg",
}: {
  value: number
  onChange: (v: number) => void
  label: string
  disabled?: boolean
  size?: "lg" | "sm"
}) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2" role="group" aria-label={label}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={size === "lg" ? "sm:size-12 md:size-12" : undefined}
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
        aria-label={`${label}: kamaytirish`}
      >
        <Minus aria-hidden="true" />
      </Button>
      <output
        aria-live="polite"
        aria-label={label}
        className={cn("w-9 text-center font-score tabular-nums sm:w-12", size === "lg" ? "text-4xl leading-none sm:text-5xl" : "text-3xl leading-none")}
      >
        {value}
      </output>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={size === "lg" ? "sm:size-12 md:size-12" : undefined}
        onClick={() => onChange(Math.min(50, value + 1))}
        disabled={disabled}
        aria-label={`${label}: oshirish`}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  )
}
