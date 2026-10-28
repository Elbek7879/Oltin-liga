import { ArrowRight, MessageSquarePlus } from "lucide-react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Bosh sahifada: yangi mavsumga jamoa arizasi va taklif-shikoyatlar bo'limiga yo'l */
export function ApplyCard({ className }: { className?: string }) {
  return (
    <section aria-labelledby="apply-card-title" className={cn("panel p-4 md:p-5", className)}>
      <h2 id="apply-card-title" className="flex items-center gap-2 font-display text-lg">
        <MessageSquarePlus className="size-5 shrink-0 text-gold-text" aria-hidden="true" />
        Murojaat va arizalar
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
        Jamoangiz yangi mavsumda o‘ynashini xohlaysizmi? Ariza yuboring. Taklif va shikoyatlaringizni ham shu yerdan yozing.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Button asChild variant="outline">
          <Link to="/murojaat?tur=jamoa">Jamoa arizasi</Link>
        </Button>
        <Link to="/murojaat?tur=taklif" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-gold-text underline-offset-4 hover:underline">
          Taklif yoki shikoyat
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
