package uz.payariq.liga.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static uz.payariq.liga.domain.Fixtures.id;
import static uz.payariq.liga.domain.Fixtures.nameOf;
import static uz.payariq.liga.domain.Fixtures.played;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import uz.payariq.liga.domain.StandingsCalculator.StandingRow;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.model.PointAdjustment;

class StandingsCalculatorTest {

    private static List<StandingRow> table(List<String> teams, List<Match> matches) {
        return table(teams, matches, List.of(), List.of());
    }

    private static List<StandingRow> table(List<String> teams, List<Match> matches, List<MatchEvent> events, List<PointAdjustment> adj) {
        List<UUID> ids = teams.stream().map(Fixtures::id).toList();
        return StandingsCalculator.compute(ids, matches, events, adj, Fixtures.rules(), Fixtures::nameOf);
    }

    private static List<String> order(List<StandingRow> rows) {
        return rows.stream().map(r -> nameOf(r.seasonTeamId())).toList();
    }

    @Test
    @DisplayName("ochkolarni 3/1/0 qoidasi bo'yicha hisoblaydi va tartiblaydi")
    void pointsAndOrder() {
        var rows = table(List.of("A", "B", "C", "D"), List.of(played("A", "B", 3, 1), played("C", "D", 0, 0), played("A", "C", 2, 2), played("B", "D", 1, 0)));
        assertThat(order(rows)).containsExactly("A", "B", "C", "D");
        assertThat(rows.stream().map(StandingRow::points)).containsExactly(4, 3, 2, 1);
        StandingRow a = rows.get(0);
        assertThat(a.played()).isEqualTo(2);
        assertThat(a.goalsFor()).isEqualTo(5);
        assertThat(a.goalsAgainst()).isEqualTo(3);
        assertThat(a.goalDiff()).isEqualTo(2);
    }

    @Test
    @DisplayName("yakunlanmagan o'yinlarni hisobga olmaydi")
    void ignoresUnfinished() {
        Match live = played("A", "B", 5, 0);
        live.status = MatchStatus.LIVE;
        var rows = table(List.of("A", "B"), List.of(live));
        assertThat(rows).allMatch(r -> r.played() == 0 && r.points() == 0);
    }

    @Test
    @DisplayName("natija tahrirlansa jadval noldan qayta hisoblanadi — o'yin ikki marta qo'shilmaydi")
    void editedResultRecomputed() {
        Match m = played("A", "B", 2, 0);
        assertThat(table(List.of("A", "B"), List.of(m)).get(0).points()).isEqualTo(3);
        m.homeScore = 0;
        m.awayScore = 1;
        var after = table(List.of("A", "B"), List.of(m));
        assertThat(nameOf(after.get(0).seasonTeamId())).isEqualTo("B");
        assertThat(after.get(1).played()).isEqualTo(1);
        assertThat(after.get(1).points()).isZero();
    }

    @Test
    @DisplayName("uch jamoa teng bo'lsa o'zaro o'yinlardagi to'plar farqi hal qiladi")
    void threeWayTie() {
        var rows = table(List.of("A", "B", "C"), List.of(played("A", "B", 1, 0), played("B", "C", 4, 0), played("C", "A", 1, 0)));
        assertThat(order(rows)).containsExactly("B", "A", "C");
    }

    @Test
    @DisplayName("ikki jamoa teng bo'lsa o'zaro o'yin g'olibi umumiy to'plar farqidan ustun")
    void headToHeadBeatsGoalDiff() {
        var rows = table(List.of("X", "Y", "Z", "W"), List.of(
                played("X", "Y", 2, 1), played("Y", "Z", 6, 0), played("X", "Z", 0, 1),
                played("Z", "W", 0, 0), played("Y", "W", 1, 0), played("X", "W", 1, 0)));
        List<String> order = order(rows);
        assertThat(order.indexOf("X")).isLessThan(order.indexOf("Y"));
    }

    @Test
    @DisplayName("jarima ochkolarini qo'shadi")
    void adjustments() {
        PointAdjustment a = new PointAdjustment();
        a.seasonTeamId = id("A");
        a.points = -3;
        var rows = table(List.of("A", "B"), List.of(played("A", "B", 1, 0)), List.of(), List.of(a));
        StandingRow ra = rows.stream().filter(r -> r.seasonTeamId().equals(id("A"))).findFirst().orElseThrow();
        assertThat(ra.points()).isZero();
        assertThat(ra.adjustment()).isEqualTo(-3);
    }

    @Test
    @DisplayName("Fair Play mezoni kartochkalarni hisoblaydi")
    void fairPlay() {
        Match m1 = played("A", "C", 1, 0);
        Match m2 = played("B", "D", 1, 0);
        MatchEvent yellow = Fixtures.event(m1, EventType.YELLOW, "A", UUID.randomUUID());
        var rows = StandingsCalculator.compute(List.of(id("A"), id("B"), id("C"), id("D")), List.of(m1, m2), List.of(yellow), List.of(),
                Fixtures.rules(), Fixtures::nameOf);
        // A va B barcha mezonlarda teng; A da sariq kartochka bor — B yuqorida
        assertThat(order(rows).subList(0, 2)).containsExactly("B", "A");
    }

    @Test
    @DisplayName("oxirgi o'yinlar shaklini eskidan yangiga beradi")
    void form() {
        var rows = table(List.of("A", "B", "C", "D"), List.of(played("A", "B", 1, 0), played("A", "C", 0, 0), played("D", "A", 2, 0)));
        StandingRow a = rows.stream().filter(r -> r.seasonTeamId().equals(id("A"))).findFirst().orElseThrow();
        assertThat(a.form()).containsExactly("W", "D", "L");
    }
}
