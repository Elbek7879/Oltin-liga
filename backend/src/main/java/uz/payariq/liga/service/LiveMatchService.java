package uz.payariq.liga.service;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.EventType;
import uz.payariq.liga.domain.LiveClock;
import uz.payariq.liga.domain.LivePeriod;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.ResultValidator.ResultEvent;
import uz.payariq.liga.domain.ResultValidator.ResultInput;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.repo.MatchEventRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.SeasonRepository;

/**
 * Jonli o'yinni qadam-baqadam boshqarish (Telegram bot shu servisdan foydalanadi):
 * boshlash, gol, kartochka, oxirgi hodisani bekor qilish, bo'limlar va yakunlash.
 * Har bir amal saytdagi kabi {@link ResultService} orqali saqlanadi — tekshiruvlar, jadval va setka bir xil ishlaydi.
 */
@Service
@Transactional
public class LiveMatchService {

    private final MatchRepository matches;
    private final MatchEventRepository events;
    private final SeasonRepository seasons;
    private final ResultService results;
    private final SeasonDataLoader loader;
    private final AuditService audit;
    private final Clock clock;
    private final ApplicationEventPublisher publisher;

    /**
     * Botda kiritilgan hodisalar tartibi (o'yin bo'yicha): «bekor qilish» eng oxirgi kiritilganini o'chiradi,
     * daqiqasi eng kattasini emas — qo'shimcha vaqtda daqiqa qayta 41' dan boshlanadi.
     */
    private record Added(EventType type, UUID seasonTeamId, UUID playerId, int minute, boolean extraTime) {
        boolean sameAs(MatchEvent e) {
            return e.type == type && Objects.equals(e.seasonTeamId, seasonTeamId) && Objects.equals(e.playerId, playerId)
                    && e.minute != null && e.minute == minute;
        }
    }

    private static final int MAX_REMEMBERED = 100;
    private final Map<UUID, Deque<Added>> added = new ConcurrentHashMap<>();

    public LiveMatchService(MatchRepository matches, MatchEventRepository events, SeasonRepository seasons, ResultService results,
                            SeasonDataLoader loader, AuditService audit, Clock clock, ApplicationEventPublisher publisher) {
        this.matches = matches;
        this.events = events;
        this.seasons = seasons;
        this.results = results;
        this.loader = loader;
        this.audit = audit;
        this.clock = clock;
        this.publisher = publisher;
    }

    public Match match(UUID matchId) {
        return matches.findById(matchId).orElseThrow(() -> ApiException.notFound("O‘yin topilmadi."));
    }

    /** O'yin hodisalari vaqt tartibida (daqiqasi yo'qlari boshida) */
    @Transactional(readOnly = true)
    public List<MatchEvent> timeline(UUID matchId) {
        return events.findByMatchId(matchId).stream()
                .sorted(Comparator.comparing((MatchEvent e) -> e.minute == null ? 0 : e.minute).thenComparing(MatchEvent::getCreatedAt))
                .toList();
    }

    /** Hozirgi daqiqa: bo'lim boshlangan vaqtdan; soat yuritilmagan (saytda kiritilgan) o'yinda — saqlangan daqiqa */
    @Transactional(readOnly = true)
    public int currentMinute(Match m) {
        if (m.livePeriod == null) return m.liveMinute == null ? 1 : m.liveMinute;
        return LiveClock.minute(m.livePeriod, m.periodStartedAt, halfMinutes(m), clock.instant());
    }

    public int halfMinutes(Match m) {
        return seasons.findById(m.seasonId).map((Season s) -> s.halfMinutes).orElse(20);
    }

    // ---------- Boshlash va bo'limlar ----------

    /** Boshlanish vaqtidan shuncha o'tgach o'yin jonli boshlanmaydi (kechikkan o'yinlar uchun zaxira bilan) */
    public static final Duration LATE_START_LIMIT = Duration.ofHours(2);

    /**
     * O'yin vaqti o'tib ketgan: jonli boshlansa, sayt uni muxlislarga «Jonli» deb ko'rsatadi va gollarga hozirgi
     * daqiqa yoziladi. Bunday o'yin natijasi saytda kiritiladi (daqiqalar ixtiyoriy).
     */
    public boolean isPast(Match m) {
        return m.kickoff != null && clock.instant().isAfter(m.kickoff.plus(LATE_START_LIMIT));
    }

