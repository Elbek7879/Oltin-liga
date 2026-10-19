package uz.payariq.liga;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;
import uz.payariq.liga.domain.Role;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import uz.payariq.liga.domain.LivePeriod;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.repo.AppUserRepository;
import uz.payariq.liga.repo.MatchEventRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.telegram.BotUpdateHandler;
import uz.payariq.liga.telegram.TelegramApi;
import uz.payariq.liga.telegram.TelegramLinkService;

/** Telegram bot soxta Telegram bilan: ulanish, jonli o'yin boshqaruvi va himoyalar */
@TestPropertySource(properties = {"liga.telegram.enabled=true", "liga.telegram.token=sinov-token", "liga.telegram.username=SinovBot", "liga.telegram.polling=false"})
class TelegramBotIntegrationTest extends IntegrationTestBase {

    static final List<Call> CALLS = new CopyOnWriteArrayList<>();
    static final AtomicLong MESSAGE_IDS = new AtomicLong(100);
    static final long CHAT = 777L;

    record Call(String method, JsonNode params) {
    }

    @TestConfiguration
    static class FakeTelegram {
        @Bean
        @Primary
        TelegramApi fakeTelegramApi(ObjectMapper json) {
            return new TelegramApi() {
                @Override
                public JsonNode call(String method, Map<String, Object> params, Duration timeout) {
                    CALLS.add(new Call(method, json.valueToTree(params)));
                    return method.equals("sendMessage") ? json.valueToTree(Map.of("message_id", MESSAGE_IDS.incrementAndGet())) : json.valueToTree(true);
                }
            };
        }
    }

    @Autowired
    BotUpdateHandler handler;
    @Autowired
    TelegramLinkService links;
    @Autowired
    AppUserRepository users;
    @Autowired
    MatchRepository matches;
    @Autowired
    MatchEventRepository events;
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    ObjectMapper mapper;

    private String matchId;

    private void setUpMatchToday() throws Exception {
        CALLS.clear();
        Map<String, Object> rules = Map.of("pointsWin", 3, "pointsDraw", 1, "pointsLoss", 0, "tiebreakers", List.of("GOAL_DIFF"),
                "legs", 1, "qualifiersPerGroup", 1, "thirdPlaceMatch", false, "halfMinutes", 25);
        String seasonId = postJson("/api/admin/seasons", Map.of("name", "Bot mavsumi", "year", 2026, "startDate", "2026-01-01", "endDate", "2026-12-31", "rules", rules))
                .get("id").asText();
        postJson("/api/admin/seasons/" + seasonId + "/activate", null);
        for (String name : List.of("Qizil Qishloq", "Qayirma")) {
            postJson("/api/admin/teams?addToSeasonId=" + seasonId, Map.of("name", name, "shortName", name.substring(0, 3).toUpperCase(), "village", "Qishloq",
                    "primaryColor", "#145A3A", "secondaryColor", "#E2BF4F"));
        }
        List<String> ids = new ArrayList<>();
        for (JsonNode row : getJson("/api/admin/seasons/" + seasonId + "/teams")) if (row.get("inSeason").asBoolean()) ids.add(row.get("seasonTeamId").asText());
        for (String st : ids) {
            postJson("/api/admin/seasons/" + seasonId + "/players/bulk", Map.of("seasonTeamId", st, "players", List.of(
                    Map.of("firstName", "Sardor", "lastName", "Karimov", "number", 9),
                    Map.of("firstName", "Vali", "lastName", "Aliyev", "number", 1))));
        }
        putJson("/api/admin/seasons/" + seasonId + "/groups", Map.of("groups", List.of(Map.of("name", "A", "teamIds", ids))));
        JsonNode match = getJson("/api/public/seasons/" + seasonId + "/bundle").get("matches").get(0);
        matchId = match.get("id").asText();
        String kickoff = OffsetDateTime.now(ZoneOffset.ofHours(5)).truncatedTo(ChronoUnit.MINUTES).toString();
        putJson("/api/admin/matches/" + matchId + "/schedule", Map.of("kickoff", kickoff));
    }

