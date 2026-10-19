package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import uz.payariq.liga.common.BaseEntity;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "outbox_events")
public class OutboxEvent extends BaseEntity {
    public String type;
    public String payload;
    public Instant processedAt;
}
