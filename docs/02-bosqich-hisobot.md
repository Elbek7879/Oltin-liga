# 2-bosqich hisoboti: Frontend

Sana: 2026-10-15
Holat: **bajarildi, tasdiq kutilmoqda.** 3-bosqichga (backend) o‘tish uchun ruxsat kerak.

Sayt namunaviy ma’lumotlar bilan to‘liq ishlaydi. Ma’lumotlar hozircha brauzer xotirasida saqlanadi. PostgreSQL bazasi va haqiqiy login 3-bosqichda qo‘shiladi.

---

## 1. Nimalar yaratildi

### Dizayn tizimi — «Oltin Maydon»
- **Ranglar:** maydon yashili `#0F3D2E`, oltin `#C9A227`, bo‘r oqi `#F4F6F1`. Barcha ranglar `src/styles/globals.css` faylida tokenlar sifatida bir joyda belgilangan.
- **Rejimlar:** yorug‘ va qorong‘i rejim; tanlov brauzerda eslab qolinadi.
- **Shrift:** bitta oila — Archivo. Sarlavha va hisoblar uchun tor (condensed) ko‘rinishi ishlatiladi. Shrift o‘z serverimizdan yuklanadi, Google’ga so‘rov yuborilmaydi.
- **Asosiy vizual element:** bosh sahifadagi o‘yin bloki maydon chiziqlari (o‘rta chiziq, markaziy doira, jarima maydonlari) fonida ko‘rsatiladi. Pley-off sxemasining ulanish chiziqlari ham shu uslubda.
- **Jamoa nishonlari:** logotip yuklanmagan jamoalar uchun jamoa ranglari va qisqa nomidan avtomatik yasaladi.

### Telefonda ixcham matn (sizning talabingiz)

| Element | Telefon | Kompyuter |
|---|---|---|
| Asosiy matn | 14px | 15px |
| Sahifa sarlavhasi | 20px | 30px |
| Hisob raqamlari | 30px | 64px |

- Forma maydonlari telefonda 16px: iPhone yozish paytida ekranni o‘zi kattalashtirmaydi.
- Barcha tugmalar telefonda kamida 44×44px.

### Ommaviy sayt (loginsiz)

| Sahifa | Imkoniyatlar |
|---|---|
| Bosh sahifa | Asosiy blok: jonli, keyingi yoki final o‘yini. Undan keyin: muhim e’lon, eng yaqin o‘yinlar, oxirgi natijalar, guruhlar jadvali, to‘purarlar, yangiliklar. Tartib siz bergan ustuvorlik bo‘yicha. |
| O‘yinlar | «Bugun», «Kelgusi», «Natijalar», «Taqvim» bo‘limlari; guruh va jamoa bo‘yicha filtr |
| O‘yin sahifasi | Hisob, gollar va kartochkalar (daqiqasi bilan), tarkiblar, o‘yin ma’lumoti, ikki jamoaning oldingi uchrashuvlari, «Ulashish» tugmasi |
| Turnir jadvali | Barcha guruhlar. Telefonda ixcham ko‘rinish, xohlasa barcha ustunlar. Pley-off zonasi, oxirgi o‘yinlar shakli (G/D/M), teng ochko mezonlari |
| Pley-off | Kompyuterda sxema, telefonda bosqichlar bo‘yicha ro‘yxat. Sxema hali tuzilmagan bo‘lsa, hozirgi jadval bo‘yicha taxminiy juftliklar |
| Jamoalar | Qidiruv; jamoa sahifasida tarkib, o‘yinlar va mavsumlar tarixi |
| Futbolchilar | Qidiruv va filtr; futbolchi sahifasida mavsumlar bo‘yicha statistika (jamoa almashtirganlar ham) va mukofotlar |
| Statistika | To‘purarlar, assistlar, kartochkalar, Fair Play, jamoalar statistikasi |
| Yangiliklar | Ro‘yxat va maqola sahifasi |
| Mavsumlar arxivi | Har bir mavsum: chempion, final, to‘purar, sovrindorlar. Bir bosishda o‘sha mavsumni ochish |
| Chempionlar tarixi | Mavsumlar bo‘yicha g‘oliblar |
| Homiylar | Darajalar bo‘yicha va «Homiy bo‘lish» bloki |
| Liga haqida | Nizom (joriy mavsum qoidalaridan avtomatik) va aloqa |

