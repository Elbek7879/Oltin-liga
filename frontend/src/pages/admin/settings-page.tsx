import { ArrowDown, ArrowUp, Database, MapPin, Pencil, Plus, RotateCcw, Save, ScrollText, Trash } from "lucide-react"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"
import { api, IS_DEMO_MODE } from "@/api/client"
import { useAdminMutation, useAudit, useMe, useSettings, useVenues } from "@/api/hooks"
import { AdminPageHeader, ConfirmAction, Field, ReadOnlyBanner, runAction, useReadOnly } from "@/components/admin/admin-ui"
import { UsersManager } from "@/components/admin/users-manager"
import { EmptyState, ListSkeleton } from "@/components/league/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { qualifiersFor } from "@/domain/playoff"
import { TIEBREAKER_LABELS } from "@/domain/standings"
import type { LeagueSettings, SeasonRules, Tiebreaker, Venue } from "@/domain/types"
import { useSeason } from "@/hooks/use-season"
import { useSeasonData } from "@/hooks/use-season-data"
import { formatDateTime } from "@/lib/format"
import { isSuperAdmin } from "@/lib/roles"
import { DEFAULT_HALF_MINUTES } from "@/domain/schedule"

/** superOnly — faqat bosh tashkilotchiga (server ham shunday tekshiradi) */
const TABS = [
  { value: "nizom", label: "Liga nizomi" },
  { value: "ochko", label: "Ochko o‘zgarishlari" },
  { value: "liga", label: "Liga ma’lumotlari", superOnly: true },
  { value: "maydonlar", label: "Maydonlar" },
  { value: "foydalanuvchilar", label: "Foydalanuvchilar", superOnly: true },
  { value: "tarix", label: "O‘zgarishlar tarixi" },
]

const ALL_TIEBREAKERS = Object.keys(TIEBREAKER_LABELS) as Tiebreaker[]

function RulesTab() {
  const { season } = useSeason()
  const readOnly = useReadOnly()
  const [rules, setRules] = useState<SeasonRules | null>(season?.rules ?? null)
  const mutation = useAdminMutation((r: SeasonRules) => api.updateSeasonRules(season!.id, r))
  useEffect(() => setRules(season?.rules ?? null), [season])
  if (!rules || !season) return null

  const move = (i: number, dir: -1 | 1) => {
    const list = [...rules.tiebreakers]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    setRules({ ...rules, tiebreakers: list })
  }
  const unused = ALL_TIEBREAKERS.filter((t) => !rules.tiebreakers.includes(t))
  const num = (key: "pointsWin" | "pointsDraw" | "pointsLoss") => (
    <Field label={{ pointsWin: "G‘alaba", pointsDraw: "Durang", pointsLoss: "Mag‘lubiyat" }[key]} htmlFor={key}>
      <Input
        id={key}
        inputMode="numeric"
        value={rules[key]}
        onChange={(e) => setRules({ ...rules, [key]: Number(e.target.value.replace(/\D/g, "").slice(0, 1) || 0) })}
      />
    </Field>
  )

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <section className="panel p-4 md:p-5">
        <h2 className="section-title mb-3">Ochkolar</h2>
        <div className="grid grid-cols-3 gap-3 md:max-w-md">
          {num("pointsWin")}
          {num("pointsDraw")}
          {num("pointsLoss")}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:max-w-xl">
          <Field label="Guruh bosqichi" htmlFor="legs">
            <Select value={String(rules.legs)} onValueChange={(v) => setRules({ ...rules, legs: v === "2" ? 2 : 1 })}>
              <SelectTrigger id="legs" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Bir davrali</SelectItem>
                <SelectItem value="2">Ikki davrali</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bir bo‘lim davomiyligi" htmlFor="half" hint="Telegram botdagi jonli o‘yin soati shunga qarab daqiqani hisoblaydi">
            <Select value={String(rules.halfMinutes ?? DEFAULT_HALF_MINUTES)} onValueChange={(v) => setRules({ ...rules, halfMinutes: Number(v) })}>
              <SelectTrigger id="half" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[15, 20, 25, 30, 35, 40, 45].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} daqiqa (o‘yin 2 × {n})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>
      <section className="panel p-4 md:p-5" aria-labelledby="qual-title">
        <h2 id="qual-title" className="section-title">Guruhdan pley-offga chiqadiganlar</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Guruhdagi jamoalar soniga qarab. Masalan, 4 jamoali guruhdan 1- va 2-o‘rinlar, 5 jamoalidan eng yaxshi 3 ta jamoa chiqadi. Jami soni setkaga mos
          kelmasa, eng yaxshilari to‘g‘ridan-to‘g‘ri o‘tadi, qolganlari saralash o‘yini o‘ynaydi.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[3, 4, 5, 6].map((size) => (
            <Field key={size} label={`${size} jamoali guruhdan`} htmlFor={`qual-${size}`}>
              <Select
                value={String(qualifiersFor(rules, size))}
                onValueChange={(v) => setRules({ ...rules, qualifiersBySize: { ...rules.qualifiersBySize, [size]: Number(v) } })}
              >
                <SelectTrigger id={`qual-${size}`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: size - 1 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} ta jamoa</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ))}
        </div>
      </section>
      <section className="panel p-4 md:p-5">
        <h2 className="section-title">Teng ochko bo‘lganda</h2>
        <p className="mb-3 text-sm text-muted-foreground">Mezonlar yuqoridan pastga tartibda qo‘llanadi. Jadval darhol shu tartib bo‘yicha qayta hisoblanadi.</p>
        <ol className="space-y-2 md:max-w-xl">
          {rules.tiebreakers.map((t, i) => (
            <li key={t} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
              <span className="w-5 font-score text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 text-sm font-medium">{TIEBREAKER_LABELS[t]}</span>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Yuqoriga" onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Pastga" onClick={() => move(i, 1)} disabled={i === rules.tiebreakers.length - 1}>
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Olib tashlash"
                onClick={() => setRules({ ...rules, tiebreakers: rules.tiebreakers.filter((x) => x !== t) })}
                disabled={rules.tiebreakers.length <= 1}
              >
                <Trash aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
        {unused.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {unused.map((t) => (
              <Button key={t} type="button" size="sm" variant="outline" onClick={() => setRules({ ...rules, tiebreakers: [...rules.tiebreakers, t] })}>
                <Plus aria-hidden="true" />
                {TIEBREAKER_LABELS[t]}
              </Button>
            ))}
          </div>
        )}
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
          <Switch checked={rules.thirdPlaceMatch} onCheckedChange={(v) => setRules({ ...rules, thirdPlaceMatch: v })} />
          Pley-offda 3-o‘rin uchun o‘yin
        </label>
      </section>
      <Button onClick={() => runAction(() => mutation.mutateAsync(rules), "Nizom saqlandi. Jadvallar qayta hisoblandi.")} disabled={mutation.isPending}>
        <Save aria-hidden="true" />
        Nizomni saqlash
      </Button>
    </fieldset>
  )
}

