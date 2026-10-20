package uz.payariq.liga.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.PlayoffRound;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.RoundTeam;
import uz.payariq.liga.model.RoundTeamSlot;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.PlayerRepository;
import uz.payariq.liga.repo.RosterEntryRepository;
import uz.payariq.liga.repo.RoundTeamRepository;
import uz.payariq.liga.web.Dto.RoundTeamDto;
import uz.payariq.liga.web.Requests;

/**
 * Ramziy jamoa: tur (yoki pley-off bosqichi) tugagach, tashkilotchi 5 futbolchini tanlaydi.
 * Qoidalar: tur o'yinlari tugagan bo'lishi; o'rinlar — GK, DF, MF_L, MF_R, FW; bir futbolchi bir marta;
 * futbolchi shu mavsumda biror jamoa tarkibida; e'lon qilish uchun 5 o'rin ham to'lgan bo'lishi kerak.
 */
@Service
@Transactional
public class RoundTeamService {

    public static final List<String> SLOTS = List.of("GK", "DF", "MF_L", "MF_R", "FW");
    private static final Pattern MEDIA = Pattern.compile("^/media/[0-9a-f-]{36}\\.(png|jpg|webp)$");

    private final RoundTeamRepository roundTeams;
    private final MatchRepository matches;
    private final RosterEntryRepository rosters;
    private final PlayerRepository players;
    private final SeasonDataLoader loader;
    private final AuditService audit;
    private final Clock clock;

