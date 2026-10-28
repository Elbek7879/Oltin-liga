package uz.payariq.liga.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.Bracket;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.PlayoffRound;
import uz.payariq.liga.domain.Schedule;
import uz.payariq.liga.domain.StandingsCalculator.StandingRow;
import uz.payariq.liga.model.LeagueGroup;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.TiebreakLot;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.TiebreakLotRepository;
import uz.payariq.liga.repo.VenueRepository;
import uz.payariq.liga.web.Dto.Created;
import uz.payariq.liga.web.Dto.MatchDto;
import uz.payariq.liga.web.Requests;

/**
 * Pley-off: guruh bosqichi tugashi bilan setka avtomatik tuziladi, tashkilotchi faqat sana va vaqtni belgilaydi.
 * Guruh natijasi keyinroq tuzatilsa (pley-off o'yinlari boshlanmagan bo'lsa), setka qayta hisoblanadi —
 * belgilangan sana-vaqtlar saqlanib qoladi.
 */
@Service
@Transactional
public class PlayoffService {

    /** Bir kunda bitta stadionda o'yinlar: har biri ~2 soat */
    private static final List<LocalTime> SLOTS = List.of(LocalTime.of(10, 0), LocalTime.of(12, 30), LocalTime.of(15, 0), LocalTime.of(17, 30));
    private static final SecureRandom RANDOM = new SecureRandom();

    private final MatchRepository matches;
    private final VenueRepository venues;
    private final TiebreakLotRepository lots;
    private final SeasonDataLoader loader;
    private final AuditService audit;
    private final ApplicationEventPublisher publisher;

    public PlayoffService(MatchRepository matches, VenueRepository venues, TiebreakLotRepository lots, SeasonDataLoader loader, AuditService audit,
                          ApplicationEventPublisher publisher) {
        this.matches = matches;
        this.venues = venues;
        this.lots = lots;
        this.loader = loader;
        this.audit = audit;
        this.publisher = publisher;
    }

    // ---------- Avtomatik setka ----------

    /**
     * Guruh bosqichi holatiga qarab setkani tuzadi, yangilaydi yoki olib tashlaydi.
     * Guruh natijasi, nizom, ochko o'zgarishi yoki qur'adan keyin chaqiriladi. Pley-off boshlangan bo'lsa setkaga
     * tegilmaydi — juftliklarni o'zgartirib yuboradigan o'zgarish esa rad etiladi (jadval va setka bir-biriga zid bo'lmasin).
     */
    public void sync(UUID seasonId) {
        matches.flush();
        SeasonData d = loader.load(seasonId);
        if (d.season().isFinished()) return;
        List<Match> playoff = playoffMatches(d);
        if (playoff.stream().anyMatch(Match::hasResult)) {
            requireSameSeeding(d, playoff);
            return;
        }

        Map<UUID, List<StandingRow>> standings = d.standings();
        Bracket.Plan plan = d.playoffPlan(standings);
        if (d.groupStageComplete() && d.groupTies(standings).isEmpty() && plan.error() == null && !plan.ties().isEmpty()) {
            // Reyting tengligi faqat juftliklarga ta'sir qiladi — tizim o'zi qur'a tashlaydi (tashkilotchi keyin almashtirishi mumkin)
            for (Bracket.SeedTie tie : plan.ties()) saveLot(d, TiebreakLot.seedScope(tie.position()), shuffled(tie.seasonTeamIds()), true);
            d = loader.load(seasonId);
            plan = d.playoffPlan(standings);
        }
        boolean ready = d.groupStageComplete() && d.groupTies(standings).isEmpty() && plan.error() == null && plan.ties().isEmpty();
        if (!ready) {
            if (!playoff.isEmpty()) {
                remove(playoff);
                audit.record("Pley-off", "Guruh bosqichi o‘zgardi — pley-off setkasi vaqtincha olib tashlandi. Hammasi aniq bo‘lgach, qayta tuziladi.", "SEASON", seasonId);
            }
            return;
        }
        if (!playoff.isEmpty() && sameTeams(playoff, plan, d.season().thirdPlaceMatch)) return;

        // Oldingi setkadagi sana-vaqt va maydonlar saqlanadi (bosqich va tartib raqami bo'yicha)
        Map<String, Match> previous = playoff.stream().collect(Collectors.toMap(PlayoffService::key, m -> m));
        boolean rebuilt = !playoff.isEmpty();
        if (rebuilt) remove(playoff);
        LocalDate start = d.matches().stream().filter(m -> m.stage == MatchStage.GROUP)
                .map(m -> m.kickoff.atZone(Schedule.ZONE).toLocalDate()).max(Comparator.naturalOrder()).orElse(LocalDate.now(Schedule.ZONE))
                .plusDays(7);
        List<Match> created = Bracket.create(seasonId, plan, d.season().thirdPlaceMatch, primaryVenue(d), defaultKickoffs(plan, start));
        for (Match m : created) {
            Match old = previous.get(key(m));
            if (old != null) {
                m.kickoff = old.kickoff;
                m.venueId = old.venueId;
                m.timeConfirmed = old.timeConfirmed;
            } else {
                m.timeConfirmed = false;
            }
        }
        save(created);
        audit.record("Pley-off", rebuilt
                ? "Guruh natijalari o‘zgardi — pley-off setkasi yangilandi"
                : "Guruh bosqichi yakunlandi — pley-off setkasi avtomatik tuzildi (" + created.size() + " ta o‘yin). Sana va vaqtlarni belgilang.", "SEASON", seasonId);
    }

