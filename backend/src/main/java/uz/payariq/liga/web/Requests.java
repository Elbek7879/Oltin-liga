package uz.payariq.liga.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import uz.payariq.liga.domain.MatchStage;
import uz.payariq.liga.domain.MatchStatus;
import uz.payariq.liga.domain.NewsStatus;
import uz.payariq.liga.domain.PlayoffRound;
import uz.payariq.liga.domain.Position;
import uz.payariq.liga.domain.Role;
import uz.payariq.liga.domain.SponsorTier;
import uz.payariq.liga.domain.Tiebreaker;

/** So'rov modellari. Xato xabarlari server tomonida ham o'zbek tilida tekshiriladi. */
public final class Requests {

    private Requests() {
    }

    private static final String HEX = "^#[0-9a-fA-F]{6}$";
    /** Faqat o'zimiz yuklagan rasmlar: /media/<uuid>.<png|jpg|webp> */
    static final String MEDIA_URL = "^$|^/media/[0-9a-f-]{36}\\.(png|jpg|webp)$";

    public record Login(@NotBlank(message = "Loginni kiriting") String username, @NotBlank(message = "Parolni kiriting") String password) {
    }

    public record Rules(
            @Min(value = 0, message = "Ochko manfiy bo‘lmasin") @Max(value = 10, message = "Ochko juda katta") int pointsWin,
            @Min(value = 0, message = "Ochko manfiy bo‘lmasin") @Max(value = 10, message = "Ochko juda katta") int pointsDraw,
            @Min(value = 0, message = "Ochko manfiy bo‘lmasin") @Max(value = 10, message = "Ochko juda katta") int pointsLoss,
            @NotEmpty(message = "Kamida bitta teng ochko mezonini tanlang") List<@NotNull Tiebreaker> tiebreakers,
            @Min(value = 1, message = "Davralar soni 1 yoki 2") @Max(value = 2, message = "Davralar soni 1 yoki 2") int legs,
            @Min(value = 1, message = "Kamida 1 ta jamoa chiqadi") @Max(value = 8, message = "Ko‘pi bilan 8 ta jamoa") int qualifiersPerGroup,
            /** Guruh hajmi → chiqadiganlar: {4: 2, 5: 3}. Berilmasa o'zgarmaydi */
            Map<Integer, Integer> qualifiersBySize,
            boolean thirdPlaceMatch,
            /** Bir bo'lim davomiyligi; berilmasa o'zgarmaydi */
            @Min(value = 5, message = "Bo‘lim kamida 5 daqiqa") @Max(value = 60, message = "Bo‘lim ko‘pi bilan 60 daqiqa") Integer halfMinutes) {
    }

    public record SeasonCreate(
            @NotBlank(message = "Mavsum nomini kiriting") @Size(max = 60, message = "Nom juda uzun") String name,
            @Min(value = 2000, message = "Yil noto‘g‘ri") @Max(value = 2100, message = "Yil noto‘g‘ri") int year,
            @NotNull(message = "Boshlanish sanasini tanlang") LocalDate startDate,
            @NotNull(message = "Tugash sanasini tanlang") LocalDate endDate,
            @Valid Rules rules,
            UUID copyTeamsFromSeasonId,
            /** Sinov mavsumi — saytda ko'rinmaydi, keyin o'chiriladi. Ixtiyoriy: yuborilmasa — oddiy mavsum */
            Boolean test) {
        public boolean isTest() {
            return Boolean.TRUE.equals(test);
        }
    }

    /** Mavsumni o'chirish: xato bosilmasligi uchun mavsum nomi qayta yoziladi */
    public record SeasonDelete(@NotBlank(message = "Tasdiqlash uchun mavsum nomini yozing") @Size(max = 60) String name) {
    }

    public record TeamInput(
            @NotBlank(message = "Jamoa nomini kiriting") @Size(min = 2, max = 40, message = "Jamoa nomi 2–40 belgi bo‘lsin") String name,
            @NotBlank(message = "Qisqa nomni kiriting") @Pattern(regexp = "^[\\p{L}‘’ʻ']{2,4}$", message = "Qisqa nom 2–4 ta harfdan iborat bo‘lsin, masalan NAV") String shortName,
            @NotBlank(message = "Qishloq nomini kiriting") @Size(max = 60, message = "Qishloq nomi juda uzun") String village,
            @NotNull @Pattern(regexp = HEX, message = "Rang #RRGGBB ko‘rinishida bo‘lsin") String primaryColor,
            @NotNull @Pattern(regexp = HEX, message = "Rang #RRGGBB ko‘rinishida bo‘lsin") String secondaryColor,
            @Min(value = 1900, message = "Tashkil topgan yil noto‘g‘ri") @Max(value = 2100, message = "Tashkil topgan yil noto‘g‘ri") Integer founded,
            @Pattern(regexp = MEDIA_URL, message = "Logotip avval «Rasm yuklash» orqali yuklanishi kerak") String logoUrl) {
    }

