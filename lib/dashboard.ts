/*
 * Beranda: this week's work per station and the station table (worst first). Built only
 * from lib/aggregate and lib/rules, so every number agrees with Laporan Mingguan and the
 * input screens. Pure: "today" is an argument, links are { sheet, query } and the screen
 * turns them into hrefs(access).
 */
import {
  TOTAL,
  actionProgress,
  bmiPeriodByStation,
  reportGroups,
  staffDerived,
  weeklyPerformance,
  type ActionProgressRow,
  type TrackerData,
} from "./aggregate";
import { formatHariTanggal, formatTanggal, type IsoDate } from "./dates";
import { bmiCheckDate, reportGroupOf, replacementTimeliness, sameText, weekEnd, weekOfDate, type Settings } from "./rules";
import type { SheetKey } from "./workspace/access";

export type DashboardLink = { sheet: SheetKey; query?: Record<string, string | number | null> };

export type Phase = "before" | "during" | "after";

/** One station (or TOTAL) in the Beranda station table. */
export type StationRow = {
  station: string;
  /** Report group; CGK and HLP share "CGK & HLP". */
  group: string;
  sharedGroup: boolean;
  /** Named staff (the base of Dinilai and Cek BMI, as in Laporan Mingguan). */
  staffCount: number;
  /** Staff with a score in the running week; null before the programme. */
  assessed: number | null;
  /** Staff measured in the current BMI period; null before the first check date. */
  bmiChecked: number | null;
  /** Staff whose latest weekly score puts them at Tidak Sesuai. */
  tidakSesuai: number;
  /** Action items of the station's report group flagged OVERDUE (TOTAL: all groups once). */
  actionOverdue: number;
  /** Same, due within 7 days. */
  actionDueSoon: number;
  /** Replacements with a replaced name and no effective date yet. */
  replacementOpen: number;
  /** Of those, past the replacement deadline. */
  replacementOverdue: number;
  /** All replacements with a replaced name. */
  replacementTotal: number;
  links: {
    station: DashboardLink;
    performa: DashboardLink;
    rekap: DashboardLink;
    bmi: DashboardLink;
    tindakLanjut: DashboardLink;
    penggantian: DashboardLink;
  };
};

export type BerandaSummary = {
  phase: Phase;
  /** Week the "this week" numbers refer to (the last week after the programme), or null before it. */
  week: number | null;
  /** Latest BMI period whose planned date has come, or null before the first check. */
  bmiPeriod: number | null;
  /** One row per station in view, worst first. */
  stations: StationRow[];
  /** All stations in view together. */
  total: StationRow;
  /** Action progress per report group in view, then TOTAL. */
  actions: ActionProgressRow[];
};

export function phaseOf(s: Settings, today: IsoDate): Phase {
  if (today < s.week1Start) return "before";
  if (today > weekEnd(s.weeks, s)) return "after";
  return "during";
}

/** Latest BMI period whose planned date is on or before today, or null. */
export function currentBmiPeriod(s: Settings, today: IsoDate): number | null {
  let period: number | null = null;
  for (let p = 1; p <= s.bmiPeriods; p++) {
    if (bmiCheckDate(p, s) <= today) period = p;
  }
  return period;
}

function hasText(v: string | null | undefined): boolean {
  return v != null && v.trim() !== "";
}

/** Replacement belongs to a station; rows without a station count for a group of one station. */
function replacementIn(r: TrackerData["replacements"][number], station: string): boolean {
  if (hasText(r.station)) return sameText(r.station, station);
  return sameText(r.reportGroup, station);
}

/**
 * Worst first: most exceptions (OVERDUE action items and replacements, Tidak Sesuai staff),
 * then the largest share of this week's scores and checks still open, then station order.
 */
export function worstFirst(rows: readonly StationRow[]): StationRow[] {
  const openShare = (r: StationRow) => {
    let due = 0;
    let open = 0;
    for (const done of [r.assessed, r.bmiChecked]) {
      if (done === null) continue;
      due += r.staffCount;
      open += r.staffCount - done;
    }
    return due === 0 ? 0 : open / due;
  };
  return rows
    .map((r, i) => ({ r, i, issues: r.actionOverdue + r.replacementOverdue + r.tidakSesuai, open: openShare(r) }))
    .sort((a, b) => b.issues - a.issues || b.open - a.open || a.i - b.i)
    .map(({ r }) => r);
}

