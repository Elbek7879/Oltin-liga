package uz.payariq.liga.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.AwardType;
import uz.payariq.liga.domain.SeasonStatus;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.SeasonAward;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.model.Team;
import uz.payariq.liga.repo.RosterEntryRepository;
import uz.payariq.liga.repo.SeasonAwardRepository;
import uz.payariq.liga.repo.SeasonRepository;
import uz.payariq.liga.repo.SeasonTeamRepository;
import uz.payariq.liga.repo.TeamRepository;
import uz.payariq.liga.web.Dto.FinishPreview;
import uz.payariq.liga.web.Dto.SeasonDto;
import uz.payariq.liga.web.Requests;

/** Mavsumlar: yaratish, nizomni o'zgartirish, boshlash va yakunlash */
@Service
@Transactional
public class SeasonService {

    private static final List<AwardType> FINISH_AWARDS = List.of(AwardType.CHAMPION, AwardType.RUNNER_UP, AwardType.THIRD, AwardType.TOP_SCORER, AwardType.FAIR_PLAY);

    private final SeasonRepository seasons;
    private final SeasonTeamRepository seasonTeams;
    private final TeamRepository teams;
    private final RosterEntryRepository rosters;
    private final SeasonAwardRepository awards;
    private final SeasonDataLoader loader;
    private final AdminQueryService queries;
    private final AuditService audit;
    private final OutboxService outbox;
    private final PlayoffService playoffs;

    public SeasonService(SeasonRepository seasons, SeasonTeamRepository seasonTeams, TeamRepository teams, RosterEntryRepository rosters,
                         SeasonAwardRepository awards, SeasonDataLoader loader, AdminQueryService queries, AuditService audit, OutboxService outbox, PlayoffService playoffs) {
        this.seasons = seasons;
        this.seasonTeams = seasonTeams;
        this.teams = teams;
        this.rosters = rosters;
        this.awards = awards;
        this.loader = loader;
        this.queries = queries;
        this.audit = audit;
        this.outbox = outbox;
        this.playoffs = playoffs;
    }

    public SeasonDto create(Requests.SeasonCreate in) {
        if (in.endDate().isBefore(in.startDate())) throw ApiException.badRequest("Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak.");
        Season s = new Season();
        s.number = seasons.maxNumber() + 1;
        s.name = in.name().trim();
        s.year = in.year();
        s.startDate = in.startDate();
        s.endDate = in.endDate();
        s.status = SeasonStatus.DRAFT;
        if (in.rules() != null) applyRules(s, in.rules());
        seasons.save(s);
        if (in.copyTeamsFromSeasonId() != null) {
            for (SeasonTeam old : seasonTeams.findBySeasonId(in.copyTeamsFromSeasonId())) {
                Team team = teams.findById(old.teamId).orElseThrow();
                if (!team.active) continue;
                SeasonTeam st = new SeasonTeam();
                st.seasonId = s.getId();
                st.teamId = team.getId();
                st.name = team.name;
                st.shortName = team.shortName;
                st.captainId = old.captainId;
                st.coach = old.coach;
                seasonTeams.save(st);
                for (RosterEntry r : rosters.findBySeasonTeamId(old.getId())) {
                    RosterEntry copy = new RosterEntry();
                    copy.seasonId = s.getId();
                    copy.seasonTeamId = st.getId();
                    copy.playerId = r.playerId;
                    copy.shirtNumber = r.shirtNumber;
                    rosters.save(copy);
                }
            }
        }
        audit.record("Mavsum", "«" + s.name + "» (" + s.year + ") yaratildi", "SEASON", s.getId());
        return SeasonDto.of(s);
    }

    public SeasonDto updateRules(UUID seasonId, Requests.Rules rules) {
        Season s = loader.editableSeason(seasonId);
        applyRules(s, rules);
        audit.record("Sozlamalar", s.name + " nizomi yangilandi", "SEASON", s.getId());
        // Ochko, mezon yoki chiqadiganlar soni o'zgarsa — setka qayta tekshiriladi
        playoffs.sync(seasonId);
        return SeasonDto.of(s);
    }