    public RoundTeamService(RoundTeamRepository roundTeams, MatchRepository matches, RosterEntryRepository rosters, PlayerRepository players,
                            SeasonDataLoader loader, AuditService audit, Clock clock) {
        this.roundTeams = roundTeams;
        this.matches = matches;
        this.rosters = rosters;
        this.players = players;
        this.loader = loader;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<RoundTeamDto> list(UUID seasonId) {
        loader.season(seasonId);
        return roundTeams.findBySeasonIdOrderByCreatedAtAsc(seasonId).stream().map(RoundTeamDto::of).toList();
    }

    /** Tur bo'yicha saqlaydi (yangi yoki mavjudini yangilaydi): qoralama yoki e'lon */
    public RoundTeamDto save(UUID seasonId, Requests.RoundTeamInput in) {
        loader.editableSeason(seasonId);
        Integer round = in.stage() == MatchStage.GROUP ? in.round() : null;
        PlayoffRound playoffRound = in.stage() == MatchStage.PLAYOFF ? in.playoffRound() : null;
        if (in.stage() == MatchStage.GROUP && (round == null || round < 1)) throw ApiException.badRequest("Turni tanlang.");
        if (in.stage() == MatchStage.PLAYOFF && playoffRound == null) throw ApiException.badRequest("Pley-off bosqichini tanlang.");
        String title = title(in.stage(), round, playoffRound);
        assertRoundFinished(seasonId, in.stage(), round, playoffRound, title);

        // O'rinlar: faqat beshta ma'lum o'rin, bir futbolchi bir marta, futbolchi shu mavsum tarkibida
        Map<UUID, UUID> teamOfPlayer = new HashMap<>();
        for (RosterEntry r : rosters.findBySeasonId(seasonId)) teamOfPlayer.put(r.playerId, r.seasonTeamId);
        Set<String> usedSlots = new HashSet<>();
        Set<UUID> usedPlayers = new HashSet<>();
        List<RoundTeamSlot> slots = new ArrayList<>();
        for (Requests.RoundTeamSlotInput s : in.slots()) {
            if (!SLOTS.contains(s.slot())) throw ApiException.badRequest("Noma’lum o‘rin: " + s.slot() + ".");
            if (!usedSlots.add(s.slot())) throw ApiException.badRequest("Bir o‘ringa ikki futbolchi qo‘yib bo‘lmaydi.");
            if (!usedPlayers.add(s.playerId())) throw ApiException.badRequest("Bir futbolchi ramziy jamoada faqat bir marta bo‘ladi.");
            UUID seasonTeamId = teamOfPlayer.get(s.playerId());
            if (seasonTeamId == null) throw ApiException.badRequest("Tanlangan futbolchi bu mavsumda biror jamoa tarkibida emas.");
            slots.add(new RoundTeamSlot(s.slot(), s.playerId(), seasonTeamId));
        }
        if (in.publish() && slots.size() != SLOTS.size()) {
            throw ApiException.badRequest("E’lon qilish uchun 5 ta o‘rinning hammasiga futbolchi qo‘ying (hozir " + slots.size() + " ta).");
        }
        slots.sort((a, b) -> Integer.compare(SLOTS.indexOf(a.slot), SLOTS.indexOf(b.slot)));

        RoundTeam t = roundTeams.findBySeasonIdOrderByCreatedAtAsc(seasonId).stream()
                .filter(x -> x.stage == in.stage() && java.util.Objects.equals(x.round, round) && x.playoffRound == playoffRound)
                .findFirst()
                .orElseGet(RoundTeam::new);
        boolean created = t.getId() == null;
        boolean wasPublished = t.published;
        t.seasonId = seasonId;
        t.stage = in.stage();
        t.round = round;
        t.playoffRound = playoffRound;
        t.slots.clear();
        t.slots.addAll(slots);
        t.published = in.publish();
        if (t.published && !wasPublished) t.publishedAt = Instant.now(clock);
        if (!t.published) t.publishedAt = null;
        roundTeams.save(t);
        audit.record("Ramziy jamoa", title + " ramziy jamoasi " + (t.published ? (wasPublished ? "yangilandi" : "e’lon qilindi") : created ? "qoralama sifatida saqlandi" : "qoralamasi yangilandi"),
                "ROUND_TEAM", t.getId());
        return RoundTeamDto.of(t);
    }

    public void delete(UUID id) {
        RoundTeam t = roundTeams.findById(id).orElseThrow(() -> ApiException.notFound("Ramziy jamoa topilmadi."));
        loader.editableSeason(t.seasonId);
        roundTeams.delete(t);
        audit.record("Ramziy jamoa", title(t.stage, t.round, t.playoffRound) + " ramziy jamoasi o‘chirildi", "ROUND_TEAM", id);
    }

    /** Futbolchi rasmi (ramziy jamoa va futbolchi sahifasida ko'rinadi); null yoki bo'sh — rasm olib tashlanadi */
    public void setPlayerPhoto(UUID playerId, String photoUrl) {
        Player p = players.findById(playerId).orElseThrow(() -> ApiException.notFound("Futbolchi topilmadi."));
        String url = photoUrl == null || photoUrl.isBlank() ? null : photoUrl.trim();
        if (url != null && !MEDIA.matcher(url).matches()) throw ApiException.badRequest("Rasm manzili noto‘g‘ri. Rasmni qaytadan yuklang.");
        p.photoUrl = url;
        players.save(p);
        audit.record("Futbolchi", p.fullName() + (url == null ? " rasmi olib tashlandi" : " rasmi yangilandi"), "PLAYER", playerId);
    }

    /** Tur (bosqich) o'yinlari bor va hammasi tugagan (bekor qilinganlar hisobga olinmaydi) */
    private void assertRoundFinished(UUID seasonId, MatchStage stage, Integer round, PlayoffRound playoffRound, String title) {
        List<Match> list = matches.findBySeasonIdAndStage(seasonId, stage).stream()
                .filter(m -> stage == MatchStage.GROUP ? java.util.Objects.equals(m.round, round) : m.playoffRound == playoffRound)
                .filter(m -> m.status != MatchStatus.CANCELLED)
                .toList();
        if (list.isEmpty()) throw ApiException.badRequest(title + " o‘yinlari topilmadi.");
        if (list.stream().anyMatch(m -> m.status != MatchStatus.FINISHED)) {
            throw ApiException.conflict(title + " hali tugamagan — ramziy jamoa barcha o‘yinlar yakunlangach tanlanadi.");
        }
    }

    static String title(MatchStage stage, Integer round, PlayoffRound playoffRound) {
        return stage == MatchStage.GROUP ? round + "-tur" : playoffRound.label();
    }
}
