/** Grafik o'qi uchun «toza» juft eng katta qiymat (o'rtasi ham butun son): 7 → 8, 23 → 30, 140 → 200 */
export function niceMax(n: number) {
  if (n <= 4) return 4
  const step = 10 ** Math.floor(Math.log10(n))
  for (const k of [1, 2, 3, 4, 5, 6, 8, 10]) if (k * step >= n && (k * step) % 2 === 0) return k * step
  return 10 * step
}
