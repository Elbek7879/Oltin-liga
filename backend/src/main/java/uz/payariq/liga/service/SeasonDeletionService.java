package uz.payariq.liga.service;

import jakarta.persistence.EntityManager;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.SeasonStatus;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.web.Dto.SeasonDeletePreview;
import uz.payariq.liga.web.Dto.SeasonDeleted;

/**
 * Mavsumni butunlay o'chirish. Asosan sinov mavsumi uchun: tashkilotchi tizimni sinab ko'rgach,
 * mavsum, uning guruhlari, o'yinlari, natijalari, ramziy jamoalari, faqat shu mavsumda qatnashgan
 * jamoa va futbolchilar (rasmlari bilan) hamda ular haqidagi tarix yozuvlari o'chadi.
 * Haqiqiy mavsumni faqat natija kiritilmagan bo'lsa o'chirish mumkin (xato ochilgan mavsum);
 * yakunlangan yoki natijasi bor haqiqiy mavsum himoyalangan.
 */
@Service
@Transactional
public class SeasonDeletionService {

    private static final Logger log = LoggerFactory.getLogger(SeasonDeletionService.class);
    private static final Pattern MEDIA = Pattern.compile("^/media/([0-9a-f-]{36}\\.(?:png|jpg|webp))$");

    private final SeasonDataLoader loader;
    private final NamedParameterJdbcTemplate jdbc;
    private final EntityManager em;
    private final AuditService audit;
    private final Path mediaDir;

    public SeasonDeletionService(SeasonDataLoader loader, NamedParameterJdbcTemplate jdbc, EntityManager em, AuditService audit,
                                 @Value("${liga.media.dir:uploads}") String mediaDir) {
        this.loader = loader;
        this.jdbc = jdbc;
        this.em = em;
        this.audit = audit;
        this.mediaDir = Path.of(mediaDir).toAbsolutePath().normalize();
    }

    /** O'chiriladigan narsalar ro'yxati */
    private record Plan(String problem, List<UUID> seasonTeams, List<UUID> teamsRemoved, int players, List<UUID> playersRemoved, int matches, int results) {
    }

    @Transactional(readOnly = true)
    public SeasonDeletePreview preview(UUID seasonId) {
        Season s = loader.season(seasonId);
        Plan p = plan(s);
        return new SeasonDeletePreview(s.getId(), s.name, s.test, p.problem() == null, p.problem(),
                p.seasonTeams().size(), p.teamsRemoved().size(), p.players(), p.playersRemoved().size(), p.matches(), p.results());
    }

    public SeasonDeleted delete(UUID seasonId, String confirmName) {
        Season s = loader.season(seasonId);
        if (confirmName == null || !s.name.trim().equalsIgnoreCase(confirmName.trim())) {
            throw ApiException.badRequest("Tasdiqlash uchun mavsum nomini aynan yozing: «" + s.name + "».");
        }
        Plan p = plan(s);
        if (p.problem() != null) throw ApiException.conflict(p.problem());
        String name = s.name;
        boolean test = s.test;
        // JPA xotirasidagi obyektlar eskirib qolmasin — o'chirish to'g'ridan-to'g'ri SQL bilan
        em.flush();
        em.clear();

        Map<String, Object> sid = Map.of("s", seasonId);
        Set<UUID> historyIds = new HashSet<>();
        historyIds.add(seasonId);
        historyIds.addAll(p.seasonTeams());
        historyIds.addAll(p.teamsRemoved());
        historyIds.addAll(p.playersRemoved());
        for (String table : List.of("matches", "league_groups", "round_teams", "season_awards", "point_adjustments", "tiebreak_lots", "season_rosters")) {
            historyIds.addAll(jdbc.queryForList("select id from " + table + " where season_id = :s", sid, UUID.class));
        }
        List<UUID> matchIds = jdbc.queryForList("select id from matches where season_id = :s", sid, UUID.class);
        List<String> media = new ArrayList<>();
        if (!p.teamsRemoved().isEmpty()) {
            media.addAll(jdbc.queryForList("select logo_url from teams where id in (:ids) and logo_url is not null", Map.of("ids", p.teamsRemoved()), String.class));
        }
        if (!p.playersRemoved().isEmpty()) {
            media.addAll(jdbc.queryForList("select photo_url from players where id in (:ids) and photo_url is not null", Map.of("ids", p.playersRemoved()), String.class));
        }

        // Bog'liqlik tartibida: avval mavsumga tegishli yozuvlar, keyin mavsumning o'zi
        jdbc.update("delete from round_teams where season_id = :s", sid);
        jdbc.update("delete from tiebreak_lots where season_id = :s", sid);
        jdbc.update("delete from season_awards where season_id = :s", sid);
        jdbc.update("delete from point_adjustments where season_id = :s", sid);
        jdbc.update("update matches set next_match_id = null, loser_next_match_id = null where season_id = :s", sid);
        jdbc.update("delete from matches where season_id = :s", sid);
        jdbc.update("delete from league_groups where season_id = :s", sid);
        jdbc.update("delete from season_rosters where season_id = :s", sid);
        jdbc.update("delete from season_teams where season_id = :s", sid);
        jdbc.update("delete from seasons where id = :s", sid);
        if (!p.teamsRemoved().isEmpty()) jdbc.update("delete from teams where id in (:ids)", Map.of("ids", p.teamsRemoved()));
        if (!p.playersRemoved().isEmpty()) jdbc.update("delete from players where id in (:ids)", Map.of("ids", p.playersRemoved()));

        // Kanal uchun navbatdagi xabarlar va tarix yozuvlari ham qolmasin
        jdbc.update("delete from outbox_events where position(:s in payload) > 0", Map.of("s", seasonId.toString()));
        for (UUID m : matchIds) jdbc.update("delete from outbox_events where position(:m in payload) > 0", Map.of("m", m.toString()));
        jdbc.update("delete from audit_logs where entity_id in (:ids)", Map.of("ids", historyIds));

        audit.record("Mavsum", "«" + name + "»" + (test ? " sinov mavsumi" : "") + " butunlay o‘chirildi: "
                + p.teamsRemoved().size() + " ta jamoa, " + p.playersRemoved().size() + " ta futbolchi, " + p.matches() + " ta o‘yin", "SEASON", null);
        removeMediaAfterCommit(media);
        log.info("Mavsum o'chirildi: {} (sinov: {}), jamoa {}, futbolchi {}, o'yin {}", name, test, p.teamsRemoved().size(), p.playersRemoved().size(), p.matches());
        return new SeasonDeleted(name, p.teamsRemoved().size(), p.playersRemoved().size(), p.matches());
    }

