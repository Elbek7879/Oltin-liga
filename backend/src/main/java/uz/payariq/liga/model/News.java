package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.NewsStatus;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "news")
public class News extends BaseEntity {
    public String slug;
    public String title;
    public String excerpt;
    public String body;
    public Instant publishedAt;
    public boolean important;
    @Enumerated(EnumType.STRING)
    public NewsStatus status = NewsStatus.DRAFT;
}