    private void linkChat() {
        AppUser admin = users.findByUsernameIgnoreCase(ADMIN).orElseThrow();
        String url = links.createCode(admin).url();
        handler.handle(message(CHAT, "/start " + url.substring(url.indexOf("start=") + 6)));
    }

    // ---------- Telegram yangilanishlari ----------

    private JsonNode message(long chat, String text) {
        return mapper.valueToTree(Map.of("update_id", 1, "message", Map.of("message_id", 1, "text", text,
                "chat", Map.of("id", chat, "type", "private"), "from", Map.of("id", chat, "username", "sinov"))));
    }

    private void press(String data) {
        handler.handle(mapper.valueToTree(Map.of("update_id", 2, "callback_query", Map.of("id", "cb", "data", data,
                "from", Map.of("id", CHAT), "message", Map.of("message_id", 55, "chat", Map.of("id", CHAT, "type", "private"))))));
    }

    private JsonNode lastMarkup() {
        for (int i = CALLS.size() - 1; i >= 0; i--) {
            JsonNode p = CALLS.get(i).params();
            if (p.has("reply_markup") && p.get("reply_markup").has("inline_keyboard")) return p.get("reply_markup").get("inline_keyboard");
        }
        throw new AssertionError("Tugmalar topilmadi");
    }

    /** Oxirgi panel/xabardagi, matni shu bo'lakni o'z ichiga olgan tugma ma'lumoti */
    private String button(String textPart) {
        for (JsonNode row : lastMarkup()) for (JsonNode b : row) if (b.get("text").asText().contains(textPart)) return b.get("callback_data").asText();
        throw new AssertionError("Tugma topilmadi: " + textPart + " — " + lastMarkup());
    }

    private String lastAnswer() {
        for (int i = CALLS.size() - 1; i >= 0; i--) if (CALLS.get(i).method().equals("answerCallbackQuery")) return CALLS.get(i).params().path("text").asText();
        return "";
    }

    private Match match() {
        return matches.findById(java.util.UUID.fromString(matchId)).orElseThrow();
    }

    // ---------- Testlar ----------

