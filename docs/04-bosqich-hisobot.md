# 4-bosqich hisoboti: Integratsiya

Sana: 2026-10-15
Holat: **bajarildi, tasdiq kutilmoqda.** Keyingi qadam — 5-bosqich (yakuniy tekshiruv).

Sayt endi haqiqiy backend va PostgreSQL bazasi bilan ishlaydi:
- barcha ma'lumotlar bazada saqlanadi va server qayta ishga tushganda yo'qolmaydi;
- admin kirishi haqiqiy login va parol bilan.

---

## 1. Nimalar qilindi

### Frontend backendga ulandi
- **HTTP API klienti** (`src/api/http/httpApi.ts`) — `LeagueApi` interfeysini to'liq amalga oshiradi:
  - sessiya cookie va CSRF tokeni avtomatik yuboriladi;
  - xato xabarlari serverdan o'zbek tilida keladi;
  - internet uzilsa — tushunarli xabar chiqadi.
- **Sessiya tugasa** (401), admin paneli o'zi kirish sahifasiga qaytaradi.
- **Vite proksi:** `/api` va `/media` so'rovlari backendga yo'naltiriladi — sayt va API bitta manzilda ishlaydi.
- **Namunaviy rejim** (`npm run dev:mock`) dizayn ishlari uchun saqlab qolindi. Production build'ga u umuman kirmaydi — asosiy JS hajmi 145 KB dan **89,5 KB** ga (gzip) tushdi.
- Namunaviy rejimga oid barcha yozuvlar (banner, "istalgan login", "tiklash" tugmasi) haqiqiy rejimda ko'rinmaydi.

### Yangi imkoniyatlar (backend tayyor edi, endi interfeysi ham bor)
- **Jamoa va homiy logotipini yuklash.**
  - Rasm yuklashdan oldin brauzerda 512 px gacha kichraytiriladi va WebP formatiga o'tkaziladi.
  - Server fayl turini mazmunidan tekshiradi va tasodifiy nom beradi.
  - Logotip yuklangan jamoada avtomatik nishon o'rniga rasm ko'rinadi.
- **Maydonlar boshqaruvi:** Sozlamalar → «Maydonlar» bo'limi (qo'shish, tahrirlash, o'chirish). O'yinida foydalanilgan maydonni o'chirib bo'lmaydi.
- **Bo'sh baza holati.** Yangi o'rnatilgan saytda:
  - muxlislar "Birinchi mavsum tez orada boshlanadi" xabarini ko'radi;
  - admin "Birinchi mavsumni yarating" yo'riqnomasini ko'radi.
- **Yuklanish ekrani:** sahifa birinchi ochilganda bo'sh ekran o'rniga yuklanish belgisi chiqadi.

### Backenddagi o'zgarishlar
- Jamoaga logotip manzili qo'shildi. Faqat o'zimiz yuklagan rasmlar qabul qilinadi.
- **«e2e» profili:** brauzer testlari uchun backend alohida portda va alohida test bazasida ishga tushadi, har gal toza holatdan boshlanadi. Asosiy bazaga tegmaydi.

## 2. Qo'shilgan va o'zgargan fayllar
- `frontend/src/api/http/httpApi.ts` — haqiqiy API klienti.
- `frontend/src/api/client.ts` — rejim tanlash.
- `frontend/vite.config.ts` — proksi.
- `frontend/src/components/admin/logo-upload.tsx`, `src/lib/image.ts` — logotip yuklash va rasmni siqish.
- `frontend/src/pages/admin/settings-page.tsx` — «Maydonlar» bo'limi.
- `teams-page.tsx`, `sponsors-page.tsx` (admin va ommaviy), `team-crest.tsx` — logotiplar.
- `public-layout.tsx`, `admin-layout.tsx`, `seasons-page.tsx` — bo'sh baza holatlari.
- `frontend/playwright.config.ts`, `playwright.flow.config.ts`, `e2e/full-season.flow.ts`, `e2e/helpers.ts` — haqiqiy backend bilan testlar.
- `backend/src/main/resources/application-e2e.properties`, `config/E2eDatabaseReset.java` — test profili.
- `README.md` — ishga tushirish va testlar yo'riqnomasi.

## 3. Ishlayotgan funksiyalar (haqiqiy backend bilan tekshirildi)