/**
 * Beranda numbers for `stations` (all for KPS / the owner, one for a station link).
 * `data` must already be limited to that scope (lib/workspace trackerData).
 */
export function berandaSummary(data: TrackerData, today: IsoDate, stations: readonly string[]): BerandaSummary {
  const s = data.settings;
  const phase = phaseOf(s, today);
  const week = weekOfDate(today, s) ?? (phase === "after" ? s.weeks : null);
  const bmiPeriod = currentBmiPeriod(s, today);

  const derived = staffDerived(data);
  const inView = [...new Set(stations.map((code) => reportGroupOf(code) ?? code))];
  const groupKeys = reportGroups(data.stations).filter((g) => inView.includes(g));
  const actions = actionProgress(data.actionItems, s, today, groupKeys.length > 0 ? groupKeys : inView);
  const weekly = week === null ? [] : weeklyPerformance(data, week, derived);
  const bmi = bmiPeriod === null ? [] : bmiPeriodByStation(data, bmiPeriod, derived);
  const timeliness = data.replacements
    .filter((r) => hasText(r.replacedName))
    .map((r) => ({ r, t: replacementTimeliness(r, s, today) }));

  const row = (key: string): StationRow => {
    const all = key === TOTAL;
    const station = all ? null : key;
    const group = all ? TOTAL : (reportGroupOf(key) ?? key);
    const a = actions.find((r) => r.key === group);
    const repl = all ? timeliness : timeliness.filter(({ r }) => replacementIn(r, key));
    const open = repl.filter(({ t }) => t === "OVERDUE" || t === "Menunggu");
    const staff = derived.filter((d) => hasText(d.staff.name) && (all || sameText(d.staff.station, key)));
    const q = (extra: Record<string, string | number | null> = {}) => ({ stasiun: station, ...extra });
    return {
      station: key,
      group,
      sharedGroup: !all && group !== key,
      staffCount: staff.length,
      assessed: week === null ? null : (weekly.find((r) => r.key === key)?.assessed ?? 0),
      bmiChecked: bmiPeriod === null ? null : (bmi.find((r) => r.key === key)?.checked ?? 0),
      tidakSesuai: staff.filter((d) => d.rekap?.currentStatus === "Tidak Sesuai").length,
      actionOverdue: a?.overdue ?? 0,
      actionDueSoon: a?.dueSoon ?? 0,
      replacementOpen: open.length,
      replacementOverdue: open.filter(({ t }) => t === "OVERDUE").length,
      replacementTotal: repl.length,
      links: {
        station: { sheet: "dashboard", query: q() },
        performa: { sheet: "performa", query: q({ minggu: week ?? 1 }) },
        rekap: { sheet: "performa", query: q({ tab: "rekap" }) },
        bmi: { sheet: "bmi", query: q({ periode: bmiPeriod ?? 1 }) },
        tindakLanjut: { sheet: "tindakLanjut", query: { laporan: all ? null : group } },
        penggantian: { sheet: "penggantian", query: q() },
      },
    };
  };

  return {
    phase,
    week,
    bmiPeriod,
    stations: worstFirst(stations.map(row)),
    total: row(TOTAL),
    actions,
  };
}

// ---------------------------------------------------------------------------
// To-do list (station link, or KPS looking at one station)
// ---------------------------------------------------------------------------

export type TodoState = "todo" | "done" | "later";

export type TodoItem = {
  key: "penilaian" | "bmi" | "tindak-lanjut" | "penggantian" | "temuan" | "lp";
  title: string;
  /** Counts in words: "2 dari 12 SDM belum dinilai". */
  detail: string;
  state: TodoState;
  /** Exception count shown as a critical label (OVERDUE); 0 otherwise. */
  overdue: number;
  /** Button label, naming the object. */
  action: string;
  link: DashboardLink;
};

/**
 * This week's work for one station row. Before week 1 the list says what to prepare.
 * `findingsWritten`: the station's findings for the running week exist.
 * `genderMissing`: staff without L/P (only listed while preparing).
 */
