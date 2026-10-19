package uz.payariq.liga.repo;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.Player;

public interface PlayerRepository extends JpaRepository<Player, UUID> {
}
