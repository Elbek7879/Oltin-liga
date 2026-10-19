package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "point_adjustments")
public class PointAdjustment extends BaseEntity {
    public UUID seasonId;
    public UUID seasonTeamId;
    public int points;
    public String reason;
    public String createdBy;
}