export function stationTodo(
  summary: Pick<BerandaSummary, "phase" | "week" | "bmiPeriod">,
  row: StationRow,
  s: Settings,
  findingsWritten: boolean,
  genderMissing = 0,
): TodoItem[] {
  const station = row.station === TOTAL ? null : row.station;
  const q = (extra: Record<string, string | number | null> = {}) => ({ stasiun: station, ...extra });

  const actionsOpen = row.actionOverdue + row.actionDueSoon;
  const tindakLanjut: TodoItem = {
    key: "tindak-lanjut",
    title: `Tindak lanjut laporan ${row.group}`,
    detail:
      row.actionDueSoon > 0
        ? `${row.actionDueSoon} jatuh tempo ≤ 7 hari`
        : row.actionOverdue > 0
          ? "Lewat batas waktu"
          : "Tidak ada yang OVERDUE atau jatuh tempo ≤ 7 hari",
    state: actionsOpen > 0 ? "todo" : "done",
    overdue: row.actionOverdue,
    action: "Perbarui tindak lanjut",
    link: row.links.tindakLanjut,
  };

  const penggantian: TodoItem = {
    key: "penggantian",
    title: "Penggantian belum efektif",
    detail:
      row.replacementTotal === 0
        ? "Tidak ada SDM yang perlu diganti"
        : row.replacementOpen === 0
          ? `Semua ${row.replacementTotal} penggantian sudah efektif`
          : `${row.replacementOpen} dari ${row.replacementTotal} · batas ${formatTanggal(s.replacementDeadline)}`,
    state: row.replacementOpen > 0 ? "todo" : "done",
    overdue: row.replacementOverdue,
    action: "Buka penggantian",
    link: row.links.penggantian,
  };

  if (summary.phase === "before" || summary.week === null) {
    const items: TodoItem[] = [];
    if (genderMissing > 0) {
      items.push({
        key: "lp",
        title: "L/P di Data SDM",
        detail: `${genderMissing} dari ${row.staffCount} SDM belum diisi`,
        state: "todo",
        overdue: 0,
        action: "Lengkapi L/P",
        link: { sheet: "sdm", query: q({ cek: "lp-kosong" }) },
      });
    }
    items.push(tindakLanjut, penggantian);
    items.push({
      key: "penilaian",
      title: "Penilaian Minggu ke-1",
      detail: `Mulai ${formatHariTanggal(s.week1Start)}`,
      state: "later",
      overdue: 0,
      action: "Buka penilaian",
      link: { sheet: "performa", query: q({ minggu: 1 }) },
    });
    items.push({
      key: "bmi",
      title: "BMI Cek ke-1",
      detail: `Mulai ${formatHariTanggal(bmiCheckDate(1, s))}`,
      state: "later",
      overdue: 0,
      action: "Buka cek BMI",
      link: { sheet: "bmi", query: q({ periode: 1 }) },
    });
    return items;
  }

  const week = summary.week;
  const assessed = row.assessed ?? 0;
  const items: TodoItem[] = [
    {
      key: "penilaian",
      title: `Penilaian Minggu ke-${week}`,
      detail:
        assessed >= row.staffCount
          ? `Semua ${row.staffCount} SDM sudah dinilai`
          : `${row.staffCount - assessed} dari ${row.staffCount} SDM belum dinilai`,
      state: assessed >= row.staffCount ? "done" : "todo",
      overdue: 0,
      action: "Isi penilaian",
      link: row.links.performa,
    },
  ];

  if (summary.bmiPeriod === null || row.bmiChecked === null) {
    items.push({
      key: "bmi",
      title: "BMI Cek ke-1",
      detail: `Mulai ${formatHariTanggal(bmiCheckDate(1, s))}`,
      state: "later",
      overdue: 0,
      action: "Buka cek BMI",
      link: { sheet: "bmi", query: q({ periode: 1 }) },
    });
  } else {
    const done = row.bmiChecked >= row.staffCount;
    items.push({
      key: "bmi",
      title: `BMI Cek ke-${summary.bmiPeriod}`,
      detail: done
        ? `Semua ${row.staffCount} SDM sudah dicek`
        : `${row.staffCount - row.bmiChecked} dari ${row.staffCount} SDM belum dicek`,
      state: done ? "done" : "todo",
      overdue: 0,
      action: "Catat cek BMI",
      link: row.links.bmi,
    });
  }

  items.push(tindakLanjut, penggantian, {
    key: "temuan",
    title: `Temuan Minggu ke-${week}`,
    detail: findingsWritten ? "Sudah ditulis" : "Belum ditulis",
    state: findingsWritten ? "done" : "todo",
    overdue: 0,
    action: "Tulis temuan",
    link: { sheet: "laporan", query: q({ minggu: week }) },
  });
  return items;
}
