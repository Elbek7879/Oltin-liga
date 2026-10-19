package uz.payariq.liga.service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.Bracket;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.ResultValidator;
import uz.payariq.liga.domain.ResultValidator.ResultInput;
import uz.payariq.liga.domain.ResultValidator.ValidationResult;
import uz.payariq.liga.model.Appearance;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.repo.AppearanceRepository;
import uz.payariq.liga.repo.MatchEventRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.web.Dto.MatchDto;

/**
 * Natijani saqlash. Hisob, hodisalar va pley-off bog'lanishlari bitta tranzaksiyada yoziladi.
 * Hodisalar har safar to'liq almashtiriladi — tahrirlangan natija ikki marta hisoblanmaydi,
 * turnir jadvali va statistika esa o'qishda shu ma'lumotlardan qayta hisoblanadi.
 */
@Service
@Transactional
public class ResultService {

    private final MatchRepository matches;
    private final MatchEventRepository events;
    private final AppearanceRepository appearances;
    private final SeasonDataLoader loader;
    private final AuditService audit;
    private final OutboxService outbox;
    private final PlayoffService playoffs;
    private final ApplicationEventPublisher publisher;

    public ResultService(MatchRepository matches, MatchEventRepository events, AppearanceRepository appearances, SeasonDataLoader loader,
                         AuditService audit, OutboxService outbox, PlayoffService playoffs, ApplicationEventPublisher publisher) {
        this.matches = matches;
        this.events = events;
        this.appearances = appearances;
        this.loader = loader;
        this.audit = audit;
        this.outbox = outbox;
        this.playoffs = playoffs;
        this.publisher = publisher;
    }

    public MatchDto save(UUID matchId, ResultInput input) {
        Match m = matches.findById(matchId).orElseThrow(() -> ApiException.notFound("O‘yin topilmadi."));
        loader.editableSeason(m.seasonId);
        boolean playing = input.status() == MatchStatus.LIVE || input.status() == MatchStatus.FINISHED;
        if (playing && !m.timeConfirmed) {
            throw ApiException.badRequest("Avval o‘yin sanasi va vaqtini belgilang («O‘yinlar» bo‘limi), so‘ng natijani kiriting.");
        }
        SeasonData d = loader.load(m.seasonId);

        ValidationResult check = ResultValidator.validate(m, input, d::rosterOf, d::teamName);
        if (!check.ok()) throw ApiException.badRequest(check.errors().get(0));
        ResultValidator.Outcome outcome = ResultValidator.deriveOutcome(m, input);

        if (m.stage == MatchStage.PLAYOFF) {
            boolean winnerChanges = !Objects.equals(outcome.winnerId(), m.winnerId);
            boolean nextPlayed = Stream.of(m.nextMatchId, m.loserNextMatchId)
                    .filter(Objects::nonNull)
                    .map(id -> matches.findById(id).orElse(null))
                    .anyMatch(next -> next != null && next.hasResult());
            if (winnerChanges && nextPlayed) {
                throw ApiException.conflict("Keyingi bosqich o‘yini allaqachon o‘tkazilgan. G‘olibni o‘zgartirish uchun avval o‘sha o‘yin natijasini bekor qiling.");
            }
        }

        MatchStatus statusBefore = m.status;
        int homeBefore = m.homeTotal();
        int awayBefore = m.awayTotal();
        boolean playable = input.status() == MatchStatus.LIVE || input.status() == MatchStatus.FINISHED;
        boolean regular = playable && input.forfeitLoser() == null;
        m.status = input.status();
        m.homeScore = outcome.homeScore();
        m.awayScore = outcome.awayScore();
        m.homeExtra = regular ? input.homeExtra() : null;
        m.awayExtra = regular ? input.awayExtra() : null;
        m.homePens = regular ? input.homePens() : null;
        m.awayPens = regular ? input.awayPens() : null;
        m.decidedBy = outcome.decidedBy();
        m.winnerId = outcome.winnerId();
        m.liveMinute = input.status() == MatchStatus.LIVE ? input.liveMinute() : null;

        events.deleteAll(events.findByMatchId(matchId));
        events.flush();
        if (regular) {
            for (ResultValidator.ResultEvent e : input.safeEvents()) {
                MatchEvent ev = new MatchEvent();
                ev.matchId = matchId;
                ev.type = e.type();
                ev.minute = e.minute();
                ev.playerId = e.playerId();
                ev.seasonTeamId = e.seasonTeamId();
                ev.assistId = e.type().isScoredGoal() ? e.assistId() : null;
                events.save(ev);
            }
        }
        if (input.appearances() != null) {
            appearances.deleteAll(appearances.findByMatchIdIn(List.of(matchId)));
            appearances.flush();
            if (playable) {
                input.appearances().stream().distinct().forEach(a -> {
                    Appearance ap = new Appearance();
                    ap.matchId = matchId;
                    ap.seasonTeamId = a.seasonTeamId();
                    ap.playerId = a.playerId();
                    appearances.save(ap);
                });
            }
        }

        if (m.stage == MatchStage.PLAYOFF) {
            for (Bracket.AdvanceUpdate u : Bracket.advancementUpdates(m)) {
                matches.findById(u.matchId()).ifPresent(next -> {
                    if ("home".equals(u.slot())) next.homeId = u.seasonTeamId();
                    else next.awayId = u.seasonTeamId();
                });
            }
        }

        String home = d.teamName(m.homeId);
        String away = d.teamName(m.awayId);
        String score = m.homeScore == null ? "hisobsiz" : m.homeTotal() + ":" + m.awayTotal();
        String state = input.status() == MatchStatus.FINISHED ? "yakunlandi" : input.status() == MatchStatus.LIVE ? "jonli yangilandi" : "holati o‘zgartirildi";
        audit.record("Natija", home + " " + score + " " + away + " — " + state, "MATCH", matchId);
        if (input.status() == MatchStatus.FINISHED) {
            outbox.publish(OutboxService.MATCH_FINISHED, Map.of("matchId", matchId.toString(), "home", home, "away", away, "score", score));
        }
        // Guruh bosqichining oxirgi natijasidan keyin pley-off setkasi o'zi tuziladi
        if (m.stage == MatchStage.GROUP) playoffs.sync(m.seasonId);
        // Saytdagi ochiq sahifalar darhol yangilanadi (tranzaksiya yakunlangach)
        String kind;
        String side = null;
        if (m.homeTotal() > homeBefore || m.awayTotal() > awayBefore) {
            kind = "GOAL";
            side = m.homeTotal() > homeBefore ? "home" : "away";
        } else if (m.status == MatchStatus.FINISHED && statusBefore != MatchStatus.FINISHED) {
            kind = "FINISH";
        } else if (m.status == MatchStatus.LIVE && statusBefore != MatchStatus.LIVE) {
            kind = "START";
        } else {
            kind = "UPDATE";
        }
        publisher.publishEvent(new LiveUpdates.LiveEvent(m.seasonId, m.getId(), kind, side));
        return MatchDto.of(m);
    }
}
