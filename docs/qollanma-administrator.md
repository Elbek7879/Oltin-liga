# Boshqaruv paneli: administrator qo‘llanmasi

Bu qo‘llanma Payariq Oltin Ligasi tashkilotchisi va yordamchilari uchun. Panel telefonda ham, kompyuterda ham bir xil ishlaydi.

## 1. Kirish

1. Brauzerda sayt manziliga `/admin` qo‘shib oching (masalan, `https://sizning-domen.uz/admin`).
2. Login va parolni kiriting, **Kirish** tugmasini bosing.
3. 5 marta noto‘g‘ri parol kiritilsa, kirish 15 daqiqaga to‘xtatiladi. Bu begona odamlar parol topishga urinishidan himoya qiladi.

Telefonda pastki menyuda eng kerakli bo‘limlar turadi, qolganlari **Menyu** tugmasida.

## 2. Rollar

| Rol | Nima qila oladi |
|---|---|
| Bosh tashkilotchi | Hamma bo‘limlar, mavsumni yakunlash, liga ma’lumotlari, foydalanuvchilar |
| Administrator | Jamoalar, futbolchilar, qur’a, o‘yinlar, natijalar, yangiliklar, homiylar |
| Natija kirituvchi | Faqat o‘yin natijalarini kiritadi, qolganini ko‘radi |
| Muharrir | Yangiliklar va homiylar |

Har kim faqat o‘z roliga kerakli bo‘limlarni ko‘radi. Cheklov serverda ham tekshiriladi, ya’ni havolani qo‘lda yozib ham yopiq bo‘limga kirib bo‘lmaydi.

## 3. Mavsum boshidan oxirigacha

Boshqaruv panelining yuqorisida **Mavsum bosqichlari** turadi: qaysi qadam bajarilgani, hozir nima qilish kerakligi va diqqat talab qiladigan ishlar (masalan, qur’a yoki sanasi belgilanmagan o‘yinlar) tugmasi bilan ko‘rsatiladi. **Barcha bosqichlar** bosilsa, to‘liq ro‘yxat ochiladi.

Odatdagi tartib:

1. **Mavsumlar → Yangi mavsum.** Yil, nomi, sanalari va ochko qoidalarini kiriting. So‘ng **Boshlash** tugmasi bilan mavsumni joriy qiling.
2. **Jamoalar → Jamoa qo‘shish.** Nomi, qisqa nomi (masalan, NAV), qishlog‘i, ranglari va logotipi (ixtiyoriy: bo‘lmasa, nishon ranglardan avtomatik yasaladi).
   - Shu oynaning o‘zida **Futbolchilarni hozir kiritish** bo‘limi bor (ixtiyoriy). Qatorma-qator yozing yoki ro‘yxatni Telegram, Excel yoki daftardan nusxalab **Ro‘yxatni qo‘yish** maydoniga qo‘ying: «10 Aliyev Vali hujumchi». Raqam va pozitsiya ixtiyoriy.
   - Jamoani keyin **qalam** belgisi bilan tahrirlash yoki o‘chirish mumkin. O‘tgan mavsum jamoalarini yangi mavsumga **Mavsumda** tugmachasi bilan qo‘shasiz.
3. **Futbolchilar.** Bitta futbolchi — **Futbolchi qo‘shish**; butun tarkib birdaniga — **Ro‘yxatdan qo‘shish**. Bir jamoada bir xil raqam ikki marta bo‘lsa, xato qator raqami bilan darhol ko‘rsatiladi. Telefon raqami saytda ko‘rinmaydi.
4. **Guruhlar → Qur’a.** Tizim jamoalar soniga qarab guruh variantlarini taklif qiladi (masalan, 20 jamoa — 5 ta to‘rtlik; 36 jamoa — 9 ta to‘rtlik yoki 4 ta beshlik va 4 ta to‘rtlik) va har biri uchun nechta jamoa pley-offga chiqishini yozadi. **Tavsiya etiladi** belgisi — eng qulay variant.
   - Taqsimlash usuli: **Tasodifiy qur’a**, **Savatlar bo‘yicha** (o‘tgan mavsumda kuchli bo‘lgan jamoalar har xil guruhga tushadi) yoki **Qo‘lda**.
   - **Bir qishloq jamoalari imkon qadar bir guruhga tushmasin** belgilansa, bir qishloqdan bo‘lgan jamoalar har xil guruhlarga taqsimlanadi.
   - Natijani ko‘ring, kerak bo‘lsa **Qayta tashlash**, so‘ng **Tasdiqlash va saqlash**.
   - Tasdiqlanishi bilan **juftliklar o‘zi tuziladi**: har bir jamoa guruhdagi boshqa jamoalar bilan o‘ynaydi, o‘yinlar turlar bo‘yicha taqsimlanadi (bir turda jamoa bitta o‘yin o‘ynaydi).
