package uz.payariq.liga.common;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

/**
 * Barcha jadvallar uchun umumiy maydonlar. ID ilova tomonidan yaratiladi;
 * version — bir vaqtda tahrirlashdan himoya (optimistic locking) va yangi yozuvni aniqlash uchun.
 */
@MappedSuperclass
public abstract class BaseEntity {

    @Id
    private UUID id = UUID.randomUUID();

    @Version
    private Integer version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    /** Yozuv versiyasi: har saqlashda oshadi (eskirgan formani aniqlash uchun) */
    public Integer getVersion() {
        return version;
    }

    /**
     * Yozuvni o'zgargan deb belgilaydi — versiya albatta oshadi. Masalan, o'yinning faqat hodisalari
     * (alohida jadval) o'zgarganda ham o'yin versiyasi yangilanishi kerak.
     */
    public void touch() {
        Instant now = Instant.now();
        updatedAt = updatedAt != null && !now.isAfter(updatedAt) ? updatedAt.plusNanos(1000) : now;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