- Mavsum tanlagich har bir sahifada bor. Arxiv mavsumi tanlanganda ogohlantiruvchi chiziq chiqadi.
- Jonli o‘yin bo‘lsa, ma’lumot har 60 soniyada o‘zi yangilanadi.

### Admin paneli

| Bo‘lim | Imkoniyatlar |
|---|---|
| Kirish | Login sahifasi; kirmagan foydalanuvchi admin sahifalariga o‘ta olmaydi |
| Boshqaruv paneli | Natijasi kiritilmagan o‘yinlar haqida ogohlantirish, 4 ta tezkor amal, ko‘rsatkichlar, bugungi o‘yinlar, so‘nggi o‘zgarishlar |
| Natijalar | «Kiritish kerak», «Yakunlangan», «Qoldirilgan» ro‘yxatlari; jamoa bo‘yicha qidiruv |
| Natija kiritish | O‘yin holati, hisob uchun − / + tugmalari, gol mualliflari (oddiy, penalti, avtogol), assist, daqiqa, kartochkalar, o‘yinda qatnashganlar, texnik natija 3:0, pley-offda qo‘shimcha vaqt va penaltilar, saqlashdan oldin jonli tekshiruv |
| O‘yinlar | Qo‘shish va tahrirlash; vaqt to‘qnashuvi ogohlantirishi; guruh taqvimini avtomatik tuzish (bir yoki ikki davrali) |
| Guruhlar | Tasodifiy yoki qo‘lda qur’a, muvozanatli taqsimlash, tasdiqlashdan oldin ko‘rib chiqish; o‘yinlar boshlangach qur’a qulflanadi |
| Jamoalar | Qo‘shish va tahrirlash; nishon oldindan ko‘rinadi; mavsumga qo‘shish yoki chiqarish. Tarixi bor jamoani o‘chirib bo‘lmaydi |
| Futbolchilar | Qo‘shish va tahrirlash, jamoa va raqam, maxfiy telefon. Statistikasi bor futbolchini o‘chirib bo‘lmaydi |
| Pley-off | Sxemani avtomatik yaratish (A1–B2 kesishgan juftliklar), 3-o‘rin o‘yini; g‘olib keyingi bosqichga avtomatik o‘tadi |
| Mavsumlar | Yangi mavsum (jamoalar avvalgidan ko‘chiriladi), boshlash, yakunlash. Yakunlashda sovrindorlar tekshiriladi, mavsum arxivga qulflanadi |
| Yangiliklar, Homiylar | Qo‘shish, tahrirlash, o‘chirish; qoralama yoki e’lon qilish; muhim e’lon belgisi |
| Hisobotlar | Mavsum ko‘rsatkichlari, rekordlar, jadvallar, «Chop etish» |
| Sozlamalar | Ochkolar va teng ochko mezonlari tartibi, jarima ochkolari, liga ma’lumotlari, rollar, o‘zgarishlar tarixi, namunaviy ma’lumotlarni tiklash |

- O‘chirish kabi qaytarib bo‘lmaydigan amallardan oldin tasdiq so‘raladi.
- Har bir amaldan keyin o‘zbek tilida xabar chiqadi. Xatolar sababi va yechimi bilan tushuntiriladi.

---

## 2. Qo‘shilgan fayl va modullar

