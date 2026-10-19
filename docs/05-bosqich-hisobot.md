# 5-bosqich hisoboti: Yakuniy tekshiruv va production

Sana: 2026-10-16
Holat: **bajarildi, tasdiq kutilmoqda.**

Bu bosqichda:

- liga logotipi saytning hamma joyiga qo‘yildi;
- yordamchilar va rollar boshqaruvi qo‘shildi;
- sayt accessibility, tezlik va xavfsizlik bo‘yicha tekshirilib, topilgan kamchiliklar tuzatildi;
- internetga chiqarish uchun production yig‘ilmasi, zaxira skriptlari va qo‘llanmalar tayyorlandi.

---

## 1. Nimalar qilindi

### Liga logotipi
Siz bergan rasm asl holida `docs/brand/logo-original.jpg` da saqlandi. Undan sayt uchun yengil nusxalar yasaldi:

| Joy | Fayl | Hajmi |
|---|---|---|
| Sarlavha, admin menyusi | `brand/logo-96.webp` (+ 192 retina uchun) | 6 KB |
| Kirish sahifasi, «Liga haqida» | `brand/logo-192.webp` / `logo-320.webp` | 16–34 KB |
| Brauzer ikonkasi | `favicon-48.png` | 6 KB |
| Telefon bosh ekrani (saytni «ilova» qilib qo‘shganda) | `icon-192/512.png`, `apple-touch-icon.png` | — |
| Telegram va boshqa tarmoqlarda ulashish rasmi | `og-image.jpg` (1200×630, yashil fonda) | 86 KB |

Logotip turgan joylar:

- sayt sarlavhasi (telefon va kompyuter);
- sahifa pasti;
- «Liga haqida» sahifasi;
- admin kirish sahifasi (katta, oltin nur bilan);
- admin chap menyusi va telefondagi sarlavha.

Nusxalarni qayta yasash: `node frontend/scripts/brand-assets.mjs`.

### Yordamchilar va rollar
**Bosh tashkilotchi uchun — Sozlamalar → Foydalanuvchilar:**

- yordamchilar ro‘yxati: roli, holati, oxirgi kirgan vaqti;
- **Yordamchi qo‘shish**:
  - **Yaratish** tugmasi kuchli parol taklif qiladi (chalkash `0/O`, `1/l` belgilarisiz);
  - qo‘shilgach login va parolni bitta tugma bilan nusxalab, yordamchiga yuborish mumkin;
- tahrirlash: ism, rol, akkauntni o‘chirish;
- parolni unutgan yordamchiga yangi parol berish.

**Har bir admin uchun — «Hisobim» sahifasi:** chap menyu pastidagi ism bosilganda ochiladi. U yerda o‘z parolini almashtirish mumkin (joriy parol so‘raladi).

**Rolga qarab interfeys:**

- menyu va telefondagi pastki menyu faqat ruxsat etilgan bo‘limlarni ko‘rsatadi. Masalan, natija kirituvchida faqat Panel, Natijalar va Hisobotlar bor;
- yopiq bo‘limga havola orqali kirilsa, tushunarli «Bu bo‘lim sizning rolingiz uchun yopiq» ekrani chiqadi;
- panel sahifasidagi tezkor amallar rolga mos: muharrirga «Yangilik yozish» va «Homiylar» ko‘rsatiladi;
- **mavsumni yakunlash**, **Liga ma’lumotlari** va **Foydalanuvchilar** bo‘limlari faqat bosh tashkilotchida ko‘rinadi.

**Serverdagi himoya** (interfeysni chetlab o‘tib ham buzib bo‘lmaydi):