    public record TeamInSeason(boolean inSeason) {
    }

    public record PlayerInput(
            @NotBlank(message = "Futbolchi ismini kiriting") @Size(min = 2, max = 40, message = "Ism 2–40 belgi bo‘lsin") String firstName,
            @NotBlank(message = "Futbolchi familiyasini kiriting") @Size(min = 2, max = 40, message = "Familiya 2–40 belgi bo‘lsin") String lastName,
            @Min(value = 1950, message = "Tug‘ilgan yilni to‘g‘ri kiriting") @Max(value = 2020, message = "Tug‘ilgan yilni to‘g‘ri kiriting") Integer birthYear,
            /** Ixtiyoriy: tezkor kiritishda ko'rsatilmasligi mumkin */
            Position position,
            @Pattern(regexp = "^$|^\\+?[0-9\\s()-]{7,20}$", message = "Telefon raqamini +998 90 123 45 67 ko‘rinishida kiriting") String phone,
            UUID seasonTeamId,
            @Min(value = 1, message = "Raqam 1 dan 99 gacha bo‘lsin") @Max(value = 99, message = "Raqam 1 dan 99 gacha bo‘lsin") Integer number) {
    }

    public record GroupInput(@NotBlank(message = "Guruh nomini kiriting") String name, @NotNull List<@NotNull UUID> teamIds) {
    }

    public record RoundTeamSlotInput(@NotBlank(message = "O‘rinni tanlang") String slot, @NotNull(message = "Futbolchini tanlang") UUID playerId) {
    }

    /** Ramziy jamoa: publish=false — qoralama, true — saytda e'lon qilinadi (5 o'rin ham to'lishi kerak) */
    public record RoundTeamInput(
            @NotNull(message = "Bosqichni tanlang") MatchStage stage,
            Integer round,
            PlayoffRound playoffRound,
            @NotNull @Size(max = 5, message = "Ramziy jamoada 5 ta o‘rin bor") List<@Valid RoundTeamSlotInput> slots,
            boolean publish) {
    }

    public record PlayerPhoto(@Size(max = 200) String photoUrl) {
    }

    public record SaveGroups(@NotEmpty(message = "Kamida bitta guruh tuzing") List<@Valid GroupInput> groups) {
    }

    public record MatchInput(
            @NotNull(message = "Bosqichni tanlang") MatchStage stage,
            UUID groupId,
            @Min(value = 1, message = "Tur raqami 1 dan katta bo‘lsin") @Max(value = 99, message = "Tur raqami juda katta") Integer round,
            PlayoffRound playoffRound,
            UUID homeId,
            UUID awayId,
            @NotNull(message = "O‘yin sanasi va vaqtini kiriting") OffsetDateTime kickoff,
            UUID venueId,
            @NotNull(message = "O‘yin holatini tanlang") MatchStatus status,
            @Size(max = 80, message = "Hakam ismi juda uzun") String referee,
            @Size(max = 300, message = "Izoh 300 belgidan oshmasin") String note) {
    }

    public record CreatePlayoff(
            boolean thirdPlace,
            @NotNull(message = "Birinchi bosqich sanasini tanlang") LocalDate startDate,
            UUID venueId) {
    }

    public record NewsInput(
            @NotBlank(message = "Sarlavhani kiriting") @Size(min = 5, max = 120, message = "Sarlavha 5–120 belgi bo‘lsin") String title,
            @NotBlank(message = "Qisqa tavsifni kiriting") @Size(max = 240, message = "Qisqa tavsif 240 belgidan oshmasin") String excerpt,
            @NotBlank(message = "Yangilik matnini kiriting") @Size(max = 20000, message = "Matn juda uzun") String body,
            boolean important,
            @NotNull NewsStatus status) {
    }

    public record SponsorInput(
            @NotBlank(message = "Homiy nomini kiriting") @Size(max = 80, message = "Nom juda uzun") String name,
            @NotNull(message = "Darajasini tanlang") SponsorTier tier,
            @Size(max = 120, message = "Tavsif 120 belgidan oshmasin") String description,
            @Pattern(regexp = "^$|^https?://\\S+\\.\\S+$", message = "Havola https:// bilan boshlanadigan to‘liq manzil bo‘lsin") String url,
            @Pattern(regexp = MEDIA_URL, message = "Logotip avval «Rasm yuklash» orqali yuklanishi kerak") String logoUrl,
            boolean active,
            @Min(0) @Max(999) int order) {
    }