```
frontend/
  src/domain/              liga qoidalari (React'ga bog‘liq emas, backend'ga ko‘chiriladi)
    standings.ts           jadval va teng ochko mezonlari
    validation.ts          natijani tekshirish va g‘olibni aniqlash
    schedule.ts            taqvim, vaqt to‘qnashuvi
    draw.ts                qur’a
    playoff.ts             pley-off sxemasi
    stats.ts               statistikalar
    __tests__/             32 ta unit test
  src/api/                 API interfeysi (LeagueApi), React Query hooklari, namunaviy API va ma’lumotlar
  src/components/league/   nishon, o‘yin qatori, jadval, sxema, asosiy o‘yin bloki
  src/components/admin/    admin komponentlari (forma maydoni, tasdiqlash oynasi, hisob tugmalari)
  src/components/layout/   ommaviy va admin karkaslari
  src/pages/public/        16 ta sahifa
  src/pages/admin/         14 ta sahifa
  e2e/                     Playwright: funksional testlar va skrinshotlar
docs/02-bosqich-hisobot.md, docs/screenshots/2-bosqich/
README.md, .gitignore
```

### Ma’lumotlar oqimi
Barcha jadval va statistikalar o‘yinlar va o‘yin hodisalaridan **har safar noldan** hisoblanadi.

- Natija tahrirlansa, eski hisob o‘rniga yangisi olinadi — bitta o‘yin ikki marta qo‘shilmaydi.
- Sahifalar faqat `LeagueApi` interfeysi orqali ishlaydi. 4-bosqichda namunaviy API haqiqiy HTTP API bilan almashtiriladi, sahifalar kodi o‘zgarmaydi.

---

## 3. Javobsiz qolgan savollar bo‘yicha qabul qilingan standartlar

Hammasini keyin admin panelida o‘zgartirish mumkin.

| Savol | Hozirgi yechim |
|---|---|
| Format | Guruh bosqichi + pley-off; har guruhdan 2 ta jamoa; 3-o‘rin uchun o‘yin bor |
| Teng ochko | O‘zaro ochko → o‘zaro to‘plar farqi → umumiy to‘plar farqi → urilgan gollar → Fair Play → qur’a. Tartibini «Sozlamalar»da o‘zgartirish mumkin |
| Transfer | Faqat mavsumlar orasida. Mavsum o‘rtasida o‘ynagan futbolchining jamoasini o‘zgartirib bo‘lmaydi (statistika himoyasi) |
| Gol muallifi noma’lum | Ruxsat berilgan, ogohlantirish bilan. Bunday gol to‘purarlar reytingiga kirmaydi |
| O‘yinlar soni | Ixtiyoriy «O‘yinda qatnashganlar» ro‘yxatidan hisoblanadi |
| Diskvalifikatsiya | Hali yo‘q — keyingi versiya |
| Logotiplar | Avtomatik nishon |

---

## 4. Ishlayotgan funksiyalar (sinovdan o‘tgan)
- Loginsiz ommaviy sayt: barcha sahifalar 375, 768 va 1440px kengliklarda gorizontal scroll’siz va konsol xatolarisiz ochiladi.
- Natija kiritish → turnir jadvali, ochko, to‘plar farqi, to‘purarlar avtomatik yangilanadi. Natija tahrirlansa, qayta hisoblanadi (e2e test bilan tekshirildi).
- Noto‘g‘ri ma’lumot saqlanmaydi va sababi ko‘rsatiladi.
- Jamoa qo‘shish va forma validatsiyasi.
- Admin paneliga loginsiz kirib bo‘lmaydi.
- Mavsumlar arxivi, 2025 chempioni, penaltilar bilan hal bo‘lgan final.
- Telefonda admin pastki menyusi.

## 5. Hali tugallanmagan
- **Ma’lumotlar bazasi:** hozircha brauzer xotirasi. Boshqa qurilmada ma’lumot ko‘rinmaydi. PostgreSQL 3-bosqichda.
- **Login:** namunaviy — istalgan login qabul qilinadi. Haqiqiy himoya (Spring Security, BCrypt) 3-bosqichda.
- **Yuklash:** logotip, banner va surat yuklash backend kerak.
- **Foydalanuvchilar:** yordamchilarni qo‘shish va rollar faqat ko‘rinish sifatida.
- **Keyingi versiyaga:**
  - savatlar bo‘yicha qur’a;
  - PDF eksport (hozir «Chop etish» orqali);
  - Telegram;
  - diskvalifikatsiya;
  - eng yaxshi futbolchi tanlovi.
