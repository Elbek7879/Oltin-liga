import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { api } from "@/api/client"
import { useMe } from "@/api/hooks"
import { AdminPageHeader, Field, runAction } from "@/components/admin/admin-ui"
import { PasswordInput } from "@/components/admin/password-input"
import { TelegramLink } from "@/components/admin/telegram-link"
import { Button } from "@/components/ui/button"
import { ROLE_LABELS, ROLE_RIGHTS } from "@/lib/roles"

export default function AccountPage() {
  const { data: me } = useMe()
  const username = me?.username ?? ""
  const schema = z
    .object({
      currentPassword: z.string().min(1, "Joriy parolni kiriting"),
      newPassword: z
        .string()
        .min(10, "Yangi parol kamida 10 ta belgidan iborat bo‘lsin")
        .max(128, "Parol juda uzun")
        .refine((p) => new Set(p).size >= 5, "Parol juda oddiy. Har xil harf va raqamlardan foydalaning")
        .refine((p) => !username || !p.toLowerCase().includes(username.toLowerCase()), "Parol ichida login bo‘lmasin"),
      repeat: z.string(),
    })
    .refine((v) => v.newPassword === v.repeat, { path: ["repeat"], message: "Parollar bir xil emas" })
    .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Yangi parol joriy paroldan farq qilishi kerak" })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", repeat: "" } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (v) => {
    const ok = await runAction(() => api.changeOwnPassword(v.currentPassword, v.newPassword).then(() => true), "Parol almashtirildi")
    if (ok) form.reset()
  })

  if (!me) return null
  return (
    <div className="mx-auto max-w-2xl">
      <AdminPageHeader title="Hisobim" description="Akkaunt ma’lumotlari, Telegram bot va parolni almashtirish" />
      <section className="panel mb-5 p-4 md:p-5" aria-labelledby="me-title">
        <h2 id="me-title" className="sr-only">
          Akkaunt
        </h2>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">Ism</dt>
          <dd className="font-semibold">{me.displayName}</dd>
          <dt className="text-muted-foreground">Login</dt>
          <dd className="font-mono">{me.username}</dd>
          <dt className="text-muted-foreground">Roli</dt>
          <dd>
            <span className="font-semibold">{ROLE_LABELS[me.role]}</span>
            <span className="block text-muted-foreground">{ROLE_RIGHTS[me.role]}</span>
          </dd>
        </dl>
      </section>

      <TelegramLink />

      <section className="panel p-4 md:p-5" aria-labelledby="pw-title">
        <h2 id="pw-title" className="section-title">
          Parolni almashtirish
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">Parolni hech kimga aytmang. Uni unutsangiz, bosh tashkilotchi yangi parol o‘rnatib beradi.</p>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 md:max-w-md">
          <Field label="Joriy parol" htmlFor="pw-current" error={errors.currentPassword?.message} required>
            <PasswordInput id="pw-current" autoComplete="current-password" aria-invalid={Boolean(errors.currentPassword)} {...form.register("currentPassword")} />
          </Field>
          <Field label="Yangi parol" htmlFor="pw-new" error={errors.newPassword?.message} hint="Kamida 10 belgi: harf va raqamlar aralash bo‘lsin" required>
            <PasswordInput id="pw-new" autoComplete="new-password" aria-invalid={Boolean(errors.newPassword)} {...form.register("newPassword")} />
          </Field>
          <Field label="Yangi parolni takrorlang" htmlFor="pw-repeat" error={errors.repeat?.message} required>
            <PasswordInput id="pw-repeat" autoComplete="new-password" aria-invalid={Boolean(errors.repeat)} {...form.register("repeat")} />
          </Field>
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:justify-self-start">
            <KeyRound aria-hidden="true" />
            {isSubmitting ? "Saqlanmoqda…" : "Parolni almashtirish"}
          </Button>
        </form>
      </section>
    </div>
  )
}
