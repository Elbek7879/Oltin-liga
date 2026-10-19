package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.AwardType;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "season_awards")
public class SeasonAward extends BaseEntity {
    public UUID seasonId;
    @Enumerated(EnumType.STRING)
    public AwardType type;
    public UUID seasonTeamId;
    public UUID playerId;
    public String note;
}
