/*
 * Pure view helpers for the Cek BMI screen (no React, no server code), unit tested in
 * summary.test.ts. Formulas stay in lib/rules; these only pick, count and order.
 */
import { diffDays, formatTanggalPendek } from "@/lib/dates";
import { bmiCheckDate, type BmiPeriodValue, type BmiSummary, type Settings } from "@/lib/rules";
import type { StatusTone } from "@/components/ui/StatusChip";

/** The period whose planned date is the latest on or before today; period 1 before the first check. */
export function defaultPeriod(s: Settings, today: string): number {
  let chosen = 1;
  for (let p = 1; p <= s.bmiPeriods; p++) {
    if (bmiCheckDate(p, s) <= today) chosen = p;
  }
  return chosen;
}

/** True when this period holds a complete check (TB and BB, so a BMI). */
export function isChecked(slot: BmiPeriodValue | null | undefined): boolean {
  return Boolean(slot && slot.bmi !== null);
}

/**
 * Date a new check gets unless changed: today while the period is running
 * (planned date ≤ today < next planned date), else the period's planned date.
 */
export function defaultCheckDate(period: number, plannedDates: readonly string[], today: string): string {
  const planned = plannedDates[period - 1];
  const next = plannedDates[period];
  return planned <= today && (!next || today < next) ? today : planned;
}

/** Checked count for one period over the staff in view. */
export function checkedCount(summaries: readonly BmiSummary[], period: number): number {
  return summaries.filter((s) => isChecked(s.periods[period - 1])).length;
}

/**
 * One status line per person for the chosen period: "Sudah dicek · 26 Okt",
 * "Belum dicek · dijadwalkan 9 Nov", "Belum dicek · lewat 3 hari" (period running) or
 * "Belum dicek · periode sudah lewat". Tone only for the exceptions.
 */
export function slotStatusLine(
  slot: BmiPeriodValue | null | undefined,
  period: number,
  plannedDates: readonly string[],
  today: string,
): { text: string; tone: StatusTone } {
  if (slot && isChecked(slot)) {
    return { text: slot.checkDate ? `Sudah dicek · ${formatTanggalPendek(slot.checkDate)}` : "Sudah dicek", tone: "good" };
  }
  const planned = plannedDates[period - 1];
  const next = plannedDates[period];
  if (today < planned) return { text: `Belum dicek · dijadwalkan ${formatTanggalPendek(planned)}`, tone: "neutral" };
  if (next && today >= next) return { text: "Belum dicek · periode sudah lewat", tone: "critical" };
  const late = diffDays(today, planned);
  return { text: late === 0 ? "Belum dicek · jadwal hari ini" : `Belum dicek · lewat ${late} hari`, tone: "warning" };
}

/** People not yet checked in the chosen period first; stable, so the staff order stays. */
export function uncheckedFirst<T>(items: readonly T[], summaryOf: (item: T) => BmiSummary, period: number): T[] {
  return items
    .map((item, index) => ({ item, index, rank: isChecked(summaryOf(item).periods[period - 1]) ? 1 : 0 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.item);
}

/** True when L/P is still empty (the row shows an "Isi profil" marker). */
export function profileIncomplete(gender: string | null | undefined): boolean {
  return gender !== "L" && gender !== "P";
}
