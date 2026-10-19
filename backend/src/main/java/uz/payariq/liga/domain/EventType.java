package uz.payariq.liga.domain;

public enum EventType {
    GOAL, PENALTY_GOAL, OWN_GOAL, YELLOW, SECOND_YELLOW, RED;

    /** Gol muallifining shaxsiy hisobiga yoziladigan gol (avtogol emas) */
    public boolean isScoredGoal() {
        return this == GOAL || this == PENALTY_GOAL;
    }

    public boolean isCard() {
        return this == YELLOW || this == SECOND_YELLOW || this == RED;
    }

    /** Fair Play ballari: sariq — 1, ikkinchi sariq va qizil — 3 */
    public int fairPlayPoints() {
        return switch (this) {
            case YELLOW -> 1;
            case SECOND_YELLOW, RED -> 3;
            default -> 0;
        };
    }
}
