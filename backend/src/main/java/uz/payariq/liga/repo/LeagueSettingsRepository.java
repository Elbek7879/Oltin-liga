package uz.payariq.liga.repo;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.LeagueSettings;

public interface LeagueSettingsRepository extends JpaRepository<LeagueSettings, UUID> {
    Optional<LeagueSettings> findFirstByOrderByCreatedAtAsc();
}
