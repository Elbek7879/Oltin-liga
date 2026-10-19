package uz.payariq.liga.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.RosterEntry;

public interface RosterEntryRepository extends JpaRepository<RosterEntry, UUID> {
    List<RosterEntry> findBySeasonId(UUID seasonId);

    List<RosterEntry> findBySeasonTeamId(UUID seasonTeamId);

    List<RosterEntry> findByPlayerId(UUID playerId);

    Optional<RosterEntry> findBySeasonIdAndPlayerId(UUID seasonId, UUID playerId);

    Optional<RosterEntry> findBySeasonTeamIdAndShirtNumber(UUID seasonTeamId, Integer shirtNumber);

    void deleteBySeasonTeamId(UUID seasonTeamId);
}