5. **O‘yinlar → sanalarni belgilash.** Sayt o‘yin sanasini o‘zi qo‘ymaydi — har bir o‘yinning sanasi va vaqtini siz belgilaysiz. Sahifa tepasida **Sanasi belgilanmagan o‘yinlar** ro‘yxati turlar bo‘yicha turadi:
   - har bir qatorda sana, boshlanish vaqti va maydonni tanlang (maydon sifatida **Mirzacho‘l Birlik Arena** oldindan tanlangan);
   - butun tur bir kunda o‘tsa, tur qatoridagi sanani tanlab **Bo‘shlarga qo‘yish** bosing — keyin har o‘yinga faqat vaqtini yozasiz;
   - pastdagi **Saqlash** tugmasi tanlanganlarning hammasini birdaniga saqlaydi — o‘yin saytda o‘sha zahoti sana va vaqti bilan chiqadi;
   - bir jamoaga yaqin vaqtda ikki o‘yin belgilansa yoki stadion band bo‘lsa, ogohlantirish chiqadi. Bir o‘yin maydonni taxminan 2 soat band qiladi (masalan, 10:00, 12:30, 15:00, 17:30);
   - sanani keyin o‘zgartirish uchun «Barcha o‘yinlar» ro‘yxatida o‘yinni **Tahrirlash** orqali oching.
   Saqlanmaguncha muxlislar o‘yinni «Sana belgilanmagan» deb ko‘radi, natija ham kiritilmaydi.
6. **Natijalar.** O‘yin tugagach, hisobni va gol mualliflarini kiriting (pastga qarang). Natija faqat sanasi belgilangan o‘yinga kiritiladi.
7. **Pley-off — o‘zi tuziladi.** Oxirgi guruh o‘yini natijasi saqlanishi bilan tizim guruhdan chiqqanlarni aniqlaydi, setkani tuzadi va raqiblarni belgilaydi:
   - 4 jamoali guruhdan 1- va 2-o‘rin, 5 jamoali guruhdan 1-, 2- va 3-o‘rin chiqadi (o‘zgartirish: **Sozlamalar → Guruhdan pley-offga chiqadiganlar**).
   - Chiqqanlar soni setkaga to‘g‘ri kelmasa (masalan, 20 ta), eng kuchlilar to‘g‘ridan-to‘g‘ri 1/8 finalga chiqadi, qolganlari **saralash o‘yinlari**da bo‘sh joylar uchun o‘ynaydi.
   - Bir guruhdan chiqqan jamoalar imkon qadar birinchi o‘yinda uchrashmaydi.
   - **Sizdan faqat sana va vaqt kerak:** **Pley-off** (yoki **O‘yinlar**) bo‘limida har o‘yin qatorida sana, vaqt va maydonni tanlab **Saqlash** bosing. Belgilanmaguncha saytda «Sana belgilanmagan» deb turadi.
   - Saytdagi setka ikki tomondan markazdagi Finalga yig‘iladi; g‘olib o‘tgan yo‘l oltin chiziq bilan ko‘rsatiladi, final o‘ynalgach chempion e’lon qilinadi.
   - G‘olib keyingi bosqichga o‘zi o‘tadi.
8. **Teng holat va qur’a.** Guruhda jamoalar barcha mezonlar bo‘yicha teng bo‘lsa (ochko, o‘zaro o‘yin, to‘plar farqi, gollar, fair play), **Pley-off** bo‘limida «Setka qur’ani kutyapti» xabari va **Qur’a tashlash** tugmasi chiqadi. Tizim tasodifiy tartib tanlaydi yoki jonli qur’a natijasini qo‘lda kiritasiz. Natija jadvalda darhol ko‘rinadi va setka tuziladi.
9. **Mavsumlar → Yakunlash** (faqat bosh tashkilotchi). Tizim chempion, sovrindorlar va to‘purarni ko‘rsatadi; tasdiqlangach mavsum arxivga o‘tadi va tahrirdan qulflanadi.

## 4. Natija kiritish

