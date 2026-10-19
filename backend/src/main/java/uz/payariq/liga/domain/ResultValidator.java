package uz.payariq.liga.domain;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import uz.payariq.liga.model.Match;

/**
 * Natijani saqlashdan oldin tekshiradi: hisob, gol mualliflari, holat va
 * pley-off qoidalari bir-biriga mos bo'lishi shart. Xabarlar frontend bilan bir xil.
 */
public final class ResultValidator {

    public static final int FORFEIT_SCORE = 3;

    private ResultValidator() {
    }

    public record ResultEvent(EventType type, UUID seasonTeamId, UUID playerId, UUID assistId, Integer minute) {
    }

    public record AppearanceInput(UUID seasonTeamId, UUID playerId) {
    }

    public record ResultInput(
            MatchStatus status,
            Integer homeScore,
            Integer awayScore,
            Integer homeExtra,
            Integer awayExtra,
            Integer homePens,
            Integer awayPens,
            /* Texnik mag'lubiyat berilgan tomon: "home" yoki "away" */
            String forfeitLoser,
            Integer liveMinute,
            List<ResultEvent> events,
            List<AppearanceInput> appearances) {

        public List<ResultEvent> safeEvents() {
            return events == null ? List.of() : events;
        }
    }

    public record ValidationResult(List<String> errors, List<String> warnings) {
        public boolean ok() {
            return errors.isEmpty();
        }
    }

    public record Outcome(Integer homeScore, Integer awayScore, DecidedBy decidedBy, UUID winnerId) {
    }

    public record GoalCount(int home, int away) {
    }

    public static GoalCount goalsFromEvents(List<ResultEvent> events, UUID homeId, UUID awayId) {
        int home = 0;
        int away = 0;
        for (ResultEvent e : events) {
            if (e.type() == null) continue;
            if (e.type().isScoredGoal()) {
                if (homeId.equals(e.seasonTeamId())) home++;
                else if (awayId.equals(e.seasonTeamId())) away++;
            } else if (e.type() == EventType.OWN_GOAL) {
                if (homeId.equals(e.seasonTeamId())) away++;
                else if (awayId.equals(e.seasonTeamId())) home++;
            }
        }
        return new GoalCount(home, away);
    }

    private static boolean validScore(Integer v) {
        return v != null && v >= 0 && v <= 50;
    }

