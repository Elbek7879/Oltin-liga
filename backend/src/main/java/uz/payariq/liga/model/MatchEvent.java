package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.EventType;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "match_events")
public class MatchEvent extends BaseEntity {
    public UUID matchId;
    @Enumerated(EnumType.STRING)
    public EventType type;
    public Integer minute;
    /** null — gol muallifi noma'lum */
    public UUID playerId;
    /** Hodisa egasi bo'lgan jamoa (avtogolda — avtogol urgan futbolchining jamoasi) */
    public UUID seasonTeamId;
    public UUID assistId;
}
