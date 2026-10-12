/**
 * Column order of the Penilaian Mingguan grid (pure, unit-tested).
 *
 * Paste from Excel fills the grid's visible columns from the active cell to the right
 * (DataGrid onPaste). So the extra columns ("Kolom lainnya") always come after the core
 * ones: showing or hiding them never shifts a core column, and six scores pasted at A land
 * in A to F either way. A wider block only reaches the extras while they are shown;
 * otherwise the overflow falls on read-only cells or off the edge and is dropped.
 */
import { ASPECTS } from "./format";

export const SCORE_KEYS = ASPECTS.map((a) => a.field);

/** Input fields behind "Kolom lainnya", in display order. */
export const MORE_INPUT_KEYS = ["observer", "coaching_notes"] as const;

/** Read-only extras shown with them. */
export const MORE_READONLY_KEYS = ["delta", "changed"] as const;

/** Every input field of a weekly score row (all blank deletes the row). */
export const SCORE_INPUT_KEYS: string[] = [...SCORE_KEYS, ...MORE_INPUT_KEYS];

/** Visible column keys, left to right. */
export function scoreColumnKeys({ showStation, more }: { showStation: boolean; more: boolean }): string[] {
  const core = ["code", "name", ...(showStation ? ["station"] : []), ...SCORE_KEYS, "avg", "status"];
  return more ? [...core, ...MORE_INPUT_KEYS, ...MORE_READONLY_KEYS] : core;
}
