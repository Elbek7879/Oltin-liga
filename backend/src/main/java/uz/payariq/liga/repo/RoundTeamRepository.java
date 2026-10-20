package uz.payariq.liga.repo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.payariq.liga.model.RoundTeam;

public interface RoundTeamRepository extends JpaRepository<RoundTeam, UUID> {

    List<RoundTeam> findBySeasonIdOrderByCreatedAtAsc(UUID seasonId);

    List<RoundTeam> findBySeasonIdAndPublishedTrueOrderByPublishedAtAsc(UUID seasonId);

    @Query("select count(r) > 0 from RoundTeam r join r.slots s where s.playerId = :playerId")
    boolean existsWithPlayer(@Param("playerId") UUID playerId);
}
