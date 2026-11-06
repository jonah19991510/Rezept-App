import { describe, expect, it } from "vitest";
import {
  canJoin,
  challengePhase,
  challengeStats,
  currentRoundFor,
  globalLeaderboard,
  participationIn,
  progressInRound,
  roundAt,
  roundIndexOn,
  roundLabel,
  roundsUntil,
  goalLabel,
  monthRange,
  participantProgress,
  progressLabel,
  rankBoard,
  requiredPeriods,
  ruleLines,
  ruleSummary,
  type ChallengeRules,
  withPlaceBonus,
  type DayValues,
  extraRuleList,
} from "./challenges";
import { addDays } from "./week";

// 2026-11-02 ist ein Montag
const START = "2026-11-02";

const rules = (patch: Partial<ChallengeRules> = {}): ChallengeRules => ({
  metric: "check",
  source: "manual",
  unit: null,
  dailyTarget: null,
  totalTarget: null,
  frequency: "daily",
  daysPerWeek: null,
  durationDays: 10,
  startMode: "fixed",
  startsOn: START,
  lateJoinDays: 0,
  missedRule: "relaxed",
  jokers: 0,
  minPeriods: null,
  backfillDays: 1,
  period: "days",
  repeats: false,
  ...patch,
});

/** Erfüllte Tage als Versatz ab dem Start */
const checked = (...offsets: number[]): DayValues => new Map(offsets.map((o) => [addDays(START, o), 1]));
const day = (n: number) => addDays(START, n);

describe("participantProgress: täglich abhaken", () => {
  it("zählt erfüllte Tage, lässt heute und gestern offen", () => {
    const p = participantProgress(rules(), START, checked(0, 1, 2), day(4));
    expect(p.dayNumber).toBe(5);
    expect(p.metPeriods).toBe(3);
    // Tag 3 ist vorgestern → verpasst, Tag 4 (heute) offen; Locker: kein Joker
    expect(p.days.slice(0, 6).map((d) => d.state)).toEqual(["met", "met", "met", "open", "open", "future"]);
    expect(p.status).toBe("active");
  });

  it("verpasst erst, wenn sich der Tag nicht mehr nachtragen lässt", () => {
    const p = participantProgress(rules({ backfillDays: 0 }), START, checked(0), day(2));
    expect(p.days.slice(0, 3).map((d) => d.state)).toEqual(["met", "missed", "open"]);
    expect(p.missedPeriods).toBe(1);
  });

  it("Streng: Joker retten, danach scheidet man aus und bekommt keine Punkte mehr", () => {
    const r = rules({ missedRule: "strict", jokers: 1, backfillDays: 0 });
    // Tag 1 verpasst (Joker), Tag 3 verpasst (raus), Tag 4 trotzdem abgehakt
    const p = participantProgress(r, START, checked(0, 2, 4), day(5));
    expect(p.days.slice(0, 5).map((d) => d.state)).toEqual(["met", "joker", "met", "missed", "met"]);
    expect(p.jokersUsed).toBe(1);
    expect(p.jokersLeft).toBe(0);
    expect(p.status).toBe("failed");
    expect(p.failedOn).toBe(day(3));
    expect(p.points.days).toBe(20);
    expect(p.reachable).toBe(false);
  });

  it("Serie zählt: Serie reißt ohne Joker, man bleibt dabei", () => {
    const r = rules({ missedRule: "streak", jokers: 0, backfillDays: 0 });
    const p = participantProgress(r, START, checked(0, 1, 3, 4), day(4));
    expect(p.status).toBe("active");
    expect(p.streak).toBe(2);
    expect(p.bestStreak).toBe(2);
  });

  it("Serienbonus je 7 Tage am Stück, Joker halten die Serie", () => {
    const r = rules({ missedRule: "streak", jokers: 1, durationDays: 14, backfillDays: 0 });
    const all = checked(0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13);
    const p = participantProgress(r, START, all, day(13));
    expect(p.jokersUsed).toBe(1);
    expect(p.streak).toBe(14);
    expect(p.points).toEqual({ days: 130, streak: 40, completion: 50, place: 0, total: 220 });
    expect(p.status).toBe("completed");
    expect(p.completedOn).toBe(day(13));
  });

  it("Locker: kein Serienbonus, geschafft ab „mindestens X von Y“ schon vor dem Ende", () => {
    const r = rules({ minPeriods: 3 });
    const p = participantProgress(r, START, checked(0, 1, 2, 3, 4, 5, 6), day(6));
    expect(p.points.streak).toBe(0);
    expect(p.completedOn).toBe(day(2));
    expect(p.status).toBe("completed");
    expect(p.points.total).toBe(70 + 50);
  });

  it("nach dem Ende ohne genug Tage: nicht geschafft", () => {
    const p = participantProgress(rules({ durationDays: 3 }), START, checked(0), day(10));
    expect(p.status).toBe("ended");
    expect(p.reachable).toBe(false);
  });

  it("vor dem Start: kommt noch", () => {
    const p = participantProgress(rules(), START, new Map(), day(-2));
    expect(p.status).toBe("upcoming");
    expect(p.dayNumber).toBe(0);
    expect(p.days.every((d) => d.state === "future")).toBe(true);
  });
});

