package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.DecidedBy;
import uz.payariq.liga.domain.LivePeriod;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.PlayoffRound;

/** O'yin. Holat va hisob — turnir jadvalining yagona manbasi */
@Entity
@Table(name = "matches")
public class Match extends BaseEntity {
    public UUID seasonId;
    @Enumerated(EnumType.STRING)
    public MatchStage stage;
    public UUID groupId;
    public Integer round;
    @Enumerated(EnumType.STRING)
    public PlayoffRound playoffRound;
    public Integer bracketIndex;
    public UUID homeId;
    public UUID awayId;
    /** Jamoa hali aniq bo'lmaganda ko'rsatiladigan belgi, masalan "A1" */
    public String homeLabel;
    public String awayLabel;
    public Instant kickoff;
    /** Avtomatik tuzilgan pley-off o'yinida tashkilotchi sana-vaqtni tasdiqlaguncha false */
    public boolean timeConfirmed = true;
    public UUID venueId;
    @Enumerated(EnumType.STRING)
    public MatchStatus status = MatchStatus.SCHEDULED;
    /** Asosiy vaqt gollari */
    public Integer homeScore;
    public Integer awayScore;
    /** Qo'shimcha vaqt gollari (faqat pley-off) */
    public Integer homeExtra;
    public Integer awayExtra;
    public Integer homePens;
    public Integer awayPens;
    @Enumerated(EnumType.STRING)
    public DecidedBy decidedBy;
    public UUID winnerId;
    public UUID nextMatchId;
    public String nextSlot;
    public UUID loserNextMatchId;
    public String loserNextSlot;
    public String referee;
    public Integer liveMinute;
    /** Jonli o'yin soati: qaysi qism davom etmoqda va u qachon boshlangan */
    @Enumerated(EnumType.STRING)
    public LivePeriod livePeriod;
    public Instant periodStartedAt;
    public String note;

    /** Turnir jadvaliga ta'sir qiladigan o'yin: yakunlangan va hisobi bor */
    public boolean countsForTable() {
        return status == MatchStatus.FINISHED && homeId != null && awayId != null && homeScore != null && awayScore != null;
    }

    public int homeTotal() {
        return (homeScore == null ? 0 : homeScore) + (homeExtra == null ? 0 : homeExtra);
    }

    public int awayTotal() {
        return (awayScore == null ? 0 : awayScore) + (awayExtra == null ? 0 : awayExtra);
    }

    public boolean involves(UUID seasonTeamId) {
        return seasonTeamId != null && (seasonTeamId.equals(homeId) || seasonTeamId.equals(awayId));
    }

    public boolean hasResult() {
        return status == MatchStatus.FINISHED || status == MatchStatus.LIVE;
    }
}