- foydalanuvchilarni faqat bosh tashkilotchi boshqaradi;
- o‘z akkauntini o‘chirish yoki rolini pasaytirish mumkin emas. Tizimda doim kamida bitta faol bosh tashkilotchi qoladi;
- yordamchi o‘chirilsa yoki roli o‘zgartirilsa, uning ochiq sessiyasi **darhol** yopiladi (keyingi bosishdayoq);
- parol talablari: kamida 10 belgi, kamida 5 xil belgi, ichida login bo‘lmasin. Talablar serverda ham, formada ham bir xil;
- «akkaunt o‘chirilgan» xabari faqat to‘g‘ri parol kiritilganda chiqadi. Begona odam bu xabardan qaysi login mavjudligini bila olmaydi;
- barcha o‘zgarishlar «O‘zgarishlar tarixi»ga yoziladi.

### Accessibility (WCAG 2.2 AA)
**Avtomatik tekshiruv (axe-core).** Qamrov:

- 12 ta ommaviy sahifa va 16 ta admin ekrani (natija kiritish formasi bilan);
- yorug‘ va qorong‘i rejim, 375 px va 1440 px.

Natija: **0 ta xato**.

Topilgan va tuzatilganlar:

- **Rang kontrasti.** To‘rtta rang 4,5:1 talabidan biroz past edi (4,0–4,4). Ular sezilmas darajada to‘qlashtirildi, endi hammasi ≥ 4,6:
  - oltin matn: `#8a6d12` → `#7d6310`;
  - g‘alaba va pley-offga chiqish rangi: `#2e7d57` → `#287050`;
  - «jonli» rangi: `#d63b2f` → `#bb3226`.

  Qorong‘i rejimdagi «Jonli» belgisida oq matn juda xira edi (2,8:1); endi matn to‘q (6:1 dan yuqori).
- **Tablar** (O‘yinlar, Statistika, Natijalar, Sozlamalar, Pley-off, Jamoa sahifasi). Ekran o‘quvchi uchun tab mavjud bo‘lmagan panelga ishora qilardi. Endi har biri haqiqiy panelga bog‘langan.

**Klaviatura bilan boshqarish:**

- birinchi Tab «Asosiy mazmunga o‘tish» havolasini ochadi;
- dialog ichida fokus aylanadi, Esc bilan yopiladi;
- **tuzatildi:** dialog yopilganda fokus uni ochgan tugmaga qaytmay, sahifa boshiga tushib qolardi. Endi hamma dialog va yon panellarda to‘g‘ri qaytadi;
- **tuzatildi:** yopish tugmasining ekran o‘quvchi matni inglizcha («Close») edi, endi «Yopish».

### Tezlik (Core Web Vitals)
O‘lchov production serverida (jar, gzip) o‘tkazildi. Har sahifa bo‘sh kesh bilan, telefon ekranida (375 px) ochildi.

| Sahifa | LCP: avval → keyin (og‘ir sharoit*) | LCP (oddiy 4G**) | CLS | INP |
|---|---|---|---|---|
| Bosh sahifa | 3,26 s → 2,45–2,8 s | 0,72 s | ≤ 0,05 | — |
| Turnir jadvali | 2,82 s → 2,24–2,31 s | 0,68 s | 0 | — |
| O‘yinlar | 2,34 s → 2,14–2,22 s | 0,68 s | 0,04 | 40–56 ms |
| Statistika | 2,78 s → 2,28–2,41 s | 0,71 s | 0 | 24–48 ms |
| Admin: kirish | 2,56 s → 2,61–2,66 s | 0,72 s | 0 | — |

\* «Slow 4G» (150 ms kechikish, 1,6 Mbit/s) va 4 marta sekinlashtirilgan protsessor — eng og‘ir laboratoriya profili.
\** 40 ms, 9 Mbit/s, protsessor 2 marta sekin.

Me’yor: LCP < 2,5 s, CLS < 0,1, INP < 200 ms.

