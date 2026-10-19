package uz.payariq.liga.repo;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.payariq.liga.model.MatchEvent;

public interface MatchEventRepository extends JpaRepository<MatchEvent, UUID> {
    List<MatchEvent> findByMatchIdIn(Collection<UUID> matchIds);

    List<MatchEvent> findByMatchId(UUID matchId);

    void deleteByMatchId(UUID matchId);

    @Query("select count(e) > 0 from MatchEvent e where e.playerId = :id or e.assistId = :id")
    boolean existsForPlayer(@Param("id") UUID playerId);

    @Query("select distinct e.playerId from MatchEvent e where e.playerId is not null")
    List<UUID> allPlayerIds();

    @Query("select distinct e.assistId from MatchEvent e where e.assistId is not null")
    List<UUID> allAssistIds();
}
