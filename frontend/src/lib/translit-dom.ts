import { toCyrillic } from "./translit"

/**
 * Kirill rejimi: sahifadagi barcha matn va yorliqlar (placeholder, aria-label, title, alt) ekranda kirillchaga o'giriladi.
 * React yangilagan matn ham darhol o'giriladi (MutationObserver). Kiritish maydonlaridagi qiymatlar, kod va
 * data-translit="off" belgilangan joylar o'zgarmaydi. Lotinchaga qaytilganda asl matn joyiga qo'yiladi.
 */

const ATTRS = ["placeholder", "aria-label", "title", "alt"]
const SKIP = "textarea, [contenteditable=''], [contenteditable='true'], code, pre, kbd, script, style, noscript, [data-translit='off']"
const LATIN = /[A-Za-z]/

const originalText = new WeakMap<Text, string>()
const originalAttrs = new WeakMap<Element, Map<string, string>>()
let observer: MutationObserver | null = null

function convertText(node: Text) {
  const parent = node.parentElement
  if (!parent || parent.closest(SKIP)) return
  const value = node.nodeValue ?? ""
  if (!LATIN.test(value)) return
  const next = toCyrillic(value)
  if (next === value) return
  originalText.set(node, value)
  node.nodeValue = next
}

function convertAttrs(el: Element) {
  if (el.closest("[data-translit='off']")) return
  for (const name of ATTRS) {
    const value = el.getAttribute(name)
    if (!value || !LATIN.test(value)) continue
    const next = toCyrillic(value)
    if (next === value) continue
    let saved = originalAttrs.get(el)
    if (!saved) originalAttrs.set(el, (saved = new Map()))
    saved.set(name, value)
    el.setAttribute(name, next)
  }
}

function convertTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return convertText(root as Text)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  convertAttrs(root as Element)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) convertText(n as Text)
    else convertAttrs(n as Element)
  }
}

function restoreTree(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n: Node | null = root; n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = n as Text
      const original = originalText.get(text)
      // Faqat biz o'girgan holatda turgan bo'lsa qaytariladi (React keyin yangilagan matnga tegilmaydi)
      if (original !== undefined && text.nodeValue === toCyrillic(original)) text.nodeValue = original
      originalText.delete(text)
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element
      const saved = originalAttrs.get(el)
      if (saved) {
        for (const [name, original] of saved) if (el.getAttribute(name) === toCyrillic(original)) el.setAttribute(name, original)
        originalAttrs.delete(el)
      }
    }
  }
}

export function enableCyrillic() {
  if (observer || typeof document === "undefined") return
  document.documentElement.lang = "uz-Cyrl"
  convertTree(document.documentElement)
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") convertText(m.target as Text)
      else if (m.type === "attributes") convertAttrs(m.target as Element)
      else m.addedNodes.forEach(convertTree)
    }
  })
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS })
}

export function disableCyrillic() {
  if (!observer) return
  observer.disconnect()
  observer = null
  document.documentElement.lang = "uz"
  restoreTree(document.documentElement)
}
