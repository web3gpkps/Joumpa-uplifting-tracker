"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  DataGrid,
  type CellValue,
  type ConfirmClear,
  type GridColumn,
  type SaveRowResult,
} from "@/components/grid/DataGrid";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { StatusChip, type StatusTone } from "@/components/ui/StatusChip";
import { formatTanggalPendek } from "@/lib/dates";
import { formatDecimal, formatSignedKg } from "@/lib/format";
import { bmi, bmiCategory, heightRequirement, type BmiCategory, type HeightRequirement, type Settings } from "@/lib/rules";
import { saveBmiCheck, saveBmiProfile, type BmiActionResult } from "./actions";
import { BmiPersonSheet, CLOSED_SHEET, closeSheet, openSheet, type BmiPerson } from "./BmiPersonSheet";
import { isPlausibleDate } from "./format";
import { useStableOrder } from "./stable-order";
import { profileIncomplete } from "./summary";

export type BmiGridCheck = {
  date: string | null;
  tb: number;
  bb: number;
  bmi: number | null;
  category: BmiCategory | null;
};

export type BmiGridRow = {
  code: string;
  name: string;
  station: string | null;
  gender: string | null;
  bmiNote: string | null;
  /** index 0 = period 1; null when that period has no check. */
  checks: Array<BmiGridCheck | null>;
  weightDelta: number | null;
  /** Periods with a weight, so Δ berat is shown only from the second weighing. */
  weighings: number;
  /** From the latest height (every-period view). */
  heightRequirement: HeightRequirement | null;
  /** "Belum dicek · lewat 3 hari" for the chosen period. */
  slotStatus: { text: string; tone: StatusTone };
  /** "tautan ini, 8 Okt 07.55" for the latest change to this person's checks. */
  changed: string | null;
  /** Profile and history for the per-person sheet. */
  person: BmiPerson;
};

type BmiGridProps = {
  caption: string;
  rows: BmiGridRow[];
  accessKey: string;
  plannedDates: string[];
  /** Date a new check gets per period when Tgl is left empty, index 0 = period 1. */
  defaultDates: string[];
  /** The chosen period. */
  period: number;
  /** false: only the chosen period. true: every period plus the profile columns. */
  allSlots: boolean;
  showStation: boolean;
  settings: Settings;
  emptyState: ReactNode;
  phone: ReactNode;
};

const STATUS_TEXT: Record<StatusTone, string> = {
  good: "text-good",
  neutral: "text-ink-muted",
  warning: "text-warning",
  critical: "text-critical",
  progress: "text-progress",
};

export function periodGroup(period: number, plannedDate: string): string {
  return `Periode ${period} · ${formatTanggalPendek(plannedDate)}`;
}

const rowKey = (r: BmiGridRow) => r.code;
const rowLabel = (r: BmiGridRow) => `${r.code}, ${r.name}`;
const SEARCH = { placeholder: "Nama atau ID", text: (r: BmiGridRow) => `${r.code} ${r.name}` };

const FIELD_OF_ERROR: Record<string, string> = { height_cm: "tb", weight_kg: "bb", check_date: "tgl" };

const num = (v: CellValue) => (typeof v === "number" ? v : null);

function chip(value: CellValue) {
  return value ? <StatusChip label={String(value)} /> : null;
}

function requirementCell(value: CellValue) {
  if (value === "Memenuhi" || value === "Tidak Memenuhi") return <StatusChip label={value} />;
  if (value === "Isi standar di Parameter") return <span className="text-ink-muted">Standar belum diatur</span>;
  return null;
}

