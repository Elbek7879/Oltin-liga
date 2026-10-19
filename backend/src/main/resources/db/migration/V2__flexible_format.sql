-- Moslashuvchan turnir formati:
-- * guruhdan chiqadigan jamoalar soni guruh hajmiga bog'liq (4 jamoali — 2 ta, 5 jamoali — 3 ta);
-- * pley-offga chiqqanlar soni 2 ning darajasi bo'lmasa, saralash o'yinlari (R64 ham bo'lishi mumkin);
-- * avtomatik tuzilgan pley-off o'yinlarining sana-vaqti tashkilotchi tasdiqlaguncha «belgilanmagan»;
-- * teng holatdagi qur'a natijalari;
-- * futbolchi pozitsiyasi ixtiyoriy (tezkor kiritish uchun).

alter table seasons add column qualifiers_by_size varchar(60) not null default '3:2,4:2,5:3,6:3';

alter table matches drop constraint matches_playoff_round_check;
alter table matches add constraint matches_playoff_round_check
    check (playoff_round in ('R64', 'R32', 'R16', 'QF', 'SF', 'THIRD', 'F'));
alter table matches add column time_confirmed boolean not null default true;

alter table players alter column position drop not null;

create table tiebreak_lots (
    id         uuid primary key,
    season_id  uuid          not null references seasons (id) on delete cascade,
    -- "GROUP:<guruh id>" — guruh ichidagi o'rin; "SEED:<o'rin>" — pley-off reytingi
    scope      varchar(80)   not null,
    -- Qur'a natijasi: season_team id'lari tartib bilan, vergul bilan ajratilgan
    team_order varchar(2000) not null,
    version    integer       not null default 0,
    created_at timestamptz   not null,
    updated_at timestamptz   not null,
    unique (season_id, scope)
);