    public static ValidationResult validate(
            Match match,
            ResultInput input,
            Function<UUID, Set<UUID>> rosterOf,
            Function<UUID, String> teamName) {
        Set<String> errors = new LinkedHashSet<>();
        List<String> warnings = new ArrayList<>();
        UUID homeId = match.homeId;
        UUID awayId = match.awayId;

        if (input.status() == null) {
            errors.add("O‘yin holatini tanlang.");
            return new ValidationResult(List.copyOf(errors), warnings);
        }
        if (homeId == null || awayId == null) {
            errors.add("O‘yin jamoalari hali aniqlanmagan. Avval ikkala jamoani belgilang.");
            return new ValidationResult(List.copyOf(errors), warnings);
        }

        boolean playable = input.status() == MatchStatus.LIVE || input.status() == MatchStatus.FINISHED;
        if (!playable) {
            if (!input.safeEvents().isEmpty() || input.homeScore() != null || input.awayScore() != null) {
                errors.add("Bu holatdagi o‘yinga hisob, gol yoki kartochka kiritib bo‘lmaydi. Holatni «Davom etmoqda» yoki «Yakunlangan» qiling.");
            }
            return new ValidationResult(List.copyOf(errors), warnings);
        }

        if (input.forfeitLoser() != null) {
            if (!input.forfeitLoser().equals("home") && !input.forfeitLoser().equals("away")) {
                errors.add("Texnik mag‘lubiyat berilgan jamoani tanlang.");
            }
            if (input.status() != MatchStatus.FINISHED) errors.add("Texnik mag‘lubiyat faqat yakunlangan o‘yinga beriladi.");
            return new ValidationResult(List.copyOf(errors), warnings);
        }

        if (!validScore(input.homeScore()) || !validScore(input.awayScore())) {
            errors.add("Ikkala jamoa uchun hisobni 0 dan 50 gacha butun son bilan kiriting.");
            return new ValidationResult(List.copyOf(errors), warnings);
        }

        boolean isPlayoff = match.stage == MatchStage.PLAYOFF;
        boolean hasExtra = input.homeExtra() != null || input.awayExtra() != null;
        boolean hasPens = input.homePens() != null || input.awayPens() != null;

        if (!isPlayoff && (hasExtra || hasPens)) errors.add("Guruh bosqichida qo‘shimcha vaqt va penaltilar bo‘lmaydi.");

        int homeTotal = input.homeScore() + (input.homeExtra() == null ? 0 : input.homeExtra());
        int awayTotal = input.awayScore() + (input.awayExtra() == null ? 0 : input.awayExtra());

        if (isPlayoff && input.status() == MatchStatus.FINISHED) {
            if (input.homeScore().equals(input.awayScore())) {
                if (!hasExtra) {
                    errors.add("Pley-off o‘yini durang tugadi. Qo‘shimcha vaqt natijasini kiriting (gol bo‘lmasa 0 : 0).");
                } else if (!validScore(input.homeExtra()) || !validScore(input.awayExtra())) {
                    errors.add("Qo‘shimcha vaqt gollarini ikkala jamoa uchun kiriting.");
                } else if (homeTotal == awayTotal) {
                    if (!hasPens || !validScore(input.homePens()) || !validScore(input.awayPens())) {
                        errors.add("Qo‘shimcha vaqtdan keyin ham durang. Penaltilar seriyasi natijasini kiriting.");
                    } else if (input.homePens().equals(input.awayPens())) {
                        errors.add("Penaltilar seriyasida g‘olib bo‘lishi kerak — hisob teng bo‘lmasin.");
                    }
                } else if (hasPens) {
                    errors.add("Qo‘shimcha vaqtda g‘olib aniqlangan, penaltilar kerak emas.");
                }
            } else if (hasExtra || hasPens) {
                errors.add("Asosiy vaqtda g‘olib aniqlangan. Qo‘shimcha vaqt va penaltilarni bo‘sh qoldiring.");
            }
        }

        GoalCount fromEvents = goalsFromEvents(input.safeEvents(), homeId, awayId);
        if (fromEvents.home() != homeTotal) {
            errors.add(teamName.apply(homeId) + ": hisobda " + homeTotal + " ta gol, kiritilgan gollar esa " + fromEvents.home() + " ta. Gol mualliflarini tekshiring.");
        }
        if (fromEvents.away() != awayTotal) {
            errors.add(teamName.apply(awayId) + ": hisobda " + awayTotal + " ta gol, kiritilgan gollar esa " + fromEvents.away() + " ta. Gol mualliflarini tekshiring.");
        }

        Map<UUID, Integer> reds = new HashMap<>();
        Map<UUID, Integer> yellows = new HashMap<>();
        int unknownScorers = 0;
        for (ResultEvent e : input.safeEvents()) {
            if (e.type() == null) {
                errors.add("Hodisa turini tanlang.");
                continue;
            }
            if (!homeId.equals(e.seasonTeamId()) && !awayId.equals(e.seasonTeamId())) {
                errors.add("Hodisa ushbu o‘yinda qatnashmayotgan jamoaga biriktirilgan.");
                continue;
            }
            Set<UUID> roster = rosterOf.apply(e.seasonTeamId());
            if (e.playerId() != null && !roster.contains(e.playerId())) {
                errors.add("Tanlangan futbolchi " + teamName.apply(e.seasonTeamId()) + " tarkibida yo‘q.");
            }
            if (e.playerId() == null) {
                if (e.type().isScoredGoal() || e.type() == EventType.OWN_GOAL) unknownScorers++;
                else errors.add("Kartochka uchun futbolchini tanlang.");
            }
            if (e.assistId() != null) {
                if (!roster.contains(e.assistId())) errors.add("Assist bergan futbolchi gol urgan jamoa tarkibida bo‘lishi kerak.");
                if (e.assistId().equals(e.playerId())) errors.add("Futbolchi o‘z goliga assist bera olmaydi.");
            }
            if (e.minute() != null && (e.minute() < 1 || e.minute() > 130)) errors.add("Daqiqa 1 dan 130 gacha bo‘lishi kerak.");
            if (e.playerId() != null && (e.type() == EventType.RED || e.type() == EventType.SECOND_YELLOW)) reds.merge(e.playerId(), 1, Integer::sum);
            if (e.playerId() != null && e.type() == EventType.YELLOW) yellows.merge(e.playerId(), 1, Integer::sum);
        }
        if (reds.values().stream().anyMatch(c -> c > 1)) errors.add("Bitta futbolchiga bir o‘yinda bittadan ortiq qizil kartochka berib bo‘lmaydi.");
        if (yellows.values().stream().anyMatch(c -> c > 1)) errors.add("Ikkinchi sariq kartochka uchun «Ikkinchi sariq» turini tanlang.");

        if (input.appearances() != null) {
            for (AppearanceInput a : input.appearances()) {
                if (!homeId.equals(a.seasonTeamId()) && !awayId.equals(a.seasonTeamId())) {
                    errors.add("O‘yinda qatnashganlar ro‘yxatida boshqa jamoa futbolchisi bor.");
                } else if (!rosterOf.apply(a.seasonTeamId()).contains(a.playerId())) {
                    errors.add("O‘yinda qatnashganlar ro‘yxatidagi futbolchi jamoa tarkibida yo‘q.");
                }
            }
        }

        if (unknownScorers > 0) warnings.add(unknownScorers + " ta gol muallifi ko‘rsatilmagan. Ular to‘purarlar reytingiga kirmaydi.");
        return new ValidationResult(List.copyOf(errors), warnings);
    }

