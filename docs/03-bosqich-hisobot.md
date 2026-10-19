# 3-bosqich hisoboti: Backend

Sana: 2026-10-15
Holat: **bajarildi, tasdiq kutilmoqda.** 4-bosqichda (integratsiya) frontend shu backendga ulanadi.

---

## 1. Nimalar yaratildi

- **Ma'lumotlar bazasi:** kompyuteringizdagi PostgreSQL 18 xizmatida ikkita baza yaratildi:
  - `payariq` — asosiy baza;
  - `payariq_test` — testlar uchun alohida baza.

  Loyiha bazaga alohida `payariq` foydalanuvchisi bilan ulanadi (administrator emas).
- **Spring Boot 4.1 ilovasi** (Java 17, Maven):
  - REST API — 55 ta endpoint;
  - avtomatik hisob-kitob;
  - xavfsizlik;
  - o'zgarishlar tarixi (audit);
  - Telegram uchun hodisalar navbati (outbox).
- **Baza sxemasi** Flyway orqali versiyalanadi — 18 ta jadval, ular orasida:
  - chet kalitlar;
  - unique indekslar;
  - CHECK cheklovlari.
- **Liga qoidalari Java'da:**
  - turnir jadvali (o'zaro o'yinlar bilan teng ochko mezonlari);
  - natija validatsiyasi;
  - davra tizimidagi taqvim;
  - qur'a;
  - pley-off sxemasi;
  - statistika.

  Frontenddagi TypeScript mantig'i bilan aynan bir xil.
- **Namunaviy ma'lumotlar** (faqat yoqilganda):
  - 2025 — yakunlangan mavsum, final penaltilar bilan hal bo'lgan;
  - 2026 — joriy mavsum: jonli va qoldirilgan o'yinlar bor.

## 2. Fayllar va modullar

| Joy | Tarkibi |
|---|---|
| `backend/pom.xml` | Bog'liqliklar: webmvc, validation, data-jpa, security, flyway, actuator, postgresql |
| `src/main/resources/db/migration/V1__init.sql` | Sxema (290 qator) |
| `domain/` | `StandingsCalculator`, `ResultValidator`, `Schedule`, `GroupDraw`, `Bracket`, `PlayerStats`, enumlar |
| `model/`, `repo/` | 18 ta entity va repository |
| `service/` | `PublicReadService`, `AdminQueryService`, `SeasonService`, `TeamPlayerService`, `CompetitionService`, `ResultService`, `ContentService`, `AuditService`, `OutboxService` |
| `web/` | `PublicController`, `AuthController`, `AdminController`, `AdminContentController`, `MediaController`, DTO va so'rov modellari |
| `security/` | `SecurityConfig`, `CsrfCookieFilter`, `LoginAttemptService`, foydalanuvchi xizmati |
| `config/`, `demo/` | Birinchi admin va sozlamalar, namunaviy ma'lumotlar generatori |
| `src/test/` | 29 ta unit va 10 ta integratsion test |

Hajmi: asosiy kod — 84 fayl, ~5 500 qator; testlar — 7 fayl, ~850 qator.

## 3. Muhim qarorlar

- **Yagona ishonchli manba.** Faqat `matches` (holat va hisob) va `match_events` (gollar, kartochkalar) saqlanadi. Turnir jadvali, ochkolar va to'purarlar har so'rovda shulardan noldan hisoblanadi.
  - Natija tahrirlansa, hodisalar to'liq almashtiriladi — bitta o'yin ikki marta hisobga olinmaydi.
  - 1-bosqichda rejalashtirilgan `standings` kesh jadvali kerak bo'lmadi: 24 o'yinli mavsum hisobi millisekundlarda bajariladi, kesh esa nomuvofiqlik xavfini tug'dirardi.
