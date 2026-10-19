package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "season_rosters")
public class RosterEntry extends BaseEntity {
    public UUID seasonId;
    public UUID seasonTeamId;
    public UUID playerId;
    public Integer shirtNumber;
}
