package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import uz.payariq.liga.common.BaseEntity;

/** Admin akkaunti bilan bog'langan Telegram chat: bot faqat shu chatlarga xizmat qiladi */
@Entity
@Table(name = "telegram_links")
public class TelegramLink extends BaseEntity {
    public UUID userId;
    public long chatId;
    public String telegramUsername;
}
