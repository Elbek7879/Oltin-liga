import { CalendarPlus, Check, CheckCheck, ExternalLink, Info, Inbox, Lightbulb, MessageCircle, Phone, RotateCcw, Trash, TriangleAlert, UserPlus, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { api } from "@/api/client"
import { useAdminMutation, useApplicationCounts, useFeedback, useTeamApplications } from "@/api/hooks"
import type { FeedbackKind, FeedbackMessage, TeamApplication } from "@/api/types"
import { AdminPageHeader, ConfirmAction, runAction } from "@/components/admin/admin-ui"
import { CountBadge } from "@/components/admin/count-badge"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/league/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSeason } from "@/hooks/use-season"
import { APPLICATION_STATUS_LABEL, FEEDBACK_KIND_LABEL, upcomingSeason } from "@/lib/applications"
import { formatDateTime, POSITION_LABEL } from "@/lib/format"
import { cn } from "@/lib/utils"

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a href={telHref(phone)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline">
      <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
      {phone}
    </a>
  )
}

// ---------- Jamoa arizalari ----------

const STATUS_STYLE: Record<TeamApplication["status"], string> = {
  NEW: "bg-gold-soft text-gold-text",
  ACCEPTED: "bg-win/15 text-win",
  IGNORED: "bg-muted text-muted-foreground",
}

