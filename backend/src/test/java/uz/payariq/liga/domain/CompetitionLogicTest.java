package uz.payariq.liga.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.model.Appearance;

class CompetitionLogicTest {

    private static List<UUID> teams(int n) {
        return IntStream.range(0, n).mapToObj(i -> UUID.randomUUID()).toList();
    }

    @ParameterizedTest(name = "{0} ta jamoa")
    @ValueSource(ints = {4, 5, 6, 16})
    @DisplayName("davra tizimi: har juftlik bir marta, turda jamoa takrorlanmaydi")
    void roundRobin(int n) {
        List<Schedule.Pairing> pairs = Schedule.roundRobin(teams(n), 1);
        assertThat(pairs).hasSize(n * (n - 1) / 2);
        Set<String> keys = pairs.stream().map(p -> p.homeId().compareTo(p.awayId()) < 0 ? p.homeId() + "-" + p.awayId() : p.awayId() + "-" + p.homeId())
                .collect(Collectors.toSet());
        assertThat(keys).hasSize(pairs.size());
        Map<Integer, List<Schedule.Pairing>> byRound = pairs.stream().collect(Collectors.groupingBy(Schedule.Pairing::round));
        for (List<Schedule.Pairing> round : byRound.values()) {
            List<UUID> ids = round.stream().flatMap(p -> java.util.stream.Stream.of(p.homeId(), p.awayId())).toList();
            assertThat(new HashSet<>(ids)).hasSize(ids.size());
        }
    }

    @Test
    @DisplayName("ikki davrali formatda uy va mehmon almashadi")
    void twoLegs() {
        List<UUID> t = teams(4);
        List<Schedule.Pairing> pairs = Schedule.roundRobin(t, 2);
        assertThat(pairs).hasSize(12);
        List<Schedule.Pairing> ab = pairs.stream().filter(p -> Set.of(p.homeId(), p.awayId()).equals(Set.of(t.get(0), t.get(1)))).toList();
        assertThat(ab).hasSize(2);
        assertThat(ab.get(0).homeId()).isEqualTo(ab.get(1).awayId());
    }

    @Test
    @DisplayName("sanasiz o'yinning tartib vaqti turlar ketma-ketligini saqlaydi (Toshkent vaqti)")
    void placeholderKickoffs() {
        LocalDate start = LocalDate.of(2026, 5, 2);
        assertThat(Schedule.placeholderKickoff(start, 1)).isEqualTo(Instant.parse("2026-05-02T07:00:00Z"));
        assertThat(Schedule.placeholderKickoff(start, 3)).isEqualTo(Instant.parse("2026-05-16T07:00:00Z"));
        assertThat(Schedule.placeholderKickoff(start, 2)).isBefore(Schedule.placeholderKickoff(start, 3));
    }

    @Test
    @DisplayName("bir jamoaga yaqin vaqtda ikkinchi o'yin belgilansa ogohlantiradi")
    void conflicts() {
        UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID();
        Match existing = new Match();
        existing.homeId = a;
        existing.awayId = b;
        existing.kickoff = Instant.parse("2026-05-02T11:00:00Z");
        existing.status = MatchStatus.SCHEDULED;
        assertThat(Schedule.findConflicts(UUID.randomUUID(), c, a, Instant.parse("2026-05-02T13:00:00Z"), List.of(existing))).hasSize(1);
        assertThat(Schedule.findConflicts(UUID.randomUUID(), c, a, Instant.parse("2026-05-09T13:00:00Z"), List.of(existing))).isEmpty();
    }

    @Test
    @DisplayName("30 ta jamoani 8 guruhga muvozanatli taqsimlaydi")
    void balancedDraw() {
        assertThat(GroupDraw.groupSizes(30, 8)).containsExactly(4, 4, 4, 4, 4, 4, 3, 3);
        List<UUID> t = teams(30);
        var groups = GroupDraw.randomDraw(t, 8, new Random(7));
        assertThat(groups.stream().map(g -> g.teamIds().size())).containsExactly(4, 4, 4, 4, 4, 4, 3, 3);
        assertThat(groups.stream().flatMap(g -> g.teamIds().stream()).distinct().count()).isEqualTo(30);
        assertThat(GroupDraw.check(groups, t).ok()).isTrue();
    }

    @Test
    @DisplayName("bir jamoa ikki guruhga tushsa xato beradi")
    void duplicateTeam() {
        UUID x = UUID.randomUUID(), y = UUID.randomUUID(), z = UUID.randomUUID();
        var check = GroupDraw.check(List.of(new GroupDraw.DrawGroup("A", List.of(x, y)), new GroupDraw.DrawGroup("B", List.of(x, z))), List.of(x, y, z));
        assertThat(check.ok()).isFalse();
        assertThat(check.errors().get(0)).contains("ikki guruhga");
    }

    @Test
    @DisplayName("statistika: avtogol futbolchi gollariga qo'shilmaydi, assist hisoblanadi")
    void playerStats() {
        Match m = Fixtures.played("H", "A", 2, 1);
        UUID h1 = UUID.randomUUID(), h2 = UUID.randomUUID(), a1 = UUID.randomUUID(), a2 = UUID.randomUUID();
        MatchEvent g1 = Fixtures.event(m, EventType.GOAL, "H", h1);
        g1.assistId = h2;
        MatchEvent og = Fixtures.event(m, EventType.OWN_GOAL, "A", a1);
        MatchEvent g2 = Fixtures.event(m, EventType.GOAL, "A", a2);
        Appearance ap = new Appearance();
        ap.matchId = m.getId();
        ap.playerId = h1;
        ap.seasonTeamId = Fixtures.id("H");
        var stats = PlayerStats.compute(List.of(m), List.of(g1, og, g2), List.of(ap));
        var byPlayer = stats.stream().collect(Collectors.toMap(s -> s.playerId, s -> s));
        assertThat(byPlayer.get(h1).goals).isEqualTo(1);
        assertThat(byPlayer.get(h1).appearances).isEqualTo(1);
        assertThat(byPlayer.get(h2).assists).isEqualTo(1);
        assertThat(byPlayer.get(a1).goals).isZero();
        assertThat(byPlayer.get(a1).ownGoals).isEqualTo(1);
        assertThat(PlayerStats.topScorers(stats, id -> "x")).hasSize(2);
    }
}
