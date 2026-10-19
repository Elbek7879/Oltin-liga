package uz.payariq.liga.repo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.Sponsor;

public interface SponsorRepository extends JpaRepository<Sponsor, UUID> {
    List<Sponsor> findAllByOrderBySortOrderAscNameAsc();

    List<Sponsor> findByActiveTrueOrderBySortOrderAscNameAsc();
}
