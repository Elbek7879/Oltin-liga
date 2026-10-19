-- Payariq Oltin Ligasi: boshlang'ich sxema.
-- Yagona ishonchli manba: matches (holat va hisob) va match_events (gollar, kartochkalar).
-- Turnir jadvali va statistikalar saqlanmaydi — ular har safar shu jadvallardan hisoblanadi.

create table app_users (
    id            uuid primary key,
    username      varchar(50)  not null,
    password_hash varchar(100) not null,
    display_name  varchar(80)  not null,
    role          varchar(20)  not null check (role in ('SUPER_ADMIN', 'ADMIN', 'RESULT_ENTRY', 'EDITOR')),
    enabled       boolean      not null default true,
    last_login_at timestamptz,
    version       integer      not null default 0,
    created_at    timestamptz  not null,
    updated_at    timestamptz  not null
);
create unique index app_users_username_uq on app_users (lower(username));

create table league_settings (
    id            uuid primary key,
    name          varchar(80)  not null,
    short_name    varchar(40)  not null,
    region        varchar(120) not null,
    about         text         not null,
    contact_phone varchar(30)  not null default '',
    telegram      varchar(60)  not null default '',
    version       integer      not null default 0,
    created_at    timestamptz  not null,
    updated_at    timestamptz  not null
);

create table seasons (
    id                   uuid primary key,
    number               integer      not null unique,
    name                 varchar(60)  not null,
    year                 integer      not null,
    start_date           date         not null,
    end_date             date         not null,
    status               varchar(10)  not null check (status in ('DRAFT', 'ACTIVE', 'FINISHED')),
    points_win           integer      not null default 3,
    points_draw          integer      not null default 1,
    points_loss          integer      not null default 0,
    tiebreakers          varchar(200) not null,
    legs                 integer      not null default 1 check (legs in (1, 2)),
    qualifiers_per_group integer      not null default 2 check (qualifiers_per_group between 1 and 8),
    third_place_match    boolean      not null default true,
    version              integer      not null default 0,
    created_at           timestamptz  not null,
    updated_at           timestamptz  not null,
    check (end_date >= start_date),
    check (points_win >= points_draw and points_draw >= points_loss)
);
-- Bir vaqtda faqat bitta faol mavsum bo'lishi mumkin
create unique index seasons_one_active on seasons (status) where status = 'ACTIVE';

create table teams (
    id              uuid primary key,
    name            varchar(40)  not null,
    short_name      varchar(4)   not null,
    village         varchar(60)  not null,
    primary_color   varchar(7)   not null,
    secondary_color varchar(7)   not null,
    founded         integer,
    logo_url        varchar(300),
    active          boolean      not null default true,
    version         integer      not null default 0,
    created_at      timestamptz  not null,
    updated_at      timestamptz  not null
);
create unique index teams_name_uq on teams (lower(name));

