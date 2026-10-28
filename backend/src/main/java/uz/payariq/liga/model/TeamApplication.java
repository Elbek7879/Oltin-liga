package uz.payariq.liga.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.ApplicationStatus;

/** Saytdan yuborilgan yangi mavsumga qo'shilish arizasi: jamoa nomi, logotipi va futbolchilar ro'yxati */
@Entity
@Table(name = "team_applications")
public class TeamApplication extends BaseEntity {
    public String teamName;
    public String village;
    public String logoUrl;
    public String contactPhone;

    @Enumerated(EnumType.STRING)
    public ApplicationStatus status = ApplicationStatus.NEW;

    /** Qabul qilingach: qaysi mavsumga va qaysi jamoa sifatida qo'shilgani */
    public UUID seasonId;
    public UUID teamId;
    public Instant decidedAt;
    public String decidedBy;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "team_application_players", joinColumns = @JoinColumn(name = "application_id"))
    @OrderColumn(name = "sort_order")
    public List<ApplicationPlayer> players = new ArrayList<>();
}
