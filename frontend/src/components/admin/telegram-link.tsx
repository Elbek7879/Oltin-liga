import { CircleCheck, ExternalLink, Send, Unlink } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "@/api/client"
import { useAdminMutation, useTelegramStatus } from "@/api/hooks"
import { ConfirmAction, runAction } from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * «Hisobim» sahifasidagi Telegram bot bo'limi: admin o'z Telegram akkauntini botga ulaydi.
 * Sayt bir martalik havola beradi; Telegram'da «Start» bosilgach ulanish o'zi tasdiqlanadi.
 */
export function TelegramLink() {
  const [pending, setPending] = useState<{ url: string; expiresAt: string } | null>(null)
  const { data: status, isLoading } = useTelegramStatus(Boolean(pending))
  const link = useAdminMutation(() => api.telegramLink())
  const unlink = useAdminMutation(() => api.telegramUnlink())

  // Admin Telegram'da «Start»ni bosdi — kutish tugaydi
  useEffect(() => {
    if (pending && status?.linked) {
      setPending(null)
      toast.success("Telegram ulandi. Endi bot orqali gollarni kiritishingiz mumkin.")
    }
  }, [pending, status?.linked])

  const start = async () => {
    const res = await runAction(() => link.mutateAsync(undefined), "Havola tayyor — Telegram ochilmoqda")
    if (res) {
      setPending(res)
      window.open(res.url, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <section className="panel mb-5 p-4 md:p-5" aria-labelledby="tg-title">
      <h2 id="tg-title" className="section-title flex items-center gap-2">
        <Send className="size-5 text-pitch-600 dark:text-gold-400" aria-hidden="true" />
        Telegram bot
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Jonli o‘yinda gol va kartochkalarni telefondan, Telegram orqali kiritish uchun. Kiritilgan har bir gol saytda darhol ko‘rinadi. Bot faqat ulangan adminlarga javob beradi.
      </p>

      {isLoading || !status ? (
        <Skeleton className="h-11 w-48" />
      ) : !status.botEnabled ? (
        <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">
          Bot hali sozlanmagan. Serverdagi sozlamalar fayliga (<code>backend/.env</code>) bot tokeni va nomi kiritilgach, shu yerda «Telegram'ni ulash» tugmasi paydo bo‘ladi.
        </p>
      ) : !status.allowed ? (
        <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">Bot natija kirituvchilar va administratorlar uchun. Sizning rolingiz uchun kerak emas.</p>
      ) : status.linked ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="flex flex-1 items-center gap-2 text-sm">
            <CircleCheck className="size-5 shrink-0 text-win" aria-hidden="true" />
            <span>
              <span className="font-semibold">Ulangan</span>
              {status.telegramUsername && <span className="text-muted-foreground"> — @{status.telegramUsername}</span>}
            </span>
          </p>
          <Button asChild variant="outline">
            <a href={`https://t.me/${status.botUsername}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Botni ochish
            </a>
          </Button>
          <ConfirmAction
            destructive
            trigger={
              <Button variant="ghost" className="text-destructive hover:text-destructive">
                <Unlink aria-hidden="true" />
                Uzish
              </Button>
            }
            title="Telegram uzilsinmi?"
            description="Bot bu Telegram akkauntiga boshqa javob bermaydi. Keyin istalgan payt qayta ulashingiz mumkin."
            confirmLabel="Ha, uzish"
            onConfirm={() => runAction(() => unlink.mutateAsync(undefined), "Telegram uzildi")}
          />
        </div>
      ) : pending ? (
        <div className="rounded-xl border border-gold/50 bg-gold-soft p-4 text-sm">
          <p className="font-semibold">Telegram ochildi — u yerda «Start» (Boshlash) tugmasini bosing.</p>
          <p className="mt-1 text-muted-foreground">Ulanish shu sahifada o‘zi tasdiqlanadi. Havola 10 daqiqa amal qiladi va faqat bir marta ishlaydi.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild>
              <a href={pending.url} target="_blank" rel="noopener noreferrer">
                <Send aria-hidden="true" />
                Telegram’da ochish
              </a>
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Bekor qilish
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={start} disabled={link.isPending}>
          <Send aria-hidden="true" />
          {link.isPending ? "Tayyorlanmoqda…" : "Telegram’ni ulash"}
        </Button>
      )}
    </section>
  )
}
