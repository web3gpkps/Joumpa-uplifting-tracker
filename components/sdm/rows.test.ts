import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "@/lib/rules";
import type { WorkspaceStaff } from "@/lib/workspace";
import { parseTsv } from "@/lib/grid/tsv";
import { MATCHES, SCORE_FIELDS, parseCheck, reasonsFor, staffColumnKeys, toRows } from "./rows";

function staff(code: string, fields: Partial<WorkspaceStaff>): WorkspaceStaff {
  return {
    code,
    station: "SUB",
    name: `Contoh ${code}`,
    nipp: null,
    gender: null,
    preTest: null,
    postTest: null,
    scoreA: null,
    scoreB: null,
    scoreC: null,
    scoreD: null,
    scoreE: null,
    scoreF: null,
    reportConclusion: null,
    assignmentStatus: "Aktif",
    notes: null,
    bmiNote: null,
    sortOrder: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    updatedByLink: null,
    ...fields,
  };
}

const fours = { scoreA: 4, scoreB: 4, scoreC: 4, scoreD: 4, scoreE: 4, scoreF: 4 };
const twos = { scoreA: 2, scoreB: 2, scoreC: 2, scoreD: 2, scoreE: 2, scoreF: 2 };

const list = [
  staff("SUB-01", { ...fours, postTest: 90, reportConclusion: "Sesuai", nipp: "111" }),
  staff("SUB-02", { ...fours, postTest: 90, reportConclusion: "Perlu Perbaikan", nipp: "222" }),
  staff("KNO-12", { ...twos, station: "KNO", reportConclusion: "Tidak Sesuai", nipp: "999" }),
  staff("KNO-13", { station: "KNO", nipp: " 999 " }),
  staff("TMB-01", {}),
];

const WS = {
  linkId: "link-1",
  linkLabels: {},
  staff: list,
  weeklyScores: [{ staffCode: "SUB-01" }, { staffCode: "SUB-01" }],
  bmiChecks: [{ staffCode: "SUB-01" }],
  replacements: [{ staffCode: null }, { staffCode: "KNO-13" }],
} as unknown as Parameters<typeof toRows>[0];

describe("toRows", () => {
  const rows = toRows(WS, list, DEFAULT_SETTINGS);
  const [ok, beda, tidak, nippTwin, added] = rows;

  test("computes average, criteria status and consistency with lib/rules", () => {
    expect(ok).toMatchObject({ practiceAvg: 4, criteriaStatus: "Sesuai", consistency: "OK" });
    expect(beda).toMatchObject({ criteriaStatus: "Sesuai", consistency: "Beda – verifikasi" });
    expect(tidak).toMatchObject({ practiceAvg: 2, criteriaStatus: "Tidak Sesuai" });
    expect(added).toMatchObject({ practiceAvg: null, criteriaStatus: null, consistency: null });
  });

  test("finds duplicate NIPPs (trimmed) across the whole view", () => {
    expect(tidak.duplicateNippWith).toEqual(["Contoh KNO-13 (KNO-13)"]);
    expect(nippTwin.duplicateNippWith).toEqual(["Contoh KNO-12 (KNO-12)"]);
    expect(ok.duplicateNippWith).toEqual([]);
  });

  test("counts the rows that go with a delete", () => {
    expect(ok).toMatchObject({ weeklyScoreCount: 2, bmiCheckCount: 1, replacementCount: 0 });
    expect(nippTwin.replacementCount).toBe(1);
  });

  test("Perlu diperiksa: Beda – verifikasi, Tidak Sesuai, NIPP ganda", () => {
    const codes = (check: keyof typeof MATCHES) => rows.filter(MATCHES[check]).map((r) => r.code);
    expect(codes("beda")).toEqual(["SUB-02"]);
    expect(codes("tidak-sesuai")).toEqual(["KNO-12"]);
    expect(codes("nipp-ganda")).toEqual(["KNO-12", "KNO-13"]);
    expect(codes("perlu")).toEqual(["SUB-02", "KNO-12", "KNO-13"]);
    expect(reasonsFor(tidak)).toEqual(["tidak-sesuai", "nipp-ganda"]);
    expect(reasonsFor(ok)).toEqual([]);
    expect(reasonsFor(added)).toEqual([]);
    // Missing L/P is a filter, never a marker.
    expect(codes("lp-kosong")).toEqual(["SUB-01", "SUB-02", "KNO-12", "KNO-13", "TMB-01"]);
  });
});

test("?cek= values", () => {
  expect(parseCheck("perlu")).toBe("perlu");
  expect(parseCheck(["nipp-ganda"])).toBe("nipp-ganda");
  expect(parseCheck("lp-kosong")).toBe("lp-kosong");
  expect(parseCheck("nipp-kosong")).toBeNull();
  expect(parseCheck(undefined)).toBeNull();
});

describe("Data SDM columns", () => {
  test("core: ID, Nama, (Stasiun), L/P, NIPP, Rata-rata praktik, Kesimpulan, Status penugasan", () => {
    expect(staffColumnKeys({ isKps: false, more: false })).toEqual([
      "code",
      "name",
      "gender",
      "nipp",
      "practice_avg",
      "report_conclusion",
      "assignment_status",
    ]);
    expect(staffColumnKeys({ isKps: true, more: false })).toEqual([
      "code",
      "name",
      "station",
      "gender",
      "nipp",
      "practice_avg",
      "report_conclusion",
      "assignment_status",
    ]);
  });

  test("extras follow the core columns, so toggling never shifts a core column", () => {
    for (const isKps of [false, true]) {
      const core = staffColumnKeys({ isKps, more: false });
      const all = staffColumnKeys({ isKps, more: true });
      expect(all.slice(0, core.length)).toEqual(core);
      for (const key of ["pre_test", "post_test", ...SCORE_FIELDS, "notes"]) {
        expect(core).not.toContain(key);
        expect(all).toContain(key);
      }
    }
  });

  test("an L/P + NIPP block pasted at L/P lands in the same cells, collapsed or expanded", () => {
    const block = "P\t12345\nL\t67890";
    for (const isKps of [false, true]) {
      const targets = (more: boolean) => {
        const keys = staffColumnKeys({ isKps, more });
        const start = keys.indexOf("gender");
        return parseTsv(block).map((line) => line.map((_, j) => keys[start + j]));
      };
      expect(targets(false)).toEqual([
        ["gender", "nipp"],
        ["gender", "nipp"],
      ]);
      expect(targets(true)).toEqual(targets(false));
    }
  });
});
