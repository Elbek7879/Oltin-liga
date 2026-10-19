package uz.payariq.liga.repo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.LeagueGroup;

public interface LeagueGroupRepository extends JpaRepository<LeagueGroup, UUID> {
    List<LeagueGroup> findBySeasonIdOrderBySortOrderAsc(UUID seasonId);

    void deleteBySeasonId(UUID seasonId);
}
