package uz.payariq.liga.repo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.SeasonTeam;

public interface SeasonTeamRepository extends JpaRepository<SeasonTeam, UUID> {
    List<SeasonTeam> findBySeasonId(UUID seasonId);

    List<SeasonTeam> findByTeamId(UUID teamId);

    Optional<SeasonTeam> findBySeasonIdAndTeamId(UUID seasonId, UUID teamId);
}