/** Mavsum tanlanmaydi: jamoa o'zi yangi (tayyorlanayotgan) mavsumga qo'shiladi, boshlangan mavsumga qo'shilmaydi */
function AcceptDialog({ app }: { app: TeamApplication }) {
  const { seasons } = useSeason()
  const target = upcomingSeason(seasons)
  const [open, setOpen] = useState(false)
  const accept = useAdminMutation(() => api.acceptTeamApplication(app.id))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden="true" />
          Qabul qilish
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl [overflow-wrap:anywhere]">«{app.teamName}» arizasini qabul qilish</DialogTitle>
          <DialogDescription>
            {app.existingTeam
              ? "Bu nomli jamoa ro‘yxatda bor: yangi jamoa ochilmaydi, o‘sha jamoa yangi mavsumga qo‘shiladi va arizadagi logotipni oladi. Oldingi mavsumlarda o‘ynagan futbolchilar tanib olinadi."
              : "Jamoa «Jamoalar» bo‘limiga qo‘shiladi va yangi mavsum ishtirokchisi bo‘ladi."}{" "}
            Arizadagi {app.players.length} ta futbolchi jamoa tarkibiga yoziladi.
          </DialogDescription>
        </DialogHeader>
        {target ? (
          <p className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
            <CalendarPlus className="mt-0.5 size-4 shrink-0 text-primary dark:text-gold-400" aria-hidden="true" />
            <span>
              Jamoa qo‘shiladigan mavsum: <strong>{target.name} ({target.year})</strong>. Boshlangan mavsumga (qur’a tashlangan yoki o‘yinlar o‘tkazilgan) jamoa
              qo‘shilmaydi.
            </span>
          </p>
        ) : (
          <p className="rounded-lg bg-muted p-3 text-sm">
            Yangi mavsum hali ochilmagan — ariza yangi mavsumga qabul qilinadi. Avval{" "}
            <Link to="/admin/mavsumlar?yangi=1" className="font-semibold underline underline-offset-4">
              Mavsumlar
            </Link>{" "}
            bo‘limida yangi mavsum oching.
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={accept.isPending}>
            Bekor qilish
          </Button>
          <Button
            disabled={!target || accept.isPending}
            onClick={async () => {
              const result = await runAction(
                () => accept.mutateAsync(undefined),
                (r) =>
                  `«${r.teamName}» ${r.seasonName}ga qo‘shildi: ${r.players} ta futbolchi tarkibga yozildi` +
                  (r.returning ? `, ${r.returning} tasi oldingi mavsumlardan tanildi.` : "."),
              )
              if (result) setOpen(false)
            }}
          >
            {accept.isPending ? "Qabul qilinmoqda…" : "Qabul qilish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApplicationCard({ app }: { app: TeamApplication }) {
  const ignore = useAdminMutation(() => api.ignoreTeamApplication(app.id))
  const restore = useAdminMutation(() => api.restoreTeamApplication(app.id))
  const remove = useAdminMutation(() => api.deleteTeamApplication(app.id))
  const titleId = `application-${app.id}`

  return (
    <article aria-labelledby={titleId} className={cn("panel overflow-hidden", app.status === "NEW" && "border-l-4 border-l-gold-400")}>
      <div className="flex items-start gap-3 p-4">
        <img src={app.logoUrl} alt={`«${app.teamName}» logotipi`} width={56} height={56} loading="lazy" className="size-14 shrink-0 rounded-lg border border-border bg-white object-contain" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id={titleId} className="font-display text-lg [overflow-wrap:anywhere]">
              {app.teamName}
            </h3>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[app.status])}>{APPLICATION_STATUS_LABEL[app.status]}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Yuborilgan: {formatDateTime(app.createdAt)}
            {app.village ? `, ${app.village}` : ""}
          </p>
          {app.contactPhone && <PhoneLink phone={app.contactPhone} />}
        </div>
      </div>

      {app.existingTeam && app.status !== "ACCEPTED" && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          Bu nomli jamoa ro‘yxatda bor — qabul qilinsa, yangi jamoa ochilmaydi: o‘sha jamoa yangi mavsumga qo‘shiladi va tarixi saqlanadi.
        </p>
      )}
      {app.status === "ACCEPTED" && (
        <p className="mx-4 mb-3 flex flex-wrap items-center gap-x-2 rounded-lg bg-win/10 px-3 py-2 text-sm">
          <Check className="size-4 shrink-0 text-win" aria-hidden="true" />
          {app.seasonName ? `${app.seasonName}ga qo‘shilgan` : "Qabul qilingan"}
          {app.decidedAt ? `, ${formatDateTime(app.decidedAt)}` : ""}
          {app.decidedBy ? ` (${app.decidedBy})` : ""}.
          <Link to="/admin/jamoalar" className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-4">
            Jamoalar bo‘limida ko‘rish
          </Link>
        </p>
      )}
      {app.status === "IGNORED" && (
        <p className="mx-4 mb-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          E’tiborsiz qoldirilgan{app.decidedAt ? `: ${formatDateTime(app.decidedAt)}` : ""}
          {app.decidedBy ? ` (${app.decidedBy})` : ""}.
        </p>
      )}

      <details className="group border-t border-border" open={app.status === "NEW"}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-sm font-semibold hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
          Futbolchilar ({app.players.length})
          <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Ko‘rsatish</span>
          <span className="ml-auto hidden text-xs font-normal text-muted-foreground group-open:inline">Yashirish</span>
        </summary>
        <ol className="divide-y divide-border border-t border-border">
          {app.players.map((p, i) => (
            <li key={i} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-2 px-4 py-2 text-sm">
              <span className="font-score text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="font-medium [overflow-wrap:anywhere]">
                {p.firstName} {p.lastName}
                {p.birthYear ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{p.birthYear}</span> : null}
              </span>
              <span className={cn("text-xs text-muted-foreground", p.position === "GK" && "font-semibold text-foreground")}>{POSITION_LABEL[p.position]}</span>
            </li>
          ))}
        </ol>
      </details>

      <div className="flex flex-wrap gap-2 border-t border-border p-3">
        {app.status !== "ACCEPTED" && <AcceptDialog app={app} />}
        {app.status === "NEW" && (
          <Button variant="outline" disabled={ignore.isPending} onClick={() => runAction(() => ignore.mutateAsync(undefined), `«${app.teamName}» arizasi e’tiborsiz qoldirildi`)}>
            E’tiborsiz qoldirish
          </Button>
        )}
        {app.status === "IGNORED" && (
          <Button variant="outline" disabled={restore.isPending} onClick={() => runAction(() => restore.mutateAsync(undefined), "Ariza yana «Yangi» ro‘yxatiga qaytarildi")}>
            <RotateCcw aria-hidden="true" />
            Qayta ko‘rib chiqish
          </Button>
        )}
        {app.status !== "NEW" && (
          <ConfirmAction
            trigger={
              <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive">
                <Trash aria-hidden="true" />
                O‘chirish
              </Button>
            }
            title="Arizani o‘chirasizmi?"
            description={
              app.status === "ACCEPTED"
                ? `«${app.teamName}» arizasi ro‘yxatdan o‘chiriladi. Jamoa va futbolchilar o‘z joyida qoladi.`
                : `«${app.teamName}» arizasi va uning logotipi butunlay o‘chiriladi.`
            }
            confirmLabel="Ha, o‘chirish"
            onConfirm={() => runAction(() => remove.mutateAsync(undefined), "Ariza o‘chirildi")}
          />
        )}
      </div>
    </article>
  )
}

