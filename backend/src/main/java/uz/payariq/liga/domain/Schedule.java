package uz.payariq.liga.domain;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import uz.payariq.liga.model.Match;

/** O'yinlar taqvimi: davra tizimi (juftliklar), tartib vaqti va to'qnashuvlarni aniqlash */
public final class Schedule {

    public static final ZoneId ZONE = ZoneId.of("Asia/Tashkent");
    private static final long CONFLICT_WINDOW_HOURS = 20;

    private Schedule() {
    }

    public record Pairing(int round, UUID homeId, UUID awayId) {
    }

    public record Conflict(UUID matchId, UUID teamId, Instant kickoff) {
    }

    /**
     * Davra tizimi (circle method). Har turda har bir jamoa ko'pi bilan bitta o'yin o'ynaydi;
     * jamoalar soni toq bo'lsa, har turda bitta jamoa dam oladi. legs = 2 bo'lsa har juftlik ikkinchi davrada yana o'ynaydi.
     */
    public static List<Pairing> roundRobin(List<UUID> teamIds, int legs) {
        if (teamIds.size() < 2) return List.of();
        List<UUID> teams = new ArrayList<>(teamIds);
        if (teams.size() % 2 == 1) teams.add(null);
        int n = teams.size();
        int rounds = n - 1;
        int half = n / 2;
        List<Pairing> result = new ArrayList<>();
        List<UUID> rotation = new ArrayList<>(teams);
        for (int r = 0; r < rounds; r++) {
            for (int i = 0; i < half; i++) {
                UUID a = rotation.get(i);
                UUID b = rotation.get(n - 1 - i);
                if (a == null || b == null) continue;
                boolean swap = i == 0 ? r % 2 == 1 : (r + i) % 2 == 1;
                result.add(new Pairing(r + 1, swap ? b : a, swap ? a : b));
            }
            List<UUID> next = new ArrayList<>();
            next.add(rotation.get(0));
            next.add(rotation.get(n - 1));
            next.addAll(rotation.subList(1, n - 1));
            rotation = next;
        }
        if (legs == 2) {
            List<Pairing> second = result.stream().map(p -> new Pairing(p.round() + rounds, p.awayId(), p.homeId())).toList();
            result.addAll(second);
        }
        return result;
    }

    /**
     * Sanasi hali belgilanmagan o'yin uchun ichki tartib vaqti (saytda ko'rsatilmaydi — «Sana belgilanmagan»).
     * Turlar tartibini saqlaydi: 1-tur mavsum boshida, keyingilari har 7 kunda.
     * Haqiqiy sana va vaqtni har bir o'yin uchun tashkilotchi belgilaydi.
     */
    public static Instant placeholderKickoff(LocalDate seasonStart, int round) {
        LocalDate start = seasonStart != null ? seasonStart : LocalDate.now(ZONE);
        return start.plusDays(7L * Math.max(0, round - 1)).atTime(LocalTime.NOON).atZone(ZONE).toInstant();
    }

    /** Bir jamoaga bir-biriga juda yaqin vaqtda ikkita o'yin belgilanganini aniqlaydi */
    public static List<Conflict> findConflicts(UUID candidateId, UUID homeId, UUID awayId, Instant kickoff, List<Match> matches) {
        List<Conflict> conflicts = new ArrayList<>();
        for (Match m : matches) {
            if (m.getId().equals(candidateId) || !m.timeConfirmed || m.status == MatchStatus.CANCELLED || m.status == MatchStatus.POSTPONED) continue;
            long hours = Math.abs(Duration.between(m.kickoff, kickoff).toMinutes()) / 60;
            if (hours >= CONFLICT_WINDOW_HOURS) continue;
            for (UUID team : new UUID[] {homeId, awayId}) {
                if (team != null && m.involves(team)) conflicts.add(new Conflict(m.getId(), team, m.kickoff));
            }
        }
        return conflicts;
    }
}
