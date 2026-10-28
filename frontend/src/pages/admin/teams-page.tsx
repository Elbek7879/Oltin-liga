import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, Lock, Pencil, Plus, Search, Shield, Trash, UsersRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useSearchParams } from "react-router"
import { z } from "zod"
import { api } from "@/api/client"
import { useAdminMutation, useAdminTeams } from "@/api/hooks"
import type { AdminTeamRow, TeamInput } from "@/api/types"
import { AdminPageHeader, ConfirmAction, Field, ReadOnlyBanner, runAction, useReadOnly } from "@/components/admin/admin-ui"
import { LogoUpload } from "@/components/admin/logo-upload"
import { PlayersEditor } from "@/components/admin/players-editor"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useSeason } from "@/hooks/use-season"
import { useSeasonData } from "@/hooks/use-season-data"
import { SEASON_STATUS_LABEL } from "@/lib/format"
import { checkDrafts, emptyDraft, toRowInputs, type PlayerDraft } from "@/lib/player-list"
import { cn } from "@/lib/utils"
import { searchKey } from "@/lib/translit"

const schema = z.object({
  name: z.string().trim().min(2, "Jamoa nomini kiriting (kamida 2 ta harf)").max(40, "Nom juda uzun"),
  shortName: z
    .string()
    .trim()
    .regex(/^[A-Za-z‘’ʻ']{2,4}$/, "2–4 ta lotin harfi, masalan NAV"),
  village: z.string().trim().min(2, "Qishloq nomini kiriting"),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  founded: z
    .string()
    .regex(/^(\d{4})?$/, "Yilni 4 ta raqam bilan yozing")
    .refine((v) => !v || (Number(v) >= 1950 && Number(v) <= new Date().getFullYear()), "Yil noto‘g‘ri"),
  logoUrl: z.string().nullable(),
})
type Values = z.infer<typeof schema>

/** «2-mavsum» (2026, tayyorlanmoqda) — bir yilda ikki mavsum bo'lsa ham qaysi biri ekani aniq */
function seasonTitle(season: { name: string; year: number; status: keyof typeof SEASON_STATUS_LABEL } | undefined) {
  return season ? `«${season.name}» (${season.year}, ${SEASON_STATUS_LABEL[season.status].toLowerCase()})` : ""
}

function TeamFormDialog({ open, onOpenChange, team, locked }: { open: boolean; onOpenChange: (v: boolean) => void; team: AdminTeamRow | null; locked: boolean }) {
  const { seasonId, season } = useSeason()
  const [addToSeasonChoice, setAddToSeason] = useState(true)
  // Qur'a tashlangan mavsumga jamoa qo'shilmaydi — faqat umumiy ro'yxatga (keyingi mavsum uchun) saqlanadi
  const addToSeason = addToSeasonChoice && !locked
  const [playersOpen, setPlayersOpen] = useState(false)
  const [players, setPlayers] = useState<PlayerDraft[]>([])
  const playerCheck = checkDrafts(players)
  const canAddPlayers = !team && addToSeason && season?.status !== "FINISHED"
  const mutation = useAdminMutation(async (input: TeamInput) => {
    if (team) return api.updateTeam(team.id, input)
    const created = await api.createTeam(input, addToSeason && season?.status !== "FINISHED" ? seasonId : null)
    const rows = canAddPlayers ? playerCheck.filled : []
    if (rows.length > 0 && seasonId) {
      // Jamoa saqlandi — endi uning mavsumdagi tarkibiga futbolchilar qo'shiladi
      try {
        const row = (await api.listTeamsAdmin(seasonId)).find((t) => t.id === created.id)
        await api.createPlayers(seasonId, { seasonTeamId: row!.seasonTeamId!, players: toRowInputs(rows) })
      } catch (e) {
        throw new Error(`«${created.name}» jamoasi qo‘shildi, lekin futbolchilar saqlanmadi: ${e instanceof Error ? e.message : ""} Ularni «Futbolchilar» bo‘limidan qo‘shing.`)
      }
    }
    return created
  })
  const defaults = (): Values => ({
    name: team?.name ?? "",
    shortName: team?.shortName ?? "",
    village: team?.village ?? "",
    primaryColor: team?.primaryColor ?? "#145A3A",
    secondaryColor: team?.secondaryColor ?? "#E2BF4F",
    founded: team?.founded ? String(team.founded) : "",
    logoUrl: team?.logoUrl ?? null,
  })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults() })
  useEffect(() => {
    if (open) {
      form.reset(defaults())
      setAddToSeason(true)
      setPlayersOpen(false)
      setPlayers([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, team?.id])
  const v = form.watch()
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    if (canAddPlayers && Object.keys(playerCheck.errors).length > 0) return
    const input: TeamInput = { ...values, founded: values.founded ? Number(values.founded) : null }
    const count = canAddPlayers ? playerCheck.filled.length : 0
    const ok = await runAction(
      () => mutation.mutateAsync(input),
      team ? "Jamoa ma’lumotlari saqlandi" : count > 0 ? `«${values.name}» jamoasi ${count} ta futbolchi bilan qo‘shildi` : `«${values.name}» jamoasi qo‘shildi`,
    )
    if (ok) onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Futbolchilar bo'limi ochilganda oyna kengayadi — ism va familiya to'liq ko'rinsin */}
      <DialogContent className={cn("max-h-[92dvh] overflow-y-auto sm:max-w-lg", playersOpen && "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{team ? "Jamoani tahrirlash" : "Yangi jamoa"}</DialogTitle>
          <DialogDescription>Logotip bo‘lmasa, nishon jamoa ranglari va qisqa nomidan avtomatik yasaladi.</DialogDescription>
        </DialogHeader>
        <form id="team-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl bg-muted p-3 sm:col-span-2">
            <TeamCrest team={{ name: v.name, shortName: v.shortName || "?", primaryColor: v.primaryColor, secondaryColor: v.secondaryColor, logoUrl: v.logoUrl }} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-display text-xl">{v.name || "Jamoa nomi"}</p>
              <p className="truncate text-sm text-muted-foreground">{v.village || "Qishloq"}</p>
            </div>
          </div>
          <Field label="Jamoa nomi" htmlFor="t-name" error={errors.name?.message} required className="sm:col-span-2">
            <Input id="t-name" autoComplete="off" placeholder="Navbahor" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
          </Field>
          <Field label="Qisqa nomi" htmlFor="t-short" error={errors.shortName?.message} hint="Jadval va nishonda ko‘rinadi" required>
            <Input id="t-short" autoComplete="off" placeholder="NAV" maxLength={4} className="uppercase" aria-invalid={Boolean(errors.shortName)} {...form.register("shortName")} />
          </Field>
          <Field label="Qishloq" htmlFor="t-village" error={errors.village?.message} required>
            <Input id="t-village" autoComplete="off" placeholder="Payariq" aria-invalid={Boolean(errors.village)} {...form.register("village")} />
          </Field>
          <Field label="Asosiy rang" htmlFor="t-primary">
            <Input id="t-primary" type="color" className="h-11 cursor-pointer p-1 md:h-9" {...form.register("primaryColor")} />
          </Field>
          <Field label="Ikkinchi rang" htmlFor="t-secondary">
            <Input id="t-secondary" type="color" className="h-11 cursor-pointer p-1 md:h-9" {...form.register("secondaryColor")} />
          </Field>
          <div className="sm:col-span-2">
            <LogoUpload
              value={v.logoUrl}
              onChange={(url) => form.setValue("logoUrl", url, { shouldDirty: true })}
              preview={<TeamCrest team={{ name: v.name, shortName: v.shortName || "?", primaryColor: v.primaryColor, secondaryColor: v.secondaryColor, logoUrl: v.logoUrl }} size="lg" />}
              label="Logotip (ixtiyoriy)"
            />
          </div>
          <Field label="Tashkil topgan yili" htmlFor="t-founded" error={errors.founded?.message}>
            <Input id="t-founded" inputMode="numeric" placeholder="2010" maxLength={4} {...form.register("founded")} />
          </Field>
          {!team && season?.status !== "FINISHED" && !locked && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end text-sm">
              <Switch checked={addToSeason} onCheckedChange={setAddToSeason} />
              <span>{seasonTitle(season)} mavsumiga qo‘shish</span>
            </label>
          )}
          {!team && locked && (
            <p className="flex items-start gap-2 self-end text-sm text-muted-foreground sm:col-span-2">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {seasonTitle(season)} mavsumida qur’a tashlangan — jamoa bu mavsumga qo‘shilmaydi, faqat ro‘yxatga saqlanadi (keyingi mavsumda qo‘shasiz).
            </p>
          )}
          {canAddPlayers && (
            <div className="rounded-xl border border-border p-3 sm:col-span-2">
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-3 text-left"
                aria-expanded={playersOpen}
                onClick={() => {
                  if (!playersOpen && players.length === 0) setPlayers([emptyDraft(), emptyDraft(), emptyDraft()])
                  setPlayersOpen((v) => !v)
                }}
              >
                <UsersRound className="size-5 shrink-0 text-pitch-600 dark:text-gold-400" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    Futbolchilarni hozir kiritish{playerCheck.filled.length > 0 ? ` (${playerCheck.filled.length} ta)` : ""}
                  </span>
                  <span className="block text-xs text-muted-foreground">Ixtiyoriy. Keyin «Futbolchilar» bo‘limidan ham qo‘shish mumkin.</span>
                </span>
                <ChevronDown className={`size-4 shrink-0 transition-transform ${playersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {playersOpen && (
                <div className="mt-3">
                  <PlayersEditor rows={players} onChange={setPlayers} errors={playerCheck.errors} idPrefix="team-pl" />
                </div>
              )}
            </div>
          )}
          {team && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Tarkib: {team.playersCount} ta futbolchi.{" "}
              <Link to={`/admin/futbolchilar?jamoa=${team.seasonTeamId ?? ""}`} className="font-semibold underline" onClick={() => onOpenChange(false)}>
                Futbolchilarni boshqarish
              </Link>
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button type="submit" form="team-form" disabled={mutation.isPending}>
            {mutation.isPending ? "Saqlanmoqda…" : team ? "O‘zgarishlarni saqlash" : "Jamoani qo‘shish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminTeamsPage() {
  const { seasonId, season } = useSeason()
  const { index } = useSeasonData()
  // Qur'a tashlangach mavsum ishtirokchilari qulflanadi (server ham shuni tekshiradi)
  const locked = Boolean(index && index.bundle.season.id === seasonId && index.bundle.groups.length > 0)
  const { data, isLoading, error, refetch } = useAdminTeams(seasonId)
  const readOnly = useReadOnly()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<AdminTeamRow | null>(null)
  const [open, setOpen] = useState(params.get("yangi") === "1")
  const toggle = useAdminMutation((v: { teamId: string; inSeason: boolean }) => api.setTeamInSeason(v.teamId, seasonId!, v.inSeason))
  const remove = useAdminMutation((teamId: string) => api.deleteTeam(teamId))

  const rows = useMemo(() => {
    const q = searchKey(query)
    return (data ?? []).filter((t) => !q || searchKey(t.name).includes(q) || searchKey(t.village).includes(q))
  }, [data, query])
  const inSeason = data?.filter((t) => t.inSeason).length ?? 0

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Jamoalar"
        description={`Jamoalar soni cheklanmagan. ${seasonTitle(season)} mavsumida ${inSeason} ta jamoa ishtirok etmoqda.`}
        actions={
          !readOnly && !locked && (
            <Button onClick={() => { setEditing(null); setOpen(true) }}>
              <Plus aria-hidden="true" />
              Jamoa qo‘shish
            </Button>
          )
        }
      />
      <ReadOnlyBanner />
      {locked && !readOnly && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            <span className="font-semibold">Qur’a tashlangan — guruhlar shakllangan.</span> Bu mavsumga yangi jamoa qo‘shib yoki jamoani chiqarib bo‘lmaydi.
            Jamoa nomi, logotipi va futbolchilarini tahrirlash mumkin. Jamoa esdan chiqqan bo‘lsa va hali natija kiritilmagan bo‘lsa,{" "}
            <Link to="/admin/guruhlar" className="font-semibold underline underline-offset-2">
              «Guruhlar»
            </Link>{" "}
            bo‘limida qur’ani bekor qiling.
          </span>
        </p>
      )}
      <div className="relative mb-4 md:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Jamoa yoki qishloq" aria-label="Jamoalarni qidirish" className="pl-9" />
      </div>
      <section className="panel overflow-hidden">
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : error || !data ? (
          <ErrorState message={error?.message} onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Shield} title={query ? "Jamoa topilmadi" : "Birinchi jamoani qo‘shing"} description={query ? "Qidiruv so‘zini o‘zgartiring." : "Jamoa qo‘shilgach, uni mavsumga va guruhga biriktirasiz."} />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-3 md:px-4">
                <TeamCrest team={t} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.village}
                    {t.inSeason ? `, ${t.playersCount} ta futbolchi` : ""}
                  </p>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <Switch
                    checked={t.inSeason}
                    disabled={readOnly || locked || toggle.isPending}
                    onCheckedChange={(v) =>
                      // Qaytgan jamoa oxirgi ishtirok etgan mavsumdagi tarkibi bilan qo'shiladi
                      runAction(
                        () => toggle.mutateAsync({ teamId: t.id, inSeason: v }),
                        (r) =>
                          !v
                            ? `«${t.name}» mavsumdan chiqarildi`
                            : r.copiedPlayers > 0
                              ? `«${t.name}» mavsumga oldingi tarkibi bilan qo‘shildi: ${r.copiedPlayers} ta futbolchi`
                              : `«${t.name}» mavsumga qo‘shildi`,
                      )
                    }
                    aria-label={`${t.name}: ${seasonTitle(season)} mavsumida ishtirok${locked ? " (qur’a tashlangan, o‘zgartirib bo‘lmaydi)" : ""}`}
                  />
                  <span className="hidden sm:inline">Mavsumda</span>
                </label>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label={`${t.name}ni tahrirlash`} onClick={() => { setEditing(t); setOpen(true) }}>
                      <Pencil aria-hidden="true" />
                    </Button>
                    <ConfirmAction
                      trigger={
                        <Button size="icon" variant="ghost" aria-label={`${t.name}ni o‘chirish`} className="text-destructive hover:text-destructive">
                          <Trash aria-hidden="true" />
                        </Button>
                      }
                      title={`«${t.name}» jamoasini o‘chirasizmi?`}
                      description={
                        t.hasHistory
                          ? "Bu jamoaning o‘yinlari tarixda saqlangan. Tarix yo‘qolmasligi uchun tizim o‘chirishga ruxsat bermaydi — uning o‘rniga jamoani mavsumdan chiqaring."
                          : "Jamoa va uning tarkibi butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi."
                      }
                      confirmLabel="Ha, o‘chirish"
                      onConfirm={() => runAction(() => remove.mutateAsync(t.id), "Jamoa o‘chirildi")}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <TeamFormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v && params.get("yangi")) setParams({}, { replace: true })
        }}
        team={editing}
        locked={locked}
      />
    </div>
  )
}
