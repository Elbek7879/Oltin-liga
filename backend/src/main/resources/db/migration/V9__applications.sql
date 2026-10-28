-- Saytdan keladigan murojaatlar: yangi mavsumga qo'shilish arizalari hamda taklif, shikoyat va murojaatlar.
-- Admin «Arizalar» bo'limida ko'radi. Jamoa arizasi qabul qilinsa, jamoa va futbolchilar tanlangan mavsumga qo'shiladi.

create table team_applications (
    id            uuid primary key,
    team_name     varchar(40) not null,
    village       varchar(60),
    logo_url      varchar(80) not null,
    contact_phone varchar(20),
    status        varchar(10) not null default 'NEW' check (status in ('NEW', 'ACCEPTED', 'IGNORED')),
    -- Qabul qilingach: qaysi mavsumga va qaysi jamoa sifatida qo'shilgani
    season_id     uuid references seasons (id) on delete set null,
    team_id       uuid references teams (id) on delete set null,
    decided_at    timestamptz,
    decided_by    varchar(80),
    version       integer     not null default 0,
    created_at    timestamptz not null,
    updated_at    timestamptz not null
);

create index team_applications_created on team_applications (created_at desc);

create table team_application_players (
    application_id uuid        not null references team_applications (id) on delete cascade,
    sort_order     integer     not null,
    first_name     varchar(40) not null,
    last_name      varchar(40) not null,
    birth_year     integer     check (birth_year between 1950 and 2020),
    position       varchar(2)  not null check (position in ('GK', 'DF', 'MF', 'FW')),
    primary key (application_id, sort_order)
);

create table feedback_messages (
    id          uuid primary key,
    -- SUGGESTION — taklif, COMPLAINT — shikoyat, REQUEST — murojaat
    kind        varchar(10)   not null check (kind in ('SUGGESTION', 'COMPLAINT', 'REQUEST')),
    body        varchar(2000) not null,
    author_name varchar(60),
    phone       varchar(20),
    status      varchar(10)   not null default 'NEW' check (status in ('NEW', 'READ')),
    version     integer       not null default 0,
    created_at  timestamptz   not null,
    updated_at  timestamptz   not null
);

create index feedback_messages_created on feedback_messages (created_at desc);