    /** Tashkilotchi o'zi boshlash sanasini berib tuzadi (avtomatik tuzilmagan holatlar uchun) */
    public Created create(UUID seasonId, Requests.CreatePlayoff in) {
        Season s = loader.editableSeason(seasonId);
        SeasonData d = loader.load(seasonId);
        if (!playoffMatches(d).isEmpty()) throw ApiException.conflict("Pley-off sxemasi allaqachon yaratilgan.");
        List<Match> groupMatches = d.matches().stream().filter(m -> m.stage == MatchStage.GROUP).toList();
        if (groupMatches.isEmpty()) throw ApiException.conflict("Guruh bosqichi o‘yinlari hali yo‘q.");
        if (!d.groupStageComplete()) {
            long left = groupMatches.stream().filter(m -> m.status != MatchStatus.FINISHED && m.status != MatchStatus.CANCELLED).count();
            throw ApiException.conflict("Guruh bosqichida hali " + left + " ta o‘yin yakunlanmagan. Pley-off barcha guruh o‘yinlari tugagach tuziladi.");
        }
        if (in.venueId() != null && !venues.existsById(in.venueId())) throw ApiException.badRequest("Maydon topilmadi.");
        Map<UUID, List<StandingRow>> standings = d.standings();
        Map<UUID, List<UUID>> groupTies = d.groupTies(standings);
        if (!groupTies.isEmpty()) {
            String names = d.groups().stream().filter(g -> groupTies.containsKey(g.getId())).map(g -> g.name).collect(Collectors.joining(", "));
            throw ApiException.conflict(names + " guruhida jamoalar barcha mezonlar bo‘yicha teng. Avval qur’a tashlang.");
        }
        Bracket.Plan plan = d.playoffPlan(standings);
        if (plan.error() != null) throw ApiException.badRequest(plan.error());
        if (!plan.ties().isEmpty()) throw ApiException.conflict("Pley-off reytingida teng jamoalar bor. Avval qur’a tashlang.");
        s.thirdPlaceMatch = in.thirdPlace();
        UUID venue = in.venueId() != null ? in.venueId() : primaryVenue(d);
        List<Match> created = Bracket.create(seasonId, plan, in.thirdPlace(), venue, defaultKickoffs(plan, in.startDate()));
        save(created);
        audit.record("Pley-off", s.name + ": pley-off sxemasi yaratildi (" + created.size() + " ta o‘yin)", "SEASON", seasonId);
        return new Created(created.size());
    }

    public void delete(UUID seasonId) {
        loader.editableSeason(seasonId);
        List<Match> playoff = matches.findBySeasonIdAndStage(seasonId, MatchStage.PLAYOFF);
        if (playoff.stream().anyMatch(Match::hasResult)) throw ApiException.conflict("Pley-off o‘yinlari boshlangan, sxemani o‘chirib bo‘lmaydi.");
        remove(playoff);
        audit.record("Pley-off", "Pley-off sxemasi o‘chirildi", "SEASON", seasonId);
    }

    // ---------- Sana va vaqt ----------

    /** O'yin sanasi, vaqti va maydonini belgilaydi — saytda darhol ko'rinadi */
    public MatchDto schedule(UUID matchId, Requests.MatchSchedule in) {
        Match m = matches.findById(matchId).orElseThrow(() -> ApiException.notFound("O‘yin topilmadi."));
        loader.editableSeason(m.seasonId);
        if (in.venueId() != null && !venues.existsById(in.venueId())) throw ApiException.badRequest("Maydon topilmadi.");
        m.kickoff = in.kickoff().toInstant();
        m.venueId = in.venueId();
        m.timeConfirmed = true;
        SeasonData d = loader.load(m.seasonId);
        audit.record("O‘yin", d.teamName(m.homeId) + " — " + d.teamName(m.awayId) + ": sana va vaqt belgilandi", "MATCH", matchId);
        publisher.publishEvent(new LiveUpdates.LiveEvent(m.seasonId, m.getId(), "UPDATE", null));
        return MatchDto.of(m);
    }

