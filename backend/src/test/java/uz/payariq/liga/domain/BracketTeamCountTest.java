package uz.payariq.liga.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.Season;

/**
 * Har mavsumda jamoalar soni har xil (20, 25, 30, 32 ...). Har bir son va har bir mumkin bo'lgan guruhlar soni uchun:
 * jadval (tasodifiy va hammasi teng) → teng holatlar qur'asi → setka → final o'ynalguncha — hech qayerda uzilish bo'lmasin.
 * Frontend {@code team-count-sweep.test.ts} bilan bir xil tekshiruv.
 */
class BracketTeamCountTest {

    /** Tashkilotchi nizomda chiqadiganlar sonini o'zgartirishi mumkin: standart, faqat g'oliblar, ko'proq jamoa */
    static Stream<Arguments> teamCounts() {
        String[] ruleSets = {new Season().qualifiersBySize, "3:1,4:1,5:1,6:1", "3:2,4:3,5:4,6:5"};
        return Stream.of(ruleSets).flatMap(rules -> IntStream.rangeClosed(6, 64).mapToObj(n -> Arguments.of(n, rules)));
    }

    /** Sayt taklif qiladigan guruhlar soni: iloji bo'lsa 4–5 jamoali, aks holda 3–6 jamoali guruhlar (frontend groupOptions bilan bir xil) */
    private static List<Integer> groupCounts(int n) {
        List<Integer> counts = new ArrayList<>();
        for (int g = 1; g <= 16; g++) if (4 * g <= n && n <= 5 * g) counts.add(g);
        if (!counts.isEmpty()) return counts;
        for (int g = 1; g <= Math.min(16, n); g++) {
            List<Integer> sizes = GroupDraw.groupSizes(n, g);
            if (Collections.min(sizes) >= 3 && Collections.max(sizes) <= 6) counts.add(g);
        }
        return counts;
    }

