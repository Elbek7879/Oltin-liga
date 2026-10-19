package uz.payariq.liga.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import uz.payariq.liga.model.Match;

class BracketTest {

    /** size jamoali guruh: jadval tartibida, har jamoa (size-1) ta o'yin o'ynagan, ochkolar kamayib boradi */
    private static Bracket.GroupFinish group(String name, int size, int qualifiers) {
        List<Bracket.TeamRecord> table = IntStream.range(0, size)
                .mapToObj(i -> new Bracket.TeamRecord(UUID.randomUUID(), size - 1, (size - 1 - i) * 3, size - 1 - 2 * i, 10 - i, 0))
                .toList();
        return new Bracket.GroupFinish(name, table, qualifiers);
    }

    /** Guruhlar: 5 jamoalidan 3 ta, 4 jamoalidan 2 ta chiqadi */
    private static List<Bracket.GroupFinish> groups(int fives, int fours) {
        List<Bracket.GroupFinish> list = new ArrayList<>();
        char letter = 'A';
        for (int i = 0; i < fives; i++) list.add(group(String.valueOf(letter++), 5, 3));
        for (int i = 0; i < fours; i++) list.add(group(String.valueOf(letter++), 4, 2));
        return list;
    }

    private static Map<UUID, String> groupOf(Bracket.Plan plan) {
        Map<UUID, String> map = new HashMap<>();
        plan.seeds().forEach(s -> map.put(s.seasonTeamId(), s.groupName()));
        return map;
    }

    @ParameterizedTest(name = "{0} ta 5 jamoali + {1} ta 4 jamoali guruh: {2} jamoa chiqadi, setka {3}, saralash {4}")
    @CsvSource({
            "0, 5, 10, 8, 2",
            "4, 0, 12, 8, 4",
            "0, 9, 18, 16, 2",
            "4, 4, 20, 16, 4",
            "0, 10, 20, 16, 4",
            "8, 0, 24, 16, 8",
            "0, 8, 16, 16, 0",
    })
    @DisplayName("jamoalar soni har xil bo'lganda setka moslashadi (20, 36, 40, 32 jamoa)")
    void adaptsToAnyCount(int fives, int fours, int qualified, int size, int playIns) {
        Bracket.Plan plan = Bracket.plan(groups(fives, fours), Map.of());
        assertThat(plan.error()).isNull();
        assertThat(plan.seeds()).hasSize(qualified);
        assertThat(plan.bracketSize()).isEqualTo(size);
        assertThat(plan.playIns()).hasSize(playIns);
        assertThat(plan.slots()).hasSize(size);
        assertThat(plan.slots().stream().filter(s -> s.playInIndex() != null)).hasSize(playIns);
        // Guruh g'oliblari reytingning boshida va hech biri saralash o'ynamaydi
        int groupsCount = fives + fours;
        assertThat(plan.seeds().subList(0, groupsCount)).allMatch(s -> s.position() == 1);
        assertThat(plan.playIns()).allMatch(p -> p.home().position() > 1 && p.away().position() > 1);
    }

    @Test
    @DisplayName("bitta guruh jamoalari saralashda ham, birinchi bosqichda ham uchrashmaydi")
    void sameGroupTeamsAreSeparated() {
        for (int[] shape : new int[][] {{4, 4}, {0, 9}, {8, 0}, {0, 5}, {4, 0}, {0, 8}, {1, 1}, {0, 2}, {0, 10}}) {
            Bracket.Plan plan = Bracket.plan(groups(shape[0], shape[1]), Map.of());
            Map<UUID, String> g = groupOf(plan);
            assertThat(plan.playIns()).allMatch(p -> !p.home().groupName().equals(p.away().groupName()));
            for (int i = 0; i < plan.slots().size(); i += 2) {
                UUID a = plan.slots().get(i).seasonTeamId();
                UUID b = plan.slots().get(i + 1).seasonTeamId();
                if (a != null && b != null) {
                    assertThat(g.get(a)).as("%s guruhlar, %d-juftlik", Arrays.toString(shape), i / 2).isNotEqualTo(g.get(b));
                }
            }
        }
    }

