package uz.payariq.liga.repo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.SeasonAward;

public interface SeasonAwardRepository extends JpaRepository<SeasonAward, UUID> {
    List<SeasonAward> findBySeasonId(UUID seasonId);

    List<SeasonAward> findByPlayerId(UUID playerId);

    List<SeasonAward> findAllByOrderBySeasonIdAsc();
}
