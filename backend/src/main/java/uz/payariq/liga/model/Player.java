package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.Position;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "players")
public class Player extends BaseEntity {
    public String firstName;
    public String lastName;
    public Integer birthYear;
    @Enumerated(EnumType.STRING)
    public Position position;
    /** Maxfiy maydon — faqat admin API orqali qaytariladi */
    public String phone;
    public String photoUrl;

    public String fullName() {
        return firstName + " " + lastName;
    }
}
