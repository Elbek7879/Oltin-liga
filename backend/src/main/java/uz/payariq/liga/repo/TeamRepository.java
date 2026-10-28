package uz.payariq.liga.repo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.Team;

/** Nom bo'yicha takrorlanishni tekshirish — TeamNames qoidasi bilan xizmat qatlamida */
public interface TeamRepository extends JpaRepository<Team, UUID> {
    List<Team> findAllByOrderByNameAsc();
}
