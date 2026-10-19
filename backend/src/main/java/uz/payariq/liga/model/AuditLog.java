package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "audit_logs")
public class AuditLog extends BaseEntity {
    public String username;
    public String displayName;
    public String action;
    public String summary;
    public String entityType;
    public UUID entityId;
    public String ipAddress;
}
