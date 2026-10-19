package uz.payariq.liga.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiFunction;
import uz.payariq.liga.model.Match;

/**
 * Pley-off sxemasi. Guruhlardan chiqadiganlar soni guruh hajmiga bog'liq (masalan, 4 jamoalidan 2 ta, 5 jamoalidan 3 ta),
 * shuning uchun jami soni har doim ham 2, 4, 8, 16, 32 bo'lavermaydi. Bunday holatda:
 * <ol>
 *   <li>chiqqan jamoalar umumiy reytingga qo'yiladi: avval guruh g'oliblari, keyin ikkinchilar, keyin uchinchilar;
 *       bir xil o'rindagilar o'yin boshiga o'rtacha ochko, to'plar farqi, urilgan gol va Fair Play bo'yicha, so'ng qur'a bilan;</li>
 *   <li>eng yaxshilari asosiy setkaga to'g'ridan-to'g'ri o'tadi, qolganlari saralash o'yinida bo'sh joylar uchun o'ynaydi;</li>
 *   <li>bitta guruhdan chiqqan jamoalar imkon qadar birinchi bosqichda uchrashmaydi.</li>
 * </ol>
 * Frontend {@code domain/playoff.ts} da xuddi shu algoritm bor — o'zgartirilsa ikkalasi ham yangilanadi.
 */
public final class Bracket {

    private static final List<PlayoffRound> SEQUENCE = List.of(PlayoffRound.R64, PlayoffRound.R32, PlayoffRound.R16, PlayoffRound.QF, PlayoffRound.SF, PlayoffRound.F);
    public static final int MAX_TEAMS = 64;
    public static final String PLAY_IN_LABEL = "Saralash";

    private Bracket() {
    }

    /** Guruhdagi jamoaning reyting uchun kerakli ko'rsatkichlari (jadval tartibida) */
    public record TeamRecord(UUID seasonTeamId, int played, int points, int goalDiff, int goalsFor, int fairPlay) {
    }

    /** Guruh yakuni: jadval tartibi va shu guruhdan chiqadiganlar soni */
    public record GroupFinish(String name, List<TeamRecord> table, int qualifiers) {
    }

    /** Reytingdagi o'rin: 1 — eng kuchli */
    public record Seed(int seed, UUID seasonTeamId, String label, String groupName, int position) {
    }

    /** Asosiy setkadagi joy: jamoa to'g'ridan-to'g'ri yoki saralash o'yini g'olibi */
    public record Slot(String label, UUID seasonTeamId, Integer playInIndex) {
        static Slot direct(Seed s) {
            return new Slot(s.label(), s.seasonTeamId(), null);
        }
    }

    public record PlayIn(Seed home, Seed away) {
    }

    /** Bir o'rindagi jamoalar qur'asiz ajratib bo'lmagan holat */
    public record SeedTie(int position, List<UUID> seasonTeamIds) {
    }

    public record Plan(List<Seed> seeds, int bracketSize, List<PlayIn> playIns, List<Slot> slots, List<SeedTie> ties, String error) {
        public int directCount() {
            return seeds.size() - playIns.size() * 2;
        }
    }

    public record AdvanceUpdate(UUID matchId, String slot, UUID seasonTeamId) {
    }

    public static boolean isPowerOfTwo(int n) {
        return n >= 2 && (n & (n - 1)) == 0;
    }

    /** n dan oshmaydigan eng katta 2 ning darajasi */
    public static int bracketSizeFor(int n) {
        return n < 2 ? 0 : Integer.highestOneBit(n);
    }

    public static PlayoffRound firstRoundFor(int bracketSize) {
        return switch (bracketSize) {
            case 2 -> PlayoffRound.F;
            case 4 -> PlayoffRound.SF;
            case 8 -> PlayoffRound.QF;
            case 16 -> PlayoffRound.R16;
            case 32 -> PlayoffRound.R32;
            case 64 -> PlayoffRound.R64;
            default -> null;
        };
    }

