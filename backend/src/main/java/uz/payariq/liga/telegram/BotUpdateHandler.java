package uz.payariq.liga.telegram;

import static uz.payariq.liga.telegram.TelegramBot.esc;

import java.nio.ByteBuffer;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.EventType;
import uz.payariq.liga.domain.LivePeriod;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.Schedule;
import uz.payariq.liga.domain.SeasonStatus;
import uz.payariq.liga.model.AppUser;
import uz.payariq.liga.model.LeagueGroup;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.MatchEvent;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.SeasonRepository;
import uz.payariq.liga.service.LiveMatchService;
import uz.payariq.liga.service.SeasonData;
import uz.payariq.liga.service.SeasonDataLoader;
import uz.payariq.liga.telegram.TelegramBot.Button;
import uz.payariq.liga.telegram.TelegramBot.Keyboard;

/**
 * Botga kelgan xabar va tugma bosishlarini qayta ishlaydi.
 *
 * <p>Tugma ma'lumoti: {@code amal.o'yin.holat[.qo'shimcha]}. «holat» — o'yinning hozirgi ko'rinishi (hodisalar soni, bo'lim, penaltilar);
 * u o'zgargan bo'lsa (ikki marta bosildi yoki boshqa admin kiritdi) amal bajarilmaydi, panel yangilanadi.
 * Shu tufayli yomon internetda ham gol ikki marta yozilmaydi.
 */
@Component
public class BotUpdateHandler {

    private static final Logger log = LoggerFactory.getLogger(BotUpdateHandler.class);
    private static final String[] MONTHS = {"yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"};
    private static final String NOT_ALLOWED = "Bu bot faqat Payariq Oltin Ligasi tashkilotchilari uchun.\n\n"
            + "Agar siz tashkilotchi bo‘lsangiz: saytdagi boshqaruv panelida <b>Hisobim → Telegram'ni ulash</b> tugmasini bosing.";

    private final TelegramBot bot;
    private final TelegramLinkService links;
    private final LiveMatchService live;
    private final MatchRepository matches;
    private final SeasonRepository seasons;
    private final SeasonDataLoader loader;
    private final Clock clock;

    public BotUpdateHandler(TelegramBot bot, TelegramLinkService links, LiveMatchService live, MatchRepository matches,
                            SeasonRepository seasons, SeasonDataLoader loader, Clock clock) {
        this.bot = bot;
        this.links = links;
        this.live = live;
        this.matches = matches;
        this.seasons = seasons;
        this.loader = loader;
        this.clock = clock;
    }

    public void handle(JsonNode update) {
        if (update.has("message")) onMessage(update.get("message"));
        else if (update.has("callback_query")) onCallback(update.get("callback_query"));
    }

    // ---------- Matnli xabarlar ----------

    private void onMessage(JsonNode msg) {
        JsonNode chat = msg.path("chat");
        if (!"private".equals(chat.path("type").asText())) return;
        long chatId = chat.path("id").asLong();
        String text = msg.path("text").asText("").trim();

        if (text.startsWith("/start ")) {
            String code = text.substring(7).trim();
            String tgUser = msg.path("from").path("username").asText(null);
            links.link(code, chatId, tgUser).ifPresentOrElse(
                    u -> bot.send(chatId, "Salom, <b>" + esc(u.displayName) + "</b>! Telegram akkauntingiz ulandi.\n\n"
                            + "Pastdagi tugmalar orqali bugungi o‘yinlarni ochasiz va jonli o‘yinda gollarni kiritasiz. Kiritilgan har bir gol saytda darhol ko‘rinadi.",
                            TelegramBot.mainMenu()),
                    () -> bot.send(chatId, "Havola eskirgan yoki noto‘g‘ri. Saytdagi <b>Hisobim</b> sahifasida «Telegram'ni ulash» tugmasini qayta bosing.", (Map<String, Object>) null));
            return;
        }

        AppUser user = links.userForChat(chatId).orElse(null);
        if (user == null) {
            bot.send(chatId, NOT_ALLOWED, (Map<String, Object>) null);
            return;
        }
        runAs(user, () -> {
            if (text.equals("/jonli") || text.equals(TelegramBot.MENU_LIVE)) sendLive(chatId);
            else sendToday(chatId, null, user.displayName);
        });
    }

