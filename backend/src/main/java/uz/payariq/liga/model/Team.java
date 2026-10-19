package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import uz.payariq.liga.common.BaseEntity;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "teams")
public class Team extends BaseEntity {
    public String name;
    public String shortName;
    public String village;
    public String primaryColor;
    public String secondaryColor;
    public Integer founded;
    public String logoUrl;
    public boolean active = true;
}
