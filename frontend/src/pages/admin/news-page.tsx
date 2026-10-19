import { zodResolver } from "@hookform/resolvers/zod"
import { Megaphone, Newspaper, Pencil, Plus, Trash } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { api } from "@/api/client"
import { useAdminMutation, useNews } from "@/api/hooks"
import type { NewsInput } from "@/api/types"
import { AdminPageHeader, ConfirmAction, Field, runAction } from "@/components/admin/admin-ui"
import { EmptyState, ErrorState, ListSkeleton } from "@/components/league/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { News } from "@/domain/types"
import { formatDateTime } from "@/lib/format"

const schema = z.object({
  title: z.string().trim().min(5, "Sarlavha kamida 5 ta belgi").max(120, "Sarlavha juda uzun"),
  excerpt: z.string().trim().min(10, "Qisqa tavsif yozing (kamida 10 ta belgi)").max(240, "240 ta belgidan oshmasin"),
  body: z.string().trim().min(20, "Yangilik matnini yozing"),
  important: z.boolean(),
})
type Values = z.infer<typeof schema>

function NewsDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: News | null }) {
  const mutation = useAdminMutation((input: NewsInput) => api.saveNews(item?.id ?? null, input))
  const defaults = (): Values => ({ title: item?.title ?? "", excerpt: item?.excerpt ?? "", body: item?.body ?? "", important: item?.important ?? false })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults() })
  useEffect(() => {
    if (open) form.reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])
  const { errors } = form.formState

  const submit = (status: News["status"]) =>
    form.handleSubmit(async (v) => {
      const ok = await runAction(() => mutation.mutateAsync({ ...v, status }), status === "PUBLISHED" ? "Yangilik e’lon qilindi" : "Qoralama saqlandi")
      if (ok) onOpenChange(false)
    })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{item ? "Yangilikni tahrirlash" : "Yangi yangilik"}</DialogTitle>
          <DialogDescription>«Muhim e’lon» belgilansa, yangilik bosh sahifaning yuqorisida ko‘rinadi.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-4">
          <Field label="Sarlavha" htmlFor="n-title" error={errors.title?.message} required>
            <Input id="n-title" aria-invalid={Boolean(errors.title)} {...form.register("title")} />
          </Field>
          <Field label="Qisqa tavsif" htmlFor="n-excerpt" error={errors.excerpt?.message} hint="Ro‘yxatda sarlavha ostida ko‘rinadi" required>
            <Textarea id="n-excerpt" rows={2} {...form.register("excerpt")} />
          </Field>
          <Field label="Matn" htmlFor="n-body" error={errors.body?.message} hint="Xatboshilarni bo‘sh qator bilan ajrating" required>
            <Textarea id="n-body" rows={8} {...form.register("body")} />
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <Controller control={form.control} name="important" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
            Muhim e’lon
          </label>
        </form>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => submit("DRAFT")} disabled={mutation.isPending}>
            Qoralama sifatida saqlash
          </Button>
          <Button onClick={() => submit("PUBLISHED")} disabled={mutation.isPending}>
            {mutation.isPending ? "Saqlanmoqda…" : "E’lon qilish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminNewsPage() {
  const { data, isLoading, error, refetch } = useNews(true)
  const [editing, setEditing] = useState<News | null>(null)
  const [open, setOpen] = useState(false)
  const remove = useAdminMutation((id: string) => api.deleteNews(id))

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Yangiliklar"
        description="Liga yangiliklari va e’lonlari. Qoralamalar saytda ko‘rinmaydi."
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus aria-hidden="true" />
            Yangilik qo‘shish
          </Button>
        }
      />
      <section className="panel overflow-hidden">
        {isLoading ? (
          <ListSkeleton rows={4} />
        ) : error || !data ? (
          <ErrorState message={error?.message} onRetry={() => refetch()} />
        ) : data.length === 0 ? (
          <EmptyState icon={Newspaper} title="Birinchi yangilikni yozing" description="O‘yinlar jadvali, o‘zgarishlar va tadbirlar haqida muxlislarni xabardor qiling." />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-3 py-3 md:px-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {formatDateTime(n.publishedAt)}
                    {n.status === "DRAFT" && <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">Qoralama</span>}
                    {n.important && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 font-semibold text-gold-text">
                        <Megaphone className="size-3" aria-hidden="true" /> Muhim
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 font-semibold">{n.title}</p>
                  <p className="line-clamp-1 text-sm text-muted-foreground">{n.excerpt}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label="Tahrirlash" onClick={() => { setEditing(n); setOpen(true) }}>
                    <Pencil aria-hidden="true" />
                  </Button>
                  <ConfirmAction
                    trigger={
                      <Button size="icon" variant="ghost" aria-label="O‘chirish" className="text-destructive hover:text-destructive">
                        <Trash aria-hidden="true" />
                      </Button>
                    }
                    title="Yangilikni o‘chirasizmi?"
                    description={`«${n.title}» saytdan butunlay o‘chiriladi.`}
                    confirmLabel="Ha, o‘chirish"
                    onConfirm={() => runAction(() => remove.mutateAsync(n.id), "Yangilik o‘chirildi")}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <NewsDialog open={open} onOpenChange={setOpen} item={editing} />
    </div>
  )
}