/** Tgl / TB / BB (input) and BMI / Kategori (computed live) of one period. */
function slotColumns(
  p: number,
  planned: string,
  defaultDate: string,
  group: string | undefined,
  settings: Settings,
): GridColumn<BmiGridRow>[] {
  const i = p - 1;
  const check = (r: BmiGridRow) => r.checks[i];
  const liveBmi = (value: (key: string) => CellValue) => bmi(num(value(`tb_${p}`)), num(value(`bb_${p}`)));
  return [
    {
      key: `tgl_${p}`,
      header: "Tgl",
      label: `Tanggal cek periode ${p}, kosong berarti ${formatTanggalPendek(defaultDate)}`,
      group,
      width: 108,
      editor: "date",
      get: (r) => check(r)?.date ?? null,
      validate: (value) => (typeof value === "string" && !isPlausibleDate(value) ? "Tanggal tidak valid." : null),
    },
    {
      key: `tb_${p}`,
      header: "TB",
      label: `Tinggi badan periode ${p} (cm)`,
      group,
      width: 76,
      editor: "number",
      min: 120,
      max: 210,
      decimals: 1,
      get: (r) => check(r)?.tb ?? null,
    },
    {
      key: `bb_${p}`,
      header: "BB",
      label: `Berat badan periode ${p} (kg)`,
      group,
      width: 76,
      editor: "number",
      min: 30,
      max: 200,
      decimals: 1,
      get: (r) => check(r)?.bb ?? null,
    },
    {
      key: `bmi_${p}`,
      header: "BMI",
      label: `BMI periode ${p}`,
      group,
      width: 64,
      editor: "readonly",
      align: "end",
      derive: (_r, value) => liveBmi(value),
      render: (value) => (typeof value === "number" ? formatDecimal(value, 1) : null),
    },
    {
      key: `kat_${p}`,
      header: "Kategori",
      label: `Kategori BMI periode ${p}`,
      group,
      width: 112,
      editor: "readonly",
      derive: (_r, value) => bmiCategory(liveBmi(value), settings),
      render: chip,
    },
  ];
}

/**
 * Cek BMI grid. By default only the chosen period: Tgl, TB, BB (input), BMI, Kategori,
 * Syarat tinggi and the status line (computed), rows not yet checked first. "Tampilkan
 * semua cek" shows every period plus L/P, the programme note and Δ berat. Each row saves
 * itself: one share_save_check per changed period, one share_save_profile when the profile
 * changed. Clearing TB and BB of a stored period asks first. Client component.
 */
