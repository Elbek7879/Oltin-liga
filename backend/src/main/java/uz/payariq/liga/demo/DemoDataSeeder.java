package uz.payariq.liga.demo;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.config.BootstrapRunner;
import uz.payariq.liga.domain.AwardType;
import uz.payariq.liga.domain.Bracket;
import uz.payariq.liga.domain.DecidedBy;
import uz.payariq.liga.domain.EventType;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.NewsStatus;
import uz.payariq.liga.domain.PlayerStats;
import uz.payariq.liga.domain.PlayoffRound;
import uz.payariq.liga.domain.Position;
import uz.payariq.liga.domain.Schedule;
import uz.payariq.liga.domain.SeasonStatus;
import uz.payariq.liga.domain.SponsorTier;
import uz.payariq.liga.domain.StandingsCalculator;
import uz.payariq.liga.model.Appearance;
import uz.payariq.liga.model.LeagueGroup;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.model.News;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.SeasonAward;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.model.Sponsor;
import uz.payariq.liga.model.Team;
import uz.payariq.liga.model.Venue;
import uz.payariq.liga.repo.AppearanceRepository;
import uz.payariq.liga.repo.LeagueGroupRepository;
import uz.payariq.liga.repo.MatchEventRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.NewsRepository;
import uz.payariq.liga.repo.PlayerRepository;
import uz.payariq.liga.repo.RosterEntryRepository;
import uz.payariq.liga.repo.SeasonAwardRepository;
import uz.payariq.liga.repo.SeasonRepository;
import uz.payariq.liga.repo.SeasonTeamRepository;
import uz.payariq.liga.repo.SponsorRepository;
import uz.payariq.liga.repo.TeamRepository;
import uz.payariq.liga.repo.VenueRepository;

/**
 * Namunaviy ma'lumotlar (faqat liga.demo-data=true va baza bo'sh bo'lganda).
 * Barcha jamoa, futbolchi va homiy nomlari o'ylab topilgan. Frontenddagi seed.ts bilan bir xil mantiq:
 * 2025 — yakunlangan mavsum (penaltilar bilan hal bo'lgan final), 2026 — joriy mavsum (3-tur bugun).
 */
