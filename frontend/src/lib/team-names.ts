/**
 * Jamoa va futbolchi nomlarini taqqoslash (serverdagi TeamNames bilan bir xil qoida): «Qo'rg'on», «qo‘rg‘on» va
 * «Qo‘rg‘on » bitta nom — katta-kichik harf, o‘/g‘ tutuq belgisining turli yozilishi va ortiqcha bo'shliqlar farq qilmaydi.
 */
export const cleanName = (s: string) => s.trim().replace(/\s+/g, " ")

export const nameKey = (s: string) => cleanName(s).toLowerCase().replace(/[‘’ʻʼ`´]/g, "'")

export const sameName = (a: string, b: string) => nameKey(a) === nameKey(b)