    public Match start(UUID matchId) {
        Match m = match(matchId);
        if (m.status != MatchStatus.SCHEDULED) throw ApiException.conflict("O‘yin allaqachon boshlangan yoki yakunlangan.");
        if (isPast(m)) {
            throw ApiException.conflict("Bu o‘yin vaqti o‘tib ketgan — uni jonli boshlab bo‘lmaydi. Natijani saytdagi «Natijalar» bo‘limida kiriting "
                    + "(gollar futbolchilar nomiga yoziladi, daqiqalar ixtiyoriy). O‘yin kechiktirilgan bo‘lsa, saytda uning vaqtini o‘zgartiring.");
        }
        if (m.homeId == null || m.awayId == null) throw ApiException.badRequest("O‘yin jamoalari hali aniqlanmagan.");
        save(m, MatchStatus.LIVE, 0, 0, null, null, null, null, 1, List.of());
        m.livePeriod = LivePeriod.FIRST_HALF;
        m.periodStartedAt = clock.instant();
        changed(m);
        return m;
    }

    public Match halfTime(UUID matchId) {
        Match m = requireLive(matchId);
        if (m.livePeriod != null && m.livePeriod != LivePeriod.FIRST_HALF) throw ApiException.conflict("Tanaffus faqat 1-bo‘limdan keyin bo‘ladi.");
        m.liveMinute = halfMinutes(m);
        m.livePeriod = LivePeriod.HALF_TIME;
        m.periodStartedAt = clock.instant();
        audit.record("Natija", title(m) + " — tanaffus", "MATCH", m.getId());
        changed(m);
        return m;
    }

    public Match secondHalf(UUID matchId) {
        Match m = requireLive(matchId);
        if (m.livePeriod != LivePeriod.HALF_TIME) throw ApiException.conflict("2-bo‘lim tanaffusdan keyin boshlanadi.");
        m.livePeriod = LivePeriod.SECOND_HALF;
        m.periodStartedAt = clock.instant();
        m.liveMinute = halfMinutes(m) + 1;
        audit.record("Natija", title(m) + " — 2-bo‘lim boshlandi", "MATCH", m.getId());
        changed(m);
        return m;
    }

    /** Pley-offda asosiy vaqt durang tugasa — qo'shimcha vaqt */
    public Match extraTime(UUID matchId) {
        Match m = requireLive(matchId);
        if (m.stage != MatchStage.PLAYOFF) throw ApiException.badRequest("Qo‘shimcha vaqt faqat pley-offda bo‘ladi.");
        if (!Objects.equals(m.homeScore, m.awayScore)) throw ApiException.conflict("Asosiy vaqtda g‘olib aniqlangan — qo‘shimcha vaqt kerak emas.");
        if (m.livePeriod == LivePeriod.EXTRA_TIME || m.livePeriod == LivePeriod.PENALTIES) throw ApiException.conflict("Qo‘shimcha vaqt allaqachon boshlangan.");
        save(m, MatchStatus.LIVE, m.homeScore, m.awayScore, 0, 0, null, null, currentMinute(m), current(m));
        m.livePeriod = LivePeriod.EXTRA_TIME;
        m.periodStartedAt = clock.instant();
        m.liveMinute = currentMinute(m);
        changed(m);
        return m;
    }

    /** Qo'shimcha vaqtdan keyin ham durang — penaltilar seriyasi */
    public Match penalties(UUID matchId) {
        Match m = requireLive(matchId);
        if (m.livePeriod != LivePeriod.EXTRA_TIME) throw ApiException.conflict("Penaltilar qo‘shimcha vaqtdan keyin boshlanadi.");
        if (m.homeTotal() != m.awayTotal()) throw ApiException.conflict("Qo‘shimcha vaqtda g‘olib aniqlangan — penaltilar kerak emas.");
        save(m, MatchStatus.LIVE, m.homeScore, m.awayScore, m.homeExtra, m.awayExtra, 0, 0, currentMinute(m), current(m));
        m.livePeriod = LivePeriod.PENALTIES;
        m.periodStartedAt = clock.instant();
        changed(m);
        return m;
    }

    /** Penaltilar hisobini bittaga o'zgartiradi */
    public Match adjustPenalties(UUID matchId, boolean home, int delta) {
        Match m = requireLive(matchId);
        if (m.livePeriod != LivePeriod.PENALTIES) throw ApiException.conflict("Avval penaltilar seriyasini boshlang.");
        int hp = (m.homePens == null ? 0 : m.homePens) + (home ? delta : 0);
        int ap = (m.awayPens == null ? 0 : m.awayPens) + (home ? 0 : delta);
        if (hp < 0 || ap < 0) throw ApiException.badRequest("Penaltilar hisobi manfiy bo‘lmaydi.");
        save(m, MatchStatus.LIVE, m.homeScore, m.awayScore, m.homeExtra, m.awayExtra, hp, ap, m.liveMinute, current(m));
        return m;
    }

    // ---------- Gol va kartochka ----------

