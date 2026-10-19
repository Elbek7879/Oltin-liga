package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.Role;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "app_users")
public class AppUser extends BaseEntity {
    public String username;
    public String passwordHash;
    public String displayName;
    @Enumerated(EnumType.STRING)
    public Role role;
    public boolean enabled = true;
    public Instant lastLoginAt;
}