    // ---------- Tugmalar ----------

    private void onCallback(JsonNode cb) {
        String callbackId = cb.path("id").asText();
        long chatId = cb.path("message").path("chat").path("id").asLong();
        long messageId = cb.path("message").path("message_id").asLong();
        String data = cb.path("data").asText("");
        AppUser user = links.userForChat(chatId).orElse(null);
        if (user == null) {
            bot.answer(callbackId, "Ruxsat yo‘q. Saytdagi «Hisobim» sahifasidan botni ulang.", true);
            return;
        }
        runAs(user, () -> {
            try {
                dispatch(callbackId, chatId, messageId, data.split("\\."));
            } catch (ApiException e) {
                bot.answer(callbackId, e.getMessage(), true);
            } catch (RuntimeException e) {
                log.warn("Bot amalida xato: {}", e.toString());
                bot.answer(callbackId, "Xatolik yuz berdi. Qayta urinib ko‘ring.", true);
            }
        });
    }

    private void dispatch(String cbId, long chatId, long msgId, String[] p) {
        String op = p[0];
        if (op.equals("t")) {
            bot.answer(cbId, null, false);
            sendToday(chatId, msgId, null);
            return;
        }
        // Botning o'zi bunday tugma yaratmaydi — eski yoki buzilgan ma'lumot
        if (p.length < 2) throw ApiException.badRequest("Bu tugma eskirgan. Panelni yangilang.");
        Match m = live.match(dec(p[1]));
        // Ochish va yangilash — holatni tekshirmaydi
        if (op.equals("o") || op.equals("r")) {
            bot.answer(cbId, op.equals("r") ? "Yangilandi" : null, false);
            showPanel(chatId, msgId, m);
            return;
        }
        // Qolgan amallar panel ko'rilgan holatda bajariladi
        if (p.length < 3 || !p[2].equals(rev(m))) {
            bot.answer(cbId, "Holat o‘zgargan (tugma ikki marta bosildi yoki boshqa admin kiritdi). Panel yangilandi.", false);
            showPanel(chatId, msgId, m);
            return;
        }
        UUID id = m.getId();
        switch (op) {
            case "s" -> {
                live.start(id);
                bot.answer(cbId, "O‘yin boshlandi. Saytda «Jonli» deb ko‘rinmoqda.", false);
                showPanel(chatId, msgId, live.match(id));
            }
            case "g" -> {
                bot.answer(cbId, null, false);
                showGoalPicker(chatId, msgId, m, p[3].equals("h"), kindOf(p[4]));
            }
            case "gp" -> {
                boolean home = p[3].equals("h");
                EventType kind = kindOf(p[4]);
                UUID player = p[5].equals("-") ? null : dec(p[5]);
                Match after = live.addGoal(id, home, kind, player);
                SeasonData d = loader.load(after.seasonId);
                String who = player == null ? "muallif noma’lum" : d.playerName(player);
                bot.answer(cbId, "⚽ GOL! " + d.teamName(home ? after.homeId : after.awayId) + " — " + who + (kind == EventType.OWN_GOAL ? " (avtogol)" : "")
                        + ". Hisob " + after.homeTotal() + ":" + after.awayTotal(), false);
                showPanel(chatId, msgId, after);
            }
            case "c" -> {
                bot.answer(cbId, null, false);
                showCardMenu(chatId, msgId, m);
            }
            case "cs" -> {
                bot.answer(cbId, null, false);
                showCardPicker(chatId, msgId, m, p[3].equals("R"), p[4].equals("h"));
            }
            case "cp" -> {
                UUID player = dec(p[4]);
                EventType type = live.addCard(id, p[3].equals("R"), player);
                String name = loader.load(m.seasonId).playerName(player);
                bot.answer(cbId, (type == EventType.YELLOW ? "🟨 Sariq: " : type == EventType.SECOND_YELLOW ? "🟨🟥 Ikkinchi sariq — maydondan chetlatildi: " : "🟥 Qizil: ") + name, false);
                showPanel(chatId, msgId, live.match(id));
            }
            case "u" -> {
                bot.answer(cbId, null, false);
                showUndoConfirm(chatId, msgId, m);
            }
            case "uy" -> {
                MatchEvent removed = live.undoLast(id);
                bot.answer(cbId, "↩️ Bekor qilindi: " + describe(removed, loader.load(m.seasonId)), false);
                showPanel(chatId, msgId, live.match(id));
            }
            case "p" -> {
                Match after = switch (p[3]) {
                    case "HT" -> live.halfTime(id);
                    case "H2" -> live.secondHalf(id);
                    case "ET" -> live.extraTime(id);
                    case "PN" -> live.penalties(id);
                    default -> throw ApiException.badRequest("Noma’lum amal.");
                };
                bot.answer(cbId, switch (p[3]) {
                    case "HT" -> "⏸ Tanaffus";
                    case "H2" -> "▶️ 2-bo‘lim boshlandi";
                    case "ET" -> "⏱ Qo‘shimcha vaqt boshlandi";
                    default -> "🎯 Penaltilar seriyasi";
                }, false);
                showPanel(chatId, msgId, after);
            }
            case "pp" -> {
                Match after = live.adjustPenalties(id, p[3].equals("h"), p[4].equals("+") ? 1 : -1);
                bot.answer(cbId, "Penaltilar: " + after.homePens + ":" + after.awayPens, false);
                showPanel(chatId, msgId, after);
            }
            case "f" -> {
                bot.answer(cbId, null, false);
                showFinishConfirm(chatId, msgId, m);
            }
            case "fy" -> {
                Match after = live.finish(id);
                bot.answer(cbId, "🏁 O‘yin yakunlandi: " + after.homeTotal() + ":" + after.awayTotal() + ". Jadval va statistika yangilandi.", false);
                showPanel(chatId, msgId, after);
            }
            default -> bot.answer(cbId, "Bu tugma eskirgan. Panelni yangilang.", false);
        }
    }

