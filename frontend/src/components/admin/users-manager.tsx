import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Copy, KeyRound, Pencil, UserPlus, UsersRound } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { api } from "@/api/client"
import { useAdminMutation, useMe, useUsers } from "@/api/hooks"
import type { AdminRole, UserAccount } from "@/api/types"
import { Field, runAction } from "@/components/admin/admin-ui"
import { PasswordInput } from "@/components/admin/password-input"
import { EmptyState, ListSkeleton } from "@/components/league/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { formatDateTime } from "@/lib/format"
import { ROLE_LABELS, ROLE_ORDER, ROLE_RIGHTS } from "@/lib/roles"
import { cn } from "@/lib/utils"

/** Server bilan bir xil parol qoidalari — xato darhol formada ko'rinadi */
const passwordRules = z
  .string()
  .min(10, "Parol kamida 10 ta belgidan iborat bo‘lsin")
  .max(128, "Parol juda uzun")
  .refine((p) => new Set(p).size >= 5, "Parol juda oddiy. Har xil harf va raqamlardan foydalaning")
const LOGIN_IN_PASSWORD = "Parol ichida login bo‘lmasin"
const containsLogin = (password: string, login: string) => Boolean(login) && password.toLowerCase().includes(login.trim().toLowerCase())

const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "RESULT_ENTRY", "EDITOR"])
const displayNameRules = z.string().trim().min(2, "Ism-familiyasini kiriting").max(80, "Ism 80 belgidan oshmasin")

const createSchema = z
  .object({
    displayName: displayNameRules,
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9._-]{3,40}$/, "Login 3–40 ta lotin harfi, raqam yoki . _ - belgilaridan iborat bo‘lsin"),
    role: roleSchema,
    password: passwordRules,
  })
  .refine((v) => !containsLogin(v.password, v.username), { path: ["password"], message: LOGIN_IN_PASSWORD })
type CreateValues = z.infer<typeof createSchema>

const editSchema = z.object({ displayName: displayNameRules, role: roleSchema, enabled: z.boolean() })
type EditValues = z.infer<typeof editSchema>

