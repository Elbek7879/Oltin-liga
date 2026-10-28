package uz.payariq.liga.repo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.domain.ApplicationStatus;
import uz.payariq.liga.model.TeamApplication;

public interface TeamApplicationRepository extends JpaRepository<TeamApplication, UUID> {
    List<TeamApplication> findAllByOrderByCreatedAtDesc();

    List<TeamApplication> findByStatus(ApplicationStatus status);

    long countByStatus(ApplicationStatus status);
}
