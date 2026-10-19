package uz.payariq.liga.domain;

import java.text.Collator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.model.PointAdjustment;
import uz.payariq.liga.model.Season;

/**
 * Guruh jadvalini o'yinlar va hodisalardan noldan hisoblaydi. Funksiya sof:
 * bir xil kirishga har doim bir xil natija beradi, shuning uchun natija
 * tahrirlanganda hech qaysi o'yin ikki marta hisobga olinmaydi.
 */
public final class StandingsCalculator {

    private StandingsCalculator() {
    }

    public record StandingRow(
            UUID seasonTeamId,
            int position,
            int played,
            int won,
            int drawn,
            int lost,
            int goalsFor,
            int goalsAgainst,
            int goalDiff,
            int adjustment,
            int points,
            int fairPlay,
            List<String> form,
            boolean unresolvedTie) {
    }

    private static final class Tally {
        int played, won, drawn, lost, goalsFor, goalsAgainst, points;
    }

    public static List<StandingRow> compute(
            List<UUID> teamIds,
            List<Match> matches,
            List<MatchEvent> events,
            List<PointAdjustment> adjustments,
            Season rules,
            Function<UUID, String> nameOf) {
        return compute(teamIds, matches, events, adjustments, rules, nameOf, List.of());
    }

    /**
     * @param lotOrder guruh uchun qur'a natijasi: barcha mezonlar ajrata olmagan jamoalar shu tartibda joylashadi
     */
    public static List<StandingRow> compute(
            List<UUID> teamIds,
            List<Match> matches,
            List<MatchEvent> events,
            List<PointAdjustment> adjustments,
            Season rules,
            Function<UUID, String> nameOf,
            List<UUID> lotOrder) {

        Map<UUID, Tally> tally = tallyMatches(teamIds, matches, rules);
        Set<UUID> finishedIds = matches.stream().filter(Match::countsForTable).map(Match::getId).collect(Collectors.toSet());

        Map<UUID, Integer> fairPlay = new HashMap<>();
        teamIds.forEach(id -> fairPlay.put(id, 0));
        for (MatchEvent e : events) {
            if (!finishedIds.contains(e.matchId) || !fairPlay.containsKey(e.seasonTeamId)) continue;
            fairPlay.merge(e.seasonTeamId, e.type.fairPlayPoints(), Integer::sum);
        }

        Map<UUID, Integer> adj = new HashMap<>();
        teamIds.forEach(id -> adj.put(id, 0));
        for (PointAdjustment a : adjustments) {
            if (adj.containsKey(a.seasonTeamId)) adj.merge(a.seasonTeamId, a.points, Integer::sum);
        }

        Map<UUID, List<String>> form = new HashMap<>();
        teamIds.forEach(id -> form.put(id, new ArrayList<>()));
        matches.stream()
                .filter(Match::countsForTable)
                .sorted(Comparator.comparing(m -> m.kickoff))
                .forEach(m -> {
                    String res = m.homeScore > m.awayScore ? "W" : m.homeScore < m.awayScore ? "L" : "D";
                    if (form.containsKey(m.homeId)) form.get(m.homeId).add(res);
                    if (form.containsKey(m.awayId)) form.get(m.awayId).add(res.equals("W") ? "L" : res.equals("L") ? "W" : "D");
                });

        Function<UUID, Integer> totalPoints = id -> tally.get(id).points + adj.get(id);
        Set<UUID> unresolved = new HashSet<>();
        Collator collator = Collator.getInstance(Locale.forLanguageTag("uz"));
        List<Tiebreaker> criteria = rules.tiebreakerList();

        Resolver resolver = new Resolver(criteria, tally, fairPlay, matches, rules, unresolved, nameOf, collator, lotOrder);

        TreeMap<Integer, List<UUID>> byPoints = new TreeMap<>(Comparator.reverseOrder());
        for (UUID id : teamIds) byPoints.computeIfAbsent(totalPoints.apply(id), k -> new ArrayList<>()).add(id);
        List<UUID> order = new ArrayList<>();
        byPoints.values().forEach(group -> order.addAll(resolver.resolve(group, 0)));

        List<StandingRow> rows = new ArrayList<>();
        for (int i = 0; i < order.size(); i++) {
            UUID id = order.get(i);
            Tally t = tally.get(id);
            List<String> f = form.get(id);
            rows.add(new StandingRow(id, i + 1, t.played, t.won, t.drawn, t.lost, t.goalsFor, t.goalsAgainst,
                    t.goalsFor - t.goalsAgainst, adj.get(id), totalPoints.apply(id), fairPlay.get(id),
                    List.copyOf(f.subList(Math.max(0, f.size() - 5), f.size())), unresolved.contains(id) && t.played > 0));
        }
        return rows;
    }

