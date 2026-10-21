import type { LucideIcon } from "lucide-react"
import { RefreshCw, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLeagueMeta } from "@/hooks/use-document-meta"
import { notFoundMeta } from "@/lib/seo"
import { cn } from "@/lib/utils"

export function SectionHeader({
  title,
  action,
  id,
  className,
}: {
  title: string
  action?: { label: string; to: string }
  id?: string
  className?: string
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 id={id} className="section-title">
        {title}
      </h2>
      {action && (
        <Link
          to={action.to}
          className="shrink-0 rounded-sm py-1 text-sm font-semibold text-gold-text underline-offset-4 hover:underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  pageTitle = false,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** Butun sahifa o'rnida chiqsa — sarlavha h1 bo'ladi (ekran o'quvchilar va qidiruv tizimlari uchun) */
  pageTitle?: boolean
}) {
  const Title = pageTitle ? "h1" : "p"
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <Title className="font-semibold">{title}</Title>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Yozuv topilmadi (havola eskirgan yoki o'chirilgan): sahifa sarlavhasi va ro'yxatga qaytish havolasi bilan */
export function NotFoundState({ icon: Icon, title, description, backTo, backLabel }: { icon: LucideIcon; title: string; description: string; backTo: string; backLabel: string }) {
  useLeagueMeta(notFoundMeta)
  return (
    <div className="container-page flex min-h-[45dvh] flex-col items-center justify-center py-12 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
      <Button asChild variant="outline" className="mt-5">
        <Link to={backTo}>{backLabel}</Link>
      </Button>
    </div>
  )
}

export function ErrorState({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </span>
      <p className="font-semibold">Ma’lumotni yuklab bo‘lmadi</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message ?? "Internet aloqasini tekshirib, qayta urinib ko‘ring."}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Qayta yuklash
        </Button>
      )}
    </div>
  )
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-border", className)} aria-busy="true" aria-label="Yuklanmoqda">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-10" />
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="container-page py-6" aria-busy="true" aria-label="Sahifa yuklanmoqda">
      <Skeleton className="mb-4 h-7 w-48" />
      <Skeleton className="mb-6 h-40 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>}
      </div>
      {children}
    </div>
  )
}
