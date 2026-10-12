import { describe, expect, test } from "bun:test";
import { programmeWeekLine, type ProgrammeSettingsRow } from "./programme-calendar";

// Parameter defaults: 10 weeks from Mon 12 Okt 2026, 5 BMI periods every 14 days from 12 Okt.
const settings: ProgrammeSettingsRow = {
  week1_start: "2026-10-12",
  weeks: 10,
  bmi_first_check: "2026-10-12",
  bmi_interval_days: 14,
  bmi_periods: 5,
};

describe("programmeWeekLine", () => {
  test("one short line for the shell, before, during and after the programme", () => {
    expect(programmeWeekLine(settings, "2026-10-08")).toBe("Mulai 12 Okt 2026");
    expect(programmeWeekLine(settings, "2026-10-12")).toBe("Minggu ke-1 dari 10");
    expect(programmeWeekLine(settings, "2026-10-21")).toBe("Minggu ke-2 dari 10");
    expect(programmeWeekLine(settings, "2026-12-21")).toBe("Selesai 20 Des 2026");
  });
});
