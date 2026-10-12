"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { consistency, criteriaStatus, practiceAvg, type Settings } from "@/lib/rules";
import { formatScore } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/States";
import { FilterBar } from "@/components/ui/Toolbar";
import { DataGrid, type CellValue, type GridColumn, type SaveRowResult } from "@/components/grid/DataGrid";
import { ASPECTS } from "@/components/performa/format";
import { StaffDialog } from "./StaffDialog";
import { StaffCards } from "./StaffCards";
import { DeleteStaffDialog } from "./DeleteStaffDialog";
import { REASON_LABELS, SCORE_FIELDS, reasonsFor, staffColumnKeys } from "./rows";
import {
  ASSIGNMENT_STATUSES,
  REPORT_CONCLUSIONS,
  type DeleteStaffAction,
  type SaveGenderAction,
  type SaveStaffAction,
  type SdmRow,
} from "./types";

type StaffGridProps = {
  caption: string;
  rows: SdmRow[];
  /** Station and "Perlu diperiksa" selects (server-rendered). */
  toolbar: ReactNode;
  emptyTitle: string;
  emptyHint: string;
  accessKey: string;
  isKps: boolean;
  ownStation: string | null;
  stations: string[];
  settings: Settings;
  saveAction: SaveStaffAction;
  saveGenderAction: SaveGenderAction;
  /** Owner only (access.kind === "owner"): the "Hapus" row action. The action re-checks it. */
  canDelete: boolean;
  deleteAction: DeleteStaffAction;
};

/** Training-baseline fields: KPS links and the owner only (share_kps_save_staff_baseline). */
const BASELINE = ["pre_test", "post_test", ...SCORE_FIELDS, "report_conclusion"];

const MORE_GROUP = "Lainnya";

const rowKey = (r: SdmRow) => r.code;
const rowLabel = (r: SdmRow) => `${r.code}, ${r.name}`;
const SEARCH = { placeholder: "Nama, ID atau NIPP", text: (r: SdmRow) => `${r.code} ${r.name} ${r.nipp ?? ""}` };

function num(value: CellValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: CellValue): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function chip(value: CellValue) {
  const label = text(value);
  return label ? <StatusChip label={label} /> : null;
}

/**
 * Data SDM as an entry grid. Core columns: ID, Nama (with the "Periksa" marker), Stasiun
 * (KPS), L/P, NIPP, Rata-rata praktik, Kesimpulan, Status penugasan. "Kolom lainnya" adds
 * pre/post-test, the A to F training baseline, the criteria status, the consistency check
 * and Catatan. Training fields are edited by KPS and the owner only. Computed cells follow
 * the row live (lib/rules). Each row saves itself; "Ubah" opens the full form. Under 900 px
 * a card list is shown. Client component.
 */
