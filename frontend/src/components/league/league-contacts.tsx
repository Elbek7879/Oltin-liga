import { Phone, Send } from "lucide-react"
import type { LeagueSettings } from "@/domain/types"
import { cn } from "@/lib/utils"

/** Tashkilotchilar bilan aloqa: telefon (bosilsa qo'ng'iroq) va Telegram (bosilsa ochiladi) */
export function LeagueContacts({ settings, className }: { settings: Pick<LeagueSettings, "contactPhone" | "telegram">; className?: string }) {
  if (!settings.contactPhone && !settings.telegram) return null
  return (
    <ul className={cn("space-y-1 text-sm md:text-base", className)}>
      {settings.contactPhone && (
        <li>
          <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center gap-2 font-semibold hover:underline">
            <Phone className="size-4 shrink-0" aria-hidden="true" />
            <span data-translit="off">{settings.contactPhone}</span>
          </a>
        </li>
      )}
      {settings.telegram && (
        <li>
          <a
            href={`https://t.me/${settings.telegram.replace(/^@/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 font-semibold hover:underline"
          >
            <Send className="size-4 shrink-0" aria-hidden="true" />
            {/* Telegram nomi o'girilmaydi — kirill rejimida ham havola to'g'ri */}
            <span data-translit="off">{settings.telegram.startsWith("@") ? settings.telegram : `@${settings.telegram}`}</span>
          </a>
        </li>
      )}
    </ul>
  )
}