- **Ma'lumotlar bazasi darajasidagi himoya:**
  - bir jamoa bir mavsumda faqat bitta guruhda bo'ladi;
  - futbolchi bir mavsumda faqat bitta jamoada bo'ladi;
  - jamoa ichida o'yin raqami takrorlanmaydi;
  - bir vaqtda faqat bitta faol mavsum bo'ladi;
  - jamoa o'zi bilan o'ynay olmaydi;
  - hisob faqat yakunlangan yoki jonli o'yinda bo'ladi.
- **Arxiv qulfi.** Yakunlangan mavsumga tegishli har qanday o'zgartirish rad etiladi (409).
- **Tarix himoyasi:**
  - o'yinlari bor jamoani o'chirib bo'lmaydi;
  - statistikasi bor futbolchini o'chirib bo'lmaydi;
  - o'yinlar boshlangach qur'ani o'zgartirib bo'lmaydi;
  - jamoa nomi o'zgarsa, arxivdagi eski nom saqlanadi.
- **Bir vaqtda tahrirlash.** Ikki admin bir yozuvni bir vaqtda o'zgartirsa, optimistic locking ishga tushadi va tushunarli xabar chiqadi.
- **Bitta so'rovda mavsum.** Ommaviy sayt mavsumning barcha ma'lumotlarini bitta so'rov bilan oladi. Hajmi gzip bilan **33 KB** (siqilmagan holda 215 KB), javob vaqti ~0,15 s.

## 4. Xavfsizlik

- **Parollar:** BCrypt bilan saqlanadi. Kodda hech qanday parol yo'q — birinchi admin `backend/.env` faylidan yaratiladi, bu fayl git'ga tushmaydi.
- **Sessiya:** `HttpOnly` va `SameSite=Lax` cookie; kirgandan keyin sessiya identifikatori yangilanadi (session fixation himoyasi).
- **CSRF:** SPA uchun cookie va sarlavha orqali himoya.
- **Login urinishlari:** 15 daqiqada 5 ta noto'g'ri urinishdan keyin vaqtincha bloklanadi (429).
- **Login xabari:** foydalanuvchi bor-yo'qligidan qat'i nazar bir xil — "Login yoki parol noto‘g‘ri".
- **Rollar:**
  - Tashkilotchi — hammasi;
  - Administrator — musobaqa va kontent;
  - Natija kirituvchi — faqat natija kiritadi;
  - Muharrir — yangiliklar va homiylar.
- **Server tomonidagi validatsiya:** barcha so'rovlar tekshiriladi, xatolar o'zbek tilida qaytadi. Ichki xato tafsilotlari foydalanuvchiga ko'rsatilmaydi.
- **Maxfiy ma'lumot:** futbolchi telefoni ommaviy API'da umuman yo'q (test bilan tekshirildi).
- **Rasm yuklash:**
  - faqat PNG, JPG va WebP;
  - fayl turi mazmunidan tekshiriladi;
  - nomi tasodifiy beriladi;
  - hajmi ko'pi bilan 3 MB.
