package uz.payariq.liga.repo;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import uz.payariq.liga.model.Appearance;

public interface AppearanceRepository extends JpaRepository<Appearance, UUID> {
    List<Appearance> findByMatchIdIn(Collection<UUID> matchIds);

    void deleteByMatchId(UUID matchId);

    boolean existsByPlayerId(UUID playerId);

    @Query("select distinct a.playerId from Appearance a")
    List<UUID> allPlayerIds();
}
