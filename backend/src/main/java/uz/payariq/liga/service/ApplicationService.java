package uz.payariq.liga.service;

import static uz.payariq.liga.domain.TeamNames.clean;
import static uz.payariq.liga.domain.TeamNames.key;

import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import uz.payariq.liga.common.ApiException;
import uz.payariq.liga.domain.ApplicationStatus;
import uz.payariq.liga.domain.FeedbackStatus;
import uz.payariq.liga.domain.Position;
import uz.payariq.liga.domain.SeasonStatus;
import uz.payariq.liga.domain.TeamNames;
import uz.payariq.liga.model.ApplicationPlayer;
import uz.payariq.liga.model.FeedbackMessage;
import uz.payariq.liga.model.Match;
import uz.payariq.liga.model.Player;
import uz.payariq.liga.model.RosterEntry;
import uz.payariq.liga.model.Season;
import uz.payariq.liga.model.SeasonTeam;
import uz.payariq.liga.model.Team;
import uz.payariq.liga.model.TeamApplication;
import uz.payariq.liga.repo.FeedbackMessageRepository;
import uz.payariq.liga.repo.LeagueGroupRepository;
import uz.payariq.liga.repo.MatchRepository;
import uz.payariq.liga.repo.PlayerRepository;
import uz.payariq.liga.repo.RosterEntryRepository;
import uz.payariq.liga.repo.SeasonRepository;
import uz.payariq.liga.repo.SeasonTeamRepository;
import uz.payariq.liga.repo.TeamApplicationRepository;
import uz.payariq.liga.repo.TeamRepository;
import uz.payariq.liga.security.CurrentUser;
import uz.payariq.liga.web.Dto.AcceptedApplication;
import uz.payariq.liga.web.Dto.ApplicationCounts;
import uz.payariq.liga.web.Dto.FeedbackDto;
import uz.payariq.liga.web.Dto.TeamApplicationDto;
import uz.payariq.liga.web.Dto.TeamDto;
import uz.payariq.liga.web.Requests;

/**
 * Saytdan keladigan murojaatlar: yangi mavsumga qo'shilish arizalari hamda taklif, shikoyat va murojaatlar.
 * Ariza qabul qilinsa, jamoa (yangi yoki shu nomli mavjud jamoa) futbolchilari bilan avtomatik ravishda yangi mavsumga qo'shiladi.
 */
@Service
@Transactional
public class ApplicationService {

