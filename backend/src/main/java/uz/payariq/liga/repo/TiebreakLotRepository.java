package uz.payariq.liga.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.TiebreakLot;

public interface TiebreakLotRepository extends JpaRepository<TiebreakLot, UUID> {
    List<TiebreakLot> findBySeasonId(UUID seasonId);

    Optional<TiebreakLot> findBySeasonIdAndScope(UUID seasonId, String scope);
}