    // ---------- Qur'a ----------

    /**
     * Teng holat uchun qur'a: random=true bo'lsa tizim tasodifiy tartib tanlaydi (xavfsiz tasodifiy sonlar bilan),
     * aks holda tashkilotchi joyida o'tkazilgan qur'a natijasini kiritadi.
     */
    public void drawLot(UUID seasonId, Requests.LotInput in) {
        Season s = loader.editableSeason(seasonId);
        SeasonData d = loader.load(seasonId);
        if (playoffMatches(d).stream().anyMatch(Match::hasResult)) throw ApiException.conflict("Pley-off boshlangan — qur’a natijasini o‘zgartirib bo‘lmaydi.");
        List<UUID> ids = new ArrayList<>(in.seasonTeamIds().stream().distinct().toList());
        if (ids.size() < 2) throw ApiException.badRequest("Qur’a uchun kamida 2 ta jamoa kerak.");
        String scopeLabel;
        if (in.scope().startsWith("GROUP:")) {
            UUID groupId = UUID.fromString(in.scope().substring(6));
            LeagueGroup g = d.groups().stream().filter(x -> x.getId().equals(groupId)).findFirst()
                    .orElseThrow(() -> ApiException.notFound("Guruh topilmadi."));
            if (!g.seasonTeamIds.containsAll(ids)) throw ApiException.badRequest("Qur’adagi jamoalar shu guruhdan bo‘lishi kerak.");
            scopeLabel = g.name + " guruhi";
        } else if (in.scope().matches("SEED:\\d{1,2}")) {
            if (!d.seasonTeams().stream().map(st -> st.getId()).toList().containsAll(ids)) throw ApiException.badRequest("Jamoa topilmadi.");
            scopeLabel = "pley-off reytingi (" + in.scope().substring(5) + "-o‘rinlar)";
        } else {
            throw ApiException.badRequest("Qur’a turi noto‘g‘ri.");
        }
        List<UUID> order = in.random() ? shuffled(ids) : ids;
        saveLot(d, in.scope(), order, false);
        String names = order.stream().map(d::teamName).collect(Collectors.joining(", "));
        audit.record("Qur’a", s.name + ", " + scopeLabel + ": " + (in.random() ? "tasodifiy qur’a tashlandi" : "qur’a natijasi kiritildi") + " — " + names, "SEASON", seasonId);
        sync(seasonId);
    }

    private void saveLot(SeasonData d, String scope, List<UUID> order, boolean automatic) {
        UUID seasonId = d.season().getId();
        TiebreakLot lot = lots.findBySeasonIdAndScope(seasonId, scope).orElseGet(TiebreakLot::new);
        lot.seasonId = seasonId;
        lot.scope = scope;
        lot.setOrder(order);
        lots.save(lot);
        if (automatic) {
            String names = order.stream().map(d::teamName).collect(Collectors.joining(", "));
            audit.record("Qur’a", "Pley-off reytingida jamoalar barcha ko‘rsatkichlar bo‘yicha teng edi — tizim qur’a tashladi: " + names, "SEASON", seasonId);
        }
    }

    private static List<UUID> shuffled(List<UUID> ids) {
        List<UUID> copy = new ArrayList<>(ids);
        Collections.shuffle(copy, RANDOM);
        return copy;
    }

    public void deleteLot(UUID seasonId, String scope) {
        loader.editableSeason(seasonId);
        lots.findBySeasonIdAndScope(seasonId, scope).ifPresent(l -> {
            lots.delete(l);
            audit.record("Qur’a", "Qur’a natijasi bekor qilindi", "SEASON", seasonId);
        });
        sync(seasonId);
    }

    // ---------- Yordamchilar ----------

    private List<Match> playoffMatches(SeasonData d) {
        return d.matches().stream().filter(m -> m.stage == MatchStage.PLAYOFF).toList();
    }

    private static String key(Match m) {
        return m.playoffRound + ":" + m.bracketIndex;
    }

    /**
     * Pley-off boshlangan: guruhdan joylashadigan jamoalar (saralash va birinchi bosqich) o'zgarmasligi shart.
     * O'zgarsa — chaqirgan amal (natija, ochko yoki nizom) tranzaksiyasi bilan birga bekor qilinadi.
     */
    private static void requireSameSeeding(SeasonData d, List<Match> playoff) {
        Map<UUID, List<StandingRow>> standings = d.standings();
        Bracket.Plan plan = d.playoffPlan(standings);
        boolean ready = d.groupStageComplete() && d.groupTies(standings).isEmpty() && plan.error() == null && plan.ties().isEmpty();
        if (!ready || !sameSeeds(playoff, plan, d.season().thirdPlaceMatch)) {
            throw ApiException.conflict("Pley-off allaqachon boshlangan — bu o‘zgarish pley-off juftliklarini o‘zgartirib yuboradi. Avval pley-off natijalarini bekor qiling.");
        }
    }