function RoleSelect({ id, value, onChange, disabled }: { id: string; value: AdminRole; onChange: (r: AdminRole) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AdminRole)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLE_ORDER.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Yaratilgan login va parolni yordamchiga uzatish uchun nusxalash */
function Credentials({ username, password: secret }: { username: string; password: string }) {
  const [copied, setCopied] = useState(false)
  const text = `Payariq Oltin Ligasi boshqaruv paneli\nLogin: ${username}\nParol: ${secret}`
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[5rem_1fr] gap-y-1 rounded-xl bg-muted p-4 text-sm">
        <dt className="text-muted-foreground">Login</dt>
        {/* Login va parol kirill rejimida ham aynan shunday ko'rsatiladi (o'girilsa, noto'g'ri aytib beriladi) */}
        <dd data-translit="off" className="font-mono font-semibold break-all">{username}</dd>
        <dt className="text-muted-foreground">Parol</dt>
        <dd data-translit="off" className="font-mono font-semibold break-all">{secret}</dd>
      </dl>
      <p className="text-sm text-muted-foreground">Bu ma’lumotlarni yordamchiga shaxsan yoki shaxsiy xabarda yuboring. Oyna yopilgach parol qayta ko‘rsatilmaydi.</p>
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
          } catch {
            setCopied(false)
          }
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Nusxalandi" : "Login va parolni nusxalash"}
      </Button>
    </div>
  )
}

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null)
  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { displayName: "", username: "", role: "RESULT_ENTRY", password: "" } })
  const mutation = useAdminMutation((v: CreateValues) => api.createUser(v))
  const { errors } = form.formState
  const role = form.watch("role")

  useEffect(() => {
    if (open) {
      form.reset()
      setCreated(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit(async (values) => {
    const user = await runAction(() => mutation.mutateAsync(values), `${values.displayName.trim()} qo‘shildi`)
    if (user) setCreated({ username: user.username, password: values.password })
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{created ? "Akkaunt tayyor" : "Yordamchi qo‘shish"}</DialogTitle>
          <DialogDescription>
            {created ? "Yordamchi shu login va parol bilan boshqaruv paneliga kiradi." : "Har bir yordamchi o‘z logini bilan kiradi va faqat roliga mos bo‘limlarni ko‘radi."}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <Credentials username={created.username} password={created.password} />
        ) : (
          <form id="user-form" onSubmit={onSubmit} noValidate className="grid gap-4">
            <Field label="Ism-familiyasi" htmlFor="u-name" error={errors.displayName?.message} required>
              <Input id="u-name" autoComplete="off" placeholder="Akmal Karimov" aria-invalid={Boolean(errors.displayName)} {...form.register("displayName")} />
            </Field>
            <Field label="Login" htmlFor="u-login" error={errors.username?.message} hint="Lotin harflarida, masalan akmal" required>
              <Input
                id="u-login"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="akmal"
                aria-invalid={Boolean(errors.username)}
                {...form.register("username")}
              />
            </Field>
            <Field label="Roli" htmlFor="u-role" hint={ROLE_RIGHTS[role]}>
              <Controller control={form.control} name="role" render={({ field }) => <RoleSelect id="u-role" value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Parol" htmlFor="u-password" error={errors.password?.message} hint="Kamida 10 belgi. «Yaratish» tugmasi kuchli parol taklif qiladi." required>
              <PasswordInput
                id="u-password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                {...form.register("password")}
                onGenerate={(p) => form.setValue("password", p, { shouldValidate: true })}
              />
            </Field>
          </form>
        )}
        <DialogFooter>
          {created ? (
            <Button onClick={() => onOpenChange(false)}>Tayyor</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Bekor qilish
              </Button>
              <Button type="submit" form="user-form" disabled={mutation.isPending}>
                {mutation.isPending ? "Qo‘shilmoqda…" : "Yordamchini qo‘shish"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({ user, self, onOpenChange }: { user: UserAccount | null; self: boolean; onOpenChange: (v: boolean) => void }) {
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { displayName: user?.displayName ?? "", role: user?.role ?? "ADMIN", enabled: user?.enabled ?? true },
  })
  const mutation = useAdminMutation((v: EditValues) => api.updateUser(user!.id, v))
  const { errors } = form.formState
  const role = form.watch("role")

  useEffect(() => {
    if (user) form.reset({ displayName: user.displayName, role: user.role, enabled: user.enabled })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const onSubmit = form.handleSubmit(async (values) => {
    const ok = await runAction(() => mutation.mutateAsync(values), "Foydalanuvchi ma’lumotlari saqlandi")
    if (ok) onOpenChange(false)
  })

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Foydalanuvchini tahrirlash</DialogTitle>
          <DialogDescription>Login: {user?.username}</DialogDescription>
        </DialogHeader>
        <form id="user-edit-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field label="Ism-familiyasi" htmlFor="ue-name" error={errors.displayName?.message} required>
            <Input id="ue-name" autoComplete="off" aria-invalid={Boolean(errors.displayName)} {...form.register("displayName")} />
          </Field>
          <Field label="Roli" htmlFor="ue-role" hint={self ? "O‘z rolingizni o‘zgartira olmaysiz." : ROLE_RIGHTS[role]}>
            <Controller control={form.control} name="role" render={({ field }) => <RoleSelect id="ue-role" value={field.value} onChange={field.onChange} disabled={self} />} />
          </Field>
          <Controller
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <label className={cn("flex min-h-11 items-start gap-3 text-sm", self ? "opacity-60" : "cursor-pointer")}>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={self} className="mt-0.5" />
                <span>
                  <span className="block font-semibold">Akkaunt faol</span>
                  <span className="block text-muted-foreground">
                    {self ? "O‘z akkauntingizni o‘chira olmaysiz." : "O‘chirilsa, yordamchi tizimdan darhol chiqariladi va qayta kira olmaydi."}
                  </span>
                </span>
              </label>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="submit" form="user-edit-form" disabled={mutation.isPending}>
            {mutation.isPending ? "Saqlanmoqda…" : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onOpenChange }: { user: UserAccount | null; onOpenChange: (v: boolean) => void }) {
  const [done, setDone] = useState<string | null>(null)
  const schema = z.object({ password: passwordRules.refine((p) => !containsLogin(p, user?.username ?? ""), LOGIN_IN_PASSWORD) })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "" } })
  const mutation = useAdminMutation((v: Values) => api.resetUserPassword(user!.id, v.password))
  const { errors } = form.formState

  useEffect(() => {
    form.reset({ password: "" })
    setDone(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const onSubmit = form.handleSubmit(async (values) => {
    const ok = await runAction(() => mutation.mutateAsync(values).then(() => true), "Yangi parol o‘rnatildi")
    if (ok) setDone(values.password)
  })

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{done ? "Parol almashtirildi" : "Yangi parol berish"}</DialogTitle>
          <DialogDescription>
            {done ? `${user?.displayName} endi faqat yangi parol bilan kira oladi.` : `${user?.displayName} parolini unutgan bo‘lsa, unga yangi parol o‘rnating.`}
          </DialogDescription>
        </DialogHeader>
        {done && user ? (
          <Credentials username={user.username} password={done} />
        ) : (
          <form id="user-password-form" onSubmit={onSubmit} noValidate>
            <Field label="Yangi parol" htmlFor="up-password" error={errors.password?.message} hint="Kamida 10 belgi" required>
              <PasswordInput
                id="up-password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                {...form.register("password")}
                onGenerate={(p) => form.setValue("password", p, { shouldValidate: true })}
              />
            </Field>
          </form>
        )}
        <DialogFooter>
          {done ? (
            <Button onClick={() => onOpenChange(false)}>Tayyor</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Bekor qilish
              </Button>
              <Button type="submit" form="user-password-form" disabled={mutation.isPending}>
                {mutation.isPending ? "Saqlanmoqda…" : "Parolni o‘rnatish"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")

export function UsersManager() {
  const { data, isLoading } = useUsers()
  const { data: me } = useMe()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UserAccount | null>(null)
  const [resetting, setResetting] = useState<UserAccount | null>(null)

  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden" aria-labelledby="users-title">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center md:p-5">
          <div className="min-w-0 flex-1">
            <h2 id="users-title" className="section-title">
              Tashkilotchi va yordamchilar
            </h2>
            <p className="text-sm text-muted-foreground">Har bir yordamchi o‘z logini bilan kiradi. Tarixda kim nima o‘zgartirgani ko‘rinadi.</p>
          </div>
          <Button onClick={() => setCreating(true)} className="w-full sm:w-auto">
            <UserPlus aria-hidden="true" />
            Yordamchi qo‘shish
          </Button>
        </div>
        {isLoading || !data ? (
          <ListSkeleton rows={3} />
        ) : data.length === 0 ? (
          <EmptyState icon={UsersRound} title="Foydalanuvchilar yo‘q" />
        ) : (
          <ul className="divide-y divide-border">
            {data.map((u) => {
              const self = u.username.toLowerCase() === me?.username.toLowerCase()
              return (
                <li key={u.id} className={cn("flex items-center gap-3 px-4 py-3 md:px-5", !u.enabled && "bg-muted/50")}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full font-display text-sm",
                      u.enabled ? "bg-primary text-primary-foreground dark:bg-gold-500 dark:text-pitch-950" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {initials(u.displayName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={cn("truncate font-semibold", !u.enabled && "text-muted-foreground line-through")}>{u.displayName}</span>
                      {self && <span className="rounded bg-gold-soft px-1.5 py-0.5 text-2xs font-semibold">Siz</span>}
                      {!u.enabled && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-2xs font-semibold text-destructive">O‘chirilgan</span>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {ROLE_LABELS[u.role]}, login: <span data-translit="off" className="font-mono">{u.username}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{u.lastLoginAt ? `Oxirgi kirish: ${formatDateTime(u.lastLoginAt)}` : "Hali kirmagan"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" aria-label={`${u.displayName}: yangi parol berish`} onClick={() => setResetting(u)} title="Yangi parol berish">
                      <KeyRound aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`${u.displayName}ni tahrirlash`} onClick={() => setEditing(u)} title="Tahrirlash">
                      <Pencil aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="panel p-4 md:p-5" aria-labelledby="roles-title">
        <h2 id="roles-title" className="section-title mb-2">
          Rollar va huquqlar
        </h2>
        <dl className="divide-y divide-border text-sm">
          {ROLE_ORDER.map((r) => (
            <div key={r} className="grid gap-0.5 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="font-semibold">{ROLE_LABELS[r]}</dt>
              <dd className="text-muted-foreground">{ROLE_RIGHTS[r]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <CreateUserDialog open={creating} onOpenChange={setCreating} />
      <EditUserDialog user={editing} self={Boolean(editing && editing.username.toLowerCase() === me?.username.toLowerCase())} onOpenChange={(v) => !v && setEditing(null)} />
      <ResetPasswordDialog user={resetting} onOpenChange={(v) => !v && setResetting(null)} />
    </div>
  )
}