- Oddiy 4G’da hamma sahifa me’yordan ancha yaxshi. CLS va INP hamma joyda yaxshi.
- Og‘ir profilda jadval, o‘yinlar va statistika me’yorda.
- Bosh sahifa chegarada: o‘lchovlar 2,45–2,8 s oralig‘ida tebranadi.
- Admin kirish sahifasi 2,6 s, sababi katta logotip rasmi. U faqat 1–4 tashkilotchi uchun, shuning uchun alohida optimallashtirilmadi.

Qilingan optimallashtirishlar:

- mavsumlar ro‘yxati HTML bilan birga so‘raladi (`preload`). Avval JS yuklanib bo‘lishini kutardi;
- mavsum ma’lumotlari mavsum aniqlanishi bilan so‘raladi. Avval sahifa kodi yuklanishini kutardi;
- bosh sahifa kodi HTML’dan darhol yuklanadi (`modulepreload`);
- bosh sahifadagi yangiliklar sahifa kodi bilan parallel so‘raladi;
- kirish sahifasida keraksiz mavsum ma’lumotlari endi so‘ralmaydi.

Tekshirish: `node frontend/scripts/web-vitals.mjs <manzil> [slow4g|4g]`.

### Xavfsizlik
**npm paketlari.** Production paketlarida zaiflik 0 ta.

Dev-vositalarda 7 ta «high» bor edi: `braces` paketi `shadcn` CLI orqali kelardi. CLI faqat bitta CSS fayl uchun turgan ekan. Fayl loyiha ichiga ko‘chirildi (MIT litsenziyasi izohi bilan), CLI paketi olib tashlandi. Sayt CSS’i baytma-bayt bir xil qoldi.

Natija: `npm audit` → **0 ta zaiflik**.

**Server sarlavhalari** (production’da tekshirildi va testga qotirildi):

- `Content-Security-Policy`: skript, rasm, shrift va so‘rovlar faqat o‘z domenidan;
- `X-Frame-Options: DENY`: saytni boshqa saytga ramka ichida qo‘yib bo‘lmaydi;
- `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (kamera, mikrofon, joylashuv yopiq);
- HTTPS ortida `Strict-Transport-Security` qo‘shiladi va cookie’lar `Secure` bo‘ladi (proksi sarlavhasi bilan sinab ko‘rildi).

**Java paketlari.** Spring Boot 4.1.1 — eng so‘nggi versiya. Alohida CVE skaneri (OWASP Dependency-Check) ishga tushirilmadi: u katta zaiflik bazasini internetdan yuklab oladi.

### Production yig‘ilmasi
- `mvn -Pwith-frontend package` → `backend/target/oltin-liga.jar`: sayt va server bitta faylda.
- Sayt sahifalariga (`/jadval`, `/admin/natijalar` …) to‘g‘ridan-to‘g‘ri havola ishlaydi.
- Kesh sozlamalari:
  - JS/CSS fayllari bir yil keshlanadi (nomida xesh bor);
  - HTML har safar tekshiriladi, shuning uchun yangi versiya darhol ko‘rinadi.
- HTML, CSS va JS gzip bilan siqiladi.
- `prod` profili:
  - ilova faqat ichki manzilda tinglaydi (tashqariga HTTPS proksi orqali);
  - xavfsiz cookie;
  - namunaviy ma’lumotlar o‘chirilgan;
  - jurnal fayli aylanma (10 MB × 30).
- `deploy/` papkasida:
  - systemd xizmati (ilova faqat o‘z papkasiga yoza oladi);
  - Caddy sozlamasi (HTTPS sertifikati avtomatik);
  - server `.env` namunasi.
- Havola Telegram’da ulashilganda rasm chiqishi uchun: `SITE_URL=https://… npm run build`.

Production jar `prod` profili bilan ishga tushirib tekshirildi:

- sahifalar va havolalar ochiladi;
- xavfsizlik sarlavhalari joyida;
- kesh va gzip ishlaydi.

### Stadion: Mirzacho‘l Birlik Arena (hisobotdan keyin qo‘shildi)
Barcha o‘yinlar bitta stadionda o‘tgani uchun:

