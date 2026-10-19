package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "match_appearances")
public class Appearance extends BaseEntity {
    public UUID matchId;
    public UUID seasonTeamId;
    public UUID playerId;
}
