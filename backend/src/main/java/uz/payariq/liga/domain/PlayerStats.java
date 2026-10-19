package uz.payariq.liga.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import uz.payariq.liga.model.Appearance;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;

/**
 * Futbolchi va jamoa statistikasi faqat yakunlangan o'yinlar hodisalaridan hisoblanadi.
 * Avtogol futbolchining shaxsiy gollariga qo'shilmaydi.
 */
public final class PlayerStats {

    private PlayerStats() {
    }

    public static final class Row {
        public final UUID playerId;
        public final UUID seasonTeamId;
        public int appearances, goals, penaltyGoals, ownGoals, assists, yellow, red;

        Row(UUID playerId, UUID seasonTeamId) {
            this.playerId = playerId;
            this.seasonTeamId = seasonTeamId;
        }
    }

    public record TeamDiscipline(UUID seasonTeamId, int yellow, int red, int fairPlayPoints, int played) {
    }

    public static List<Row> compute(List<Match> matches, List<MatchEvent> events, List<Appearance> appearances) {
        Set<UUID> finished = matches.stream().filter(m -> m.status == MatchStatus.FINISHED).map(Match::getId).collect(Collectors.toSet());
        Map<String, Row> stats = new LinkedHashMap<>();
        Function<UUID[], Row> get = key -> stats.computeIfAbsent(key[0] + ":" + key[1], k -> new Row(key[0], key[1]));

        for (Appearance a : appearances) {
            if (finished.contains(a.matchId)) get.apply(new UUID[] {a.playerId, a.seasonTeamId}).appearances++;
        }
        for (MatchEvent e : events) {
            if (!finished.contains(e.matchId)) continue;
            if (e.playerId != null) {
                Row s = get.apply(new UUID[] {e.playerId, e.seasonTeamId});
                switch (e.type) {
                    case GOAL -> s.goals++;
                    case PENALTY_GOAL -> {
                        s.goals++;
                        s.penaltyGoals++;
                    }
                    case OWN_GOAL -> s.ownGoals++;
                    case YELLOW -> s.yellow++;
                    case SECOND_YELLOW -> {
                        s.yellow++;
                        s.red++;
                    }
                    case RED -> s.red++;
                }
            }
            if (e.type.isScoredGoal() && e.assistId != null) get.apply(new UUID[] {e.assistId, e.seasonTeamId}).assists++;
        }
        return new ArrayList<>(stats.values());
    }

    public static List<Row> topScorers(List<Row> stats, Function<UUID, String> nameOf) {
        return stats.stream()
                .filter(s -> s.goals > 0)
                .sorted(Comparator.<Row>comparingInt(s -> -s.goals)
                        .thenComparingInt(s -> s.penaltyGoals)
                        .thenComparingInt(s -> -s.assists)
                        .thenComparing(s -> nameOf.apply(s.playerId)))
                .toList();
    }

    public static List<TeamDiscipline> teamDiscipline(List<UUID> teamIds, List<Match> matches, List<MatchEvent> events) {
        List<Match> finished = matches.stream().filter(Match::countsForTable).toList();
        Set<UUID> finishedIds = finished.stream().map(Match::getId).collect(Collectors.toSet());
        Map<UUID, int[]> rows = new LinkedHashMap<>();
        teamIds.forEach(id -> rows.put(id, new int[4]));
        for (Match m : finished) {
            if (rows.containsKey(m.homeId)) rows.get(m.homeId)[3]++;
            if (rows.containsKey(m.awayId)) rows.get(m.awayId)[3]++;
        }
        for (MatchEvent e : events) {
            int[] r = rows.get(e.seasonTeamId);
            if (r == null || !finishedIds.contains(e.matchId)) continue;
            if (e.type == EventType.YELLOW) r[0]++;
            if (e.type == EventType.SECOND_YELLOW) {
                r[0]++;
                r[1]++;
            }
            if (e.type == EventType.RED) r[1]++;
            r[2] += e.type.fairPlayPoints();
        }
        return rows.entrySet().stream()
                .map(en -> new TeamDiscipline(en.getKey(), en.getValue()[0], en.getValue()[1], en.getValue()[2], en.getValue()[3]))
                .sorted(Comparator.comparingInt(TeamDiscipline::fairPlayPoints).thenComparingInt(d -> -d.played()))
                .toList();
    }
}
