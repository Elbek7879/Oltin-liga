package uz.payariq.liga.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.domain.EventType;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.PlayerStats;
import uz.payariq.liga.domain.PlayoffRound;
import uz.payariq.liga.domain.Schedule;
import uz.payariq.liga.domain.StandingsCalculator.StandingRow;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.model.Team;
import uz.payariq.liga.repo.AppearanceRepository;
import uz.payariq.liga.repo.AuditLogRepository;
import uz.payariq.liga.repo.MatchEventRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.PlayerRepository;
import uz.payariq.liga.repo.RosterEntryRepository;
import uz.payariq.liga.repo.SeasonTeamRepository;
import uz.payariq.liga.repo.TeamRepository;
import uz.payariq.liga.web.Dto.AdminPlayerRow;
import uz.payariq.liga.web.Dto.AdminTeamRow;
import uz.payariq.liga.web.Dto.AuditDto;
import uz.payariq.liga.web.Dto.Dashboard;
import uz.payariq.liga.web.Dto.FinishPreview;
import uz.payariq.liga.web.Dto.MatchDto;
import uz.payariq.liga.web.Dto.Report;
import uz.payariq.liga.web.Dto.SeasonDto;
import uz.payariq.liga.web.Dto.TeamConceded;
import uz.payariq.liga.web.Dto.TeamGoals;
import uz.payariq.liga.web.Dto.TeamView;

/** Admin paneli uchun o'qish so'rovlari */
@Service
@Transactional(readOnly = true)
public class AdminQueryService {

    private final SeasonDataLoader loader;
    private final PublicReadService publicRead;
    private final TeamRepository teams;
    private final SeasonTeamRepository seasonTeams;
    private final PlayerRepository players;
    private final RosterEntryRepository rosters;
    private final MatchRepository matches;
    private final MatchEventRepository events;
    private final AppearanceRepository appearances;
    private final AuditLogRepository audit;
    private final Clock clock;

    public AdminQueryService(SeasonDataLoader loader, PublicReadService publicRead, TeamRepository teams, SeasonTeamRepository seasonTeams,
                             PlayerRepository players, RosterEntryRepository rosters, MatchRepository matches, MatchEventRepository events,
                             AppearanceRepository appearances, AuditLogRepository audit, Clock clock) {
        this.loader = loader;
        this.publicRead = publicRead;
        this.teams = teams;
        this.seasonTeams = seasonTeams;
        this.players = players;
        this.rosters = rosters;
        this.matches = matches;
        this.events = events;
        this.appearances = appearances;
        this.audit = audit;
        this.clock = clock;
    }