    // ---------- Ro'yxatlar ----------

    private void sendToday(long chatId, Long editMessageId, String greetName) {
        List<Match> list = todays();
        ZonedDateTime now = clock.instant().atZone(Schedule.ZONE);
        StringBuilder t = new StringBuilder();
        if (greetName != null) t.append("Salom, ").append(esc(greetName)).append("!\n\n");
        t.append("<b>Bugungi o‘yinlar</b> — ").append(now.getDayOfMonth()).append("-").append(MONTHS[now.getMonthValue() - 1]);
        Keyboard kb = new Keyboard();
        if (list.isEmpty()) {
            t.append("\n\nBugun o‘yin yo‘q.");
            Match next = nextMatch();
            if (next != null) {
                SeasonData d = loader.load(next.seasonId);
                t.append("\nKeyingi o‘yin: <b>").append(esc(d.teamName(next.homeId))).append(" — ").append(esc(d.teamName(next.awayId)))
                        .append("</b>, ").append(dateTime(next.kickoff)).append(".");
            }
        } else {
            t.append("\n\nO‘yinni tanlang — boshqaruv paneli ochiladi.");
            for (Match m : list) kb.row(new Button(matchButton(m), "o." + enc(m.getId())));
        }
        kb.row(new Button("🔄 Yangilash", "t"));
        if (editMessageId != null) bot.edit(chatId, editMessageId, t.toString(), kb);
        else bot.send(chatId, t.toString(), kb);
    }