    /**
     * Pley-off rejasi: reyting, saralash juftliklari va asosiy setka joylari.
     *
     * @param seedLots o'rin bo'yicha qur'a natijalari (o'rin → jamoalar tartibi)
     */
    public static Plan plan(List<GroupFinish> groups, Map<Integer, List<UUID>> seedLots) {
        List<Seed> seeds = new ArrayList<>();
        List<SeedTie> ties = new ArrayList<>();
        int maxQ = groups.stream().mapToInt(GroupFinish::qualifiers).max().orElse(0);
        for (int pos = 1; pos <= maxQ; pos++) {
            final int p = pos;
            List<Entry> tier = new ArrayList<>();
            for (GroupFinish g : groups) {
                if (p <= g.qualifiers() && g.table().size() >= p) tier.add(new Entry(g.name(), g.table().get(p - 1)));
            }
            List<UUID> lot = seedLots.getOrDefault(p, List.of());
            for (List<Entry> sorted : orderTier(tier, lot, ties, p)) {
                for (Entry e : sorted) seeds.add(new Seed(seeds.size() + 1, e.record().seasonTeamId(), e.group() + p, e.group(), p));
            }
        }
        int n = seeds.size();
        if (n < 2) return new Plan(seeds, 0, List.of(), List.of(), ties, "Pley-off uchun kamida 2 ta jamoa chiqishi kerak.");
        if (n > MAX_TEAMS) return new Plan(seeds, 0, List.of(), List.of(), ties, "Pley-offga " + n + " ta jamoa chiqadi — ko‘pi bilan " + MAX_TEAMS + " ta bo‘lishi mumkin.");

        int size = bracketSizeFor(n);
        int playInCount = n - size;
        int direct = size - playInCount;

        // Saralash: eng past reytingdagilar — (direct+j) va (n+1-j)
        List<Seed[]> pairs = new ArrayList<>();
        for (int j = 1; j <= playInCount; j++) pairs.add(new Seed[] {seeds.get(direct + j - 1), seeds.get(n - j)});
        separateGroups(pairs);
        List<PlayIn> playIns = pairs.stream().map(pr -> new PlayIn(pr[0], pr[1])).toList();

        // Asosiy setka: klassik tartib (1–16, 8–9 ...); saralash g'olibi o'z o'rnidagi kuchliroq raqib o'rnini egallaydi
        List<Slot> slots = new ArrayList<>();
        for (int s : seedOrder(size)) {
            if (s <= direct) slots.add(Slot.direct(seeds.get(s - 1)));
            else slots.add(new Slot(PLAY_IN_LABEL + " " + (s - direct) + " g‘olibi", null, s - direct - 1));
        }
        separateFirstRound(slots, seeds, playIns);
        return new Plan(seeds, size, playIns, slots, ties, null);
    }

    private record Entry(String group, TeamRecord record) {
    }

    /** O'rindagi jamoalarni o'yin boshiga o'rtacha ko'rsatkichlar bo'yicha tartiblaydi; ajratib bo'lmaganlarga qur'a */
    private static List<List<Entry>> orderTier(List<Entry> tier, List<UUID> lot, List<SeedTie> ties, int position) {
        Comparator<Entry> stats = (a, b) -> {
            int c = compareRate(b.record().points(), b.record().played(), a.record().points(), a.record().played());
            if (c != 0) return c;
            c = compareRate(b.record().goalDiff(), b.record().played(), a.record().goalDiff(), a.record().played());
            if (c != 0) return c;
            c = compareRate(b.record().goalsFor(), b.record().played(), a.record().goalsFor(), a.record().played());
            if (c != 0) return c;
            // Fair Play: kamroq jarima ochkosi yaxshiroq
            return compareRate(a.record().fairPlay(), a.record().played(), b.record().fairPlay(), b.record().played());
        };
        List<Entry> sorted = new ArrayList<>(tier);
        sorted.sort(stats.thenComparing(Entry::group));
        List<List<Entry>> clusters = new ArrayList<>();
        for (Entry e : sorted) {
            if (!clusters.isEmpty() && stats.compare(clusters.get(clusters.size() - 1).get(0), e) == 0) clusters.get(clusters.size() - 1).add(e);
            else clusters.add(new ArrayList<>(List.of(e)));
        }
        for (List<Entry> cluster : clusters) {
            if (cluster.size() < 2) continue;
            List<UUID> ids = cluster.stream().map(e -> e.record().seasonTeamId()).toList();
            if (lot.containsAll(ids)) cluster.sort(Comparator.comparingInt(e -> lot.indexOf(e.record().seasonTeamId())));
            else ties.add(new SeedTie(position, ids));
        }
        return clusters;
    }

    /** a/aN va b/bN kasrlarini aniq taqqoslaydi; o'yin o'ynamagan jamoaning ko'rsatkichi 0. Musbat — a katta */
    static int compareRate(int a, int aN, int b, int bN) {
        if (aN == 0 && bN == 0) return 0;
        if (aN == 0) return Long.compare(0, b);
        if (bN == 0) return Long.compare(a, 0);
        return Long.compare((long) a * bN, (long) b * aN);
    }

