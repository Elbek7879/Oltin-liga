import { describe, expect, it } from "vitest"
import { generatePassword } from "@/components/admin/password-input"
import { canEnterResults, canManageCompetition, canOpen, isSuperAdmin } from "../roles"

describe("rollar: qaysi bo‘lim kimga ochiq (SecurityConfig bilan bir xil)", () => {
  it("panel va «Hisobim» hammaga ochiq", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "RESULT_ENTRY", "EDITOR"] as const) {
      expect(canOpen(role, "/admin")).toBe(true)
      expect(canOpen(role, "/admin/hisobim")).toBe(true)
    }
  })

  it("natija kirituvchi faqat natijalar va hisobotlarni ochadi", () => {
    expect(canOpen("RESULT_ENTRY", "/admin/natijalar")).toBe(true)
    expect(canOpen("RESULT_ENTRY", "/admin/natijalar/m-1")).toBe(true)
    expect(canOpen("RESULT_ENTRY", "/admin/hisobotlar")).toBe(true)
    expect(canOpen("RESULT_ENTRY", "/admin/jamoalar")).toBe(false)
    expect(canOpen("RESULT_ENTRY", "/admin/sozlamalar")).toBe(false)
    // Prefiks o'xshashligi bo'lim ochmaydi
    expect(canOpen("RESULT_ENTRY", "/admin/natijalarx")).toBe(false)
  })

  it("muharrir faqat yangiliklar va homiylarni ochadi", () => {
    expect(canOpen("EDITOR", "/admin/yangiliklar")).toBe(true)
    expect(canOpen("EDITOR", "/admin/homiylar")).toBe(true)
    expect(canOpen("EDITOR", "/admin/natijalar")).toBe(false)
  })

  it("amallar huquqi", () => {
    expect(canManageCompetition("ADMIN")).toBe(true)
    expect(canManageCompetition("RESULT_ENTRY")).toBe(false)
    expect(canEnterResults("RESULT_ENTRY")).toBe(true)
    expect(canEnterResults("EDITOR")).toBe(false)
    expect(isSuperAdmin("ADMIN")).toBe(false)
    expect(isSuperAdmin(undefined)).toBe(false)
  })
})

describe("parol yaratish", () => {
  it("server talablariga mos: 14 belgi, kamida 5 xil belgi, chalkash belgilarsiz", () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword()
      expect(p).toMatch(/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/)
      expect(p).not.toMatch(/[01OIl]/)
      expect(new Set(p).size).toBeGreaterThanOrEqual(5)
    }
  })
})