    private void sendLive(long chatId) {
        List<Match> lives = todays().stream().filter(m -> m.status == MatchStatus.LIVE).toList();
        if (lives.size() == 1) {
            View v = panel(lives.get(0));
            bot.send(chatId, v.text(), v.kb());
        } else if (lives.isEmpty()) {
            bot.send(chatId, "Hozir jonli o‘yin yo‘q. O‘yinni boshlash uchun «" + TelegramBot.MENU_TODAY + "»ni oching.", TelegramBot.mainMenu());
        } else {
            sendToday(chatId, null, null);
        }
    }

    /** Jonli o'yinlar, bugungi o'yinlar va kechagi natijasi kiritilmagan o'yinlar (faol mavsumda, sanasi belgilangan) */
    private List<Match> todays() {
        Set<UUID> active = seasons.findAll().stream().filter(s -> s.status == SeasonStatus.ACTIVE).map(Season::getId).collect(Collectors.toSet());
        LocalDate today = LocalDate.now(clock.withZone(Schedule.ZONE));
        Instant from = today.minusDays(1).atStartOfDay(Schedule.ZONE).toInstant();
        Instant to = today.plusDays(1).atStartOfDay(Schedule.ZONE).toInstant();
        Map<UUID, Match> result = new LinkedHashMap<>();
        matches.findByStatus(MatchStatus.LIVE).stream().filter(m -> active.contains(m.seasonId)).forEach(m -> result.put(m.getId(), m));
        for (Match m : matches.findByKickoffBetweenOrderByKickoffAsc(from, to)) {
            if (!active.contains(m.seasonId) || !m.timeConfirmed || m.homeId == null || m.awayId == null) continue;
            if (m.status == MatchStatus.CANCELLED || m.status == MatchStatus.POSTPONED) continue;
            boolean isToday = LocalDate.ofInstant(m.kickoff, Schedule.ZONE).equals(today);
            if (isToday || m.status != MatchStatus.FINISHED) result.putIfAbsent(m.getId(), m);
        }
        return result.values().stream().sorted(Comparator.comparing((Match m) -> m.status != MatchStatus.LIVE).thenComparing(m -> m.kickoff)).toList();
    }

    private Match nextMatch() {
        Instant now = clock.instant();
        Set<UUID> active = seasons.findAll().stream().filter(s -> s.status == SeasonStatus.ACTIVE).map(Season::getId).collect(Collectors.toSet());
        return matches.findByKickoffBetweenOrderByKickoffAsc(now, now.plusSeconds(90L * 24 * 3600)).stream()
                .filter(m -> active.contains(m.seasonId) && m.timeConfirmed && m.status == MatchStatus.SCHEDULED && m.homeId != null && m.awayId != null)
                .findFirst().orElse(null);
    }

    private String matchButton(Match m) {
        SeasonData d = loader.load(m.seasonId);
        String teams = d.teamName(m.homeId) + " — " + d.teamName(m.awayId);
        return switch (m.status) {
            case LIVE -> "🔴 " + m.homeTotal() + ":" + m.awayTotal() + "  " + teams;
            case FINISHED -> "✅ " + m.homeTotal() + ":" + m.awayTotal() + "  " + teams;
            default -> "🕒 " + time(m.kickoff) + "  " + teams;
        };
    }

    // ---------- Panel ----------

    private record View(String text, Keyboard kb) {
    }

    private void showPanel(long chatId, long msgId, Match m) {
        View v = panel(m);
        bot.edit(chatId, msgId, v.text(), v.kb());
    }

