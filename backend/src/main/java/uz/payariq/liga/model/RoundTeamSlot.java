package uz.payariq.liga.model;

import jakarta.persistence.Embeddable;
import java.util.Objects;
import java.util.UUID;

/** Ramziy jamoadagi bitta o'rin: GK, DF, MF_L, MF_R yoki FW */
@Embeddable
public class RoundTeamSlot {
    public String slot;
    public UUID playerId;
    /** Futbolchi o'sha mavsumda qaysi jamoada (rasm va saytda jamoa nomi uchun) */
    public UUID seasonTeamId;

    public RoundTeamSlot() {
    }

    public RoundTeamSlot(String slot, UUID playerId, UUID seasonTeamId) {
        this.slot = slot;
        this.playerId = playerId;
        this.seasonTeamId = seasonTeamId;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof RoundTeamSlot s && Objects.equals(slot, s.slot) && Objects.equals(playerId, s.playerId)
                && Objects.equals(seasonTeamId, s.seasonTeamId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(slot, playerId, seasonTeamId);
    }
}