    /** Saralash juftligida bitta guruh jamoalari tushsa, kuchsizroq raqiblarni boshqa juftlik bilan almashtiradi */
    private static void separateGroups(List<Seed[]> pairs) {
        for (int i = 0; i < pairs.size(); i++) {
            Seed[] a = pairs.get(i);
            if (!a[0].groupName().equals(a[1].groupName())) continue;
            for (int k = 0; k < pairs.size(); k++) {
                if (k == i) continue;
                Seed[] b = pairs.get(k);
                if (!a[0].groupName().equals(b[1].groupName()) && !b[0].groupName().equals(a[1].groupName())) {
                    Seed tmp = a[1];
                    a[1] = b[1];
                    b[1] = tmp;
                    break;
                }
            }
        }
    }

    /**
     * Birinchi bosqichda bitta guruh jamoalari uchrashsa, kuchsizroq raqibni boshqa juftlikdagi bilan almashtiradi.
     * To'qnashuv bahosi: aniq uchrashuv — 2, saralash g'olibi o'sha guruhdan chiqishi mumkin — 1.
     * Umumiy baho kamaysagina almashtiriladi.
     */
    private static void separateFirstRound(List<Slot> slots, List<Seed> seeds, List<PlayIn> playIns) {
        Map<UUID, String> groupOf = new HashMap<>();
        seeds.forEach(s -> groupOf.put(s.seasonTeamId(), s.groupName()));
        for (int i = 0; i < slots.size(); i += 2) {
            if (clash(slots.get(i), slots.get(i + 1), groupOf, playIns) < 2) continue;
            int bestK = -1;
            int bestScore = clash(slots.get(i), slots.get(i + 1), groupOf, playIns);
            for (int k = 0; k < slots.size(); k += 2) {
                if (k == i) continue;
                int before = bestScore + clash(slots.get(k), slots.get(k + 1), groupOf, playIns);
                int after = clash(slots.get(i), slots.get(k + 1), groupOf, playIns) + clash(slots.get(k), slots.get(i + 1), groupOf, playIns);
                if (after < before && (bestK < 0 || after < bestScore)) {
                    bestK = k;
                    bestScore = after;
                    if (after == 0) break;
                }
            }
            if (bestK >= 0) {
                Slot away = slots.get(i + 1);
                slots.set(i + 1, slots.get(bestK + 1));
                slots.set(bestK + 1, away);
            }
        }
    }

    private static int clash(Slot a, Slot b, Map<UUID, String> groupOf, List<PlayIn> playIns) {
        List<String> ga = groupsOf(a, groupOf, playIns);
        List<String> gb = groupsOf(b, groupOf, playIns);
        boolean overlap = ga.stream().anyMatch(gb::contains);
        if (!overlap) return 0;
        return a.playInIndex() == null && b.playInIndex() == null ? 2 : 1;
    }

    private static List<String> groupsOf(Slot s, Map<UUID, String> groupOf, List<PlayIn> playIns) {
        if (s.playInIndex() == null) return List.of(groupOf.get(s.seasonTeamId()));
        PlayIn p = playIns.get(s.playInIndex());
        return List.of(p.home().groupName(), p.away().groupName());
    }

    /** Klassik sxema tartibi: 8 ta uchun [1,8,4,5,2,7,3,6] */
    public static List<Integer> seedOrder(int size) {
        List<Integer> order = new ArrayList<>(List.of(1, 2));
        while (order.size() < size) {
            int n = order.size() * 2 + 1;
            List<Integer> next = new ArrayList<>();
            for (int s : order) {
                next.add(s);
                next.add(n - s);
            }
            order = next;
        }
        return order;
    }

