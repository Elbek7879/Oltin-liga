import { Moon, Sun } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useScript } from "@/hooks/use-script"
import { useSeason } from "@/hooks/use-season"
import { useTheme } from "@/hooks/use-theme"
import { seasonLabel } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Liga logotipi. Yonida liga nomi yozilgani uchun bezak sifatida (alt bo'sh);
 * yolg'iz ishlatilganda `label` beriladi.
 */
export function LeagueMark({ className, size = "sm", label }: { className?: string; size?: "sm" | "lg"; label?: string }) {
  const sm = size === "sm"
  return (
    <img
      src={sm ? "/brand/logo-96.webp" : "/brand/logo-192.webp"}
      srcSet={sm ? "/brand/logo-96.webp 1x, /brand/logo-192.webp 2x" : "/brand/logo-192.webp 1x, /brand/logo-320.webp 2x"}
      width={sm ? 36 : 128}
      height={sm ? 36 : 128}
      alt={label ?? ""}
      decoding="async"
      className={cn("shrink-0 rounded-full", sm ? "size-9" : "size-32", className)}
    />
  )
}

/** compact: 1024–1279px kenglikda faqat belgi qoladi — menyu bandlari bir qatorga sig'adi */
export function Logo({ to = "/", subtitle, compact = false }: { to?: string; subtitle?: string; compact?: boolean }) {
  return (
    <Link to={to} className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-md py-1 max-lg:shrink" aria-label="Payariq Oltin Ligasi — bosh sahifa">
      <LeagueMark className="shrink-0 md:size-10" />
      <span className={cn("flex min-w-0 flex-col leading-none", compact && "lg:max-xl:hidden")}>
        {/* Tor telefonda nom ikki qatorga bo'linadi — tugmalar ko'payganda ham qisqarib qolmaydi */}
        <span className="truncate font-display text-[17px] text-gold-400 max-[430px]:text-[15px] max-[430px]:leading-[1.05] max-[430px]:whitespace-normal md:text-xl">
          <span className="max-[430px]:block">Payariq </span>
          <span className="max-[430px]:block">Oltin Ligasi</span>
        </span>
        {subtitle && <span className="mt-1 truncate text-2xs text-band-muted">{subtitle}</span>}
      </span>
    </Link>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme()
  const dark = resolved === "dark"
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={dark ? "Yorug‘ rejimga o‘tish" : "Qorong‘i rejimga o‘tish"}
      className={cn("text-band-foreground hover:bg-white/10 hover:text-band-foreground dark:hover:bg-white/10", className)}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}

/**
 * Lotin ↔ kirill yozuvi. Tugma yozuvi o'zi o'girilmaydi (data-translit="off"):
 * lotin rejimida «Кирилл», kirill rejimida «Lotin» — har kim o'z yozuvida o'qiy oladi.
 */
export function ScriptToggle({ className }: { className?: string }) {
  const { script, toggle } = useScript()
  const cyrillic = script === "cyrl"
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      data-translit="off"
      lang={cyrillic ? "uz-Latn" : "uz-Cyrl"}
      aria-label={cyrillic ? "Lotin yozuviga o‘tish" : "Кирилл ёзувига ўтиш"}
      aria-pressed={cyrillic}
      className={cn("h-11 min-w-11 px-2.5 text-sm font-semibold text-band-foreground hover:bg-white/10 hover:text-band-foreground md:h-9 dark:hover:bg-white/10", className)}
    >
      {cyrillic ? "Lotin" : "Кирилл"}
    </Button>
  )
}

/** compact: 1024–1279px kenglikda faqat yil ko'rsatiladi */
export function SeasonSelect({ className, tone = "band", compact = false }: { className?: string; tone?: "band" | "plain"; compact?: boolean }) {
  const { seasons, season, seasonId, setSeasonId, isLoading } = useSeason()
  // Ro'yxat yuklanguncha joy band qilinadi — tugma keyin paydo bo'lib, yonidagilarni surib yubormasin (CLS)
  if (isLoading) return <span aria-hidden="true" className={cn("block h-11 w-20 md:h-9 sm:w-40", compact && "lg:max-xl:w-20")} />
  if (seasons.length === 0) return null
  return (
    <Select value={seasonId} onValueChange={(id) => setSeasonId(id)}>
      <SelectTrigger
        aria-label="Mavsumni tanlash"
        className={cn(
          "h-11! min-w-0 gap-1 rounded-full px-3 text-sm md:h-9!",
          tone === "band" && "border-white/25 bg-white/5 text-band-foreground hover:bg-white/10 dark:bg-white/5 [&_svg]:text-band-muted!",
          className,
        )}
      >
        <SelectValue>
          {season && (
            <>
              <span className={cn("sm:hidden", compact && "lg:max-xl:inline")}>{season.year}</span>
              <span className={cn("hidden sm:inline", compact && "lg:max-xl:hidden")}>
                {seasonLabel(season)}
              </span>
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {seasons.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {seasonLabel(s)}
            {s.test ? " (sinov)" : s.status === "ACTIVE" ? " (joriy)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
