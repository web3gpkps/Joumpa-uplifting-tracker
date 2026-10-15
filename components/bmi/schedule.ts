/*
 * BMI check schedule for the Cek BMI screen. The workbook has no schedule columns, so this sits on
 * top of lib/rules bmiSummary (which stays equal to the sheet): everyone is checked every
 * bmiIntervalDays, starting on bmiFirstCheck. Pure, covered by summary.test.ts.
 */
import { addDays, diffDays, type IsoDate } from "@/lib/dates";
import { bmiSummary, type BmiCheckRow, type BmiSummary as SheetSummary, type Settings } from "@/lib/rules";

export type BmiScheduleStatus = "Terlambat cek" | "Cek ≤ 7 hari" | "Terjadwal";

/** The sheet's summary columns plus the schedule the screen derives from them. */
export type BmiSummary = SheetSummary & {
  /** Checks with a BMI (both height and weight). */
  checks: number;
  /** Date of the latest check that has one. */
  lastCheckDate: IsoDate | null;
  nextCheck: IsoDate;
  scheduleStatus: BmiScheduleStatus;
};

/** No check yet: the first check date; otherwise the last check date plus bmiIntervalDays. */
export function nextBmiCheck(lastCheckDate: IsoDate | null, s: Settings): IsoDate {
  if (lastCheckDate === null) return s.bmiFirstCheck;
  return addDays(lastCheckDate, s.bmiIntervalDays);
}

export function bmiScheduleStatus(next: IsoDate, today: IsoDate): BmiScheduleStatus {
  const left = diffDays(next, today);
  if (left < 0) return "Terlambat cek";
  if (left <= 7) return "Cek ≤ 7 hari";
  return "Terjadwal";
}

export function trackerSummary(
  checks: readonly BmiCheckRow[],
  gender: string | null | undefined,
  s: Settings,
  today: IsoDate,
): BmiSummary {
  const sheet = bmiSummary(checks, gender, s);
  let lastCheckDate: IsoDate | null = null;
  for (let i = sheet.periods.length - 1; i >= 0 && lastCheckDate === null; i--) {
    lastCheckDate = sheet.periods[i]?.checkDate ?? null;
  }
  const nextCheck = nextBmiCheck(lastCheckDate, s);
  return {
    ...sheet,
    checks: sheet.periods.filter((p) => p?.bmi != null).length,
    lastCheckDate,
    nextCheck,
    scheduleStatus: bmiScheduleStatus(nextCheck, today),
  };
}