- yangi o‘rnatishda stadion avtomatik yaratiladi, «Liga haqida» matnida ham ko‘rsatiladi;
- yangi o‘yin, avtomatik taqvim va pley-off formalarida u oldindan tanlangan bo‘ladi. Pley-off formasiga «Maydon» tanlovi qo‘shildi; avval pley-off o‘yinlariga maydon umuman yozilmasdi;
- **stadion bandligi ogohlantirishi:** shu stadionda 2 soatdan kam farq bilan boshqa o‘yin bo‘lsa, forma darhol ogohlantiradi;
- **avtomatik taqvim tuzatildi.** Turlar orasidagi kun kam berilganda, keyingi kunga o‘tgan o‘yinlar navbatdagi tur bilan bir vaqtga tushishi mumkin edi; endi tur oldingisi tugagan kundan keyin boshlanadi (backend va frontendda, testlar bilan);
- **namunaviy ma’lumotlar** endi shu stadionda. 2025-yilgi arxivda ikki guruh bir vaqtda o‘ynagan edi, ularning vaqtlari ajratildi;
- **lokal baza.** Zaxira olingach, 3 ta namunaviy stadion Arena bilan almashtirildi: 52 o‘yinning hammasi Arena’da, ustma-ust o‘yin yo‘q, sizning ma’lumotlaringiz saqlangan;
- **tuzatildi:** o‘yin sahifasida qishloq nomi bo‘sh bo‘lsa, stadion nomidan keyin ortiqcha vergul chiqardi.

### Zaxira nusxa
- `scripts/backup.ps1` (Windows) va `scripts/backup.sh` (Linux server):
  - bazani va yuklangan logotiplarni saqlaydi;
  - oxirgi 30 nusxani qoldiradi;
  - parol ekranga chiqmaydi.
- Ikkalasi ham ishlatib ko‘rildi. Eski nusxalarni tozalash ham tekshirildi.
- **Tiklash sinovdan o‘tdi.** Nusxa alohida sinov bazasiga tiklandi va 16 jamoa, 240 futbolchi, 52 o‘yin to‘liq qaytdi. Asosiy bazaga tegilmadi.

### Qo‘llanmalar
- [Administrator qo‘llanmasi](qollanma-administrator.md) — mavsum ochishdan yakunlashgacha, natija kiritish, yordamchilar, parol, ko‘p beriladigan savollar.
- [Internetga chiqarish, zaxira va yangilash](ishga-tushirish.md):
  - hosting va domen tavsiyalari;
  - serverga o‘rnatish buyruqlari;
  - kunlik zaxira va tiklash;
  - yangi versiya o‘rnatish;
  - xavfsizlik ro‘yxati.
- README yangilandi.

## 2. Qo‘shilgan va o‘zgargan fayllar

