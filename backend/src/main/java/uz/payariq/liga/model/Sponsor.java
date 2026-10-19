package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.SponsorTier;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "sponsors")
public class Sponsor extends BaseEntity {
    public String name;
    @Enumerated(EnumType.STRING)
    public SponsorTier tier;
    public String description = "";
    public String url;
    public String logoUrl;
    public boolean active = true;
    public int sortOrder;
}