1. **Natijalar** bo‘limida o‘yinni tanlang.
2. **Eng tez usul — «Gol» tugmasi.** Jamoa hisobi ostidagi **Gol** tugmasini bosing — shu jamoa futbolchilari chiqadi. Gol urganni bosing: hisob o‘zi bittaga oshadi va gol uning nomiga yoziladi (to‘purarlar ro‘yxatida darhol ko‘rinadi). Yuqorida gol turini tanlash mumkin: **Gol**, **Penalti**, **Avtogol** (avtogolda raqib futbolchilari chiqadi). Muallif ma’lum bo‘lmasa — **Muallif noma’lum**.
3. **Kartochka** tugmasi xuddi shunday: turini (**Sariq**, **Ikkinchi sariq**, **Qizil**) tanlab, futbolchini bosing.
4. O‘yin «Jonli» holatda bo‘lsa, joriy daqiqa o‘zi yoziladi. Daqiqa, assist va boshqa tafsilotlarni pastdagi ro‘yxatda tuzatish mumkin. «+» va «−» tugmalari ham ishlaydi.
5. Pastda tekshiruv natijasi chiqadi. «Ma’lumotlar mos. Saqlashga tayyor» yozuvi bo‘lsa, **Natijani saqlash** tugmasini bosing.

Saqlangandan keyin turnir jadvali, ochkolar, to‘purarlar va intizom jadvali darhol yangilanadi. Natijani keyin tahrirlasangiz, eski natija to‘liq almashtiriladi, hech narsa ikki marta hisoblanmaydi.

**Diskvalifikatsiya.** 2 ta sariq (har xil o‘yinlarda) yoki qizil/ikkinchi sariq olgan futbolchi jamoasining keyingi o‘yinini o‘tkazib yuboradi. Tizim buni o‘zi hisoblaydi: natija kiritish sahifasida «Bu o‘yinda o‘ynamasligi kerak» ogohlantirishi chiqadi, «Gol» va «Kartochka» oynalarida futbolchi «Diskvalifikatsiyada» deb belgilanadi, boshqaruv panelida alohida ro‘yxat bor. Muxlislar ham buni Statistika → Kartochkalar, o‘yin va jamoa sahifalarida ko‘radi.

**Telegram uchun natija rasmi.** Natija saqlangach, ro‘yxat tepasida «Natija saqlandi» xabari va **Natija rasmi** tugmasi chiqadi. Rasmda gerblar, hisob, gol urganlar, qizil kartochkalar, sana va stadion bor. **Yuklab olish** yoki telefonda **Ulashish** (Telegram’ni tanlaysiz). **Matnni nusxalash** — post uchun tayyor matn. Yakunlangan o‘yinlar ro‘yxatidagi **Rasm** tugmasi ham shu.

**Anons rasmi.** Kutilayotgan o‘yin uchun **O‘yinlar** bo‘limida har bir o‘yin yonida **Rasm** tugmasi bor (saytdagi o‘yin sahifasida — **Anons rasmi**). Rasmda ikki jamoa, o‘rtadagi tabloda boshlanish vaqti, pastdagi oltin chiptada kun, stadion va sana bo‘ladi. Sana hali belgilanmagan bo‘lsa, «Sana tez orada e’lon qilinadi» deb chiqadi. Fayl nomi `payariq-anons-…png` ko‘rinishida saqlanadi.

Rasm ostida sayt manzili faqat haqiqiy domen bo‘lganda chiqadi (masalan, `payariqliga.uz`); kompyuterdagi sinov manzili (localhost) hech qachon yozilmaydi. Rasm brauzerning o‘zida tayyorlanadi, hech qayerga yuborilmaydi.

**Bayonnoma.** Natijalar ro‘yxatida yoki natija kiritish sahifasida **Bayonnoma** tugmasi — A4 varaqqa chop etiladigan o‘yin bayonnomasi: ikkala jamoa tarkibi raqamlari bilan, gol va kartochka uchun bo‘sh kataklar, hakam va jamoa vakillari imzosi. Diskvalifikatsiyadagi futbolchi chizib qo‘yiladi. O‘yindan keyin ochilsa, natija bilan to‘ldirilgan bo‘ladi. **Chop etish** tugmasini bosing.

Maxsus holatlar:

- **O‘yin holati** bo‘limida o‘yinni «Qoldirilgan» yoki «Bekor qilingan» deb belgilash mumkin.
- Jamoa kelmasa, **texnik mag‘lubiyat** tanlang: hisob avtomatik 0:3 bo‘ladi.
- Pley-offda durang bo‘lsa, qo‘shimcha vaqt va penaltilar seriyasi hisobi so‘raladi.

### Telegram bot orqali jonli o‘yin

Stadionda turib gollarni telefondan kiritish uchun **@payariq_OltinLiga_bot** bor. U faqat ulangan adminlarga javob beradi (bosh tashkilotchi, administrator, natija kirituvchi).