| Joy | Fayllar |
|---|---|
| Backend: foydalanuvchilar | `service/UserService.java`, `web/UserController.java`, `security/ActiveUserFilter.java`, `web/AuthController.java` (parol almashtirish, o‘chirilgan akkaunt), `web/Dto.java`, `web/Requests.java` |
| Backend: production | `config/SpaConfig.java`, `security/SecurityConfig.java` (CSP, Permissions-Policy, sayt sahifalari), `application.properties`, `application-prod.properties`, `pom.xml` (`with-frontend` profili) |
| Backend: testlar | `UserManagementIntegrationTest.java` (7), `SecurityIntegrationTest.java` (+3), `IntegrationTestBase.java` |
| Frontend: foydalanuvchilar | `components/admin/users-manager.tsx`, `components/admin/password-input.tsx`, `pages/admin/account-page.tsx`, `lib/roles.ts`, `api/*` (5 ta yangi chaqiruv), `components/layout/admin-layout.tsx`, `pages/admin/{settings,dashboard,seasons,login}-page.tsx` |
| Frontend: logotip | `components/layout/brand.tsx`, `index.html`, `public/brand/*`, `public/manifest.webmanifest`, `public/theme-init.js`, `scripts/brand-assets.mjs` |
| Frontend: a11y | `hooks/use-return-focus.ts`, `components/ui/{dialog,sheet}.tsx`, `styles/globals.css`, 6 ta sahifadagi tablar |
| Frontend: tezlik | `vite.config.ts` (3 ta kichik plagin), `hooks/use-season.tsx`, `api/hooks.ts`, `main.tsx` |
| Frontend: testlar | `e2e/a11y.spec.ts` (yangi), `e2e/flows.spec.ts` (+1), `e2e/screenshots.spec.ts`, `src/lib/__tests__/roles.test.ts`, `scripts/web-vitals.mjs`, `playwright*.config.ts` (alohida Vite keshi) |
| Production | `deploy/oltin-liga.service`, `deploy/Caddyfile`, `deploy/env.production.example`, `scripts/backup.ps1`, `scripts/backup.sh` |
| Hujjatlar | `docs/qollanma-administrator.md`, `docs/ishga-tushirish.md`, shu hisobot, `README.md`, `backend/README.md` |

## 3. Topilgan va tuzatilgan xatolar

1. **Boshqa rol bilan kirganda yopiq bo‘limga tushish.**
   - Holat: admin chiqib, yordamchi o‘sha kompyuterda kirsa, adminning oxirgi sahifasiga (masalan, Sozlamalar) yo‘naltirilardi va «yopiq» ekranini ko‘rardi.
   - Tuzatish: kirishdan keyin faqat shu rol ochadigan sahifaga qaytiladi. Chiqishda oldingi foydalanuvchining admin ma’lumotlari xotiradan tozalanadi.
2. **Dialog yopilgach fokus yo‘qolardi** (klaviatura foydalanuvchisi uchun).
3. **Tablar ekran o‘quvchi uchun noto‘g‘ri bog‘langan edi** (6 sahifa).
4. **4 ta rang kontrasti me’yordan past edi**, qorong‘i rejimdagi «Jonli» belgisi ayniqsa xira edi.
5. **«Close» yozuvi inglizcha edi** (ekran o‘quvchi).
6. **O‘chirilgan akkaunt holati noto‘g‘ri parolda ham oshkor bo‘lardi.** Spring tekshiruvi paroldan oldin ishlaydi; endi xabar faqat to‘g‘ri parolda chiqadi.
7. **`backup.sh` to‘xtab qolardi**, agar `.env` da `MEDIA_DIR` bo‘lmasa. Skriptni sinash paytida topildi.
8. **Brauzer testi tasodifan yiqildi** (test muhiti, ilova xatosi emas).
   - Sabab: ochiq dev server (5173) va test serveri Vite keshini umumiy papkada bo‘lishardi. Paketlar o‘zgargach, dev server keshni qayta yozdi va test sahifasi kirish paytida qayta yuklanib ketdi.
   - Tuzatish: test serverlari endi alohida keshdan foydalanadi. Qayta yugurishda 25/25 o‘tdi.
9. **Natija kirituvchi panelida yolg‘iz katakcha.** «Tezkor amallar»da bitta katakcha qolib, yuqoridagi tugmani takrorlardi. Skrinshotlarni ko‘rib chiqishda topildi; yoniga «Hisobotlar» qo‘shildi.

## 4. Testlar

| To‘plam | Natija |
|---|---|
| Backend (JUnit, `payariq_test` bazasida) | **51/51** (yangi: foydalanuvchilar 7, xavfsizlik sarlavhalari va SPA 3, stadion va taqvim 2) |
| Frontend unit (Vitest) | **41/41** (yangi: rollar va parol yaratish 5, stadion bandligi va taqvim 4) |
| Brauzer testlari (Playwright, haqiqiy backend) | **25/25** (accessibility 10, ish oqimlari 13, skrinshotlar 2) |
| Bo‘sh bazadan chempiongacha to‘liq jarayon | **1/1** o‘tdi |
| Accessibility (axe-core, WCAG 2.2 AA) | 8 audit, **0 xato**; klaviatura testlari 2/2 |
| Core Web Vitals | yuqoridagi jadval |
| npm audit | **0 zaiflik** |

