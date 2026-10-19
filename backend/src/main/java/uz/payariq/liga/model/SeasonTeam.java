package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;

/** Entity — oddiy ma'lumot konteyneri; biznes qoidalari service va domain qatlamida. */
@Entity
@Table(name = "season_teams")
public class SeasonTeam extends BaseEntity {
    public UUID seasonId;
    public UUID teamId;
    /** Jamoa nomi shu mavsumdagi holatda saqlanadi — keyin o'zgarsa ham arxiv buzilmaydi */
    public String name;
    public String shortName;
    public UUID captainId;
    public String coach;
}
