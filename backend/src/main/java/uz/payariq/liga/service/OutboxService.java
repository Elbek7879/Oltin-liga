package uz.payariq.liga.service;

import java.util.Map;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import uz.payariq.liga.model.OutboxEvent;
import uz.payariq.liga.repo.OutboxEventRepository;

/**
 * Tashqi kanallarga (masalan, Telegram) yuboriladigan hodisalar navbati.
 * Hodisa asosiy o'zgarish bilan bitta tranzaksiyada yoziladi; keyinchalik alohida
 * modul navbatni o'qib xabar yuboradi — asosiy kodni o'zgartirish shart emas.
 */
@Service
public class OutboxService {

    public static final String MATCH_SCHEDULED = "MATCH_SCHEDULED";
    public static final String MATCH_FINISHED = "MATCH_FINISHED";
    public static final String NEWS_PUBLISHED = "NEWS_PUBLISHED";
    public static final String SEASON_FINISHED = "SEASON_FINISHED";

    private final OutboxEventRepository repo;
    private final ObjectMapper mapper;

    public OutboxService(OutboxEventRepository repo, ObjectMapper mapper) {
        this.repo = repo;
        this.mapper = mapper;
    }

    public void publish(String type, Map<String, Object> payload) {
        OutboxEvent e = new OutboxEvent();
        e.type = type;
        e.payload = mapper.writeValueAsString(payload);
        repo.save(e);
    }
}
