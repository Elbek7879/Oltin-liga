package uz.payariq.liga.domain;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.model.Season;

/** Testlar uchun qisqa yordamchilar: jamoalarni harf bilan belgilash va o'yin yaratish */
final class Fixtures {

    private static final Map<String, UUID> IDS = new HashMap<>();
    private static int day = 0;

    private Fixtures() {
    }

    static UUID id(String name) {
        return IDS.computeIfAbsent(name, k -> UUID.nameUUIDFromBytes(k.getBytes()));
    }

    static String nameOf(UUID id) {
        return IDS.entrySet().stream().filter(e -> e.getValue().equals(id)).map(Map.Entry::getKey).findFirst().orElse("?");
    }

    static Season rules() {
        return new Season();
    }

    static Match played(String home, String away, int hs, int as) {
        Match m = new Match();
        m.seasonId = id("season");
        m.stage = MatchStage.GROUP;
        m.homeId = id(home);
        m.awayId = id(away);
        m.homeScore = hs;
        m.awayScore = as;
        m.status = MatchStatus.FINISHED;
        m.kickoff = Instant.parse("2026-05-01T11:00:00Z").plusSeconds(86_400L * day++);
        return m;
    }

    static MatchEvent event(Match m, EventType type, String team, UUID player) {
        MatchEvent e = new MatchEvent();
        e.matchId = m.getId();
        e.type = type;
        e.seasonTeamId = id(team);
        e.playerId = player;
        return e;
    }
}