    private View panel(Match m) {
        SeasonData d = loader.load(m.seasonId);
        List<MatchEvent> line = live.timeline(m.getId());
        String id = enc(m.getId());
        String rv = rev(m, line.size());
        String home = d.teamName(m.homeId);
        String away = d.teamName(m.awayId);
        StringBuilder t = new StringBuilder();
        t.append(statusLine(m)).append('\n');
        boolean scored = m.status == MatchStatus.LIVE || m.status == MatchStatus.FINISHED;
        t.append("<b>").append(esc(home)).append("   ").append(scored ? m.homeTotal() + " : " + m.awayTotal() : "—").append("   ").append(esc(away)).append("</b>\n");
        if (m.homeExtra != null) t.append("Qo‘shimcha vaqt: ").append(m.homeExtra).append(":").append(m.awayExtra).append('\n');
        if (m.homePens != null) t.append("Penaltilar: <b>").append(m.homePens).append(":").append(m.awayPens).append("</b>\n");
        t.append("<i>").append(esc(stage(m, d))).append("</i>\n");
        if (!line.isEmpty()) {
            t.append('\n');
            for (MatchEvent e : line) t.append(icon(e.type)).append(' ').append(e.minute == null ? "" : e.minute + "′ ").append(esc(describe(e, d))).append('\n');
        }

        Keyboard kb = new Keyboard();
        String base = id + "." + rv;
        switch (m.status) {
            case SCHEDULED -> {
                if (!m.timeConfirmed) t.append("\nSana belgilanmagan — avval saytda sana va vaqtni belgilang.");
                // Bot faqat jonli o'yin uchun: vaqti o'tib ketgan o'yin natijasi saytda kiritiladi
                else if (live.isPast(m)) {
                    t.append("\n⏰ O‘yin vaqti o‘tib ketgan. Bot faqat jonli o‘yinlar uchun — natijani saytdagi «Natijalar» bo‘limida kiriting: ")
                            .append("gollar futbolchilar nomiga yoziladi, daqiqalar ixtiyoriy. O‘yin kechiktirilgan bo‘lsa, saytda uning vaqtini o‘zgartiring.");
                } else kb.row(new Button("▶️ O‘yinni boshlash", "s." + base));
            }
            case LIVE -> {
                LivePeriod period = m.livePeriod;
                boolean playing = period != LivePeriod.HALF_TIME && period != LivePeriod.PENALTIES;
                if (playing) {
                    kb.row(new Button("⚽ " + shortName(home) + " gol", "g." + base + ".h.G"), new Button("⚽ " + shortName(away) + " gol", "g." + base + ".a.G"));
                }
                kb.row(new Button("🟨🟥 Kartochka", "c." + base), line.isEmpty() ? null : new Button("↩️ Bekor qilish", "u." + base));
                if (period == null || period == LivePeriod.FIRST_HALF) kb.row(new Button("⏸ Tanaffus", "p." + base + ".HT"));
                if (period == LivePeriod.HALF_TIME) kb.row(new Button("▶️ 2-bo‘limni boshlash", "p." + base + ".H2"));
                boolean level = m.homeTotal() == m.awayTotal();
                if (m.stage == MatchStage.PLAYOFF && level && (period == LivePeriod.SECOND_HALF || period == null) && m.homeExtra == null) {
                    kb.row(new Button("⏱ Qo‘shimcha vaqt", "p." + base + ".ET"));
                }
                if (m.stage == MatchStage.PLAYOFF && level && period == LivePeriod.EXTRA_TIME) kb.row(new Button("🎯 Penaltilar", "p." + base + ".PN"));
                if (period == LivePeriod.PENALTIES) {
                    kb.row(new Button(shortName(home) + " +1", "pp." + base + ".h.+"), new Button(shortName(home) + " −1", "pp." + base + ".h.-"));
                    kb.row(new Button(shortName(away) + " +1", "pp." + base + ".a.+"), new Button(shortName(away) + " −1", "pp." + base + ".a.-"));
                }
                if (period != LivePeriod.FIRST_HALF && period != LivePeriod.HALF_TIME) kb.row(new Button("🏁 O‘yin tugadi", "f." + base));
            }
            default -> {
            }
        }
        kb.row(new Button("🔄 Yangilash", "r." + id), new Button("📋 O‘yinlar", "t"));
        return new View(t.toString(), kb);
    }