    /** Saqlanadigan yakuniy natijani aniqlaydi (g'olib va qanday hal bo'lgani) */
    public static Outcome deriveOutcome(Match match, ResultInput input) {
        UUID homeId = match.homeId;
        UUID awayId = match.awayId;
        if (input.status() != MatchStatus.FINISHED || homeId == null || awayId == null) {
            boolean live = input.status() == MatchStatus.LIVE;
            return new Outcome(live ? input.homeScore() : null, live ? input.awayScore() : null, null, null);
        }
        if (input.forfeitLoser() != null) {
            boolean homeLost = input.forfeitLoser().equals("home");
            return new Outcome(homeLost ? 0 : FORFEIT_SCORE, homeLost ? FORFEIT_SCORE : 0, DecidedBy.FORFEIT, homeLost ? awayId : homeId);
        }
        int hs = input.homeScore() == null ? 0 : input.homeScore();
        int as = input.awayScore() == null ? 0 : input.awayScore();
        if (hs != as) return new Outcome(hs, as, DecidedBy.REGULAR, hs > as ? homeId : awayId);
        if (match.stage != MatchStage.PLAYOFF) return new Outcome(hs, as, DecidedBy.REGULAR, null);
        int he = hs + (input.homeExtra() == null ? 0 : input.homeExtra());
        int ae = as + (input.awayExtra() == null ? 0 : input.awayExtra());
        if (he != ae) return new Outcome(hs, as, DecidedBy.EXTRA_TIME, he > ae ? homeId : awayId);
        int hp = input.homePens() == null ? 0 : input.homePens();
        int ap = input.awayPens() == null ? 0 : input.awayPens();
        return new Outcome(hs, as, DecidedBy.PENALTIES, hp > ap ? homeId : awayId);
    }
}