    @Test
    @DisplayName("har xil hajmdagi guruhlar o'yin boshiga o'rtacha ko'rsatkich bilan solishtiriladi")
    void comparesPerGame() {
        // 5 jamoali guruh g'olibi: 4 o'yinda 10 ochko (2.5); 4 jamoali guruh g'olibi: 3 o'yinda 9 ochko (3.0)
        UUID five = UUID.randomUUID();
        UUID four = UUID.randomUUID();
        var a = new Bracket.GroupFinish("A", List.of(
                new Bracket.TeamRecord(five, 4, 10, 6, 9, 0), new Bracket.TeamRecord(UUID.randomUUID(), 4, 7, 2, 6, 0),
                new Bracket.TeamRecord(UUID.randomUUID(), 4, 6, 0, 5, 0), new Bracket.TeamRecord(UUID.randomUUID(), 4, 3, -3, 3, 0),
                new Bracket.TeamRecord(UUID.randomUUID(), 4, 1, -5, 2, 0)), 3);
        var b = new Bracket.GroupFinish("B", List.of(
                new Bracket.TeamRecord(four, 3, 9, 5, 7, 0), new Bracket.TeamRecord(UUID.randomUUID(), 3, 6, 1, 5, 0),
                new Bracket.TeamRecord(UUID.randomUUID(), 3, 3, -2, 3, 0), new Bracket.TeamRecord(UUID.randomUUID(), 3, 0, -4, 1, 0)), 2);
        Bracket.Plan plan = Bracket.plan(List.of(a, b), Map.of());
        assertThat(plan.seeds().get(0).seasonTeamId()).isEqualTo(four);
        assertThat(plan.seeds().get(1).seasonTeamId()).isEqualTo(five);
    }

    @Test
    @DisplayName("reytingda to'liq teng jamoalar qur'a bilan ajratiladi")
    void seedTiesNeedLot() {
        UUID x = UUID.randomUUID();
        UUID y = UUID.randomUUID();
        var a = new Bracket.GroupFinish("A", List.of(new Bracket.TeamRecord(x, 3, 7, 4, 6, 1), new Bracket.TeamRecord(UUID.randomUUID(), 3, 3, 0, 3, 0)), 1);
        var b = new Bracket.GroupFinish("B", List.of(new Bracket.TeamRecord(y, 3, 7, 4, 6, 1), new Bracket.TeamRecord(UUID.randomUUID(), 3, 3, 0, 3, 0)), 1);
        Bracket.Plan plan = Bracket.plan(List.of(a, b), Map.of());
        assertThat(plan.ties()).containsExactly(new Bracket.SeedTie(1, List.of(x, y)));
        Bracket.Plan withLot = Bracket.plan(List.of(a, b), Map.of(1, List.of(y, x)));
        assertThat(withLot.ties()).isEmpty();
        assertThat(withLot.seeds().get(0).seasonTeamId()).isEqualTo(y);
    }

    @Test
    @DisplayName("saralash g'olibi setkadagi o'z joyiga, yarim final g'olibi finalga, mag'lubi 3-o'rin o'yiniga o'tadi")
    void createsLinkedMatches() {
        Bracket.Plan plan = Bracket.plan(groups(4, 4), Map.of());
        List<Match> all = Bracket.create(UUID.randomUUID(), plan, true, null, (r, i) -> Instant.EPOCH);
        // 4 saralash + 8 + 4 + 2 + 1 + 3-o'rin
        assertThat(all).hasSize(4 + 8 + 4 + 2 + 1 + 1);
        Map<UUID, Match> byId = new HashMap<>();
        all.forEach(m -> byId.put(m.getId(), m));
        List<Match> playIns = all.stream().filter(m -> m.playoffRound == PlayoffRound.R32).toList();
        assertThat(playIns).hasSize(4);
        for (Match p : playIns) {
            Match next = byId.get(p.nextMatchId);
            assertThat(next.playoffRound).isEqualTo(PlayoffRound.R16);
            UUID waiting = "home".equals(p.nextSlot) ? next.homeId : next.awayId;
            UUID opponent = "home".equals(p.nextSlot) ? next.awayId : next.homeId;
            assertThat(waiting).isNull();
            assertThat(opponent).isNotNull();
        }
        Match sf = all.stream().filter(m -> m.playoffRound == PlayoffRound.SF).findFirst().orElseThrow();
        sf.homeId = UUID.randomUUID();
        sf.awayId = UUID.randomUUID();
        sf.status = MatchStatus.FINISHED;
        sf.winnerId = sf.homeId;
        var updates = Bracket.advancementUpdates(sf);
        Match fin = all.stream().filter(m -> m.playoffRound == PlayoffRound.F).findFirst().orElseThrow();
        Match third = all.stream().filter(m -> m.playoffRound == PlayoffRound.THIRD).findFirst().orElseThrow();
        assertThat(updates).contains(new Bracket.AdvanceUpdate(fin.getId(), "home", sf.homeId), new Bracket.AdvanceUpdate(third.getId(), "home", sf.awayId));
    }

    @Test
    @DisplayName("klassik tartib va chekka holatlar")
    void edgeCases() {
        assertThat(Bracket.seedOrder(8)).containsExactly(1, 8, 4, 5, 2, 7, 3, 6);
        assertThat(Bracket.plan(List.of(group("A", 2, 1)), Map.of()).error()).contains("kamida 2");
        // 3 jamoa: kuchlisi finalda kutadi, qolgan ikkitasi saralash o'ynaydi
        Bracket.Plan three = Bracket.plan(List.of(group("A", 4, 2), group("B", 4, 1)), Map.of());
        assertThat(three.bracketSize()).isEqualTo(2);
        assertThat(three.playIns()).hasSize(1);
    }
}