    private String statusLine(Match m) {
        return switch (m.status) {
            case SCHEDULED -> m.timeConfirmed ? "🕒 <b>" + dateTime(m.kickoff) + "</b> da boshlanadi" : "📅 Sana belgilanmagan";
            case LIVE -> {
                int min = live.currentMinute(m);
                if (m.livePeriod == null) yield "🔴 <b>JONLI</b> · " + min + "′";
                yield switch (m.livePeriod) {
                    case FIRST_HALF -> "🔴 <b>JONLI</b> · " + min + "′ · 1-bo‘lim";
                    case HALF_TIME -> "⏸ <b>TANAFFUS</b>";
                    case SECOND_HALF -> "🔴 <b>JONLI</b> · " + min + "′ · 2-bo‘lim";
                    case EXTRA_TIME -> "🔴 <b>JONLI</b> · " + min + "′ · qo‘shimcha vaqt";
                    case PENALTIES -> "🎯 <b>PENALTILAR SERIYASI</b>";
                };
            }
            case FINISHED -> "✅ <b>YAKUNLANDI</b>" + (m.decidedBy == null ? "" : switch (m.decidedBy) {
                case EXTRA_TIME -> " (qo‘shimcha vaqtda)";
                case PENALTIES -> " (penaltilarda)";
                case FORFEIT -> " (texnik natija)";
                default -> "";
            });
            case POSTPONED -> "⚠️ <b>Qoldirilgan</b>";
            case CANCELLED -> "⚠️ <b>Bekor qilingan</b>";
        };
    }

    // ---------- Gol, kartochka, bekor qilish, yakunlash oynalari ----------

    private void showGoalPicker(long chatId, long msgId, Match m, boolean home, EventType kind) {
        SeasonData d = loader.load(m.seasonId);
        String base = enc(m.getId()) + "." + rev(m);
        String side = home ? "h" : "a";
        UUID scoringTeam = home ? m.homeId : m.awayId;
        UUID listTeam = kind == EventType.OWN_GOAL ? (home ? m.awayId : m.homeId) : scoringTeam;
        StringBuilder t = new StringBuilder();
        t.append("⚽ <b>").append(esc(d.teamName(scoringTeam))).append(" gol</b> · ").append(live.currentMinute(m)).append("′\n");
        t.append(kind == EventType.OWN_GOAL
                ? "Avtogol: " + esc(d.teamName(listTeam)) + " futbolchisi o‘z darvozasiga urdi — gol " + esc(d.teamName(scoringTeam)) + " hisobiga yoziladi. Kim urdi?"
                : "Gol urgan futbolchini tanlang:");
        Keyboard kb = new Keyboard();
        kb.row(kindButton("Gol", "G", kind == EventType.GOAL, base, side),
                kindButton("Penalti", "P", kind == EventType.PENALTY_GOAL, base, side),
                kindButton("Avtogol", "O", kind == EventType.OWN_GOAL, base, side));
        List<Button> players = rosterButtons(d, listTeam, pid -> "gp." + base + "." + side + "." + code(kind) + "." + enc(pid));
        if (players.isEmpty()) t.append("\n\n<i>").append(esc(d.teamName(listTeam))).append(" tarkibi kiritilmagan.</i>");
        kb.grid(players, 2);
        kb.row(new Button("❔ Muallif noma’lum", "gp." + base + "." + side + "." + code(kind) + ".-"), new Button("⬅️ Orqaga", "o." + enc(m.getId())));
        bot.edit(chatId, msgId, t.toString(), kb);
    }

    private Button kindButton(String label, String code, boolean selected, String base, String side) {
        return new Button((selected ? "✅ " : "") + label, "g." + base + "." + side + "." + code);
    }