    @Test
    @DisplayName("ulanish: bir martalik havola chatni adminga bog'laydi, begona odam hech narsa ko'rmaydi")
    void linking() throws Exception {
        CALLS.clear();
        handler.handle(message(999, "/start"));
        assertThat(CALLS.get(CALLS.size() - 1).params().get("text").asText()).contains("faqat Payariq Oltin Ligasi tashkilotchilari uchun");

        handler.handle(message(999, "/start NOTOGRIKOD"));
        assertThat(CALLS.get(CALLS.size() - 1).params().get("text").asText()).contains("Havola eskirgan");

        linkChat();
        assertThat(CALLS.get(CALLS.size() - 1).params().get("text").asText()).contains("Telegram akkauntingiz ulandi");
        assertThat(jdbc.queryForObject("select count(*) from telegram_links where chat_id = ?", Integer.class, CHAT)).isEqualTo(1);
        // Sayt orqali holat va uzish
        JsonNode status = getJson("/api/auth/telegram");
        assertThat(status.get("linked").asBoolean()).isTrue();
        perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/auth/telegram"), null, asAdmin()).andExpect(status().isNoContent());
        CALLS.clear();
        handler.handle(message(CHAT, "Bugungi o‘yinlar"));
        assertThat(CALLS.get(0).params().get("text").asText()).contains("faqat Payariq Oltin Ligasi tashkilotchilari uchun");
        // Sayt havola beradi; muharrir roli uchun bot kerak emas
        assertThat(read(perform(post("/api/auth/telegram/link"), null, asAdmin()).andExpect(status().isOk())).get("url").asText()).startsWith("https://t.me/SinovBot?start=");
        perform(post("/api/auth/telegram/link"), null, as(Role.EDITOR)).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("jonli o'yin: boshlash, gol (ikki marta bosish himoyasi), kartochka, bekor qilish, tanaffus va yakunlash")
    void liveMatch() throws Exception {
        setUpMatchToday();
        linkChat();
        // Saytdagi sahifa jonli oqimga ulangan
        MvcResult stream = mvc.perform(get("/api/public/live")).andExpect(request().asyncStarted()).andReturn();

        handler.handle(message(CHAT, "Bugungi o‘yinlar"));
        press(button("Qizil Qishloq"));
        press(button("O‘yinni boshlash"));
        assertThat(match().status).isEqualTo(MatchStatus.LIVE);
        assertThat(match().livePeriod).isEqualTo(LivePeriod.FIRST_HALF);

        // Gol: jamoa tugmasi → futbolchi
        press(firstGoalButton());
        String goal = button("Sardor Karimov");
        press(goal);
        Match afterGoal = match();
        assertThat(afterGoal.homeTotal() + afterGoal.awayTotal()).isEqualTo(1);
        assertThat(lastAnswer()).contains("GOL!");
        // Gol saytga darhol yetib boradi (oqim orqali)
        String received = "";
        for (int i = 0; i < 30 && !received.contains("\"kind\":\"GOAL\""); i++) {
            Thread.sleep(100);
            received = stream.getResponse().getContentAsString();
        }
        assertThat(received).contains("event:match").contains("\"kind\":\"GOAL\"").contains(matchId);
        // Xuddi shu tugma ikkinchi marta bosildi — gol qayta yozilmaydi
        press(goal);
        assertThat(match().homeTotal() + match().awayTotal()).isEqualTo(1);
        assertThat(lastAnswer()).contains("Holat o‘zgargan");

        // Sariq, so'ng o'sha futbolchiga yana sariq — ikkinchi sariq
        press(button("Kartochka"));
        press(button("🟨"));
        press(button("Vali Aliyev"));
        assertThat(lastAnswer()).contains("Sariq");
        press(button("Kartochka"));
        press(button("🟨"));
        press(button("Vali Aliyev"));
        assertThat(lastAnswer()).contains("Ikkinchi sariq");
        assertThat(events.findByMatchId(match().getId())).hasSize(3);

        // Oxirgi hodisani bekor qilish (tasdiq bilan)
        press(button("Bekor qilish"));
        press(button("Ha, bekor qilish"));
        assertThat(events.findByMatchId(match().getId())).hasSize(2);

        // Tanaffus va 2-bo'lim
        press(button("Tanaffus"));
        assertThat(match().livePeriod).isEqualTo(LivePeriod.HALF_TIME);
        press(button("2-bo‘limni boshlash"));
        assertThat(match().livePeriod).isEqualTo(LivePeriod.SECOND_HALF);

        // Yakunlash
        press(button("O‘yin tugadi"));
        press(button("Ha, yakunlash"));
        Match done = match();
        assertThat(done.status).isEqualTo(MatchStatus.FINISHED);
        assertThat(done.livePeriod).isNull();
        JsonNode standings = getJson("/api/public/seasons/" + done.seasonId + "/bundle").get("standings");
        int played = 0;
        for (JsonNode rows : standings) for (JsonNode row : rows) played += row.get("played").asInt();
        assertThat(played).isEqualTo(2);
        // O'zgarishlar tarixida bot orqali bajarilgani ko'rinadi
        assertThat(jdbc.queryForObject("select count(*) from audit_logs where summary like '%(Telegram)%' and username = ?", Integer.class, ADMIN)).isGreaterThan(3);
    }

    /** Uy jamoasining (ro'yxatda birinchi) gol tugmasi */
    private String firstGoalButton() {
        for (JsonNode row : lastMarkup()) for (JsonNode b : row) if (b.get("text").asText().endsWith(" gol")) return b.get("callback_data").asText();
        throw new AssertionError("Gol tugmasi topilmadi");
    }
}
