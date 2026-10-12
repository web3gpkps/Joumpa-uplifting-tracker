import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, bmiCheckDate, bmiSummary, type BmiCheckRow, type Settings } from "@/lib/rules";
import {
  checkedCount,
  defaultCheckDate,
  defaultPeriod,
  profileIncomplete,
  slotStatusLine,
  uncheckedFirst,
} from "./summary";

const s: Settings = { ...DEFAULT_SETTINGS, bmiFirstCheck: "2026-10-12", bmiIntervalDays: 14, bmiPeriods: 5 };
const planned = Array.from({ length: s.bmiPeriods }, (_, i) => bmiCheckDate(i + 1, s));

const check = (period: number, heightCm: number, weightKg: number, checkDate: string): BmiCheckRow => ({
  staffCode: "SUB-01",
  period,
  heightCm,
  weightKg,
  checkDate,
});

describe("defaultPeriod", () => {
  test("period 1 before the first check", () => {
    expect(defaultPeriod(s, "2026-10-01")).toBe(1);
  });
  test("latest planned period on or before today", () => {
    expect(defaultPeriod(s, "2026-10-26")).toBe(2);
    expect(defaultPeriod(s, "2026-11-08")).toBe(2);
    expect(defaultPeriod(s, "2026-11-09")).toBe(3);
  });
  test("never past the last period", () => {
    expect(defaultPeriod(s, "2027-06-01")).toBe(5);
  });
});

describe("defaultCheckDate", () => {
  test("today while the period runs, else its planned date", () => {
    expect(defaultCheckDate(2, planned, "2026-10-30")).toBe("2026-10-30");
    expect(defaultCheckDate(2, planned, "2026-10-20")).toBe("2026-10-26");
    expect(defaultCheckDate(1, planned, "2026-10-30")).toBe("2026-10-12");
    expect(defaultCheckDate(5, planned, "2027-01-30")).toBe("2027-01-30");
  });
});

describe("slotStatusLine", () => {
  const a = bmiSummary([check(1, 170, 60, "2026-10-13")], "L", s);
  const none = bmiSummary([], null, s);

  test("checked shows the check date", () => {
    expect(slotStatusLine(a.periods[0], 1, planned, "2026-10-20")).toEqual({ text: "Sudah dicek · 13 Okt", tone: "good" });
  });
  test("future, running and past periods", () => {
    expect(slotStatusLine(none.periods[1], 2, planned, "2026-10-20").tone).toBe("neutral");
    expect(slotStatusLine(none.periods[0], 1, planned, "2026-10-12").text).toBe("Belum dicek · jadwal hari ini");
    expect(slotStatusLine(none.periods[0], 1, planned, "2026-10-15")).toEqual({ text: "Belum dicek · lewat 3 hari", tone: "warning" });
    expect(slotStatusLine(none.periods[0], 1, planned, "2026-10-26").tone).toBe("critical");
  });
});

describe("ordering and counts", () => {
  const a = { code: "A", summary: bmiSummary([check(1, 170, 60, "2026-10-12")], "L", s) };
  const b = { code: "B", summary: bmiSummary([], "P", s) };
  const c = { code: "C", summary: bmiSummary([], null, s) };

  test("not yet checked first, staff order kept inside each group", () => {
    expect(uncheckedFirst([a, b, c], (x) => x.summary, 1).map((x) => x.code)).toEqual(["B", "C", "A"]);
    expect(uncheckedFirst([a, b, c], (x) => x.summary, 2).map((x) => x.code)).toEqual(["A", "B", "C"]);
  });
  test("checked count per period", () => {
    expect(checkedCount([a.summary, b.summary, c.summary], 1)).toBe(1);
    expect(checkedCount([a.summary, b.summary, c.summary], 2)).toBe(0);
  });
  test("profile is incomplete without L/P", () => {
    expect(profileIncomplete(null)).toBe(true);
    expect(profileIncomplete("P")).toBe(false);
  });
});
