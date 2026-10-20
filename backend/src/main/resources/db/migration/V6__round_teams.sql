-- Ramziy jamoa: tur (yoki pley-off bosqichi) yakunida tashkilotchi tanlagan 5 futbolchi —
-- darvozabon, himoyachi, ikki yarim himoyachi (chap va o'ng) va hujumchi.
-- Gollar, uzatmalar va quruq o'yinlar saqlanmaydi: ular o'yin natijalaridan hisoblanadi.
create table round_teams (
    id            uuid primary key,
    season_id     uuid        not null references seasons (id),
    stage         varchar(10) not null check (stage in ('GROUP', 'PLAYOFF')),
    round         integer     check (round between 1 and 99),
    playoff_round varchar(10) check (playoff_round in ('R64', 'R32', 'R16', 'QF', 'SF', 'THIRD', 'F')),
    published     boolean     not null default false,
    published_at  timestamptz,
    version       integer     not null default 0,
    created_at    timestamptz not null,
    updated_at    timestamptz not null,
    -- Guruh bosqichi — tur raqami bilan, pley-off — bosqich nomi bilan
    check ((stage = 'GROUP' and round is not null and playoff_round is null)
        or (stage = 'PLAYOFF' and playoff_round is not null and round is null))
);

-- Bitta tur (bosqich) uchun bitta ramziy jamoa
create unique index round_teams_one_per_round on round_teams (season_id, stage, coalesce(round, 0), coalesce(playoff_round, ''));

create table round_team_players (
    round_team_id  uuid        not null references round_teams (id) on delete cascade,
    slot           varchar(10) not null check (slot in ('GK', 'DF', 'MF_L', 'MF_R', 'FW')),
    player_id      uuid        not null references players (id),
    season_team_id uuid        not null references season_teams (id),
    primary key (round_team_id, slot),
    -- Bir futbolchi ramziy jamoada faqat bitta o'rinda
    unique (round_team_id, player_id)
);

create index round_team_players_player on round_team_players (player_id);