function AdjustmentsTab() {
  const { index } = useSeasonData()
  const { season } = useSeason()
  const readOnly = useReadOnly()
  const [teamId, setTeamId] = useState("")
  const [points, setPoints] = useState("-3")
  const [reason, setReason] = useState("")
  const add = useAdminMutation(() => api.addAdjustment(season!.id, { seasonTeamId: teamId, points: Number(points), reason }))
  const remove = useAdminMutation((id: string) => api.deleteAdjustment(id))
  if (!index) return <ListSkeleton />
  return (
    <div className="space-y-5">
      {!readOnly && (
        <section className="panel p-4 md:p-5">
          <h2 className="section-title">Jarima yoki bonus ochko</h2>
          <p className="mb-3 text-sm text-muted-foreground">Masalan, intizom buzilgani uchun −3 ochko. Sababi saytdagi jadval ostida ko‘rsatiladi.</p>
          <div className="grid gap-3 md:grid-cols-[1fr_7rem_2fr_auto] md:items-end">
            <Field label="Jamoa" htmlFor="adj-team">
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger id="adj-team" className="w-full"><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>
                  {index.bundle.teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ochko" htmlFor="adj-points">
              <Input id="adj-points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/[^\d-]/g, "").slice(0, 3))} />
            </Field>
            <Field label="Sababi" htmlFor="adj-reason">
              <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ro‘yxatdan o‘tmagan futbolchi o‘ynatilgani uchun" />
            </Field>
            <Button
              disabled={!teamId || add.isPending}
              onClick={() =>
                runAction(() => add.mutateAsync(undefined), "Ochko o‘zgarishi qo‘shildi. Jadval yangilandi.").then((ok) => {
                  if (ok !== undefined) setReason("")
                })
              }
            >
              Qo‘shish
            </Button>
          </div>
        </section>
      )}
      <section className="panel overflow-hidden">
        {index.bundle.adjustments.length === 0 ? (
          <EmptyState icon={ScrollText} title="Ochko o‘zgarishlari yo‘q" description="Barcha jamoalar ochkolari faqat o‘yin natijalaridan hisoblanmoqda." />
        ) : (
          <ul className="divide-y divide-border">
            {index.bundle.adjustments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-10 font-score text-lg">{a.points > 0 ? `+${a.points}` : a.points}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{index.team(a.seasonTeamId)?.name}</span>
                  <span className="block text-muted-foreground">{a.reason}</span>
                </span>
                {!readOnly && (
                  <ConfirmAction
                    trigger={
                      <Button size="icon" variant="ghost" aria-label="Bekor qilish" className="text-destructive hover:text-destructive">
                        <Trash aria-hidden="true" />
                      </Button>
                    }
                    title="Ochko o‘zgarishini bekor qilasizmi?"
                    description="Jamoa ochkolari qayta hisoblanadi."
                    confirmLabel="Ha, bekor qilish"
                    onConfirm={() => runAction(() => remove.mutateAsync(a.id), "Bekor qilindi. Jadval yangilandi.")}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function LeagueTab() {
  const { data } = useSettings()
  const [form, setForm] = useState<LeagueSettings | null>(null)
  const mutation = useAdminMutation((s: LeagueSettings) => api.updateSettings(s))
  useEffect(() => {
    if (data) setForm(data)
  }, [data])
  if (!form) return <ListSkeleton />
  const set = (k: keyof LeagueSettings, v: string) => setForm({ ...form, [k]: v })
  return (
    <section className="panel space-y-4 p-4 md:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Liga nomi" htmlFor="l-name" required>
          <Input id="l-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Hudud" htmlFor="l-region">
          <Input id="l-region" value={form.region} onChange={(e) => set("region", e.target.value)} />
        </Field>
        <Field label="Aloqa telefoni" htmlFor="l-phone" hint="Saytda «Liga haqida» sahifasida ko‘rinadi">
          <Input id="l-phone" type="tel" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="+998" />
        </Field>
        <Field label="Telegram (murojaat uchun)" htmlFor="l-tg" hint="Tashkilotchi profili, masalan, @Sanjar12ab">
          <Input id="l-tg" value={form.telegram} onChange={(e) => set("telegram", e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Telegram kanal" htmlFor="l-tg-channel" hint="Saytda logotip bilan ko‘rinadi">
          <Input id="l-tg-channel" value={form.telegramChannel ?? ""} onChange={(e) => set("telegramChannel", e.target.value)} placeholder="t.me/kanal_nomi" />
        </Field>
        <Field label="Instagram" htmlFor="l-instagram" hint="Saytda logotip bilan ko‘rinadi">
          <Input id="l-instagram" value={form.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} placeholder="instagram.com/sahifa" />
        </Field>
        <Field label="YouTube" htmlFor="l-youtube" hint="Saytda logotip bilan ko‘rinadi">
          <Input id="l-youtube" value={form.youtube ?? ""} onChange={(e) => set("youtube", e.target.value)} placeholder="youtube.com/@kanal" />
        </Field>
      </div>
      <Field
        label="Liga haqida"
        htmlFor="l-about"
        hint="Saytda «Liga haqida» sahifasida, birinchi xatboshi esa bosh sahifada ko‘rinadi. «## » bilan boshlangan qator — sarlavha, «- » — ro‘yxat, «1. » — raqamli ro‘yxat, **so‘z** — qalin, bo‘sh qator — yangi xatboshi."
      >
        <Textarea id="l-about" rows={14} maxLength={4000} value={form.about} onChange={(e) => set("about", e.target.value)} />
      </Field>
      <Button onClick={() => runAction(() => mutation.mutateAsync(form), "Liga ma’lumotlari saqlandi")} disabled={mutation.isPending}>
        <Save aria-hidden="true" />
        Saqlash
      </Button>
    </section>
  )
}

function VenuesTab() {
  const { data, isLoading } = useVenues()
  const [editing, setEditing] = useState<Venue | null>(null)
  const [name, setName] = useState("")
  const [village, setVillage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const save = useAdminMutation(() => api.saveVenue(editing?.id ?? null, { name, village }))
  const remove = useAdminMutation((id: string) => api.deleteVenue(id))

  const reset = () => {
    setEditing(null)
    setName("")
    setVillage("")
    setError(null)
  }
  const submit = async () => {
    if (name.trim().length < 2) return setError("Maydon nomini kiriting.")
    setError(null)
    const ok = await runAction(() => save.mutateAsync(undefined), editing ? "Maydon saqlandi" : "Maydon qo‘shildi")
    if (ok) reset()
  }

  return (
    <div className="space-y-5">
      <section className="panel p-4 md:p-5" aria-labelledby="venue-form-title">
        <h2 id="venue-form-title" className="section-title">
          {editing ? "Maydonni tahrirlash" : "Yangi maydon"}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">O‘yin belgilashda shu ro‘yxatdan maydon tanlanadi va u muxlislarga ko‘rsatiladi.</p>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
          <Field label="Maydon nomi" htmlFor="venue-name" error={error ?? undefined} required>
            <Input id="venue-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mirzacho‘l Birlik Arena" />
          </Field>
          <Field label="Qishloq" htmlFor="venue-village">
            <Input id="venue-village" value={village} onChange={(e) => setVillage(e.target.value)} placeholder="Payariq" />
          </Field>
          <div className="flex gap-2">
            {editing && (
              <Button variant="outline" onClick={reset}>
                Bekor qilish
              </Button>
            )}
            <Button onClick={submit} disabled={save.isPending}>
              {editing ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {editing ? "Saqlash" : "Qo‘shish"}
            </Button>
          </div>
        </div>
      </section>
      <section className="panel overflow-hidden" aria-label="Maydonlar ro‘yxati">
        {isLoading || !data ? (
          <ListSkeleton rows={3} />
        ) : data.length === 0 ? (
          <EmptyState icon={MapPin} title="Maydonlar hali yo‘q" description="Birinchi maydonni yuqoridagi forma orqali qo‘shing." />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{v.name}</span>
                  {v.village && <span className="block text-xs text-muted-foreground">{v.village}</span>}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${v.name}ni tahrirlash`}
                  onClick={() => {
                    setEditing(v)
                    setName(v.name)
                    setVillage(v.village)
                  }}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <ConfirmAction
                  trigger={
                    <Button size="icon" variant="ghost" aria-label={`${v.name}ni o‘chirish`} className="text-destructive hover:text-destructive">
                      <Trash aria-hidden="true" />
                    </Button>
                  }
                  title="Maydonni o‘chirasizmi?"
                  description="Bu maydonda o‘yinlar belgilangan bo‘lsa, tizim o‘chirishga ruxsat bermaydi."
                  confirmLabel="Ha, o‘chirish"
                  onConfirm={() => runAction(() => remove.mutateAsync(v.id), "Maydon o‘chirildi")}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function AuditTab() {
  const { data, isLoading } = useAudit()
  const reset = useAdminMutation(() => api.resetDemoData())
  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden">
        {isLoading || !data ? (
          <ListSkeleton />
        ) : data.length === 0 ? (
          <EmptyState icon={ScrollText} title="O‘zgarishlar yo‘q" />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((a) => (
              <li key={a.id} className="px-4 py-2.5 text-sm">
                <p>
                  <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">{a.action}</span>
                  {a.summary}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.user}, {formatDateTime(a.at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {IS_DEMO_MODE && (
      <section className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <Database className="size-5 text-muted-foreground" aria-hidden="true" />
        <p className="flex-1 text-sm">
          <span className="font-semibold">Namunaviy ma’lumotlarni tiklash.</span> Brauzerda kiritilgan barcha sinov o‘zgarishlari o‘chadi va boshlang‘ich holat qaytadi.
        </p>
        <ConfirmAction
          trigger={
            <Button variant="outline">
              <RotateCcw aria-hidden="true" />
              Tiklash
            </Button>
          }
          title="Namunaviy ma’lumotlarni tiklaysizmi?"
          description="Siz kiritgan barcha sinov natijalari, jamoalar va yangiliklar o‘chadi."
          confirmLabel="Ha, tiklash"
          onConfirm={() => runAction(() => reset.mutateAsync(undefined), "Namunaviy ma’lumotlar tiklandi")}
        />
      </section>
      )}
    </div>
  )
}

export default function AdminSettingsPage() {
  const [params, setParams] = useSearchParams()
  const { data: me } = useMe()
  const tabs = TABS.filter((t) => !t.superOnly || isSuperAdmin(me?.role))
  const tab = tabs.some((t) => t.value === params.get("tab")) ? params.get("tab")! : "nizom"
  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Sozlamalar" description="Liga nizomi, ochko o‘zgarishlari, maydonlar, foydalanuvchilar va o‘zgarishlar tarixi" />
      <ReadOnlyBanner />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="mb-4 w-full md:w-auto">
          {tabs.map((t) => <TabsTrigger key={t.value} value={t.value} aria-controls="settings-panel">{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div id="settings-panel" role="tabpanel" aria-label={tabs.find((t) => t.value === tab)?.label}>
        {tab === "nizom" && <RulesTab />}
        {tab === "ochko" && <AdjustmentsTab />}
        {tab === "liga" && <LeagueTab />}
        {tab === "maydonlar" && <VenuesTab />}
        {tab === "foydalanuvchilar" && <UsersManager />}
        {tab === "tarix" && <AuditTab />}
      </div>
    </div>
  )
}
