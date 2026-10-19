package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import uz.payariq.liga.common.BaseEntity;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "league_settings")
public class LeagueSettings extends BaseEntity {
    public String name;
    public String shortName;
    public String region;
    public String about;
    public String contactPhone = "";
    public String telegram = "";
}