    /** Arizadagi futbolchilar soni — liga talabi */
    public static final int TEAM_SIZE = 10;
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9\\s()-]{7,20}$");
    /** Yangi jamoa ranglari (admin keyin «Jamoalar» bo'limida o'zgartirishi mumkin) — admin formasidagi bilan bir xil */
    private static final String PRIMARY = "#145A3A";
    private static final String SECONDARY = "#E2BF4F";

    private final TeamApplicationRepository applications;
    private final FeedbackMessageRepository messages;
    private final TeamRepository teams;
    private final SeasonTeamRepository seasonTeams;
    private final PlayerRepository players;
    private final RosterEntryRepository rosters;
    private final SeasonRepository seasons;
    private final LeagueGroupRepository groups;
    private final MatchRepository matches;
    private final TeamPlayerService teamPlayers;
    private final MediaStorage media;
    private final SubmissionLimiter limiter;
    private final AuditService audit;
    private final CurrentUser currentUser;
    private final Clock clock;
    private final int teamLimit;
    private final int feedbackLimit;

    public ApplicationService(TeamApplicationRepository applications, FeedbackMessageRepository messages, TeamRepository teams,
                              SeasonTeamRepository seasonTeams, PlayerRepository players, RosterEntryRepository rosters, SeasonRepository seasons,
                              LeagueGroupRepository groups, MatchRepository matches, TeamPlayerService teamPlayers, MediaStorage media, SubmissionLimiter limiter,
                              AuditService audit, CurrentUser currentUser, Clock clock,
                              @Value("${liga.applications.max-per-hour:5}") int teamLimit,
                              @Value("${liga.feedback.max-per-hour:10}") int feedbackLimit) {
        this.applications = applications;
        this.messages = messages;
        this.teams = teams;
        this.seasonTeams = seasonTeams;
        this.players = players;
        this.rosters = rosters;
        this.seasons = seasons;
        this.groups = groups;
        this.matches = matches;
        this.teamPlayers = teamPlayers;
        this.media = media;
        this.limiter = limiter;
        this.audit = audit;
        this.currentUser = currentUser;
        this.clock = clock;
        this.teamLimit = teamLimit;
        this.feedbackLimit = feedbackLimit;
    }

    // ---------- Saytdan ----------

    public void submitTeam(Requests.TeamApplicationInput in, MultipartFile logo, String ip) {
        if (in == null) throw ApiException.badRequest("Ariza ma’lumotlari yuborilmadi.");
        // Bot to'ldirgan ko'rinmas maydon: ariza saqlanmaydi, bot esa «yuborildi» deb o'ylaydi
        if (!clean(in.website()).isEmpty()) return;
        String name = clean(in.teamName());
        if (name.length() < 2 || name.length() > 40) throw ApiException.badRequest("Jamoa nomini kiriting (2–40 ta belgi).");
        String village = clean(in.village());
        if (village.length() > 60) throw ApiException.badRequest("Qishloq yoki mahalla nomi juda uzun (60 ta belgigacha).");
        String phone = phone(in.contactPhone());
        List<ApplicationPlayer> list = players(in.players());
        if (logo == null || logo.isEmpty()) throw ApiException.badRequest("Jamoa logotipini yuklang.");
        requireNameFree(name);
        limiter.acquire("team", ip, teamLimit);
        String url = media.store(logo);
        try {
            TeamApplication a = new TeamApplication();
            a.teamName = name;
            a.village = village.isEmpty() ? null : village;
            a.contactPhone = phone;
            a.logoUrl = url;
            a.players.addAll(list);
            applications.saveAndFlush(a);
        } catch (RuntimeException e) {
            media.delete(url);
            throw e;
        }
    }

    public void submitFeedback(Requests.FeedbackInput in, String ip) {
        if (in == null) throw ApiException.badRequest("Murojaat matni yuborilmadi.");
        if (!clean(in.website()).isEmpty()) return;
        if (in.kind() == null) throw ApiException.badRequest("Murojaat turini tanlang: taklif, shikoyat yoki murojaat.");
        String body = in.body() == null ? "" : in.body().replace("\r\n", "\n").trim();
        if (body.length() < 10) throw ApiException.badRequest("Murojaat matnini yozing (kamida 10 ta belgi).");
        if (body.length() > 2000) throw ApiException.badRequest("Matn juda uzun — 2000 ta belgidan oshmasin.");
        String name = clean(in.authorName());
        if (name.length() > 60) throw ApiException.badRequest("Ism juda uzun (60 ta belgigacha).");
        String phone = phone(in.phone());
        limiter.acquire("feedback", ip, feedbackLimit);
        FeedbackMessage m = new FeedbackMessage();
        m.kind = in.kind();
        m.body = body;
        m.authorName = name.isEmpty() ? null : name;
        m.phone = phone;
        messages.save(m);
    }

    // ---------- Admin: jamoa arizalari ----------

    @Transactional(readOnly = true)
    public ApplicationCounts counts() {
        return new ApplicationCounts(applications.countByStatus(ApplicationStatus.NEW), messages.countByStatus(FeedbackStatus.NEW));
    }

    @Transactional(readOnly = true)
    public List<TeamApplicationDto> listTeams() {
        Map<UUID, String> seasonNames = seasons.findAll().stream().collect(Collectors.toMap(Season::getId, s -> s.name));
        Set<String> teamNames = teams.findAll().stream().map(t -> key(t.name)).collect(Collectors.toSet());
        return applications.findAllByOrderByCreatedAtDesc().stream()
                .map(a -> TeamApplicationDto.of(a, a.seasonId == null ? null : seasonNames.get(a.seasonId),
                        a.status != ApplicationStatus.ACCEPTED && teamNames.contains(key(a.teamName))))
                .toList();
    }

    /**
     * Arizani qabul qiladi: jamoa «Jamoalar» ro'yxatiga qo'shiladi (shu nomli jamoa bo'lsa — o'sha jamoa) va avtomatik
     * ravishda yangi mavsum ishtirokchisi bo'ladi; arizadagi futbolchilar mavsum tarkibiga yoziladi. Jamoaning oldingi
     * mavsumlarida o'ynagan futbolchi ism-familiyasi bo'yicha taniladi — yangi yozuv ochilmaydi, statistikasi davom etadi.
     */
    public AcceptedApplication accept(UUID id) {
        TeamApplication a = application(id);
        if (a.status == ApplicationStatus.ACCEPTED) throw ApiException.conflict("Bu ariza allaqachon qabul qilingan.");
        Season season = upcomingSeason();
        UUID seasonId = season.getId();
        Team team = findTeam(a.teamName).orElse(null);
        boolean existing = team != null;
        // Bir mavsumda bir xil nomli ikkita jamoa bo'lmaydi: jamoa allaqachon ishtirokchi bo'lsa, ariza qayta qabul qilinmaydi
        if (existing && seasonTeams.findBySeasonIdAndTeamId(seasonId, team.getId()).isPresent()) {
            throw ApiException.conflict("«" + team.name + "» jamoasi " + season.name + "da allaqachon ishtirok etadi — ariza takroran qabul qilinmaydi. "
                    + "Bu takroriy ariza bo‘lsa, uni e’tiborsiz qoldiring.");
        }
        if (team == null) {
            TeamDto created = teamPlayers.createTeam(new Requests.TeamInput(a.teamName, shortName(a.teamName), a.village == null ? "" : a.village,
                    PRIMARY, SECONDARY, null, a.logoUrl), seasonId);
            team = teams.findById(created.id()).orElseThrow();
        } else {
            teamPlayers.setInSeason(team.getId(), seasonId, true);
            // Ariza shartiga ko'ra jamoa mavsumda arizadagi logotip bilan ishtirok etadi
            team.logoUrl = a.logoUrl;
            if ((team.village == null || team.village.isBlank()) && a.village != null) team.village = a.village;
        }
        SeasonTeam st = seasonTeams.findBySeasonIdAndTeamId(seasonId, team.getId())
                .orElseThrow(() -> ApiException.conflict("Jamoani mavsumga qo‘shib bo‘lmadi. Sahifani yangilab, qayta urinib ko‘ring."));

        Map<String, UUID> known = existing ? formerPlayers(team.getId(), st.getId()) : Map.of();
        Set<String> inRoster = new HashSet<>();
        for (RosterEntry r : rosters.findBySeasonTeamId(st.getId())) players.findById(r.playerId).ifPresent(p -> inRoster.add(key(p.fullName())));
        List<Player> squad = new ArrayList<>();
        int returning = 0;
        for (ApplicationPlayer ap : a.players) {
            String k = key(ap.fullName());
            // Admin tarkibga oldinroq qo'shgan futbolchi takrorlanmaydi
            if (!inRoster.add(k)) continue;
            Player p = Optional.ofNullable(known.get(k)).flatMap(players::findById)
                    // Shu mavsumda boshqa jamoa tarkibida turgan bo'lsa — bu boshqa odam deb hisoblanadi
                    .filter(x -> rosters.findBySeasonIdAndPlayerId(seasonId, x.getId()).isEmpty())
                    .orElse(null);
            if (p == null) {
                p = new Player();
                p.firstName = ap.firstName;
                p.lastName = ap.lastName;
                p.birthYear = ap.birthYear;
                p.position = ap.position;
                players.save(p);
            } else {
                returning++;
                p.position = ap.position;
                if (ap.birthYear != null) p.birthYear = ap.birthYear;
            }
            squad.add(p);
        }
        // Futbolchilar avval bazaga yoziladi: tarkib yozuvi ularga bog'langan (Hibernate qo'shishlarni tur bo'yicha guruhlaydi)
        players.flush();
        for (Player p : squad) {
            RosterEntry entry = new RosterEntry();
            entry.seasonId = seasonId;
            entry.seasonTeamId = st.getId();
            entry.playerId = p.getId();
            rosters.save(entry);
        }
        int added = squad.size();

        a.status = ApplicationStatus.ACCEPTED;
        a.seasonId = seasonId;
        a.teamId = team.getId();
        a.decidedAt = clock.instant();
        a.decidedBy = currentUser.displayName();
        audit.record("Ariza", "«" + team.name + "» arizasi qabul qilindi: jamoa " + season.name + "ga qo‘shildi, tarkibga " + added + " ta futbolchi yozildi",
                "TEAM", team.getId());
        return new AcceptedApplication(team.name, season.name, added, returning, existing);
    }

    public void ignore(UUID id) {
        TeamApplication a = application(id);
        if (a.status == ApplicationStatus.ACCEPTED) {
            throw ApiException.conflict("Qabul qilingan arizani e’tiborsiz qoldirib bo‘lmaydi — jamoa allaqachon mavsumga qo‘shilgan.");
        }
        if (a.status == ApplicationStatus.IGNORED) return;
        a.status = ApplicationStatus.IGNORED;
        a.decidedAt = clock.instant();
        a.decidedBy = currentUser.displayName();
        audit.record("Ariza", "«" + a.teamName + "» arizasi e’tiborsiz qoldirildi", "TEAM_APPLICATION", id);
    }

    /** E'tiborsiz qoldirilgan arizani yana ko'rib chiqiladiganlar qatoriga qaytaradi */
    public void restore(UUID id) {
        TeamApplication a = application(id);
        if (a.status != ApplicationStatus.IGNORED) return;
        a.status = ApplicationStatus.NEW;
        a.decidedAt = null;
        a.decidedBy = null;
        audit.record("Ariza", "«" + a.teamName + "» arizasi qayta ko‘rib chiqishga qaytarildi", "TEAM_APPLICATION", id);
    }

    public void deleteApplication(UUID id) {
        TeamApplication a = application(id);
        String logo = a.logoUrl;
        applications.delete(a);
        // Qabul qilingan arizaning logotipi jamoada ishlatiladi — u o'chirilmaydi
        if (teams.findAll().stream().noneMatch(t -> logo.equals(t.logoUrl))) afterCommit(() -> media.delete(logo));
        audit.record("Ariza", "«" + a.teamName + "» arizasi o‘chirildi", "TEAM_APPLICATION", id);
    }

    // ---------- Admin: taklif va shikoyatlar ----------

    @Transactional(readOnly = true)
    public List<FeedbackDto> listMessages() {
        return messages.findAllByOrderByCreatedAtDesc().stream().map(FeedbackDto::of).toList();
    }

    public void markRead(UUID id) {
        message(id).status = FeedbackStatus.READ;
    }

    public void markAllRead() {
        for (FeedbackMessage m : messages.findAll()) m.status = FeedbackStatus.READ;
    }

    public void deleteMessage(UUID id) {
        messages.delete(message(id));
        audit.record("Murojaat", "Saytdan kelgan murojaat o‘chirildi", "FEEDBACK", id);
    }

    // ---------- Yordamchilar ----------

    private TeamApplication application(UUID id) {
        return applications.findById(id).orElseThrow(() -> ApiException.notFound("Ariza topilmadi. Sahifani yangilang."));
    }

    private FeedbackMessage message(UUID id) {
        return messages.findById(id).orElseThrow(() -> ApiException.notFound("Murojaat topilmadi. Sahifani yangilang."));
    }

    /**
     * Ariza qabul qilinadigan yangi mavsum: eng so'nggi ochilgan, hali tayyorlanayotgan haqiqiy (sinov emas) mavsum.
     * Qur'asi tashlangan yoki o'yini o'tkazilgan mavsum boshlangan hisoblanadi — unga jamoa qo'shilmaydi.
     */
    private Season upcomingSeason() {
        Season s = seasons.findAllByOrderByYearDescNumberDesc().stream().filter(x -> x.status == SeasonStatus.DRAFT && !x.test).findFirst()
                .orElseThrow(() -> ApiException.conflict("Yangi mavsum hali ochilmagan. Avval «Mavsumlar» bo‘limida yangi mavsum oching — ariza o‘sha mavsumga qabul qilinadi."));
        boolean started = !groups.findBySeasonIdOrderBySortOrderAsc(s.getId()).isEmpty()
                || matches.findBySeasonIdOrderByKickoffAsc(s.getId()).stream().anyMatch(Match::hasResult);
        if (started) {
            throw ApiException.conflict("«" + s.name + "» boshlangan (qur’a tashlangan yoki o‘yinlar o‘tkazilgan) — unga jamoa qo‘shib bo‘lmaydi. "
                    + "Avval «Mavsumlar» bo‘limida yangi mavsum oching.");
        }
        return s;
    }

    private Optional<Team> findTeam(String name) {
        return teams.findAll().stream().filter(t -> TeamNames.same(t.name, name)).findFirst();
    }

    /**
     * Bir xil nomli jamoa ikki marta ro'yxatga tushmasin: shu nomli ariza hali ko'rib chiqilmagan bo'lsa yoki shu nomli
     * jamoa ro'yxatdan o'tish davom etayotgan mavsum (yakunlanmagan, qur'asi hali tashlanmagan) ishtirokchisi bo'lsa,
     * ariza qabul qilinmaydi. Qur'asi tashlangan joriy mavsum jamoalari keyingi mavsumga bemalol ariza beradi.
     */
    private void requireNameFree(String name) {
        if (applications.findByStatus(ApplicationStatus.NEW).stream().anyMatch(x -> TeamNames.same(x.teamName, name))) {
            throw ApiException.conflict("«" + name + "» nomli jamoa arizasi allaqachon yuborilgan va ko‘rib chiqilmoqda. Qayta yuborish shart emas.");
        }
        boolean registered = seasons.findAll().stream()
                .filter(s -> !s.isFinished() && !s.test && groups.findBySeasonIdOrderBySortOrderAsc(s.getId()).isEmpty())
                .flatMap(s -> seasonTeams.findBySeasonId(s.getId()).stream())
                .anyMatch(st -> TeamNames.same(st.name, name));
        if (registered) {
            throw ApiException.conflict("«" + name + "» nomli jamoa yangi mavsumga allaqachon ro‘yxatdan o‘tgan. Agar bu boshqa jamoa bo‘lsa, boshqa nom tanlang.");
        }
    }

    /** Jamoaning boshqa mavsumlardagi futbolchilari: ism-familiya → futbolchi (bir xil ismli ikki kishi bo'lsa — tanilmaydi) */
    private Map<String, UUID> formerPlayers(UUID teamId, UUID currentSeasonTeamId) {
        Map<String, UUID> known = new HashMap<>();
        Set<String> ambiguous = new HashSet<>();
        for (SeasonTeam other : seasonTeams.findByTeamId(teamId)) {
            if (other.getId().equals(currentSeasonTeamId)) continue;
            for (RosterEntry r : rosters.findBySeasonTeamId(other.getId())) {
                players.findById(r.playerId).ifPresent(p -> {
                    UUID prev = known.putIfAbsent(key(p.fullName()), p.getId());
                    if (prev != null && !prev.equals(p.getId())) ambiguous.add(key(p.fullName()));
                });
            }
        }
        ambiguous.forEach(known::remove);
        return known;
    }

    private static List<ApplicationPlayer> players(List<Requests.ApplicationPlayerInput> rows) {
        if (rows == null || rows.size() != TEAM_SIZE) throw ApiException.badRequest("Arizada " + TEAM_SIZE + " ta futbolchi bo‘lishi kerak.");
        Set<String> names = new HashSet<>();
        List<ApplicationPlayer> list = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            Requests.ApplicationPlayerInput r = rows.get(i);
            String row = (i + 1) + "-futbolchi: ";
            if (r == null) throw ApiException.badRequest(row + "ma’lumotlarini to‘ldiring.");
            String first = clean(r.firstName());
            String last = clean(r.lastName());
            if (first.length() < 2 || first.length() > 40) throw ApiException.badRequest(row + "ismini kiriting (2–40 ta belgi).");
            if (last.length() < 2 || last.length() > 40) throw ApiException.badRequest(row + "familiyasini kiriting (2–40 ta belgi).");
            if (r.position() == null) throw ApiException.badRequest(row + "pozitsiyasini tanlang.");
            if (r.birthYear() != null && (r.birthYear() < 1950 || r.birthYear() > 2020)) {
                throw ApiException.badRequest(row + "tug‘ilgan yilni to‘g‘ri kiriting (1950–2020) yoki bo‘sh qoldiring.");
            }
            if (!names.add(key(first + " " + last))) throw ApiException.badRequest(row + first + " " + last + " ro‘yxatda ikki marta yozilgan.");
            list.add(new ApplicationPlayer(first, last, r.birthYear(), r.position()));
        }
        if (list.stream().noneMatch(p -> p.position == Position.GK)) throw ApiException.badRequest("Kamida bitta futbolchini darvozabon deb belgilang.");
        return list;
    }

    private static String phone(String raw) {
        String phone = clean(raw);
        if (phone.isEmpty()) return null;
        if (!PHONE.matcher(phone).matches()) throw ApiException.badRequest("Telefon raqamini +998 90 123 45 67 ko‘rinishida kiriting yoki bo‘sh qoldiring.");
        return phone;
    }

    /** Jadvallar uchun qisqa nom: nomdagi dastlabki 3 ta harf (masalan «Burgut» → BUR) */
    static String shortName(String name) {
        String letters = name.codePoints().filter(Character::isLetter)
                .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append).toString();
        if (letters.codePointCount(0, letters.length()) < 2) return "JAM";
        int end = letters.offsetByCodePoints(0, Math.min(3, letters.codePointCount(0, letters.length())));
        return letters.substring(0, end).toUpperCase(Locale.ROOT);
    }

    private static void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
    }
}
