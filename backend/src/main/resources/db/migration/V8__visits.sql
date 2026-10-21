-- Tashrif statistikasi. Muxlis brauzerida tasodifiy anonim raqam saqlanadi; bazaga uning xeshi yoziladi.
-- Ism, telefon, IP manzil yoki brauzer ma'lumoti saqlanmaydi.

-- Har kuni har bir tashrif buyuruvchi uchun bitta qator: noyob odamlar kun, hafta, oy va jami bo'yicha sanaladi
create table visit_days (
    day     date        not null,
    visitor varchar(64) not null,
    -- qayerdan kelgan: telegram, instagram, google, yandex, youtube, facebook, other, direct
    source  varchar(16) not null,
    -- phone yoki desktop
    device  varchar(8)  not null,
    views   integer     not null default 1,
    primary key (day, visitor)
);

-- Sahifa ochilishlari soni (kunlik)
create table visit_pages (
    day   date         not null,
    path  varchar(200) not null,
    views integer      not null default 0,
    primary key (day, path)
);
