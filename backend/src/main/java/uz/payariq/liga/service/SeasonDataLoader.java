package uz.payariq.liga.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.model.Team;
import uz.payariq.liga.repo.AppearanceRepository;
import uz.payariq.liga.repo.LeagueGroupRepository;
import uz.payariq.liga.repo.MatchEventRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.PlayerRepository;
import uz.payariq.liga.repo.PointAdjustmentRepository;
import uz.payariq.liga.repo.RosterEntryRepository;
import uz.payariq.liga.repo.SeasonAwardRepository;
import uz.payariq.liga.repo.SeasonRepository;
import uz.payariq.liga.repo.SeasonTeamRepository;
import uz.payariq.liga.repo.TeamRepository;
import uz.payariq.liga.repo.TiebreakLotRepository;

/** Mavsum ma'lumotlarini bir necha so'rov bilan yuklaydi */
@Component
public class SeasonDataLoader {

    private final SeasonRepository seasons;
    private final SeasonTeamRepository seasonTeams;
    private final TeamRepository teams;
    private final LeagueGroupRepository groups;
    private final MatchRepository matches;
    private final MatchEventRepository events;
    private final AppearanceRepository appearances;
    private final RosterEntryRepository rosters;
    private final PlayerRepository players;
    private final PointAdjustmentRepository adjustments;
    private final SeasonAwardRepository awards;
    private final TiebreakLotRepository lots;

    public SeasonDataLoader(SeasonRepository seasons, SeasonTeamRepository seasonTeams, TeamRepository teams, LeagueGroupRepository groups,
                            MatchRepository matches, MatchEventRepository events, AppearanceRepository appearances, RosterEntryRepository rosters,
                            PlayerRepository players, PointAdjustmentRepository adjustments, SeasonAwardRepository awards,
                            TiebreakLotRepository lots) {
        this.seasons = seasons;
        this.seasonTeams = seasonTeams;
        this.teams = teams;
        this.groups = groups;
        this.matches = matches;
        this.events = events;
        this.appearances = appearances;
        this.rosters = rosters;
        this.players = players;
        this.adjustments = adjustments;
        this.awards = awards;
        this.lots = lots;
    }

    public Season season(UUID seasonId) {
        return seasons.findById(seasonId).orElseThrow(() -> ApiException.notFound("Mavsum topilmadi."));
    }

    /** Yakunlangan mavsum arxivga qulflangan — uni o'zgartirib bo'lmaydi */
    public Season editableSeason(UUID seasonId) {
        Season s = season(seasonId);
        if (s.isFinished()) {
            throw ApiException.conflict(s.name + " yakunlangan va arxivga qulflangan. Tarixiy ma’lumotlarni o‘zgartirib bo‘lmaydi.");
        }
        return s;
    }

    @Transactional(readOnly = true)
    public SeasonData load(UUID seasonId) {
        Season season = season(seasonId);
        List<SeasonTeam> sts = seasonTeams.findBySeasonId(seasonId);
        Map<UUID, Team> teamMap = teams.findAllById(sts.stream().map(st -> st.teamId).toList()).stream()
                .collect(Collectors.toMap(Team::getId, Function.identity()));
        List<Match> ms = matches.findBySeasonIdOrderByKickoffAsc(seasonId);
        List<UUID> matchIds = ms.stream().map(Match::getId).toList();
        List<RosterEntry> rs = rosters.findBySeasonId(seasonId);
        Map<UUID, Player> playerMap = players.findAllById(rs.stream().map(r -> r.playerId).toList()).stream()
                .collect(Collectors.toMap(Player::getId, Function.identity()));
        return new SeasonData(
                season,
                sts,
                teamMap,
                groups.findBySeasonIdOrderBySortOrderAsc(seasonId),
                ms,
                matchIds.isEmpty() ? List.of() : events.findByMatchIdIn(matchIds),
                matchIds.isEmpty() ? List.of() : appearances.findByMatchIdIn(matchIds),
                rs,
                playerMap,
                adjustments.findBySeasonIdOrderByCreatedAtAsc(seasonId),
                awards.findBySeasonId(seasonId),
                lots.findBySeasonId(seasonId));
    }
}
