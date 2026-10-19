package uz.payariq.liga.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import uz.payariq.liga.domain.Bracket;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.PlayerStats;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.StandingsCalculator;
import uz.payariq.liga.domain.StandingsCalculator.StandingRow;
import uz.payariq.liga.model.Appearance;
import uz.payariq.liga.model.LeagueGroup;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.PointAdjustment;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.SeasonAward;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.model.Team;
import uz.payariq.liga.model.TiebreakLot;
import uz.payariq.liga.web.Dto.PublicPlayer;
import uz.payariq.liga.web.Dto.TeamView;

/** Bitta mavsumning barcha ma'lumotlari — jadval va statistika shu to'plam ustida hisoblanadi */
public record SeasonData(
        Season season,
        List<SeasonTeam> seasonTeams,
        Map<UUID, Team> teams,
        List<LeagueGroup> groups,
        List<Match> matches,
        List<MatchEvent> events,
        List<Appearance> appearances,
        List<RosterEntry> rosters,
        Map<UUID, Player> players,
        List<PointAdjustment> adjustments,
        List<SeasonAward> awards,
        List<TiebreakLot> lots) {

    public TeamView view(UUID seasonTeamId) {
        if (seasonTeamId == null) return null;
        return seasonTeams.stream().filter(st -> st.getId().equals(seasonTeamId)).findFirst().map(this::view).orElse(null);
    }

    public TeamView view(SeasonTeam st) {
        Team t = teams.get(st.teamId);
        return new TeamView(st.getId(), st.teamId, st.seasonId, st.name, st.shortName, t.village, t.primaryColor, t.secondaryColor, st.captainId, st.coach, t.logoUrl);
    }

    public List<TeamView> views() {
        return seasonTeams.stream().map(this::view).toList();
    }

    public String teamName(UUID seasonTeamId) {
        TeamView v = view(seasonTeamId);
        return v == null ? "Aniqlanmagan" : v.name();
    }

    public PublicPlayer publicPlayer(UUID playerId) {
        Player p = players.get(playerId);
        return p == null ? null : PublicPlayer.of(p);
    }

    public String playerName(UUID playerId) {
        Player p = players.get(playerId);
        return p == null ? "" : p.fullName();
    }

    public Set<UUID> rosterOf(UUID seasonTeamId) {
        return rosters.stream().filter(r -> r.seasonTeamId.equals(seasonTeamId)).map(r -> r.playerId).collect(Collectors.toSet());
    }

    /** Guruhlar jadvali: har bir guruh uchun o'yinlar va hodisalardan noldan hisoblanadi */
    public Map<UUID, List<StandingRow>> standings() {
        List<Match> groupMatches = matches.stream().filter(m -> m.stage == MatchStage.GROUP).toList();
        Map<UUID, List<StandingRow>> result = new LinkedHashMap<>();
        for (LeagueGroup g : groups) {
            result.put(g.getId(), StandingsCalculator.compute(
                    g.seasonTeamIds,
                    groupMatches.stream().filter(m -> g.getId().equals(m.groupId)).toList(),
                    events,
                    adjustments,
                    season,
                    this::teamName,
                    lotOrder(TiebreakLot.groupScope(g.getId()))));
        }
        return result;
    }

    /** Qur'a natijasi (bo'lmasa bo'sh ro'yxat) */
    public List<UUID> lotOrder(String scope) {
        return lots.stream().filter(l -> l.scope.equals(scope)).findFirst().map(TiebreakLot::order).orElse(List.of());
    }

    /** Guruh bosqichining barcha o'yinlari yakunlangan (yoki bekor qilingan) */
    public boolean groupStageComplete() {
        List<Match> group = matches.stream().filter(m -> m.stage == MatchStage.GROUP).toList();
        return !group.isEmpty() && group.stream().allMatch(m -> m.status == MatchStatus.FINISHED || m.status == MatchStatus.CANCELLED);
    }

    /** Joriy jadvallar bo'yicha pley-off rejasi: reyting, saralash o'yinlari va setka */
    public Bracket.Plan playoffPlan() {
        return playoffPlan(standings());
    }

    public Bracket.Plan playoffPlan(Map<UUID, List<StandingRow>> standings) {
        List<Bracket.GroupFinish> finishes = groups.stream()
                .map(g -> new Bracket.GroupFinish(g.name,
                        standings.get(g.getId()).stream()
                                .map(r -> new Bracket.TeamRecord(r.seasonTeamId(), r.played(), r.points(), r.goalDiff(), r.goalsFor(), r.fairPlay()))
                                .toList(),
                        season.qualifiersFor(g.seasonTeamIds.size())))
                .toList();
        Map<Integer, List<UUID>> seedLots = new HashMap<>();
        for (TiebreakLot l : lots) {
            if (l.scope.startsWith("SEED:")) seedLots.put(Integer.parseInt(l.scope.substring(5)), l.order());
        }
        return Bracket.plan(finishes, seedLots);
    }

    /**
     * Pley-offga chiqishga yoki reytingga ta'sir qiladigan, nizom mezonlari ajrata olmagan teng holatlar.
     * Bunday holatda tashkilotchi qur'a tashlaydi. Kalit — guruh id.
     */
    public Map<UUID, List<UUID>> groupTies(Map<UUID, List<StandingRow>> standings) {
        Map<UUID, List<UUID>> result = new LinkedHashMap<>();
        for (LeagueGroup g : groups) {
            int q = season.qualifiersFor(g.seasonTeamIds.size());
            Map<Integer, List<StandingRow>> byPoints = new LinkedHashMap<>();
            standings.get(g.getId()).stream().filter(StandingRow::unresolvedTie).forEach(r -> byPoints.computeIfAbsent(r.points(), k -> new ArrayList<>()).add(r));
            List<UUID> ids = new ArrayList<>();
            for (List<StandingRow> cluster : byPoints.values()) {
                if (cluster.stream().anyMatch(r -> r.position() <= q)) cluster.forEach(r -> ids.add(r.seasonTeamId()));
            }
            if (!ids.isEmpty()) result.put(g.getId(), ids);
        }
        return result;
    }

    public List<PlayerStats.Row> playerStats() {
        return PlayerStats.compute(matches, events, appearances);
    }

    public List<PlayerStats.TeamDiscipline> discipline() {
        return PlayerStats.teamDiscipline(seasonTeams.stream().map(SeasonTeam::getId).toList(), matches, events);
    }

    public Map<UUID, Integer> shirtNumbers() {
        Map<UUID, Integer> map = new HashMap<>();
        rosters.forEach(r -> map.put(r.playerId, r.shirtNumber));
        return map;
    }
}