function TeamApplications() {
  const { data, isLoading, error, refetch } = useTeamApplications()
  const [view, setView] = useState<"new" | "done">("new")
  if (isLoading) return <ListSkeleton rows={3} className="panel" />
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} className="panel" />

  const fresh = data.filter((a) => a.status === "NEW")
  const decided = data.filter((a) => a.status !== "NEW")
  const list = view === "new" ? fresh : decided
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Arizalarni saralash" className="inline-flex rounded-lg border border-border bg-card p-0.5">
        {(
          [
            ["new", `Yangi (${fresh.length})`],
            ["done", `Ko‘rib chiqilgan (${decided.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 md:min-h-9",
              view === value && "bg-secondary text-primary dark:text-gold-400",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={Inbox}
            title={view === "new" ? "Yangi ariza yo‘q" : "Ko‘rib chiqilgan ariza yo‘q"}
            description={
              view === "new" ? "Jamoalar saytdagi «Murojaat» bo‘limidan yuborgan yangi mavsum arizalari shu yerda ko‘rinadi." : "Qabul qilingan va e’tiborsiz qoldirilgan arizalar shu yerda saqlanadi."
            }
            action={
              view === "new" ? (
                <Button asChild variant="outline">
                  <Link to="/murojaat?tur=jamoa" target="_blank">
                    <ExternalLink aria-hidden="true" />
                    Ariza formasini ko‘rish
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        list.map((a) => <ApplicationCard key={a.id} app={a} />)
      )}
    </div>
  )
}

// ---------- Taklif va shikoyatlar ----------

const KIND_ICON: Record<FeedbackKind, LucideIcon> = { SUGGESTION: Lightbulb, COMPLAINT: TriangleAlert, REQUEST: MessageCircle }

function MessageCard({ message }: { message: FeedbackMessage }) {
  const read = useAdminMutation(() => api.markFeedbackRead(message.id))
  const remove = useAdminMutation(() => api.deleteFeedback(message.id))
  const Icon = KIND_ICON[message.kind]
  const unread = message.status === "NEW"
  return (
    <article className={cn("panel p-4", unread && "border-l-4 border-l-gold-400")} aria-label={`${FEEDBACK_KIND_LABEL[message.kind]}, ${formatDateTime(message.createdAt)}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 font-semibold text-primary dark:text-gold-400">
          <Icon className="size-3.5" aria-hidden="true" />
          {FEEDBACK_KIND_LABEL[message.kind]}
        </span>
        {unread && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold-text">Yangi</span>}
        <time dateTime={message.createdAt} className="text-xs text-muted-foreground">
          {formatDateTime(message.createdAt)}
        </time>
      </div>
      <p className="mt-2 text-base leading-7 whitespace-pre-line [overflow-wrap:anywhere]">{message.body}</p>
      {(message.authorName || message.phone) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
          {message.authorName && <span className="[overflow-wrap:anywhere]">{message.authorName}</span>}
          {message.phone && <PhoneLink phone={message.phone} />}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {unread && (
          <Button variant="outline" size="sm" disabled={read.isPending} onClick={() => runAction(() => read.mutateAsync(undefined), "O‘qilgan deb belgilandi")}>
            <Check aria-hidden="true" />
            O‘qildi
          </Button>
        )}
        <ConfirmAction
          trigger={
            <Button variant="ghost" size="sm" className="ml-auto text-destructive hover:text-destructive">
              <Trash aria-hidden="true" />
              O‘chirish
            </Button>
          }
          title="Murojaatni o‘chirasizmi?"
          description="Murojaat matni butunlay o‘chiriladi."
          confirmLabel="Ha, o‘chirish"
          onConfirm={() => runAction(() => remove.mutateAsync(undefined), "Murojaat o‘chirildi")}
        />
      </div>
    </article>
  )
}

function Messages() {
  const { data, isLoading, error, refetch } = useFeedback()
  const markAll = useAdminMutation(() => api.markAllFeedbackRead())
  if (isLoading) return <ListSkeleton rows={3} className="panel" />
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} className="panel" />
  const unread = data.filter((m) => m.status === "NEW").length
  if (data.length === 0) {
    return (
      <div className="panel">
        <EmptyState icon={Inbox} title="Hozircha murojaat yo‘q" description="Muxlislar saytdagi «Murojaat» bo‘limidan yuborgan taklif, shikoyat va murojaatlar shu yerda ko‘rinadi." />
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{unread > 0 ? `${unread} ta o‘qilmagan` : "Hammasi o‘qilgan"}</p>
        {unread > 0 && (
          <Button variant="outline" size="sm" disabled={markAll.isPending} onClick={() => runAction(() => markAll.mutateAsync(undefined), "Hammasi o‘qilgan deb belgilandi")}>
            <CheckCheck aria-hidden="true" />
            Hammasini o‘qildi deb belgilash
          </Button>
        )}
      </div>
      {data.map((m) => (
        <MessageCard key={m.id} message={m} />
      ))}
    </div>
  )
}

/** Saytdan kelgan arizalar: yangi mavsumga qo'shilish arizalari hamda taklif va shikoyatlar (alohida tablarda) */
export default function AdminApplicationsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get("tur") === "murojaat" ? "messages" : "teams"
  const { data: counts } = useApplicationCounts(true)
  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Arizalar" description="Saytdagi «Murojaat» bo‘limidan kelgan yangi mavsum arizalari hamda taklif va shikoyatlar." />
      <Tabs value={tab} onValueChange={(v) => setParams(v === "messages" ? { tur: "murojaat" } : {}, { replace: true })}>
        <TabsList className="mb-1 w-full sm:w-auto">
          <TabsTrigger value="teams">
            Jamoa arizalari
            <CountBadge count={counts?.teams} />
          </TabsTrigger>
          <TabsTrigger value="messages">
            Taklif va shikoyatlar
            <CountBadge count={counts?.messages} />
          </TabsTrigger>
        </TabsList>
        <TabsContent value="teams" className="text-base">
          <TeamApplications />
        </TabsContent>
        <TabsContent value="messages" className="text-base">
          <Messages />
        </TabsContent>
      </Tabs>
    </div>
  )
}