    private static Map<UUID, Tally> tallyMatches(List<UUID> teamIds, List<Match> matches, Season rules) {
        Map<UUID, Tally> table = new LinkedHashMap<>();
        teamIds.forEach(id -> table.put(id, new Tally()));
        for (Match m : matches) {
            if (!m.countsForTable() || !table.containsKey(m.homeId) || !table.containsKey(m.awayId)) continue;
            Tally home = table.get(m.homeId);
            Tally away = table.get(m.awayId);
            home.played++;
            away.played++;
            home.goalsFor += m.homeScore;
            home.goalsAgainst += m.awayScore;
            away.goalsFor += m.awayScore;
            away.goalsAgainst += m.homeScore;
            if (m.homeScore > m.awayScore) {
                home.won++;
                away.lost++;
                home.points += rules.pointsWin;
                away.points += rules.pointsLoss;
            } else if (m.homeScore < m.awayScore) {
                away.won++;
                home.lost++;
                away.points += rules.pointsWin;
                home.points += rules.pointsLoss;
            } else {
                home.drawn++;
                away.drawn++;
                home.points += rules.pointsDraw;
                away.points += rules.pointsDraw;
            }
        }
        return table;
    }

    /**
     * Teng jamoalarni mezonlar bo'yicha tartiblaydi. Kichikroq teng guruh paydo bo'lsa,
     * mezonlar shu guruh uchun boshidan qayta qo'llanadi (o'zaro o'yinlar qayta hisoblanadi).
     */
    private record Resolver(
            List<Tiebreaker> criteria,
            Map<UUID, Tally> tally,
            Map<UUID, Integer> fairPlay,
            List<Match> matches,
            Season rules,
            Set<UUID> unresolved,
            Function<UUID, String> nameOf,
            Collator collator,
            List<UUID> lotOrder) {

        List<UUID> resolve(List<UUID> ids, int criterionIndex) {
            if (ids.size() <= 1) return ids;
            if (criterionIndex >= criteria.size()) {
                // Qur'a tashlangan bo'lsa — uning tartibi; bo'lmasa vaqtincha alifbo tartibi va «*» belgisi
                if (lotOrder.containsAll(ids)) {
                    List<UUID> byLot = new ArrayList<>(ids);
                    byLot.sort(Comparator.comparingInt(lotOrder::indexOf));
                    return byLot;
                }
                unresolved.addAll(ids);
                List<UUID> sorted = new ArrayList<>(ids);
                sorted.sort((a, b) -> collator.compare(nameOf.apply(a), nameOf.apply(b)));
                return sorted;
            }
            Tiebreaker criterion = criteria.get(criterionIndex);
            Map<UUID, Tally> mini = criterion.name().startsWith("H2H") ? tallyMatches(ids, matches, rules) : null;
            TreeMap<Integer, List<UUID>> buckets = new TreeMap<>(Comparator.reverseOrder());
            for (UUID id : ids) buckets.computeIfAbsent(value(criterion, id, mini), k -> new ArrayList<>()).add(id);
            List<UUID> result = new ArrayList<>();
            for (List<UUID> bucket : buckets.values()) {
                if (bucket.size() == 1) result.add(bucket.get(0));
                else if (bucket.size() < ids.size()) result.addAll(resolve(bucket, 0));
                else result.addAll(resolve(bucket, criterionIndex + 1));
            }
            return result;
        }

        private int value(Tiebreaker criterion, UUID id, Map<UUID, Tally> mini) {
            Tally t = tally.get(id);
            return switch (criterion) {
                case GOAL_DIFF -> t.goalsFor - t.goalsAgainst;
                case GOALS_FOR -> t.goalsFor;
                case WINS -> t.won;
                case FAIR_PLAY -> -fairPlay.get(id);
                case H2H_POINTS -> mini.get(id).points;
                case H2H_GOAL_DIFF -> mini.get(id).goalsFor - mini.get(id).goalsAgainst;
                case H2H_GOALS -> mini.get(id).goalsFor;
            };
        }
    }
}
