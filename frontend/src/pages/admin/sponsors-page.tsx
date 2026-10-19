import { zodResolver } from "@hookform/resolvers/zod"
import { Handshake, Pencil, Plus, Trash } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { api } from "@/api/client"
import { useAdminMutation, useSponsors } from "@/api/hooks"
import type { SponsorInput } from "@/api/types"
import { AdminPageHeader, ConfirmAction, Field, runAction } from "@/components/admin/admin-ui"
import { LogoUpload } from "@/components/admin/logo-upload"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/league/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { Sponsor, SponsorTier } from "@/domain/types"

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

const TIER_LABEL: Record<SponsorTier, string> = { GENERAL: "Bosh homiy", OFFICIAL: "Rasmiy hamkor", PARTNER: "Hamkor" }

const schema = z.object({
  name: z.string().trim().min(2, "Homiy nomini kiriting"),
  tier: z.enum(["GENERAL", "OFFICIAL", "PARTNER"]),
  description: z.string().trim().max(120, "120 ta belgidan oshmasin"),
  url: z.string().trim().refine((v) => !v || /^https?:\/\/[^\s]+\.[^\s]+/.test(v), "https:// bilan boshlanadigan to‘liq manzil"),
  active: z.boolean(),
  order: z.string().regex(/^\d{1,3}$/, "Tartib raqami"),
  logoUrl: z.string().nullable(),
})
type Values = z.infer<typeof schema>

function SponsorDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: Sponsor | null }) {
  const mutation = useAdminMutation((input: SponsorInput) => api.saveSponsor(item?.id ?? null, input))
  const defaults = (): Values => ({
    name: item?.name ?? "",
    tier: item?.tier ?? "PARTNER",
    description: item?.description ?? "",
    url: item?.url ?? "",
    active: item?.active ?? true,
    order: String(item?.order ?? 10),
    logoUrl: item?.logoUrl ?? null,
  })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults() })
  useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])
  const { errors } = form.formState
  const logoUrl = form.watch("logoUrl")
  const name = form.watch("name")
  const onSubmit = form.handleSubmit(async (v) => {
    const ok = await runAction(() => mutation.mutateAsync({ ...v, order: Number(v.order) }), "Homiy saqlandi")
    if (ok) onOpenChange(false)
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{item ? "Homiyni tahrirlash" : "Yangi homiy"}</DialogTitle>
          <DialogDescription>Logotip saytning «Homiylar» sahifasida va pastki qismida ko‘rsatiladi.</DialogDescription>
        </DialogHeader>
        <form id="sponsor-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Nomi" htmlFor="sp-name" error={errors.name?.message} required className="sm:col-span-2">
            <Input id="sp-name" {...form.register("name")} />
          </Field>
          <Field label="Darajasi" htmlFor="sp-tier">
            <Controller
              control={form.control}
              name="tier"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="sp-tier" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIER_LABEL) as SponsorTier[]).map((t) => <SelectItem key={t} value={t}>{TIER_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Tartib raqami" htmlFor="sp-order" error={errors.order?.message} hint="Kichigi oldinda">
            <Input id="sp-order" inputMode="numeric" {...form.register("order")} />
          </Field>
          <Field label="Faoliyati" htmlFor="sp-desc" error={errors.description?.message} className="sm:col-span-2">
            <Input id="sp-desc" placeholder="Qurilish materiallari" {...form.register("description")} />
          </Field>
          <Field label="Sayt havolasi" htmlFor="sp-url" error={errors.url?.message} className="sm:col-span-2">
            <Input id="sp-url" type="url" placeholder="https://" {...form.register("url")} />
          </Field>
          <div className="sm:col-span-2">
            <LogoUpload
              value={logoUrl}
              onChange={(url) => form.setValue("logoUrl", url, { shouldDirty: true })}
              preview={logoUrl ? <img src={logoUrl} alt="" className="size-12 rounded object-contain" /> : <span className="font-display text-lg text-muted-foreground">{initials(name)}</span>}
              label="Logotip (ixtiyoriy)"
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <Controller control={form.control} name="active" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
            Saytda ko‘rsatish
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button type="submit" form="sponsor-form" disabled={mutation.isPending}>{mutation.isPending ? "Saqlanmoqda…" : "Saqlash"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminSponsorsPage() {
  const { data, isLoading, error, refetch } = useSponsors(true)
  const [editing, setEditing] = useState<Sponsor | null>(null)
  const [open, setOpen] = useState(false)
  const remove = useAdminMutation((id: string) => api.deleteSponsor(id))
  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Homiylar"
        description="Homiylar saytning pastki qismida, «Homiylar» sahifasida va kelajakda reklama joylarida ko‘rsatiladi."
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus aria-hidden="true" />
            Homiy qo‘shish
          </Button>
        }
      />
      <section className="panel overflow-hidden">
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : error || !data ? (
          <ErrorState message={error?.message} onRetry={() => refetch()} />
        ) : data.length === 0 ? (
          <EmptyState icon={Handshake} title="Homiylar hali yo‘q" description="Birinchi homiyni qo‘shing." />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-3 md:px-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {TIER_LABEL[s.tier]}
                    {s.description ? `, ${s.description}` : ""}
                    {!s.active ? " — yashirilgan" : ""}
                  </p>
                </div>
                <Button size="icon" variant="ghost" aria-label={`${s.name}ni tahrirlash`} onClick={() => { setEditing(s); setOpen(true) }}>
                  <Pencil aria-hidden="true" />
                </Button>
                <ConfirmAction
                  trigger={
                    <Button size="icon" variant="ghost" aria-label={`${s.name}ni o‘chirish`} className="text-destructive hover:text-destructive">
                      <Trash aria-hidden="true" />
                    </Button>
                  }
                  title="Homiyni o‘chirasizmi?"
                  description={`«${s.name}» homiylar ro‘yxatidan o‘chiriladi. Vaqtincha yashirish uchun «Saytda ko‘rsatish»ni o‘chirib qo‘ying.`}
                  confirmLabel="Ha, o‘chirish"
                  onConfirm={() => runAction(() => remove.mutateAsync(s.id), "Homiy o‘chirildi")}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <SponsorDialog open={open} onOpenChange={setOpen} item={editing} />
    </div>
  )
}
