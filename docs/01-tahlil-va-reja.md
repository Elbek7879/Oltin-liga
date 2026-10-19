# Payariq Oltin Ligasi — 1-bosqich: tahlil, dizayn va dastlabki reja

Holat: **tasdiq kutilmoqda** (dizayn konsepsiyasi va savollarga javob).
Sana: 2026-10-15

---

## 1. Muhit tekshiruvi

| Vosita | Holat |
|---|---|
| Loyiha papkasi | Bo'sh (yangi loyiha) |
| Java | 17.0.12 LTS — Spring Boot uchun yetarli |
| Maven | 3.9.16 |
| Node.js / npm | 24.21 / 11.19 |
| PostgreSQL | **O'rnatilmagan** — 3-bosqichdan oldin kerak |
| Docker | **O'rnatilmagan** |
| Git | 2.45 (papka hali git repozitoriy emas) |

2-bosqich (frontend, namunaviy ma'lumotlar) uchun PostgreSQL shart emas.

---

## 2. Talablar tahlili — asosiy xulosalar

1. **Ikki qism:** ommaviy sayt (faqat o'qish, loginsiz) va admin panel (login, rollar).
2. **Asosiy domen zanjiri:** Mavsum → Mavsum jamoalari → Guruhlar → O'yinlar → O'yin hodisalari (gol, kartochka) → Jadval va statistika (hisoblanadi) → Pley-off → Sovrindorlar.
3. **Yagona ishonchli manba:** faqat `matches` (holat + hisob) va `match_events` (gollar, kartochkalar). Ochko, jadval, to'purarlar — **hech qachon qo'lda kiritilmaydi**, har doim shulardan hisoblanadi. Natija tahrirlanganda guruh jadvali **to'liq qaytadan** hisoblanadi — shuning uchun o'yin ikki marta hisobga olinishi mumkin emas.
4. **Mavsumlar izolyatsiyasi:** mavsumga oid har bir yozuv `season_id` orqali bog'lanadi. Yakunlangan mavsum **qulflanadi** (faqat o'qish); ochish faqat bosh admin tomonidan, sababi bilan va tarixga yoziladi.
5. **Tarix buzilmasligi:** jamoa nomi yoki logotipi o'zgarsa, eski mavsumlarda o'sha paytdagi nom ko'rinadi (mavsumdagi nom "snapshot" qilinadi).
6. **Futbolchi transferi:** futbolchi doimiy obyekt, jamoaga bog'lanish esa mavsumlik tarkib (`season_rosters`) orqali. Gol hodisasi futbolchi + o'sha paytdagi jamoaga yoziladi, shuning uchun eski statistika o'zgarmaydi.
7. **Maxfiylik:** telefon raqami kabi ma'lumotlar alohida admin DTO'larida; ommaviy API'da umuman yo'q.
8. **Vaqt mintaqasi:** Asia/Tashkent.

---

## 3. Mobil va desktop boshqaruv — tipografika qoidasi

Foydalanuvchi talabi: telefonda yozuvlar katta bo'lib ketmasin, boshqaruv ikkala qurilmada ham qulay bo'lsin.

| Element | Telefon (<640px) | Desktop |
|---|---|---|
| Asosiy matn | 14px / 20px | 15–16px |
| Kichik matn (izoh, sana) | 12px | 13px |
| Sahifa sarlavhasi (H1) | 20px | 30–32px |
| Bo'lim sarlavhasi (H2) | 16–17px | 20–22px |
| Jamoa nomi (karta) | 14px | 15–16px |
| Hisob raqamlari | 22–26px | 32–40px |
| Forma inputlari | 16px (iPhone avtomatik zoom qilmasligi uchun) | 15px |

- O'lchamlar `rem` va past maksimumli `clamp()` bilan beriladi — telefon shrift sozlamasi hurmat qilinadi, lekin layout buzilmaydi.
- `text-size-adjust: 100%` — telefon gorizontal holatda matnni o'zi kattalashtirmaydi.
- Matn kichik bo'lsa ham, bosiladigan maydon kamida 44×44px.
- **Admin telefonda:** pastki menyu (Bosh, O'yinlar, Natija, Ko'proq), jadvallar o'rniga ixcham ro'yxat-qatorlar, bitta ustunli formalar, ekran pastida yopishgan "Saqlash" tugmasi, hisob kiritish uchun − / + tugmalari va futbolchini tarkibdan bir bosishda tanlash.
- **Admin desktopda:** chap menyu, filtr va qidiruvli jadvallar, ko'p ustunli formalar.

---

## 4. Sayt xaritasi

### Ommaviy sayt (loginsiz)

| Yo'l | Sahifa |
|---|---|
| `/` | Bosh sahifa: eng yaqin o'yinlar, oxirgi natijalar, guruhlar jadvali, to'purarlar, muhim e'lonlar |
| `/oyinlar` | Bugun / Kelgusi / Yakunlangan, taqvim, filtr (guruh, tur, jamoa) |
| `/oyinlar/:id` | O'yin sahifasi: hisob, gollar, kartochkalar, maydon, ulashish |
| `/jadval` | Barcha guruhlar jadvali |
| `/pley-off` | Pley-off sxemasi |
| `/jamoalar`, `/jamoalar/:id` | Jamoalar, tarkib, natijalar, mavsumlar tarixi, o'zaro o'yinlar |
| `/futbolchilar`, `/futbolchilar/:id` | Futbolchilar va shaxsiy statistika |
| `/statistika` | To'purarlar, assistlar, kartochkalar, Fair Play |
| `/yangiliklar`, `/yangiliklar/:slug` | Yangiliklar va e'lonlar |
| `/mavsumlar`, `/mavsumlar/:id` | Mavsumlar arxivi (tanlangan mavsum bo'yicha hamma sahifa ishlaydi) |
| `/chempionlar` | Chempionlar va sovrindorlar tarixi |
| `/homiylar` | Homiylar |
| `/liga-haqida` | Liga nizomi, aloqa |

Mavsum tanlagich sarlavhada turadi: arxiv mavsumi tanlansa, barcha sahifalar o'sha mavsum ma'lumotini ko'rsatadi.

### Admin panel (`/admin`)

| Bo'lim | Vazifasi |
|---|---|
| Kirish | Login |
| Boshqaruv paneli | Bugungi o'yinlar, natijasi kiritilmagan o'yinlar, tezkor amallar |
| Mavsumlar | Ochish, sozlash (format, ochko, teng ochko mezonlari), yakunlash ustasi |
| Jamoalar | Qo'shish, tahrirlash, mavsumga qo'shish/chiqarish |
| Futbolchilar | Ro'yxat, mavsum tarkibi, raqam |
| Guruhlar | Qur'a: tasodifiy / qo'lda, ko'rib chiqib tasdiqlash |
| O'yinlar | Taqvimni avtomatik tuzish, qo'lda qo'shish, vaqt to'qnashuvi ogohlantirishi |
| Natijalar | Hisob, gol mualliflari, kartochkalar, texnik mag'lubiyat |
| Pley-off | Chiqish qoidalari, sxema, g'olibni avtomatik o'tkazish |
| Yangiliklar | Qoralama / e'lon qilingan, muhim e'lon belgisi |
| Homiylar | Logo, havola, banner, joylashuv, muddat |
| Hisobotlar | Mavsum statistikasi, eksport |
| Sozlamalar | Liga ma'lumotlari, foydalanuvchilar va rollar, o'zgarishlar tarixi |

---

## 5. Arxitektura rejasi

```
Payariq-Oltin-Ligasi/
├── frontend/          React + TypeScript + Vite + Tailwind CSS + shadcn/ui
├── backend/           Spring Boot (Maven, Java 17), modulli monolit
├── e2e/               Playwright testlari
└── docs/              Hisobotlar, yo'riqnomalar, skrinshotlar
```

### Frontend
- React Router (sahifalar), TanStack Query (server ma'lumoti, kesh), React Hook Form + Zod (formalar), Lucide (ikonalar).
- shadcn/ui komponentlari tanlangan konsepsiya tokenlariga moslashtiriladi.
- 2-bosqichda **API qatlami interfeys orqali** yoziladi: avval namunaviy ma'lumot adapteri, 4-bosqichda haqiqiy API adapteri — sahifalar kodi o'zgarmaydi.
- Ommaviy sayt va admin panel alohida yuklanadi (code splitting) — muxlis admin kodini yuklamaydi.

### Backend (paketlar funksiya bo'yicha)
`auth`, `user`, `season`, `team`, `player`, `group` (qur'a), `match` (taqvim), `result` (hodisalar), `standings` (hisoblash), `playoff`, `news`, `sponsor`, `media` (yuklangan rasmlar), `audit`, `notification` (Telegram uchun tayyor), `report`.

- **Spring Security:** sessiya + httpOnly cookie + CSRF himoyasi (bitta domenda SPA uchun eng xavfsiz va sodda yo'l). Parollar BCrypt bilan. Login urinishlari cheklanadi.
- **Birinchi admin** muhit o'zgaruvchilaridan yaratiladi — kod ichida parol yo'q.
- `/api/public/**` — faqat GET, ochiq. `/api/admin/**` — rol bo'yicha himoyalangan.
- **Flyway** — baza migratsiyalari versiyalanadi.
- **Hisoblash yadrosi** (`StandingsCalculator`) — sof funksiya: o'yinlar + qoidalar → tartiblangan jadval. Teng ochko mezonlari zanjir sifatida, o'zaro o'yinlar mini-jadvali bilan. To'liq unit testlanadi.
- **Optimistic locking** (`version`) — ikki admin bir o'yinni bir vaqtda tahrirlasa, ikkinchisi ogohlantiriladi.
- **Telegram uchun tayyorgarlik:** "O'yin rejalashtirildi", "O'yin yakunlandi", "Tur yakunlandi" hodisalari `outbox_events` jadvaliga yoziladi. Keyinroq Telegram moduli shu jadvalni o'qib xabar yuboradi — asosiy kod o'zgarmaydi.
- **Rasmlar:** brauzerda WebP'ga siqilib yuklanadi, serverda turi va hajmi tekshiriladi, lokal `uploads/` papkada saqlanadi (keyinchalik bulutli saqlashga o'tkazish mumkin).
- **Integratsiya testlari:** Docker yo'qligi sababli Testcontainers o'rniga test uchun alohida PostgreSQL bazasi (yoki embedded PostgreSQL) ishlatiladi.

---

## 6. Ma'lumotlar modeli (taklif)

Taklif etilgan ro'yxatdan farqlar **qalin** bilan.

| Jadval | Asosiy maydonlar | Izoh |
|---|---|---|
| `users` | ism, login, parol_hash, faol, oxirgi_kirish | |
| `roles`, `user_roles` | SUPER_ADMIN, ADMIN, RESULT_ENTRY, EDITOR | |
| `seasons` | raqam, nom, yil, boshlanish/tugash, holat (DRAFT/ACTIVE/FINISHED), ochko qoidalari, teng ochko mezonlari tartibi, format (1 yoki 2 davra) | |
| `teams` | nom, qishloq, logo, rang, faol | Doimiy jamoa |
| `season_teams` | mavsum, jamoa, **mavsumdagi nom va logo snapshot**, sardor, murabbiy | unique(mavsum, jamoa) |
| `players` | ism, familiya, tug'ilgan yil, surat, **telefon (maxfiy)**, pozitsiya | Doimiy futbolchi |
| `season_rosters` | mavsum jamoasi, futbolchi, raqam, qo'shilgan/chiqqan sana | |
| **`stages`** | mavsum, turi (GROUP/KNOCKOUT), nomi, tartib | Bosqichlarni umumlashtiradi |
| `groups` | bosqich, nom (A, B…), tartib | |
| `group_teams` | guruh, mavsum jamoasi | **unique(bosqich, jamoa)** — bir jamoa ikki guruhga tushmaydi |
| **`venues`** | maydon nomi, qishloq | Maydonlar ro'yxati |
| `matches` | bosqich, guruh, tur raqami, uy/mehmon jamoa, vaqt, maydon, holat, asosiy hisob, **qo'shimcha vaqt hisobi, penaltilar**, qanday hal bo'lgan (oddiy/qo'shimcha vaqt/penalti/**texnik**), g'olib, **keyingi o'yin va slot (pley-off)**, version | CHECK: uy ≠ mehmon, hisob ≥ 0 |
| `match_events` | o'yin, turi (GOL, PENALTI_GOL, AVTOGOL, SARIQ, IKKINCHI_SARIQ, QIZIL), daqiqa, futbolchi (noma'lum bo'lishi mumkin), foyda olgan jamoa, assist futbolchi | |
| **`match_appearances`** | o'yin, futbolchi | "O'yinlar soni" uchun (savol №6) |
| `standings` | guruh, jamoa, O', G', D, M, UG, O'G, TF, Och, o'rin | **Faqat hisoblangan kesh**, qo'lda o'zgartirilmaydi |
| **`point_adjustments`** | mavsum jamoasi, ochko (masalan −3), sabab, kim | Jarima ochkolari — aniq va tarixli |
| **`season_awards`** | mavsum, turi (CHEMPION, 2-O'RIN, 3-O'RIN, TO'PURAR, ENG YAXSHI O'YINCHI…), jamoa/futbolchi | Mavsum yakunida tasdiqlanadi |
| `playoff_rounds` | mavsum, nom (1/8, chorak…), tartib | Sxema o'yinlarning `next_match_id` bog'lanishi orqali |
| `sponsors` | nom, logo, havola, banner, daraja, joylashuv, muddat, tartib | |
| `news` | sarlavha, slug, matn, muqova, holat, muhim, e'lon sanasi | |
| **`media_files`** | yo'l, tur, hajm, o'lcham, kim yukladi | |
| `audit_logs` | kim, amal, obyekt, oldingi/yangi qiymat (JSON), vaqt | |
| **`outbox_events`** | turi, ma'lumot (JSON), yaratildi, qayta ishlandi | Telegram uchun |

### Natija saqlashdagi tekshiruvlar
- Hisob faqat "Yakunlangan" yoki "Davom etmoqda" holatida kiritiladi.
- Har bir jamoa gollari soni = o'z futbolchilari gollari + raqib avtogollari (+ "noma'lum muallif" gollari, agar ruxsat berilsa).
- Gol muallifi o'sha mavsumda shu jamoa tarkibida bo'lishi shart.
- Pley-off'da durang bo'lsa, qo'shimcha vaqt yoki penaltilar majburiy; g'olib aniq bo'lishi shart.
- Natija saqlanishi, jadval qayta hisoblanishi va tarixga yozish — **bitta tranzaksiyada**.

---

## 7. Qo'shimcha takliflar

### Birinchi versiya uchun zarur
1. Texnik mag'lubiyat (3:0) — jamoa kelmasa yoki o'yin bekor bo'lsa.
2. Jarima ochkolari (sababi bilan).
3. Mavsumni yakunlash ustasi: chempion, sovrindorlar, to'purar → tekshirish → arxivga qulflash.
4. Mobil "tezkor natija kiritish" ekrani.
5. Jamoalarning o'zaro o'yinlar tarixi (ma'lumot allaqachon bor).
6. O'yin natijasini Telegram/WhatsApp'ga ulashish tugmasi (telefonning o'z ulashish menyusi orqali, tashqi xizmatsiz).
7. Maydonlar ro'yxati.
8. Kartochkalar va Fair Play jadvali.
9. "Davom etmoqda" holatida hisobni yangilash; ommaviy sahifa har 60 soniyada yangilanadi.
10. Bazaning avtomatik zaxira nusxasi (`pg_dump`).

### Keyingi versiyada foydali
1. Telegram kanalga avtomatik xabarlar.
2. Hakamlar tayinlash va hakam statistikasi.
3. Kartochkalar bo'yicha diskvalifikatsiyani avtomatik hisoblash.
4. Eng yaxshi futbolchi va darvozabon tanlovi.
5. Turning eng yaxshi o'yinchisi va ramziy jamoasi.
6. Taqvim va jadvalni PDF ko'rinishida chiqarish.
7. Avvalgi mavsum natijasiga ko'ra savatlar bilan qur'a.
8. Foto galereya va video havolalar.
9. Muxlis uchun "sevimli jamoa" (loginsiz, brauzerda saqlanadi).
10. PWA: telefon bosh ekraniga qo'shish, internet sust bo'lsa ham oxirgi ma'lumotni ko'rish.
11. Daqiqama-daqiqa matnli translyatsiya.
12. Natija uchun ijtimoiy tarmoq rasm-kartasini avtomatik yaratish.

### Kelajakda daromad keltirishi mumkin
1. Homiylik paketlari: bosh homiy, rasmiy hamkor, tur homiysi, "O'yinning eng yaxshi o'yinchisi — homiy nomi".
2. Reklama joylari va ko'rishlar/bosishlar statistikasi — homiyga hisobot sifatida.
3. Jamoalarning onlayn ariza topshirishi va ishtirok badali (to'lov tizimi — alohida ruxsat bilan).
4. Jonli efir va uning homiyligi.
5. Mahalliy bizneslar katalogi.
6. Liga formasi, sharf va boshqa mahsulotlar.
7. Platformani boshqa tuman ligalariga ijaraga berish.

### UX, xavfsizlik va nizom bo'yicha
- Har ekranda bitta asosiy tugma; o'chirishdan oldin tasdiq; xatolar oddiy tilda.
- HTTPS, BCrypt, login urinishlarini cheklash, CSRF, rollar, audit, yuklangan fayllarni tekshirish, maxfiy ma'lumotlarni ommaviy API'dan ajratish, muntazam zaxira.
- Liga nizomini saytda e'lon qilish: o'yin davomiyligi, tarkib soni, kartochka qoidalari, texnik mag'lubiyat, e'tiroz (protest) tartibi.

---

## 8. Bosqichlar rejasi

| Bosqich | Natija | Tasdiq |
|---|---|---|
| 1. Tahlil va dizayn | Ushbu hujjat, 3 konsepsiya | **Kutilmoqda** |
| 2. Frontend | Ommaviy sayt + admin UI, namunaviy ma'lumot, Playwright skrinshotlari | |
| 3. Backend | Spring Boot, PostgreSQL, API, xavfsizlik, hisoblash, testlar | |
| 4. Integratsiya | Jamoa qo'shishdan chempiongacha to'liq jarayon sinovi | |
| 5. Yakuniy tekshiruv | Responsive, xavfsizlik, tezlik, yo'riqnomalar | |