describe("participantProgress: Mengen", () => {
  it("Menge pro Tag: unter dem Ziel ist „teilweise“, endgültig dann verpasst", () => {
    const r = rules({ metric: "daily", dailyTarget: 50, unit: "Liegestütze", backfillDays: 1 });
    const values = new Map([
      [day(0), 50],
      [day(1), 30],
      [day(2), 20],
    ]);
    const p = participantProgress(r, START, values, day(2));
    expect(p.days.slice(0, 3).map((d) => d.state)).toEqual(["met", "partial", "partial"]);
    const later = participantProgress(r, START, values, day(3));
    expect(later.days[1]).toEqual({ date: day(1), state: "missed", value: 30 });
    expect(p.sum).toBe(100);
    expect(p.metPeriods).toBe(1);
  });

  it("Gesamtmenge: Punkte nach Anteil, geschafft am Tag, an dem das Ziel erreicht ist", () => {
    const r = rules({ metric: "total", totalTarget: 100, unit: "km" });
    const half = participantProgress(r, START, new Map([[day(0), 50]]), day(3));
    expect(half.points.total).toBe(50);
    expect(half.status).toBe("active");
    const done = participantProgress(r, START, new Map([[day(0), 60], [day(2), 45]]), day(3));
    expect(done.completedOn).toBe(day(2));
    expect(done.points).toEqual({ days: 100, streak: 0, completion: 50, place: 0, total: 150 });
    expect(progressLabel(r, done)).toBe("105 von 100 km");
  });
});

describe("participantProgress: x Tage pro Woche", () => {
  const r = rules({ frequency: "weekly", daysPerWeek: 3, durationDays: 21, missedRule: "streak", jokers: 1, backfillDays: 0 });

  it("Woche erfüllt ab x Tagen, Punkte höchstens x je Woche, Bonus je Woche in Serie", () => {
    // Woche 1: 4 Tage (zählt 3), Woche 2: 1 Tag (Joker), Woche 3 läuft
    const p = participantProgress(r, START, checked(0, 1, 2, 3, 8), day(15));
    expect(p.periods.map((x) => x.state)).toEqual(["met", "joker", "open"]);
    expect(p.points.days).toBe(40);
    expect(p.points.streak).toBe(40);
    // Leere Tage einer Woche sind nicht einzeln „verpasst“
    expect(p.days[4].state).toBe("empty");
  });

  it("nötige Wochen", () => {
    expect(requiredPeriods(r)).toBe(3);
    expect(requiredPeriods({ ...r, minPeriods: 2 })).toBe(2);
    expect(requiredPeriods({ ...r, missedRule: "strict", minPeriods: 2 })).toBe(3);
  });
});

describe("Phase und Einstieg", () => {
  it("fester Start", () => {
    expect(challengePhase(rules(), day(-3))).toEqual({ kind: "upcoming", startsOn: START, daysUntil: 3 });
    expect(challengePhase(rules(), day(4))).toMatchObject({ kind: "running", day: 5, of: 10 });
    expect(challengePhase(rules(), day(10))).toMatchObject({ kind: "over", endedOn: day(9) });
    expect(canJoin(rules(), START)).toBe(true);
    expect(canJoin(rules(), day(1))).toBe(false);
    expect(canJoin(rules({ lateJoinDays: 2 }), day(2))).toBe(true);
  });

  it("Start ab Beitritt ist immer offen", () => {
    const r = rules({ startMode: "join", startsOn: null });
    expect(challengePhase(r, day(50)).kind).toBe("open");
    expect(canJoin(r, day(50))).toBe(true);
  });
});

