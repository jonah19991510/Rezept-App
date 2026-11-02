import { describe, expect, it } from "vitest";
import {
  checkIndex,
  dayRates,
  daySummary,
  daytimeOfTime,
  formatDuration,
  frequencyLabel,
  habitPeriodStats,
  habitStreak,
  isDueOn,
  nextCount,
  periodKpis,
  periodProgress,
  scheduleLabel,
  scheduleSummary,
  sortSchedule,
  todayGroups,
  weekdayRates,
  type Habit,
  type HabitCheck,
  type ScheduleEntry,
} from "./habits";

// 2026-11-02 ist ein Montag
const habit = (patch: Partial<Habit> = {}): Habit => ({
  id: "h1",
  name: "Kreatin",
  kind: "supplement",
  frequency: "daily",
  target: 1,
  weekdays: [],
  daytime: null,
  atTime: null,
  dose: "5 g",
  notes: null,
  color: "blau",
  position: 0,
  startDate: "2026-10-01",
  pausedOn: null,
  ...patch,
});

const checks = (habitId: string, dates: string[], count = 1): HabitCheck[] => dates.map((date) => ({ habitId, date, count }));

describe("Beschriftungen", () => {
  it("nennt Rhythmus, Wochentage und Ziel", () => {
    expect(frequencyLabel(habit())).toBe("Täglich");
    expect(frequencyLabel(habit({ target: 2 }))).toBe("2× täglich");
    expect(frequencyLabel(habit({ weekdays: [5, 1, 3] }))).toBe("Mo, Mi, Fr");
    expect(frequencyLabel(habit({ weekdays: [1, 2, 3, 4, 5, 6, 7] }))).toBe("Täglich");
    expect(frequencyLabel(habit({ frequency: "weekly", target: 3 }))).toBe("3× pro Woche");
    expect(frequencyLabel(habit({ frequency: "weekly" }))).toBe("Wöchentlich");
    expect(frequencyLabel(habit({ frequency: "monthly", target: 2 }))).toBe("2× pro Monat");
    expect(scheduleLabel(habit({ daytime: "morgens", atTime: "07:30" }))).toBe("Täglich · Morgens · 07:30");
  });

  it("ordnet Uhrzeiten einer Tageszeit zu", () => {
    expect(daytimeOfTime("07:30")).toBe("morgens");
    expect(daytimeOfTime("12:00")).toBe("mittags");
    expect(daytimeOfTime("16:15")).toBe("nachmittags");
    expect(daytimeOfTime("20:00")).toBe("abends");
    expect(daytimeOfTime("23:30")).toBe("nachts");
    expect(daytimeOfTime("02:00")).toBe("nachts");
  });
});

describe("fällig und Fortschritt", () => {
  it("beachtet Wochentage, Beginn und Pause", () => {
    const h = habit({ weekdays: [1, 3], startDate: "2026-11-02", pausedOn: "2026-11-09" });
    expect(isDueOn(h, "2026-11-01")).toBe(false); // vor dem Anlegen
    expect(isDueOn(h, "2026-11-02")).toBe(true); // Mo
    expect(isDueOn(h, "2026-11-03")).toBe(false); // Di
    expect(isDueOn(h, "2026-11-04")).toBe(true); // Mi
    expect(isDueOn(h, "2026-11-09")).toBe(false); // pausiert
  });

  it("zählt wöchentliche im Zeitraum Mo–So zusammen", () => {
    const h = habit({ frequency: "weekly", target: 3 });
    const index = checkIndex(checks("h1", ["2026-11-01", "2026-11-02", "2026-11-04"]));
    expect(periodProgress(h, index, "2026-11-05")).toEqual({ done: 2, target: 3, met: false });
  });

  it("zählt beim Antippen hoch und setzt zurück", () => {
    expect(nextCount(0, 2, "daily")).toBe(1);
    expect(nextCount(1, 2, "daily")).toBe(2);
    expect(nextCount(2, 2, "daily")).toBe(0);
    expect(nextCount(0, 3, "weekly")).toBe(1);
    expect(nextCount(1, 3, "weekly")).toBe(0);
  });

  it("gruppiert Heute nach Tageszeit, dann Woche und Monat", () => {
    const list = [
      habit({ id: "a", daytime: "abends", position: 2 }),
      habit({ id: "b", daytime: "morgens", position: 1 }),
      habit({ id: "c", position: 3 }),
      habit({ id: "d", frequency: "weekly", position: 0 }),
      habit({ id: "e", weekdays: [2], position: 4 }), // dienstags, heute nicht dran
      habit({ id: "f", frequency: "monthly", position: 5 }),
    ];
    const groups = todayGroups(list, "2026-11-02");
    expect(groups.map((g) => [g.key, g.habits.map((h) => h.id)])).toEqual([
      ["jederzeit", ["c"]],
      ["morgens", ["b"]],
      ["abends", ["a"]],
      ["woche", ["d"]],
      ["monat", ["f"]],
    ]);
    const index = checkIndex([...checks("b", ["2026-11-02"]), ...checks("c", ["2026-11-02"])]);
    expect(daySummary(list, index, "2026-11-02")).toEqual({ done: 2, due: 3 });
  });
});

