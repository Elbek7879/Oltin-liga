package uz.payariq.liga.telegram;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Bot API mijozi: Java'ning o'z HTTP mijozi bilan, qo'shimcha kutubxonasiz */
@Component
public class HttpTelegramApi implements TelegramApi {

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper json;
    private final TelegramSettings settings;

    public HttpTelegramApi(ObjectMapper json, TelegramSettings settings) {
        this.json = json;
        this.settings = settings;
    }

    @Override
    public JsonNode call(String method, Map<String, Object> params, Duration timeout) {
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create("https://api.telegram.org/bot" + settings.token() + "/" + method))
                    .timeout(timeout)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(params)))
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode node = json.readTree(res.body());
            if (!node.path("ok").asBoolean(false)) {
                throw new TelegramException(node.path("error_code").asInt(res.statusCode()), node.path("description").asText("Telegram xatosi"));
            }
            return node.path("result");
        } catch (IOException e) {
            // Xabarda manzil (va undagi token) bo'lmasligi uchun faqat xato turi
            throw new TelegramException(0, "Telegram bilan aloqa yo‘q: " + e.getClass().getSimpleName());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TelegramException(0, "To‘xtatildi");
        }
    }
}
