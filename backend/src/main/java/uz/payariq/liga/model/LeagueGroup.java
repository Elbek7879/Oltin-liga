package uz.payariq.liga.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;

/** Guruh. Jamoalar ro'yxati group_teams jadvalida; bitta jamoa faqat bitta guruhda (DB cheklovi) */
@Entity
@Table(name = "league_groups")
public class LeagueGroup extends BaseEntity {
    public UUID seasonId;
    public String name;
    public int sortOrder;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "group_teams", joinColumns = @JoinColumn(name = "group_id"))
    @OrderColumn(name = "position")
    @Column(name = "season_team_id")
    public List<UUID> seasonTeamIds = new ArrayList<>();
}
