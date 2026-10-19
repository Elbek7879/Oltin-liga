import { cn } from "@/lib/utils"

type CrestTeam = { name: string; shortName: string; primaryColor: string; secondaryColor: string; logoUrl?: string | null }

const SIZES = {
  xs: { className: "w-[18px]", px: 18 },
  sm: { className: "w-6", px: 24 },
  md: { className: "w-8", px: 32 },
  lg: { className: "w-11", px: 44 },
  xl: { className: "w-16 md:w-[72px]", px: 72 },
} as const

/**
 * Jamoa nishoni. Logotip yuklangan bo'lsa — rasm, aks holda jamoa ranglari va
 * qisqa nomidan avtomatik yasalgan qalqon. Jamoa nomi har doim yonida yozilgani uchun
 * nishon bezak hisoblanadi (alt bo'sh).
 */
export function TeamCrest({
  team,
  size = "md",
  className,
}: {
  team?: CrestTeam | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const { className: sizeClass, px } = SIZES[size]
  if (team?.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        className={cn("aspect-square h-auto shrink-0 rounded-md object-contain", sizeClass, className)}
      />
    )
  }
  const label = team ? team.shortName.slice(0, 3).toUpperCase() : "?"
  return (
    <svg viewBox="0 0 40 46" aria-hidden="true" className={cn("aspect-[40/46] h-auto shrink-0", sizeClass, className)} focusable="false">
      {team ? (
        <>
          <path d="M20 1.5 37.5 7v15.2c0 11.4-7.4 18.4-17.5 22.3C9.9 40.6 2.5 33.6 2.5 22.2V7Z" fill={team.primaryColor} />
          <path d="M2.5 7 20 1.5 37.5 7v5.5H2.5Z" fill={team.secondaryColor} opacity="0.9" />
          <path
            d="M20 1.5 37.5 7v15.2c0 11.4-7.4 18.4-17.5 22.3C9.9 40.6 2.5 33.6 2.5 22.2V7Z"
            fill="none"
            stroke="rgb(0 0 0 / 0.18)"
            strokeWidth="1.2"
          />
          <text
            x="20"
            y="30"
            textAnchor="middle"
            fontSize={label.length > 2 ? 11.5 : 14}
            fontWeight="800"
            fontStretch="75%"
            fill={team.secondaryColor}
            style={{ fontFamily: "var(--font-sans)", letterSpacing: "0.02em" }}
          >
            {label}
          </text>
        </>
      ) : (
        <>
          <path
            d="M20 1.5 37.5 7v15.2c0 11.4-7.4 18.4-17.5 22.3C9.9 40.6 2.5 33.6 2.5 22.2V7Z"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeDasharray="3 3"
            strokeWidth="1.5"
          />
          <text x="20" y="29" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor" opacity="0.5">
            ?
          </text>
        </>
      )}
    </svg>
  )
}
