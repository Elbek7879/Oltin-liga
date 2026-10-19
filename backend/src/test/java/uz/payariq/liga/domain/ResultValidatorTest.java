package uz.payariq.liga.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import uz.payariq.liga.domain.ResultValidator.ResultEvent;
import uz.payariq.liga.domain.ResultValidator.ResultInput;
import uz.payariq.liga.model.Match;

class ResultValidatorTest {

    private final UUID home = UUID.randomUUID();
    private final UUID away = UUID.randomUUID();
    private final UUID h1 = UUID.randomUUID();
    private final UUID h2 = UUID.randomUUID();
    private final UUID a1 = UUID.randomUUID();
    private final Map<UUID, Set<UUID>> rosters = Map.of(home, Set.of(h1, h2), away, Set.of(a1));

    private Match match(MatchStage stage) {
        Match m = new Match();
        m.stage = stage;
        m.homeId = home;
        m.awayId = away;
        return m;
    }

    private ResultInput finished(int hs, int as, List<ResultEvent> events) {
        return new ResultInput(MatchStatus.FINISHED, hs, as, null, null, null, null, null, null, events, null);
    }

    private ResultValidator.ValidationResult validate(Match m, ResultInput in) {
        return ResultValidator.validate(m, in, t -> rosters.getOrDefault(t, Set.of()), t -> t.equals(home) ? "Uy" : "Mehmon");
    }

    private ResultEvent goal(UUID team, UUID player) {
        return new ResultEvent(EventType.GOAL, team, player, null, null);
    }

    @Test
    @DisplayName("hisob va gol mualliflari mos bo'lsa xato yo'q")
    void valid() {
        var r = validate(match(MatchStage.GROUP), finished(2, 1, List.of(goal(home, h1), new ResultEvent(EventType.PENALTY_GOAL, home, h2, null, 70), goal(away, a1))));
        assertThat(r.errors()).isEmpty();
    }

    @Test
    @DisplayName("gollar soni hisobga mos kelmasa tushunarli xato beradi")
    void mismatch() {
        var r = validate(match(MatchStage.GROUP), finished(3, 1, List.of(goal(home, h1))));
        assertThat(r.errors()).anyMatch(e -> e.contains("Uy: hisobda 3 ta gol, kiritilgan gollar esa 1 ta"));
        assertThat(r.errors()).anyMatch(e -> e.startsWith("Mehmon"));
    }

    @Test
    @DisplayName("avtogol raqib jamoa hisobiga yoziladi")
    void ownGoal() {
        var r = validate(match(MatchStage.GROUP), finished(1, 0, List.of(new ResultEvent(EventType.OWN_GOAL, away, a1, null, 10))));
        assertThat(r.errors()).isEmpty();
    }

    @Test
    @DisplayName("boshqa jamoa futbolchisi gol muallifi bo'la olmaydi")
    void wrongRoster() {
        var r = validate(match(MatchStage.GROUP), finished(1, 0, List.of(goal(home, a1))));
        assertThat(r.errors()).anyMatch(e -> e.contains("tarkibida yo‘q"));
    }

    @Test
    @DisplayName("rejalashtirilgan o'yinga gol kiritib bo'lmaydi")
    void scheduledWithEvents() {
        var in = new ResultInput(MatchStatus.SCHEDULED, null, null, null, null, null, null, null, null, List.of(goal(home, h1)), null);
        assertThat(validate(match(MatchStage.GROUP), in).errors()).hasSize(1);
    }

    @Test
    @DisplayName("pley-offda durangda qo'shimcha vaqt va penaltilar talab qilinadi")
    void playoffTie() {
        Match m = match(MatchStage.PLAYOFF);
        assertThat(validate(m, finished(1, 1, List.of(goal(home, h1), goal(away, a1)))).errors().get(0)).contains("Qo‘shimcha vaqt");
        var equalPens = new ResultInput(MatchStatus.FINISHED, 0, 0, 0, 0, 3, 3, null, null, List.of(), null);
        assertThat(validate(m, equalPens).errors()).anyMatch(e -> e.contains("g‘olib bo‘lishi kerak"));
        var ok = new ResultInput(MatchStatus.FINISHED, 0, 0, 0, 0, 4, 3, null, null, List.of(), null);
        assertThat(validate(m, ok).errors()).isEmpty();
        assertThat(ResultValidator.deriveOutcome(m, ok).decidedBy()).isEqualTo(DecidedBy.PENALTIES);
        assertThat(ResultValidator.deriveOutcome(m, ok).winnerId()).isEqualTo(home);
    }

    @Test
    @DisplayName("noma'lum muallif ogohlantirish bilan qabul qilinadi")
    void unknownScorer() {
        var r = validate(match(MatchStage.GROUP), finished(1, 0, List.of(goal(home, null))));
        assertThat(r.errors()).isEmpty();
        assertThat(r.warnings()).hasSize(1);
    }

    @Test
    @DisplayName("texnik mag'lubiyat 3:0 deb yoziladi")
    void forfeit() {
        var in = new ResultInput(MatchStatus.FINISHED, null, null, null, null, null, null, "away", null, List.of(), null);
        var outcome = ResultValidator.deriveOutcome(match(MatchStage.GROUP), in);
        assertThat(outcome.homeScore()).isEqualTo(3);
        assertThat(outcome.awayScore()).isZero();
        assertThat(outcome.decidedBy()).isEqualTo(DecidedBy.FORFEIT);
        assertThat(outcome.winnerId()).isEqualTo(home);
    }

    @Test
    @DisplayName("bitta futbolchiga ikkita qizil kartochka berib bo'lmaydi")
    void doubleRed() {
        var in = finished(0, 0, List.of(new ResultEvent(EventType.RED, home, h1, null, 10), new ResultEvent(EventType.RED, home, h1, null, 20)));
        assertThat(validate(match(MatchStage.GROUP), in).errors()).anyMatch(e -> e.contains("qizil kartochka"));
    }
}
