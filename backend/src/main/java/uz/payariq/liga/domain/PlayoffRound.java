package uz.payariq.liga.domain;

public enum PlayoffRound {
    R64("1/32 final"),
    R32("1/16 final"),
    R16("1/8 final"),
    QF("Chorak final"),
    SF("Yarim final"),
    THIRD("3-o‘rin uchun o‘yin"),
    F("Final");

    private final String label;

    PlayoffRound(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
