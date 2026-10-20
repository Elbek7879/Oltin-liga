-- Liganing ijtimoiy tarmoqlari: saytda logotiplar bilan ko'rsatiladi (bo'sh bo'lsa — ko'rsatilmaydi)
alter table league_settings add column telegram_channel varchar(200) not null default '';
alter table league_settings add column instagram        varchar(200) not null default '';
alter table league_settings add column youtube          varchar(200) not null default '';
