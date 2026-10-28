package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.FeedbackKind;
import uz.payariq.liga.domain.FeedbackStatus;

/** Muxlisdan kelgan taklif, shikoyat yoki murojaat (oddiy matn) */
@Entity
@Table(name = "feedback_messages")
public class FeedbackMessage extends BaseEntity {
    @Enumerated(EnumType.STRING)
    public FeedbackKind kind;

    public String body;
    public String authorName;
    public String phone;

    @Enumerated(EnumType.STRING)
    public FeedbackStatus status = FeedbackStatus.NEW;
}
