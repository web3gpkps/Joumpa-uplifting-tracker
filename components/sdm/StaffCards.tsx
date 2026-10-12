"use client";

import { useState } from "react";
import { formatScore } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { SaveStatus, type SaveState } from "@/components/ui/SaveStatus";
import { EmptyState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { REASON_LABELS, reasonsFor } from "./rows";
import type { SaveGenderAction, SdmRow } from "./types";

type StaffCardsProps = {
  rows: SdmRow[];
  emptyTitle: string;
  emptyHint: string;
  accessKey: string;
  saveGenderAction: SaveGenderAction;
  onEdit: (row: SdmRow) => void;
  /** Owner only: opens the delete confirmation. */
  onDelete?: (row: SdmRow) => void;
};

/**
 * Data SDM on phones (< 900 px): one card per person with the core fields, the "Periksa"
 * marker and its reasons, L/P as a select that saves on change, and "Ubah data" for the
 * full form. Client component.
 */
export function StaffCards({ rows, emptyTitle, emptyHint, accessKey, saveGenderAction, onEdit, onDelete }: StaffCardsProps) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle}>{emptyHint}</EmptyState>;
  }
  return (
    <ul className="rounded-panel border border-line bg-surface">
      {rows.map((row) => {
        const reasons = reasonsFor(row).map((r) => REASON_LABELS[r]);
        return (
          <li key={row.code} className="flex flex-col gap-3 border-b border-line px-4 py-4 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-ink">{row.name}</h3>
                <p className="text-xs text-ink-muted tabular-nums">
                  {row.code} · <span className="station-code">{row.station}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {reasons.length > 0 ? <StatusChip label="Periksa" tone="warning" /> : null}
                {row.assignmentStatus !== "Aktif" ? <StatusChip label={row.assignmentStatus} /> : null}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="min-w-0">
                <dt className="section-label">NIPP</dt>
                <dd className={row.nipp ? "tabular-nums break-words" : "text-ink-muted"}>{row.nipp ?? "–"}</dd>
              </div>
              <div>
                <dt className="section-label">Rata-rata praktik</dt>
                <dd className="font-semibold tabular-nums">{formatScore(row.practiceAvg) || "–"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="section-label">Kesimpulan</dt>
                <dd>
                  <StatusChip label={row.reportConclusion} emptyLabel="–" />
                </dd>
              </div>
            </dl>

            {reasons.length > 0 ? (
              <p className="text-xs text-warning">
                Perlu diperiksa: {reasons.join(", ")}
                {row.duplicateNippWith.length > 0 ? ` (sama dengan ${row.duplicateNippWith.join(", ")})` : null}
              </p>
            ) : null}

            <GenderSelect row={row} accessKey={accessKey} saveGenderAction={saveGenderAction} />

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => onEdit(row)}>
                Ubah data<span className="sr-only"> {row.name}</span>
              </Button>
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-critical transition-colors duration-120 hover:bg-critical-tint"
                >
                  Hapus SDM<span className="sr-only"> {row.name}</span>
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** L/P select that saves on change (only L/P changes; the rest is sent as shown). */
function GenderSelect({ row, accessKey, saveGenderAction }: { row: SdmRow; accessKey: string; saveGenderAction: SaveGenderAction }) {
  const [value, setValue] = useState(row.gender ?? "");
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [prevGender, setPrevGender] = useState(row.gender);

  // Changed elsewhere (edit dialog, another link) and refreshed: show the stored value.
  if (prevGender !== row.gender) {
    setPrevGender(row.gender);
    if (state.status !== "saving") setValue(row.gender ?? "");
  }

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setState({ status: "saving" });
    try {
      const result = await saveGenderAction(
        accessKey,
        { code: row.code, name: row.name, nipp: row.nipp, assignmentStatus: row.assignmentStatus, notes: row.notes },
        next === "L" || next === "P" ? next : null,
      );
      if (result.ok) {
        setState({ status: "saved", at: result.savedAt });
      } else {
        setValue(previous);
        setState({ status: "error", message: result.error.message });
      }
    } catch {
      setValue(previous);
      setState({ status: "error", message: "koneksi terputus. Pilih lagi." });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        L/P<span className="sr-only"> {row.name}</span>
        <span className="w-40">
          <Select value={value} onChange={(event) => void change(event.target.value)}>
            <option value="">Belum diisi</option>
            <option value="L">L (laki-laki)</option>
            <option value="P">P (perempuan)</option>
          </Select>
        </span>
      </label>
      <SaveStatus state={state} />
    </div>
  );
}
