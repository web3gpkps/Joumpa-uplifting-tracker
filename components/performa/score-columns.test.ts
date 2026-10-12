import { describe, expect, test } from "bun:test";
import { parseTsv } from "@/lib/grid/tsv";
import { parseCell } from "@/lib/grid/values";
import { MORE_INPUT_KEYS, SCORE_KEYS, scoreColumnKeys } from "./score-columns";

/** Where DataGrid's onPaste puts each pasted cell: visible column active + j, overflow dropped. */
function pasteTargets(keys: string[], startKey: string, text: string): string[][] {
  const start = keys.indexOf(startKey);
  return parseTsv(text).map((line) => line.flatMap((_, j) => (start + j < keys.length ? [keys[start + j]] : [])));
}

describe("Penilaian grid column order", () => {
  test("the extras come after the core columns, so toggling never shifts a core column", () => {
    for (const showStation of [false, true]) {
      const collapsed = scoreColumnKeys({ showStation, more: false });
      const expanded = scoreColumnKeys({ showStation, more: true });
      expect(expanded.slice(0, collapsed.length)).toEqual(collapsed);
      for (const key of MORE_INPUT_KEYS) {
        expect(collapsed).not.toContain(key);
        expect(expanded).toContain(key);
      }
    }
  });

  test("core columns: ID, Nama, (Stasiun), A to F, Rata-rata, Status", () => {
    expect(scoreColumnKeys({ showStation: false, more: false })).toEqual(["code", "name", ...SCORE_KEYS, "avg", "status"]);
    expect(scoreColumnKeys({ showStation: true, more: false })).toEqual([
      "code",
      "name",
      "station",
      ...SCORE_KEYS,
      "avg",
      "status",
    ]);
  });

  test("six scores pasted from Excel at A land in A to F, collapsed or expanded", () => {
    const block = "4\t5\t3\t4\t4\t2\n3\t3\t4\t5\t5\t4\n";
    for (const showStation of [false, true]) {
      const collapsed = pasteTargets(scoreColumnKeys({ showStation, more: false }), "score_a", block);
      const expanded = pasteTargets(scoreColumnKeys({ showStation, more: true }), "score_a", block);
      expect(collapsed).toEqual([SCORE_KEYS, SCORE_KEYS]);
      expect(expanded).toEqual(collapsed);
    }
  });

  test("a wider block only reaches Observer while the extras are shown", () => {
    const block = "4\t5\t3\t4\t4\t2\tx\ty\tBu Rina";
    expect(pasteTargets(scoreColumnKeys({ showStation: false, more: false }), "score_a", block)[0]).toEqual([
      ...SCORE_KEYS,
      "avg",
      "status",
    ]);
    expect(pasteTargets(scoreColumnKeys({ showStation: false, more: true }), "score_a", block)[0]).toEqual([
      ...SCORE_KEYS,
      "avg",
      "status",
      "observer",
    ]);
  });

  test("pasted scores are parsed with the 1 to 5 rule", () => {
    expect(parseCell({ editor: "score" }, "4")).toEqual({ ok: true, value: 4 });
    expect(parseCell({ editor: "score" }, "7").ok).toBe(false);
  });
});
