package uz.payariq.liga.repo;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.payariq.liga.model.AuditLog;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    List<AuditLog> findTop300ByOrderByCreatedAtDesc();

    List<AuditLog> findTop6ByOrderByCreatedAtDesc();
}