## 5. Hali qilinmagan va sizdan kerak bo‘ladigan narsalar

- **Hosting va domen.** Bular pullik xizmatlar; tanlov va xarid sizda. O‘rnatish buyruqlari tayyor ([ishga-tushirish.md](ishga-tushirish.md)).
  - Haqiqiy HTTPS server faqat serverda tekshiriladi. Lokalda proksi sarlavhalari bilan taqlid qilinib, sinab ko‘rildi.
  - Tavsiya: O‘zbekistondagi data-markaz. Sabablari — tezlik va shaxsga doir ma’lumotlarni mamlakatda saqlash talabi.
- **Qur’a bilan o‘rin aniqlash.** Teng ochkoli jamoalarni hech bir mezon ajrata olmasa, tizim ularni `*` belgisi bilan ko‘rsatadi. Qur’a natijasini panelga kiritish funksiyasi sizning tasdig‘ingizni kutyapti.
- **Telegram xabarnomalari va PDF hisobot** — keyingi bosqichlar uchun. Ular uchun backendda tayyorgarlik (hodisalar navbati) bor.
- **Real ekran o‘quvchi bilan qo‘lda sinov** (NVDA, TalkBack) o‘tkazilmadi. Tekshiruv avtomatik vosita va klaviatura bilan qilindi.
- **Java paketlari uchun CVE skaneri** ishga tushirilmadi (yuqoriga qarang).
- **Xavfsizlik eslatmasi.** PostgreSQL bosh foydalanuvchisi (`postgres`) paroli avvalroq chatda yozilgan edi. Uni almashtirishingizni tavsiya qilaman. Loyiha o‘zi alohida `payariq` foydalanuvchisi bilan ishlaydi.

## 6. Skrinshotlar

Haqiqiy ishlayotgan saytdan Playwright bilan olingan, papka: [`docs/screenshots/5-bosqich/`](screenshots/5-bosqich/).