    /**
     * Gol: home — gol kimning hisobiga yoziladi. Avtogolda futbolchi raqib jamoadan bo'ladi.
     * Muallif noma'lum bo'lsa playerId = null.
     */
    public Match addGoal(UUID matchId, boolean home, EventType kind, UUID playerId) {
        if (kind != EventType.GOAL && kind != EventType.PENALTY_GOAL && kind != EventType.OWN_GOAL) throw ApiException.badRequest("Gol turini tanlang.");
        Match m = requireLive(matchId);
        if (m.livePeriod == LivePeriod.HALF_TIME || m.livePeriod == LivePeriod.PENALTIES) {
            throw ApiException.conflict(m.livePeriod == LivePeriod.HALF_TIME ? "Tanaffusda gol bo‘lmaydi. Avval 2-bo‘limni boshlang." : "Penaltilar seriyasida hisob alohida yuritiladi.");
        }
        UUID beneficiary = home ? m.homeId : m.awayId;
        UUID eventTeam = kind == EventType.OWN_GOAL ? (home ? m.awayId : m.homeId) : beneficiary;
        int minute = currentMinute(m);
        List<ResultEvent> list = new ArrayList<>(current(m));
        list.add(new ResultEvent(kind, eventTeam, playerId, null, minute));
        boolean extra = m.livePeriod == LivePeriod.EXTRA_TIME;
        int hs = n(m.homeScore) + (!extra && home ? 1 : 0);
        int as = n(m.awayScore) + (!extra && !home ? 1 : 0);
        // Qo'shimcha vaqt boshlanmagan bo'lsa bu maydonlar bo'sh qoladi (null)
        Integer he = extra ? Integer.valueOf(n(m.homeExtra) + (home ? 1 : 0)) : m.homeExtra;
        Integer ae = extra ? Integer.valueOf(n(m.awayExtra) + (home ? 0 : 1)) : m.awayExtra;
        save(m, MatchStatus.LIVE, hs, as, he, ae, m.homePens, m.awayPens, minute, list);
        remember(matchId, new Added(kind, eventTeam, playerId, minute, extra));
        return m;
    }

    /** Kartochka. Futbolchi bu o'yinda sariq olgan bo'lsa, ikkinchi sariq avtomatik «ikkinchi sariq» bo'ladi */
    public EventType addCard(UUID matchId, boolean red, UUID playerId) {
        Match m = requireLive(matchId);
        SeasonData d = loader.load(m.seasonId);
        UUID team = d.rosterOf(m.homeId).contains(playerId) ? m.homeId : d.rosterOf(m.awayId).contains(playerId) ? m.awayId : null;
        if (team == null) throw ApiException.badRequest("Futbolchi bu o‘yindagi jamoalar tarkibida yo‘q.");
        List<ResultEvent> list = new ArrayList<>(current(m));
        boolean sentOff = list.stream().anyMatch(e -> playerId.equals(e.playerId()) && (e.type() == EventType.RED || e.type() == EventType.SECOND_YELLOW));
        if (sentOff) throw ApiException.conflict("Bu futbolchi allaqachon maydondan chetlatilgan.");
        boolean hasYellow = list.stream().anyMatch(e -> playerId.equals(e.playerId()) && e.type() == EventType.YELLOW);
        EventType type = red ? EventType.RED : hasYellow ? EventType.SECOND_YELLOW : EventType.YELLOW;
        int minute = currentMinute(m);
        list.add(new ResultEvent(type, team, playerId, null, minute));
        save(m, MatchStatus.LIVE, m.homeScore, m.awayScore, m.homeExtra, m.awayExtra, m.homePens, m.awayPens, minute, list);
        remember(matchId, new Added(type, team, playerId, minute, m.livePeriod == LivePeriod.EXTRA_TIME));
        return type;
    }

    /** «Bekor qilish» tugmasi bosilsa o'chadigan hodisa (tasdiqlash oynasida ko'rsatiladi) */
    @Transactional(readOnly = true)
    public Optional<MatchEvent> undoCandidate(UUID matchId) {
        List<MatchEvent> line = timeline(matchId);
        return line.isEmpty() ? Optional.empty() : Optional.of(undoTarget(matchId, line).event());
    }

