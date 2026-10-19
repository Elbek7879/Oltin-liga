import { zodResolver } from "@hookform/resolvers/zod"
import { ListPlus, Lock, Pencil, Search, Trash, UserPlus, UserRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { api } from "@/api/client"
import { useAdminMutation, useAdminPlayers, useAdminTeams } from "@/api/hooks"
import type { AdminPlayerRow, PlayerInput } from "@/api/types"
import { AdminPageHeader, ConfirmAction, Field, ReadOnlyBanner, runAction, useReadOnly } from "@/components/admin/admin-ui"
import { PlayersEditor } from "@/components/admin/players-editor"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/league/states"
import { TeamCrest } from "@/components/league/team-crest"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Position } from "@/domain/types"
import { useSeason } from "@/hooks/use-season"
import { POSITION_LABEL } from "@/lib/format"
import { checkDrafts, emptyDraft, toRowInputs, type PlayerDraft } from "@/lib/player-list"

const NONE = "__none__"
const PAGE = 50

const schema = z.object({
  firstName: z.string().trim().min(2, "Ismni kiriting"),
  lastName: z.string().trim().min(2, "Familiyani kiriting"),
  birthYear: z.string().regex(/^(\d{4})?$/, "Yilni 4 ta raqam bilan yozing"),
  position: z.enum(["GK", "DF", "MF", "FW", "NONE"]),
  phone: z.string().trim().regex(/^(\+?[0-9\s()-]{7,20})?$/, "Masalan: +998 90 123 45 67"),
  seasonTeamId: z.string(),
  number: z.string().regex(/^(\d{1,2})?$/, "1 dan 99 gacha raqam"),
})
type Values = z.infer<typeof schema>

