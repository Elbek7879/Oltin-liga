/**
 * Rasmni yuklashdan oldin brauzerda kichraytiradi va WebP formatiga o'tkazadi —
 * sayt tez ochiladi va server joyi tejaladi. Brauzer WebP ni qo'llamasa, PNG qaytariladi.
 */
export async function prepareImage(file: File, maxSize = 512): Promise<{ blob: Blob; name: string }> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error("Faqat PNG, JPG yoki WebP rasm tanlang.")
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("Rasm juda katta. 10 MB dan kichik rasm tanlang.")
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Rasmni qayta ishlab bo‘lmadi.")
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86))
  if (blob && blob.type === "image/webp") return { blob, name: "logo.webp" }
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!png) throw new Error("Rasmni qayta ishlab bo‘lmadi.")
  return { blob: png, name: "logo.png" }
}