**Bir martalik ulash**
1. Saytdagi panelda **Hisobim → Telegram'ni ulash** tugmasini bosing — Telegram ochiladi.
2. Botda **Start** (Boshlash) tugmasini bosing. «Telegram akkauntingiz ulandi» xabari chiqadi, saytda ham «Ulangan» deb ko‘rinadi.
3. Havola 10 daqiqa amal qiladi va faqat bir marta ishlaydi. Uzish — o‘sha joyda **Uzish** tugmasi.

**O‘yin kuni**
1. Botdagi **Bugungi o‘yinlar** tugmasi → o‘yinni tanlang → **O‘yinni boshlash**. Saytda o‘yin «Jonli» bo‘ladi, daqiqa o‘zi yuradi.
2. Gol: **⚽ Jamoa gol** → gol urgan futbolchini bosing. Hisob bittaga oshadi, gol uning nomiga yoziladi. Yuqorida **Penalti** va **Avtogol** turlari, pastda **Muallif noma’lum** bor.
3. Kartochka: **🟨🟥 Kartochka** → sariq yoki qizil, jamoa → futbolchi. Bir o‘yinda ikkinchi sariq o‘zi «ikkinchi sariq» bo‘ladi.
4. Xato bosilsa: **↩️ Bekor qilish** — oxirgi hodisa o‘chiriladi (tasdiq so‘raladi), gol bo‘lsa hisob ham kamayadi.
5. **⏸ Tanaffus** → **▶️ 2-bo‘limni boshlash**. Pley-offda durang bo‘lsa **⏱ Qo‘shimcha vaqt** va **🎯 Penaltilar** tugmalari chiqadi.
6. **🏁 O‘yin tugadi** → tasdiqlang. Jadval, to‘purarlar va setka o‘zi yangilanadi.

Har bir amal saytda **darhol** ko‘rinadi: o‘yin sahifasini ochib turgan muxlislarda «GOL!» xabari chiqadi, hisob o‘zi yangilanadi. Tugma ikki marta bosilsa ham gol bir marta yoziladi. Bot orqali qilingan har bir amal «O‘zgarishlar tarixi»da «(Telegram)» belgisi bilan turadi.

Bir bo‘lim davomiyligi (daqiqa hisobi uchun) **Sozlamalar → Bir bo‘lim davomiyligi**da o‘zgartiriladi (standart 25 daqiqa).

## 5. Yangiliklar va homiylar

- **Yangiliklar → Yangilik qo‘shish.** Sarlavha va matnni yozing. **Qoralama sifatida saqlash** saytga chiqarmaydi. **Muhim e’lon** belgilansa, yangilik bosh sahifaning yuqorisida turadi.
- **Homiylar → Homiy qo‘shish.** Nomi, darajasi, logotipi va sayt havolasi. **Saytda ko‘rsatish** o‘chirilsa, homiy vaqtincha yashiriladi.

## 6. Sozlamalar

- **Liga nizomi**: ochkolar, bir yoki ikki davrali tizim, teng ochkoda o‘rinni aniqlash tartibi va **Guruhdan pley-offga chiqadiganlar** (3, 4, 5 va 6 jamoali guruhlar uchun alohida). O‘zgartirilsa, jadval va setka darhol qayta hisoblanadi (pley-off o‘yinlari boshlanmagan bo‘lsa). Muxlislar uchun hammasi saytdagi **Musobaqa nizomi** sahifasida avtomatik tushuntiriladi.
- **Ochko o‘zgarishlari**: jarima yoki bonus ochko (masalan, −3). Sababi saytdagi jadval ostida ko‘rinadi.
- **Liga ma’lumotlari** (bosh tashkilotchi): nomi, hududi, aloqa telefoni, Telegram.
- **Maydonlar**: o‘yin o‘tkaziladigan stadion. Barcha o‘yinlar **Mirzacho‘l Birlik Arena**da o‘tadi; u birinchi o‘rnatishda avtomatik qo‘shiladi. Bu yerda nomini o‘zgartirish yoki manzil (qishloq) qo‘shish mumkin.
- **Foydalanuvchilar** (bosh tashkilotchi): yordamchilarni boshqarish (pastga qarang).
- **O‘zgarishlar tarixi**: kim, qachon, nimani o‘zgartirgani.

## 7. Yordamchilarni qo‘shish

1. **Sozlamalar → Foydalanuvchilar → Yordamchi qo‘shish.**
2. Ism-familiyasi, login (lotin harflarida, masalan `akmal`) va rolini tanlang.
3. Parolni o‘zingiz yozing yoki **Yaratish** tugmasi bilan kuchli parol oling.
4. **Yordamchini qo‘shish** bosilgach, login va parol ko‘rsatiladi. **Login va parolni nusxalash** tugmasi bilan ularni yordamchiga shaxsiy xabarda yuboring. Oyna yopilgach parol boshqa ko‘rsatilmaydi.