**To'liq jarayon — bo'sh bazadan, faqat brauzer orqali** (`npm run e2e:flow`, ketma-ket 3 marta o'tdi):
1. Bo'sh saytda muxlisga tushunarli xabar chiqadi.
2. Admin kiradi → "Birinchi mavsumni yarating" → mavsum ochiladi va boshlanadi.
3. Maydon qo'shiladi; 4 ta jamoa qo'shiladi (biriga logotip).
4. Qur'a tashlanadi va tasdiqlanadi.
5. Taqvim avtomatik tuziladi (6 ta o'yin).
6. 6 ta natija kiritiladi → turnir jadvali avtomatik hisoblanadi (4 jamoa, jami 18 ochko).
7. Pley-off sxemasi yaratiladi → final natijasi kiritiladi.
8. Mavsum yakunlanadi → chempion «Chempionlar tarixi» sahifasida ko'rinadi, bosh sahifada mavsum finali chiqadi.

**Namunaviy ma'lumotli sayt** (`npm run e2e`, 14/14):
- Ommaviy sahifalar 375, 768 va 1440 px kengliklarda gorizontal scroll'siz va konsol xatolarisiz ochiladi.
- Natija kiritilganda jadval yangilanadi. Natija tahrirlanganda ochkolar qayta hisoblanadi va ikki marta qo'shilmaydi.
- Noto'g'ri natija saqlanmaydi va sababi ko'rsatiladi.
- Jamoa logotip bilan qo'shiladi va ro'yxatda logotip rasm sifatida ko'rinadi.
- Maydon qo'shiladi va o'yin belgilash oynasida tanlash mumkin.
- Loginsiz admin paneliga kirib bo'lmaydi.
- Telefonda admin paneli pastki menyu bilan ishlaydi.

## 4. Hali tugallanmagan
- **Foydalanuvchilar:** yordamchi foydalanuvchilarni panel orqali qo'shish va parolni almashtirish yo'q.
- **Qur'a bilan o'rin aniqlash:** jamoalar barcha mezonlarda teng bo'lsa (to'liq jarayon testida uch jamoa shunday tenglashdi), o'rin qur'a bilan aniqlanishi kerak. Hozir bunday jamoalar alifbo tartibida, «*» belgisi va izoh bilan ko'rsatiladi; qur'a natijasini admin panelda kiritish imkoniyati hali yo'q.
- **Server:** production uchun bitta serverda ishga tushirish (frontendni backend yoki nginx orqali berish, HTTPS) — 5-bosqichda.
- **Zaxira nusxa:** bazaning avtomatik zaxira nusxasi — 5-bosqichda.
- **Keyingi versiyaga:**
  - Telegram xabarlari;
  - PDF eksport;
  - savatlar bo'yicha qur'a;
  - diskvalifikatsiya.
- **Accessibility:** avtomatik audit (axe) o'tkazilmagan — 5-bosqichda rejalashtirilgan.

## 5. Topilgan va tuzatilgan xatolar
1. **Band port.** E2e backend uchun tanlangan 8081-port kompyuteringizdagi boshqa dastur (iVMS-4200 kamera tizimi) tomonidan band edi. Unga tegilmadi — testlar 18081/18082-portlarga o'tkazildi.
2. **Bo'sh baza holati.** Admin panel cheksiz yuklanish holatida qolar, ommaviy sayt esa xato ko'rsatardi → ikkalasiga ham tushunarli yo'riqnoma qo'shildi.
3. **Yuklanish ekrani.** Sahifa birinchi ochilganda React Router ogohlantirish berardi → yuklanish ekrani qo'shildi.
4. **Test tanlovchilari.** "Qishloq" yorlig'i "Oqtepa qishloq maydoni" tugmalariga ham mos tushardi; to'liq jarayon testida chempion "Fair Play" qatorida ham ko'rinardi → tanlovchilar aniqlashtirildi.
5. **Skrinshot vaqti.** Jamoalar skrinshoti dialog yopilayotganda olinardi → dialog yopilishi kutiladigan qilindi.

## 6. Testlar

| Test | Natija |
|---|---|
| Backend: unit va integratsion (haqiqiy PostgreSQL) | **39/39** |
| Frontend: Vitest (liga qoidalari) | **32/32** |
| Playwright (haqiqiy backend, namunaviy ma'lumotlar): funksional testlar va skrinshotlar | **14/14** |
| Playwright: bo'sh bazadan chempiongacha to'liq jarayon | **1/1** (3 marta takrorlandi) |
| TypeScript tekshiruvi va production build | Xatosiz |

## 7. Skrinshotlar
`docs/screenshots/4-bosqich/` — 42 ta rasm. Hammasi haqiqiy backend va PostgreSQL bilan ishlayotgan saytdan Playwright orqali olingan:
- `01`–`12` — ommaviy sayt (kompyuter, planshet, telefon, qorong'i rejim). `-ekran` bilan tugaganlari — telefon ekranining o'zi.
- `20`–`29` — admin paneli (kompyuter va telefon).
- `flow-01`…`flow-03` — bo'sh bazadan boshlangan jarayon: jamoalar, jadval, chempion.

## 8. Keyingi bosqich (5 — Yakuniy tekshiruv), tasdiqingizdan keyin
1. **Responsive:** asosiy sahifalar 375, 768 va 1440 px da qayta tekshiriladi.
2. **Accessibility:** avtomatik audit (axe-core) va topilgan muammolarni tuzatish.
3. **Xavfsizlik:** sarlavhalar, parol siyosati, bog'liqliklar zaifliklari (`npm audit`, Maven).
4. **Tezlik:** Lighthouse o'lchovlari (LCP, CLS).
5. **Hujjatlar:**
   - tashkilotchi uchun sodda foydalanish yo'riqnomasi;
   - lokal ishga tushirish va zaxira nusxa yo'riqnomasi;
   - hosting va domen bo'yicha tavsiyalar.
