package uz.payariq.liga.service;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.config.BootstrapRunner;
import uz.payariq.liga.domain.Bracket;
import uz.payariq.liga.domain.GroupDraw;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.PlayoffRound;
import uz.payariq.liga.domain.Schedule;
import uz.payariq.liga.domain.StandingsCalculator.StandingRow;
import uz.payariq.liga.model.LeagueGroup;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.repo.LeagueGroupRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.SeasonTeamRepository;
import uz.payariq.liga.repo.VenueRepository;
import uz.payariq.liga.web.Dto.Created;
import uz.payariq.liga.web.Dto.MatchDto;
import uz.payariq.liga.web.Requests;

/** Qur'a, o'yinlar taqvimi va pley-off sxemasi */
@Service
@Transactional
public class CompetitionService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d.MM.yyyy");

    private final LeagueGroupRepository groups;
    private final MatchRepository matches;
    private final SeasonTeamRepository seasonTeams;
    private final VenueRepository venues;
    private final SeasonDataLoader loader;
    private final AuditService audit;
    private final OutboxService outbox;
    private final PlayoffService playoffs;

    public CompetitionService(LeagueGroupRepository groups, MatchRepository matches, SeasonTeamRepository seasonTeams, VenueRepository venues,
                              SeasonDataLoader loader, AuditService audit, OutboxService outbox, PlayoffService playoffs) {
        this.groups = groups;
        this.matches = matches;
        this.seasonTeams = seasonTeams;
        this.venues = venues;
        this.loader = loader;
        this.audit = audit;
        this.outbox = outbox;
        this.playoffs = playoffs;
    }

    // ---------- Qur'a ----------

    /** Qur'a natijasini tasdiqlaydi. Guruh o'yinlari boshlangan bo'lsa, o'zgartirishga ruxsat berilmaydi. */
    public void saveGroups(UUID seasonId, Requests.SaveGroups in) {
        Season s = loader.editableSeason(seasonId);
        List<UUID> teamIds = seasonTeams.findBySeasonId(seasonId).stream().map(SeasonTeam::getId).toList();
        List<GroupDraw.DrawGroup> draw = in.groups().stream().map(g -> new GroupDraw.DrawGroup(g.name().trim(), g.teamIds())).toList();
        GroupDraw.DrawCheck check = GroupDraw.check(draw, teamIds);
        if (!check.ok()) throw ApiException.badRequest(String.join(" ", check.errors()));
        List<Match> groupMatches = matches.findBySeasonIdAndStage(seasonId, MatchStage.GROUP);
        if (groupMatches.stream().anyMatch(Match::hasResult)) {
            throw ApiException.conflict("Guruh bosqichi o‘yinlari boshlangan. Qur’a natijasini endi o‘zgartirib bo‘lmaydi.");
        }
        int removed = groupMatches.size();
        matches.deleteAll(groupMatches);
        groups.deleteAll(groups.findBySeasonIdOrderBySortOrderAsc(seasonId));
        groups.flush();
        List<LeagueGroup> saved = new ArrayList<>();
        for (int i = 0; i < draw.size(); i++) {
            LeagueGroup g = new LeagueGroup();
            g.seasonId = seasonId;
            g.name = draw.get(i).name();
            g.sortOrder = i;
            g.seasonTeamIds = new ArrayList<>(draw.get(i).teamIds());
            saved.add(groups.save(g));
        }
        // Qur'adan keyin juftliklar o'zi tuziladi; sana va vaqtni har bir o'yinga tashkilotchi belgilaydi
        int fixtures = createFixtures(s, saved);
        audit.record("Qur’a", s.name + ": " + draw.size() + " ta guruh tasdiqlandi, " + fixtures + " ta juftlik tuzildi"
                + (removed > 0 ? ", " + removed + " ta eski o‘yin o‘chirildi" : ""), "SEASON", seasonId);
        playoffs.sync(seasonId);
    }

    // ---------- O'yinlar ----------

    public MatchDto createMatch(UUID seasonId, Requests.MatchInput in) {
        loader.editableSeason(seasonId);
        assertInput(seasonId, in);
        Match m = new Match();
        m.seasonId = seasonId;
        m.stage = in.stage();
        m.groupId = in.stage() == MatchStage.GROUP ? in.groupId() : null;
        m.round = in.round();
        m.playoffRound = in.stage() == MatchStage.PLAYOFF ? in.playoffRound() : null;
        m.homeId = in.homeId();
        m.awayId = in.awayId();
        m.kickoff = in.kickoff().toInstant();
        m.venueId = in.venueId();
        m.status = in.status();
        m.referee = blankToNull(in.referee());
        m.note = blankToNull(in.note());
        matches.save(m);
        String title = name(m.homeId) + " — " + name(m.awayId);
        audit.record("O‘yin", title + " o‘yini " + DATE.format(m.kickoff.atZone(Schedule.ZONE)) + " kuniga belgilandi", "MATCH", m.getId());
        outbox.publish(OutboxService.MATCH_SCHEDULED, Map.of("matchId", m.getId().toString(), "title", title, "kickoff", m.kickoff.toString()));
        if (m.stage == MatchStage.GROUP) playoffs.sync(seasonId);
        return MatchDto.of(m);
    }

    public MatchDto updateMatch(UUID matchId, Requests.MatchInput in) {
        Match m = match(matchId);
        loader.editableSeason(m.seasonId);
        boolean hasResult = m.hasResult();
        if (hasResult && (!Objects.equals(in.homeId(), m.homeId) || !Objects.equals(in.awayId(), m.awayId))) {
            throw ApiException.conflict("Natijasi bor o‘yinning jamoalarini o‘zgartirib bo‘lmaydi.");
        }
        if (m.stage == MatchStage.PLAYOFF && (!Objects.equals(in.homeId(), m.homeId) || !Objects.equals(in.awayId(), m.awayId))) {
            throw ApiException.conflict("Pley-off jamoalari sxema bo‘yicha avtomatik belgilanadi.");
        }
        if (!hasResult) assertInput(m.seasonId, new Requests.MatchInput(m.stage, in.groupId(), in.round(), m.playoffRound, in.homeId(), in.awayId(),
                in.kickoff(), in.venueId(), in.status(), in.referee(), in.note()));
        Instant newKickoff = in.kickoff().toInstant();
        boolean moved = !newKickoff.equals(m.kickoff);
        if (m.stage == MatchStage.GROUP && in.groupId() != null) m.groupId = in.groupId();
        if (in.round() != null) m.round = in.round();
        m.homeId = in.homeId();
        m.awayId = in.awayId();
        m.kickoff = newKickoff;
        m.venueId = in.venueId();
        if (!hasResult) m.status = in.status();
        m.referee = blankToNull(in.referee());
        m.note = blankToNull(in.note());
        // Tashkilotchi o'yinni ko'rib chiqdi — sana-vaqt endi saytda ko'rsatiladi
        m.timeConfirmed = true;
        audit.record("O‘yin", name(m.homeId) + " — " + name(m.awayId) + " o‘yini tahrirlandi"
                + (moved ? " (yangi sana: " + DATE.format(m.kickoff.atZone(Schedule.ZONE)) + ")" : ""), "MATCH", m.getId());
        if (m.stage == MatchStage.GROUP) playoffs.sync(m.seasonId);
        return MatchDto.of(m);
    }

    public void deleteMatch(UUID matchId) {
        Match m = match(matchId);
        loader.editableSeason(m.seasonId);
        if (m.hasResult()) throw ApiException.conflict("Natijasi kiritilgan o‘yinni o‘chirib bo‘lmaydi. Kerak bo‘lsa, uni «Bekor qilingan» deb belgilang.");
        if (m.stage == MatchStage.PLAYOFF) throw ApiException.conflict("Pley-off o‘yinlari sxema orqali boshqariladi. «Pley-off» bo‘limidan foydalaning.");
        matches.delete(m);
        audit.record("O‘yin", name(m.homeId) + " — " + name(m.awayId) + " o‘yini o‘chirildi", "MATCH", matchId);
        playoffs.sync(m.seasonId);
    }

    private void assertInput(UUID seasonId, Requests.MatchInput in) {
        if (in.status() == MatchStatus.FINISHED || in.status() == MatchStatus.LIVE) {
            throw ApiException.badRequest("Hisob va «Davom etmoqda / Yakunlangan» holati «Natijalar» bo‘limida kiritiladi.");
        }
        if (in.homeId() != null && in.homeId().equals(in.awayId())) throw ApiException.badRequest("Jamoa o‘zi bilan o‘ynay olmaydi. Ikkinchi jamoani o‘zgartiring.");
        Set<UUID> ids = seasonTeams.findBySeasonId(seasonId).stream().map(SeasonTeam::getId).collect(Collectors.toSet());
        for (UUID t : new UUID[] {in.homeId(), in.awayId()}) {
            if (t != null && !ids.contains(t)) throw ApiException.badRequest("Tanlangan jamoa bu mavsumda ishtirok etmaydi.");
        }
        if (in.venueId() != null && !venues.existsById(in.venueId())) throw ApiException.badRequest("Maydon topilmadi.");
        if (in.stage() == MatchStage.GROUP) {
            if (in.homeId() == null || in.awayId() == null) throw ApiException.badRequest("Guruh o‘yini uchun ikkala jamoani tanlang.");
            LeagueGroup g = in.groupId() == null ? null : groups.findById(in.groupId()).filter(x -> x.seasonId.equals(seasonId)).orElse(null);
            if (g == null) throw ApiException.badRequest("Guruhni tanlang.");
            if (!g.seasonTeamIds.contains(in.homeId()) || !g.seasonTeamIds.contains(in.awayId())) {
                throw ApiException.badRequest("Ikkala jamoa ham " + g.name + " guruhida bo‘lishi kerak.");
            }
        }
    }

    /**
     * O'yinlari yo'q guruhlar uchun juftliklarni (davra tizimi) tuzadi. Odatda qur'a saqlanganda o'zi bajariladi;
     * bu amal o'yinlari o'chirib yuborilgan guruhlar uchun.
     */
    public Created generateFixtures(UUID seasonId) {
        Season s = loader.editableSeason(seasonId);
        List<LeagueGroup> empty = groups.findBySeasonIdOrderBySortOrderAsc(seasonId).stream().filter(g -> !matches.existsByGroupId(g.getId())).toList();
        if (empty.isEmpty()) throw ApiException.conflict("Barcha guruhlarning juftliklari allaqachon tuzilgan.");
        int created = createFixtures(s, empty);
        audit.record("Taqvim", created + " ta guruh juftligi tuzildi (sanalari belgilanmagan)", "SEASON", seasonId);
        playoffs.sync(seasonId);
        return new Created(created);
    }

    /** Davra tizimi juftliklari: sanasi belgilanmagan holda, asosiy stadionda */
    private int createFixtures(Season s, List<LeagueGroup> list) {
        UUID venue = mainVenue();
        int count = 0;
        for (LeagueGroup g : list) {
            for (Schedule.Pairing p : Schedule.roundRobin(g.seasonTeamIds, s.legs)) {
                Match m = new Match();
                m.seasonId = s.getId();
                m.stage = MatchStage.GROUP;
                m.groupId = g.getId();
                m.round = p.round();
                m.homeId = p.homeId();
                m.awayId = p.awayId();
                m.kickoff = Schedule.placeholderKickoff(s.startDate, p.round());
                m.timeConfirmed = false;
                m.venueId = venue;
                m.status = MatchStatus.SCHEDULED;
                matches.save(m);
                count++;
            }
        }
        return count;
    }

    /** Liganing asosiy stadioni (Mirzacho‘l Birlik Arena), bo'lmasa birinchi maydon */
    private UUID mainVenue() {
        var all = venues.findAllByOrderByNameAsc();
        return all.stream().filter(v -> BootstrapRunner.MAIN_VENUE.equals(v.name)).findFirst()
                .or(() -> all.stream().findFirst()).map(v -> v.getId()).orElse(null);
    }

    private Match match(UUID id) {
        return matches.findById(id).orElseThrow(() -> ApiException.notFound("O‘yin topilmadi."));
    }

    private String name(UUID seasonTeamId) {
        if (seasonTeamId == null) return "Aniqlanmagan";
        return seasonTeams.findById(seasonTeamId).map(st -> st.name).orElse("Noma’lum jamoa");
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