describe("Serien", () => {
  it("zählt erfüllte Tage am Stück, heute offen bricht nichts", () => {
    const h = habit();
    const index = checkIndex(checks("h1", ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-10-20", "2026-10-21"]));
    expect(habitStreak(h, index, "2026-11-02", "2025-11-01")).toEqual({ current: 5, best: 5, unit: "Tag" });
  });

  it("überspringt Tage, an denen die Gewohnheit nicht dran ist", () => {
    const h = habit({ weekdays: [1, 3, 5] });
    // Mo 26., Mi 28., Fr 30.10. und Mo 2.11.
    const index = checkIndex(checks("h1", ["2026-10-26", "2026-10-28", "2026-10-30", "2026-11-02"]));
    expect(habitStreak(h, index, "2026-11-02", "2025-11-01").current).toBe(4);
  });

  it("bricht bei einem verpassten Tag, die beste Serie bleibt", () => {
    const h = habit();
    const index = checkIndex(checks("h1", ["2026-10-20", "2026-10-21", "2026-10-22", "2026-11-01", "2026-11-02"]));
    expect(habitStreak(h, index, "2026-11-02", "2025-11-01")).toEqual({ current: 2, best: 3, unit: "Tag" });
  });

  it("zählt Wochen; die laufende erst, wenn erfüllt", () => {
    const h = habit({ frequency: "weekly", target: 2 });
    const index = checkIndex(checks("h1", ["2026-10-19", "2026-10-21", "2026-10-26", "2026-10-28", "2026-11-02"]));
    expect(habitStreak(h, index, "2026-11-04", "2025-11-01")).toEqual({ current: 2, best: 2, unit: "Woche" });
    const more = checkIndex(checks("h1", ["2026-10-19", "2026-10-21", "2026-10-26", "2026-10-28", "2026-11-02", "2026-11-03"]));
    expect(habitStreak(h, more, "2026-11-04", "2025-11-01").current).toBe(3);
  });

  it("braucht für mehrere am Tag das ganze Tagesziel", () => {
    const h = habit({ target: 2 });
    const index = checkIndex([...checks("h1", ["2026-10-31"], 2), ...checks("h1", ["2026-11-01"], 1)]);
    expect(habitStreak(h, index, "2026-11-02", "2025-11-01").current).toBe(0);
  });
});

describe("Statistik je Zeitraum", () => {
  it("rechnet den heutigen Tag in die tägliche Quote mit ein", () => {
    const h = habit({ startDate: "2026-11-02" });
    const index = checkIndex(checks("h1", ["2026-11-02", "2026-11-04"]));
    // Woche Mo 2.–So 8.11., heute Do 5.11.: Mo erledigt, Di verpasst, Mi erledigt, Do offen
    const s = habitPeriodStats(h, index, "2026-11-02", "2026-11-08", "2026-11-05");
    expect(s.cells.map((c) => c.state)).toEqual(["done", "missed", "done", "open", "future", "future", "future"]);
    expect([s.done, s.due]).toEqual([2, 4]);
    expect(s.rate).toBeCloseTo(0.5);
  });

  it("zählt teilweise erledigte Tage anteilig", () => {
    const h = habit({ target: 2 });
    const index = checkIndex(checks("h1", ["2026-11-02"], 1));
    const s = habitPeriodStats(h, index, "2026-11-02", "2026-11-02", "2026-11-03");
    expect(s.cells[0].state).toBe("partial");
    expect([s.done, s.due]).toEqual([1, 2]);
  });

  it("wertet wöchentliche je Woche", () => {
    const h = habit({ frequency: "weekly", target: 2 });
    const index = checkIndex(checks("h1", ["2026-10-05", "2026-10-06", "2026-10-13", "2026-10-27", "2026-10-28"]));
    // Oktober 2026: Wochen mit Donnerstag im Oktober = 28.9., 5.10., 12.10., 19.10., 26.10.; heute 30.10. (Woche 26.10. läuft, ist erfüllt)
    const s = habitPeriodStats(h, index, "2026-10-01", "2026-10-31", "2026-10-30");
    expect(s.periods.map((p) => [p.from, p.done])).toEqual([
      ["2026-09-28", 0],
      ["2026-10-05", 2],
      ["2026-10-12", 1],
      ["2026-10-19", 0],
      ["2026-10-26", 2],
    ]);
    expect([s.done, s.due]).toEqual([5, 10]);
    expect(s.cells.find((c) => c.date === "2026-10-05")?.state).toBe("checked");
    expect(s.cells.find((c) => c.date === "2026-10-07")?.state).toBe("none");
  });

  it("zählt die laufende Woche mit dem ganzen Ziel", () => {
    const h = habit({ frequency: "weekly", target: 3 });
    const s = habitPeriodStats(h, checkIndex(checks("h1", ["2026-11-02"])), "2026-11-02", "2026-11-08", "2026-11-04");
    expect([s.done, s.due]).toEqual([1, 3]);
  });

  it("lässt Monatliche in der Wochenansicht aus der Quote", () => {
    const h = habit({ frequency: "monthly" });
    const s = habitPeriodStats(h, checkIndex(checks("h1", ["2026-11-03"])), "2026-11-02", "2026-11-08", "2026-11-05");
    expect(s.rate).toBeNull();
    expect(s.total).toBe(1);
  });

  it("zählt perfekte Tage und Quoten je Wochentag", () => {
    const list = [habit({ id: "a" }), habit({ id: "b", weekdays: [1] })];
    const index = checkIndex([...checks("a", ["2026-11-02", "2026-11-03"]), ...checks("b", ["2026-11-02"])]);
    const rates = dayRates(list, index, "2026-11-02", "2026-11-08", "2026-11-04");
    expect(rates.slice(0, 3).map((r) => [r.done, r.due])).toEqual([
      [2, 2],
      [1, 1],
      [0, 1],
    ]);
    const stats = list.map((h) => habitPeriodStats(h, index, "2026-11-02", "2026-11-08", "2026-11-04"));
    // Mi (heute) noch offen: zählt in die Quote, aber (noch) nicht als Tag für „Perfekte Tage“
    expect(periodKpis(stats, rates, "2026-11-04")).toEqual({ rate: 0.75, perfect: 2, days: 2, total: 3 });
    const byWeekday = weekdayRates(list, index, "2026-11-04", 1);
    expect(byWeekday[0]).toMatchObject({ weekday: 1, due: 2, done: 2, rate: 1 });
    expect(byWeekday[2]).toMatchObject({ weekday: 3, due: 0, rate: null });
  });
});

describe("Trainings-Wochenplan", () => {
  const entry = (patch: Partial<ScheduleEntry>): ScheduleEntry => ({
    id: "x",
    weekday: 1,
    daytime: "morgens",
    atTime: null,
    title: "Gym",
    category: "kraft",
    durationMin: null,
    notes: null,
    ...patch,
  });

  it("sortiert nach Tag und Uhrzeit bzw. Tageszeit", () => {
    const list = [
      entry({ id: "a", weekday: 2 }),
      entry({ id: "b", daytime: "abends", title: "Dehnen" }),
      entry({ id: "c", atTime: "06:30" }),
      entry({ id: "d", atTime: "19:00", daytime: "abends" }),
    ];
    expect(sortSchedule(list).map((e) => e.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("fasst die Woche zusammen", () => {
    const s = scheduleSummary([
      entry({ durationMin: 60 }),
      entry({ weekday: 3, durationMin: 75 }),
      entry({ category: "mobility", daytime: "abends", durationMin: 15 }),
    ]);
    expect([s.count, s.minutes, s.days]).toEqual([3, 150, 2]);
    expect(s.byCategory.map((c) => [c.key, c.count, c.minutes])).toEqual([
      ["kraft", 2, 135],
      ["mobility", 1, 15],
    ]);
    expect(formatDuration(150)).toBe("2 h 30 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
  });
});
