"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { deltaVsBaseline, practiceAvg, weeklyStatus, type Settings } from "@/lib/rules";
import { formatScore, formatSignedScore } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { DataGrid, type CellValue, type GridColumn, type SaveRowResult } from "@/components/grid/DataGrid";
import { ASPECTS } from "./format";
import { SCORE_INPUT_KEYS, SCORE_KEYS, scoreColumnKeys } from "./score-columns";
import type { SaveScoreAction } from "./ScoreRow";

/** One person's row for the selected week (column keys = RPC field names). */
export type ScoreGridRow = {
  code: string;
  name: string;
  station: string;
  assignmentStatus: string;
  /** Training baseline average, for the difference column. */
  baselineAvg: number | null;
  score_a: number | null;
  score_b: number | null;
  score_c: number | null;
  score_d: number | null;
  score_e: number | null;
  score_f: number | null;
  observer: string | null;
  coaching_notes: string | null;
  /** "Diubah lewat tautan ini, 8 Okt 07.55"; null when there is no row this week. */
  changedLabel: string | null;
};

const rowKey = (r: ScoreGridRow) => r.code;
const rowLabel = (r: ScoreGridRow) => `${r.code}, ${r.name}`;
const SEARCH = { placeholder: "Nama atau ID", text: (r: ScoreGridRow) => `${r.code} ${r.name}` };
const MORE_GROUP = "Lainnya";

function numberOrNull(value: CellValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textOrEmpty(value: CellValue): string {
  return typeof value === "string" ? value : "";
}

type ScoreGridProps = {
  caption: string;
  rows: ScoreGridRow[];
  week: number;
  settings: Settings;
  /** Show the Stasiun column (KPS or owner looking at every station). */
  showStation: boolean;
  accessKey: string;
  saveAction: SaveScoreAction;
  /** Week and station selects (server-rendered). */
  toolbar: ReactNode;
  /** "12 dari 27 dinilai". */
  summary: ReactNode;
  emptyState: ReactNode;
  /** The card flow for phones (< 900 px). */
  phone: ReactNode;
};

/**
 * Penilaian Mingguan as an entry grid: ID, Nama, A to F (one key each, a digit commits and
 * moves right), live Rata-rata and Status. Observer, Catatan coaching, the difference to the
 * training baseline and the last change sit behind "Kolom lainnya", always after the core
 * columns (score-columns.ts). Each row saves itself; clearing every input of a saved row asks
 * first. Remount per week and station (key) so pending edits never cross weeks.
 */
export function ScoreGrid(props: ScoreGridProps) {
  const { caption, rows, week, settings, showStation, accessKey, saveAction } = props;
  const [more, setMore] = useState(false);

  const columns = useMemo<GridColumn<ScoreGridRow>[]>(() => {
    const avgOf = (value: (key: string) => CellValue) => practiceAvg(SCORE_KEYS.map((k) => numberOrNull(value(k))));
    const byKey: Record<string, GridColumn<ScoreGridRow>> = {
      code: { key: "code", header: "ID", width: 84, editor: "readonly", frozen: true },
      name: {
        key: "name",
        header: "Nama",
        width: 196,
        editor: "readonly",
        frozen: true,
        render: (value, row) =>
          row.assignmentStatus && row.assignmentStatus !== "Aktif" ? (
            <span className="flex items-center gap-1.5">
              <span className="truncate">{value}</span>
              <StatusChip label={row.assignmentStatus} />
            </span>
          ) : (
            value
          ),
      },
      station: {
        key: "station",
        header: "Stasiun",
        width: 72,
        editor: "readonly",
        render: (value) => <span className="station-code">{value}</span>,
      },
      avg: {
        key: "avg",
        header: "Rata-rata",
        width: 84,
        editor: "readonly",
        align: "end",
        derive: (_row, value) => avgOf(value),
        render: (value) => <span className="font-semibold">{formatScore(numberOrNull(value))}</span>,
      },
      status: {
        key: "status",
        header: "Status",
        width: 136,
        editor: "readonly",
        derive: (_row, value) => weeklyStatus(avgOf(value), settings),
        render: (value) => <StatusChip label={value ? String(value) : null} emptyLabel="Belum dinilai" />,
      },
      observer: { key: "observer", header: "Observer", group: MORE_GROUP, width: 160, editor: "text", maxLength: 200 },
      coaching_notes: {
        key: "coaching_notes",
        header: "Catatan coaching",
        group: MORE_GROUP,
        width: 240,
        editor: "longtext",
        maxLength: 4000,
      },
      delta: {
        key: "delta",
        header: "Δ baseline",
        label: "Selisih rata-rata minggu ini dengan baseline pelatihan",
        group: MORE_GROUP,
        width: 96,
        editor: "readonly",
        align: "end",
        derive: (row, value) => deltaVsBaseline(avgOf(value), row.baselineAvg),
        render: (value) => formatSignedScore(numberOrNull(value)),
      },
      changed: {
        key: "changed",
        header: "Terakhir diubah",
        group: MORE_GROUP,
        width: 232,
        editor: "readonly",
        get: (r) => r.changedLabel,
      },
    };
    for (const a of ASPECTS) {
      byKey[a.field] = {
        key: a.field,
        header: `${a.letter} ${a.name}`,
        group: "Nilai (1 sampai 5)",
        width: a.letter === "F" ? 104 : 88,
        editor: "score",
        advance: true,
      };
    }
    return scoreColumnKeys({ showStation, more }).map((key) => byKey[key]);
  }, [settings, showStation, more]);

  const confirmClear = useMemo(
    () => ({
      fields: SCORE_INPUT_KEYS,
      message: (r: ScoreGridRow) => `Hapus nilai Minggu ke-${week} untuk ${r.name}?`,
      description: "Nilai minggu lain tidak berubah.",
      confirmLabel: "Hapus nilai",
    }),
    [week],
  );

  const onSaveRow = useCallback(
    async (_key: string, changes: Record<string, CellValue>, row: ScoreGridRow): Promise<SaveRowResult> => {
      // The RPC writes every field: hidden columns keep their stored value.
      const pick = (field: string): CellValue =>
        field in changes ? changes[field] : (row[field as keyof ScoreGridRow] as CellValue);
      const result = await saveAction(accessKey, {
        staffCode: row.code,
        week,
        scores: SCORE_KEYS.map((k) => numberOrNull(pick(k))),
        observer: textOrEmpty(pick("observer")),
        coachingNotes: textOrEmpty(pick("coaching_notes")),
      });
      if (result.ok) return { ok: true };
      return {
        ok: false,
        message: result.error.message,
        fieldErrors: result.error.field ? { [result.error.field]: result.error.message } : undefined,
      };
    },
    [accessKey, saveAction, week],
  );

  return (
    <DataGrid
      caption={caption}
      rows={rows}
      columns={columns}
      rowKey={rowKey}
      rowLabel={rowLabel}
      onSaveRow={onSaveRow}
      confirmClear={confirmClear}
      search={SEARCH}
      toolbar={props.toolbar}
      summary={props.summary}
      actions={
        <Button size="sm" variant="secondary" aria-pressed={more} onClick={() => setMore((m) => !m)}>
          {more ? "Sembunyikan kolom lainnya" : "Kolom lainnya"}
        </Button>
      }
      emptyState={props.emptyState}
      phone={props.phone}
    />
  );
}
