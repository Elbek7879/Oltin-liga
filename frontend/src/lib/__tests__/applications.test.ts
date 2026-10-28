import { describe, expect, it } from "vitest"
import type { ApplicationPlayer, TeamApplicationInput } from "@/api/types"
import type { Season } from "@/domain/types"
import { canOpen } from "../roles"
import { feedbackProblem, shortNameOf, TEAM_SIZE, teamApplicationProblem, upcomingSeason } from "../applications"
import { nameKey, sameName } from "../team-names"

const squad = (): ApplicationPlayer[] =>
  Array.from({ length: TEAM_SIZE }, (_, i) => ({ firstName: `O‘yinchi${String.fromCharCode(65 + i)}`, lastName: "Karimov", birthYear: null, position: i === 0 ? "GK" : "FW" }))

const application = (patch: Partial<TeamApplicationInput> = {}): TeamApplicationInput => ({ teamName: "Burgut", village: "", contactPhone: "", players: squad(), ...patch })

describe("jamoa arizasi", () => {
  it("to‘g‘ri ariza o‘tadi; telefon va tug‘ilgan yil ixtiyoriy", () => {
    expect(teamApplicationProblem(application())).toBeNull()
    expect(teamApplicationProblem(application({ contactPhone: "+998 90 123 45 67" }))).toBeNull()
  })

  it("aynan 10 ta futbolchi, pozitsiya va kamida bitta darvozabon talab qilinadi", () => {
    expect(teamApplicationProblem(application({ players: squad().slice(0, 9) }))).toContain("10 ta futbolchi")
    const noKeeper = squad().map((p) => ({ ...p, position: "DF" as const }))
    expect(teamApplicationProblem(application({ players: noKeeper }))).toContain("darvozabon")
    const noPosition = squad()
    noPosition[3] = { ...noPosition[3], position: "" as never }
    expect(teamApplicationProblem(application({ players: noPosition }))).toBe("4-futbolchi: pozitsiyasini tanlang.")
  })

  it("bir xil futbolchi ikki marta yozilmaydi (katta-kichik harf va tutuq belgisi farq qilmaydi)", () => {
    const twice = squad()
    twice[9] = { ...twice[9], firstName: "o'yinchia", lastName: "KARIMOV" }
    expect(teamApplicationProblem(application({ players: twice }))).toContain("10-futbolchi")
  })

  it("noto‘g‘ri nom, yil va telefon rad etiladi", () => {
    expect(teamApplicationProblem(application({ teamName: " B " }))).toContain("Jamoa nomini")
    const year = squad()
    year[1] = { ...year[1], birthYear: 1890 }
    expect(teamApplicationProblem(application({ players: year }))).toContain("2-futbolchi: tug‘ilgan yil")
    expect(teamApplicationProblem(application({ contactPhone: "qo‘ng‘iroq qiling" }))).toContain("Telefon")
  })
})

describe("taklif va shikoyat", () => {
  it("turi va kamida 10 belgili matn kerak", () => {
    expect(feedbackProblem({ kind: "SUGGESTION", body: "Final kechqurun bo‘lsin", authorName: "", phone: "" })).toBeNull()
    expect(feedbackProblem({ kind: "COMPLAINT", body: "Qisqa", authorName: "", phone: "" })).toContain("kamida 10")
    expect(feedbackProblem({ kind: "" as never, body: "Turi tanlanmagan murojaat", authorName: "", phone: "" })).toContain("turini")
  })
})

describe("jamoa nomlari", () => {
  it("bir xil nom: katta-kichik harf, o‘/g‘ belgisi va bo‘shliqlar farq qilmaydi", () => {
    expect(sameName("Qo‘rg‘on", "  qo'rg'on ")).toBe(true)
    expect(sameName("Qo’rg’on  Yoshlari", "QOʻRGʻON yoshlari")).toBe(true)
    expect(sameName("Burgut", "Burgut-2")).toBe(false)
    expect(nameKey("  Oltin   Soy ")).toBe("oltin soy")
  })

  it("qisqa nom — dastlabki 3 harf (server bilan bir xil)", () => {
    expect(shortNameOf("Burgut")).toBe("BUR")
    expect(shortNameOf("Qo‘rg‘on")).toBe("QOR")
    expect(shortNameOf("FK 7")).toBe("FK")
    expect(shortNameOf("77")).toBe("JAM")
  })
})

describe("ariza qabul qilinadigan mavsum", () => {
  const season = (id: string, number: number, year: number, status: Season["status"], test = false) =>
    ({ id, number, year, status, test, name: `${number}-mavsum`, startDate: "", endDate: "", rules: {} }) as unknown as Season

  it("eng so‘nggi tayyorlanayotgan haqiqiy mavsum; boshlangan, yakunlangan va sinov mavsumi emas", () => {
    expect(upcomingSeason([season("a", 1, 2025, "FINISHED"), season("b", 2, 2026, "ACTIVE")])).toBeUndefined()
    expect(upcomingSeason([season("b", 2, 2026, "ACTIVE"), season("c", 3, 2027, "DRAFT"), season("t", -1, 2027, "DRAFT", true)])?.id).toBe("c")
    expect(upcomingSeason([season("c", 3, 2027, "DRAFT"), season("d", 4, 2027, "DRAFT")])?.id).toBe("d")
  })
})

describe("«Arizalar» bo‘limi", () => {
  it("faqat bosh tashkilotchi va administratorga ochiq (telefon raqamlari bor)", () => {
    expect(canOpen("SUPER_ADMIN", "/admin/arizalar")).toBe(true)
    expect(canOpen("ADMIN", "/admin/arizalar")).toBe(true)
    expect(canOpen("RESULT_ENTRY", "/admin/arizalar")).toBe(false)
    expect(canOpen("EDITOR", "/admin/arizalar")).toBe(false)
  })
})
