package uz.payariq.liga.model;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import uz.payariq.liga.common.BaseEntity;
import uz.payariq.liga.domain.SeasonStatus;
import uz.payariq.liga.domain.Tiebreaker;

/** Mavsum va uning nizomi (ochkolar, teng ochko mezonlari, format) */
@Entity
@Table(name = "seasons")
public class Season extends BaseEntity {
    public int number;
    public String name;
    public int year;
    public LocalDate startDate;
    public LocalDate endDate;
    @Enumerated(EnumType.STRING)
    public SeasonStatus status = SeasonStatus.DRAFT;
    /** Sinov mavsumi: saytda ko'rinmaydi, keyin butunlay o'chiriladi */
    public boolean test;
    public int pointsWin = 3;
    public int pointsDraw = 1;
    public int pointsLoss = 0;
    /** Teng ochko mezonlari tartib bilan, vergul bilan ajratilgan */
    public String tiebreakers = "H2H_POINTS,H2H_GOAL_DIFF,H2H_GOALS,GOAL_DIFF,GOALS_FOR,FAIR_PLAY";
    public int legs = 1;
    public int qualifiersPerGroup = 2;
    /** Guruh hajmi bo'yicha chiqadiganlar: "4:2,5:3" — 4 jamoali guruhdan 2 ta, 5 jamoalidan 3 ta */
    public String qualifiersBySize = "3:2,4:2,5:3,6:3";
    public boolean thirdPlaceMatch = true;
    /** Bir bo'lim davomiyligi, daqiqa (jonli o'yin soati uchun) */
    public int halfMinutes = 20;

    public List<Tiebreaker> tiebreakerList() {
        if (tiebreakers == null || tiebreakers.isBlank()) return List.of();
        return Arrays.stream(tiebreakers.split(",")).map(String::trim).map(Tiebreaker::valueOf).toList();
    }

    public void setTiebreakerList(List<Tiebreaker> list) {
        tiebreakers = list.stream().map(Enum::name).collect(Collectors.joining(","));
    }

    public Map<Integer, Integer> qualifiersBySizeMap() {
        Map<Integer, Integer> map = new TreeMap<>();
        if (qualifiersBySize == null || qualifiersBySize.isBlank()) return map;
        for (String part : qualifiersBySize.split(",")) {
            String[] kv = part.trim().split(":");
            if (kv.length == 2) map.put(Integer.parseInt(kv[0].trim()), Integer.parseInt(kv[1].trim()));
        }
        return map;
    }

    public void setQualifiersBySizeMap(Map<Integer, Integer> map) {
        qualifiersBySize = new TreeMap<>(map).entrySet().stream().map(e -> e.getKey() + ":" + e.getValue()).collect(Collectors.joining(","));
    }

    /** Shu hajmdagi guruhdan pley-offga chiqadigan jamoalar soni (guruhdagi jamoalardan kam) */
    public int qualifiersFor(int groupSize) {
        int q = qualifiersBySizeMap().getOrDefault(groupSize, qualifiersPerGroup);
        return Math.max(1, Math.min(q, groupSize - 1));
    }

    public boolean isFinished() {
        return status == SeasonStatus.FINISHED;
    }
}
