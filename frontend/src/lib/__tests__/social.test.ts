import { describe, expect, it } from "vitest"
import { normalizeSocial } from "../social"

describe("ijtimoiy tarmoq havolalari (backenddagi SocialLinks bilan bir xil)", () => {
  it("istalgan ko‘rinishdagi havola to‘liq havolaga keltiriladi", () => {
    expect(normalizeSocial("telegramChannel", "t.me/Oltinliga12")).toBe("https://t.me/Oltinliga12")
    expect(normalizeSocial("telegramChannel", "@Oltinliga12")).toBe("https://t.me/Oltinliga12")
    expect(normalizeSocial("instagram", "oltin.liga12")).toBe("https://www.instagram.com/oltin.liga12/")
    expect(normalizeSocial("youtube", "https://www.youtube.com/@Sanjar192")).toBe("https://www.youtube.com/@Sanjar192")
    expect(normalizeSocial("youtube", "")).toBe("")
  })

  it("boshqa saytga havola qabul qilinmaydi", () => {
    expect(() => normalizeSocial("telegramChannel", "https://evil.example/x1234")).toThrow("t.me/kanal_nomi")
    expect(() => normalizeSocial("instagram", "javascript:alert(1)")).toThrow()
    expect(() => normalizeSocial("youtube", "https://youtube.com.evil.example/@x")).toThrow()
  })
})