@Component
@Order(2)
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private static final ZoneId ZONE = Schedule.ZONE;

    private static final String[][] TEAMS = {
            {"Navbahor", "NAV", "Payariq", "#145A3A", "#E2BF4F", "1998"},
            {"Do‘stlik", "DOS", "Chelak", "#1D4E89", "#FFFFFF", "2004"},
            {"Lochin", "LOC", "Oqtepa", "#8C2F39", "#F6E7C1", "2010"},
            {"Yulduz", "YUL", "Qo‘shtepa", "#14213D", "#FCA311", "2008"},
            {"Chinor", "CHI", "Toshloq", "#3A5A40", "#E9EDE3", "2012"},
            {"Burgut", "BUR", "Mirzaariq", "#5C3D2E", "#F2E8CF", "2015"},
            {"Zarafshon", "ZAR", "Yangiobod", "#0B6E99", "#F1F7FA", "2006"},
            {"Shalola", "SHA", "Ko‘kdala", "#A23B72", "#FFFFFF", "2017"},
            {"Mehnat", "MEH", "Bog‘ishamol", "#6B4E16", "#F9E79F", "2001"},
            {"Tulpor", "TUL", "Sarbozor", "#2B2D42", "#EDF2F4", "2019"},
            {"Bahor", "BAH", "Navro‘z", "#2D6A4F", "#FFFFFF", "2013"},
            {"Ittifoq", "ITT", "Do‘rmon", "#9D0208", "#FFD166", "2009"},
            {"Oltin Soy", "OLS", "Soybo‘yi", "#7F5539", "#FFE8A3", "2020"},
            {"Guliston", "GUL", "Guliston", "#386641", "#F2E8CF", "2011"},
            {"Sharq", "SHQ", "Sharqobod", "#1B4965", "#CAE9FF", "2016"},
            {"Olmazor", "OLM", "Olmazor", "#4A4E69", "#F2E9E4", "2018"},
    };
    private static final double[] STRENGTH = {1.35, 1.25, 1.15, 1.1, 1.0, 0.95, 1.05, 0.9, 1.0, 0.85, 1.1, 0.95, 0.8, 1.0, 0.9, 0.85};
    private static final String[] FIRST = {"Abdulla", "Akmal", "Alisher", "Anvar", "Asilbek", "Bahodir", "Bekzod", "Bobur", "Doniyor", "Elyor",
            "Farhod", "Firdavs", "Husan", "Islom", "Javohir", "Jasur", "Jahongir", "Kamron", "Komil", "Mirjalol", "Muhammadali", "Nodir",
            "Odil", "Otabek", "Rustam", "Sardor", "Sherzod", "Shohruh", "Temur", "Ulug‘bek", "Umid", "Xurshid", "Zafar", "Zohid", "Azizbek",
            "Behruz", "Dilshod", "Eldor", "G‘ayrat", "Ilhom"};
    private static final String[] LAST = {"Abdullayev", "Aliyev", "Boboyev", "Ergashev", "Ibragimov", "Jo‘rayev", "Karimov", "Mamatov",
            "Murodov", "Nazarov", "Normatov", "Ochilov", "Qodirov", "Rahimov", "Saidov", "Salimov", "Tursunov", "Usmonov", "Xolmatov",
            "Yusupov", "Zokirov", "Hamroyev", "Shukurov", "Eshonqulov", "Sobirov", "To‘xtayev"};
    private static final String[] REFEREES = {"Baxtiyor Qosimov", "Sanjar Rashidov", "Ravshan Olimov", "Akbar Toshev", "Shuhrat Islomov"};
    private static final Position[] SHAPE = {Position.GK, Position.GK, Position.DF, Position.DF, Position.DF, Position.DF, Position.DF,
            Position.MF, Position.MF, Position.MF, Position.MF, Position.MF, Position.FW, Position.FW, Position.FW};

    private final boolean enabled;
    private final SeasonRepository seasons;
    private final TeamRepository teams;
    private final SeasonTeamRepository seasonTeams;
    private final PlayerRepository players;
    private final RosterEntryRepository rosters;
    private final LeagueGroupRepository groups;
    private final VenueRepository venues;
    private final MatchRepository matches;
    private final MatchEventRepository events;
    private final AppearanceRepository appearances;
    private final SeasonAwardRepository awards;
    private final NewsRepository news;
    private final SponsorRepository sponsors;

    private final Random rnd = new Random(20260415);
    private final Map<UUID, List<Player>> squadOf = new HashMap<>();
    private final Map<UUID, Double> strengthOf = new HashMap<>();
    private final List<MatchEvent> eventBuffer = new ArrayList<>();
    private final List<Appearance> appearanceBuffer = new ArrayList<>();

    public DemoDataSeeder(@Value("${liga.demo-data:false}") boolean enabled, SeasonRepository seasons, TeamRepository teams,
                          SeasonTeamRepository seasonTeams, PlayerRepository players, RosterEntryRepository rosters, LeagueGroupRepository groups,
                          VenueRepository venues, MatchRepository matches, MatchEventRepository events, AppearanceRepository appearances,
                          SeasonAwardRepository awards, NewsRepository news, SponsorRepository sponsors) {
        this.enabled = enabled;
        this.seasons = seasons;
        this.teams = teams;
        this.seasonTeams = seasonTeams;
        this.players = players;
        this.rosters = rosters;
        this.groups = groups;
        this.venues = venues;
        this.matches = matches;
        this.events = events;
        this.appearances = appearances;
        this.awards = awards;
        this.news = news;
        this.sponsors = sponsors;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled || seasons.count() > 0 || teams.count() > 0) return;
        LocalDate today = LocalDate.now(ZONE);
        log.info("Namunaviy ma'lumotlar yaratilmoqda...");

        // Ligadagi barcha o'yinlar bitta stadionda o'tadi (BootstrapRunner uni birinchi o'rnatishda yaratadi)
        List<Venue> venueList = List.of(mainVenue());
        List<Team> teamList = new ArrayList<>();
        Map<UUID, List<Player>> playersByTeam = new HashMap<>();
        Set<String> used = new HashSet<>();
        for (int i = 0; i < TEAMS.length; i++) {
            String[] d = TEAMS[i];
            Team t = new Team();
            t.name = d[0];
            t.shortName = d[1];
            t.village = d[2];
            t.primaryColor = d[3];
            t.secondaryColor = d[4];
            t.founded = Integer.parseInt(d[5]);
            teams.save(t);
            teamList.add(t);
            strengthOf.put(t.getId(), STRENGTH[i]);
            List<Player> squad = new ArrayList<>();
            for (Position pos : SHAPE) {
                String first, last;
                do {
                    first = FIRST[rnd.nextInt(FIRST.length)];
                    last = LAST[rnd.nextInt(LAST.length)];
                } while (!used.add(first + " " + last));
                Player p = new Player();
                p.firstName = first;
                p.lastName = last;
                p.birthYear = 1990 + rnd.nextInt(16);
                p.position = pos;
                players.save(p);
                squad.add(p);
            }
            playersByTeam.put(t.getId(), squad);
        }

        // ---------- 1-mavsum: 2025 (yakunlangan) ----------
        Season s2025 = season(1, 2025, LocalDate.of(2025, 5, 3), LocalDate.of(2025, 6, 28), SeasonStatus.FINISHED, 2);
        List<Team> teams2025 = teamList.subList(0, 8);
        // Transferlar: 2025 yilda boshqa jamoada o'ynagan futbolchilar
        Map<UUID, UUID> transfers = Map.of(
                playersByTeam.get(teamList.get(0).getId()).get(14).getId(), teamList.get(2).getId(),
                playersByTeam.get(teamList.get(1).getId()).get(13).getId(), teamList.get(3).getId(),
                playersByTeam.get(teamList.get(4).getId()).get(12).getId(), teamList.get(0).getId());
        List<SeasonTeam> st2025 = new ArrayList<>();
        for (Team t : teams2025) {
            List<Player> squad = new ArrayList<>(playersByTeam.get(t.getId()).stream().filter(p -> !transfers.containsKey(p.getId())).toList());
            transfers.forEach((pid, to) -> {
                if (to.equals(t.getId())) playersByTeam.values().stream().flatMap(List::stream).filter(p -> p.getId().equals(pid)).findFirst().ifPresent(squad::add);
            });
            st2025.add(seasonTeam(s2025, t, squad));
        }
        List<UUID> draw2025 = new ArrayList<>(st2025.stream().map(SeasonTeam::getId).toList());
        Collections.shuffle(draw2025, rnd);
        List<LeagueGroup> g2025 = List.of(group(s2025, "A", 0, draw2025.subList(0, 4)), group(s2025, "B", 1, draw2025.subList(4, 8)));
        List<LocalDate> rounds2025 = new ArrayList<>();
        for (int r = 0; r < 6; r++) rounds2025.add(LocalDate.of(2025, 5, 3).plusDays(7L * r));
        List<Match> all2025 = new ArrayList<>();
        for (int gi = 0; gi < g2025.size(); gi++) {
            for (Match m : groupMatches(s2025, g2025.get(gi), rounds2025, gi, venueList)) {
                play(m, null);
                all2025.add(m);
            }
        }
        List<Bracket.GroupFinish> finishes = g2025.stream().map(g -> new Bracket.GroupFinish(g.name,
                StandingsCalculator.compute(g.seasonTeamIds, all2025.stream().filter(m -> g.getId().equals(m.groupId)).toList(), eventBuffer, List.of(), s2025, id -> "")
                        .stream().map(r -> new Bracket.TeamRecord(r.seasonTeamId(), r.played(), r.points(), r.goalDiff(), r.goalsFor(), r.fairPlay())).toList(),
                s2025.qualifiersFor(g.seasonTeamIds.size()))).toList();
        List<Match> bracket = Bracket.create(s2025.getId(), Bracket.plan(finishes, Map.of()), true, venueList.get(0).getId(), (round, i) ->
                round == PlayoffRound.SF ? at(LocalDate.of(2025, 6, 21), i == 0 ? 16 : 18) : at(LocalDate.of(2025, 6, 28), round == PlayoffRound.THIRD ? 15 : 18));
        Map<UUID, Match> byId = new HashMap<>();
        bracket.forEach(m -> byId.put(m.getId(), m));
        for (PlayoffRound round : List.of(PlayoffRound.SF, PlayoffRound.THIRD, PlayoffRound.F)) {
            for (Match m : bracket.stream().filter(x -> x.playoffRound == round).toList()) {
                if (round == PlayoffRound.F) {
                    play(m, new int[] {1, 1});
                    m.homeExtra = 0;
                    m.awayExtra = 0;
                    m.homePens = 4;
                    m.awayPens = 3;
                    m.decidedBy = DecidedBy.PENALTIES;
                    m.winnerId = m.homeId;
                } else {
                    play(m, null);
                    if (m.homeScore.equals(m.awayScore)) {
                        m.homeExtra = 1;
                        m.awayExtra = 0;
                        Player scorer = scorer(squadOf.get(m.homeId), null);
                        eventBuffer.add(event(m, EventType.GOAL, m.homeId, scorer.getId(), null, 104));
                        m.decidedBy = DecidedBy.EXTRA_TIME;
                        m.winnerId = m.homeId;
                    }
                }
                for (Bracket.AdvanceUpdate u : Bracket.advancementUpdates(m)) {
                    Match next = byId.get(u.matchId());
                    if ("home".equals(u.slot())) next.homeId = u.seasonTeamId();
                    else next.awayId = u.seasonTeamId();
                }
            }
        }
        List<Match> reversed = new ArrayList<>(bracket);
        Collections.reverse(reversed);
        matches.saveAll(reversed);
        all2025.addAll(bracket);
        Match fin = bracket.stream().filter(m -> m.playoffRound == PlayoffRound.F).findFirst().orElseThrow();
        Match third = bracket.stream().filter(m -> m.playoffRound == PlayoffRound.THIRD).findFirst().orElseThrow();
        Set<UUID> ids2025 = new HashSet<>(all2025.stream().map(Match::getId).toList());
        List<MatchEvent> ev2025 = eventBuffer.stream().filter(e -> ids2025.contains(e.matchId)).toList();
        List<PlayerStats.Row> stats = PlayerStats.compute(all2025, ev2025, appearanceBuffer.stream().filter(a -> ids2025.contains(a.matchId)).toList());
        PlayerStats.Row top = PlayerStats.topScorers(stats, id -> "").get(0);
        UUID champion = fin.winnerId;
        PlayerStats.Row best = stats.stream().filter(s -> s.seasonTeamId.equals(champion)).max((a, b) -> Integer.compare(a.goals + a.assists, b.goals + b.assists)).orElseThrow();
        award(s2025, AwardType.CHAMPION, champion, null, null);
        award(s2025, AwardType.RUNNER_UP, champion.equals(fin.homeId) ? fin.awayId : fin.homeId, null, null);
        award(s2025, AwardType.THIRD, third.winnerId, null, null);
        award(s2025, AwardType.TOP_SCORER, top.seasonTeamId, top.playerId, top.goals + " ta gol");
        award(s2025, AwardType.BEST_PLAYER, champion, best.playerId, null);
        UUID keeperTeam = st2025.stream().min((a, b) -> Integer.compare(conceded(all2025, a.getId()), conceded(all2025, b.getId()))).orElseThrow().getId();
        award(s2025, AwardType.BEST_GOALKEEPER, keeperTeam, squadOf.get(keeperTeam).stream().filter(p -> p.position == Position.GK).findFirst().orElseThrow().getId(), null);
        award(s2025, AwardType.FAIR_PLAY, PlayerStats.teamDiscipline(st2025.stream().map(SeasonTeam::getId).toList(), all2025, ev2025).get(0).seasonTeamId(), null, null);

        // ---------- 2-mavsum: 2026 (joriy) ----------
        LocalDate round1 = today.minusDays(14);
        Season s2026 = season(2, 2026, round1, today.plusDays(32), SeasonStatus.ACTIVE, 1);
        List<SeasonTeam> st2026 = teamList.stream().map(t -> seasonTeam(s2026, t, playersByTeam.get(t.getId()))).toList();
        List<UUID> draw2026 = new ArrayList<>(st2026.stream().map(SeasonTeam::getId).toList());
        Collections.shuffle(draw2026, rnd);
        String[] names = {"A", "B", "C", "D"};
        for (int gi = 0; gi < 4; gi++) {
            LeagueGroup g = group(s2026, names[gi], gi, draw2026.subList(gi * 4, gi * 4 + 4));
            List<LocalDate> dates = new ArrayList<>();
            for (LocalDate d : List.of(round1, today.minusDays(7), today)) dates.add(gi >= 2 ? d.plusDays(1) : d);
            List<Match> list = groupMatches(s2026, g, dates, gi % 2, venueList);
            int postponedIndex = 0;
            for (Match m : list) {
                if (m.round >= 3) continue;
                if (gi == 3 && m.round == 2 && postponedIndex++ == 1) {
                    m.status = MatchStatus.POSTPONED;
                    m.note = "Kuchli yomg‘ir sababli qoldirildi. Yangi sana tez orada e’lon qilinadi.";
                    continue;
                }
                play(m, null);
            }
        }
        List<Match> todays = matches.findBySeasonIdOrderByKickoffAsc(s2026.getId()).stream()
                .filter(m -> m.round != null && m.round == 3 && LocalDate.ofInstant(m.kickoff, ZONE).equals(today)).toList();
        if (!todays.isEmpty()) play(todays.get(0), null);
        if (todays.size() > 1) {
            Match live = todays.get(1);
            play(live, null);
            live.status = MatchStatus.LIVE;
            live.liveMinute = 63;
            live.decidedBy = null;
            live.winnerId = null;
            List<MatchEvent> late = eventBuffer.stream().filter(e -> e.matchId.equals(live.getId()) && e.minute != null && e.minute > 63).toList();
            for (MatchEvent e : late) {
                eventBuffer.remove(e);
                boolean homeGoal = (e.type.isScoredGoal() && e.seasonTeamId.equals(live.homeId)) || (e.type == EventType.OWN_GOAL && e.seasonTeamId.equals(live.awayId));
                boolean awayGoal = (e.type.isScoredGoal() && e.seasonTeamId.equals(live.awayId)) || (e.type == EventType.OWN_GOAL && e.seasonTeamId.equals(live.homeId));
                if (homeGoal) live.homeScore--;
                if (awayGoal) live.awayScore--;
            }
        }
        matches.flush();
        events.saveAll(eventBuffer);
        appearances.saveAll(dedupeAppearances());

        seedContent(today);
        log.info("Namunaviy ma'lumotlar tayyor: {} jamoa, {} futbolchi, {} o'yin", teams.count(), players.count(), matches.count());
    }

    // ---------- Yordamchilar ----------

    private Venue mainVenue() {
        return venues.findAll().stream()
                .filter(v -> BootstrapRunner.MAIN_VENUE.equals(v.name))
                .findFirst()
                .orElseGet(() -> {
                    Venue v = new Venue();
                    v.name = BootstrapRunner.MAIN_VENUE;
                    return venues.save(v);
                });
    }

    private Season season(int number, int year, LocalDate start, LocalDate end, SeasonStatus status, int legs) {
        Season s = new Season();
        s.number = number;
        s.name = number + "-mavsum";
        s.year = year;
        s.startDate = start;
        s.endDate = end;
        s.status = status;
        s.legs = legs;
        return seasons.save(s);
    }

    private SeasonTeam seasonTeam(Season s, Team t, List<Player> squad) {
        SeasonTeam st = new SeasonTeam();
        st.seasonId = s.getId();
        st.teamId = t.getId();
        st.name = t.name;
        st.shortName = t.shortName;
        st.captainId = squad.stream().filter(p -> p.position == Position.MF).findFirst().orElse(squad.get(0)).getId();
        if (rnd.nextDouble() > 0.35) st.coach = FIRST[rnd.nextInt(FIRST.length)] + " " + LAST[rnd.nextInt(LAST.length)];
        seasonTeams.save(st);
        List<Integer> numbers = new ArrayList<>();
        for (int i = 2; i <= 40; i++) numbers.add(i);
        Collections.shuffle(numbers, rnd);
        for (int i = 0; i < squad.size(); i++) {
            RosterEntry r = new RosterEntry();
            r.seasonId = s.getId();
            r.seasonTeamId = st.getId();
            r.playerId = squad.get(i).getId();
            r.shirtNumber = i == 0 ? 1 : numbers.get(i);
            rosters.save(r);
        }
        squadOf.put(st.getId(), squad);
        strengthOf.put(st.getId(), strengthOf.get(t.getId()));
        return st;
    }

    private LeagueGroup group(Season s, String name, int order, List<UUID> teamIds) {
        LeagueGroup g = new LeagueGroup();
        g.seasonId = s.getId();
        g.name = name;
        g.sortOrder = order;
        g.seasonTeamIds = new ArrayList<>(teamIds);
        return groups.save(g);
    }

    private static final int[][] TIMES = {{10, 0}, {12, 30}, {15, 0}, {17, 30}};

    private List<Match> groupMatches(Season s, LeagueGroup g, List<LocalDate> roundDates, int slotGroup, List<Venue> venueList) {
        Map<Integer, Integer> perRound = new HashMap<>();
        List<Match> result = new ArrayList<>();
        for (Schedule.Pairing p : Schedule.roundRobin(g.seasonTeamIds, s.legs)) {
            int n = perRound.merge(p.round(), 1, Integer::sum) - 1;
            int slot = slotGroup * 2 + n;
            Match m = new Match();
            m.seasonId = s.getId();
            m.stage = MatchStage.GROUP;
            m.groupId = g.getId();
            m.round = p.round();
            m.homeId = p.homeId();
            m.awayId = p.awayId();
            LocalDate date = roundDates.get(p.round() - 1);
            // Bitta stadion: bir kundagi to'rt o'yin to'rt xil vaqtda
            m.kickoff = date.atTime(TIMES[slot][0], TIMES[slot][1]).atZone(ZONE).toInstant();
            m.venueId = venueList.get((slotGroup + n) % venueList.size()).getId();
            m.status = MatchStatus.SCHEDULED;
            matches.save(m);
            result.add(m);
        }
        return result;
    }

    private static Instant at(LocalDate date, int hour) {
        return date.atTime(LocalTime.of(hour, 0)).atZone(ZONE).toInstant();
    }

    /** Puasson taqsimoti bo'yicha gollar soni */
    private int goals(double strength, double opponent) {
        double limit = Math.exp(-1.35 * (strength / opponent));
        int k = 0;
        double p = rnd.nextDouble();
        while (p > limit && k < 6) {
            k++;
            p *= rnd.nextDouble();
        }
        return k;
    }

    private Player scorer(List<Player> squad, UUID exclude) {
        int total = 0;
        int[] w = new int[squad.size()];
        for (int i = 0; i < squad.size(); i++) {
            Player p = squad.get(i);
            w[i] = p.getId().equals(exclude) ? 0 : switch (p.position) {
                case FW -> 6;
                case MF -> 3;
                case DF -> 1;
                case GK -> 0;
            };
            total += w[i];
        }
        int r = rnd.nextInt(total);
        for (int i = 0; i < squad.size(); i++) {
            r -= w[i];
            if (r < 0) return squad.get(i);
        }
        return squad.get(squad.size() - 1);
    }

    private MatchEvent event(Match m, EventType type, UUID team, UUID player, UUID assist, Integer minute) {
        MatchEvent e = new MatchEvent();
        e.matchId = m.getId();
        e.type = type;
        e.seasonTeamId = team;
        e.playerId = player;
        e.assistId = assist;
        e.minute = minute;
        return e;
    }

    /** O'yinni "o'ynaydi": hisob, gollar, kartochkalar va tarkib */
    private void play(Match m, int[] forced) {
        int hs = forced != null ? forced[0] : goals(strengthOf.get(m.homeId), strengthOf.get(m.awayId));
        int as = forced != null ? forced[1] : goals(strengthOf.get(m.awayId), strengthOf.get(m.homeId));
        Set<Integer> minutes = new HashSet<>();
        Map<UUID, Set<UUID>> lineup = new HashMap<>();
        for (UUID side : List.of(m.homeId, m.awayId)) {
            List<Player> squad = squadOf.get(side);
            Set<UUID> on = new LinkedHashSet<>();
            for (Position pos : Position.values()) {
                List<Player> byPos = new ArrayList<>(squad.stream().filter(p -> p.position == pos).toList());
                Collections.shuffle(byPos, rnd);
                int count = switch (pos) {
                    case GK -> 1;
                    case DF, MF -> 4;
                    case FW -> 2;
                };
                byPos.stream().limit(count).forEach(p -> on.add(p.getId()));
            }
            lineup.put(side, on);
        }
        for (int s = 0; s < 2; s++) {
            UUID side = s == 0 ? m.homeId : m.awayId;
            UUID other = s == 0 ? m.awayId : m.homeId;
            int count = s == 0 ? hs : as;
            for (int i = 0; i < count; i++) {
                double roll = rnd.nextDouble();
                int minute = uniqueMinute(minutes);
                if (roll < 0.06) {
                    List<Player> defenders = squadOf.get(other).stream().filter(p -> p.position == Position.DF).toList();
                    Player og = defenders.get(rnd.nextInt(defenders.size()));
                    lineup.get(other).add(og.getId());
                    eventBuffer.add(event(m, EventType.OWN_GOAL, other, og.getId(), null, minute));
                    continue;
                }
                Player sc = scorer(squadOf.get(side), null);
                lineup.get(side).add(sc.getId());
                EventType type = roll < 0.15 ? EventType.PENALTY_GOAL : EventType.GOAL;
                UUID assist = null;
                if (type == EventType.GOAL && rnd.nextDouble() < 0.55) {
                    assist = scorer(squadOf.get(side), sc.getId()).getId();
                    lineup.get(side).add(assist);
                }
                eventBuffer.add(event(m, type, side, sc.getId(), assist, minute));
            }
        }
        for (UUID side : List.of(m.homeId, m.awayId)) {
            List<UUID> on = new ArrayList<>(lineup.get(side));
            Collections.shuffle(on, rnd);
            int yellows = (int) (rnd.nextDouble() * 3.2);
            for (int i = 0; i < yellows; i++) eventBuffer.add(event(m, EventType.YELLOW, side, on.get(i), null, uniqueMinute(minutes)));
            if (rnd.nextDouble() < 0.05) eventBuffer.add(event(m, EventType.RED, side, on.get(on.size() - 1), null, uniqueMinute(minutes)));
            for (UUID pid : lineup.get(side)) {
                Appearance a = new Appearance();
                a.matchId = m.getId();
                a.seasonTeamId = side;
                a.playerId = pid;
                appearanceBuffer.add(a);
            }
        }
        m.status = MatchStatus.FINISHED;
        m.homeScore = hs;
        m.awayScore = as;
        m.decidedBy = DecidedBy.REGULAR;
        m.winnerId = hs > as ? m.homeId : hs < as ? m.awayId : null;
        m.referee = REFEREES[rnd.nextInt(REFEREES.length)];
    }

    private int uniqueMinute(Set<Integer> used) {
        int v;
        do {
            v = 1 + rnd.nextInt(90);
        } while (!used.add(v));
        return v;
    }

    private List<Appearance> dedupeAppearances() {
        Set<String> seen = new HashSet<>();
        return appearanceBuffer.stream().filter(a -> seen.add(a.matchId + ":" + a.playerId)).toList();
    }

    private static int conceded(List<Match> all, UUID st) {
        return all.stream().filter(m -> m.status == MatchStatus.FINISHED && m.involves(st))
                .mapToInt(m -> st.equals(m.homeId) ? m.awayTotal() : m.homeTotal()).sum();
    }

    private void award(Season s, AwardType type, UUID team, UUID player, String note) {
        SeasonAward a = new SeasonAward();
        a.seasonId = s.getId();
        a.type = type;
        a.seasonTeamId = team;
        a.playerId = player;
        a.note = note;
        awards.save(a);
    }

    private void seedContent(LocalDate today) {
        newsItem("3-tur o‘yinlari jadvali e’lon qilindi", "3-tur-oyinlari-jadvali",
                "Guruh bosqichining so‘nggi turi bugun boshlanadi. Barcha o‘yinlar vaqti va maydonlari tasdiqlandi.",
                "Guruh bosqichining uchinchi, hal qiluvchi turi bugun boshlanadi. A va B guruhlari o‘yinlari bugun, C va D guruhlari o‘yinlari ertaga o‘tkaziladi.\n\nHar bir guruhdan ikki jamoa chorak finalga chiqadi.",
                today.minusDays(1), true);
        newsItem("D guruhidagi o‘yin ob-havo sababli qoldirildi", "d-guruhi-oyini-qoldirildi",
                "2-turdagi o‘yinlardan biri kuchli yomg‘ir tufayli boshqa kunga ko‘chirildi.",
                "2-turda D guruhida o‘tishi kerak bo‘lgan o‘yinlardan biri kuchli yomg‘ir sababli qoldirildi.\n\nYangi sana ikki jamoa vakillari bilan kelishilgandan so‘ng e’lon qilinadi.",
                today.minusDays(7), false);
        newsItem("2026-mavsum qur’asi o‘tkazildi", "2026-mavsum-quras-otkazildi",
                "16 ta jamoa to‘rt guruhga taqsimlandi. Guruh bosqichi bir davrali tizimda o‘tadi.",
                "Ikkinchi mavsum qur’asi barcha jamoalar vakillari ishtirokida o‘tkazildi.\n\nHar guruhdan ikki jamoa chorak finalga yo‘l oladi.",
                today.minusDays(20), false);
        sponsor("Payariq Agro Servis", SponsorTier.GENERAL, "Qishloq xo‘jaligi texnikasi va xizmatlari", 1);
        sponsor("Zarafshon Qurilish", SponsorTier.OFFICIAL, "Qurilish materiallari", 2);
        sponsor("Oltin Don Market", SponsorTier.OFFICIAL, "Oziq-ovqat do‘koni", 3);
        sponsor("Chelak Avto Servis", SponsorTier.PARTNER, "Avtomobillarga xizmat ko‘rsatish", 4);
        sponsor("Bog‘bon fermer xo‘jaligi", SponsorTier.PARTNER, "Meva va sabzavotlar", 5);
    }

    private void newsItem(String title, String slug, String excerpt, String body, LocalDate date, boolean important) {
        News n = new News();
        n.title = title;
        n.slug = slug;
        n.excerpt = excerpt;
        n.body = body;
        n.important = important;
        n.status = NewsStatus.PUBLISHED;
        n.publishedAt = at(date, 18);
        news.save(n);
    }

    private void sponsor(String name, SponsorTier tier, String description, int order) {
        Sponsor s = new Sponsor();
        s.name = name;
        s.tier = tier;
        s.description = description;
        s.sortOrder = order;
        sponsors.save(s);
    }
}