describe("Rangliste und Statistik", () => {
  const r = rules({ missedRule: "strict", backfillDays: 0 });
  const row = (userId: string, values: DayValues, joinedAt = "2026-11-01T10:00:00Z") => ({
    userId,
    name: userId,
    isMe: userId === "a",
    joinedAt,
    progress: participantProgress(r, START, values, day(3)),
  });

  it("nach Punkten, Ausgeschiedene unten, Gleichstand = gleicher Platz", () => {
    const board = rankBoard(r, [row("a", checked(0, 1, 2, 3)), row("b", checked(0)), row("c", checked(0, 1, 2, 3)), row("d", checked(0, 1, 2))]);
    expect(board.map((x) => [x.userId, x.rank])).toEqual([
      ["a", 1],
      ["c", 1],
      ["d", 3],
      ["b", 4],
    ]);
    expect(board[3].progress.status).toBe("failed");
  });

  it("Statistik: Status, heute, Tagesquote", () => {
    const board = [row("a", checked(0, 1, 2, 3)), row("b", checked(0))];
    const stats = challengeStats(r, board, day(3));
    expect(stats.participants).toBe(2);
    expect(stats.byStatus.failed).toBe(1);
    expect(stats.today).toEqual({ met: 1, due: 2 });
    expect(stats.rates.map((x) => x.met)).toEqual([2, 1, 1, 1]);
  });
});

describe("Texte", () => {
  it("Ziel und Kurzfassung", () => {
    expect(ruleSummary(rules({ metric: "daily", dailyTarget: 50, unit: "Liegestütze", durationDays: 30 }))).toBe("Jeden Tag 50 Liegestütze · 30 Tage");
    expect(goalLabel(rules({ source: "workouts", frequency: "weekly", daysPerWeek: 3, durationDays: 28 }))).toBe("An 3 Tagen pro Woche trainieren");
    expect(goalLabel(rules({ metric: "total", totalTarget: 1000, unit: "Liegestütze" }))).toBe("Insgesamt 1.000 Liegestütze");
    expect(ruleSummary(rules({ frequency: "weekly", daysPerWeek: 2, durationDays: 28 }))).toBe("An 2 Tagen pro Woche abhaken · 4 Wochen");
  });

  it("Regel-Karte", () => {
    const lines = ruleLines(rules({ missedRule: "strict", jokers: 2, durationDays: 30 }));
    expect(lines.map((l) => l.key)).toEqual(["goal", "time", "missed", "done", "backfill", "points"]);
    expect(lines[1].text).toContain("Start am Mo, 2.11. für alle");
    expect(lines[2].text).toBe("Streng: 2 Joker (2 Tage ohne Folgen). Wer danach noch einen Tag verpasst, scheidet aus.");
    expect(lines[3].text).toBe("Wenn alle 30 Tage erfüllt sind (Joker zählen mit).");
    const relaxed = ruleLines(rules({ minPeriods: 25, durationDays: 30, startMode: "join", startsOn: null }));
    expect(relaxed.find((l) => l.key === "missed")?.text).toBe("Locker: Verpasste Tage sind kein Problem, sie zählen einfach nicht.");
    expect(relaxed.find((l) => l.key === "done")?.text).toBe("Mit mindestens 25 von 30 Tagen.");
    expect(relaxed.find((l) => l.key === "points")?.text).toBe("10 je erfülltem Tag, +50 fürs Schaffen.");
  });
});