    private void showCardMenu(long chatId, long msgId, Match m) {
        SeasonData d = loader.load(m.seasonId);
        String base = enc(m.getId()) + "." + rev(m);
        String home = shortName(d.teamName(m.homeId));
        String away = shortName(d.teamName(m.awayId));
        Keyboard kb = new Keyboard()
                .row(new Button("🟨 " + home, "cs." + base + ".Y.h"), new Button("🟨 " + away, "cs." + base + ".Y.a"))
                .row(new Button("🟥 " + home, "cs." + base + ".R.h"), new Button("🟥 " + away, "cs." + base + ".R.a"))
                .row(new Button("⬅️ Orqaga", "o." + enc(m.getId())));
        bot.edit(chatId, msgId, "Kartochka turini va jamoani tanlang.\n<i>Bu o‘yinda sariq olgan futbolchiga yana sariq berilsa — «ikkinchi sariq» bo‘lib, maydondan chetlatiladi.</i>", kb);
    }

    private void showCardPicker(long chatId, long msgId, Match m, boolean red, boolean home) {
        SeasonData d = loader.load(m.seasonId);
        String base = enc(m.getId()) + "." + rev(m);
        UUID team = home ? m.homeId : m.awayId;
        String t = (red ? "🟥 <b>Qizil kartochka</b>" : "🟨 <b>Sariq kartochka</b>") + " — " + esc(d.teamName(team)) + "\nFutbolchini tanlang:";
        Keyboard kb = new Keyboard();
        List<Button> players = rosterButtons(d, team, pid -> "cp." + base + "." + (red ? "R" : "Y") + "." + enc(pid));
        if (players.isEmpty()) t += "\n\n<i>Tarkib kiritilmagan — kartochkani saytda kiriting.</i>";
        kb.grid(players, 2);
        kb.row(new Button("⬅️ Orqaga", "c." + base));
        bot.edit(chatId, msgId, t, kb);
    }

    private void showUndoConfirm(long chatId, long msgId, Match m) {
        List<MatchEvent> line = live.timeline(m.getId());
        if (line.isEmpty()) {
            showPanel(chatId, msgId, m);
            return;
        }
        MatchEvent last = line.get(line.size() - 1);
        String base = enc(m.getId()) + "." + rev(m);
        Keyboard kb = new Keyboard().row(new Button("✅ Ha, bekor qilish", "uy." + base), new Button("⬅️ Yo‘q", "o." + enc(m.getId())));
        bot.edit(chatId, msgId, "Oxirgi hodisa bekor qilinsinmi?\n\n" + icon(last.type) + " " + (last.minute == null ? "" : last.minute + "′ ")
                + esc(describe(last, loader.load(m.seasonId))) + "\n\n<i>Gol bekor qilinsa, hisob ham kamayadi.</i>", kb);
    }

    private void showFinishConfirm(long chatId, long msgId, Match m) {
        SeasonData d = loader.load(m.seasonId);
        String base = enc(m.getId()) + "." + rev(m);
        StringBuilder t = new StringBuilder("🏁 <b>O‘yinni yakunlaysizmi?</b>\n\n");
        t.append(esc(d.teamName(m.homeId))).append("  <b>").append(m.homeTotal()).append(" : ").append(m.awayTotal()).append("</b>  ").append(esc(d.teamName(m.awayId)));
        if (m.homePens != null) t.append("\nPenaltilar: ").append(m.homePens).append(":").append(m.awayPens);
        t.append("\n\nYakunlangach turnir jadvali, to‘purarlar va pley-off setkasi o‘zi yangilanadi.");
        Keyboard kb = new Keyboard().row(new Button("✅ Ha, yakunlash", "fy." + base), new Button("⬅️ Orqaga", "o." + enc(m.getId())));
        bot.edit(chatId, msgId, t.toString(), kb);
    }

    private List<Button> rosterButtons(SeasonData d, UUID seasonTeamId, java.util.function.Function<UUID, String> data) {
        List<Button> list = new ArrayList<>();
        d.rosters().stream()
                .filter(r -> r.seasonTeamId.equals(seasonTeamId))
                .sorted(Comparator.comparing((RosterEntry r) -> r.shirtNumber == null ? 999 : r.shirtNumber))
                .forEach(r -> {
                    Player p = d.players().get(r.playerId);
                    if (p == null) return;
                    list.add(new Button((r.shirtNumber == null ? "" : r.shirtNumber + " · ") + p.fullName(), data.apply(r.playerId)));
                });
        return list;
    }