Ro‘yxatdagi tugmalar:

- **Kalit belgisi**: yordamchi parolni unutsa, unga yangi parol o‘rnatish.
- **Qalam belgisi**: ismni, rolni o‘zgartirish yoki akkauntni o‘chirish. O‘chirilgan yoki roli o‘zgargan yordamchi tizimdan darhol chiqariladi.

O‘z akkauntingizni o‘chira olmaysiz va rolingizni pasaytira olmaysiz. Tizimda doim kamida bitta faol bosh tashkilotchi qoladi.

## 8. Parolni almashtirish

Chap menyuning pastidagi ismingizni bosing (**Hisobim** sahifasi). Joriy parolni va yangi parolni ikki marta kiriting.

Parol talablari: kamida 10 belgi, harf va raqamlar aralash, ichida login bo‘lmasin.

## 9. Ko‘p beriladigan savollar

**Natijani xato kiritdim.** O‘yinni qayta oching, tuzating va saqlang. Jadval qayta hisoblanadi.

**Jadvalda jamoa yonida `*` belgisi bor.** Bu teng ochkoli jamoalarni nizomdagi barcha mezonlar ham ajrata olmaganini bildiradi. Guruh bosqichi tugagach, **Pley-off** bo‘limida **Qur’a tashlash** tugmasi chiqadi — qur’adan keyin o‘rinlar aniqlanadi.

**Botda o‘yin ko‘rinmayapti.** Botda faqat faol mavsumning bugungi (va kechagi tugallanmagan) o‘yinlari chiqadi, sanasi belgilangan bo‘lishi kerak. O‘yin boshqa kunga qo‘yilgan bo‘lsa, **O‘yinlar** bo‘limida sanasini bugunga o‘zgartiring.

**Bot javob bermayapti.** Server yoniq ekanini tekshiring: bot server ichida ishlaydi, server o‘chsa bot ham to‘xtaydi. Telegram'ni uzib qayta ulash ham mumkin (**Hisobim**).

**O‘yin sanasini sayt o‘zi qo‘yadimi?** Yo‘q. Sayt faqat juftliklarni (kim kim bilan o‘ynashini) tuzadi. Har bir o‘yinning sanasi va vaqtini siz **O‘yinlar** yoki **Pley-off** bo‘limida belgilaysiz.

**Qur’adan keyin juftliklar chiqmadi.** **O‘yinlar** bo‘limidagi **Juftliklarni tuzish** tugmasini bosing — u o‘yinlari yo‘q guruhlar uchun juftliklarni tuzadi.

**Natija kiritish sahifasida «Avval o‘yin sanasini belgilang» chiqdi.** Bu o‘yinning sanasi hali qo‘yilmagan. **Sanani belgilash** tugmasi orqali sana va vaqtni saqlang, so‘ng natijani kiriting.

**Pley-off setkasi tuzilmayapti.** Pley-off bo‘limidagi xabarni o‘qing: guruh bosqichida o‘yin qolgan bo‘lsa — natijalarni kiriting; teng holat bo‘lsa — qur’a tashlang. Boshqa hech narsa talab qilinmaydi.

**Pley-off o‘yini sanasini o‘zgartirmoqchiman.** Pley-off bo‘limida o‘sha o‘yin qatorida yangi sana va vaqtni tanlab **Saqlash** bosing.

**Setkani boshqatdan tuzmoqchiman.** Pley-off o‘yinlari boshlanmagan bo‘lsa, **Setkani o‘chirish**, so‘ng **Setkani tuzish**. Birinchi pley-off natijasi kiritilgach, setka qotadi.

**Muxlislar o‘z jamoasini qanday kuzatadi?** Saytdagi jamoa sahifasida **Mening jamoam qilish** tugmasi yoki bosh sahifadagi **Mening jamoam** bloki orqali. Shundan keyin bosh sahifada jamoaning o‘rni, keyingi o‘yini va oxirgi natijasi ko‘rinadi.

**Eski mavsumni tahrirlay olmayapman.** Yakunlangan mavsum arxivga qulflanadi. Yuqoridagi mavsum tanlagichdan joriy mavsumni tanlang.

**Yordamchi «Bu bo‘lim sizning rolingiz uchun yopiq» deb ko‘ryapti.** Uning roli bu bo‘limni ochmaydi. Kerak bo‘lsa, bosh tashkilotchi rolini o‘zgartiradi.