describe("Punkte mit Datum und Gesamtrangliste", () => {
  it("Punkte-Log ergibt die Summe, „pro Woche“ zählt nur die ersten x Tage", () => {
    const r = rules({ missedRule: "streak", durationDays: 14, backfillDays: 0 });
    const p = participantProgress(r, START, checked(0, 1, 2, 3, 4, 5, 6, 7), day(9));
    expect(p.pointLog.reduce((s, [, n]) => s + n, 0)).toBe(p.points.total);
    // Serienbonus am 7. Tag
    expect(p.pointLog.filter(([d]) => d === day(6))).toEqual([[day(6), 10], [day(6), 20]]);
    const w = rules({ frequency: "weekly", daysPerWeek: 2, durationDays: 7, missedRule: "relaxed", backfillDays: 0 });
    const pw = participantProgress(w, START, checked(0, 2, 4), day(6));
    expect(pw.pointLog).toEqual([[day(0), 10], [day(2), 10], [day(2), 50]]);
  });

  it("Gesamtmenge: Punkte je Tag nach Zuwachs", () => {
    const r = rules({ metric: "total", totalTarget: 100, unit: "km" });
    const p = participantProgress(r, START, new Map([[day(0), 30], [day(1), 80]]), day(2));
    expect(p.pointLog).toEqual([[day(0), 30], [day(1), 70], [day(1), 50]]);
  });

  it("Monat und Rangliste", () => {
    expect(monthRange("2026-02-14")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    const r = rules({ durationDays: 10 });
    const p = (values: DayValues) => participantProgress(r, START, values, day(9));
    const rows = globalLeaderboard(
      [
        { challengeId: "c1", userId: "a", name: "Anna", hidden: false, progress: p(checked(0, 1)) },
        { challengeId: "c2", userId: "a", name: "Anna", hidden: false, progress: p(checked(0)) },
        { challengeId: "c1", userId: "b", name: "Ben", hidden: false, progress: p(checked(0, 1, 2)) },
        { challengeId: "c1", userId: "c", name: "Clara", hidden: true, progress: p(checked(0, 1, 2, 3)) },
        { challengeId: "c1", userId: "me", name: "Ich", hidden: true, progress: p(checked(0)) },
      ],
      "me",
      null,
    );
    expect(rows.map((x) => [x.userId, x.points, x.rank, x.challenges])).toEqual([
      ["a", 30, 1, 2],
      ["b", 30, 1, 1],
      ["me", 10, 3, 1],
    ]);
    // Nur Punkte vom 3.11. an
    const later = globalLeaderboard([{ challengeId: "c1", userId: "b", name: "Ben", hidden: false, progress: p(checked(0, 1, 2)) }], "x", { from: day(1), to: day(30) });
    expect(later[0].points).toBe(20);
  });
});

describe("Wettkampf „Wer schafft mehr?“", () => {
  const race = rules({ metric: "most", unit: "Liegestütze", durationDays: 3, missedRule: "relaxed" });
  const v = (...a: number[]) => new Map(a.map((n, i) => [day(i), n] as [string, number]).filter(([, n]) => n > 0));

  it("zählt Menge, Tage mit Eintrag und Punkte je Tag, ohne „geschafft“", () => {
    const p = participantProgress(race, START, v(10, 0, 25), day(2));
    expect(p.sum).toBe(35);
    expect(p.bestDay).toBe(25);
    expect(p.metDays).toBe(2);
    expect(p.points.total).toBe(20);
    expect(p.status).toBe("active");
    expect(p.completedOn).toBeNull();
    expect(participantProgress(race, START, v(10), day(5)).status).toBe("finished");
  });

  it("Rangliste nach Menge: 20 vor 10", () => {
    const row = (userId: string, values: DayValues) => ({ userId, name: userId, isMe: false, joinedAt: userId, progress: participantProgress(race, START, values, day(0)) });
    const board = rankBoard(race, [row("a", v(10)), row("b", v(20))]);
    expect(board.map((r) => [r.userId, r.rank])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("Platzbonus nach dem Ende, gleiche Menge = gleicher Platz, ohne Eintrag nichts", () => {
    const after = day(5);
    const ps = [v(30), v(20), v(20), v(5), v()].map((x) => participantProgress(race, START, x, after));
    const withBonus = withPlaceBonus(race, ps, after);
    expect(withBonus.map((p) => p.points.place)).toEqual([50, 30, 30, 0, 0]);
    expect(withBonus[0].pointLog.at(-1)).toEqual([day(2), 50]);
    // Läuft noch oder „ab Beitritt“: kein Bonus
    expect(withPlaceBonus(race, ps, day(2))[0].points.place).toBe(0);
    expect(withPlaceBonus({ ...race, startMode: "join" }, ps, after)[0].points.place).toBe(0);
  });

  it("Texte", () => {
    expect(goalLabel(race)).toBe("Wer schafft die meisten Liegestütze?");
    expect(goalLabel({ ...race, source: "workouts", unit: null })).toBe("Wer trainiert am häufigsten?");
    const lines = ruleLines(race);
    expect(lines.map((l) => l.key)).toEqual(["goal", "time", "done", "backfill", "points"]);
    expect(lines.find((l) => l.key === "points")?.text).toBe("10 je Tag mit Eintrag, am Ende +50 / +30 / +20 für Platz 1 bis 3.");
  });
});

describe("Runden: bis Monats-/Jahresende und Wiederholung", () => {
  // Start Mi, 18.11.2026
  const month = rules({ period: "month", startsOn: "2026-11-18", durationDays: 13, repeats: true });

  it("erste Runde bis Monatsende, danach ganze Monate", () => {
    expect(roundAt(month, 0)).toEqual({ index: 0, from: "2026-11-18", to: "2026-11-30", days: 13 });
    expect(roundAt(month, 1)).toEqual({ index: 1, from: "2026-12-01", to: "2026-12-31", days: 31 });
    expect(roundAt(month, 3)).toMatchObject({ from: "2027-02-01", to: "2027-02-28", days: 28 });
    expect(roundIndexOn(month, "2026-11-30")).toBe(0);
    expect(roundIndexOn(month, "2027-01-15")).toBe(2);
    expect(roundsUntil(month, "2027-01-15").map((r) => roundLabel(month, r))).toEqual(["November 2026", "Dezember 2026", "Januar 2027"]);
    // Ohne Wiederholung bleibt es bei einer Runde
    expect(roundIndexOn({ ...month, repeats: false }, "2027-01-15")).toBe(0);
  });

  it("bis Jahresende und Runden aus Tagen", () => {
    const year = rules({ period: "year", startsOn: "2026-11-18", repeats: true });
    expect(roundAt(year, 0)).toMatchObject({ from: "2026-11-18", to: "2026-12-31", days: 44 });
    expect(roundAt(year, 1)).toMatchObject({ from: "2027-01-01", to: "2027-12-31", days: 365 });
    const days = rules({ durationDays: 10, repeats: true });
    expect(roundAt(days, 2)).toMatchObject({ from: day(20), to: day(29) });
    expect(roundIndexOn(days, day(25))).toBe(2);
    expect(roundLabel(days, roundAt(days, 2))).toBe("Runde 3 (22.11.–1.12.)");
  });

  it("Phase, Einstieg und Texte", () => {
    expect(challengePhase(month, "2026-12-05")).toMatchObject({ kind: "running", day: 5, of: 31, round: 1, repeats: true });
    expect(challengePhase({ ...month, repeats: false }, "2026-12-05")).toEqual({ kind: "over", endedOn: "2026-11-30" });
    expect(canJoin(month, "2027-05-20")).toBe(true);
    expect(ruleSummary(month)).toBe("Jeden Tag abhaken · jeden Monat neu");
    expect(ruleLines(month).find((l) => l.key === "time")?.text).toContain("danach beginnt am 1. jedes Monats eine neue.");
  });

  it("Teilnahme je Runde: wer später einsteigt, zählt erst ab seiner Runde", () => {
    const r1 = roundAt(month, 1);
    expect(participationIn(month, "2026-11-18", r1)?.rules).toMatchObject({ startsOn: "2026-12-01", durationDays: 31, period: "days", repeats: false });
    expect(participationIn(month, "2027-01-01", r1)).toBeNull();
    expect(currentRoundFor(month, "2027-01-01", "2026-12-20").index).toBe(2);
    const people = [
      { id: "a", start: "2026-11-18" },
      { id: "b", start: "2026-12-01" },
    ];
    const values = new Map([["2026-11-20", 1]]);
    const nov = progressInRound(month, people, roundAt(month, 0), (p) => (p.id === "a" ? values : new Map()), "2026-12-10");
    expect(nov.map((x) => x.person.id)).toEqual(["a"]);
    expect(nov[0].progress).toMatchObject({ from: "2026-11-18", to: "2026-11-30", metDays: 1 });
    expect(progressInRound(month, people, roundAt(month, 1), () => new Map(), "2026-12-10")).toHaveLength(2);
  });
});

describe("extraRuleList", () => {
  it("macht aus dem Freitext eine Liste ohne Leerzeilen und Aufzählungszeichen", () => {
    expect(extraRuleList("Auch Kniestand zählt\r\n\n- Bis Mitternacht eintragen\n  • Ehrlich bleiben  ")).toEqual(["Auch Kniestand zählt", "Bis Mitternacht eintragen", "Ehrlich bleiben"]);
  });

  it("ist ohne Text leer und lässt Bindestriche im Satz stehen", () => {
    expect(extraRuleList(null)).toEqual([]);
    expect(extraRuleList("   \n ")).toEqual([]);
    expect(extraRuleList("Kniestand-Liegestütze zählen")).toEqual(["Kniestand-Liegestütze zählen"]);
  });
});
