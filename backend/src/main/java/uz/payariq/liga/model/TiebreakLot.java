package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import uz.payariq.liga.common.BaseEntity;

/**
 * Teng holatdagi qur'a natijasi. Hech bir nizom mezoni ajrata olmagan jamoalar shu tartibda joylashadi.
 * scope: "GROUP:<guruh id>" (guruh ichidagi o'rin) yoki "SEED:<o'rin>" (pley-off reytingi).
 */
@Entity
@Table(name = "tiebreak_lots")
public class TiebreakLot extends BaseEntity {
    public UUID seasonId;
    public String scope;
    public String teamOrder;

    public List<UUID> order() {
        if (teamOrder == null || teamOrder.isBlank()) return List.of();
        return Arrays.stream(teamOrder.split(",")).map(String::trim).map(UUID::fromString).toList();
    }

    public void setOrder(List<UUID> ids) {
        teamOrder = ids.stream().map(UUID::toString).collect(Collectors.joining(","));
    }

    public static String groupScope(UUID groupId) {
        return "GROUP:" + groupId;
    }

    public static String seedScope(int position) {
        return "SEED:" + position;
    }
}