- **Xavfsizlik sarlavhalari:** CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`.

## 5. Ishlayotgan funksiyalar (real ishga tushirib tekshirildi)
Server haqiqiy PostgreSQL bilan ishga tushirildi va API ketma-ket so'rovlar bilan sinab ko'rildi:

1. Loginsiz ommaviy API ishlaydi:
   - 2026 mavsumi: 16 jamoa, 24 o'yin, jonli va qoldirilgan o'yinlar;
   - 2025 arxivi: chempion, penaltilar bilan hal bo'lgan final.
2. CSRF tokensiz so'rov rad etiladi (403). Noto'g'ri parol — 401, to'g'ri login — sessiya ochiladi.
3. Natija kiritildi: Oltin Soy 2:0 Burgut. Jadval avtomatik yangilandi — Oltin Soy: 3 → 6 ochko, o'yinlar 2 → 3, to'plar farqi −1 → +1.
4. Gollar soni hisobga mos kelmasa, natija saqlanmaydi. Xabar: "Oltin Soy: hisobda 2 ta gol, kiritilgan gollar esa 1 ta…".
5. Xuddi shu natija qayta saqlanganda ochko o'zgarmadi (6) — ikki marta qo'shilmadi.
6. Arxiv mavsumini o'zgartirishga urinish rad etildi (409).
7. Chiqqandan keyin admin API yopiladi (401).
8. Server qayta ishga tushirildi — kiritilgan natija joyida qoldi, namunaviy ma'lumotlar qayta yaratilmadi.

## 6. Hali tugallanmagan
- **Frontend ulanmagan.** Sayt hali ham namunaviy brauzer xotirasidan foydalanadi. Ulash 4-bosqichda.
- **Admin panelida UI yo'q** (backend tayyor):
  - maydonlar (venues) boshqaruvi;
  - rasm yuklash.
- **Foydalanuvchilar:** yordamchilarni qo'shish va parol o'zgartirish endpoint'lari hali yo'q. Hozir faqat birinchi admin `.env` orqali yaratiladi.
- **Telegram:** hodisalar navbatga yoziladi, lekin hali yuborilmaydi (keyingi versiya).
- **Zaxira nusxa:** bazaning avtomatik zaxira nusxasi (`pg_dump`) 5-bosqichda sozlanadi.
- **Xavfsizlik qo'shimchasi:** login'dan keyin CSRF tokenini yangilash qilinmagan. Sessiya identifikatori yangilanadi, shuning uchun xavf past.

## 7. Topilgan va tuzatilgan xatolar
1. Ikkita fayl yozish buyrug'i bash qo'shtirnoqlari sabab bajarilmadi. Hech narsa buzilmagan — fayllar boshqa usul bilan qayta yozildi.
2. `AuthController` dagi xatoni qayta ishlash ortiqcha murakkab edi → soddalashtirildi.
3. Mavsum ma'lumotlari hajmi 215 KB edi → gzip siqish yoqildi, 33 KB ga tushdi.
4. Pley-off o'yinlari bir-biriga havola qiladi → saqlash va o'chirish tartibi to'g'rilandi: avval havola qilinadigan o'yin saqlanadi, o'chirishdan oldin havolalar uziladi.

## 8. Testlar

| Test | Natija |
|---|---|
| Unit testlar (JUnit 5): jadval, teng ochko, Fair Play, jarima ochkosi, natija validatsiyasi, texnik mag'lubiyat, taqvim, qur'a, pley-off, statistika | **29/29** |
| Integratsion testlar (MockMvc + haqiqiy PostgreSQL): | **10/10** |
| — to'liq mavsum: jamoa qo'shishdan chempion va arxiv qulfigacha | |
| — natijani tahrirlash; gollar mos kelmasligi | |
| — telefon maxfiyligi; tarix himoyasi | |
| — CSRF; rollar; login; bloklash; o'zbekcha validatsiya | |
| Real server tekshiruvi (12 qadam, 5-bo'limda) | Hammasi o'tdi |

Frontend testlari o'zgarmagan: 32 ta Vitest va 11 ta Playwright testi 2-bosqichda o'tgan.

## 9. Keyingi bosqich (4 — Integratsiya), tasdiqingizdan keyin
1. Frontendda `LeagueApi` interfeysining HTTP versiyasi: cookie, CSRF, xatolarni ko'rsatish. Vite'da `/api` → `localhost:8080` proksi.
2. Admin login haqiqiy backend orqali; namunaviy rejim belgilari olib tashlanadi.
3. Admin panelga qo'shiladi:
   - maydonlar boshqaruvi;
   - jamoa logotipi va homiy rasmini yuklash.
4. Playwright bilan to'liq jarayon:
   - jamoa qo'shish → qur'a → taqvim → natijalar → jadval tekshiruvi;
   - natijani tahrirlash → pley-off → chempion.
5. Mobil va desktop skrinshotlari, hisobot.