    private Plan plan(Season s) {
        Map<String, Object> sid = Map.of("s", s.getId());
        List<UUID> seasonTeams = jdbc.queryForList("select id from season_teams where season_id = :s", sid, UUID.class);
        // Boshqa mavsumda ham qatnashgan jamoa saqlanadi — faqat shu mavsumnikilar o'chadi
        List<UUID> teamsRemoved = jdbc.queryForList("""
                select distinct st.team_id from season_teams st
                where st.season_id = :s
                  and not exists (select 1 from season_teams o where o.team_id = st.team_id and o.season_id <> :s)
                """, sid, UUID.class);
        Integer players = jdbc.queryForObject("select count(distinct player_id) from season_rosters where season_id = :s", sid, Integer.class);
        // Futbolchi boshqa mavsumda biror joyda uchrasa (tarkib, gol, tarkibda chiqish, mukofot, ramziy jamoa, sardor) — saqlanadi
        List<UUID> playersRemoved = jdbc.queryForList("""
                select distinct r.player_id from season_rosters r
                where r.season_id = :s
                  and not exists (select 1 from season_rosters o where o.player_id = r.player_id and o.season_id <> :s)
                  and not exists (select 1 from match_events e join matches m on m.id = e.match_id
                                  where m.season_id <> :s and (e.player_id = r.player_id or e.assist_id = r.player_id))
                  and not exists (select 1 from match_appearances a join matches m on m.id = a.match_id
                                  where m.season_id <> :s and a.player_id = r.player_id)
                  and not exists (select 1 from season_awards w where w.season_id <> :s and w.player_id = r.player_id)
                  and not exists (select 1 from round_team_players rp join round_teams t on t.id = rp.round_team_id
                                  where t.season_id <> :s and rp.player_id = r.player_id)
                  and not exists (select 1 from season_teams c where c.season_id <> :s and c.captain_id = r.player_id)
                """, sid, UUID.class);
        Integer matches = jdbc.queryForObject("select count(*) from matches where season_id = :s", sid, Integer.class);
        Integer results = jdbc.queryForObject("select count(*) from matches where season_id = :s and status in ('FINISHED', 'LIVE')", sid, Integer.class);
        String problem = null;
        if (!s.test && s.status == SeasonStatus.FINISHED) {
            problem = "«" + s.name + "» yakunlangan va arxivda saqlanadi — uni o‘chirib bo‘lmaydi.";
        } else if (!s.test && results != null && results > 0) {
            problem = "«" + s.name + "» haqiqiy mavsum va unda o‘yin natijalari bor — uni o‘chirib bo‘lmaydi. Butunlay faqat sinov mavsumi o‘chiriladi.";
        }
        return new Plan(problem, seasonTeams, teamsRemoved, players == null ? 0 : players, playersRemoved, matches == null ? 0 : matches, results == null ? 0 : results);
    }

    /** Rasm fayllari o'chirish muvaffaqiyatli tugagandan keyingina o'chiriladi (boshqa joyda ishlatilmagan bo'lsa) */
    private void removeMediaAfterCommit(List<String> urls) {
        if (urls.isEmpty()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                for (String url : urls) {
                    Matcher m = MEDIA.matcher(url);
                    if (!m.matches()) continue;
                    Integer used = jdbc.queryForObject("""
                            select (select count(*) from teams where logo_url = :u) + (select count(*) from players where photo_url = :u)
                                 + (select count(*) from sponsors where logo_url = :u)
                            """, Map.of("u", url), Integer.class);
                    if (used != null && used > 0) continue;
                    Path file = mediaDir.resolve(m.group(1)).normalize();
                    if (!file.startsWith(mediaDir)) continue;
                    try {
                        Files.deleteIfExists(file);
                    } catch (IOException e) {
                        log.warn("Rasm faylini o'chirib bo'lmadi: {}", file.getFileName(), e);
                    }
                }
            }
        });
    }
}
