import { CalendarRange, Crown, FlaskConical, Flag, LoaderCircle, Play, Plus, Trash, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useSearchParams } from "react-router"
import { toast } from "sonner"
import { api } from "@/api/client"
import { useAdminMutation, useFinishPreview, useMe, useSeasonDeletePreview } from "@/api/hooks"
import { defaultSeasonRules } from "@/api/defaults"
import { AdminPageHeader, Field, runAction } from "@/components/admin/admin-ui"
import { EmptyState } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Season } from "@/domain/types"
import { useSeason } from "@/hooks/use-season"
import { formatDate, SEASON_STATUS_LABEL } from "@/lib/format"
import { isSuperAdmin } from "@/lib/roles"
import { cn } from "@/lib/utils"

const NONE = "__none__"

function NewSeasonDialog({ open, onOpenChange, seasons }: { open: boolean; onOpenChange: (v: boolean) => void; seasons: Season[] }) {
  // Sinov mavsumlari raqam va jamoalar taklifida hisobga olinmaydi
  const real = seasons.filter((x) => !x.test)
  const last = real[0]
  const nextYear = (last?.year ?? new Date().getFullYear()) + 1
  const defaultName = `${Math.max(0, ...real.map((x) => x.number)) + 1}-mavsum`
  const [name, setName] = useState(defaultName)
  const [test, setTest] = useState(false)
  const [year, setYear] = useState(String(nextYear))
  const [start, setStart] = useState(`${nextYear}-05-01`)
  const [end, setEnd] = useState(`${nextYear}-07-31`)
  const [legs, setLegs] = useState("1")
  const [copyFrom, setCopyFrom] = useState(last?.id ?? NONE)
  const [formError, setFormError] = useState<string | null>(null)
  const { setSeasonId } = useSeason()
  const mutation = useAdminMutation(() =>
    api.createSeason({
      name,
      year: Number(year),
      startDate: start,
      endDate: end,
      rules: { ...defaultSeasonRules(), legs: legs === "2" ? 2 : 1 },
      copyTeamsFromSeasonId: copyFrom === NONE ? null : copyFrom,
      test,
    }),
  )
  const toggleTest = (on: boolean) => {
    setTest(on)
    if (on && name === defaultName) setName("Sinov mavsumi")
    if (!on && name === "Sinov mavsumi") setName(defaultName)
    if (on) setCopyFrom(NONE)
  }
  const submit = async () => {
    setFormError(null)
    if (!/^\d{4}$/.test(year)) return setFormError("Yilni 4 ta raqam bilan kiriting.")
    if (end < start) return setFormError("Tugash sanasi boshlanish sanasidan keyin bo‘lsin.")
    const s = await runAction(() => mutation.mutateAsync(undefined), test ? `«${name}» sinov mavsumi yaratildi` : `«${name}» yaratildi`)
    if (s) {
      setSeasonId(s.id)
      onOpenChange(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Yangi mavsum</DialogTitle>
          <DialogDescription>Yangi mavsum alohida saqlanadi — oldingi mavsumlar natijalari o‘zgarmaydi.</DialogDescription>
        </DialogHeader>
        <label
          htmlFor="ns-test"
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-150",
            test ? "border-dashed border-gold bg-gold-soft" : "border-border hover:bg-muted/60",
          )}
        >
          <Checkbox id="ns-test" checked={test} onCheckedChange={(v) => toggleTest(v === true)} className="mt-0.5" aria-describedby="ns-test-hint" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <FlaskConical className="size-4 text-gold-text" aria-hidden="true" />
              Sinov mavsumi
            </span>
            <span id="ns-test-hint" className="mt-0.5 block text-xs text-muted-foreground">
              Tizimni sinab ko‘rish uchun: jamoa qo‘shing, qur’a tashlang, natija kiriting. Saytda muxlislarga ko‘rinmaydi; sinab bo‘lgach butunlay o‘chiriladi.
            </span>
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomi" htmlFor="ns-name" required>
            <Input id="ns-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Yili" htmlFor="ns-year" required>
            <Input id="ns-year" inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
          <Field label="Boshlanish sanasi" htmlFor="ns-start">
            <Input id="ns-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Tugash sanasi" htmlFor="ns-end">
            <Input id="ns-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Guruh bosqichi formati" htmlFor="ns-legs">
            <Select value={legs} onValueChange={setLegs}>
              <SelectTrigger id="ns-legs" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Bir davrali</SelectItem>
                <SelectItem value="2">Ikki davrali (har juftlik 2 marta o‘ynaydi)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Jamoalarni ko‘chirish" htmlFor="ns-copy" hint="Jamoalar va tarkiblar nusxalanadi">
            <Select value={copyFrom} onValueChange={setCopyFrom}>
              <SelectTrigger id="ns-copy" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Bo‘sh boshlash</SelectItem>
                {seasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.year}-yil, {s.name}{s.test ? " (sinov)" : ""} jamoalari</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button onClick={submit} disabled={mutation.isPending}>{mutation.isPending ? "Yaratilmoqda…" : "Mavsumni yaratish"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FinishDialog({ season, open, onOpenChange }: { season: Season; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data, isLoading } = useFinishPreview(season.id, open)
  const mutation = useAdminMutation(() => api.finishSeason(season.id))
  const rows = data
    ? [
        { label: "Chempion", team: data.champion, icon: Crown },
        { label: "2-o‘rin", team: data.runnerUp },
        { label: "3-o‘rin", team: data.third },
        { label: "Fair Play", team: data.fairPlay },
      ]
    : []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{season.name}ni yakunlash</DialogTitle>
          <DialogDescription>Yakunlangan mavsum arxivga o‘tadi va tahrirlashdan qulflanadi. Sovrindorlar tarixga yoziladi.</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Tekshirilmoqda…</p>
        ) : (
          <div className="space-y-3">
            {data.problems.length > 0 && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="mb-1 flex items-center gap-2 font-semibold text-destructive">
                  <TriangleAlert className="size-4" aria-hidden="true" />
                  Hozircha yakunlab bo‘lmaydi
                </p>
                <ul className="list-disc pl-5">
                  {data.problems.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            )}
            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.map((r) => (
                <li key={r.label} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="w-20 text-muted-foreground">{r.label}</span>
                  {r.team ? (
                    <span className="flex items-center gap-2 font-semibold">
                      <TeamCrest team={r.team} size="xs" />
                      {r.team.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Aniqlanmagan</span>
                  )}
                </li>
              ))}
              <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="w-20 text-muted-foreground">To‘purar</span>
                <span className="font-semibold">
                  {data.topScorer ? `${data.topScorer.player.firstName} ${data.topScorer.player.lastName} (${data.topScorer.goals} gol)` : "—"}
                </span>
              </li>
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button
            disabled={!data?.canFinish || mutation.isPending}
            onClick={async () => {
              const ok = await runAction(() => mutation.mutateAsync(undefined), `${season.name} yakunlandi va arxivga o‘tkazildi`)
              if (ok) onOpenChange(false)
            }}
          >
            <Flag aria-hidden="true" />
            Mavsumni yakunlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Mavsumni butunlay o'chirish: nima o'chishini ko'rsatadi, mavsum nomini qayta yozib tasdiqlanadi */
function DeleteSeasonDialog({ season, seasons, open, onOpenChange }: { season: Season; seasons: Season[]; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { seasonId, setSeasonId } = useSeason()
  const [typed, setTyped] = useState("")
  const mutation = useAdminMutation((confirmName: string) => api.deleteSeason(season.id, confirmName))
  // O'chirish boshlangach oldindan ko'rish qayta so'ralmaydi (mavsum endi yo'q)
  const { data, isLoading, error } = useSeasonDeletePreview(season.id, open && mutation.isIdle)
  const nameOk = typed.trim().toLowerCase() === season.name.trim().toLowerCase()
  const kept = (all: number, removed: number) => (all > removed ? `, ${all - removed} tasi boshqa mavsumda ham qatnashgani uchun saqlanadi` : "")

  const confirm = async () => {
    // O'chiriladigan mavsum tanlangan bo'lsa, panel oldindan boshqa mavsumga o'tadi
    const wasSelected = seasonId === season.id
    const fallback = seasons.find((x) => x.id !== season.id && x.status === "ACTIVE") ?? seasons.find((x) => x.id !== season.id)
    if (wasSelected && fallback) setSeasonId(fallback.id)
    try {
      const r = await mutation.mutateAsync(typed)
      toast.success(`«${r.name}» o‘chirildi: ${r.teams} ta jamoa, ${r.players} ta futbolchi, ${r.matches} ta o‘yin`)
      onOpenChange(false)
    } catch (err) {
      if (wasSelected) setSeasonId(season.id)
      toast.error(err instanceof Error ? err.message : "Mavsumni o‘chirib bo‘lmadi. Qayta urinib ko‘ring.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />
            «{season.name}»ni butunlay o‘chirish
          </DialogTitle>
          <DialogDescription>
            {season.test ? "Sinov mavsumi va unda kiritilgan hamma narsa o‘chadi." : "Xato ochilgan mavsumni o‘chirish mumkin."} Bu amalni qaytarib bo‘lmaydi.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Tekshirilmoqda…</p>
        ) : error || !data ? (
          <p role="alert" className="text-sm text-destructive">{error?.message ?? "Ma’lumotni yuklab bo‘lmadi."}</p>
        ) : data.problem ? (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">{data.problem}</p>
        ) : (
          <>
            <ul className="space-y-1.5 rounded-lg border border-border p-3 text-sm">
              <li>
                <strong>{data.matches} ta o‘yin</strong>
                {data.results > 0 && `, ${data.results} tasida natija`}
              </li>
              <li>
                <strong>{data.teamsRemoved} ta jamoa</strong> butunlay o‘chadi{kept(data.teams, data.teamsRemoved)}
              </li>
              <li>
                <strong>{data.playersRemoved} ta futbolchi</strong> butunlay o‘chadi{kept(data.players, data.playersRemoved)}
              </li>
              <li className="text-muted-foreground">Guruhlar, jadval, ramziy jamoalar, rasmlar va bu mavsum haqidagi tarix yozuvlari ham o‘chadi.</li>
            </ul>
            <Field label={`Tasdiqlash uchun mavsum nomini yozing: «${season.name}»`} htmlFor="ds-name">
              <Input id="ds-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={season.name} />
            </Field>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={!data?.canDelete || !nameOk || mutation.isPending}
            onClick={confirm}
          >
            {mutation.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Trash aria-hidden="true" />}
            {mutation.isPending ? "O‘chirilmoqda…" : "Butunlay o‘chirish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminSeasonsPage() {
  const { seasons, seasonId, setSeasonId, isLoading } = useSeason()
  const [params] = useSearchParams()
  const [newOpen, setNewOpen] = useState(params.get("yangi") === "1")
  const [finishing, setFinishing] = useState<Season | null>(null)
  const [deleting, setDeleting] = useState<Season | null>(null)
  const { data: me } = useMe()
  const activate = useAdminMutation((id: string) => api.activateSeason(id))

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Mavsumlar"
        description="Har bir mavsum ma’lumotlari alohida saqlanadi. Yakunlangan mavsumlar o‘chirilmaydi — ular arxiv sifatida saytda ko‘rinadi. Sinov mavsumi saytda ko‘rinmaydi va sinab bo‘lgach butunlay o‘chiriladi."
        actions={
          <Button onClick={() => setNewOpen(true)} disabled={isLoading}>
            <Plus aria-hidden="true" />
            Yangi mavsum
          </Button>
        }
      />
      {seasons.length === 0 && (
        <div className="panel">
          <EmptyState
            icon={CalendarRange}
            title="Hali mavsum yo‘q"
            description="«Yangi mavsum» tugmasini bosing: nomi, yili va sanalarini kiriting. Keyin uni «Boshlash» tugmasi bilan faollashtirasiz."
          />
        </div>
      )}
      <ul className="space-y-3">
        {seasons.map((s) => (
          <li
            key={s.id}
            className={cn("panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center", s.test && "border-dashed border-gold", s.id === seasonId && !s.test && "border-pitch-300")}
          >
            <CalendarRange className="hidden size-6 text-muted-foreground sm:block" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl">
                {s.year}-yil, {s.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(s.startDate)} — {formatDate(s.endDate)}, {s.rules.legs === 2 ? "ikki davrali" : "bir davrali"}
              </p>
              {s.test && <p className="mt-1 text-xs text-gold-text">Saytda ko‘rinmaydi. Sinab bo‘lgach, o‘chirib tashlang.</p>}
            </div>
            {s.test && (
              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-dashed border-gold px-2.5 py-0.5 text-xs font-semibold text-gold-text">
                <FlaskConical className="size-3.5" aria-hidden="true" />
                Sinov
              </span>
            )}
            <span
              className={cn(
                "w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold",
                s.status === "ACTIVE" ? "bg-qualify-soft text-win" : s.status === "DRAFT" ? "bg-gold-soft text-gold-text" : "bg-muted text-muted-foreground",
              )}
            >
              {SEASON_STATUS_LABEL[s.status]}
            </span>
            <div className="flex flex-wrap gap-2">
              {s.id !== seasonId && (
                <Button size="sm" variant="outline" onClick={() => setSeasonId(s.id)}>
                  Tanlash
                </Button>
              )}
              {s.status === "DRAFT" && (
                <Button size="sm" onClick={() => runAction(() => activate.mutateAsync(s.id), `«${s.name}» boshlandi`)}>
                  <Play aria-hidden="true" />
                  Boshlash
                </Button>
              )}
              {s.status === "ACTIVE" && isSuperAdmin(me?.role) && (
                <Button size="sm" variant="outline" onClick={() => setFinishing(s)}>
                  <Flag aria-hidden="true" />
                  Yakunlash
                </Button>
              )}
              {isSuperAdmin(me?.role) && (s.test || s.status === "DRAFT") && (
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(s)} aria-label={`«${s.name}»ni o‘chirish`}>
                  <Trash aria-hidden="true" />
                  O‘chirish
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {/* Oyna ro'yxat yuklangach ochiladi — nom, yil va jamoalar taklifi to'g'ri bo'lsin */}
      {newOpen && !isLoading && <NewSeasonDialog open={newOpen} onOpenChange={setNewOpen} seasons={seasons} />}
      {finishing && <FinishDialog season={finishing} open={Boolean(finishing)} onOpenChange={(v) => !v && setFinishing(null)} />}
      {deleting && <DeleteSeasonDialog key={deleting.id} season={deleting} seasons={seasons} open={Boolean(deleting)} onOpenChange={(v) => !v && setDeleting(null)} />}
    </div>
  )
}