    // ---------- Yordamchilar ----------

    /** O'yin holati belgisi: hodisalar soni, bo'lim, holat va penaltilar */
    String rev(Match m) {
        return rev(m, live.timeline(m.getId()).size());
    }

    private static String rev(Match m, int events) {
        int pens = (m.homePens == null ? 0 : m.homePens) * 37 + (m.awayPens == null ? 0 : m.awayPens);
        return Integer.toString(events, 36) + (m.livePeriod == null ? "n" : Integer.toString(m.livePeriod.ordinal())) + m.status.name().charAt(0) + Integer.toString(pens, 36);
    }

    private static String describe(MatchEvent e, SeasonData d) {
        String who = e.playerId == null ? "Muallif noma’lum" : d.playerName(e.playerId);
        String team = d.teamName(e.seasonTeamId);
        return switch (e.type) {
            case PENALTY_GOAL -> who + " (penalti) — " + team;
            case OWN_GOAL -> who + " (avtogol, " + team + ")";
            case SECOND_YELLOW -> who + " (ikkinchi sariq) — " + team;
            default -> who + " — " + team;
        };
    }

    private static String icon(EventType t) {
        return switch (t) {
            case GOAL, PENALTY_GOAL, OWN_GOAL -> "⚽";
            case YELLOW -> "🟨";
            case SECOND_YELLOW -> "🟨🟥";
            case RED -> "🟥";
        };
    }

    private static String stage(Match m, SeasonData d) {
        if (m.stage == MatchStage.PLAYOFF && m.playoffRound != null) return m.playoffRound.label();
        String group = d.groups().stream().filter(g -> g.getId().equals(m.groupId)).map((LeagueGroup g) -> g.name + " guruhi").findFirst().orElse("Guruh bosqichi");
        return m.round == null ? group : group + ", " + m.round + "-tur";
    }

    private static String shortName(String name) {
        return name.length() <= 14 ? name : name.substring(0, 13) + "…";
    }

    private static EventType kindOf(String code) {
        return switch (code) {
            case "P" -> EventType.PENALTY_GOAL;
            case "O" -> EventType.OWN_GOAL;
            default -> EventType.GOAL;
        };
    }

    private static String code(EventType kind) {
        return kind == EventType.PENALTY_GOAL ? "P" : kind == EventType.OWN_GOAL ? "O" : "G";
    }

    private static String time(Instant at) {
        ZonedDateTime z = at.atZone(Schedule.ZONE);
        return String.format("%02d:%02d", z.getHour(), z.getMinute());
    }

    private static String dateTime(Instant at) {
        ZonedDateTime z = at.atZone(Schedule.ZONE);
        return z.getDayOfMonth() + "-" + MONTHS[z.getMonthValue() - 1] + ", " + time(at);
    }

    /** UUID → 22 belgili qisqa yozuv (tugma ma'lumoti 64 baytdan oshmasligi uchun) */
    static String enc(UUID id) {
        ByteBuffer b = ByteBuffer.allocate(16).putLong(id.getMostSignificantBits()).putLong(id.getLeastSignificantBits());
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b.array());
    }

    static UUID dec(String s) {
        try {
            ByteBuffer b = ByteBuffer.wrap(Base64.getUrlDecoder().decode(s));
            return new UUID(b.getLong(), b.getLong());
        } catch (RuntimeException e) {
            throw ApiException.badRequest("Bu tugma eskirgan. Panelni yangilang.");
        }
    }

    /** Amal admin nomidan bajariladi: huquqlar va o'zgarishlar tarixi saytdagi kabi */
    private void runAs(AppUser user, Runnable action) {
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user.username, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.role.name()))));
        SecurityContextHolder.setContext(ctx);
        BotContext.enter();
        try {
            action.run();
        } finally {
            BotContext.exit();
            SecurityContextHolder.clearContext();
        }
    }
}