    public Dashboard dashboard(UUID seasonId) {
        SeasonData d = loader.load(seasonId);
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, Schedule.ZONE);
        List<Match> ms = d.matches();
        return new Dashboard(
                SeasonDto.of(d.season()),
                d.seasonTeams().size(),
                (int) d.rosters().stream().map(r -> r.playerId).distinct().count(),
                (int) ms.stream().filter(m -> m.status != MatchStatus.CANCELLED).count(),
                (int) ms.stream().filter(m -> m.status == MatchStatus.FINISHED).count(),
                ms.stream().filter(m -> m.timeConfirmed && (m.status == MatchStatus.SCHEDULED || m.status == MatchStatus.LIVE) && m.kickoff.isBefore(now)
                        && m.homeId != null && m.awayId != null).map(MatchDto::of).toList(),
                ms.stream().filter(m -> m.timeConfirmed && LocalDate.ofInstant(m.kickoff, Schedule.ZONE).equals(today)).map(MatchDto::of).toList(),
                ms.stream().filter(m -> m.timeConfirmed && m.status == MatchStatus.SCHEDULED && m.kickoff.isAfter(now)).limit(6).map(MatchDto::of).toList(),
                audit.findTop6ByOrderByCreatedAtDesc().stream().map(a -> new AuditDto(a.getId(), a.getCreatedAt(), a.displayName, a.action, a.summary)).toList(),
                d.views(),
                d.groups().size());
    }

    public List<AdminTeamRow> teams(UUID seasonId) {
        Set<UUID> withMatches = new HashSet<>(matches.allHomeIds());
        withMatches.addAll(matches.allAwayIds());
        Map<UUID, List<SeasonTeam>> byTeam = seasonTeams.findAll().stream().collect(Collectors.groupingBy(st -> st.teamId));
        Map<UUID, Long> rosterCounts = rosters.findBySeasonId(seasonId).stream().collect(Collectors.groupingBy(r -> r.seasonTeamId, Collectors.counting()));
        List<AdminTeamRow> rows = new ArrayList<>();
        for (Team t : teams.findAllByOrderByNameAsc()) {
            List<SeasonTeam> sts = byTeam.getOrDefault(t.getId(), List.of());
            SeasonTeam current = sts.stream().filter(st -> st.seasonId.equals(seasonId)).findFirst().orElse(null);
            boolean history = sts.stream().anyMatch(st -> withMatches.contains(st.getId()));
            rows.add(new AdminTeamRow(t.getId(), t.name, t.shortName, t.village, t.primaryColor, t.secondaryColor, t.founded, t.active, t.logoUrl,
                    current != null, current == null ? null : current.getId(),
                    current == null ? 0 : rosterCounts.getOrDefault(current.getId(), 0L).intValue(), history));
        }
        rows.sort(Comparator.comparing((AdminTeamRow r) -> !r.inSeason()).thenComparing(AdminTeamRow::name));
        return rows;
    }

    public List<AdminPlayerRow> players(UUID seasonId) {
        SeasonData d = loader.load(seasonId);
        Map<UUID, Integer> goals = new HashMap<>();
        Set<UUID> finished = d.matches().stream().filter(m -> m.status == MatchStatus.FINISHED).map(Match::getId).collect(Collectors.toSet());
        for (MatchEvent e : d.events()) {
            if (e.playerId != null && e.type.isScoredGoal() && finished.contains(e.matchId)) goals.merge(e.playerId, 1, Integer::sum);
        }
        Set<UUID> withHistory = new HashSet<>(events.allPlayerIds());
        withHistory.addAll(events.allAssistIds());
        withHistory.addAll(appearances.allPlayerIds());
        Map<UUID, RosterEntry> roster = d.rosters().stream().collect(Collectors.toMap(r -> r.playerId, r -> r));
        return players.findAll().stream()
                .sorted(Comparator.comparing((Player p) -> p.lastName).thenComparing(p -> p.firstName))
                .map(p -> {
                    RosterEntry r = roster.get(p.getId());
                    return new AdminPlayerRow(p.getId(), p.firstName, p.lastName, p.birthYear, p.position, p.phone,
                            r == null ? null : r.seasonTeamId, r == null ? null : r.shirtNumber, goals.getOrDefault(p.getId(), 0), withHistory.contains(p.getId()));
                })
                .toList();
    }

    /** Mavsumni yakunlashdan oldingi tekshiruv va sovrindorlar */
    public FinishPreview finishPreview(UUID seasonId) {
        SeasonData d = loader.load(seasonId);
        List<String> problems = new ArrayList<>();
        if (d.season().isFinished()) problems.add("Bu mavsum allaqachon yakunlangan.");
        long open = d.matches().stream().filter(m -> m.status == MatchStatus.SCHEDULED || m.status == MatchStatus.LIVE || m.status == MatchStatus.POSTPONED).count();
        if (open > 0) problems.add(open + " ta o‘yin hali yakunlanmagan.");
        Match fin = d.matches().stream().filter(m -> m.playoffRound == PlayoffRound.F).findFirst().orElse(null);
        Match third = d.matches().stream().filter(m -> m.playoffRound == PlayoffRound.THIRD).findFirst().orElse(null);
        TeamView champion = null, runnerUp = null, thirdPlace = null;
        if (fin != null) {
            if (fin.status != MatchStatus.FINISHED) problems.add("Final o‘yini hali o‘tkazilmagan.");
            champion = d.view(fin.winnerId);
            runnerUp = fin.winnerId == null ? null : d.view(fin.winnerId.equals(fin.homeId) ? fin.awayId : fin.homeId);
            thirdPlace = third != null && third.status == MatchStatus.FINISHED ? d.view(third.winnerId) : null;
        } else if (d.groups().size() == 1) {
            List<StandingRow> table = d.standings().get(d.groups().get(0).getId());
            champion = table.size() > 0 ? d.view(table.get(0).seasonTeamId()) : null;
            runnerUp = table.size() > 1 ? d.view(table.get(1).seasonTeamId()) : null;
            thirdPlace = table.size() > 2 ? d.view(table.get(2).seasonTeamId()) : null;
        } else {
            problems.add("Chempionni aniqlash uchun pley-off finali kerak.");
        }
        List<PlayerStats.TeamDiscipline> discipline = d.discipline();
        TeamView fairPlay = discipline.isEmpty() ? null : d.view(discipline.get(0).seasonTeamId());
        return new FinishPreview(problems.isEmpty(), problems, champion, runnerUp, thirdPlace, publicRead.topScorer(d), fairPlay);
    }

    public Report report(UUID seasonId) {
        SeasonData d = loader.load(seasonId);
        List<Match> finished = d.matches().stream().filter(m -> m.status == MatchStatus.FINISHED).toList();
        Set<UUID> ids = finished.stream().map(Match::getId).collect(Collectors.toSet());
        int goals = finished.stream().mapToInt(m -> m.homeTotal() + m.awayTotal()).sum();
        int yellow = 0, red = 0;
        for (MatchEvent e : d.events()) {
            if (!ids.contains(e.matchId)) continue;
            if (e.type == EventType.YELLOW || e.type == EventType.SECOND_YELLOW) yellow++;
            if (e.type == EventType.RED || e.type == EventType.SECOND_YELLOW) red++;
        }
        Match biggest = finished.stream().max(Comparator.comparingInt(m -> Math.abs(m.homeTotal() - m.awayTotal()))).orElse(null);
        TeamGoals attack = null;
        TeamConceded defence = null;
        for (SeasonTeam st : d.seasonTeams()) {
            int f = 0, a = 0;
            for (Match m : finished) {
                if (st.getId().equals(m.homeId)) {
                    f += m.homeTotal();
                    a += m.awayTotal();
                } else if (st.getId().equals(m.awayId)) {
                    f += m.awayTotal();
                    a += m.homeTotal();
                }
            }
            if (attack == null || f > attack.goals()) attack = new TeamGoals(d.view(st), f);
            if (defence == null || a < defence.conceded()) defence = new TeamConceded(d.view(st), a);
        }
        double avg = finished.isEmpty() ? 0 : Math.round(goals * 100.0 / finished.size()) / 100.0;
        return new Report(SeasonDto.of(d.season()), finished.size(), goals, avg, yellow, red, biggest == null ? null : MatchDto.of(biggest),
                attack, defence, d.views());
    }

    public List<AuditDto> audit() {
        return audit.findTop300ByOrderByCreatedAtDesc().stream()
                .map(a -> new AuditDto(a.getId(), a.getCreatedAt(), a.displayName, a.action, a.summary)).toList();
    }
}