    private static List<Bracket.TeamRecord> table(int size, boolean flat, Random random) {
        int played = size - 1;
        List<Bracket.TeamRecord> rows = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            if (flat) rows.add(new Bracket.TeamRecord(UUID.randomUUID(), played, played, 0, played, 0));
            else rows.add(new Bracket.TeamRecord(UUID.randomUUID(), played, random.nextInt(played * 3 + 1), random.nextInt(7) - 3, random.nextInt(6), random.nextInt(3)));
        }
        rows.sort(Comparator.comparingInt(Bracket.TeamRecord::points).thenComparingInt(Bracket.TeamRecord::goalDiff).thenComparingInt(Bracket.TeamRecord::goalsFor).reversed());
        return rows;
    }

    /** Setkani final o'ynalguncha o'tkazadi; g'olib tasodifiy. Chempionni qaytaradi */
    private static UUID playOut(List<Match> matches, Random random) {
        Map<UUID, Match> byId = new HashMap<>();
        matches.forEach(m -> byId.put(m.getId(), m));
        List<PlayoffRound> order = List.of(PlayoffRound.R64, PlayoffRound.R32, PlayoffRound.R16, PlayoffRound.QF, PlayoffRound.SF, PlayoffRound.THIRD, PlayoffRound.F);
        List<Match> sorted = new ArrayList<>(matches);
        sorted.sort(Comparator.comparingInt((Match m) -> order.indexOf(m.playoffRound)).thenComparingInt(m -> m.bracketIndex));
        Map<PlayoffRound, Set<UUID>> played = new HashMap<>();
        for (Match m : sorted) {
            assertThat(m.homeId).as("%s %d: uy jamoasi", m.playoffRound, m.bracketIndex).isNotNull();
            assertThat(m.awayId).as("%s %d: mehmon jamoasi", m.playoffRound, m.bracketIndex).isNotNull().isNotEqualTo(m.homeId);
            Set<UUID> round = played.computeIfAbsent(m.playoffRound, r -> new HashSet<>());
            assertThat(round.add(m.homeId) && round.add(m.awayId)).as("bir jamoa bir bosqichda ikki marta").isTrue();
            m.status = MatchStatus.FINISHED;
            m.winnerId = random.nextBoolean() ? m.homeId : m.awayId;
            for (Bracket.AdvanceUpdate u : Bracket.advancementUpdates(m)) {
                Match next = byId.get(u.matchId());
                if (u.slot().equals("home")) next.homeId = u.seasonTeamId();
                else next.awayId = u.seasonTeamId();
            }
        }
        return matches.stream().filter(m -> m.playoffRound == PlayoffRound.F).findFirst().orElseThrow().winnerId;
    }

    @ParameterizedTest(name = "{0} ta jamoa, chiqadiganlar {1}")
    @MethodSource("teamCounts")
    @DisplayName("jamoalar soni 6–64: har bir guruh varianti chempiongacha uzilishsiz o'tadi")
    void anyTeamCountReachesChampion(int n, String qualifiersBySize) {
        Season rules = new Season();
        rules.qualifiersBySize = qualifiersBySize;
        List<Integer> counts = groupCounts(n);
        assertThat(counts).isNotEmpty();
        for (int g : counts) {
            List<Integer> sizes = GroupDraw.groupSizes(n, g);
            for (int seed = 0; seed <= 5; seed++) {
                boolean flat = seed == 0;
                Random random = new Random(n * 1000L + g * 10L + seed);
                List<Bracket.GroupFinish> groups = new ArrayList<>();
                for (int i = 0; i < g; i++) {
                    int size = sizes.get(i);
                    groups.add(new Bracket.GroupFinish(String.valueOf(GroupDraw.LETTERS.charAt(i)), table(size, flat, random), rules.qualifiersFor(size)));
                }
                int qualified = sizes.stream().mapToInt(rules::qualifiersFor).sum();
                String where = n + " jamoa, " + g + " guruh, " + (flat ? "hammasi teng" : "tasodifiy #" + seed);

                Map<Integer, List<UUID>> lots = new HashMap<>();
                Bracket.Plan plan = Bracket.plan(groups, lots);
                // Qur'a: bir o'rindagi har bir teng holat o'z tartibini oladi, oldingilari saqlanadi (PlayoffService.saveLot bilan bir xil)
                for (Bracket.SeedTie tie : plan.ties()) {
                    List<UUID> order = new ArrayList<>(tie.seasonTeamIds());
                    Collections.shuffle(order, random);
                    List<UUID> merged = new ArrayList<>(lots.getOrDefault(tie.position(), List.of()));
                    merged.removeAll(order);
                    merged.addAll(order);
                    lots.put(tie.position(), merged);
                }
                if (!plan.ties().isEmpty()) plan = Bracket.plan(groups, lots);

                // Bitta guruhdan bitta jamoa chiqsa pley-off bo'lmaydi — sayt buni xato sifatida aytadi
                if (qualified < 2) {
                    assertThat(plan.error()).as(where).isNotNull();
                    continue;
                }
                assertThat(plan.error()).as(where).isNull();
                assertThat(plan.ties()).as(where + ": qur'adan keyin ham teng holat qoldi").isEmpty();
                assertThat(plan.seeds()).as(where).hasSize(qualified);
                assertThat(Bracket.isPowerOfTwo(plan.bracketSize())).as(where).isTrue();
                assertThat(plan.playIns()).as(where).hasSize(qualified - plan.bracketSize());

                List<Match> matches = Bracket.create(UUID.randomUUID(), plan, true, null, (r, i) -> Instant.EPOCH);
                int third = plan.bracketSize() >= 4 ? 1 : 0;
                assertThat(matches).as(where).hasSize(plan.playIns().size() + plan.bracketSize() - 1 + third);
                UUID champion = playOut(matches, random);
                assertThat(plan.seeds()).as(where + ": chempion").anyMatch(s -> s.seasonTeamId().equals(champion));
            }
        }
    }
}