create table players (
    id         uuid primary key,
    first_name varchar(40) not null,
    last_name  varchar(40) not null,
    birth_year integer,
    position   varchar(2)  not null check (position in ('GK', 'DF', 'MF', 'FW')),
    -- Maxfiy: ommaviy API'da hech qachon qaytarilmaydi
    phone      varchar(30),
    photo_url  varchar(300),
    version    integer     not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

-- Jamoaning mavsumdagi ishtiroki. Nom shu mavsum uchun saqlanadi — arxiv o'zgarmaydi.
create table season_teams (
    id         uuid primary key,
    season_id  uuid        not null references seasons (id),
    team_id    uuid        not null references teams (id),
    name       varchar(40) not null,
    short_name varchar(4)  not null,
    captain_id uuid references players (id),
    coach      varchar(80),
    version    integer     not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    unique (season_id, team_id)
);

create table season_rosters (
    id             uuid primary key,
    season_id      uuid        not null references seasons (id),
    season_team_id uuid        not null references season_teams (id) on delete cascade,
    player_id      uuid        not null references players (id),
    shirt_number   integer check (shirt_number between 1 and 99),
    version        integer     not null default 0,
    created_at     timestamptz not null,
    updated_at     timestamptz not null,
    -- Futbolchi bir mavsumda faqat bitta jamoada
    unique (season_id, player_id)
);
create unique index season_rosters_number_uq on season_rosters (season_team_id, shirt_number) where shirt_number is not null;

create table league_groups (
    id         uuid primary key,
    season_id  uuid        not null references seasons (id),
    name       varchar(4)  not null,
    sort_order integer     not null,
    version    integer     not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    unique (season_id, name)
);

create table group_teams (
    group_id       uuid    not null references league_groups (id) on delete cascade,
    position       integer not null,
    season_team_id uuid    not null references season_teams (id),
    primary key (group_id, position),
    -- Bir jamoa guruh bosqichida faqat bitta guruhda bo'ladi
    unique (season_team_id)
);

create table venues (
    id         uuid primary key,
    name       varchar(80) not null,
    village    varchar(60) not null default '',
    version    integer     not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table matches (
    id                  uuid primary key,
    season_id           uuid        not null references seasons (id),
    stage               varchar(10) not null check (stage in ('GROUP', 'PLAYOFF')),
    group_id            uuid references league_groups (id),
    round               integer,
    playoff_round       varchar(6) check (playoff_round in ('R32', 'R16', 'QF', 'SF', 'THIRD', 'F')),
    bracket_index       integer,
    home_id             uuid references season_teams (id),
    away_id             uuid references season_teams (id),
    home_label          varchar(60),
    away_label          varchar(60),
    kickoff             timestamptz not null,
    venue_id            uuid references venues (id),
    status              varchar(10) not null check (status in ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED')),
    home_score          integer check (home_score between 0 and 50),
    away_score          integer check (away_score between 0 and 50),
    home_extra          integer check (home_extra between 0 and 50),
    away_extra          integer check (away_extra between 0 and 50),
    home_pens           integer check (home_pens between 0 and 50),
    away_pens           integer check (away_pens between 0 and 50),
    decided_by          varchar(12) check (decided_by in ('REGULAR', 'EXTRA_TIME', 'PENALTIES', 'FORFEIT')),
    winner_id           uuid references season_teams (id),
    next_match_id       uuid references matches (id),
    next_slot           varchar(4) check (next_slot in ('home', 'away')),
    loser_next_match_id uuid references matches (id),
    loser_next_slot     varchar(4) check (loser_next_slot in ('home', 'away')),
    referee             varchar(80),
    live_minute         integer check (live_minute between 0 and 130),
    note                varchar(300),
    version             integer     not null default 0,
    created_at          timestamptz not null,
    updated_at          timestamptz not null,
    check (home_id is null or away_id is null or home_id <> away_id),
    check (status in ('FINISHED', 'LIVE') or (home_score is null and away_score is null)),
    check (stage <> 'GROUP' or group_id is not null)
);
create index matches_season_kickoff_idx on matches (season_id, kickoff);
create index matches_group_idx on matches (group_id);

create table match_events (
    id             uuid primary key,
    match_id       uuid        not null references matches (id) on delete cascade,
    type           varchar(14) not null check (type in ('GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'YELLOW', 'SECOND_YELLOW', 'RED')),
    minute         integer check (minute between 1 and 130),
    player_id      uuid references players (id),
    season_team_id uuid        not null references season_teams (id),
    assist_id      uuid references players (id),
    version        integer     not null default 0,
    created_at     timestamptz not null,
    updated_at     timestamptz not null
);
create index match_events_match_idx on match_events (match_id);
create index match_events_player_idx on match_events (player_id);

create table match_appearances (
    id             uuid primary key,
    match_id       uuid        not null references matches (id) on delete cascade,
    season_team_id uuid        not null references season_teams (id),
    player_id      uuid        not null references players (id),
    version        integer     not null default 0,
    created_at     timestamptz not null,
    updated_at     timestamptz not null,
    unique (match_id, player_id)
);

create table point_adjustments (
    id             uuid primary key,
    season_id      uuid         not null references seasons (id),
    season_team_id uuid         not null references season_teams (id),
    points         integer      not null check (points <> 0 and points between -50 and 50),
    reason         varchar(200) not null,
    created_by     varchar(80),
    version        integer      not null default 0,
    created_at     timestamptz  not null,
    updated_at     timestamptz  not null
);

create table season_awards (
    id             uuid primary key,
    season_id      uuid        not null references seasons (id),
    type           varchar(16) not null check (type in ('CHAMPION', 'RUNNER_UP', 'THIRD', 'TOP_SCORER', 'BEST_PLAYER', 'BEST_GOALKEEPER', 'FAIR_PLAY')),
    season_team_id uuid references season_teams (id),
    player_id      uuid references players (id),
    note           varchar(120),
    version        integer     not null default 0,
    created_at     timestamptz not null,
    updated_at     timestamptz not null,
    unique (season_id, type)
);

create table news (
    id           uuid primary key,
    slug         varchar(100) not null unique,
    title        varchar(120) not null,
    excerpt      varchar(240) not null,
    body         text         not null,
    published_at timestamptz  not null,
    important    boolean      not null default false,
    status       varchar(10)  not null check (status in ('DRAFT', 'PUBLISHED')),
    version      integer      not null default 0,
    created_at   timestamptz  not null,
    updated_at   timestamptz  not null
);
create index news_published_idx on news (status, published_at desc);

create table sponsors (
    id          uuid primary key,
    name        varchar(80)  not null,
    tier        varchar(10)  not null check (tier in ('GENERAL', 'OFFICIAL', 'PARTNER')),
    description varchar(120) not null default '',
    url         varchar(300),
    logo_url    varchar(300),
    active      boolean      not null default true,
    sort_order  integer      not null default 0,
    version     integer      not null default 0,
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);

-- Muhim o'zgarishlar tarixi
create table audit_logs (
    id           uuid primary key,
    username     varchar(50),
    display_name varchar(80),
    action       varchar(30)  not null,
    summary      varchar(500) not null,
    entity_type  varchar(30),
    entity_id    uuid,
    ip_address   varchar(45),
    version      integer      not null default 0,
    created_at   timestamptz  not null,
    updated_at   timestamptz  not null
);
create index audit_logs_created_idx on audit_logs (created_at desc);

-- Tashqi xizmatlarga (Telegram) yuboriladigan hodisalar navbati
create table outbox_events (
    id           uuid primary key,
    type         varchar(40) not null,
    payload      text        not null,
    processed_at timestamptz,
    version      integer     not null default 0,
    created_at   timestamptz not null,
    updated_at   timestamptz not null
);
create index outbox_unprocessed_idx on outbox_events (created_at) where processed_at is null;