export function StaffGrid(props: StaffGridProps) {
  const { rows, isKps, accessKey, saveAction, settings, canDelete } = props;
  const [editing, setEditing] = useState<SdmRow | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<SdmRow | null>(null);
  const [more, setMore] = useState(false);

  const openEdit = useCallback((row: SdmRow) => {
    setEditing(row);
    setOpenCount((n) => n + 1);
    setDialogOpen(true);
  }, []);

  const columns = useMemo<GridColumn<SdmRow>[]>(() => {
    const kpsOnly = () => isKps;
    // While the training columns are hidden the grid cannot read them: use the stored values.
    const avg = (row: SdmRow, value: (key: string) => CellValue) =>
      more ? practiceAvg(SCORE_FIELDS.map((k) => num(value(k)))) : row.practiceAvg;
    const postTest = (row: SdmRow, value: (key: string) => CellValue) => (more ? num(value("post_test")) : row.postTest);
    const status = (row: SdmRow, value: (key: string) => CellValue) =>
      criteriaStatus(avg(row, value), postTest(row, value), settings);

    const byKey: Record<string, GridColumn<SdmRow>> = {
      code: { key: "code", header: "ID", width: 84, editor: "readonly", frozen: true },
      name: {
        key: "name",
        header: "Nama",
        width: 220,
        editor: "text",
        required: true,
        maxLength: 200,
        frozen: true,
        render: (value, row) => {
          const reasons = reasonsFor(row).map((r) => REASON_LABELS[r]);
          if (reasons.length === 0) return value;
          return (
            <span className="flex items-center gap-1.5" title={`Perlu diperiksa: ${reasons.join(", ")}`}>
              <span className="truncate">{value}</span>
              <StatusChip label="Periksa" tone="warning" />
              <span className="sr-only">: {reasons.join(", ")}</span>
            </span>
          );
        },
      },
      station: {
        key: "station",
        header: "Stasiun",
        width: 72,
        editor: "readonly",
        render: (value) => <span className="station-code">{value}</span>,
      },
      gender: {
        key: "gender",
        header: "L/P",
        width: 60,
        editor: "select",
        options: [{ value: "L" }, { value: "P" }],
      },
      nipp: {
        key: "nipp",
        header: "NIPP",
        width: 132,
        editor: "text",
        maxLength: 50,
        render: (value, row) =>
          row.duplicateNippWith.length > 0 ? (
            <span className="flex items-center gap-1.5" title={`Sama dengan ${row.duplicateNippWith.join(", ")}`}>
              <span className="tabular-nums">{value}</span>
              <StatusChip label="ganda" />
            </span>
          ) : (
            <span className="tabular-nums">{value}</span>
          ),
      },
      practice_avg: {
        key: "practice_avg",
        header: "Rata-rata praktik",
        width: 96,
        editor: "readonly",
        align: "end",
        derive: avg,
        render: (value) => <span className="font-semibold">{formatScore(num(value)) || "–"}</span>,
      },
      report_conclusion: {
        key: "report_conclusion",
        header: "Kesimpulan",
        label: "Kesimpulan laporan pelatihan",
        width: 168,
        editor: "select",
        options: REPORT_CONCLUSIONS.map((value) => ({ value })),
        get: (r) => r.reportConclusion,
        editable: kpsOnly,
        render: chip,
      },
      assignment_status: {
        key: "assignment_status",
        header: "Status penugasan",
        width: 160,
        editor: "select",
        required: true,
        options: ASSIGNMENT_STATUSES.map((value) => ({ value })),
        get: (r) => r.assignmentStatus,
        render: chip,
      },
      pre_test: {
        key: "pre_test",
        header: "Pre-test",
        group: MORE_GROUP,
        width: 84,
        editor: "number",
        min: 0,
        max: 100,
        decimals: 2,
        get: (r) => r.preTest,
        editable: kpsOnly,
      },
      post_test: {
        key: "post_test",
        header: "Post-test",
        group: MORE_GROUP,
        width: 84,
        editor: "number",
        min: 0,
        max: 100,
        decimals: 2,
        get: (r) => r.postTest,
        editable: kpsOnly,
      },
      criteria: {
        key: "criteria",
        header: "Status kriteria",
        label: "Status menurut kriteria kelulusan",
        group: MORE_GROUP,
        width: 136,
        editor: "readonly",
        derive: status,
        render: chip,
      },
      consistency: {
        key: "consistency",
        header: "Konsistensi",
        label: "Kesimpulan dibanding status kriteria",
        group: MORE_GROUP,
        width: 148,
        editor: "readonly",
        derive: (row, value) => consistency(text(value("report_conclusion")), status(row, value)),
        render: chip,
      },
      notes: { key: "notes", header: "Catatan", group: MORE_GROUP, width: 220, editor: "longtext", maxLength: 4000 },
    };
    ASPECTS.forEach((a, i) => {
      byKey[SCORE_FIELDS[i]] = {
        key: SCORE_FIELDS[i],
        header: a.letter,
        label: `${a.letter} ${a.name}, nilai pelatihan`,
        group: "Nilai pelatihan (1 sampai 5)",
        width: 44,
        editor: "score",
        get: (r) => r.scores[i],
        editable: kpsOnly,
      };
    });
    return staffColumnKeys({ isKps, more }).map((key) => byKey[key]);
  }, [isKps, settings, more]);

  const rowActions = useMemo(
    () => ({
      header: "Aksi",
      width: canDelete ? 156 : 84,
      render: (row: SdmRow) => (
        <>
          <Button size="sm" variant="secondary" tabIndex={-1} onClick={() => openEdit(row)}>
            Ubah<span className="sr-only"> data {row.name}</span>
          </Button>
          {canDelete ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setDeleting(row)}
              className="inline-flex min-h-8 items-center rounded-control px-2 text-xs font-semibold text-critical transition-colors duration-120 hover:bg-critical-tint"
            >
              Hapus<span className="sr-only"> SDM {row.name}</span>
            </button>
          ) : null}
        </>
      ),
    }),
    [canDelete, openEdit],
  );

  const onSaveRow = useCallback(
    async (_key: string, changes: Record<string, CellValue>, row: SdmRow): Promise<SaveRowResult> => {
      // share_save_staff and the baseline RPC write every field: merge the changes into the row.
      const pick = <T,>(field: string, fallback: T): T => (field in changes ? (changes[field] as T) : fallback);
      const baselineChanged = BASELINE.some((field) => field in changes);
      const gender = pick<string | null>("gender", row.gender);
      const result = await saveAction(accessKey, {
        code: row.code,
        station: null,
        name: pick<string>("name", row.name),
        nipp: pick<string | null>("nipp", row.nipp) ?? "",
        gender: gender === "L" || gender === "P" ? gender : null,
        assignmentStatus: pick<string>("assignment_status", row.assignmentStatus),
        notes: pick<string | null>("notes", row.notes) ?? "",
        baseline: baselineChanged
          ? {
              preTest: pick<number | null>("pre_test", row.preTest),
              postTest: pick<number | null>("post_test", row.postTest),
              scores: SCORE_FIELDS.map((field, i) => pick<number | null>(field, row.scores[i])),
              reportConclusion: pick<string | null>("report_conclusion", row.reportConclusion),
            }
          : null,
      });
      if (result.ok) return { ok: true };
      const message = result.saved ? `Profil tersimpan, data pelatihan gagal: ${result.error.message}` : result.error.message;
      return {
        ok: false,
        message,
        fieldErrors: result.error.field ? { [result.error.field]: result.error.message } : undefined,
      };
    },
    [accessKey, saveAction],
  );

  const count = <span className="tabular-nums">{rows.length} SDM</span>;

  return (
    <div className="flex flex-col gap-3">
      <div role="status" aria-live="polite" className="empty:hidden">
        {message ? <p className="text-sm font-semibold text-good">{message}</p> : null}
      </div>
      <DataGrid
        caption={props.caption}
        rows={rows}
        columns={columns}
        rowKey={rowKey}
        rowLabel={rowLabel}
        onSaveRow={onSaveRow}
        search={SEARCH}
        toolbar={props.toolbar}
        summary={count}
        actions={
          <Button size="sm" variant="secondary" aria-pressed={more} onClick={() => setMore((m) => !m)}>
            {more ? "Sembunyikan kolom lainnya" : "Kolom lainnya"}
          </Button>
        }
        rowActions={rowActions}
        emptyState={
          <EmptyState title={props.emptyTitle} layout="inline">
            {props.emptyHint}
          </EmptyState>
        }
        phone={
          <div className="flex flex-col gap-4">
            <FilterBar label="Filter SDM" end={count}>
              {props.toolbar}
            </FilterBar>
            <StaffCards
              rows={rows}
              emptyTitle={props.emptyTitle}
              emptyHint={props.emptyHint}
              accessKey={accessKey}
              saveGenderAction={props.saveGenderAction}
              onEdit={openEdit}
              onDelete={canDelete ? setDeleting : undefined}
            />
          </div>
        }
      />
      <StaffDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        row={editing}
        formKey={`${editing?.code ?? "baru"}-${openCount}`}
        accessKey={accessKey}
        isKps={isKps}
        ownStation={props.ownStation}
        stations={props.stations}
        settings={settings}
        saveAction={saveAction}
        onSaved={setMessage}
        onDelete={canDelete ? setDeleting : undefined}
      />
      {canDelete ? (
        <DeleteStaffDialog
          row={deleting}
          onClose={() => setDeleting(null)}
          accessKey={accessKey}
          deleteAction={props.deleteAction}
          onDeleted={setMessage}
        />
      ) : null}
    </div>
  );
}
