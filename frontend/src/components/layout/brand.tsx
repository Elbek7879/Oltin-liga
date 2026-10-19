import { Moon, Sun } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSeason } from "@/hooks/use-season"
import { useTheme } from "@/hooks/use-theme"
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

export function Logo({ to = "/", subtitle }: { to?: string; subtitle?: string }) {
  return (
    <Link to={to} className="flex min-w-0 items-center gap-2.5 rounded-md py-1" aria-label="Payariq Oltin Ligasi — bosh sahifa">
      <LeagueMark className="md:size-10" />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate font-display text-[17px] text-gold-400 md:text-xl">Payariq Oltin Ligasi</span>
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

export function SeasonSelect({ className, tone = "band" }: { className?: string; tone?: "band" | "plain" }) {
  const { seasons, season, seasonId, setSeasonId } = useSeason()
  if (seasons.length === 0) return null
  return (
    <Select value={seasonId} onValueChange={setSeasonId}>
      <SelectTrigger
        aria-label="Mavsumni tanlash"
        className={cn(
          "h-9! min-w-0 gap-1 rounded-full px-3 text-sm md:h-9!",
          tone === "band" && "border-white/25 bg-white/5 text-band-foreground hover:bg-white/10 dark:bg-white/5 [&_svg]:text-band-muted!",
          className,
        )}
      >
        <SelectValue>
          {season && (
            <>
              <span className="sm:hidden">{season.year}</span>
              <span className="hidden sm:inline">
                {season.year}-yil, {season.name}
              </span>
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {seasons.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.year}-yil, {s.name}
            {s.status === "ACTIVE" ? " (joriy)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