    /** Oxirgi kiritilgan hodisani bekor qiladi; gol bo'lsa hisob ham kamayadi */
    public MatchEvent undoLast(UUID matchId) {
        Match m = requireLive(matchId);
        List<MatchEvent> line = timeline(matchId);
        if (line.isEmpty()) throw ApiException.conflict("Bekor qiladigan hodisa yo‘q.");
        UndoTarget target = undoTarget(matchId, line);
        MatchEvent last = target.event();
        List<ResultEvent> list = new ArrayList<>(line.stream().filter(e -> e != last).map(LiveMatchService::toInput).toList());
        int hs = n(m.homeScore);
        int as = n(m.awayScore);
        Integer he = m.homeExtra;
        Integer ae = m.awayExtra;
        boolean goal = last.type.isScoredGoal() || last.type == EventType.OWN_GOAL;
        if (goal) {
            boolean forHome = last.type == EventType.OWN_GOAL ? m.awayId.equals(last.seasonTeamId) : m.homeId.equals(last.seasonTeamId);
            // Gol qo'shimcha vaqtda kiritilgan bo'lsa — qo'shimcha vaqt hisobidan. Botda kiritilgani aniq ma'lum,
            // saytda kiritilganida esa daqiqaga qarab taxmin qilinadi
            boolean extraGoal = he != null && (forHome ? n(he) : n(ae)) > 0 && (target.added() != null
                    ? target.added().extraTime()
                    : last.minute != null && last.minute > 2 * halfMinutes(m));
            if (extraGoal) {
                if (forHome) he = n(he) - 1;
                else ae = n(ae) - 1;
            } else if (forHome) {
                hs = Math.max(0, hs - 1);
            } else {
                as = Math.max(0, as - 1);
            }
        }
        save(m, MatchStatus.LIVE, hs, as, he, ae, m.homePens, m.awayPens, currentMinute(m), list);
        if (target.added() != null) forget(matchId, target.added());
        return last;
    }

    // ---------- Yakunlash ----------

    public Match finish(UUID matchId) {
        Match m = requireLive(matchId);
        save(m, MatchStatus.FINISHED, n(m.homeScore), n(m.awayScore), m.homeExtra, m.awayExtra, m.homePens, m.awayPens, null, current(m));
        m.livePeriod = null;
        m.periodStartedAt = null;
        added.remove(matchId);
        changed(m);
        return m;
    }

    // ---------- Bekor qilish uchun hodisalar tartibi ----------

    private record UndoTarget(MatchEvent event, Added added) {
    }

    /** Bekor qilinadigan hodisa: botda eng oxirgi kiritilgani (hali o'chirilmagan bo'lsa), aks holda daqiqasi eng kattasi */
    private UndoTarget undoTarget(UUID matchId, List<MatchEvent> line) {
        Deque<Added> stack = added.get(matchId);
        if (stack != null) {
            synchronized (stack) {
                for (Added a : stack) {
                    for (int i = line.size() - 1; i >= 0; i--) {
                        if (a.sameAs(line.get(i))) return new UndoTarget(line.get(i), a);
                    }
                }
            }
        }
        return new UndoTarget(line.get(line.size() - 1), null);
    }

    private void remember(UUID matchId, Added a) {
        Deque<Added> stack = added.computeIfAbsent(matchId, k -> new ArrayDeque<>());
        synchronized (stack) {
            stack.addFirst(a);
            while (stack.size() > MAX_REMEMBERED) stack.removeLast();
        }
    }

    private void forget(UUID matchId, Added a) {
        Deque<Added> stack = added.get(matchId);
        if (stack == null) return;
        synchronized (stack) {
            stack.removeFirstOccurrence(a);
        }
    }

    // ---------- Yordamchilar ----------

    private Match requireLive(UUID matchId) {
        Match m = match(matchId);
        if (m.status != MatchStatus.LIVE) throw ApiException.conflict(m.status == MatchStatus.FINISHED ? "O‘yin allaqachon yakunlangan." : "Avval o‘yinni boshlang.");
        return m;
    }

    private List<ResultEvent> current(Match m) {
        return timeline(m.getId()).stream().map(LiveMatchService::toInput).toList();
    }

    private static ResultEvent toInput(MatchEvent e) {
        return new ResultEvent(e.type, e.seasonTeamId, e.playerId, e.assistId, e.minute);
    }

    private void save(Match m, MatchStatus status, Integer hs, Integer as, Integer he, Integer ae, Integer hp, Integer ap, Integer minute, List<ResultEvent> list) {
        results.save(m.getId(), new ResultInput(status, hs, as, he, ae, hp, ap, null, minute, list, null, null));
    }

    /** Bo'lim o'zgardi — saytdagi daqiqa va holat yangilanadi */
    private void changed(Match m) {
        publisher.publishEvent(new LiveUpdates.LiveEvent(m.seasonId, m.getId(), "UPDATE", null));
    }

    private String title(Match m) {
        SeasonData d = loader.load(m.seasonId);
        return d.teamName(m.homeId) + " — " + d.teamName(m.awayId);
    }

    private static int n(Integer v) {
        return v == null ? 0 : v;
    }
}