    /** Pley-off o'yinlarini yaratadi va "g'olib keyingi o'yinga o'tadi" bog'lanishlari bilan ulaydi */
    public static List<Match> create(UUID seasonId, Plan plan, boolean thirdPlace, UUID venueId, BiFunction<PlayoffRound, Integer, Instant> kickoffFor) {
        PlayoffRound first = firstRoundFor(plan.bracketSize());
        if (first == null || plan.error() != null) return List.of();
        List<PlayoffRound> rounds = SEQUENCE.subList(SEQUENCE.indexOf(first), SEQUENCE.size());
        List<List<Match>> byRound = new ArrayList<>();
        for (int r = 0; r < rounds.size(); r++) {
            int count = plan.bracketSize() >> (r + 1);
            List<Match> list = new ArrayList<>();
            for (int i = 0; i < count; i++) list.add(newMatch(seasonId, rounds.get(r), i, venueId, kickoffFor.apply(rounds.get(r), i)));
            byRound.add(list);
        }

        // Saralash o'yinlari asosiy setkadan oldingi bosqich sifatida
        List<Match> playIns = new ArrayList<>();
        if (!plan.playIns().isEmpty()) {
            PlayoffRound playInRound = SEQUENCE.get(SEQUENCE.indexOf(first) - 1);
            for (int j = 0; j < plan.playIns().size(); j++) {
                PlayIn p = plan.playIns().get(j);
                Match m = newMatch(seasonId, playInRound, j, venueId, kickoffFor.apply(playInRound, j));
                m.homeId = p.home().seasonTeamId();
                m.awayId = p.away().seasonTeamId();
                m.homeLabel = p.home().label();
                m.awayLabel = p.away().label();
                playIns.add(m);
            }
        }

        List<Match> firstRound = byRound.get(0);
        for (int i = 0; i < firstRound.size(); i++) {
            Match m = firstRound.get(i);
            fill(m, "home", plan.slots().get(i * 2), playIns);
            fill(m, "away", plan.slots().get(i * 2 + 1), playIns);
        }
        for (int r = 0; r < byRound.size() - 1; r++) {
            String label = rounds.get(r).label();
            List<Match> list = byRound.get(r);
            for (int i = 0; i < list.size(); i++) {
                Match m = list.get(i);
                Match next = byRound.get(r + 1).get(i / 2);
                String slot = i % 2 == 0 ? "home" : "away";
                m.nextMatchId = next.getId();
                m.nextSlot = slot;
                if (slot.equals("home")) next.homeLabel = label + " " + (i + 1) + " g‘olibi";
                else next.awayLabel = label + " " + (i + 1) + " g‘olibi";
            }
        }
        List<Match> all = new ArrayList<>(playIns);
        byRound.forEach(all::addAll);
        int sfIndex = rounds.indexOf(PlayoffRound.SF);
        if (thirdPlace && sfIndex >= 0 && byRound.get(sfIndex).size() == 2) {
            Match third = newMatch(seasonId, PlayoffRound.THIRD, 0, venueId, kickoffFor.apply(PlayoffRound.THIRD, 0));
            third.homeLabel = "Yarim final 1 mag‘lubi";
            third.awayLabel = "Yarim final 2 mag‘lubi";
            List<Match> semis = byRound.get(sfIndex);
            semis.get(0).loserNextMatchId = third.getId();
            semis.get(0).loserNextSlot = "home";
            semis.get(1).loserNextMatchId = third.getId();
            semis.get(1).loserNextSlot = "away";
            all.add(third);
        }
        return all;
    }

    private static void fill(Match m, String side, Slot slot, List<Match> playIns) {
        if (slot.playInIndex() != null) {
            Match feeder = playIns.get(slot.playInIndex());
            feeder.nextMatchId = m.getId();
            feeder.nextSlot = side;
        }
        if (side.equals("home")) {
            m.homeId = slot.seasonTeamId();
            m.homeLabel = slot.label();
        } else {
            m.awayId = slot.seasonTeamId();
            m.awayLabel = slot.label();
        }
    }

    private static Match newMatch(UUID seasonId, PlayoffRound round, int index, UUID venueId, Instant kickoff) {
        Match m = new Match();
        m.seasonId = seasonId;
        m.stage = MatchStage.PLAYOFF;
        m.playoffRound = round;
        m.bracketIndex = index;
        m.venueId = venueId;
        m.kickoff = kickoff;
        m.status = MatchStatus.SCHEDULED;
        return m;
    }

    /** O'yin natijasidan keyin g'olib (va yarim finalda mag'lub) keyingi o'yinga joylanadi */
    public static List<AdvanceUpdate> advancementUpdates(Match match) {
        List<AdvanceUpdate> updates = new ArrayList<>();
        boolean finished = match.status == MatchStatus.FINISHED && match.winnerId != null;
        UUID loserId = finished ? (match.winnerId.equals(match.homeId) ? match.awayId : match.homeId) : null;
        if (match.nextMatchId != null && match.nextSlot != null) {
            updates.add(new AdvanceUpdate(match.nextMatchId, match.nextSlot, finished ? match.winnerId : null));
        }
        if (match.loserNextMatchId != null && match.loserNextSlot != null) {
            updates.add(new AdvanceUpdate(match.loserNextMatchId, match.loserNextSlot, loserId));
        }
        return updates;
    }
}