    private static void applyRules(Season s, Requests.Rules r) {
        if (r.pointsWin() < r.pointsDraw() || r.pointsDraw() < r.pointsLoss()) {
            throw ApiException.badRequest("G‘alaba uchun ochko durangdan, durang esa mag‘lubiyatdan kam bo‘lmasin.");
        }
        if (r.tiebreakers().stream().distinct().count() != r.tiebreakers().size()) throw ApiException.badRequest("Teng ochko mezonlari takrorlanmasin.");
        s.pointsWin = r.pointsWin();
        s.pointsDraw = r.pointsDraw();
        s.pointsLoss = r.pointsLoss();
        s.setTiebreakerList(r.tiebreakers());
        s.legs = r.legs();
        s.qualifiersPerGroup = r.qualifiersPerGroup();
        if (r.qualifiersBySize() != null) {
            for (Map.Entry<Integer, Integer> e : r.qualifiersBySize().entrySet()) {
                int size = e.getKey();
                int q = e.getValue() == null ? 0 : e.getValue();
                if (size < 2 || size > 8) throw ApiException.badRequest("Guruh hajmi 2 dan 8 gacha bo‘lishi mumkin.");
                if (q < 1 || q >= size) throw ApiException.badRequest(size + " jamoali guruhdan 1 tadan " + (size - 1) + " tagacha jamoa chiqishi mumkin.");
            }
            s.setQualifiersBySizeMap(r.qualifiersBySize());
        }
        s.thirdPlaceMatch = r.thirdPlaceMatch();
        if (r.halfMinutes() != null) s.halfMinutes = r.halfMinutes();
    }

    public SeasonDto activate(UUID seasonId) {
        Season s = loader.season(seasonId);
        if (s.status != SeasonStatus.DRAFT) throw ApiException.conflict("Faqat tayyorlanayotgan mavsumni boshlash mumkin.");
        seasons.findFirstByStatus(SeasonStatus.ACTIVE).ifPresent(active -> {
            throw ApiException.conflict("Avval joriy «" + active.name + "»ni yakunlang.");
        });
        s.status = SeasonStatus.ACTIVE;
        audit.record("Mavsum", "«" + s.name + "» boshlandi", "SEASON", s.getId());
        return SeasonDto.of(s);
    }

    /** Mavsumni yakunlaydi: sovrindorlar tarixga yoziladi, mavsum arxivga qulflanadi */
    public SeasonDto finish(UUID seasonId) {
        Season s = loader.editableSeason(seasonId);
        FinishPreview preview = queries.finishPreview(seasonId);
        if (!preview.canFinish()) throw ApiException.conflict(String.join(" ", preview.problems()));
        awards.deleteAll(awards.findBySeasonId(seasonId).stream().filter(a -> FINISH_AWARDS.contains(a.type)).toList());
        awards.flush();
        saveAward(seasonId, AwardType.CHAMPION, preview.champion() == null ? null : preview.champion().id(), null, null);
        saveAward(seasonId, AwardType.RUNNER_UP, preview.runnerUp() == null ? null : preview.runnerUp().id(), null, null);
        saveAward(seasonId, AwardType.THIRD, preview.third() == null ? null : preview.third().id(), null, null);
        if (preview.topScorer() != null) {
            saveAward(seasonId, AwardType.TOP_SCORER, preview.topScorer().team().id(), preview.topScorer().player().id(), preview.topScorer().goals() + " ta gol");
        }
        saveAward(seasonId, AwardType.FAIR_PLAY, preview.fairPlay() == null ? null : preview.fairPlay().id(), null, null);
        s.status = SeasonStatus.FINISHED;
        String champion = preview.champion() == null ? "—" : preview.champion().name();
        audit.record("Mavsum", "«" + s.name + "» yakunlandi va arxivga o‘tkazildi. Chempion: " + champion, "SEASON", s.getId());
        outbox.publish(OutboxService.SEASON_FINISHED, Map.of("seasonId", s.getId().toString(), "season", s.name, "champion", champion));
        return SeasonDto.of(s);
    }

    private void saveAward(UUID seasonId, AwardType type, UUID seasonTeamId, UUID playerId, String note) {
        if (seasonTeamId == null && playerId == null) return;
        SeasonAward a = new SeasonAward();
        a.seasonId = seasonId;
        a.type = type;
        a.seasonTeamId = seasonTeamId;
        a.playerId = playerId;
        a.note = note;
        awards.save(a);
    }
}
