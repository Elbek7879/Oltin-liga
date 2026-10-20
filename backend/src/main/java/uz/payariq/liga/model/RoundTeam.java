package uz.payariq.liga.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.PlayoffRound;

/**
 * Ramziy jamoa: tur (guruh bosqichi) yoki pley-off bosqichi yakunida tanlangan 5 futbolchi.
 * Gollar va boshqa ko'rsatkichlar saqlanmaydi — o'yin natijalaridan hisoblanadi.
 */
@Entity
@Table(name = "round_teams")
public class RoundTeam extends BaseEntity {
    public UUID seasonId;

    @Enumerated(EnumType.STRING)
    public MatchStage stage;

    /** Guruh bosqichi turi (1, 2, ...); pley-offda null */
    public Integer round;

    /** Pley-off bosqichi; guruh bosqichida null */
    @Enumerated(EnumType.STRING)
    public PlayoffRound playoffRound;

    /** E'lon qilingan — saytda ko'rinadi; aks holda qoralama */
    public boolean published;
    public Instant publishedAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "round_team_players", joinColumns = @JoinColumn(name = "round_team_id"))
    public List<RoundTeamSlot> slots = new ArrayList<>();
}
