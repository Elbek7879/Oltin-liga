// Sahifa chizilishidan oldin tanlangan mavzuni (yorug'/qorong'i) qo'llaydi — ekran "miltillamaydi"
try {
  var t = localStorage.getItem("pol-theme")
  if (t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches)) document.documentElement.classList.add("dark")
} catch (e) {}