| Fayl | Nima ko‘rsatilgan |
|---|---|
| [01-bosh-sahifa-kompyuter-ekran.png](screenshots/5-bosqich/01-bosh-sahifa-kompyuter-ekran.png) | Bosh sahifa: sarlavhada liga logotipi (kompyuter, ekran) |
| [01-bosh-sahifa-planshet-ekran.png](screenshots/5-bosqich/01-bosh-sahifa-planshet-ekran.png) | Bosh sahifa: sarlavhada liga logotipi (planshet, ekran) |
| [01-bosh-sahifa-telefon-ekran.png](screenshots/5-bosqich/01-bosh-sahifa-telefon-ekran.png) | Bosh sahifa: sarlavhada liga logotipi (telefon, ekran) |
| [02-bosh-sahifa-kompyuter.png](screenshots/5-bosqich/02-bosh-sahifa-kompyuter.png) | Bosh sahifa to‘liq (pastida logotip) (kompyuter, to‘liq sahifa) |
| [03-liga-haqida-kompyuter.png](screenshots/5-bosqich/03-liga-haqida-kompyuter.png) | «Liga haqida»: katta logotip (kompyuter, to‘liq sahifa) |
| [04-turnir-jadvali-telefon-ekran.png](screenshots/5-bosqich/04-turnir-jadvali-telefon-ekran.png) | Turnir jadvali (yangilangan «chiqadi» rangi) (telefon, ekran) |
| [05-oyinlar-telefon-ekran.png](screenshots/5-bosqich/05-oyinlar-telefon-ekran.png) | O‘yinlar (yangilangan g‘alaba va jonli ranglari) (telefon, ekran) |
| [06-bosh-sahifa-qorongi-kompyuter-ekran.png](screenshots/5-bosqich/06-bosh-sahifa-qorongi-kompyuter-ekran.png) | Qorong‘i rejim (kompyuter, ekran) |
| [06-bosh-sahifa-qorongi-telefon-ekran.png](screenshots/5-bosqich/06-bosh-sahifa-qorongi-telefon-ekran.png) | Qorong‘i rejim (telefon, ekran) |
| [10-admin-kirish-kompyuter.png](screenshots/5-bosqich/10-admin-kirish-kompyuter.png) | Admin kirish sahifasi: logotip oltin nur bilan (kompyuter, to‘liq sahifa) |
| [10-admin-kirish-telefon.png](screenshots/5-bosqich/10-admin-kirish-telefon.png) | Admin kirish sahifasi: logotip oltin nur bilan (telefon, to‘liq sahifa) |
| [11-foydalanuvchilar-kompyuter.png](screenshots/5-bosqich/11-foydalanuvchilar-kompyuter.png) | Sozlamalar → Foydalanuvchilar (kompyuter, to‘liq sahifa) |
| [12-yordamchi-qoshish-kompyuter.png](screenshots/5-bosqich/12-yordamchi-qoshish-kompyuter.png) | Yordamchi qo‘shish: «Yaratish» tugmasi kuchli parol taklif qiladi (kompyuter, to‘liq sahifa) |
| [13-akkaunt-tayyor-kompyuter.png](screenshots/5-bosqich/13-akkaunt-tayyor-kompyuter.png) | Akkaunt tayyor: login va parolni nusxalash (kompyuter, to‘liq sahifa) |
| [14-foydalanuvchilar-telefon.png](screenshots/5-bosqich/14-foydalanuvchilar-telefon.png) | Foydalanuvchilar (telefon) (telefon, to‘liq sahifa) |
| [15-hisobim-telefon.png](screenshots/5-bosqich/15-hisobim-telefon.png) | «Hisobim»: parolni almashtirish (telefon) (telefon, to‘liq sahifa) |
| [16-natija-kirituvchi-panel-kompyuter.png](screenshots/5-bosqich/16-natija-kirituvchi-panel-kompyuter.png) | Natija kirituvchi: menyuda faqat o‘z bo‘limlari (kompyuter, to‘liq sahifa) |
| [17-yopiq-bolim-kompyuter.png](screenshots/5-bosqich/17-yopiq-bolim-kompyuter.png) | Yopiq bo‘limga havola orqali kirilganda (kompyuter, to‘liq sahifa) |
| [18-natija-kirituvchi-panel-telefon-ekran.png](screenshots/5-bosqich/18-natija-kirituvchi-panel-telefon-ekran.png) | Natija kirituvchi: telefondagi pastki menyu (telefon, ekran) |
| [flow-01-jamoalar.png](screenshots/5-bosqich/flow-01-jamoalar.png) | To‘liq jarayon testi: bo‘sh bazaga jamoalar qo‘shilgan (kompyuter, to‘liq sahifa) |
| [flow-02-jadval.png](screenshots/5-bosqich/flow-02-jadval.png) | To‘liq jarayon testi: natijalardan keyin jadval (kompyuter, to‘liq sahifa) |
| [flow-03-chempion.png](screenshots/5-bosqich/flow-03-chempion.png) | To‘liq jarayon testi: mavsum yakunlangan, chempion arxivda (kompyuter, to‘liq sahifa) |

Jami: 22 ta rasm.

## 7. Keyingi qadamlar

1. Ushbu bosqichni ko‘rib chiqib, tasdiqlang yoki o‘zgartirishlarni ayting.
2. Qur’a funksiyasi kerakmi — qaror bering.
3. Hosting va domen tanlansa, serverga o‘rnatishda bosqichma-bosqich yordam beraman.
