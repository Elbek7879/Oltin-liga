import type { AdminRole } from "@/api/types"

/**
 * Rollar va ular ochadigan bo'limlar. Haqiqiy himoya serverda (SecurityConfig);
 * bu yerda faqat foydalanuvchiga keraksiz bo'limlar ko'rsatilmaydi.
 */
export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Bosh tashkilotchi",
  ADMIN: "Administrator",
  RESULT_ENTRY: "Natija kirituvchi",
  EDITOR: "Muharrir",
}

export const ROLE_RIGHTS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Hamma bo‘limlar, mavsumni yakunlash, liga ma’lumotlari va foydalanuvchilar",
  ADMIN: "Jamoalar, futbolchilar, qur’a, o‘yinlar, natijalar, yangiliklar va homiylar",
  RESULT_ENTRY: "Faqat o‘yin natijalarini kiritadi, qolganini ko‘radi",
  EDITOR: "Yangiliklar va homiylarni yuritadi",
}

export const ROLE_ORDER: AdminRole[] = ["SUPER_ADMIN", "ADMIN", "RESULT_ENTRY", "EDITOR"]

const SECTIONS: Record<AdminRole, string[] | "all"> = {
  SUPER_ADMIN: "all",
  ADMIN: "all",
  RESULT_ENTRY: ["/admin/natijalar", "/admin/hisobotlar"],
  EDITOR: ["/admin/yangiliklar", "/admin/homiylar"],
}

/** Panel va «Hisobim» sahifasi hammaga ochiq */
const ALWAYS = ["/admin/hisobim"]

export function canOpen(role: AdminRole, path: string) {
  if (path === "/admin" || path === "/admin/") return true
  if (ALWAYS.some((p) => path.startsWith(p))) return true
  const allowed = SECTIONS[role]
  return allowed === "all" || allowed.some((p) => path === p || path.startsWith(`${p}/`))
}

export const isSuperAdmin = (role: AdminRole | undefined) => role === "SUPER_ADMIN"
/** Musobaqa ma'lumotlarini (jamoa, o'yin, guruh) o'zgartira oladiganlar */
export const canManageCompetition = (role: AdminRole | undefined) => role === "SUPER_ADMIN" || role === "ADMIN"
export const canEnterResults = (role: AdminRole | undefined) => canManageCompetition(role) || role === "RESULT_ENTRY"
