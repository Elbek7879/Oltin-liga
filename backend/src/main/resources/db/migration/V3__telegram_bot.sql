-- Adminlar uchun Telegram bot:
-- * admin akkaunti bilan Telegram chat bog'lanishi (bot faqat bog'langan adminlarga javob beradi);
-- * jonli o'yin soati: qaysi bo'lim davom etmoqda va u qachon boshlangan (daqiqa avtomatik hisoblanadi);
-- * mavsum nizomida bir bo'lim davomiyligi (mini-futbol: odatda 2 × 25 daqiqa).

create table telegram_links (
    id                uuid primary key,
    user_id           uuid        not null unique references app_users (id) on delete cascade,
    chat_id           bigint      not null unique,
    telegram_username varchar(64),
    version           integer     not null default 0,
    created_at        timestamptz not null,
    updated_at        timestamptz not null
);

alter table matches add column live_period varchar(16);
alter table matches add constraint matches_live_period_check
    check (live_period in ('FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'EXTRA_TIME', 'PENALTIES'));
alter table matches add column period_started_at timestamptz;

alter table seasons add column half_minutes integer not null default 25;
alter table seasons add constraint seasons_half_minutes_check check (half_minutes between 5 and 60);
