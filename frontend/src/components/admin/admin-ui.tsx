import { Lock, TriangleAlert } from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { useSeason } from "@/hooks/use-season"
import { isSessionExpired } from "@/lib/session-expired"
import { cn } from "@/lib/utils"

/** Amalni bajaradi va natija haqida tushunarli xabar chiqaradi */
export async function runAction<T>(fn: () => Promise<T>, success: string | ((result: T) => string)): Promise<T | undefined> {
  try {
    const result = await fn()
    toast.success(typeof success === "function" ? success(result) : success)
    return result
  } catch (err) {
    // Sessiya tugagan bo'lsa, buni qayta kirish oynasi aytadi — alohida xato xabari chiqmaydi
    if (!isSessionExpired()) toast.error(err instanceof Error ? err.message : "Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring.")
    return undefined
  }
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Yakunlangan mavsumni tahrirlash mumkin emasligini bildiradi */
export function useReadOnly() {
  const { season } = useSeason()
  return season?.status === "FINISHED"
}

export function ReadOnlyBanner() {
  const readOnly = useReadOnly()
  const { season } = useSeason()
  if (!readOnly) return null
  return (
    <p className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm">
      <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>
        <strong>{season?.year}-yil mavsumi yakunlangan</strong> va arxivga qulflangan. Ma’lumotlarni faqat ko‘rish mumkin. Tahrirlash uchun yuqoridan joriy mavsumni tanlang.
      </span>
    </p>
  )
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
        {required && <span className="text-destructive" aria-hidden="true"> *</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** O'chirish kabi qaytarib bo'lmaydigan amallar uchun tasdiqlash oynasi */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = true,
  onConfirm,
}: {
  trigger: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => Promise<unknown> | void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {destructive && <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Bekor qilish</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90")}
            onClick={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                await onConfirm()
                setOpen(false)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? "Bajarilmoqda…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Telefonda ekran pastiga yopishgan amal tugmalari paneli */
export function StickyActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-16 z-20 -mx-4 mt-6 flex gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none lg:bottom-0",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function StatTile({ label, value, hint, className }: { label: string; value: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cn("panel p-3 md:p-4", className)}>
      <p className="text-xs text-muted-foreground md:text-sm">{label}</p>
      <p className="mt-1 font-score text-2xl md:text-3xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
