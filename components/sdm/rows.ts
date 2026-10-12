/**
 * Data SDM rows, the "Perlu diperiksa" checks and the column order. Pure (no server-only
 * import), unit-tested.
 */
import { staffBaseline, type Settings } from "@/lib/rules";
import type { Workspace, WorkspaceStaff } from "@/lib/workspace";
import { firstParam, lastChangedLabel } from "@/lib/workspace/view";
import type { SdmRow } from "./types";

/** The record checks, each a reason a row gets the "Periksa" marker. */
export const REASONS = ["beda", "tidak-sesuai", "nipp-ganda"] as const;
export type Reason = (typeof REASONS)[number];

/**
 * `?cek=` values: one reason, "perlu" for any of them, or "lp-kosong". Missing L/P is a
 * filter only, not a marker: it is empty for most staff and would drown the real exceptions.
 */
export const CHECKS = ["perlu", ...REASONS, "lp-kosong"] as const;
export type Check = (typeof CHECKS)[number];

export const REASON_LABELS: Record<Reason, string> = {
  beda: "Beda – verifikasi",
  "tidak-sesuai": "Tidak Sesuai",
  "nipp-ganda": "NIPP ganda",
};

const REASON_MATCHES: Record<Reason, (r: SdmRow) => boolean> = {
  beda: (r) => r.consistency === "Beda – verifikasi",
  // Either the training report or the practice criteria says Tidak Sesuai.
  "tidak-sesuai": (r) => r.criteriaStatus === "Tidak Sesuai" || r.reportConclusion === "Tidak Sesuai",
  "nipp-ganda": (r) => r.duplicateNippWith.length > 0,
};

/** Why a row needs a look, in REASONS order; empty when it is fine. */
export function reasonsFor(row: SdmRow): Reason[] {
  return REASONS.filter((reason) => REASON_MATCHES[reason](row));
}

export const MATCHES: Record<Check, (r: SdmRow) => boolean> = {
  ...REASON_MATCHES,
  perlu: (r) => reasonsFor(r).length > 0,
  "lp-kosong": (r) => r.gender !== "L" && r.gender !== "P",
};

export const CHECK_LABELS: Record<Check, string> = {
  ...REASON_LABELS,
  perlu: "Semua yang perlu diperiksa",
  "lp-kosong": "L/P belum diisi",
};

/** `?cek=` as a check, or null for every row. */
export function parseCheck(raw: string | string[] | undefined): Check | null {
  const value = firstParam(raw);
  return (CHECKS as readonly string[]).includes(value ?? "") ? (value as Check) : null;
}

export const SCORE_FIELDS = ["score_a", "score_b", "score_c", "score_d", "score_e", "score_f"] as const;

/** Training-baseline inputs behind "Kolom lainnya" (KPS and the owner edit them). */
export const BASELINE_EXTRA_KEYS = ["pre_test", "post_test", ...SCORE_FIELDS] as const;

/**
 * Column keys, left to right. The extras always follow the core columns, so hiding them
 * never shifts a core column and Excel paste (which fills the visible columns from the
 * active cell) lands in the same cells either way.
 */
export function staffColumnKeys({ isKps, more }: { isKps: boolean; more: boolean }): string[] {
  const core = [
    "code",
    "name",
    ...(isKps ? ["station"] : []),
    "gender",
    "nipp",
    "practice_avg",
    "report_conclusion",
    "assignment_status",
  ];
  const extra = [...BASELINE_EXTRA_KEYS, "criteria", "consistency", "notes"];
  return more ? [...core, ...extra] : core;
}

type RowSource = Pick<Workspace, "linkId" | "linkLabels" | "staff" | "weeklyScores" | "bmiChecks" | "replacements">;

function countBy<T>(list: readonly T[], key: (item: T) => string | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of list) {
    const k = key(item);
    if (k) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/** Rows for `list`; duplicate NIPPs are looked up across everything the link can see. */
export function toRows(ws: RowSource, list: readonly WorkspaceStaff[], settings: Settings): SdmRow[] {
  const byNipp = new Map<string, WorkspaceStaff[]>();
  for (const s of ws.staff) {
    const nipp = s.nipp?.trim();
    if (nipp) byNipp.set(nipp, [...(byNipp.get(nipp) ?? []), s]);
  }
  const scores = countBy(ws.weeklyScores, (r) => r.staffCode);
  const checks = countBy(ws.bmiChecks, (r) => r.staffCode);
  const replacements = countBy(ws.replacements, (r) => r.staffCode);
  return list.map((s) => {
    const derived = staffBaseline(s, settings);
    const nipp = s.nipp?.trim();
    const sameNipp = nipp ? (byNipp.get(nipp) ?? []) : [];
    return {
      code: s.code,
      station: s.station,
      name: s.name,
      nipp: s.nipp,
      gender: s.gender,
      preTest: s.preTest,
      postTest: s.postTest,
      scores: [s.scoreA, s.scoreB, s.scoreC, s.scoreD, s.scoreE, s.scoreF],
      reportConclusion: s.reportConclusion,
      assignmentStatus: s.assignmentStatus,
      notes: s.notes,
      practiceAvg: derived.practiceAvg,
      criteriaStatus: derived.criteriaStatus,
      consistency: derived.consistency,
      duplicateNippWith: sameNipp.filter((o) => o.code !== s.code).map((o) => `${o.name} (${o.code})`),
      changedLabel: lastChangedLabel(s, ws),
      weeklyScoreCount: scores.get(s.code) ?? 0,
      bmiCheckCount: checks.get(s.code) ?? 0,
      replacementCount: replacements.get(s.code) ?? 0,
    };
  });
}