    public record AdjustmentInput(
            @NotNull(message = "Jamoani tanlang") UUID seasonTeamId,
            @Min(value = -50, message = "Ochko -50 dan 50 gacha") @Max(value = 50, message = "Ochko -50 dan 50 gacha") int points,
            @NotBlank(message = "Sababini yozing") @Size(min = 5, max = 200, message = "Sababini 5–200 belgi bilan yozing") String reason) {
    }

    public record SettingsInput(
            @NotBlank(message = "Liga nomini kiriting") @Size(max = 80) String name,
            @NotBlank @Size(max = 40) String shortName,
            @Size(max = 120) String region,
            @Size(max = 4000) String about,
            @Pattern(regexp = "^$|^\\+?[0-9\\s()-]{7,20}$", message = "Telefon raqamini to‘g‘ri kiriting") String contactPhone,
            @Pattern(regexp = "^$|^@?[A-Za-z0-9_]{4,32}$", message = "Telegram nomini @kanal ko‘rinishida kiriting") String telegram,
            @Size(max = 200) String telegramChannel,
            @Size(max = 200) String instagram,
            @Size(max = 200) String youtube) {
    }

    public record VenueInput(@NotBlank(message = "Maydon nomini kiriting") @Size(max = 80) String name, @Size(max = 60) String village) {
    }

    public record UserCreate(
            @NotBlank(message = "Loginni kiriting")
            @Pattern(regexp = "^[A-Za-z0-9._-]{3,40}$", message = "Login 3–40 ta lotin harfi, raqam yoki . _ - belgilaridan iborat bo‘lsin") String username,
            @NotBlank(message = "Ismini kiriting") @Size(max = 80, message = "Ism 80 belgidan oshmasin") String displayName,
            @NotNull(message = "Rolni tanlang") Role role,
            @NotBlank(message = "Parolni kiriting") String password) {
    }

    public record UserUpdate(
            @NotBlank(message = "Ismini kiriting") @Size(max = 80, message = "Ism 80 belgidan oshmasin") String displayName,
            @NotNull(message = "Rolni tanlang") Role role,
            boolean enabled) {
    }

    public record PasswordReset(@NotBlank(message = "Yangi parolni kiriting") String password) {
    }

    public record PasswordChange(@NotBlank(message = "Joriy parolni kiriting") String currentPassword,
                                 @NotBlank(message = "Yangi parolni kiriting") String newPassword) {
    }

    /** O'yin sanasi, vaqti va maydoni */
    public record MatchSchedule(@NotNull(message = "Sana va vaqtni kiriting") OffsetDateTime kickoff, UUID venueId) {
    }

    /** Teng holat uchun qur'a: scope — "GROUP:<guruh id>" yoki "SEED:<o'rin>" */
    public record LotInput(
            @NotBlank @Pattern(regexp = "^(GROUP:[0-9a-f-]{36}|SEED:\\d{1,2})$", message = "Qur’a turi noto‘g‘ri") String scope,
            @NotEmpty(message = "Jamoalarni tanlang") List<@NotNull UUID> seasonTeamIds,
            boolean random) {
    }

    /** Ro'yxatdagi bitta futbolchi (jamoa tarkibiga birdaniga qo'shish uchun) */
    public record PlayerRow(
            @NotBlank(message = "Ismini kiriting") @Size(min = 2, max = 40, message = "Ism 2–40 belgi bo‘lsin") String firstName,
            @NotBlank(message = "Familiyasini kiriting") @Size(min = 2, max = 40, message = "Familiya 2–40 belgi bo‘lsin") String lastName,
            @Min(value = 1, message = "Raqam 1 dan 99 gacha bo‘lsin") @Max(value = 99, message = "Raqam 1 dan 99 gacha bo‘lsin") Integer number,
            Position position,
            @Min(value = 1950, message = "Tug‘ilgan yilni to‘g‘ri kiriting") @Max(value = 2020, message = "Tug‘ilgan yilni to‘g‘ri kiriting") Integer birthYear) {
    }

    public record PlayersBulk(
            @NotNull(message = "Jamoani tanlang") UUID seasonTeamId,
            @NotEmpty(message = "Kamida bitta futbolchi kiriting") @Size(max = 60, message = "Bir martada ko‘pi bilan 60 ta futbolchi") List<@Valid PlayerRow> players) {
    }
}