- **Pley-off cheklovlari:**
  - jamoalar soni 2, 4, 8, 16 yoki 32 bo‘lishi kerak (eng yaxshi uchinchi o‘rinlar hali yo‘q);
  - pley-off o‘yinlari bitta o‘yindan iborat.
- **Tekshirilmagan:** axe kabi avtomatik accessibility auditi o‘tkazilmagan. Semantik HTML, label, fokus va kontrast qo‘lda tekshirildi.

## 6. Topilgan va tuzatilgan xatolar
1. shadcn CLI interaktiv savolda to‘xtab qoldi va komponentlarga `cn` nomli keraksiz paketni ulab qo‘ydi → sozlama qo‘lda yozildi, import tuzatildi, ortiqcha paketlar (`cn`, `next-themes`) olib tashlandi.
2. Tailwind v4 maxsus klasslarni `@apply` qila olmadi → `@utility` ga o‘tkazildi.
3. Pley-off chiziqlari rangi psevdo-elementga emas, elementga tushardi → tuzatildi.
4. Kompyuterda rejalashtirilgan o‘yin vaqti ikki marta ko‘rinardi → tuzatildi.
5. Telefonda sana ustuni ikki qatorga bo‘linardi → hafta kuni telefonda yashirildi.
6. Telefonda natija kiritishdagi «+» tugmasi kartadan chiqib ketardi → o‘lchamlar moslashtirildi.
7. Asosiy blokdagi tugma ustidan maydon chizig‘i o‘tardi → tugmaga fon berildi.
8. Uzun admin sahifalarida chap menyu foni kesilardi → tuzatildi.

## 7. Bajarilgan testlar

| Test | Natija |
|---|---|
| TypeScript tekshiruvi (`tsc -b`) | Xatosiz |
| Vitest: jadval, teng ochko, validatsiya, statistika, taqvim, qur’a, pley-off, namunaviy ma’lumotlar yaxlitligi | **32/32 o‘tdi** |
| Playwright: 11 ta funksional test (sahifalar, 3 xil kenglik, arxiv, natija → jadval, tahrirlash, validatsiya, jamoa qo‘shish, mobil admin, ruxsatsiz kirish) | **11/11 o‘tdi** |
| Playwright: skrinshotlar | 2/2, 39 ta rasm |
| Production build | Muvaffaqiyatli, asosiy JS 145 KB (gzip) |

**Skrinshotlar haqida:** `docs/screenshots/2-bosqich/` — haqiqiy ishlayotgan saytdan Playwright (Chromium) orqali olingan.
- `-ekran` bilan tugaganlari — telefon ekranining o‘zi.
- To‘liq sahifa rasmlarida pastki menyu va «Saqlash» paneli sahifa o‘rtasida ko‘rinadi. Bu skrinshot usulining xususiyati: telefonda ular ekran pastiga yopishgan.

## 8. Keyingi bosqich (3 — Backend), tasdiqingizdan keyin
1. **PostgreSQL o‘rnatish** (sizning ruxsatingiz yoki o‘zingiz o‘rnatishingiz kerak).
2. **Spring Boot loyihasi:**
   - Java 17, Maven;
   - Flyway migratsiyalari;
   - 1-bosqichdagi ma’lumotlar modeli.
3. **REST API:** `LeagueApi` interfeysiga mos `/api/public/**` va `/api/admin/**`.
4. **Xavfsizlik:**
   - Spring Security: sessiya, httpOnly cookie, CSRF, BCrypt;
   - birinchi admin muhit o‘zgaruvchilaridan yaratiladi;
   - rollar.
5. **Hisoblash mantig‘i** Java’ga ko‘chiriladi. Shu 32 ta test holati JUnit’da takrorlanadi.
6. **Qo‘shimcha:** audit, outbox (Telegram uchun), rasm yuklash.
7. **Testlar:** unit va integratsion testlar, so‘ng hisobot.