function PlayerFormDialog({
  open,
  onOpenChange,
  player,
  teams,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  player: AdminPlayerRow | null
  teams: { id: string; name: string }[]
}) {
  const { seasonId } = useSeason()
  const mutation = useAdminMutation((input: PlayerInput) => (player ? api.updatePlayer(seasonId!, player.id, input) : api.createPlayer(seasonId!, input)))
  const defaults = (): Values => ({
    firstName: player?.firstName ?? "",
    lastName: player?.lastName ?? "",
    birthYear: player?.birthYear ? String(player.birthYear) : "",
    position: player ? (player.position ?? "NONE") : "NONE",
    phone: player?.phone ?? "",
    seasonTeamId: player?.seasonTeamId ?? NONE,
    number: player?.number ? String(player.number) : "",
  })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults() })
  useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, player?.id])
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (v) => {
    const input: PlayerInput = {
      firstName: v.firstName,
      lastName: v.lastName,
      birthYear: v.birthYear ? Number(v.birthYear) : null,
      position: v.position === "NONE" ? null : v.position,
      phone: v.phone,
      seasonTeamId: v.seasonTeamId === NONE ? null : v.seasonTeamId,
      number: v.number ? Number(v.number) : null,
    }
    const ok = await runAction(() => mutation.mutateAsync(input), player ? "Futbolchi ma’lumotlari saqlandi" : `${v.firstName} ${v.lastName} qo‘shildi`)
    if (ok) onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{player ? "Futbolchini tahrirlash" : "Yangi futbolchi"}</DialogTitle>
          <DialogDescription>Telefon raqami faqat tashkilotchilarga ko‘rinadi, ommaviy saytda chiqmaydi.</DialogDescription>
        </DialogHeader>
        <form id="player-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Ism" htmlFor="p-first" error={errors.firstName?.message} required>
            <Input id="p-first" autoComplete="off" aria-invalid={Boolean(errors.firstName)} {...form.register("firstName")} />
          </Field>
          <Field label="Familiya" htmlFor="p-last" error={errors.lastName?.message} required>
            <Input id="p-last" autoComplete="off" aria-invalid={Boolean(errors.lastName)} {...form.register("lastName")} />
          </Field>
          <Field label="Pozitsiya" htmlFor="p-pos">
            <Controller
              control={form.control}
              name="position"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="p-pos" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Ko‘rsatilmagan</SelectItem>
                    {(Object.keys(POSITION_LABEL) as Position[]).map((p) => <SelectItem key={p} value={p}>{POSITION_LABEL[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Tug‘ilgan yili" htmlFor="p-birth" error={errors.birthYear?.message}>
            <Input id="p-birth" inputMode="numeric" maxLength={4} placeholder="2001" {...form.register("birthYear")} />
          </Field>
          <Field label="Jamoa (shu mavsumda)" htmlFor="p-team">
            <Controller
              control={form.control}
              name="seasonTeamId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="p-team" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Jamoasiz</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="O‘yin raqami" htmlFor="p-number" error={errors.number?.message} hint="Ixtiyoriy">
            <Input id="p-number" inputMode="numeric" maxLength={2} placeholder="10" {...form.register("number")} />
          </Field>
          <Field label="Telefon" htmlFor="p-phone" error={errors.phone?.message} className="sm:col-span-2" hint="Maxfiy, faqat admin uchun">
            <Input id="p-phone" type="tel" autoComplete="off" placeholder="+998 90 123 45 67" {...form.register("phone")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button type="submit" form="player-form" disabled={mutation.isPending}>
            {mutation.isPending ? "Saqlanmoqda…" : player ? "O‘zgarishlarni saqlash" : "Futbolchini qo‘shish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Jamoa tarkibini ro'yxat bilan birdaniga kiritish */
function BulkPlayersDialog({
  open,
  onOpenChange,
  teams,
  initialTeam,
  numbersOf,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  teams: { id: string; name: string }[]
  initialTeam: string | null
  numbersOf: (seasonTeamId: string) => number[]
}) {
  const { seasonId } = useSeason()
  const [team, setTeam] = useState<string>("")
  const [rows, setRows] = useState<PlayerDraft[]>([])
  const check = checkDrafts(rows, team ? numbersOf(team) : [])
  const mutation = useAdminMutation(() => api.createPlayers(seasonId!, { seasonTeamId: team, players: toRowInputs(check.filled) }))

  useEffect(() => {
    if (open) {
      setTeam(initialTeam ?? "")
      setRows([emptyDraft(), emptyDraft(), emptyDraft()])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const blocked = !team || check.filled.length === 0 || Object.keys(check.errors).length > 0
  const submit = async () => {
    const name = teams.find((t) => t.id === team)?.name
    const res = await runAction(() => mutation.mutateAsync(undefined), `${name} tarkibiga ${check.filled.length} ta futbolchi qo‘shildi`)
    if (res) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Ro‘yxatdan qo‘shish</DialogTitle>
          <DialogDescription>Jamoani tanlang va futbolchilarni kiriting yoki ro‘yxatni nusxalab qo‘ying. Hammasi bir martada saqlanadi.</DialogDescription>
        </DialogHeader>
        <Field label="Jamoa" htmlFor="bulk-team" required>
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger id="bulk-team" className="w-full">
              <SelectValue placeholder="Jamoani tanlang" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <PlayersEditor rows={rows} onChange={setRows} errors={check.errors} idPrefix="bulk" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={blocked || mutation.isPending}>
            <ListPlus aria-hidden="true" />
            {mutation.isPending ? "Saqlanmoqda…" : check.filled.length > 0 ? `${check.filled.length} ta futbolchini qo‘shish` : "Futbolchilarni qo‘shish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminPlayersPage() {
  const { seasonId } = useSeason()
  const { data, isLoading, error, refetch } = useAdminPlayers(seasonId)
  const { data: teamRows } = useAdminTeams(seasonId)
  const readOnly = useReadOnly()
  const [params] = useSearchParams()
  const [query, setQuery] = useState("")
  // Jamoa oynasidagi «Futbolchilarni boshqarish» havolasi shu jamoani ochadi
  const [team, setTeam] = useState(params.get("jamoa") || "all")
  const [bulkOpen, setBulkOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState<AdminPlayerRow | null>(null)
  const [open, setOpen] = useState(false)
  const remove = useAdminMutation((id: string) => api.deletePlayer(id))

  const teams = useMemo(
    () => (teamRows ?? []).filter((t) => t.inSeason && t.seasonTeamId).map((t) => ({ id: t.seasonTeamId!, name: t.name, team: t })),
    [teamRows],
  )
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? [])
      .filter((p) => (team === "all" ? true : team === "none" ? !p.seasonTeamId : p.seasonTeamId === team))
      .filter((p) => !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.phone?.replace(/\s/g, "").includes(q.replace(/\s/g, "")))
  }, [data, query, team])

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Futbolchilar"
        description="Futbolchi bir marta qo‘shiladi va har mavsumda jamoaga biriktiriladi. Oldingi mavsumlar statistikasi saqlanib qoladi."
        actions={
          !readOnly && (
            <>
              <Button variant="outline" onClick={() => setBulkOpen(true)}>
                <ListPlus aria-hidden="true" />
                Ro‘yxatdan qo‘shish
              </Button>
              <Button onClick={() => { setEditing(null); setOpen(true) }}>
                <UserPlus aria-hidden="true" />
                Futbolchi qo‘shish
              </Button>
            </>
          )
        }
      />
      <ReadOnlyBanner />
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_14rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }} placeholder="Ism, familiya yoki telefon" aria-label="Futbolchini qidirish" className="pl-9" />
        </div>
        <Select value={team} onValueChange={(v) => { setTeam(v); setLimit(PAGE) }}>
          <SelectTrigger aria-label="Jamoa bo‘yicha filtr" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha futbolchilar</SelectItem>
            <SelectItem value="none">Jamoasizlar</SelectItem>
            {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <section className="panel overflow-hidden">
        {isLoading ? (
          <ListSkeleton rows={8} />
        ) : error || !data ? (
          <ErrorState message={error?.message} onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={UserRound} title="Futbolchi topilmadi" description="Qidiruvni o‘zgartiring yoki yangi futbolchi qo‘shing." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.slice(0, limit).map((p) => {
              const t = teams.find((x) => x.id === p.seasonTeamId)
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 md:px-4">
                  <span className="w-7 text-center font-score text-md text-muted-foreground">{p.number ?? "—"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.firstName} {p.lastName}</p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      {t ? <TeamCrest team={t.team} size="xs" /> : null}
                      {t?.name ?? "Jamoasiz"}, {p.position ? POSITION_LABEL[p.position].toLowerCase() : "pozitsiyasi ko‘rsatilmagan"}
                      {p.phone && (
                        <span className="hidden items-center gap-1 sm:inline-flex">
                          , <Lock className="size-3" aria-hidden="true" /> {p.phone}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="hidden text-center text-xs text-muted-foreground sm:block">
                    <span className="block font-score text-lg text-foreground">{p.goals}</span>gol
                  </span>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label={`${p.firstName} ${p.lastName}ni tahrirlash`} onClick={() => { setEditing(p); setOpen(true) }}>
                        <Pencil aria-hidden="true" />
                      </Button>
                      <ConfirmAction
                        trigger={
                          <Button size="icon" variant="ghost" aria-label={`${p.firstName} ${p.lastName}ni o‘chirish`} className="text-destructive hover:text-destructive">
                            <Trash aria-hidden="true" />
                          </Button>
                        }
                        title="Futbolchini o‘chirasizmi?"
                        description={
                          p.hasHistory
                            ? "Bu futbolchining o‘yinlar statistikasi bor. Tarix saqlanishi uchun tizim o‘chirishga ruxsat bermaydi — tahrirlash oynasida «Jamoasiz» ni tanlang."
                            : `${p.firstName} ${p.lastName} butunlay o‘chiriladi.`
                        }
                        confirmLabel="Ha, o‘chirish"
                        onConfirm={() => runAction(() => remove.mutateAsync(p.id), "Futbolchi o‘chirildi")}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {rows.length > limit && (
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
            Yana ko‘rsatish ({rows.length - limit} ta qoldi)
          </Button>
        </div>
      )}
      <PlayerFormDialog open={open} onOpenChange={setOpen} player={editing} teams={teams} />
      <BulkPlayersDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        teams={teams}
        initialTeam={team !== "all" && team !== "none" ? team : null}
        numbersOf={(id) => (data ?? []).filter((p) => p.seasonTeamId === id && p.number != null).map((p) => p.number!)}
      />
    </div>
  )
}