    /** Yangi hisoblangan setkada guruhdan joylashgan har bir jamoa mavjud setkadagi o'z joyida turibdimi */
    private static boolean sameSeeds(List<Match> playoff, Bracket.Plan plan, boolean thirdPlace) {
        Map<String, Match> existing = playoff.stream().collect(Collectors.toMap(PlayoffService::key, m -> m));
        for (Match m : Bracket.create(UUID.randomUUID(), plan, thirdPlace, null, (r, i) -> Instant.EPOCH)) {
            Match old = existing.get(key(m));
            if (old == null) return false;
            if (m.homeId != null && !m.homeId.equals(old.homeId)) return false;
            if (m.awayId != null && !m.awayId.equals(old.awayId)) return false;
        }
        return true;
    }

    /** Setkadagi jamoalar joylashuvi o'zgarmagan bo'lsa, qayta tuzish shart emas */
    private static boolean sameTeams(List<Match> playoff, Bracket.Plan plan, boolean thirdPlace) {
        Map<String, List<UUID>> existing = new HashMap<>();
        for (Match m : playoff) existing.put(key(m), Arrays.asList(m.homeId, m.awayId));
        List<Match> expected = Bracket.create(UUID.randomUUID(), plan, thirdPlace, null, (r, i) -> Instant.EPOCH);
        if (expected.size() != playoff.size()) return false;
        for (Match m : expected) {
            List<UUID> teams = existing.get(key(m));
            if (teams == null || !Objects.equals(teams.get(0), m.homeId) || !Objects.equals(teams.get(1), m.awayId)) return false;
        }
        return true;
    }

    private void remove(List<Match> playoff) {
        // Avval havolalarni uzamiz, keyin o'chiramiz
        playoff.forEach(m -> {
            m.nextMatchId = null;
            m.loserNextMatchId = null;
        });
        matches.flush();
        matches.deleteAll(playoff);
        matches.flush();
    }

    private void save(List<Match> created) {
        // Keyingi o'yinlarga havolalar bor — avval havola qilinadigan o'yinlar saqlanadi
        List<Match> ordered = new ArrayList<>(created);
        Collections.reverse(ordered);
        matches.saveAll(ordered);
    }

    /** Liga o'yinlari o'tadigan asosiy stadion: guruh o'yinlarida eng ko'p ishlatilgani */
    private UUID primaryVenue(SeasonData d) {
        Map<UUID, Long> usage = d.matches().stream().filter(m -> m.venueId != null).collect(Collectors.groupingBy(m -> m.venueId, Collectors.counting()));
        return usage.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey)
                .orElseGet(() -> venues.findAllByOrderByNameAsc().stream().findFirst().map(v -> v.getId()).orElse(null));
    }

    /**
     * Taxminiy sana-vaqtlar: har bosqich 7 kundan keyin; bir kunda 10:00, 12:30, 15:00, 17:30 (bitta stadion);
     * 3-o'rin o'yini final kuni 15:00 da, final 17:30 da.
     */
    private static BiFunction<PlayoffRound, Integer, Instant> defaultKickoffs(Bracket.Plan plan, LocalDate start) {
        List<PlayoffRound> order = new ArrayList<>(List.of(PlayoffRound.R64, PlayoffRound.R32, PlayoffRound.R16, PlayoffRound.QF, PlayoffRound.SF, PlayoffRound.F));
        PlayoffRound first = Bracket.firstRoundFor(plan.bracketSize());
        int firstIndex = order.indexOf(first) - (plan.playIns().isEmpty() ? 0 : 1);
        return (round, i) -> {
            if (round == PlayoffRound.THIRD) return start.plusDays(7L * (order.indexOf(PlayoffRound.F) - firstIndex)).atTime(LocalTime.of(15, 0)).atZone(Schedule.ZONE).toInstant();
            if (round == PlayoffRound.F) return start.plusDays(7L * (order.indexOf(PlayoffRound.F) - firstIndex)).atTime(LocalTime.of(17, 30)).atZone(Schedule.ZONE).toInstant();
            int step = order.indexOf(round) - firstIndex;
            return start.plusDays(7L * step + i / SLOTS.size()).atTime(SLOTS.get(i % SLOTS.size())).atZone(Schedule.ZONE).toInstant();
        };
    }
}
