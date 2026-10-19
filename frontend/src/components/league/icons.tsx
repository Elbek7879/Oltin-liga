import { cn } from "@/lib/utils"

/** Futbol to'pi — Lucide ikonalari uslubida (24px, 2px chiziq) */
export function BallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m12 7 4 3-1.5 4.5h-5L8 10Z" />
      <path d="M12 7V2.5M16 10l4.2-1.6M14.5 14.5l2.6 3.8M9.5 14.5l-2.6 3.8M8 10 3.8 8.4" />
    </svg>
  )
}

export function CardIcon({ kind, className }: { kind: "yellow" | "red" | "second"; className?: string }) {
  if (kind === "second") {
    return (
      <span aria-hidden="true" className={cn("relative inline-block h-[14px] w-[13px] shrink-0", className)}>
        <span className="absolute top-0 left-0 h-[12px] w-[9px] rounded-[2px] bg-[#f2c94c]" />
        <span className="absolute right-0 bottom-0 h-[12px] w-[9px] rounded-[2px] bg-[#d63b2f] ring-1 ring-card" />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-[13px] w-[10px] shrink-0 rounded-[2px]", kind === "yellow" ? "bg-[#f2c94c]" : "bg-[#d63b2f]", className)}
    />
  )
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-2 shrink-0", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2 rounded-full bg-live" />
    </span>
  )
}

/**
 * Maydon chiziqlari: o'rta chiziq va markaziy doira. Asosiy o'yin bloki
 * va pley-off sxemasining fonida ishlatiladi.
 */
export function PitchLines({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      <g fill="none" stroke="var(--band-line)" strokeWidth="1.5">
        <line x1="400" y1="0" x2="400" y2="300" />
        <circle cx="400" cy="150" r="78" />
        <circle cx="400" cy="150" r="3" fill="var(--band-line)" />
        <rect x="-2" y="70" width="70" height="160" />
        <rect x="732" y="70" width="70" height="160" />
        <path d="M68 115a40 40 0 0 1 0 70M732 115a40 40 0 0 0 0 70" />
      </g>
    </svg>
  )
}
