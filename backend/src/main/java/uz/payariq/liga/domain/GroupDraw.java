package uz.payariq.liga.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/** Qur'a: guruhlarni muvozanatli tuzish va tekshirish */
public final class GroupDraw {

    public static final String LETTERS = "ABCDEFGHIJKLMNOP";

    private GroupDraw() {
    }

    public record DrawGroup(String name, List<UUID> teamIds) {
    }

    public record DrawCheck(boolean ok, List<String> errors, List<String> warnings) {
    }

    /** Guruhlar hajmi imkon qadar teng: farq ko'pi bilan 1 ta jamoa */
    public static List<Integer> groupSizes(int teamCount, int groupCount) {
        List<Integer> sizes = new ArrayList<>();
        if (groupCount <= 0) return sizes;
        int base = teamCount / groupCount;
        int extra = teamCount % groupCount;
        for (int i = 0; i < groupCount; i++) sizes.add(base + (i < extra ? 1 : 0));
        return sizes;
    }

    public static List<DrawGroup> randomDraw(List<UUID> teamIds, int groupCount, Random random) {
        List<UUID> unique = new ArrayList<>(new LinkedHashSet<>(teamIds));
        List<Integer> sizes = groupSizes(unique.size(), groupCount);
        Collections.shuffle(unique, random);
        List<DrawGroup> groups = new ArrayList<>();
        for (int i = 0; i < groupCount; i++) groups.add(new DrawGroup(String.valueOf(LETTERS.charAt(i)), new ArrayList<>()));
        int index = 0;
        while (index < unique.size()) {
            for (int g = 0; g < groupCount && index < unique.size(); g++) {
                if (groups.get(g).teamIds().size() < sizes.get(g)) groups.get(g).teamIds().add(unique.get(index++));
            }
        }
        return groups;
    }

    /** Qo'lda yoki tasodifiy tuzilgan guruhlarni tasdiqlashdan oldin tekshiradi */
    public static DrawCheck check(List<DrawGroup> groups, List<UUID> allTeamIds) {
        LinkedHashSet<String> errors = new LinkedHashSet<>();
        List<String> warnings = new ArrayList<>();
        Map<UUID, String> seen = new HashMap<>();
        LinkedHashSet<String> names = new LinkedHashSet<>();
        for (DrawGroup g : groups) {
            if (g.name() == null || g.name().isBlank() || g.name().length() > 4) errors.add("Guruh nomi 1–4 belgidan iborat bo‘lsin.");
            if (!names.add(g.name())) errors.add("Guruh nomlari takrorlanmasin.");
            for (UUID id : g.teamIds()) {
                if (seen.containsKey(id)) errors.add("Bitta jamoa ikki guruhga tushgan (" + seen.get(id) + " va " + g.name() + ").");
                seen.put(id, g.name());
                if (!allTeamIds.contains(id)) errors.add("Guruhda bu mavsumda ishtirok etmaydigan jamoa bor.");
            }
        }
        long missing = allTeamIds.stream().filter(id -> !seen.containsKey(id)).count();
        if (missing > 0) errors.add(missing + " ta jamoa hali guruhga taqsimlanmagan.");
        if (groups.isEmpty()) errors.add("Kamida bitta guruh tuzing.");
        if (groups.stream().anyMatch(g -> g.teamIds().size() < 2)) errors.add("Har bir guruhda kamida 2 ta jamoa bo‘lishi kerak.");
        if (!groups.isEmpty()) {
            int max = groups.stream().mapToInt(g -> g.teamIds().size()).max().orElse(0);
            int min = groups.stream().mapToInt(g -> g.teamIds().size()).min().orElse(0);
            if (max - min > 1) warnings.add("Guruhlardagi jamoalar soni bir-biridan 1 tadan ko‘proq farq qiladi.");
        }
        return new DrawCheck(errors.isEmpty(), List.copyOf(errors), warnings);
    }
}