export function BmiGrid({
  caption,
  rows,
  accessKey,
  plannedDates,
  defaultDates,
  period,
  allSlots,
  showStation,
  settings: settingsProp,
  emptyState,
  phone,
}: BmiGridProps) {
  // A refresh sends new arrays with the same dates: key the memos on the text so the
  // columns (and the grid's scroll position) stay put after every save.
  const datesKey = plannedDates.join(",");
  const defaultsKey = defaultDates.join(",");
  const settingsKey = JSON.stringify(settingsProp);
  const settings = useMemo(() => JSON.parse(settingsKey) as Settings, [settingsKey]);
  const ordered = useStableOrder(rows, rowKey);
  // The sheet lives outside the grid, so the grid never takes its keys or paste.
  const [sheet, setSheet] = useState(CLOSED_SHEET);
  const [sheetCode, setSheetCode] = useState<string | null>(null);
  const sheetPerson = sheetCode ? (rows.find((r) => r.code === sheetCode)?.person ?? null) : null;

  const columns = useMemo<GridColumn<BmiGridRow>[]>(() => {
    const dates = datesKey.split(",");
    const defaults = defaultsKey.split(",");
    const out: GridColumn<BmiGridRow>[] = [
      { key: "code", header: "ID", width: 84, editor: "readonly", frozen: true },
      { key: "name", header: "Nama", width: 188, editor: "readonly", frozen: true },
    ];
    if (showStation) out.push({ key: "station", header: "Stasiun", width: 72, editor: "readonly" });
    if (!allSlots) {
      out.push(
        ...slotColumns(period, dates[period - 1], defaults[period - 1], undefined, settings),
        {
          key: "syarat",
          header: "Syarat tinggi",
          label: `Syarat tinggi periode ${period}`,
          width: 132,
          editor: "readonly",
          derive: (r, value) => heightRequirement(num(value(`tb_${period}`)), r.gender, settings),
          render: requirementCell,
        },
        {
          key: "slot_status",
          header: "Status",
          width: 240,
          editor: "readonly",
          get: (r) => r.slotStatus.text,
          render: (_value, r) => <span className={cx("text-sm", STATUS_TEXT[r.slotStatus.tone])}>{r.slotStatus.text}</span>,
        },
      );
      return out;
    }
    dates.forEach((planned, i) =>
      out.push(...slotColumns(i + 1, planned, defaults[i], periodGroup(i + 1, planned), settings)),
    );
    out.push(
      {
        key: "gender",
        header: "L/P",
        group: "Profil",
        width: 64,
        editor: "select",
        options: [{ value: "L" }, { value: "P" }],
        get: (r) => (r.gender === "L" || r.gender === "P" ? r.gender : null),
      },
      {
        key: "bmi_note",
        header: "Catatan program BMI",
        group: "Profil",
        width: 240,
        editor: "longtext",
        maxLength: 2000,
        get: (r) => r.bmiNote,
      },
      {
        key: "delta",
        header: "Δ berat",
        label: "Perubahan berat sejak cek pertama",
        group: "Profil",
        width: 88,
        editor: "readonly",
        align: "end",
        get: (r) => (r.weighings >= 2 ? r.weightDelta : null),
        render: (value) => (typeof value === "number" ? formatSignedKg(value) : null),
      },
      {
        key: "syarat",
        header: "Syarat tinggi",
        label: "Syarat tinggi, dari tinggi terakhir",
        group: "Profil",
        width: 132,
        editor: "readonly",
        get: (r) => r.heightRequirement,
        render: requirementCell,
      },
      {
        key: "changed",
        header: "Terakhir diubah lewat",
        width: 220,
        editor: "readonly",
        render: (_value, r) => (r.changed ? <span className="text-xs text-ink-muted">{r.changed}</span> : null),
      },
    );
    return out;
  }, [datesKey, defaultsKey, showStation, allSlots, period, settings]);

  const rowActions = useMemo(
    () => ({
      header: "Profil",
      width: 112,
      render: (row: BmiGridRow) => {
        const open = () => {
          setSheetCode(row.code);
          setSheet(openSheet);
        };
        return profileIncomplete(row.gender) ? (
          <Button size="sm" variant="secondary" tabIndex={-1} onClick={open}>
            Isi profil
            <span className="sr-only"> {row.name}, L/P belum diisi</span>
          </Button>
        ) : (
          <Button size="sm" variant="ghost" tabIndex={-1} onClick={open}>
            Profil<span className="sr-only"> {row.name}</span>
          </Button>
        );
      },
    }),
    [],
  );

  const confirmClear = useMemo<ConfirmClear<BmiGridRow>>(
    () => ({
      groups: datesKey.split(",").map((_, i) => ({ fields: [`tb_${i + 1}`, `bb_${i + 1}`], label: `periode ${i + 1}` })),
      message: (row, labels) => `Hapus cek BMI ${labels.join(" dan ")} untuk ${row.name}?`,
      description: "TB dan BB periode itu dikosongkan, jadi ceknya dihapus. Periode lain tidak berubah.",
      confirmLabel: (labels) => `Hapus cek ${labels.join(" dan ")}`,
    }),
    [datesKey],
  );

  const onSaveRow = useCallback(
    async (_key: string, changes: Record<string, CellValue>, row: BmiGridRow): Promise<SaveRowResult> => {
      const has = (field: string) => field in changes;
      const fieldErrors: Record<string, string> = {};
      const writes: Array<{ period: number; checkDate: string | null; heightCm: number | null; weightKg: number | null }> = [];
      const defaults = defaultsKey.split(",");

      datesKey.split(",").forEach((_planned, i) => {
        const p = i + 1;
        if (!has(`tgl_${p}`) && !has(`tb_${p}`) && !has(`bb_${p}`)) return;
        const stored = row.checks[i];
        const tb = has(`tb_${p}`) ? (changes[`tb_${p}`] as number | null) : (stored?.tb ?? null);
        const bb = has(`bb_${p}`) ? (changes[`bb_${p}`] as number | null) : (stored?.bb ?? null);
        const date = has(`tgl_${p}`) ? (changes[`tgl_${p}`] as string | null) : (stored?.date ?? null);
        if (tb === null && bb === null) {
          // Only reached for a stored check after the grid's delete confirmation.
          if (stored) writes.push({ period: p, checkDate: null, heightCm: null, weightKg: null });
          else fieldErrors[`tb_${p}`] = "Isi TB dan BB untuk menyimpan cek ini.";
          return;
        }
        if (tb === null) {
          fieldErrors[`tb_${p}`] = stored ? "Isi TB juga, atau kosongkan TB dan BB untuk menghapus cek." : "Isi TB juga.";
          return;
        }
        if (bb === null) {
          fieldErrors[`bb_${p}`] = stored ? "Isi BB juga, atau kosongkan TB dan BB untuk menghapus cek." : "Isi BB juga.";
          return;
        }
        writes.push({ period: p, checkDate: date ?? defaults[i], heightCm: tb, weightKg: bb });
      });

      const outcome: { failure: string | null } = { failure: null };
      const run = async (call: () => Promise<BmiActionResult>, fieldFor: (serverField?: string) => string | null) => {
        let result: BmiActionResult;
        try {
          result = await call();
        } catch {
          outcome.failure = "Koneksi ke server terputus. Isian tetap ada; coba simpan lagi.";
          return;
        }
        if (result.ok) return;
        outcome.failure = result.error.message;
        const field = fieldFor(result.error.field);
        if (field) fieldErrors[field] = result.error.message;
      };

      for (const w of writes) {
        await run(
          () => saveBmiCheck(accessKey, { staffCode: row.code, ...w }),
          (serverField) => (serverField && FIELD_OF_ERROR[serverField] ? `${FIELD_OF_ERROR[serverField]}_${w.period}` : null),
        );
      }
      if (has("gender") || has("bmi_note")) {
        const gender = has("gender") ? changes.gender : row.gender;
        const note = has("bmi_note") ? changes.bmi_note : row.bmiNote;
        await run(
          () =>
            saveBmiProfile(accessKey, {
              staffCode: row.code,
              gender: gender === "L" || gender === "P" ? gender : null,
              bmiNote: typeof note === "string" && note.trim() !== "" ? note : null,
            }),
          (serverField) => (serverField === "gender" || serverField === "bmi_note" ? serverField : null),
        );
      }

      if (!outcome.failure && Object.keys(fieldErrors).length === 0) return { ok: true };
      return {
        ok: false,
        message: outcome.failure ?? "Periksa sel yang ditandai.",
        fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
      };
    },
    [accessKey, datesKey, defaultsKey],
  );

  return (
    <>
      <DataGrid
        caption={caption}
        rows={ordered}
        columns={columns}
        rowKey={rowKey}
        rowLabel={rowLabel}
        onSaveRow={onSaveRow}
        search={SEARCH}
        confirmClear={confirmClear}
        rowActions={rowActions}
        highlightGroup={allSlots ? periodGroup(period, plannedDates[period - 1]) : undefined}
        highlightNote={allSlots ? "periode yang dipilih" : undefined}
        emptyState={emptyState}
        phone={phone}
      />
      {sheetPerson ? (
        <BmiPersonSheet
          key={sheet.n}
          open={sheet.open}
          onClose={() => setSheet(closeSheet)}
          accessKey={accessKey}
          person={sheetPerson}
          plannedDates={plannedDates}
          period={period}
        />
      ) : null}
    </>
  );
}
