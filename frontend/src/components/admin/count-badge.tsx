import { cn } from "@/lib/utils"

/**
 * Yangi (ko'rilmagan) elementlar soni — Telegram'dagi o'qilmagan xabarlar belgisi kabi kichik doiracha.
 * Ekran o'quvchisi uchun «Arizalar (3 ta yangi)» deb o'qiladi; nol bo'lsa ko'rsatilmaydi.
 */
export function CountBadge({ count, className }: { count: number | undefined; className?: string }) {
  if (!count) return null
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gold-400 px-1.5 text-2xs leading-none font-bold text-band tabular-nums",
          className,
        )}
      >
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only"> ({count} ta yangi)</span>
    </>
  )
}
